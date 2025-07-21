/**
 * Module de génération de rapports et statistiques
 * Gère les tableaux de bord, graphiques et exports de données
 */

// Variables du module
let chartsInitialized = false;
let currentPeriod = 'month';
let chartInstances = {};
let reportData = null;

// =============================================
// INITIALISATION DU MODULE
// =============================================

export async function init() {
    window.electronAPI.log.info('Initialisation du module Rapports');
    
    try {
        // Charger les données initiales
        await loadDashboardData();
        
        // Initialiser l'interface
        initializeUI();
        
        // Initialiser les graphiques
        initializeCharts();
        
        // Initialiser les gestionnaires d'événements
        initializeEventHandlers();
        
        // Charger les statistiques
        await updateStatistics();
        
    } catch (error) {
        window.electronAPI.log.error('Erreur initialisation module rapports:', error);
        Helpers.showError('Erreur', 'Impossible de charger le module rapports');
    }
}

// =============================================
// INTERFACE UTILISATEUR
// =============================================

function initializeUI() {
    const content = `
        <div class="container-fluid">
            <!-- En-tête avec sélection période -->
            <div class="row mb-4">
                <div class="col-12">
                    <div class="d-flex justify-content-between align-items-center">
                        <h4 class="mb-0">Rapports et Statistiques</h4>
                        <div class="d-flex gap-2">
                            <select class="form-select" id="period-selector" style="width: 200px;">
                                <option value="today">Aujourd'hui</option>
                                <option value="week">Cette semaine</option>
                                <option value="month" selected>Ce mois</option>
                                <option value="quarter">Ce trimestre</option>
                                <option value="year">Cette année</option>
                                <option value="custom">Personnalisé</option>
                            </select>
                            <button class="btn btn-primary" id="btn-export-report">
                                <i class="fas fa-download"></i> Exporter
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Cartes statistiques -->
            <div class="row mb-4">
                <div class="col-md-3">
                    <div class="stat-card bg-primary text-white">
                        <div class="stat-card-body">
                            <div class="stat-icon">
                                <i class="fas fa-users"></i>
                            </div>
                            <div class="stat-details">
                                <h3 id="stat-clients">0</h3>
                                <p>Clients actifs</p>
                                <small><span id="stat-clients-new">0</span> nouveaux</small>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="col-md-3">
                    <div class="stat-card bg-warning text-white">
                        <div class="stat-card-body">
                            <div class="stat-icon">
                                <i class="fas fa-box"></i>
                            </div>
                            <div class="stat-details">
                                <h3 id="stat-marchandises">0</h3>
                                <p>Marchandises</p>
                                <small><span id="stat-marchandises-pending">0</span> en attente</small>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="col-md-3">
                    <div class="stat-card bg-success text-white">
                        <div class="stat-card-body">
                            <div class="stat-icon">
                                <i class="fas fa-cube"></i>
                            </div>
                            <div class="stat-details">
                                <h3 id="stat-conteneurs">0</h3>
                                <p>Conteneurs</p>
                                <small><span id="stat-conteneurs-shipped">0</span> expédiés</small>
                            </div>
                        </div>
                    </div>
                </div>
                
                <div class="col-md-3">
                    <div class="stat-card bg-info text-white">
                        <div class="stat-card-body">
                            <div class="stat-icon">
                                <i class="fas fa-euro-sign"></i>
                            </div>
                            <div class="stat-details">
                                <h3 id="stat-revenue">0 €</h3>
                                <p>Chiffre d'affaires</p>
                                <small><span id="stat-revenue-growth">0%</span> croissance</small>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Graphiques principaux -->
            <div class="row mb-4">
                <!-- Évolution du CA -->
                <div class="col-lg-8">
                    <div class="card">
                        <div class="card-header d-flex justify-content-between align-items-center">
                            <h5 class="mb-0">Évolution du Chiffre d'Affaires</h5>
                            <div class="btn-group btn-group-sm" role="group">
                                <button type="button" class="btn btn-outline-secondary active" data-chart-type="line">
                                    <i class="fas fa-chart-line"></i>
                                </button>
                                <button type="button" class="btn btn-outline-secondary" data-chart-type="bar">
                                    <i class="fas fa-chart-bar"></i>
                                </button>
                            </div>
                        </div>
                        <div class="card-body">
                            <canvas id="revenue-chart" height="300"></canvas>
                        </div>
                    </div>
                </div>
                
                <!-- Répartition par type -->
                <div class="col-lg-4">
                    <div class="card">
                        <div class="card-header">
                            <h5 class="mb-0">Répartition par Type d'Envoi</h5>
                        </div>
                        <div class="card-body">
                            <canvas id="shipment-type-chart" height="300"></canvas>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Tableaux détaillés -->
            <div class="row">
                <!-- Top clients -->
                <div class="col-lg-6">
                    <div class="card">
                        <div class="card-header">
                            <h5 class="mb-0">Top 10 Clients</h5>
                        </div>
                        <div class="card-body">
                            <div class="table-responsive">
                                <table class="table table-sm">
                                    <thead>
                                        <tr>
                                            <th>Client</th>
                                            <th>Nombre d'envois</th>
                                            <th>CA généré</th>
                                        </tr>
                                    </thead>
                                    <tbody id="top-clients-table">
                                        <tr>
                                            <td colspan="3" class="text-center">
                                                <i class="fas fa-spinner fa-spin"></i> Chargement...
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- Destinations populaires -->
                <div class="col-lg-6">
                    <div class="card">
                        <div class="card-header">
                            <h5 class="mb-0">Destinations Populaires</h5>
                        </div>
                        <div class="card-body">
                            <canvas id="destinations-chart" height="250"></canvas>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Rapports avancés -->
            <div class="row mt-4">
                <div class="col-12">
                    <div class="card">
                        <div class="card-header">
                            <h5 class="mb-0">Rapports Avancés</h5>
                        </div>
                        <div class="card-body">
                            <div class="row">
                                <div class="col-md-3">
                                    <div class="report-item" onclick="generateReport('financial')">
                                        <i class="fas fa-file-invoice-dollar fa-3x mb-3"></i>
                                        <h6>Rapport Financier</h6>
                                        <p class="text-muted small">Analyse détaillée des revenus et paiements</p>
                                    </div>
                                </div>
                                <div class="col-md-3">
                                    <div class="report-item" onclick="generateReport('inventory')">
                                        <i class="fas fa-warehouse fa-3x mb-3"></i>
                                        <h6>État des Stocks</h6>
                                        <p class="text-muted small">Marchandises en attente et conteneurs actifs</p>
                                    </div>
                                </div>
                                <div class="col-md-3">
                                    <div class="report-item" onclick="generateReport('performance')">
                                        <i class="fas fa-chart-pie fa-3x mb-3"></i>
                                        <h6>Performance</h6>
                                        <p class="text-muted small">KPIs et métriques de performance</p>
                                    </div>
                                </div>
                                <div class="col-md-3">
                                    <div class="report-item" onclick="generateReport('custom')">
                                        <i class="fas fa-cog fa-3x mb-3"></i>
                                        <h6>Personnalisé</h6>
                                        <p class="text-muted small">Créer un rapport sur mesure</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    document.getElementById('main-content').innerHTML = content;
}

// =============================================
// CHARGEMENT DES DONNÉES
// =============================================

async function loadDashboardData() {
    try {
        const response = await API.rapports.dashboard(currentPeriod);
        reportData = response;
        return reportData;
    } catch (error) {
        window.electronAPI.log.error('Erreur chargement données dashboard:', error);
        throw error;
    }
}

async function updateStatistics() {
    if (!reportData) return;
    
    try {
        // Mettre à jour les cartes statistiques
        document.getElementById('stat-clients').textContent = 
            reportData.stats.clients.total.toLocaleString('fr-FR');
        document.getElementById('stat-clients-new').textContent = 
            reportData.stats.clients.new.toLocaleString('fr-FR');
        
        document.getElementById('stat-marchandises').textContent = 
            reportData.stats.marchandises.total.toLocaleString('fr-FR');
        document.getElementById('stat-marchandises-pending').textContent = 
            reportData.stats.marchandises.pending.toLocaleString('fr-FR');
        
        document.getElementById('stat-conteneurs').textContent = 
            reportData.stats.conteneurs.total.toLocaleString('fr-FR');
        document.getElementById('stat-conteneurs-shipped').textContent = 
            reportData.stats.conteneurs.shipped.toLocaleString('fr-FR');
        
        document.getElementById('stat-revenue').textContent = 
            formatCurrency(reportData.stats.revenue.total);
        document.getElementById('stat-revenue-growth').textContent = 
            `${reportData.stats.revenue.growth > 0 ? '+' : ''}${reportData.stats.revenue.growth}%`;
        
        // Mettre à jour le tableau des top clients
        updateTopClientsTable(reportData.topClients);
        
    } catch (error) {
        window.electronAPI.log.error('Erreur mise à jour statistiques:', error);
    }
}

// =============================================
// GRAPHIQUES
// =============================================

function initializeCharts() {
    if (!reportData) return;
    
    // Configuration par défaut Chart.js
    Chart.defaults.font.family = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto';
    Chart.defaults.color = '#666';
    
    // Graphique évolution CA
    initializeRevenueChart();
    
    // Graphique types d'envoi
    initializeShipmentTypeChart();
    
    // Graphique destinations
    initializeDestinationsChart();
    
    chartsInitialized = true;
}

function initializeRevenueChart() {
    const ctx = document.getElementById('revenue-chart').getContext('2d');
    
    const gradient = ctx.createLinearGradient(0, 0, 0, 300);
    gradient.addColorStop(0, 'rgba(59, 130, 246, 0.2)');
    gradient.addColorStop(1, 'rgba(59, 130, 246, 0)');
    
    chartInstances.revenue = new Chart(ctx, {
        type: 'line',
        data: {
            labels: reportData.revenue.labels,
            datasets: [{
                label: 'Chiffre d\'affaires',
                data: reportData.revenue.values,
                borderColor: '#3b82f6',
                backgroundColor: gradient,
                borderWidth: 2,
                fill: true,
                tension: 0.3,
                pointRadius: 4,
                pointHoverRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: (context) => {
                            return 'CA: ' + formatCurrency(context.parsed.y);
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: (value) => formatCurrency(value, true)
                    }
                }
            }
        }
    });
}

function initializeShipmentTypeChart() {
    const ctx = document.getElementById('shipment-type-chart').getContext('2d');
    
    chartInstances.shipmentType = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: reportData.shipmentTypes.labels,
            datasets: [{
                data: reportData.shipmentTypes.values,
                backgroundColor: [
                    '#3b82f6',
                    '#10b981',
                    '#f59e0b',
                    '#ef4444',
                    '#8b5cf6'
                ],
                borderWidth: 2,
                borderColor: '#fff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        padding: 15,
                        usePointStyle: true
                    }
                },
                tooltip: {
                    callbacks: {
                        label: (context) => {
                            const label = context.label || '';
                            const value = context.parsed;
                            const percentage = ((value / context.dataset.data.reduce((a, b) => a + b, 0)) * 100).toFixed(1);
                            return `${label}: ${value} (${percentage}%)`;
                        }
                    }
                }
            }
        }
    });
}

function initializeDestinationsChart() {
    const ctx = document.getElementById('destinations-chart').getContext('2d');
    
    chartInstances.destinations = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: reportData.destinations.labels.slice(0, 10),
            datasets: [{
                label: 'Nombre d\'envois',
                data: reportData.destinations.values.slice(0, 10),
                backgroundColor: '#3b82f6',
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            indexAxis: 'y',
            plugins: {
                legend: {
                    display: false
                }
            },
            scales: {
                x: {
                    beginAtZero: true,
                    ticks: {
                        precision: 0
                    }
                }
            }
        }
    });
}

// =============================================
// TABLEAUX
// =============================================

function updateTopClientsTable(clients) {
    const tbody = document.getElementById('top-clients-table');
    
    if (!clients || clients.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="3" class="text-center text-muted">
                    Aucune donnée disponible
                </td>
            </tr>
        `;
        return;
    }
    
    tbody.innerHTML = clients.slice(0, 10).map(client => `
        <tr>
            <td>
                <a href="#clients?id=${client.id}" class="text-decoration-none">
                    ${client.nom} ${client.prenom}
                </a>
            </td>
            <td class="text-center">${client.shipment_count}</td>
            <td class="text-end">${formatCurrency(client.total_revenue)}</td>
        </tr>
    `).join('');
}

