/**
 * Module de gestion des clients
 * Gère l'affichage, la création, modification et suppression des clients
 */

// Variables du module
let clientsTable = null;
let currentClients = [];
let selectedClient = null;

// =============================================
// INITIALISATION DU MODULE
// =============================================

export async function init() {
    electronAPI.log.info('Initialisation du module Clients');
    
    try {
        // Charger les données initiales
        await loadClients();
        
        // Initialiser l'interface
        initializeUI();
        
        // Initialiser les gestionnaires d'événements
        initializeEventHandlers();
        
        // Mettre à jour les statistiques
        updateStats();
        
    } catch (error) {
        electronAPI.log.error('Erreur initialisation module clients:', error);
        Helpers.showError('Erreur', 'Impossible de charger le module clients');
    }
}

// =============================================
// CHARGEMENT DES DONNÉES
// =============================================

async function loadClients() {
    try {
        // Vérifier le cache d'abord
        const cachedClients = Storage.getCache('clients');
        if (cachedClients) {
            currentClients = cachedClients;
            renderClientsTable();
        }
        
        // Charger depuis l'API
        const response = await API.clients.getAll();
        currentClients = response.data || response;
        
        // Mettre en cache
        Storage.setCache('clients', currentClients);
        
        // Afficher les données
        renderClientsTable();
        
    } catch (error) {
        electronAPI.log.error('Erreur chargement clients:', error);
        throw error;
    }
}

// =============================================
// INTERFACE UTILISATEUR
// =============================================

function initializeUI() {
    // Initialiser DataTable
    if ($.fn.DataTable.isDataTable('#clients-table')) {
        $('#clients-table').DataTable().destroy();
    }
    
    clientsTable = Helpers.initDataTable('#clients-table', {
        columns: [
            { data: 'code_client', title: 'Code' },
            { data: 'nom', title: 'Nom' },
            { data: 'prenom', title: 'Prénom' },
            { data: 'telephone_principal', title: 'Téléphone' },
            { data: 'email', title: 'Email' },
            { data: 'ville', title: 'Ville' },
            { 
                data: 'statut', 
                title: 'Statut',
                render: renderStatus
            },
            {
                data: null,
                title: 'Actions',
                orderable: false,
                render: renderActions
            }
        ],
        order: [[1, 'asc']],
        language: {
            url: '//cdn.datatables.net/plug-ins/1.13.7/i18n/fr-FR.json'
        }
    });
    
    // Initialiser les selects
    Helpers.initSelect2('#filter-status', {
        placeholder: 'Tous les statuts'
    });
    
    Helpers.initSelect2('#filter-city', {
        placeholder: 'Toutes les villes',
        allowClear: true
    });
    
    // Charger les villes pour le filtre
    loadCitiesForFilter();
}

function renderClientsTable() {
    if (clientsTable) {
        clientsTable.clear();
        clientsTable.rows.add(currentClients);
        clientsTable.draw();
    }
}

function renderStatus(statut) {
    const color = CONSTANTS.STATUS_COLORS[statut] || 'secondary';
    const icon = CONSTANTS.STATUS_ICONS[statut] || 'fa-circle';
    const label = statut.charAt(0).toUpperCase() + statut.slice(1);
    
    return `<span class="badge bg-${color}">
        <i class="fas ${icon} me-1"></i>${label}
    </span>`;
}

