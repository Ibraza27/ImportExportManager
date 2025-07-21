/**
 * Module de gestion financière
 * Gère les paiements, factures et suivi financier
 */

// Variables du module
let paiementsTable = null;
let currentPaiements = [];
let selectedPaiement = null;
let currentFilter = 'all';
let chartRevenue = null;
let chartPaymentModes = null;

// =============================================
// INITIALISATION DU MODULE
// =============================================

export async function init() {
    electronAPI.log.info('Initialisation du module Finances');
    
    try {
        // Charger les données initiales
        await loadPaiements();
        
        // Initialiser l'interface
        initializeUI();
        
        // Initialiser les graphiques
        initializeCharts();
        
        // Initialiser les gestionnaires d'événements
        initializeEventHandlers();
        
        // Mettre à jour les statistiques
        await updateStats();
        
    } catch (error) {
        electronAPI.log.error('Erreur initialisation module finances:', error);
        Helpers.showError('Erreur', 'Impossible de charger le module finances');
    }
}

// =============================================
// CHARGEMENT DES DONNÉES
// =============================================

async function loadPaiements() {
    try {
        let response;
        switch (currentFilter) {
            case 'pending':
                response = await API.paiements.getPending();
                break;
            case 'overdue':
                response = await API.paiements.getOverdue();
                break;
            default:
                response = await API.paiements.getAll();
        }
        
        currentPaiements = response.data || response;
        
        // Enrichir avec les données clients et conteneurs
        await enrichPaiementsData();
        
        renderPaiementsTable();
        
    } catch (error) {
        electronAPI.log.error('Erreur chargement paiements:', error);
        throw error;
    }
}

async function enrichPaiementsData() {
    // Récupérer les infos clients et conteneurs
    const clientIds = [...new Set(currentPaiements.map(p => p.client_id))];
    const conteneurIds = [...new Set(currentPaiements.map(p => p.conteneur_id).filter(Boolean))];
    
    const clientsMap = new Map();
    const conteneursMap = new Map();
    
    // Charger les clients
    for (const clientId of clientIds) {
        try {
            const client = await API.clients.getById(clientId);
            clientsMap.set(clientId, client);
        } catch (error) {
            electronAPI.log.warn(`Client ${clientId} introuvable`);
        }
    }
    
    // Charger les conteneurs
    for (const conteneurId of conteneurIds) {
        try {
            const conteneur = await API.conteneurs.getById(conteneurId);
            conteneursMap.set(conteneurId, conteneur);
        } catch (error) {
            electronAPI.log.warn(`Conteneur ${conteneurId} introuvable`);
        }
    }
    
    // Enrichir les paiements
    currentPaiements.forEach(paiement => {
        const client = clientsMap.get(paiement.client_id);
        if (client) {
            paiement.client_nom = `${client.nom} ${client.prenom}`;
            paiement.client_telephone = client.telephone_principal;
        }
        
        const conteneur = conteneursMap.get(paiement.conteneur_id);
        if (conteneur) {
            paiement.conteneur_numero = conteneur.numero_conteneur;
        }
    });
}

// =============================================
// INTERFACE UTILISATEUR
// =============================================

function initializeUI() {
    // Initialiser DataTable
    if ($.fn.DataTable.isDataTable('#paiements-table')) {
        $('#paiements-table').DataTable().destroy();
    }
    
    paiementsTable = Helpers.initDataTable('#paiements-table', {
        columns: [
            { 
                data: 'numero_recu', 
                title: 'N° Reçu',
                render: (data) => `<code>${data}</code>`
            },
            { 
                data: 'date_paiement', 
                title: 'Date',
                render: (data) => Helpers.formatDate(data)
            },
            { 
                data: 'client_nom', 
                title: 'Client'
            },
            { 
                data: 'conteneur_numero', 
                title: 'Conteneur',
                render: (data) => data || '<span class="text-muted">-</span>'
            },
            { 
                data: 'type_paiement', 
                title: 'Type',
                render: renderTypePaiement
            },
            { 
                data: 'mode_paiement', 
                title: 'Mode',
                render: renderModePaiement
            },
            { 
                data: 'montant_paye', 
                title: 'Montant payé',
                render: (data) => Helpers.formatCurrency(data),
                className: 'text-end fw-bold'
            },
            { 
                data: 'montant_restant', 
                title: 'Restant',
                render: renderMontantRestant,
                className: 'text-end'
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
        order: [[1, 'desc']],
        language: {
            url: '//cdn.datatables.net/plug-ins/1.13.7/i18n/fr-FR.json'
        }
    });
    
    // Initialiser les selects
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
                        text: `${client.nom} ${client.prenom} - ${client.telephone_principal}`,
                        client: client
                    }))
                };
            }
        }
    });
    
    Helpers.initSelect2('#select-conteneur', {
        placeholder: 'Sélectionner un conteneur (optionnel)'
    });
    
    // Initialiser le datepicker
    Helpers.initDatePicker('#date_paiement', {
        defaultDate: 'today',
        maxDate: 'today'
    });
    
    Helpers.initDatePicker('#date_echeance');
}

