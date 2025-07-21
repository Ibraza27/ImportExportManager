/**
 * Module de gestion des conteneurs
 * Gère la création, le suivi et la clôture des conteneurs
 */

// Variables du module
let conteneursTable = null;
let currentConteneurs = [];
let selectedConteneur = null;
let currentView = 'active'; // active, closed, all

// =============================================
// INITIALISATION DU MODULE
// =============================================

export async function init() {
    electronAPI.log.info('Initialisation du module Conteneurs');
    
    try {
        // Charger les données initiales
        await loadConteneurs();
        
        // Initialiser l'interface
        initializeUI();
        
        // Initialiser les gestionnaires d'événements
        initializeEventHandlers();
        
        // Mettre à jour les statistiques
        updateStats();
        
    } catch (error) {
        electronAPI.log.error('Erreur initialisation module conteneurs:', error);
        Helpers.showError('Erreur', 'Impossible de charger le module conteneurs');
    }
}

// =============================================
// CHARGEMENT DES DONNÉES
// =============================================

async function loadConteneurs() {
    try {
        let response;
        if (currentView === 'active') {
            response = await API.conteneurs.getActive();
        } else if (currentView === 'closed') {
            response = await API.conteneurs.getAll({ statut: 'cloture' });
        } else {
            response = await API.conteneurs.getAll();
        }
        
        currentConteneurs = response.data || response;
        
        // Charger les détails supplémentaires
        await enrichConteneursData();
        
        renderConteneursTable();
        
    } catch (error) {
        electronAPI.log.error('Erreur chargement conteneurs:', error);
        throw error;
    }
}

async function enrichConteneursData() {
    // Pour chaque conteneur, calculer les statistiques
    for (const conteneur of currentConteneurs) {
        try {
            // Récupérer le manifeste
            const manifest = await API.conteneurs.getManifest(conteneur.id);
            conteneur.manifest = manifest;
            
            // Calculer le taux de remplissage
            conteneur.taux_remplissage = Helpers.calculateFillingRate(
                conteneur.volume_utilise, 
                conteneur.capacite_volume_total
            );
            
            // Calculer les montants
            conteneur.montant_total_du = manifest.reduce((sum, item) => 
                sum + (item.cout_total || 0), 0);
            conteneur.montant_total_paye = manifest.reduce((sum, item) => 
                sum + (item.montant_paye || 0), 0);
            conteneur.montant_restant = conteneur.montant_total_du - conteneur.montant_total_paye;
            
        } catch (error) {
            electronAPI.log.warn(`Erreur enrichissement conteneur ${conteneur.id}:`, error);
        }
    }
}

// =============================================
// INTERFACE UTILISATEUR
// =============================================

function initializeUI() {
    // Initialiser DataTable
    if ($.fn.DataTable.isDataTable('#conteneurs-table')) {
        $('#conteneurs-table').DataTable().destroy();
    }
    
    conteneursTable = Helpers.initDataTable('#conteneurs-table', {
        columns: [
            { 
                data: 'numero_conteneur', 
                title: 'N° Conteneur',
                render: (data, type, row) => {
                    return `<strong>${data}</strong>`;
                }
            },
            { 
                data: 'destination_ville', 
                title: 'Destination',
                render: (data, type, row) => {
                    return `${data}, ${row.destination_pays}`;
                }
            },
            { 
                data: 'type_envoi', 
                title: 'Type',
                render: renderTypeEnvoi
            },
            { 
                data: 'date_depart_prevue', 
                title: 'Départ prévu',
                render: (data) => data ? Helpers.formatDate(data) : 'Non défini'
            },
            { 
                data: 'taux_remplissage', 
                title: 'Remplissage',
                render: renderTauxRemplissage
            },
            { 
                data: 'nombre_marchandises', 
                title: 'Colis',
                className: 'text-center'
            },
            { 
                data: 'nombre_clients', 
                title: 'Clients',
                className: 'text-center'
            },
            { 
                data: 'montant_restant', 
                title: 'À payer',
                render: (data) => {
                    const color = data > 0 ? 'text-danger' : 'text-success';
                    return `<span class="${color} fw-bold">${Helpers.formatCurrency(data)}</span>`;
                }
            },
            { 
                data: 'statut', 
                title: 'Statut',
                render: renderStatut
            },
            {
                data: null,
                title: 'Actions',
                orderable: false,
                render: renderActions
            }
        ],
        order: [[3, 'asc']], // Trier par date de départ
        language: {
            url: '//cdn.datatables.net/plug-ins/1.13.7/i18n/fr-FR.json'
        }
    });
    
    // Initialiser les selects
    Helpers.initSelect2('#destination_pays', {
        placeholder: 'Sélectionnez un pays'
    });
    
    // Pré-remplir avec les destinations populaires
    const popularDestinations = CONSTANTS.POPULAR_DESTINATIONS;
    const optionsHtml = popularDestinations.map(dest => 
        `<option value="${dest.country}">${dest.country} - ${dest.port}</option>`
    ).join('');
    $('#popular-destinations').html(optionsHtml);
    
    // Initialiser les datepickers
    Helpers.initDatePicker('#date_depart_prevue', {
        minDate: 'today'
    });
    
    Helpers.initDatePicker('#date_arrivee_prevue', {
        minDate: 'today'
    });
}