function renderActions(data, type, row) {
    return `
        <div class="btn-group btn-group-sm" role="group">
            <button class="btn btn-info" onclick="clientsModule.viewClient('${row.id}')" 
                title="Voir détails">
                <i class="fas fa-eye"></i>
            </button>
            <button class="btn btn-primary" onclick="clientsModule.editClient('${row.id}')" 
                title="Modifier">
                <i class="fas fa-edit"></i>
            </button>
            <button class="btn btn-success" onclick="clientsModule.viewHistory('${row.id}')" 
                title="Historique">
                <i class="fas fa-history"></i>
            </button>
            <button class="btn btn-danger" onclick="clientsModule.deleteClient('${row.id}')" 
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
    // Bouton nouveau client
    $('#btn-new-client').on('click', () => {
        showClientModal();
    });
    
    // Bouton refresh
    $('#btn-refresh').on('click', async () => {
        Storage.invalidateCache('clients');
        await loadClients();
        Helpers.showToast('Données actualisées', 'success');
    });
    
    // Bouton export
    $('#btn-export').on('click', () => {
        exportClients();
    });
    
    // Bouton import
    $('#btn-import').on('click', () => {
        showImportModal();
    });
    
    // Filtres
    $('#filter-status, #filter-city').on('change', applyFilters);
    $('#search-client').on('input', Helpers.debounce(applyFilters, 300));
    
    // Formulaire client
    $('#client-form').on('submit', async (e) => {
        e.preventDefault();
        await saveClient();
    });
    
    // Toggle adresse de livraison
    $('#same-delivery-address').on('change', function() {
        $('#delivery-address-group').toggle(!this.checked);
    });
    
    // Auto-complétion code postal
    $('#code_postal').on('blur', function() {
        // TODO: Auto-compléter la ville selon le code postal
    });
    
    // Scanner pour carte d'identité
    $('#btn-scan-id').on('click', () => {
        // TODO: Ouvrir le scanner pour la pièce d'identité
        Helpers.showToast('Scanner en cours de développement', 'info');
    });
}

// =============================================
// FONCTIONS CRUD
// =============================================

function showClientModal(clientId = null) {
    selectedClient = clientId ? currentClients.find(c => c.id == clientId) : null;
    
    // Réinitialiser le formulaire
    $('#client-form')[0].reset();
    $('#client-id').val('');
    $('#delivery-address-group').hide();
    $('#same-delivery-address').prop('checked', true);
    
    if (selectedClient) {
        // Mode édition
        $('#client-modal-title').text('Modifier le client');
        fillClientForm(selectedClient);
    } else {
        // Mode création
        $('#client-modal-title').text('Nouveau client');
        $('#code_client').val(Helpers.generateClientCode());
    }
    
    $('#client-modal').modal('show');
}

function fillClientForm(client) {
    $('#client-id').val(client.id);
    $('#code_client').val(client.code_client);
    $('#type_client').val(client.type_client).trigger('change');
    $('#nom').val(client.nom);
    $('#prenom').val(client.prenom);
    $('#telephone_principal').val(client.telephone_principal);
    $('#telephone_secondaire').val(client.telephone_secondaire);
    $('#email').val(client.email);
    $('#adresse_principale').val(client.adresse_principale);
    $('#code_postal').val(client.code_postal);
    $('#ville').val(client.ville);
    $('#pays').val(client.pays);
    
    if (client.adresse_livraison && client.adresse_livraison !== client.adresse_principale) {
        $('#same-delivery-address').prop('checked', false);
        $('#delivery-address-group').show();
        $('#adresse_livraison').val(client.adresse_livraison);
    }
    
    $('#numero_entreprise').val(client.numero_entreprise);
    $('#commentaires').val(client.commentaires);
    $('#statut').val(client.statut).trigger('change');
}

async function saveClient() {
    try {
        // Validation
        if (!validateClientForm()) {
            return;
        }
        
        // Récupérer les données du formulaire
        const formData = getClientFormData();
        
        // Afficher le loader
        Helpers.showLoader('Enregistrement en cours...');
        
        let response;
        if (formData.id) {
            // Mise à jour
            response = await API.clients.update(formData.id, formData);
            electronAPI.log.info('Client mis à jour:', response);
        } else {
            // Création
            response = await API.clients.create(formData);
            electronAPI.log.info('Client créé:', response);
        }
        
        // Fermer le modal
        $('#client-modal').modal('hide');
        
        // Rafraîchir les données
        Storage.invalidateCache('clients');
        await loadClients();
        
        // Notification temps réel
        WebSocketManager.sendUpdate('client', {
            action: formData.id ? 'update' : 'create',
            data: response
        });
        
        Helpers.hideLoader();
        Helpers.showSuccess('Succès', formData.id ? 
            'Client mis à jour avec succès' : 
            'Client créé avec succès'
        );
        
    } catch (error) {
        Helpers.hideLoader();
        electronAPI.log.error('Erreur sauvegarde client:', error);
        Helpers.showError('Erreur', 'Impossible d\'enregistrer le client');
    }
}

function validateClientForm() {
    const required = ['nom', 'prenom', 'telephone_principal', 'adresse_principale'];
    let isValid = true;
    
    required.forEach(field => {
        const input = $(`#${field}`);
        const value = input.val().trim();
        
        if (!value) {
            input.addClass('is-invalid');
            isValid = false;
        } else {
            input.removeClass('is-invalid');
        }
    });
    
    // Validation email
    const email = $('#email').val();
    if (email && !Helpers.isValidEmail(email)) {
        $('#email').addClass('is-invalid');
        isValid = false;
    }
    
    // Validation téléphone
    const phone = $('#telephone_principal').val();
    if (!Helpers.isValidPhone(phone)) {
        $('#telephone_principal').addClass('is-invalid');
        isValid = false;
    }
    
    if (!isValid) {
        Helpers.showToast('Veuillez corriger les erreurs', 'error');
    }
    
    return isValid;
}

