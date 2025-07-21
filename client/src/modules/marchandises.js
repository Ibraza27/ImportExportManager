/**
 * Module de gestion des marchandises/colis
 * Gère la réception, le suivi et l'affectation des marchandises
 */

// Variables du module
let marchandisesTable = null;
let currentMarchandises = [];
let selectedMarchandise = null;
let scannerActive = false;
let currentFilter = 'all';

// =============================================
// INITIALISATION DU MODULE
// =============================================

export async function init() {
    electronAPI.log.info('Initialisation du module Marchandises');
    
    try {
        // Charger les données initiales
        await loadMarchandises();
        
        // Initialiser l'interface
        initializeUI();
        
        // Initialiser les gestionnaires d'événements
        initializeEventHandlers();
        
        // Initialiser le scanner si disponible
        initializeScanner();
        
        // Mettre à jour les statistiques
        updateStats();
        
    } catch (error) {
        electronAPI.log.error('Erreur initialisation module marchandises:', error);
        Helpers.showError('Erreur', 'Impossible de charger le module marchandises');
    }
}

// =============================================
// CHARGEMENT DES DONNÉES
// =============================================

async function loadMarchandises() {
    try {
        const params = currentFilter !== 'all' ? { statut: currentFilter } : {};
        const response = await API.marchandises.getAll(params);
        currentMarchandises = response.data || response;
        
        // Enrichir avec les données clients
        await enrichMarchandisesData();
        
        renderMarchandisesTable();
        
    } catch (error) {
        electronAPI.log.error('Erreur chargement marchandises:', error);
        throw error;
    }
}

async function enrichMarchandisesData() {
    // Récupérer les infos clients pour chaque marchandise
    const clientIds = [...new Set(currentMarchandises.map(m => m.client_id))];
    const clientsMap = new Map();
    
    for (const clientId of clientIds) {
        try {
            const client = await API.clients.getById(clientId);
            clientsMap.set(clientId, client);
        } catch (error) {
            electronAPI.log.warn(`Client ${clientId} introuvable`);
        }
    }
    
    // Enrichir les marchandises avec les infos clients
    currentMarchandises.forEach(marchandise => {
        const client = clientsMap.get(marchandise.client_id);
        if (client) {
            marchandise.client_nom = `${client.nom} ${client.prenom}`;
            marchandise.client_telephone = client.telephone_principal;
        }
    });
}

// =============================================
// INTERFACE UTILISATEUR
// =============================================

function initializeUI() {
    // Initialiser DataTable
    if ($.fn.DataTable.isDataTable('#marchandises-table')) {
        $('#marchandises-table').DataTable().destroy();
    }
    
    marchandisesTable = Helpers.initDataTable('#marchandises-table', {
        columns: [
            { 
                data: 'code_barre', 
                title: 'Code-barres',
                render: (data) => `<code>${data}</code>`
            },
            { 
                data: 'date_reception', 
                title: 'Date réception',
                render: (data) => Helpers.formatDate(data)
            },
            { data: 'client_nom', title: 'Client' },
            { data: 'designation', title: 'Désignation' },
            { 
                data: 'type_marchandise', 
                title: 'Type',
                render: renderType
            },
            { 
                data: 'nombre_colis', 
                title: 'Nb Colis',
                className: 'text-center'
            },
            { 
                data: 'etat_reception', 
                title: 'État',
                render: renderEtat
            },
            { 
                data: 'statut', 
                title: 'Statut',
                render: renderStatut
            },
            { 
                data: 'conteneur_id', 
                title: 'Conteneur',
                render: renderConteneur
            },
            {
                data: null,
                title: 'Actions',
                orderable: false,
                render: renderActions
            }
        ],
        order: [[1, 'desc']],
        language: {
            url: '//cdn.datatables.net/plug-ins/1.13.7/i18n/fr-FR.json'
        }
    });
    
    // Initialiser les selects
    Helpers.initSelect2('#filter-type', {
        placeholder: 'Tous les types'
    });
    
    Helpers.initSelect2('#filter-etat', {
        placeholder: 'Tous les états'
    });
    
    Helpers.initSelect2('#select-client', {
        placeholder: 'Rechercher un client...',
        ajax: {
            delay: 250,
            transport: function(params, success, failure) {
                API.search.clients(params.data.term)
                    .then(success)
                    .catch(failure);
            },
            processResults: function(data) {
                return {
                    results: data.map(client => ({
                        id: client.id,
                        text: `${client.nom} ${client.prenom} - ${client.telephone_principal}`
                    }))
                };
            }
        }
    });
    
    // Initialiser le datepicker
    Helpers.initDatePicker('#date_reception', {
        defaultDate: 'today',
        maxDate: 'today'
    });
}

