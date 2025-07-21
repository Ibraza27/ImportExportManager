/**
 * Module Dashboard Optimisé
 * Version améliorée avec gestion de cache et approche orientée objet
 */
class DashboardModule {
    constructor() {
        // Propriétés principales
        this.charts = {}; // Stockage des instances de graphiques
        this.refreshInterval = null; // Intervalle de rafraîchissement
        this.dashboardData = null; // Données actuelles du dashboard
        this.lastUpdate = null; // Dernière mise à jour
        this.isLoading = false; // État de chargement
        this.updateTimeout = null; // Timeout pour les mises à jour différées

        // Cache des données
        this.cache = {
            data: null,
            timestamp: 0
        };

        // Configuration
        this.CACHE_DURATION = 10000; // 10 secondes de cache
        this.REFRESH_INTERVAL = 30000; // Rafraîchissement toutes les 30 secondes
    }

    /**
     * Initialisation du module Dashboard
     */
    async init() {
        window.electronAPI.log.info('Initialisation du module Dashboard optimisé');

        try {
            // Charger les données initiales
            await this.loadDashboard();

            // Initialiser les composants visuels
            this.initializeCharts();
            this.updateClock();

            // Configurer les gestionnaires d'événements
            this.initializeEventHandlers();

            // Configurer le rafraîchissement automatique
            this.startAutoRefresh();

            // Configurer les WebSockets pour les mises à jour en temps réel
            this.setupWebSocketListeners();

        } catch (error) {
            window.electronAPI.log.error('Erreur initialisation dashboard:', error);
            this.showError('Impossible de charger le tableau de bord');
        }
    }

    /**
     * Charge toutes les données du dashboard
     * @param {boolean} forceRefresh - Force le rafraîchissement en ignorant le cache
     */
    async loadDashboard(forceRefresh = false) {
        // Vérifier le cache si on ne force pas le rafraîchissement
        if (!forceRefresh && this.cache.data &&
            Date.now() - this.cache.timestamp < this.CACHE_DURATION) {
            this.render(this.cache.data);
            return;
        }

        // Éviter les requêtes multiples simultanées
        if (this.isLoading) return;

        this.isLoading = true;
        this.showLoading();

        try {
            const period = document.getElementById('period-filter')?.value || 'month';

            // Une seule requête pour toutes les données
            const response = await window.API.dashboard.getAllData(period);

            // En cas de succès
            if (response.success) {
                // Mettre en cache
                this.cache = {
                    data: response.data,
                    timestamp: Date.now()
                };

                this.dashboardData = response.data;
                this.lastUpdate = new Date();
                this.render(response.data);
            } else {
                throw new Error(response.error || 'Erreur chargement dashboard');
            }

        } catch (error) {
            this.isLoading = false;
            this.showLoading(false);

            // ✅ ON AJOUTE UN LOG TRÈS VISIBLE ICI
            console.error("ERREUR FATALE LORS DU CHARGEMENT DES DONNÉES DU DASHBOARD:", error);
            window.electronAPI.log.error("ERREUR FATALE LORS DU CHARGEMENT DES DONNÉES DU DASHBOARD:", error.message, error.response?.data);
            
            this.useDemoData();
        } finally {
            this.isLoading = false;
        }
    }

    /**
     * Affiche toutes les données du dashboard
     * @param {object} data - Données à afficher
     */
    render(data) {
        if (!data) return;

        // Statistiques principales
        this.renderStats(data.stats);

        // Graphiques
        this.updateCharts(data.chartsData);

        // Tableaux et listes
        this.displayRecentClients(data.recentClients.data);
        this.displayRecentShipments(data.recentShipments.data);
        this.displayRecentPayments(data.recentPayments.data);
        this.displayPendingContainers(data.pendingContainers);

        // Notifications et autres éléments
        this.updateNotificationBadge(data.stats.notifications_non_lues || 0);
        this.updateLastRefreshTime();

        // Masquer le loader s'il est affiché
        this.hideLoader();
    }