function getClientFormData() {
    const formData = {
        id: $('#client-id').val() || null,
        code_client: $('#code_client').val(),
        type_client: $('#type_client').val(),
        nom: $('#nom').val().trim(),
        prenom: $('#prenom').val().trim(),
        telephone_principal: $('#telephone_principal').val().trim(),
        telephone_secondaire: $('#telephone_secondaire').val().trim(),
        email: $('#email').val().trim(),
        adresse_principale: $('#adresse_principale').val().trim(),
        code_postal: $('#code_postal').val().trim(),
        ville: $('#ville').val().trim(),
        pays: $('#pays').val(),
        numero_entreprise: $('#numero_entreprise').val().trim(),
        commentaires: $('#commentaires').val().trim(),
        statut: $('#statut').val()
    };
    
    // Adresse de livraison
    if (!$('#same-delivery-address').is(':checked')) {
        formData.adresse_livraison = $('#adresse_livraison').val().trim();
    } else {
        formData.adresse_livraison = formData.adresse_principale;
    }
    
    return formData;
}

async function deleteClient(clientId) {
    const client = currentClients.find(c => c.id == clientId);
    if (!client) return;
    
    const confirmed = await Helpers.confirm(
        'Supprimer le client',
        `Êtes-vous sûr de vouloir supprimer le client ${client.nom} ${client.prenom} ?`
    );
    
    if (!confirmed) return;
    
    try {
        Helpers.showLoader('Suppression en cours...');
        
        await API.clients.delete(clientId);
        
        // Rafraîchir les données
        Storage.invalidateCache('clients');
        await loadClients();
        
        // Notification temps réel
        WebSocketManager.sendUpdate('client', {
            action: 'delete',
            data: { id: clientId }
        });
        
        Helpers.hideLoader();
        Helpers.showSuccess('Succès', 'Client supprimé avec succès');
        
    } catch (error) {
        Helpers.hideLoader();
        electronAPI.log.error('Erreur suppression client:', error);
        Helpers.showError('Erreur', 'Impossible de supprimer le client');
    }
}

// =============================================
// FONCTIONS DE VISUALISATION
// =============================================

async function viewClient(clientId) {
    try {
        const client = await API.clients.getById(clientId);
        showClientDetails(client);
    } catch (error) {
        electronAPI.log.error('Erreur chargement détails client:', error);
        Helpers.showError('Erreur', 'Impossible de charger les détails du client');
    }
}