function renderType(type) {
    const types = {
        'colis': { icon: 'fa-box', color: 'primary' },
        'vehicule': { icon: 'fa-car', color: 'info' },
        'palette': { icon: 'fa-pallet', color: 'warning' },
        'autre': { icon: 'fa-cube', color: 'secondary' }
    };
    
    const config = types[type] || types.autre;
    return `<span class="badge bg-${config.color}">
        <i class="fas ${config.icon} me-1"></i>${type}
    </span>`;
}

function renderEtat(etat) {
    const etats = {
        'bon_etat': { label: 'Bon état', color: 'success', icon: 'fa-check' },
        'endommage': { label: 'Endommagé', color: 'danger', icon: 'fa-exclamation-triangle' },
        'fragile': { label: 'Fragile', color: 'warning', icon: 'fa-glass' },
        'manquant': { label: 'Manquant', color: 'dark', icon: 'fa-question' }
    };
    
    const config = etats[etat] || etats.bon_etat;
    return `<span class="badge bg-${config.color}">
        <i class="fas ${config.icon} me-1"></i>${config.label}
    </span>`;
}

function renderStatut(statut) {
    const color = CONSTANTS.STATUS_COLORS[statut] || 'secondary';
    const icon = CONSTANTS.STATUS_ICONS[statut] || 'fa-circle';
    const label = statut.replace(/_/g, ' ');
    
    return `<span class="badge bg-${color}">
        <i class="fas ${icon} me-1"></i>${label}
    </span>`;
}

function renderConteneur(conteneurId) {
    if (!conteneurId) {
        return '<span class="text-muted">Non affecté</span>';
    }
    return `<a href="#" onclick="marchandisesModule.viewConteneur(${conteneurId})">${conteneurId}</a>`;
}

function renderActions(data, type, row) {
    const canAssign = !row.conteneur_id && row.statut === 'receptionne';
    const canPrint = row.code_barre;
    
    return `
        <div class="btn-group btn-group-sm" role="group">
            <button class="btn btn-info" onclick="marchandisesModule.viewMarchandise('${row.id}')" 
                title="Voir détails">
                <i class="fas fa-eye"></i>
            </button>
            <button class="btn btn-primary" onclick="marchandisesModule.editMarchandise('${row.id}')" 
                title="Modifier">
                <i class="fas fa-edit"></i>
            </button>
            ${canAssign ? `
            <button class="btn btn-success" onclick="marchandisesModule.assignToContainer('${row.id}')" 
                title="Affecter à un conteneur">
                <i class="fas fa-link"></i>
            </button>` : ''}
            ${canPrint ? `
            <button class="btn btn-secondary" onclick="marchandisesModule.printLabel('${row.id}')" 
                title="Imprimer étiquette">
                <i class="fas fa-print"></i>
            </button>` : ''}
            <button class="btn btn-danger" onclick="marchandisesModule.deleteMarchandise('${row.id}')" 
                title="Supprimer">
                <i class="fas fa-trash"></i>
            </button>
        </div>
    `;
}

// =============================================
// GESTIONNAIRES D'ÉVÉNEMENTS
// =============================================