// =============================================
// GÉNÉRATION DE RAPPORTS
// =============================================

window.generateReport = async (type) => {
    try {
        showLoader(`Génération du rapport ${type}...`);
        
        let report;
        switch (type) {
            case 'financial':
                report = await generateFinancialReport();
                break;
                
            case 'inventory':
                report = await generateInventoryReport();
                break;
                
            case 'performance':
                report = await generatePerformanceReport();
                break;
                
            case 'custom':
                await showCustomReportDialog();
                hideLoader();
                return;
                
            default:
                throw new Error('Type de rapport invalide');
        }
        
        // Télécharger le rapport
        await downloadReport(report);
        
        hideLoader();
        Helpers.showSuccess('Succès', 'Rapport généré avec succès');
        
    } catch (error) {
        hideLoader();
        window.electronAPI.log.error('Erreur génération rapport:', error);
        Helpers.showError('Erreur', 'Impossible de générer le rapport');
    }
};

async function generateFinancialReport() {
    const data = await API.rapports.financial({
        period: currentPeriod,
        detailed: true
    });
    
    return {
        type: 'financial',
        filename: `rapport_financier_${currentPeriod}_${Date.now()}.pdf`,
        data
    };
}

async function generateInventoryReport() {
    const data = await API.rapports.inventory({
        includeHistory: true
    });
    
    return {
        type: 'inventory',
        filename: `etat_stocks_${Date.now()}.pdf`,
        data
    };
}