function showClientDetails(client) {
    const modal = $('#client-details-modal');
    
    // Remplir les informations
    modal.find('.client-name').text(`${client.nom} ${client.prenom}`);
    modal.find('.client-code').text(client.code_client);
    modal.find('.client-phone').text(Helpers.formatPhone(client.telephone_principal));
    modal.find('.client-email').text(client.email || 'N/A');
    modal.find('.client-address').html(formatAddress(client));
    modal.find('.client-status').html(renderStatus(client.statut));
    modal.find('.client-created').text(Helpers.formatDate(client.created_at));
    
    // Statistiques
    modal.find('.stat-shipments').text(client.nombre_envois || 0);
    modal.find('.stat-volume').text(Helpers.formatVolume(client.volume_total));
    modal.find('.stat-revenue').text(Helpers.formatCurrency(client.chiffre_affaires_total));
    
    // Actions
    modal.find('.btn-edit').off('click').on('click', () => {
        modal.modal('hide');
        showClientModal(client.id);
    });
    
    modal.find('.btn-history').off('click').on('click', () => {
        modal.modal('hide');
        viewHistory(client.id);
    });
    
    modal.modal('show');
}

async function viewHistory(clientId) {
    try {
        Helpers.showLoader('Chargement de l\'historique...');
        
        const [shipments, payments] = await Promise.all([
            API.clients.getShipments(clientId),
            API.clients.getPayments(clientId)
        ]);
        
        showHistoryModal(clientId, shipments, payments);
        
        Helpers.hideLoader();
        
    } catch (error) {
        Helpers.hideLoader();
        electronAPI.log.error('Erreur chargement historique:', error);
        Helpers.showError('Erreur', 'Impossible de charger l\'historique');
    }
}

function showHistoryModal(clientId, shipments, payments) {
    const modal = $('#client-history-modal');
    const client = currentClients.find(c => c.id == clientId);
    
    modal.find('.client-name').text(`${client.nom} ${client.prenom}`);
    
    // Afficher les envois
    const shipmentsHtml = shipments.map(s => `
        <tr>
            <td>${Helpers.formatDate(s.date)}</td>
            <td>${s.numero_conteneur}</td>
            <td>${s.destination}</td>
            <td>${s.nombre_colis}</td>
            <td>${renderStatus(s.statut)}</td>
            <td>${Helpers.formatCurrency(s.montant)}</td>
        </tr>
    `).join('') || '<tr><td colspan="6" class="text-center">Aucun envoi</td></tr>';
    
    modal.find('#history-shipments').html(shipmentsHtml);
    
    // Afficher les paiements
    const paymentsHtml = payments.map(p => `
        <tr>
            <td>${Helpers.formatDate(p.date_paiement)}</td>
            <td>${p.numero_recu}</td>
            <td>${p.type_paiement}</td>
            <td>${p.mode_paiement}</td>
            <td>${Helpers.formatCurrency(p.montant_paye)}</td>
            <td>${renderStatus(p.statut)}</td>
        </tr>
    `).join('') || '<tr><td colspan="6" class="text-center">Aucun paiement</td></tr>';
    
    modal.find('#history-payments').html(paymentsHtml);
    
    modal.modal('show');
}

// =============================================
// FONCTIONS D'EXPORT/IMPORT
// =============================================

async function exportClients() {
    try {
        const format = await Swal.fire({
            title: 'Format d\'export',
            input: 'select',
            inputOptions: {
                'excel': 'Excel (.xlsx)',
                'csv': 'CSV (.csv)',
                'pdf': 'PDF'
            },
            inputPlaceholder: 'Sélectionnez un format',
            showCancelButton: true
        });
        
        if (!format.isConfirmed) return;
        
        Helpers.showLoader('Export en cours...');
        
        if (format.value === 'csv') {
            // Export CSV local
            const csv = Helpers.generateCSV(currentClients, [
                'code_client', 'nom', 'prenom', 'telephone_principal', 
                'email', 'ville', 'statut'
            ]);
            Helpers.downloadFile(csv, `clients_${Date.now()}.csv`, 'text/csv');
        } else {
            // Export via API
            await API.rapports.exportExcel('clients', { format: format.value });
        }
        
        Helpers.hideLoader();
        Helpers.showSuccess('Export réussi', 'Le fichier a été téléchargé');
        
    } catch (error) {
        Helpers.hideLoader();
        electronAPI.log.error('Erreur export clients:', error);
        Helpers.showError('Erreur', 'Impossible d\'exporter les clients');
    }
}