    /**
     * Affiche les statistiques principales
     * @param {object} stats - Données statistiques
     */
    renderStats(stats) {
        if (!stats) return;

        // Clients
        this.animateCounter('#stat-total-clients', stats.clients.total || 0);
        const newClientsElement = document.getElementById('stat-new-clients');
        if (newClientsElement) newClientsElement.textContent = `+${stats.clients.nouveaux || 0}`;

        // Conteneurs
        this.animateCounter('#stat-active-containers', stats.conteneurs.total || 0);

        // Finances
        this.animateCounter('#stat-monthly-revenue', stats.finances.total_paye || 0, true);
        const pending = (stats.finances.total_facture || 0) - (stats.finances.total_paye || 0);
        this.animateCounter('#stat-pending-payments', pending, true);

        // Tendances
        this.updateTrendIndicator('#trend-clients', stats.trends.clients);
        this.updateTrendIndicator('#trend-revenue', stats.trends.revenue);
        this.updateTrendIndicator('#trend-shipments', stats.trends.shipments);
    }

    /**
     * Initialise les graphiques
     */
    initializeCharts() {
        if (!document.getElementById('revenue-chart')) return;

        // Configuration commune des graphiques
        Chart.defaults.font.family = "'Inter', sans-serif";
        Chart.defaults.font.size = 12;
        Chart.defaults.color = '#64748b';

        // Graphique des revenus
        const revenueCtx = document.getElementById('revenue-chart')?.getContext('2d');
        if (revenueCtx) {
            this.charts.revenue = new Chart(revenueCtx, {
                type: 'line',
                data: {
                    labels: [],
                    datasets: [{
                        label: 'Revenus',
                        data: [],
                        borderColor: '#2563eb',
                        backgroundColor: 'rgba(37, 99, 235, 0.1)',
                        tension: 0.4,
                        fill: true
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            callbacks: {
                                label: (context) => this.formatCurrency(context.parsed.y)
                            }
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            ticks: {
                                callback: (value) => this.formatCurrency(value)
                            }
                        }
                    }
                }
            });
        }

        // Graphique des expéditions
        const shipmentsCtx = document.getElementById('shipments-chart')?.getContext('2d');
        if (shipmentsCtx) {
            this.charts.shipments = new Chart(shipmentsCtx, {
                type: 'bar',
                data: {
                    labels: [],
                    datasets: [{
                        label: 'Expéditions',
                        data: [],
                        backgroundColor: '#10b981'
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false }
                    },
                    scales: {
                        y: { beginAtZero: true }
                    }
                }
            });
        }

        // Graphique des destinations
        const destinationsCtx = document.getElementById('destinations-chart')?.getContext('2d');
        if (destinationsCtx) {
            this.charts.destinations = new Chart(destinationsCtx, {
                type: 'doughnut',
                data: {
                    labels: [],
                    datasets: [{
                        data: [],
                        backgroundColor: [
                            '#2563eb', '#10b981', '#f59e0b',
                            '#ef4444', '#8b5cf6', '#06b6d4'
                        ]
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            position: 'bottom',
                            labels: { padding: 10 }
                        }
                    }
                }
            });
        }
    }

    /**
     * Met à jour les graphiques avec de nouvelles données
     * @param {object} data - Données des graphiques
     */
    updateCharts(data) {
        if (!data) return;

        if (this.charts.revenue && data.revenue) {
            this.charts.revenue.data.labels = data.revenue.labels;
            this.charts.revenue.data.datasets[0].data = data.revenue.values;
            this.charts.revenue.update();
        }

        if (this.charts.shipments && data.shipments) {
            this.charts.shipments.data.labels = data.shipments.labels;
            this.charts.shipments.data.datasets[0].data = data.shipments.values;
            this.charts.shipments.update();
        }

        if (this.charts.destinations && data.destinations) {
            this.charts.destinations.data.labels = data.destinations.labels;
            this.charts.destinations.data.datasets[0].data = data.destinations.values;
            this.charts.destinations.update();
        }
    }