function initializeEventHandlers() {
    // Bouton nouvelle marchandise
    $('#btn-new-marchandise').on('click', () => {
        showMarchandiseModal();
    });
    
    // Bouton scanner
    $('#btn-scan-marchandise').on('click', () => {
        toggleScanner();
    });
    
    // Bouton refresh
    $('#btn-refresh').on('click', async () => {
        await loadMarchandises();
        Helpers.showToast('Données actualisées', 'success');
    });
    
    // Boutons de filtre rapide
    $('.filter-status-btn').on('click', function() {
        $('.filter-status-btn').removeClass('active');
        $(this).addClass('active');
        currentFilter = $(this).data('status');
        loadMarchandises();
    });
    
    // Filtres
    $('#filter-type, #filter-etat').on('change', applyFilters);
    $('#search-marchandise').on('input', Helpers.debounce(applyFilters, 300));
    
    // Formulaire marchandise
    $('#marchandise-form').on('submit', async (e) => {
        e.preventDefault();
        await saveMarchandise();
    });
    
    // Type de marchandise change
    $('#type_marchandise').on('change', function() {
        const isVehicle = $(this).val() === 'vehicule';
        $('#vehicle-details').toggle(isVehicle);
        $('#package-details').toggle(!isVehicle);
    });
    
    // Calcul automatique du volume
    $('#longueur, #largeur, #hauteur').on('input', calculateVolume);
    
    // Upload photos
    $('#photos').on('change', handlePhotoUpload);
    
    // Génération code-barres
    $('#btn-generate-barcode').on('click', generateBarcode);
    
    // Mode de réception
    $('#mode_reception').on('change', function() {
        const needsTracking = $(this).val() === 'poste';
        $('#tracking-number-group').toggle(needsTracking);
    });
}

// =============================================
// SCANNER DE CODES-BARRES
// =============================================

function initializeScanner() {
    // Vérifier si Quagga est disponible
    if (typeof Quagga === 'undefined') {
        electronAPI.log.warn('Librairie Quagga non chargée');
        return;
    }
    
    // Configuration du scanner
    Quagga.init({
        inputStream: {
            name: "Live",
            type: "LiveStream",
            target: document.querySelector('#scanner-preview'),
            constraints: {
                width: 640,
                height: 480,
                facingMode: "environment"
            }
        },
        decoder: {
            readers: ["code_128_reader", "ean_reader", "ean_8_reader", "code_39_reader"]
        }
    }, function(err) {
        if (err) {
            electronAPI.log.error('Erreur initialisation scanner:', err);
            return;
        }
        electronAPI.log.info('Scanner initialisé');
    });
    
    // Gestionnaire de détection
    Quagga.onDetected(function(result) {
        const code = result.codeResult.code;
        electronAPI.log.info('Code-barres détecté:', code);
        
        // Arrêter le scanner
        toggleScanner(false);
        
        // Rechercher la marchandise
        searchByBarcode(code);
    });
}

function toggleScanner(forceState = null) {
    scannerActive = forceState !== null ? forceState : !scannerActive;
    
    if (scannerActive) {
        $('#scanner-modal').modal('show');
        Quagga.start();
        $('#btn-scan-marchandise').addClass('btn-warning').removeClass('btn-secondary');
        $('#btn-scan-marchandise i').addClass('fa-spin');
    } else {
        $('#scanner-modal').modal('hide');
        Quagga.stop();
        $('#btn-scan-marchandise').removeClass('btn-warning').addClass('btn-secondary');
        $('#btn-scan-marchandise i').removeClass('fa-spin');
    }
}

async function searchByBarcode(code) {
    try {
        const result = await API.marchandises.scanBarcode(code);
        
        if (result) {
            // Marchandise trouvée
            showMarchandiseDetails(result);
            
            // Notification temps réel
            WebSocketManager.sendUpdate('scan', {
                code: code,
                found: true,
                marchandise: result
            });
        } else {
            // Non trouvée - proposer de créer
            const create = await Helpers.confirm(
                'Code-barres non trouvé',
                `Le code ${code} n'existe pas. Voulez-vous créer une nouvelle marchandise ?`
            );
            
            if (create) {
                showMarchandiseModal(null, code);
            }
        }
        
    } catch (error) {
        electronAPI.log.error('Erreur recherche code-barres:', error);
        Helpers.showError('Erreur', 'Impossible de rechercher le code-barres');
    }
}