function renderTypeEnvoi(type) {
    if (type === 'avec_dedouanement') {
        return '<span class="badge bg-primary"><i class="fas fa-passport me-1"></i>Avec dédouanement</span>';
    } else {
        return '<span class="badge bg-secondary"><i class="fas fa-box me-1"></i>Simple envoi</span>';
    }
}

function renderTauxRemplissage(taux) {
    const color = taux > 80 ? 'success' : taux > 50 ? 'warning' : 'info';
    return `
        <div class="progress" style="height: 20px; min-width: 100px;">
            <div class="progress-bar bg-${color}" role="progressbar" 
                 style="width: ${taux}%">${taux}%</div>
        </div>
    `;
}

function renderStatut(statut) {
    const config = {
        'ouvert': { color: 'primary', icon: 'fa-box-open', label: 'Ouvert' },
        'en_preparation': { color: 'warning', icon: 'fa-cog', label: 'En préparation' },
        'en_transit': { color: 'info', icon: 'fa-ship', label: 'En transit' },
        'arrive': { color: 'success', icon: 'fa-anchor', label: 'Arrivé' },
        'cloture': { color: 'secondary', icon: 'fa-lock', label: 'Clôturé' }
    };
    
    const stat = config[statut] || config.ouvert;
    return `<span class="badge bg-${stat.color}">
        <i class="fas ${stat.icon} me-1"></i>${stat.label}
    </span>`;
}