    /**
     * Affiche la liste des clients récents
     * @param {Array} clients - Liste des clients
     */
    displayRecentClients(clients) {
        const tbody = document.getElementById('recent-clients-list');
        if (!tbody) return;

        tbody.innerHTML = '';

        if (!clients || clients.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted">Aucun client récent</td></tr>';
            return;
        }

        clients.forEach(client => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${client.code_client || 'N/A'}</td>
                <td>${client.nom} ${client.prenom}</td>
                <td>${client.telephone_principal || 'N/A'}</td>
                <td><span class="badge bg-success">${client.statut || 'actif'}</span></td>
            `;
            tbody.appendChild(row);
        });
    }

    /**
     * Affiche la liste des expéditions récentes
     * @param {Array} shipments - Liste des expéditions
     */
    displayRecentShipments(shipments) {
        const container = document.getElementById('recent-shipments-list');
        if (!container) return;

        container.innerHTML = '';

        if (!shipments || shipments.length === 0) {
            container.innerHTML = '<div class="text-center text-muted py-3">Aucun envoi récent</div>';
            return;
        }

        shipments.forEach(shipment => {
            const card = document.createElement('div');
            card.className = 'shipment-item d-flex align-items-center p-2 border-bottom';
            card.innerHTML = `
                <div class="flex-grow-1">
                    <div class="fw-bold">${shipment.code_barre}</div>
                    <small class="text-muted">${shipment.client_nom} - ${shipment.designation}</small>
                </div>
                <div class="text-end">
                    <span class="badge bg-info">${shipment.statut}</span>
                    <div><small>${new Date(shipment.date_reception).toLocaleDateString('fr-FR')}</small></div>
                </div>
            `;
            container.appendChild(card);
        });
    }

    /**
     * Affiche la liste des paiements récents
     * @param {Array} payments - Liste des paiements
     */
    displayRecentPayments(payments) {
        const tbody = document.getElementById('recent-payments-list');
        if(!tbody) return;

        tbody.innerHTML = '';

        if (!payments || payments.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">Aucun paiement récent</td></tr>';
            return;
        }

        payments.forEach(payment => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${new Date(payment.date_paiement).toLocaleDateString('fr-FR')}</td>
                <td>${payment.client_nom}</td>
                <td>${payment.mode_paiement}</td>
                <td class="text-end fw-bold">${payment.montant_paye.toFixed(2)} €</td>
                <td><span class="badge bg-success">${payment.statut}</span></td>
            `;
            tbody.appendChild(row);
        });
    }

    /**
     * Affiche les conteneurs en attente
     * @param {Array} containers - Liste des conteneurs
     */
    displayPendingContainers(containers) {
        const container = document.getElementById('pending-containers');
        if (!container) return;

        container.innerHTML = '';

        if (!containers || containers.length === 0) {
            container.innerHTML = '<div class="text-center text-muted py-3">Aucun conteneur en cours</div>';
            return;
        }

        containers.forEach(cont => {
            const fillingRate = this.calculateFillingRate(cont.volume_utilise, cont.capacite_volume_total);
            const progressColor = fillingRate > 80 ? 'success' : fillingRate > 50 ? 'warning' : 'info';
            const card = document.createElement('div');
            card.className = 'col-md-6 mb-3';
            card.innerHTML = `
                <div class="card h-100 container-card">
                    <div class="card-body">
                        <h6 class="card-title mb-1">${cont.numero_conteneur}</h6>
                        <p class="text-muted small mb-2">
                            <i class="fas fa-map-marker-alt me-1"></i>${cont.destination_ville}, ${cont.destination_pays}
                        </p>
                        <div class="d-flex justify-content-between small mb-1">
                            <span>${cont.nombre_clients} clients</span>
                            <span>${cont.nombre_marchandises} colis</span>
                        </div>
                        <div class="progress" style="height: 20px;">
                            <div class="progress-bar bg-${progressColor}"
                                 role="progressbar"
                                 style="width: ${fillingRate}%">
                                ${fillingRate}%
                            </div>
                        </div>
                        <div class="mt-2 d-flex justify-content-between">
                            <small>Départ: ${this.formatDate(cont.date_depart_prevue)}</small>
                            <small class="fw-bold text-${cont.total_restant > 0 ? 'danger' : 'success'}">
                                ${this.formatCurrency(cont.total_restant)} à payer
                            </small>
                        </div>
                    </div>
                </div>
            `;
            container.appendChild(card);
        });
    }

    /**
     * Initialise les gestionnaires d'événements
     */
    initializeEventHandlers() {
        // Boutons d'action rapide
        document.getElementById('quick-new-client')?.addEventListener('click', () => {
            window.location.hash = '#clients';
            setTimeout(() => document.getElementById('btn-new-client')?.click(), 500);
        });

        document.getElementById('quick-new-shipment')?.addEventListener('click', () => {
            window.location.hash = '#marchandises';
            setTimeout(() => document.getElementById('btn-new-marchandise')?.click(), 500);
        });

        document.getElementById('quick-new-container')?.addEventListener('click', () => {
            window.location.hash = '#conteneurs';
            setTimeout(() => document.getElementById('btn-new-conteneur')?.click(), 500);
        });

        document.getElementById('quick-scan')?.addEventListener('click', () => {
            window.location.hash = '#scanner';
        });

        // Filtre de période
        document.getElementById('period-filter')?.addEventListener('change', async function() {
            await this.loadDashboard(true);
        }.bind(this));

        // Bouton refresh - CORRIGÉ
        document.getElementById('btn-refresh-dashboard')?.addEventListener('click', async () => {
            await this.loadDashboard(true);
            this.showToast('Tableau de bord actualisé', 'success');
        });

        // Export du rapport - CORRIGÉ
        document.getElementById('btn-export-report')?.addEventListener('click', () => {
            this.exportDashboardReport();
        });
    }

    /**
     * Configure les listeners WebSocket pour les mises à jour en temps réel
     */
    setupWebSocketListeners() {
        if (!window.socket) return;

        // Écouter les mises à jour en temps réel
        window.socket.on('dashboard:update', (data) => {
            window.electronAPI.log.info('Mise à jour temps réel dashboard reçue');
            this.handleRealtimeUpdate(data.type, data.data);
        });

        window.socket.on('nouvelle_marchandise', () => {
            window.electronAPI.log.info('Nouvelle marchandise reçue');
            // Rafraîchir avec un délai pour éviter la surcharge
            clearTimeout(this.updateTimeout);
            this.updateTimeout = setTimeout(() => {
                this.loadDashboard(true);
            }, 1000);
        });
    }

    /**
     * Gère les mises à jour en temps réel
     * @param {string} type - Type de mise à jour
     * @param {object} data - Données de la mise à jour
     */
    handleRealtimeUpdate(type, data) {
        window.electronAPI.log.info('Mise à jour temps réel dashboard:', type, data);

        // Rafraîchir certaines sections selon le type de mise à jour
        switch (type) {
            case 'client':
            case 'payment':
            case 'shipment':
            case 'container':
                // Rafraîchissement complet pour ces types
                this.loadDashboard(true);
                break;
            case 'stats':
                // Mise à jour partielle si seulement les stats changent
                this.renderStats(data);
                break;
        }
    }

    /**
     * Démarre le rafraîchissement automatique
     */
    startAutoRefresh() {
        // Arrêter l'intervalle existant s'il y en a un
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
        }

        // Démarrer un nouvel intervalle
        this.refreshInterval = setInterval(async () => {
            if (!document.hidden) { // Ne rafraîchir que si la page est visible
                window.electronAPI.log.debug('Rafraîchissement automatique du dashboard');
                await this.loadDashboard();
            }
        }, this.REFRESH_INTERVAL);
    }

    /**
     * Met à jour l'horloge en temps réel
     */
    updateClock() {
        const updateTime = () => {
            const now = new Date();
            const timeElement = document.getElementById('current-time');
            if (timeElement) timeElement.textContent = now.toLocaleTimeString('fr-FR');
            const dateElement = document.getElementById('current-date');
            if (dateElement) dateElement.textContent = now.toLocaleDateString('fr-FR', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
        };

        updateTime();
        setInterval(updateTime, 1000);
    }

    /**
     * Exporte un rapport du dashboard
     */
    async exportDashboardReport() {
        try {
            const format = await Swal.fire({
                title: 'Format du rapport',
                input: 'select',
                inputOptions: {
                    'pdf': 'PDF',
                    'excel': 'Excel'
                },
                inputPlaceholder: 'Sélectionnez un format',
                showCancelButton: true
            });

            if (!format.isConfirmed) return;

            this.showLoading('Génération du rapport...');

            await window.API.rapports.exportPDF('dashboard', {
                period: document.getElementById('period-filter')?.value,
                data: this.dashboardData
            });

            this.hideLoader();
            this.showSuccess('Rapport généré', 'Le rapport a été téléchargé');
        } catch (error) {
            this.hideLoader();
            window.electronAPI.log.error('Erreur export rapport:', error);
            this.showError('Erreur', 'Impossible de générer le rapport');
        }
    }

    /**
     * Utilise des données de démonstration en cas d'erreur
     */
    useDemoData() {
        const demoStats = {
            clients: {
                total: 156,
                nouveaux: 8
            },
            conteneurs: {
                total: 4
            },
            finances: {
                total_paye: 45780,
                total_facture: 60000
            },
            clientsTrend: 5.2,
            revenueTrend: -2.1,
            shipmentsTrend: 0
        };

        this.renderStats(demoStats);

        // Graphiques de démo
        this.updateCharts({
            revenue: {
                labels: ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin'],
                values: [32000, 35000, 33000, 38000, 42000, 45780]
            },
            shipments: {
                labels: ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'],
                values: [12, 15, 18, 14, 20, 8, 3]
            },
            destinations: {
                labels: ['France', 'Maroc', 'Algérie', 'Sénégal', 'Autres'],
                values: [35, 25, 20, 15, 5]
            }
        });

        // Données de démonstration pour les tableaux
        const demoClients = Array(5).fill(0).map((_, i) => ({
            id: i + 1,
            code_client: `CLI${1000 + i}`,
            nom: `Client${i+1}`,
            prenom: `Prenom${i+1}`,
            telephone_principal: `061234567${i}`,
            statut: 'actif'
        }));

        const demoShipments = Array(10).fill(0).map((_, i) => ({
            code_barre: `SHIP${1000 + i}`,
            client_nom: `Client${(i%3)+1}`,
            designation: `Colis ${i+1}`,
            statut: i%2 === 0 ? 'livré' : 'en transit',
            date_reception: new Date(Date.now() - i*86400000).toISOString()
        }));

        this.displayRecentClients(demoClients);
        this.displayRecentShipments(demoShipments);
    }

    /**
     * Anime un compteur de statistiques
     * @param {string} selector - Sélecteur CSS de l'élément
     * @param {number} endValue - Valeur finale
     * @param {boolean} isCurrency - Si la valeur est une devise
     */
    animateCounter(selector, endValue, isCurrency = false) {
        const element = document.querySelector(selector);
        if (!element) return;

        const startValue = parseInt(element.textContent.replace(/\D/g, '')) || 0;
        const duration = 1000;
        const stepTime = 50;
        const steps = duration / stepTime;
        const increment = (endValue - startValue) / steps;
        let currentValue = startValue;

        const timer = setInterval(() => {
            currentValue += increment;
            if ((increment > 0 && currentValue >= endValue) ||
                (increment < 0 && currentValue <= endValue)) {
                currentValue = endValue;
                clearInterval(timer);
            }
            const displayValue = isCurrency ?
                this.formatCurrency(Math.round(currentValue)) :
                Math.round(currentValue);
            element.textContent = displayValue;
        }, stepTime);
    }

    /**
     * Met à jour un indicateur de tendance
     * @param {string} selector - Sélecteur CSS de l'élément
     * @param {number} trend - Valeur de la tendance
     */
    updateTrendIndicator(selector, trend) {
        const element = document.querySelector(selector);
        if (!element) return;

        element.className = ''; // Reset des classes
        element.classList.add('text-muted'); // Classe par défaut

        if (trend > 0) {
            element.innerHTML = `<i class="fas fa-arrow-up"></i> +${trend}%`;
            element.classList.remove('text-muted');
            element.classList.add('text-success');
        } else if (trend < 0) {
            element.innerHTML = `<i class="fas fa-arrow-down"></i> ${trend}%`;
            element.classList.remove('text-muted');
            element.classList.add('text-danger');
        } else {
            element.innerHTML = `<i class="fas fa-minus"></i> 0%`;
            element.classList.remove('text-muted');
            element.classList.add('text-warning');
        }
    }

    /**
     * Met à jour l'heure de la dernière mise à jour
     */
    updateLastRefreshTime() {
        const element = document.getElementById('last-update-time');
        if (element && this.lastUpdate) {
            element.textContent = `Dernière mise à jour : ${this.lastUpdate.toLocaleTimeString('fr-FR')}`;
        }
    }

    /**
     * Met à jour le badge de notification
     * @param {number} count - Nombre de notifications non lues
     */
    updateNotificationBadge(count) {
        const badge = document.querySelector('.notification-badge');
        if (badge) {
            badge.textContent = count;
            badge.style.display = count > 0 ? 'block' : 'none';
        }
    }

    /**
     * Affiche un indicateur de chargement
     * @param {string} message - Message à afficher
     */
    showLoading(message = 'Chargement...') {
        const loader = document.createElement('div');
        loader.className = 'loader-overlay';
        loader.innerHTML = `
            <div class="loader-content">
                <div class="spinner-border text-primary" role="status">
                    <span class="visually-hidden">Chargement...</span>
                </div>
                <p>${message}</p>
            </div>
        `;
        document.body.appendChild(loader);
    }

    /**
     * Masque l'indicateur de chargement
     */
    hideLoader() {
        const loader = document.querySelector('.loader-overlay');
        if (loader) loader.remove();
    }

    /**
     * Affiche une notification toast
     * @param {string} message - Message à afficher
     * @param {string} type - Type de notification (success, error, info)
     */
    showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast show position-fixed top-0 end-0 m-3 alert alert-${type}`;
        toast.role = 'alert';
        toast.innerHTML = message;
        document.body.appendChild(toast);
        setTimeout(() => {
            toast.remove();
        }, 3000);
    }

    /**
     * Affiche une alerte de succès
     * @param {string} title - Titre de l'alerte
     * @param {string} message - Message de l'alerte
     */
    showSuccess(title, message) {
        Swal.fire({
            icon: 'success',
            title: title,
            text: message,
            confirmButtonText: 'OK'
        });
    }

    /**
     * Affiche une alerte d'erreur
     * @param {string} title - Titre de l'alerte
     * @param {string} message - Message de l'alerte
     */
    showError(title, message) {
        if (typeof title === 'string' && message === undefined) {
            // Si un seul argument est fourni, c'est le message et on utilise un titre par défaut
            Swal.fire({
                icon: 'error',
                title: 'Erreur',
                text: title,
                confirmButtonText: 'OK'
            });
        } else {
            // Sinon, utiliser les deux paramètres
            Swal.fire({
                icon: 'error',
                title: title,
                text: message,
                confirmButtonText: 'OK'
            });
        }
    }

    /**
     * Formate une valeur monétaire
     * @param {number} value - Valeur à formater
     * @returns {string} Valeur formatée
     */
    formatCurrency(value) {
        return new Intl.NumberFormat('fr-FR', {
            style: 'currency',
            currency: 'EUR'
        }).format(value);
    }

    /**
     * Formate une date
     * @param {string|Date} dateString - Date à formater
     * @param {string} format - Format de sortie (long ou short)
     * @returns {string} Date formatée
     */
    formatDate(dateString, format = 'long') {
        const date = new Date(dateString);
        if (format === 'short') {
            return date.toLocaleDateString('fr-FR');
        } else {
            return date.toLocaleDateString('fr-FR', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
        }
    }

    /**
     * Calcule le taux de remplissage
     * @param {number} usedVolume - Volume utilisé
     * @param {number} totalCapacity - Capacité totale
     * @returns {number} Taux de remplissage en pourcentage
     */
    calculateFillingRate(usedVolume, totalCapacity) {
        if (!totalCapacity || totalCapacity === 0) return 0;
        return Math.round((usedVolume / totalCapacity) * 100);
    }

    /**
     * Nettoyage lors de la destruction du module
     */
    destroy() {
        // Arrêter le rafraîchissement automatique
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
        }

        // Nettoyer les timeouts
        if (this.updateTimeout) {
            clearTimeout(this.updateTimeout);
            this.updateTimeout = null;
        }

        // Détruire les graphiques
        Object.values(this.charts).forEach(chart => {
            if (chart) chart.destroy();
        });
        this.charts = {};

        // Retirer les listeners WebSocket
        if (window.socket) {
            window.socket.off('dashboard:update');
            window.socket.off('nouvelle_marchandise');
        }
    }
}

// Instanciation et export du module
window.dashboardModule = new DashboardModule();

// Fonction d'initialisation pour maintenir la compatibilité
export async function init() {
    await window.dashboardModule.init();
}

// Fonction de nettoyage pour maintenir la compatibilité
export function cleanup() {
    window.dashboardModule.destroy();
}

// Fonction pour gérer les mises à jour temps réel (compatibilité)
export function handleRealtimeUpdate(type, data) {
    window.dashboardModule.handleRealtimeUpdate(type, data);
}

// API publique du module (compatibilité)
window.dashboardModule = {
    viewClient: (id) => {
        window.location.hash = '#clients';
        setTimeout(() => window.clientsModule?.viewClient(id), 500);
    },
    viewContainer: (id) => {
        window.location.hash = '#conteneurs';
        setTimeout(() => window.conteneursModule?.viewContainer(id), 500);
    },
    instance: window.dashboardModule // Accès à l'instance complète si nécessaire
};