// =============================================
// FONCTIONS CRUD
// =============================================

function showMarchandiseModal(marchandiseId = null, barcode = null) {
    selectedMarchandise = marchandiseId ? 
        currentMarchandises.find(m => m.id == marchandiseId) : null;
    
    // Réinitialiser le formulaire
    $('#marchandise-form')[0].reset();
    $('#marchandise-id').val('');
    $('#photos-preview').empty();
    $('#vehicle-details').hide();
    $('#tracking-number-group').hide();
    
    if (selectedMarchandise) {
        // Mode édition
        $('#marchandise-modal-title').text('Modifier la marchandise');
        fillMarchandiseForm(selectedMarchandise);
    } else {
        // Mode création
        $('#marchandise-modal-title').text('Nouvelle marchandise');
        $('#date_reception').val(new Date().toISOString().split('T')[0]);
        
        if (barcode) {
            $('#code_barre').val(barcode);
        } else {
            generateBarcode();
        }
    }
    
    $('#marchandise-modal').modal('show');
}

function fillMarchandiseForm(marchandise) {
    $('#marchandise-id').val(marchandise.id);
    $('#code_barre').val(marchandise.code_barre);
    $('#select-client').append(new Option(marchandise.client_nom, marchandise.client_id, true, true));
    $('#date_reception').val(marchandise.date_reception.split('T')[0]);
    $('#mode_reception').val(marchandise.mode_reception).trigger('change');
    $('#etat_reception').val(marchandise.etat_reception);
    $('#type_marchandise').val(marchandise.type_marchandise).trigger('change');
    $('#designation').val(marchandise.designation);
    $('#description_detaillee').val(marchandise.description_detaillee);
    $('#nombre_colis').val(marchandise.nombre_colis);
    $('#poids').val(marchandise.poids);
    $('#longueur').val(marchandise.longueur);
    $('#largeur').val(marchandise.largeur);
    $('#hauteur').val(marchandise.hauteur);
    $('#valeur_declaree').val(marchandise.valeur_declaree);
    $('#emplacement_stockage').val(marchandise.emplacement_stockage);
    $('#commentaires').val(marchandise.commentaires);
    
    // Afficher les photos existantes
    if (marchandise.photos && marchandise.photos.length > 0) {
        marchandise.photos.forEach(photo => {
            addPhotoPreview(photo);
        });
    }
}

async function saveMarchandise() {
    try {
        // Validation
        if (!validateMarchandiseForm()) {
            return;
        }
        
        // Récupérer les données du formulaire
        const formData = getMarchandiseFormData();
        
        Helpers.showLoader('Enregistrement en cours...');
        
        let response;
        if (formData.id) {
            // Mise à jour
            response = await API.marchandises.update(formData.id, formData);
        } else {
            // Création
            response = await API.marchandises.create(formData);
        }
        
        // Upload des photos si nécessaire
        const photoFiles = $('#photos')[0].files;
        if (photoFiles.length > 0) {
            for (const file of photoFiles) {
                await API.marchandises.uploadPhoto(response.id, file);
            }
        }
        
        // Fermer le modal
        $('#marchandise-modal').modal('hide');
        
        // Rafraîchir les données
        await loadMarchandises();
        
        // Notification temps réel
        WebSocketManager.sendUpdate('marchandise', {
            action: formData.id ? 'update' : 'create',
            data: response
        });
        
        Helpers.hideLoader();
        Helpers.showSuccess('Succès', formData.id ? 
            'Marchandise mise à jour avec succès' : 
            'Marchandise créée avec succès'
        );
        
        // Imprimer l'étiquette si nouvelle marchandise
        if (!formData.id) {
            const print = await Helpers.confirm(
                'Imprimer l\'étiquette',
                'Voulez-vous imprimer l\'étiquette de la marchandise ?'
            );
            if (print) {
                printLabel(response.id);
            }
        }
        
    } catch (error) {
        Helpers.hideLoader();
        electronAPI.log.error('Erreur sauvegarde marchandise:', error);
        Helpers.showError('Erreur', 'Impossible d\'enregistrer la marchandise');
    }
}