function renderTypePaiement(type) {
    const types = {
        'acompte': { label: 'Acompte', color: 'info' },
        'solde': { label: 'Solde', color: 'success' },
        'total': { label: 'Total', color: 'primary' },
        'remboursement': { label: 'Remboursement', color: 'warning' }
    };
    
    const config = types[type] || { label: type, color: 'secondary' };
    return `<span class="badge bg-${config.color}">${config.label}</span>`;
}

function renderModePaiement(mode) {
    const modes = {
        'especes': { icon: 'fa-money-bill', label: 'Espèces' },
        'virement': { icon: 'fa-exchange-alt', label: 'Virement' },
        'cheque': { icon: 'fa-file-invoice', label: 'Chèque' },
        'carte': { icon: 'fa-credit-card', label: 'Carte' },
        'mobile_money': { icon: 'fa-mobile-alt', label: 'Mobile Money' }
    };
    
    const config = modes[mode] || { icon: 'fa-question', label: mode };
    return `<i class="fas ${config.icon} me-1"></i>${config.label}`;
}

function renderMontantRestant(montant) {
    if (montant <= 0) {
        return '<span class="text-success">Payé</span>';
    }
    return `<span class="text-danger">${Helpers.formatCurrency(montant)}</span>`;
}

function renderStatut(statut) {
    const statuts = {
        'en_attente': { color: 'warning', icon: 'fa-clock', label: 'En attente' },
        'valide': { color: 'success', icon: 'fa-check', label: 'Validé' },
        'annule': { color: 'danger', icon: 'fa-times', label: 'Annulé' },
        'rembourse': { color: 'info', icon: 'fa-undo', label: 'Remboursé' }
    };
    
    const config = statuts[statut] || statuts.valide;
    return `<span class="badge bg-${config.color}">
        <i class="fas ${config.icon} me-1"></i>${config.label}
    </span>`;
}

function renderActions(data, type, row) {
    const canEdit = row.statut === 'en_attente';
    const canCancel = ['en_attente', 'valide'].includes(row.statut);
    const canPrint = row.statut === 'valide';
    
    return `
        <div class="btn-group btn-group-sm" role="group">
            <button class="btn btn-info" onclick="financesModule.viewPaiement('${row.id}')" 
                title="Voir détails">
                <i class="fas fa-eye"></i>
            </button>
            ${canEdit ? `
            <button class="btn btn-primary" onclick="financesModule.editPaiement('${row.id}')" 
                title="Modifier">
                <i class="fas fa-edit"></i>
            </button>` : ''}
            ${canPrint ? `
            <button class="btn btn-success" onclick="financesModule.printReceipt('${row.id}')" 
                title="Imprimer reçu">
                <i class="fas fa-print"></i>
            </button>` : ''}
            ${canCancel ? `
            <button class="btn btn-warning" onclick="financesModule.cancelPaiement('${row.id}')" 
                title="Annuler">
                <i class="fas fa-times"></i>
            </button>` : ''}
        </div>
    `;
}

// =============================================
// GESTIONNAIRES D'ÉVÉNEMENTS
// =============================================