async function generatePerformanceReport() {
    const data = await API.rapports.performance({
        period: currentPeriod,
        metrics: ['efficiency', 'growth', 'satisfaction']
    });
    
    return {
        type: 'performance',
        filename: `rapport_performance_${currentPeriod}_${Date.now()}.pdf`,
        data
    };
}

async function showCustomReportDialog() {
    const { value: formValues } = await Swal.fire({
        title: 'Rapport Personnalisé',
        html: `
            <div class="text-start">
                <div class="mb-3">
                    <label class="form-label">Type de données</label>
                    <select class="form-select" id="swal-data-type">
                        <option value="all">Toutes les données</option>
                        <option value="clients">Clients uniquement</option>
                        <option value="marchandises">Marchandises uniquement</option>
                        <option value="conteneurs">Conteneurs uniquement</option>
                        <option value="finances">Données financières</option>
                    </select>
                </div>
                <div class="mb-3">
                    <label class="form-label">Période</label>
                    <div class="row">
                        <div class="col">
                            <input type="date" class="form-control" id="swal-date-start">
                        </div>
                        <div class="col">
                            <input type="date" class="form-control" id="swal-date-end">
                        </div>
                    </div>
                </div>
                <div class="mb-3">
                    <label class="form-label">Format d'export</label>
                    <select class="form-select" id="swal-format">
                        <option value="pdf">PDF</option>
                        <option value="excel">Excel</option>
                        <option value="csv">CSV</option>
                    </select>
                </div>
            </div>
        `,
        focusConfirm: false,
        showCancelButton: true,
        confirmButtonText: 'Générer',
        cancelButtonText: 'Annuler',
        preConfirm: () => {
            return {
                dataType: document.getElementById('swal-data-type').value,
                dateStart: document.getElementById('swal-date-start').value,
                dateEnd: document.getElementById('swal-date-end').value,
                format: document.getElementById('swal-format').value
            };
        }
    });
    
    if (formValues) {
        await generateCustomReport(formValues);
    }
}