function showImportModal() {
    $('#import-modal').modal('show');
    
    // Gérer le drag & drop
    const dropZone = $('#import-dropzone');
    
    dropZone.on('dragover', (e) => {
        e.preventDefault();
        dropZone.addClass('drag-over');
    });
    
    dropZone.on('dragleave', () => {
        dropZone.removeClass('drag-over');
    });
    
    dropZone.on('drop', (e) => {
        e.preventDefault();
        dropZone.removeClass('drag-over');
        
        const files = e.originalEvent.dataTransfer.files;
        if (files.length > 0) {
            handleImportFile(files[0]);
        }
    });
    
    $('#import-file').on('change', function() {
        if (this.files.length > 0) {
            handleImportFile(this.files[0]);
        }
    });
}

async function handleImportFile(file) {
    try {
        // Vérifier le type de fichier
        if (!file.name.endsWith('.csv') && !file.name.endsWith('.xlsx')) {
            Helpers.showError('Format invalide', 'Veuillez sélectionner un fichier CSV ou Excel');
            return;
        }
        
        Helpers.showLoader('Import en cours...');
        
        // TODO: Implémenter l'import réel
        // Pour le moment, simulation
        setTimeout(() => {
            Helpers.hideLoader();
            $('#import-modal').modal('hide');
            Helpers.showSuccess('Import réussi', 'Les clients ont été importés');
            loadClients();
        }, 2000);
        
    } catch (error) {
        Helpers.hideLoader();
        electronAPI.log.error('Erreur import clients:', error);
        Helpers.showError('Erreur', 'Impossible d\'importer le fichier');
    }
}

// =============================================
// FONCTIONS UTILITAIRES
// =============================================

function applyFilters() {
    const status = $('#filter-status').val();
    const city = $('#filter-city').val();
    const search = $('#search-client').val().toLowerCase();
    
    let filtered = currentClients;
    
    if (status) {
        filtered = filtered.filter(c => c.statut === status);
    }
    
    if (city) {
        filtered = filtered.filter(c => c.ville === city);
    }
    
    if (search) {
        filtered = Helpers.fuzzySearch(filtered, search, [
            'nom', 'prenom', 'telephone_principal', 'email', 'code_client'
        ]);
    }
    
    clientsTable.clear();
    clientsTable.rows.add(filtered);
    clientsTable.draw();
}

function loadCitiesForFilter() {
    const cities = [...new Set(currentClients.map(c => c.ville).filter(Boolean))];
    const options = cities.sort().map(city => 
        `<option value="${city}">${city}</option>`
    ).join('');
    
    $('#filter-city').html('<option value="">Toutes les villes</option>' + options);
}

function formatAddress(client) {
    let html = client.adresse_principale + '<br>';
    if (client.code_postal || client.ville) {
        html += `${client.code_postal} ${client.ville}<br>`;
    }
    if (client.pays && client.pays !== 'France') {
        html += client.pays;
    }
    return html;
}

function updateStats() {
    const stats = {
        total: currentClients.length,
        active: currentClients.filter(c => c.statut === 'actif').length,
        inactive: currentClients.filter(c => c.statut === 'inactif').length,
        suspended: currentClients.filter(c => c.statut === 'suspendu').length
    };
    
    $('#stat-total-clients').text(stats.total);
    $('#stat-active-clients').text(stats.active);
    $('#stat-inactive-clients').text(stats.inactive);
    $('#stat-suspended-clients').text(stats.suspended);
}

// =============================================
// GESTION TEMPS RÉEL
// =============================================

export function handleRealtimeUpdate(type, data) {
    if (type !== 'client') return;
    
    electronAPI.log.info('Mise à jour temps réel client:', data);
    
    // Rafraîchir les données
    loadClients();
}

// =============================================
// API PUBLIQUE DU MODULE
// =============================================

// Exposer les fonctions pour les onclick inline
window.clientsModule = {
    viewClient,
    editClient: showClientModal,
    viewHistory,
    deleteClient
};