function renderActions(data, type, row) {
    const canEdit = ['ouvert', 'en_preparation'].includes(row.statut);
    const canClose = ['ouvert', 'en_preparation'].includes(row.statut) && row.nombre_marchandises > 0;
    const canReopen = row.statut === 'cloture';
    const canPrint = row.nombre_marchandises > 0;
    
    return `
        <div class="btn-group btn-group-sm" role="group">
            <button class="btn btn-info" onclick="conteneursModule.viewConteneur('${row.id}')" 
                title="Voir détails">
                <i class="fas fa-eye"></i>
            </button>
            ${canEdit ? `
            <button class="btn btn-primary" onclick="conteneursModule.editConteneur('${row.id}')" 
                title="Modifier">
                <i class="fas fa-edit"></i>
            </button>` : ''}
            ${canClose ? `
            <button class="btn btn-success" onclick="conteneursModule.closeConteneur('${row.id}')" 
                title="Clôturer">
                <i class="fas fa-lock"></i>
            </button>` : ''}
            ${canReopen ? `
            <button class="btn btn-warning" onclick="conteneursModule.reopenConteneur('${row.id}')" 
                title="Rouvrir">
                <i class="fas fa-unlock"></i>
            </button>` : ''}
            ${canPrint ? `
            <button class="btn btn-secondary" onclick="conteneursModule.printManifest('${row.id}')" 
                title="Imprimer manifeste">
                <i class="fas fa-print"></i>
            </button>` : ''}
            <button class="btn btn-danger" onclick="conteneursModule.deleteConteneur('${row.id}')" 
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
    // Bouton nouveau conteneur
    $('#btn-new-conteneur').on('click', () => {
        showConteneurModal();
    });
    
    // Bouton refresh
    $('#btn-refresh').on('click', async () => {
        await loadConteneurs();
        Helpers.showToast('Données actualisées', 'success');
    });
    
    // Changement de vue
    $('.view-btn').on('click', function() {
        $('.view-btn').removeClass('active');
        $(this).addClass('active');
        currentView = $(this).data('view');
        loadConteneurs();
    });
    
    // Filtres
    $('#search-conteneur').on('input', Helpers.debounce(applyFilters, 300));
    
    // Formulaire conteneur
    $('#conteneur-form').on('submit', async (e) => {
        e.preventDefault();
        await saveConteneur();
    });
    
    // Type d'envoi change
    $('#type_envoi').on('change', function() {
        const withCustoms = $(this).val() === 'avec_dedouanement';
        $('#customs-section').toggle(withCustoms);
        calculateTotalCost();
    });
    
    // Calcul automatique des coûts
    $('#cout_transport, #cout_dedouanement').on('input', calculateTotalCost);
    
    // Sélection destination populaire
    $('#popular-destinations').on('change', function() {
        const selected = $(this).find('option:selected');
        if (selected.val()) {
            const [pays, port] = selected.text().split(' - ');
            $('#destination_pays').val(pays).trigger('change');
            $('#destination_port').val(port);
        }
    });
    
    // Capacités
    $('#capacite_volume_total, #capacite_poids_total').on('input', function() {
        updateCapacityDisplay();
    });
}

// =============================================
// FONCTIONS CRUD
// =============================================

function showConteneurModal(conteneurId = null) {
    selectedConteneur = conteneurId ? 
        currentConteneurs.find(c => c.id == conteneurId) : null;
    
    // Réinitialiser le formulaire
    $('#conteneur-form')[0].reset();
    $('#conteneur-id').val('');
    $('#customs-section').hide();
    
    if (selectedConteneur) {
        // Mode édition
        $('#conteneur-modal-title').text('Modifier le conteneur');
        fillConteneurForm(selectedConteneur);
    } else {
        // Mode création
        $('#conteneur-modal-title').text('Nouveau conteneur');
        generateNumeroConteneur();
        $('#date_ouverture').val(new Date().toISOString().split('T')[0]);
    }
    
    updateCapacityDisplay();
    $('#conteneur-modal').modal('show');
}

function fillConteneurForm(conteneur) {
    $('#conteneur-id').val(conteneur.id);
    $('#numero_conteneur').val(conteneur.numero_conteneur);
    $('#destination_port').val(conteneur.destination_port);
    $('#destination_ville').val(conteneur.destination_ville);
    $('#destination_pays').val(conteneur.destination_pays).trigger('change');
    $('#type_envoi').val(conteneur.type_envoi).trigger('change');
    $('#date_ouverture').val(conteneur.date_ouverture);
    $('#date_depart_prevue').val(conteneur.date_depart_prevue);
    $('#date_arrivee_prevue').val(conteneur.date_arrivee_prevue);
    $('#capacite_volume_total').val(conteneur.capacite_volume_total);
    $('#capacite_poids_total').val(conteneur.capacite_poids_total);
    $('#cout_transport').val(conteneur.cout_transport);
    $('#cout_dedouanement').val(conteneur.cout_dedouanement);
}

async function saveConteneur() {
    try {
        // Validation
        if (!validateConteneurForm()) {
            return;
        }
        
        // Récupérer les données du formulaire
        const formData = getConteneurFormData();
        
        Helpers.showLoader('Enregistrement en cours...');
        
        let response;
        if (formData.id) {
            // Mise à jour
            response = await API.conteneurs.update(formData.id, formData);
        } else {
            // Création
            response = await API.conteneurs.create(formData);
        }
        
        // Fermer le modal
        $('#conteneur-modal').modal('hide');
        
        // Rafraîchir les données
        await loadConteneurs();
        
        // Notification temps réel
        WebSocketManager.sendUpdate('conteneur', {
            action: formData.id ? 'update' : 'create',
            data: response
        });
        
        Helpers.hideLoader();
        Helpers.showSuccess('Succès', formData.id ? 
            'Conteneur mis à jour avec succès' : 
            'Conteneur créé avec succès'
        );
        
    } catch (error) {
        Helpers.hideLoader();
        electronAPI.log.error('Erreur sauvegarde conteneur:', error);
        Helpers.showError('Erreur', 'Impossible d\'enregistrer le conteneur');
    }
}

function validateConteneurForm() {
    const required = ['numero_conteneur', 'destination_port', 'destination_ville', 'destination_pays'];
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
    
    // Validation des dates
    const dateDepart = $('#date_depart_prevue').val();
    const dateArrivee = $('#date_arrivee_prevue').val();
    
    if (dateDepart && dateArrivee && dateDepart > dateArrivee) {
        $('#date_arrivee_prevue').addClass('is-invalid');
        Helpers.showToast('La date d\'arrivée doit être après la date de départ', 'error');
        isValid = false;
    }
    
    if (!isValid) {
        Helpers.showToast('Veuillez corriger les erreurs', 'error');
    }
    
    return isValid;
}

function getConteneurFormData() {
    const formData = {
        id: $('#conteneur-id').val() || null,
        numero_conteneur: $('#numero_conteneur').val(),
        destination_port: $('#destination_port').val().trim(),
        destination_ville: $('#destination_ville').val().trim(),
        destination_pays: $('#destination_pays').val(),
        type_envoi: $('#type_envoi').val(),
        date_ouverture: $('#date_ouverture').val(),
        date_depart_prevue: $('#date_depart_prevue').val() || null,
        date_arrivee_prevue: $('#date_arrivee_prevue').val() || null,
        capacite_volume_total: parseFloat($('#capacite_volume_total').val()) || 0,
        capacite_poids_total: parseFloat($('#capacite_poids_total').val()) || 0,
        cout_transport: parseFloat($('#cout_transport').val()) || 0,
        cout_dedouanement: parseFloat($('#cout_dedouanement').val()) || 0,
        cout_total: parseFloat($('#cout_total').val()) || 0
    };
    
    return formData;
}

// =============================================
// FONCTIONS DE GESTION
// =============================================

async function viewConteneur(conteneurId) {
    try {
        Helpers.showLoader('Chargement des détails...');
        
        const conteneur = await API.conteneurs.getById(conteneurId);
        const manifest = await API.conteneurs.getManifest(conteneurId);
        
        showConteneurDetails(conteneur, manifest);
        
        Helpers.hideLoader();
        
    } catch (error) {
        Helpers.hideLoader();
        electronAPI.log.error('Erreur chargement détails conteneur:', error);
        Helpers.showError('Erreur', 'Impossible de charger les détails du conteneur');
    }
}

function showConteneurDetails(conteneur, manifest) {
    const modal = $('#conteneur-details-modal');
    
    // Informations générales
    modal.find('.conteneur-number').text(conteneur.numero_conteneur);
    modal.find('.conteneur-destination').text(`${conteneur.destination_ville}, ${conteneur.destination_pays}`);
    modal.find('.conteneur-type').html(renderTypeEnvoi(conteneur.type_envoi));
    modal.find('.conteneur-status').html(renderStatut(conteneur.statut));
    modal.find('.conteneur-depart').text(conteneur.date_depart_prevue ? 
        Helpers.formatDate(conteneur.date_depart_prevue) : 'Non défini');
    modal.find('.conteneur-arrivee').text(conteneur.date_arrivee_prevue ? 
        Helpers.formatDate(conteneur.date_arrivee_prevue) : 'Non défini');
    
    // Capacités
    const tauxVolume = Helpers.calculateFillingRate(conteneur.volume_utilise, conteneur.capacite_volume_total);
    const tauxPoids = Helpers.calculateFillingRate(conteneur.poids_utilise, conteneur.capacite_poids_total);
    
    modal.find('.capacity-volume').html(`
        <div class="d-flex justify-content-between mb-1">
            <span>Volume</span>
            <span>${conteneur.volume_utilise} / ${conteneur.capacite_volume_total} m³</span>
        </div>
        <div class="progress">
            <div class="progress-bar bg-${tauxVolume > 80 ? 'success' : 'warning'}" 
                 style="width: ${tauxVolume}%">${tauxVolume}%</div>
        </div>
    `);
    
    modal.find('.capacity-weight').html(`
        <div class="d-flex justify-content-between mb-1">
            <span>Poids</span>
            <span>${conteneur.poids_utilise} / ${conteneur.capacite_poids_total} kg</span>
        </div>
        <div class="progress">
            <div class="progress-bar bg-${tauxPoids > 80 ? 'success' : 'warning'}" 
                 style="width: ${tauxPoids}%">${tauxPoids}%</div>
        </div>
    `);
    
    // Finances
    const totalDu = manifest.reduce((sum, item) => sum + (item.cout_total || 0), 0);
    const totalPaye = manifest.reduce((sum, item) => sum + (item.montant_paye || 0), 0);
    const restant = totalDu - totalPaye;
    
    modal.find('.finance-total').text(Helpers.formatCurrency(totalDu));
    modal.find('.finance-paid').text(Helpers.formatCurrency(totalPaye));
    modal.find('.finance-remaining').html(
        `<span class="${restant > 0 ? 'text-danger' : 'text-success'} fw-bold">
            ${Helpers.formatCurrency(restant)}
        </span>`
    );
    
    // Manifeste
    const manifestHtml = manifest.map(item => `
        <tr>
            <td>${item.code_barre}</td>
            <td>${item.client_nom}</td>
            <td>${item.designation}</td>
            <td class="text-center">${item.nombre_colis}</td>
            <td>${Helpers.formatWeight(item.poids)}</td>
            <td>${Helpers.formatVolume(item.volume)}</td>
            <td>${Helpers.formatCurrency(item.cout_total)}</td>
            <td>
                <span class="${item.montant_paye >= item.cout_total ? 'text-success' : 'text-danger'}">
                    ${Helpers.formatCurrency(item.montant_paye)}
                </span>
            </td>
        </tr>
    `).join('') || '<tr><td colspan="8" class="text-center">Aucune marchandise</td></tr>';
    
    modal.find('#manifest-table tbody').html(manifestHtml);
    
    // Actions
    modal.find('.btn-edit').off('click').on('click', () => {
        modal.modal('hide');
        showConteneurModal(conteneur.id);
    });
    
    modal.find('.btn-print').off('click').on('click', () => {
        printManifest(conteneur.id);
    });
    
    modal.modal('show');
}

async function closeConteneur(conteneurId) {
    const confirmed = await Helpers.confirm(
        'Clôturer le conteneur',
        'Êtes-vous sûr de vouloir clôturer ce conteneur ? Cette action est irréversible.'
    );
    
    if (!confirmed) return;
    
    try {
        Helpers.showLoader('Clôture en cours...');
        
        await API.conteneurs.close(conteneurId);
        
        await loadConteneurs();
        
        Helpers.hideLoader();
        Helpers.showSuccess('Succès', 'Conteneur clôturé avec succès');
        
        // Génération automatique des documents
        const generateDocs = await Helpers.confirm(
            'Générer les documents',
            'Voulez-vous générer les documents d\'expédition ?'
        );
        
        if (generateDocs) {
            await generateDocuments(conteneurId);
        }
        
    } catch (error) {
        Helpers.hideLoader();
        electronAPI.log.error('Erreur clôture conteneur:', error);
        Helpers.showError('Erreur', 'Impossible de clôturer le conteneur');
    }
}

async function reopenConteneur(conteneurId) {
    const confirmed = await Helpers.confirm(
        'Rouvrir le conteneur',
        'Êtes-vous sûr de vouloir rouvrir ce conteneur ?'
    );
    
    if (!confirmed) return;
    
    try {
        await API.conteneurs.reopen(conteneurId);
        await loadConteneurs();
        Helpers.showSuccess('Succès', 'Conteneur rouvert avec succès');
    } catch (error) {
        Helpers.showError('Erreur', 'Impossible de rouvrir le conteneur');
    }
}

// =============================================
// FONCTIONS D'IMPRESSION ET EXPORT
// =============================================

async function printManifest(conteneurId) {
    try {
        const conteneur = currentConteneurs.find(c => c.id == conteneurId);
        const manifest = await API.conteneurs.getManifest(conteneurId);
        
        const printWindow = window.open('', '_blank');
        printWindow.document.write(generateManifestHtml(conteneur, manifest));
        printWindow.document.close();
        
        setTimeout(() => {
            printWindow.print();
            printWindow.close();
        }, 500);
        
    } catch (error) {
        electronAPI.log.error('Erreur impression manifeste:', error);
        Helpers.showError('Erreur', 'Impossible d\'imprimer le manifeste');
    }
}

function generateManifestHtml(conteneur, manifest) {
    const totalDu = manifest.reduce((sum, item) => sum + (item.cout_total || 0), 0);
    const totalPoids = manifest.reduce((sum, item) => sum + (item.poids || 0), 0);
    const totalVolume = manifest.reduce((sum, item) => sum + (item.volume || 0), 0);
    
    const itemsHtml = manifest.map((item, index) => `
        <tr>
            <td>${index + 1}</td>
            <td>${item.code_barre}</td>
            <td>${item.client_nom}</td>
            <td>${item.designation}</td>
            <td>${item.nombre_colis}</td>
            <td>${item.poids || '-'} kg</td>
            <td>${item.volume || '-'} m³</td>
            <td>${Helpers.formatCurrency(item.cout_total)}</td>
        </tr>
    `).join('');
    
    return `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Manifeste - ${conteneur.numero_conteneur}</title>
            <style>
                body { font-family: Arial, sans-serif; margin: 20px; }
                h1, h2 { text-align: center; }
                .header { margin-bottom: 30px; }
                .info { margin-bottom: 20px; }
                .info-row { display: flex; justify-content: space-between; margin-bottom: 10px; }
                table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                th { background-color: #f2f2f2; font-weight: bold; }
                .totals { margin-top: 20px; text-align: right; }
                .signature { margin-top: 50px; display: flex; justify-content: space-between; }
                .signature-box { width: 200px; text-align: center; }
                .signature-line { border-bottom: 1px solid #000; margin-bottom: 5px; height: 40px; }
                @media print {
                    body { margin: 10px; }
                }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>IMPORT EXPORT MARITIME</h1>
                <h2>Manifeste d'expédition</h2>
            </div>
            
            <div class="info">
                <div class="info-row">
                    <strong>N° Conteneur:</strong> ${conteneur.numero_conteneur}
                </div>
                <div class="info-row">
                    <strong>Destination:</strong> ${conteneur.destination_ville}, ${conteneur.destination_pays}
                </div>
                <div class="info-row">
                    <strong>Type d'envoi:</strong> ${conteneur.type_envoi === 'avec_dedouanement' ? 'Avec dédouanement' : 'Simple envoi'}
                </div>
                <div class="info-row">
                    <strong>Date de départ:</strong> ${Helpers.formatDate(conteneur.date_depart_prevue)}
                </div>
                <div class="info-row">
                    <strong>Date d'édition:</strong> ${Helpers.formatDate(new Date())}
                </div>
            </div>
            
            <table>
                <thead>
                    <tr>
                        <th>N°</th>
                        <th>Code-barres</th>
                        <th>Client</th>
                        <th>Désignation</th>
                        <th>Nb Colis</th>
                        <th>Poids</th>
                        <th>Volume</th>
                        <th>Montant</th>
                    </tr>
                </thead>
                <tbody>
                    ${itemsHtml}
                </tbody>
            </table>
            
            <div class="totals">
                <p><strong>Nombre total de lignes:</strong> ${manifest.length}</p>
                <p><strong>Poids total:</strong> ${totalPoids} kg</p>
                <p><strong>Volume total:</strong> ${totalVolume} m³</p>
                <p><strong>Montant total:</strong> ${Helpers.formatCurrency(totalDu)}</p>
            </div>
            
            <div class="signature">
                <div class="signature-box">
                    <div class="signature-line"></div>
                    <p>Responsable expédition</p>
                </div>
                <div class="signature-box">
                    <div class="signature-line"></div>
                    <p>Transporteur</p>
                </div>
            </div>
        </body>
        </html>
    `;
}

async function generateDocuments(conteneurId) {
    try {
        Helpers.showLoader('Génération des documents...');
        
        await API.conteneurs.generateDocuments(conteneurId);
        
        Helpers.hideLoader();
        Helpers.showSuccess('Succès', 'Documents générés avec succès');
        
    } catch (error) {
        Helpers.hideLoader();
        electronAPI.log.error('Erreur génération documents:', error);
        Helpers.showError('Erreur', 'Impossible de générer les documents');
    }
}

// =============================================
// FONCTIONS UTILITAIRES
// =============================================

function generateNumeroConteneur() {
    // Format: XXXX1234567 (4 lettres + 7 chiffres)
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let code = '';
    
    // 4 lettres aléatoires
    for (let i = 0; i < 4; i++) {
        code += letters.charAt(Math.floor(Math.random() * letters.length));
    }
    
    // 7 chiffres aléatoires
    code += Math.floor(Math.random() * 10000000).toString().padStart(7, '0');
    
    $('#numero_conteneur').val(code);
}

function calculateTotalCost() {
    const transport = parseFloat($('#cout_transport').val()) || 0;
    const dedouanement = parseFloat($('#cout_dedouanement').val()) || 0;
    const total = transport + dedouanement;
    
    $('#cout_total').val(total.toFixed(2));
}

function updateCapacityDisplay() {
    const volume = parseFloat($('#capacite_volume_total').val()) || 0;
    const poids = parseFloat($('#capacite_poids_total').val()) || 0;
    
    $('#capacity-display').html(`
        <small class="text-muted">
            Capacité: ${volume} m³ / ${poids} kg
        </small>
    `);
}

function applyFilters() {
    const search = $('#search-conteneur').val().toLowerCase();
    
    if (!search) {
        conteneursTable.search('').draw();
        return;
    }
    
    conteneursTable.search(search).draw();
}

function updateStats() {
    const stats = {
        total: currentConteneurs.length,
        open: currentConteneurs.filter(c => c.statut === 'ouvert').length,
        preparing: currentConteneurs.filter(c => c.statut === 'en_preparation').length,
        transit: currentConteneurs.filter(c => c.statut === 'en_transit').length,
        closed: currentConteneurs.filter(c => c.statut === 'cloture').length
    };
    
    $('#stat-total').text(stats.total);
    $('#stat-open').text(stats.open);
    $('#stat-preparing').text(stats.preparing);
    $('#stat-transit').text(stats.transit);
    $('#stat-closed').text(stats.closed);
}

// =============================================
// GESTION TEMPS RÉEL
// =============================================

export function handleRealtimeUpdate(type, data) {
    if (type !== 'conteneur') return;
    
    electronAPI.log.info('Mise à jour temps réel conteneur:', data);
    
    // Rafraîchir les données
    loadConteneurs();
}

// =============================================
// API PUBLIQUE DU MODULE
// =============================================

window.conteneursModule = {
    viewConteneur,
    editConteneur: showConteneurModal,
    deleteConteneur: async (id) => {
        const confirmed = await Helpers.confirm(
            'Supprimer le conteneur',
            'Êtes-vous sûr de vouloir supprimer ce conteneur ?'
        );
        
        if (!confirmed) return;
        
        try {
            await API.conteneurs.delete(id);
            await loadConteneurs();
            Helpers.showSuccess('Succès', 'Conteneur supprimé');
        } catch (error) {
            Helpers.showError('Erreur', 'Impossible de supprimer le conteneur');
        }
    },
    closeConteneur,
    reopenConteneur,
    printManifest
};