function initializeEventHandlers() {
    // Bouton nouveau paiement
    $('#btn-new-paiement').on('click', () => {
        showPaiementModal();
    });
    
    // Bouton refresh
    $('#btn-refresh').on('click', async () => {
        await loadPaiements();
        await updateStats();
        Helpers.showToast('Données actualisées', 'success');
    });
    
    // Filtres rapides
    $('.filter-btn').on('click', function() {
        $('.filter-btn').removeClass('active');
        $(this).addClass('active');
        currentFilter = $(this).data('filter');
        loadPaiements();
    });
    
    // Période pour les graphiques
    $('#period-select').on('change', function() {
        updateCharts($(this).val());
    });
    
    // Recherche
    $('#search-paiement').on('input', Helpers.debounce(applyFilters, 300));
    
    // Formulaire paiement
    $('#paiement-form').on('submit', async (e) => {
        e.preventDefault();
        await savePaiement();
    });
    
    // Changement de client
    $('#select-client').on('select2:select', async function(e) {
        const client = e.params.data.client;
        if (client) {
            await loadClientBalance(client.id);
            await loadClientContainers(client.id);
        }
    });
    
    // Mode de paiement
    $('#mode_paiement').on('change', function() {
        const mode = $(this).val();
        $('#cheque-details').toggle(mode === 'cheque');
        $('#virement-details').toggle(mode === 'virement');
    });
    
    // Calcul automatique
    $('#montant_total_du, #montant_paye').on('input', calculateRemaining);
    
    // Génération numéro reçu
    $('#btn-generate-receipt').on('click', generateReceiptNumber);
    
    // Export
    $('#btn-export').on('click', exportFinancialReport);
}

// =============================================
// GRAPHIQUES
// =============================================

function initializeCharts() {
    // Graphique des revenus
    const ctxRevenue = document.getElementById('revenue-chart').getContext('2d');
    chartRevenue = new Chart(ctxRevenue, {
        type: 'line',
        data: {
            labels: [],
            datasets: [{
                label: 'Revenus',
                data: [],
                borderColor: '#2563eb',
                backgroundColor: 'rgba(37, 99, 235, 0.1)',
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: (context) => Helpers.formatCurrency(context.parsed.y)
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: (value) => Helpers.formatCurrency(value)
                    }
                }
            }
        }
    });
    
    // Graphique des modes de paiement
    const ctxModes = document.getElementById('payment-modes-chart').getContext('2d');
    chartPaymentModes = new Chart(ctxModes, {
        type: 'doughnut',
        data: {
            labels: [],
            datasets: [{
                data: [],
                backgroundColor: [
                    '#2563eb', '#10b981', '#f59e0b', 
                    '#ef4444', '#8b5cf6'
                ]
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom'
                }
            }
        }
    });
    
    // Charger les données initiales
    updateCharts('month');
}

async function updateCharts(period) {
    try {
        const data = await API.rapports.getRevenue({ period });
        
        // Mettre à jour le graphique des revenus
        if (chartRevenue && data.revenue) {
            chartRevenue.data.labels = data.revenue.labels;
            chartRevenue.data.datasets[0].data = data.revenue.values;
            chartRevenue.update();
        }
        
        // Mettre à jour le graphique des modes de paiement
        if (chartPaymentModes && data.paymentModes) {
            chartPaymentModes.data.labels = data.paymentModes.labels;
            chartPaymentModes.data.datasets[0].data = data.paymentModes.values;
            chartPaymentModes.update();
        }
        
    } catch (error) {
        electronAPI.log.error('Erreur mise à jour graphiques:', error);
    }
}

// =============================================
// FONCTIONS CRUD
// =============================================

function showPaiementModal(paiementId = null) {
    selectedPaiement = paiementId ? 
        currentPaiements.find(p => p.id == paiementId) : null;
    
    // Réinitialiser le formulaire
    $('#paiement-form')[0].reset();
    $('#paiement-id').val('');
    $('#client-balance-info').hide();
    $('#cheque-details').hide();
    $('#virement-details').hide();
    
    if (selectedPaiement) {
        // Mode édition
        $('#paiement-modal-title').text('Modifier le paiement');
        fillPaiementForm(selectedPaiement);
    } else {
        // Mode création
        $('#paiement-modal-title').text('Nouveau paiement');
        generateReceiptNumber();
        $('#date_paiement').val(new Date().toISOString().split('T')[0]);
    }
    
    $('#paiement-modal').modal('show');
}