async function generateCustomReport(params) {
    showLoader('Génération du rapport personnalisé...');
    
    try {
        const report = await API.rapports.custom(params);
        await downloadReport(report);
        
        hideLoader();
        Helpers.showSuccess('Succès', 'Rapport personnalisé généré');
        
    } catch (error) {
        hideLoader();
        throw error;
    }
}

// =============================================
// EXPORT ET TÉLÉCHARGEMENT
// =============================================

async function downloadReport(report) {
    try {
        const response = await API.download(report.filename);
        
        // Créer un lien de téléchargement
        const blob = new Blob([response], { type: 'application/pdf' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = report.filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
        
    } catch (error) {
        window.electronAPI.log.error('Erreur téléchargement rapport:', error);
        throw error;
    }
}

async function exportCurrentView() {
    const format = await Swal.fire({
        title: 'Format d\'export',
        input: 'select',
        inputOptions: {
            'pdf': 'PDF',
            'excel': 'Excel',
            'png': 'Image PNG'
        },
        inputPlaceholder: 'Sélectionnez un format',
        showCancelButton: true,
        confirmButtonText: 'Exporter',
        cancelButtonText: 'Annuler'
    });
    
    if (format.value) {
        try {
            showLoader('Export en cours...');
            
            const exportData = {
                period: currentPeriod,
                stats: reportData.stats,
                charts: captureChartsAsImages(),
                format: format.value
            };
            
            const result = await API.rapports.export(exportData);
            await downloadReport(result);
            
            hideLoader();
            Helpers.showSuccess('Succès', 'Export réussi');
            
        } catch (error) {
            hideLoader();
            window.electronAPI.log.error('Erreur export:', error);
            Helpers.showError('Erreur', 'Impossible d\'exporter les données');
        }
    }
}

function captureChartsAsImages() {
    const images = {};
    
    Object.entries(chartInstances).forEach(([name, chart]) => {
        images[name] = chart.toBase64Image();
    });
    
    return images;
}

// =============================================
// UTILITAIRES
// =============================================

function formatCurrency(amount, short = false) {
    if (short && amount >= 1000000) {
        return (amount / 1000000).toFixed(1) + 'M €';
    } else if (short && amount >= 1000) {
        return (amount / 1000).toFixed(1) + 'K €';
    }
    
    return new Intl.NumberFormat('fr-FR', {
        style: 'currency',
        currency: 'EUR'
    }).format(amount);
}

// =============================================
// GESTIONNAIRES D'ÉVÉNEMENTS
// =============================================

function initializeEventHandlers() {
    // Sélecteur de période
    document.getElementById('period-selector').addEventListener('change', async (e) => {
        currentPeriod = e.target.value;
        
        if (currentPeriod === 'custom') {
            await showCustomPeriodDialog();
        } else {
            await reloadData();
        }
    });
    
    // Bouton export
    document.getElementById('btn-export-report').addEventListener('click', exportCurrentView);
    
    // Changement type de graphique
    document.querySelectorAll('[data-chart-type]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const type = e.currentTarget.dataset.chartType;
            changeRevenueChartType(type);
            
            // Mettre à jour l'état actif
            document.querySelectorAll('[data-chart-type]').forEach(b => {
                b.classList.remove('active');
            });
            e.currentTarget.classList.add('active');
        });
    });
}