function validateMarchandiseForm() {
    const required = ['select-client', 'designation', 'type_marchandise'];
    let isValid = true;
    
    required.forEach(field => {
        const input = $(`#${field}`);
        const value = input.val();
        
        if (!value || value.trim() === '') {
            input.addClass('is-invalid');
            isValid = false;
        } else {
            input.removeClass('is-invalid');
        }
    });
    
    // Validation du poids si renseigné
    const poids = $('#poids').val();
    if (poids && parseFloat(poids) <= 0) {
        $('#poids').addClass('is-invalid');
        isValid = false;
    }
    
    if (!isValid) {
        Helpers.showToast('Veuillez corriger les erreurs', 'error');
    }
    
    return isValid;
}

function getMarchandiseFormData() {
    const formData = {
        id: $('#marchandise-id').val() || null,
        code_barre: $('#code_barre').val(),
        client_id: $('#select-client').val(),
        date_reception: $('#date_reception').val(),
        mode_reception: $('#mode_reception').val(),
        etat_reception: $('#etat_reception').val(),
        type_marchandise: $('#type_marchandise').val(),
        designation: $('#designation').val().trim(),
        description_detaillee: $('#description_detaillee').val().trim(),
        nombre_colis: parseInt($('#nombre_colis').val()) || 1,
        poids: parseFloat($('#poids').val()) || null,
        longueur: parseFloat($('#longueur').val()) || null,
        largeur: parseFloat($('#largeur').val()) || null,
        hauteur: parseFloat($('#hauteur').val()) || null,
        volume: parseFloat($('#volume').val()) || null,
        valeur_declaree: parseFloat($('#valeur_declaree').val()) || null,
        emplacement_stockage: $('#emplacement_stockage').val().trim(),
        commentaires: $('#commentaires').val().trim()
    };
    
    return formData;
}

// =============================================
// FONCTIONS D'AFFECTATION
// =============================================

async function assignToContainer(marchandiseId) {
    try {
        // Récupérer les conteneurs ouverts
        const containers = await API.conteneurs.getActive();
        
        if (containers.length === 0) {
            Helpers.showError('Aucun conteneur', 'Aucun conteneur ouvert disponible');
            return;
        }
        
        // Afficher la modal de sélection
        showAssignModal(marchandiseId, containers);
        
    } catch (error) {
        electronAPI.log.error('Erreur chargement conteneurs:', error);
        Helpers.showError('Erreur', 'Impossible de charger les conteneurs');
    }
}

function showAssignModal(marchandiseId, containers) {
    const marchandise = currentMarchandises.find(m => m.id == marchandiseId);
    
    $('#assign-marchandise-name').text(marchandise.designation);
    
    // Construire la liste des conteneurs
    const containersList = containers.map(c => {
        const filling = Helpers.calculateFillingRate(c.volume_utilise, c.capacite_volume_total);
        return `
            <div class="form-check mb-3 p-3 border rounded">
                <input class="form-check-input" type="radio" name="container" 
                       id="container-${c.id}" value="${c.id}">
                <label class="form-check-label w-100" for="container-${c.id}">
                    <div class="d-flex justify-content-between">
                        <strong>${c.numero_conteneur}</strong>
                        <span>${c.destination_ville}, ${c.destination_pays}</span>
                    </div>
                    <div class="progress mt-2" style="height: 20px;">
                        <div class="progress-bar" style="width: ${filling}%">${filling}%</div>
                    </div>
                    <small class="text-muted">
                        ${c.nombre_marchandises} colis - Départ: ${Helpers.formatDate(c.date_depart_prevue)}
                    </small>
                </label>
            </div>
        `;
    }).join('');
    
    $('#containers-list').html(containersList || '<p class="text-muted">Aucun conteneur disponible</p>');
    
    // Gestionnaire de soumission
    $('#assign-form').off('submit').on('submit', async (e) => {
        e.preventDefault();
        
        const containerId = $('input[name="container"]:checked').val();
        if (!containerId) {
            Helpers.showToast('Veuillez sélectionner un conteneur', 'error');
            return;
        }
        
        try {
            Helpers.showLoader('Affectation en cours...');
            
            await API.marchandises.assignToContainer(marchandiseId, containerId);
            
            $('#assign-modal').modal('hide');
            await loadMarchandises();
            
            Helpers.hideLoader();
            Helpers.showSuccess('Succès', 'Marchandise affectée au conteneur');
            
        } catch (error) {
            Helpers.hideLoader();
            electronAPI.log.error('Erreur affectation:', error);
            Helpers.showError('Erreur', 'Impossible d\'affecter la marchandise');
        }
    });
    
    $('#assign-modal').modal('show');
}