function fillPaiementForm(paiement) {
    $('#paiement-id').val(paiement.id);
    $('#numero_recu').val(paiement.numero_recu);
    
    // Client
    const option = new Option(paiement.client_nom, paiement.client_id, true, true);
    $('#select-client').append(option).trigger('change');
    
    // Conteneur
    if (paiement.conteneur_id) {
        $('#select-conteneur').val(paiement.conteneur_id).trigger('change');
    }
    
    $('#date_paiement').val(paiement.date_paiement.split('T')[0]);
    $('#type_paiement').val(paiement.type_paiement);
    $('#mode_paiement').val(paiement.mode_paiement).trigger('change');
    $('#montant_total_du').val(paiement.montant_total_du);
    $('#montant_paye').val(paiement.montant_paye);
    
    if (paiement.mode_paiement === 'cheque') {
        $('#numero_cheque').val(paiement.numero_cheque);
        $('#banque').val(paiement.banque);
    }
    
    if (paiement.mode_paiement === 'virement') {
        $('#reference_virement').val(paiement.reference_paiement);
    }
    
    $('#date_echeance').val(paiement.date_echeance);
    $('#commentaires').val(paiement.commentaires);
}

async function savePaiement() {
    try {
        // Validation
        if (!validatePaiementForm()) {
            return;
        }
        
        // Récupérer les données du formulaire
        const formData = getPaiementFormData();
        
        Helpers.showLoader('Enregistrement en cours...');
        
        let response;
        if (formData.id) {
            // Mise à jour
            response = await API.paiements.update(formData.id, formData);
        } else {
            // Création
            response = await API.paiements.create(formData);
        }
        
        // Fermer le modal
        $('#paiement-modal').modal('hide');
        
        // Rafraîchir les données
        await loadPaiements();
        await updateStats();
        
        // Notification temps réel
        WebSocketManager.sendUpdate('paiement', {
            action: formData.id ? 'update' : 'create',
            data: response
        });
        
        Helpers.hideLoader();
        Helpers.showSuccess('Succès', formData.id ? 
            'Paiement mis à jour avec succès' : 
            'Paiement enregistré avec succès'
        );
        
        // Imprimer le reçu si nouveau paiement
        if (!formData.id && response.statut === 'valide') {
            const print = await Helpers.confirm(
                'Imprimer le reçu',
                'Voulez-vous imprimer le reçu de paiement ?'
            );
            if (print) {
                printReceipt(response.id);
            }
        }
        
    } catch (error) {
        Helpers.hideLoader();
        electronAPI.log.error('Erreur sauvegarde paiement:', error);
        Helpers.showError('Erreur', 'Impossible d\'enregistrer le paiement');
    }
}

function validatePaiementForm() {
    const required = ['select-client', 'montant_total_du', 'montant_paye'];
    let isValid = true;
    
    required.forEach(field => {
        const input = $(`#${field}`);
        const value = input.val();
        
        if (!value || (typeof value === 'string' && value.trim() === '')) {
            input.addClass('is-invalid');
            isValid = false;
        } else {
            input.removeClass('is-invalid');
        }
    });
    
    // Validation des montants
    const montantDu = parseFloat($('#montant_total_du').val());
    const montantPaye = parseFloat($('#montant_paye').val());
    
    if (montantPaye <= 0) {
        $('#montant_paye').addClass('is-invalid');
        Helpers.showToast('Le montant payé doit être supérieur à 0', 'error');
        isValid = false;
    }
    
    if (montantPaye > montantDu) {
        $('#montant_paye').addClass('is-invalid');
        Helpers.showToast('Le montant payé ne peut pas dépasser le montant dû', 'error');
        isValid = false;
    }
    
    // Validation spécifique au mode de paiement
    const mode = $('#mode_paiement').val();
    if (mode === 'cheque' && !$('#numero_cheque').val()) {
        $('#numero_cheque').addClass('is-invalid');
        isValid = false;
    }
    
    if (!isValid) {
        Helpers.showToast('Veuillez corriger les erreurs', 'error');
    }
    
    return isValid;
}

function getPaiementFormData() {
    const formData = {
        id: $('#paiement-id').val() || null,
        numero_recu: $('#numero_recu').val(),
        client_id: $('#select-client').val(),
        conteneur_id: $('#select-conteneur').val() || null,
        marchandise_id: null, // À implémenter si nécessaire
        date_paiement: $('#date_paiement').val(),
        type_paiement: $('#type_paiement').val(),
        mode_paiement: $('#mode_paiement').val(),
        montant_total_du: parseFloat($('#montant_total_du').val()),
        montant_paye: parseFloat($('#montant_paye').val()),
        devise: 'EUR',
        date_echeance: $('#date_echeance').val() || null,
        commentaires: $('#commentaires').val().trim()
    };
    
    // Informations spécifiques au mode de paiement
    if (formData.mode_paiement === 'cheque') {
        formData.numero_cheque = $('#numero_cheque').val();
        formData.banque = $('#banque').val();
    } else if (formData.mode_paiement === 'virement') {
        formData.reference_paiement = $('#reference_virement').val();
    }
    
    return formData;
}