async function showCustomPeriodDialog() {
    const { value: dates } = await Swal.fire({
        title: 'Période personnalisée',
        html: `
            <div class="row">
                <div class="col">
                    <label class="form-label">Date début</label>
                    <input type="date" class="form-control" id="custom-date-start">
                </div>
                <div class="col">
                    <label class="form-label">Date fin</label>
                    <input type="date" class="form-control" id="custom-date-end">
                </div>
            </div>
        `,
        showCancelButton: true,
        confirmButtonText: 'Valider',
        cancelButtonText: 'Annuler',
        preConfirm: () => {
            const start = document.getElementById('custom-date-start').value;
            const end = document.getElementById('custom-date-end').value;
            
            if (!start || !end) {
                Swal.showValidationMessage('Veuillez sélectionner les deux dates');
            }
            
            return { start, end };
        }
    });
    
    if (dates) {
        currentPeriod = {
            type: 'custom',
            start: dates.start,
            end: dates.end
        };
        await reloadData();
    } else {
        // Revenir à la période précédente
        document.getElementById('period-selector').value = 'month';
        currentPeriod = 'month';
    }
}

async function reloadData() {
    try {
        showLoader('Chargement des données...');
        
        await loadDashboardData();
        await updateStatistics();
        updateCharts();
        
        hideLoader();
        
    } catch (error) {
        hideLoader();
        window.electronAPI.log.error('Erreur rechargement données:', error);
        Helpers.showError('Erreur', 'Impossible de recharger les données');
    }
}