// =============================================
// FONCTIONS D'IMPRESSION
// =============================================

async function printLabel(marchandiseId) {
    try {
        const marchandise = currentMarchandises.find(m => m.id == marchandiseId);
        if (!marchandise) return;
        
        // Générer le HTML de l'étiquette
        const labelHtml = generateLabelHtml(marchandise);
        
        // Créer une fenêtre d'impression
        const printWindow = window.open('', '_blank', 'width=400,height=600');
        printWindow.document.write(labelHtml);
        printWindow.document.close();
        
        // Lancer l'impression
        setTimeout(() => {
            printWindow.print();
            printWindow.close();
        }, 500);
        
    } catch (error) {
        electronAPI.log.error('Erreur impression étiquette:', error);
        Helpers.showError('Erreur', 'Impossible d\'imprimer l\'étiquette');
    }
}

function generateLabelHtml(marchandise) {
    return `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Étiquette - ${marchandise.code_barre}</title>
            <style>
                body {
                    font-family: Arial, sans-serif;
                    margin: 0;
                    padding: 20px;
                }
                .label {
                    border: 2px solid #000;
                    padding: 20px;
                    text-align: center;
                }
                .barcode {
                    font-family: 'Libre Barcode 128', monospace;
                    font-size: 48px;
                    margin: 20px 0;
                }
                .info {
                    margin: 10px 0;
                    font-size: 14px;
                }
                .client {
                    font-weight: bold;
                    font-size: 16px;
                }
                @media print {
                    .no-print { display: none; }
                }
            </style>
            <link href="https://fonts.googleapis.com/css2?family=Libre+Barcode+128&display=swap" rel="stylesheet">
        </head>
        <body>
            <div class="label">
                <h2>IMPORT EXPORT MARITIME</h2>
                <div class="barcode">${marchandise.code_barre}</div>
                <div class="info">
                    <div class="client">${marchandise.client_nom}</div>
                    <div>${marchandise.designation}</div>
                    <div>${marchandise.nombre_colis} colis - ${marchandise.poids || '?'} kg</div>
                    <div>Reçu le: ${Helpers.formatDate(marchandise.date_reception)}</div>
                </div>
            </div>
        </body>
        </html>
    `;
}

// =============================================
// FONCTIONS UTILITAIRES
// =============================================

function generateBarcode() {
    const barcode = Helpers.generateBarcode();
    $('#code_barre').val(barcode);
}

function calculateVolume() {
    const longueur = parseFloat($('#longueur').val()) || 0;
    const largeur = parseFloat($('#largeur').val()) || 0;
    const hauteur = parseFloat($('#hauteur').val()) || 0;
    
    const volume = (longueur * largeur * hauteur) / 1000000; // Convertir en m³
    $('#volume').val(volume.toFixed(3));
}