// =============================================
// FONCTIONS DE VISUALISATION
// =============================================

async function viewPaiement(paiementId) {
    try {
        const paiement = await API.paiements.getById(paiementId);
        showPaiementDetails(paiement);
    } catch (error) {
        electronAPI.log.error('Erreur chargement détails paiement:', error);
        Helpers.showError('Erreur', 'Impossible de charger les détails du paiement');
    }
}

function showPaiementDetails(paiement) {
    const modal = $('#paiement-details-modal');
    
    // Remplir les détails
    modal.find('.receipt-number').text(paiement.numero_recu);
    modal.find('.payment-date').text(Helpers.formatDate(paiement.date_paiement));
    modal.find('.client-name').text(paiement.client_nom);
    modal.find('.payment-type').html(renderTypePaiement(paiement.type_paiement));
    modal.find('.payment-mode').html(renderModePaiement(paiement.mode_paiement));
    modal.find('.amount-paid').text(Helpers.formatCurrency(paiement.montant_paye));
    modal.find('.payment-status').html(renderStatut(paiement.statut));
    
    if (paiement.conteneur_numero) {
        modal.find('.container-info').show();
        modal.find('.container-number').text(paiement.conteneur_numero);
    } else {
        modal.find('.container-info').hide();
    }
    
    modal.modal('show');
}

// =============================================
// FONCTIONS D'IMPRESSION
// =============================================

async function printReceipt(paiementId) {
    try {
        const paiement = currentPaiements.find(p => p.id == paiementId) || 
                         await API.paiements.getById(paiementId);
        
        const printWindow = window.open('', '_blank');
        printWindow.document.write(generateReceiptHtml(paiement));
        printWindow.document.close();
        
        setTimeout(() => {
            printWindow.print();
            printWindow.close();
        }, 500);
        
    } catch (error) {
        electronAPI.log.error('Erreur impression reçu:', error);
        Helpers.showError('Erreur', 'Impossible d\'imprimer le reçu');
    }
}