function updateCharts() {
    if (!chartsInitialized || !reportData) return;
    
    // Mettre à jour les données des graphiques
    chartInstances.revenue.data.labels = reportData.revenue.labels;
    chartInstances.revenue.data.datasets[0].data = reportData.revenue.values;
    chartInstances.revenue.update();
    
    chartInstances.shipmentType.data.labels = reportData.shipmentTypes.labels;
    chartInstances.shipmentType.data.datasets[0].data = reportData.shipmentTypes.values;
    chartInstances.shipmentType.update();
    
    chartInstances.destinations.data.labels = reportData.destinations.labels.slice(0, 10);
    chartInstances.destinations.data.datasets[0].data = reportData.destinations.values.slice(0, 10);
    chartInstances.destinations.update();
}

function changeRevenueChartType(type) {
    if (!chartInstances.revenue) return;
    
    chartInstances.revenue.config.type = type;
    
    if (type === 'bar') {
        chartInstances.revenue.config.options.scales.y.beginAtZero = true;
        chartInstances.revenue.data.datasets[0].backgroundColor = '#3b82f6';
        chartInstances.revenue.data.datasets[0].borderRadius = 4;
    } else {
        const ctx = chartInstances.revenue.ctx;
        const gradient = ctx.createLinearGradient(0, 0, 0, 300);
        gradient.addColorStop(0, 'rgba(59, 130, 246, 0.2)');
        gradient.addColorStop(1, 'rgba(59, 130, 246, 0)');
        chartInstances.revenue.data.datasets[0].backgroundColor = gradient;
    }
    
    chartInstances.revenue.update();
}

// =============================================
// GESTION TEMPS RÉEL
// =============================================

export function handleRealtimeUpdate(type, data) {
    // Recharger les données si nécessaire
    if (['paiement', 'conteneur', 'marchandise'].includes(type)) {
        // Attendre un peu pour regrouper les mises à jour
        clearTimeout(window.reloadTimeout);
        window.reloadTimeout = setTimeout(() => {
            reloadData();
        }, 2000);
    }
}

// =============================================
// NETTOYAGE
// =============================================

export function cleanup() {
    // Détruire les graphiques
    Object.values(chartInstances).forEach(chart => {
        if (chart) {
            chart.destroy();
        }
    });
    
    chartInstances = {};
    chartsInitialized = false;
    
    window.electronAPI.log.info('Module Rapports nettoyé');
}