function handlePhotoUpload(event) {
    const files = event.target.files;
    const maxFiles = CONSTANTS.LIMITS.MAX_PHOTOS_PER_ITEM;
    
    if (files.length > maxFiles) {
        Helpers.showError('Trop de photos', `Maximum ${maxFiles} photos autorisées`);
        event.target.value = '';
        return;
    }
    
    // Vérifier la taille des fichiers
    for (const file of files) {
        if (file.size > CONSTANTS.LIMITS.MAX_FILE_SIZE) {
            Helpers.showError('Fichier trop volumineux', 
                `Le fichier ${file.name} dépasse la taille maximale autorisée`);
            event.target.value = '';
            return;
        }
    }
    
    // Afficher les aperçus
    $('#photos-preview').empty();
    for (const file of files) {
        const reader = new FileReader();
        reader.onload = function(e) {
            addPhotoPreview(e.target.result, file.name);
        };
        reader.readAsDataURL(file);
    }
}

function addPhotoPreview(src, name = '') {
    const preview = `
        <div class="col-4 mb-2">
            <div class="position-relative">
                <img src="${src}" class="img-thumbnail" alt="${name}">
                <button type="button" class="btn btn-sm btn-danger position-absolute top-0 end-0"
                        onclick="$(this).parent().parent().remove()">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        </div>
    `;
    $('#photos-preview').append(preview);
}

function applyFilters() {
    const type = $('#filter-type').val();
    const etat = $('#filter-etat').val();
    const search = $('#search-marchandise').val().toLowerCase();
    
    let filtered = currentMarchandises;
    
    if (type) {
        filtered = filtered.filter(m => m.type_marchandise === type);
    }
    
    if (etat) {
        filtered = filtered.filter(m => m.etat_reception === etat);
    }
    
    if (search) {
        filtered = Helpers.fuzzySearch(filtered, search, [
            'code_barre', 'designation', 'client_nom', 'description_detaillee'
        ]);
    }
    
    marchandisesTable.clear();
    marchandisesTable.rows.add(filtered);
    marchandisesTable.draw();
}

function updateStats() {
    const stats = {
        total: currentMarchandises.length,
        waiting: currentMarchandises.filter(m => m.statut === 'en_attente').length,
        assigned: currentMarchandises.filter(m => m.conteneur_id).length,
        intransit: currentMarchandises.filter(m => m.statut === 'en_transit').length,
        delivered: currentMarchandises.filter(m => m.statut === 'livre').length
    };
    
    $('#stat-total-marchandises').text(stats.total);
    $('#stat-waiting').text(stats.waiting);
    $('#stat-assigned').text(stats.assigned);
    $('#stat-intransit').text(stats.intransit);
    $('#stat-delivered').text(stats.delivered);
}

// =============================================
// GESTION TEMPS RÉEL
// =============================================

export function handleRealtimeUpdate(type, data) {
    if (type !== 'marchandise' && type !== 'scan') return;
    
    electronAPI.log.info('Mise à jour temps réel marchandise:', data);
    
    // Rafraîchir les données
    loadMarchandises();
}

// =============================================
// API PUBLIQUE DU MODULE
// =============================================

window.marchandisesModule = {
    viewMarchandise: async (id) => {
        const marchandise = await API.marchandises.getById(id);
        showMarchandiseDetails(marchandise);
    },
    editMarchandise: showMarchandiseModal,
    deleteMarchandise: async (id) => {
        const confirmed = await Helpers.confirm(
            'Supprimer la marchandise',
            'Êtes-vous sûr de vouloir supprimer cette marchandise ?'
        );
        
        if (!confirmed) return;
        
        try {
            await API.marchandises.delete(id);
            await loadMarchandises();
            Helpers.showSuccess('Succès', 'Marchandise supprimée');
        } catch (error) {
            Helpers.showError('Erreur', 'Impossible de supprimer la marchandise');
        }
    },
    assignToContainer,
    printLabel,
    viewConteneur: (id) => {
        window.location.hash = '#conteneurs';
        setTimeout(() => window.conteneursModule?.viewContainer(id), 500);
    }
};

function showMarchandiseDetails(marchandise) {
    // TODO: Implémenter l'affichage détaillé
    console.log('Détails marchandise:', marchandise);
}