function generateReceiptHtml(paiement) {
    return `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Reçu - ${paiement.numero_recu}</title>
            <style>
                body { 
                    font-family: Arial, sans-serif; 
                    margin: 20px;
                    max-width: 800px;
                    margin: 0 auto;
                }
                .header { 
                    text-align: center; 
                    margin-bottom: 30px;
                    border-bottom: 2px solid #333;
                    padding-bottom: 20px;
                }
                .header h1 { 
                    margin: 0;
                    color: #333;
                }
                .receipt-info {
                    background: #f5f5f5;
                    padding: 15px;
                    border-radius: 5px;
                    margin-bottom: 20px;
                }
                .receipt-number {
                    font-size: 1.2em;
                    font-weight: bold;
                    color: #2563eb;
                }
                .content {
                    margin: 30px 0;
                }
                .info-row {
                    display: flex;
                    justify-content: space-between;
                    margin-bottom: 10px;
                    padding: 5px 0;
                    border-bottom: 1px dotted #ddd;
                }
                .amount-section {
                    margin-top: 30px;
                    padding: 20px;
                    background: #e8f4f8;
                    border-radius: 5px;
                    text-align: center;
                }
                .amount {
                    font-size: 2em;
                    font-weight: bold;
                    color: #2563eb;
                }
                .signature {
                    margin-top: 50px;
                    display: flex;
                    justify-content: space-between;
                }
                .signature-box {
                    width: 200px;
                    text-align: center;
                }
                .signature-line {
                    border-bottom: 1px solid #333;
                    margin-bottom: 5px;
                    height: 40px;
                }
                .footer {
                    margin-top: 50px;
                    text-align: center;
                    font-size: 0.8em;
                    color: #666;
                }
                @media print {
                    body { margin: 10px; }
                }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>IMPORT EXPORT MARITIME</h1>
                <p>123 Rue du Commerce - 75000 Paris<br>
                Tél: 01 23 45 67 89 - Email: contact@import-export.com</p>
            </div>
            
            <div class="receipt-info">
                <div class="receipt-number">REÇU N° ${paiement.numero_recu}</div>
                <div>Date: ${Helpers.formatDate(paiement.date_paiement)}</div>
            </div>
            
            <div class="content">
                <h3>Reçu de:</h3>
                <div class="info-row">
                    <strong>Client:</strong>
                    <span>${paiement.client_nom}</span>
                </div>
                ${paiement.conteneur_numero ? `
                <div class="info-row">
                    <strong>Conteneur:</strong>
                    <span>${paiement.conteneur_numero}</span>
                </div>` : ''}
                <div class="info-row">
                    <strong>Type de paiement:</strong>
                    <span>${paiement.type_paiement}</span>
                </div>
                <div class="info-row">
                    <strong>Mode de paiement:</strong>
                    <span>${paiement.mode_paiement}</span>
                </div>
                ${paiement.numero_cheque ? `
                <div class="info-row">
                    <strong>N° Chèque:</strong>
                    <span>${paiement.numero_cheque}</span>
                </div>` : ''}
                ${paiement.reference_paiement ? `
                <div class="info-row">
                    <strong>Référence:</strong>
                    <span>${paiement.reference_paiement}</span>
                </div>` : ''}
            </div>
            
            <div class="amount-section">
                <h3>Montant reçu</h3>
                <div class="amount">${Helpers.formatCurrency(paiement.montant_paye)}</div>
                <p><em>${numberToWords(paiement.montant_paye)} euros</em></p>
            </div>
            
            <div class="signature">
                <div class="signature-box">
                    <div class="signature-line"></div>
                    <p>Le client</p>
                </div>
                <div class="signature-box">
                    <div class="signature-line"></div>
                    <p>Le responsable</p>
                    <p>${new Date().toLocaleDateString('fr-FR')}</p>
                </div>
            </div>
            
            <div class="footer">
                <p>Merci de votre confiance</p>
                <p>Ce reçu est un justificatif de paiement à conserver</p>
            </div>
        </body>
        </html>
    `;
}

// =============================================
// FONCTIONS UTILITAIRES
// =============================================

function generateReceiptNumber() {
    const numero = Helpers.generateReceiptNumber();
    $('#numero_recu').val(numero);
}

function calculateRemaining() {
    const total = parseFloat($('#montant_total_du').val()) || 0;
    const paye = parseFloat($('#montant_paye').val()) || 0;
    const restant = total - paye;
    
    $('#montant_restant').val(restant.toFixed(2));
    
    if (restant < 0) {
        $('#montant_restant').addClass('text-danger');
    } else if (restant === 0) {
        $('#montant_restant').addClass('text-success').removeClass('text-danger');
    } else {
        $('#montant_restant').removeClass('text-success text-danger');
    }
}

async function loadClientBalance(clientId) {
    try {
        const balance = await API.clients.getBalance(clientId);
        
        $('#client-balance-info').show();
        $('#client-total-due').text(Helpers.formatCurrency(balance.total_due));
        $('#client-total-paid').text(Helpers.formatCurrency(balance.total_paid));
        $('#client-balance').text(Helpers.formatCurrency(balance.balance));
        
        // Pré-remplir le montant dû si solde négatif
        if (balance.balance > 0) {
            $('#montant_total_du').val(balance.balance);
            calculateRemaining();
        }
        
    } catch (error) {
        electronAPI.log.error('Erreur chargement balance client:', error);
    }
}

async function loadClientContainers(clientId) {
    try {
        const containers = await API.conteneurs.getActive();
        const clientContainers = containers.filter(c => 
            c.manifest && c.manifest.some(m => m.client_id == clientId)
        );
        
        // Mettre à jour le select des conteneurs
        const options = '<option value="">Aucun conteneur</option>' +
            clientContainers.map(c => 
                `<option value="${c.id}">${c.numero_conteneur} - ${c.destination_ville}</option>`
            ).join('');
        
        $('#select-conteneur').html(options);
        
    } catch (error) {
        electronAPI.log.error('Erreur chargement conteneurs client:', error);
    }
}

async function updateStats() {
    try {
        const stats = await API.rapports.getDashboard();
        
        $('#stat-total-revenue').text(Helpers.formatCurrency(stats.totalRevenue || 0));
        $('#stat-pending-payments').text(Helpers.formatCurrency(stats.pendingPayments || 0));
        $('#stat-overdue-amount').text(Helpers.formatCurrency(stats.overdueAmount || 0));
        $('#stat-monthly-revenue').text(Helpers.formatCurrency(stats.monthlyRevenue || 0));
        
        // Tendances
        updateTrend('#trend-revenue', stats.revenueTrend);
        updateTrend('#trend-payments', stats.paymentsTrend);
        
    } catch (error) {
        electronAPI.log.error('Erreur mise à jour statistiques:', error);
    }
}

function updateTrend(selector, value) {
    const element = $(selector);
    element.removeClass('text-success text-danger');
    
    if (value > 0) {
        element.html(`<i class="fas fa-arrow-up"></i> +${value}%`).addClass('text-success');
    } else if (value < 0) {
        element.html(`<i class="fas fa-arrow-down"></i> ${value}%`).addClass('text-danger');
    } else {
        element.html(`<i class="fas fa-minus"></i> 0%`);
    }
}

function applyFilters() {
    const search = $('#search-paiement').val();
    if (search) {
        paiementsTable.search(search).draw();
    } else {
        paiementsTable.search('').draw();
    }
}

async function exportFinancialReport() {
    try {
        const format = await Swal.fire({
            title: 'Format d\'export',
            input: 'select',
            inputOptions: {
                'excel': 'Excel (.xlsx)',
                'pdf': 'PDF'
            },
            inputPlaceholder: 'Sélectionnez un format',
            showCancelButton: true
        });
        
        if (!format.isConfirmed) return;
        
        Helpers.showLoader('Export en cours...');
        
        const period = $('#period-select').val();
        await API.rapports.exportExcel('finances', { 
            format: format.value,
            period: period 
        });
        
        Helpers.hideLoader();
        Helpers.showSuccess('Export réussi', 'Le rapport a été téléchargé');
        
    } catch (error) {
        Helpers.hideLoader();
        electronAPI.log.error('Erreur export rapport:', error);
        Helpers.showError('Erreur', 'Impossible d\'exporter le rapport');
    }
}

// Convertir un nombre en lettres (pour les reçus)
function numberToWords(num) {
    // Implémentation simplifiée - à améliorer
    const units = ['', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf'];
    const teens = ['dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize', 'dix-sept', 'dix-huit', 'dix-neuf'];
    const tens = ['', '', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante', 'soixante-dix', 'quatre-vingt', 'quatre-vingt-dix'];
    
    // Conversion basique pour les montants jusqu'à 999
    if (num === 0) return 'zéro';
    if (num < 10) return units[num];
    if (num < 20) return teens[num - 10];
    if (num < 100) {
        const ten = Math.floor(num / 10);
        const unit = num % 10;
        return tens[ten] + (unit ? '-' + units[unit] : '');
    }
    
    // Pour les montants plus élevés, retourner le nombre
    return num.toString();
}

// =============================================
// GESTION DES ANNULATIONS
// =============================================

async function cancelPaiement(paiementId) {
    const confirmed = await Helpers.confirm(
        'Annuler le paiement',
        'Êtes-vous sûr de vouloir annuler ce paiement ?'
    );
    
    if (!confirmed) return;
    
    try {
        Helpers.showLoader('Annulation en cours...');
        
        await API.paiements.update(paiementId, { statut: 'annule' });
        
        await loadPaiements();
        await updateStats();
        
        Helpers.hideLoader();
        Helpers.showSuccess('Succès', 'Paiement annulé avec succès');
        
    } catch (error) {
        Helpers.hideLoader();
        electronAPI.log.error('Erreur annulation paiement:', error);
        Helpers.showError('Erreur', 'Impossible d\'annuler le paiement');
    }
}

// =============================================
// GESTION TEMPS RÉEL
// =============================================

export function handleRealtimeUpdate(type, data) {
    if (type !== 'paiement') return;
    
    electronAPI.log.info('Mise à jour temps réel paiement:', data);
    
    // Rafraîchir les données
    loadPaiements();
    updateStats();
}

// =============================================
// API PUBLIQUE DU MODULE
// =============================================

window.financesModule = {
    viewPaiement,
    editPaiement: showPaiementModal,
    printReceipt,
    cancelPaiement,
    generateNumero: generateReceiptNumber
};