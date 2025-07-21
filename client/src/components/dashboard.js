/**
 * Composant Dashboard
 * Widgets et cartes pour le tableau de bord principal
 */

class DashboardWidget {
    constructor(options = {}) {
        this.options = {
            type: 'stat', // stat, chart, list, activity
            title: '',
            icon: null,
            color: 'primary',
            value: 0,
            subtitle: '',
            footer: null,
            refreshInterval: null,
            onRefresh: null,
            onClick: null,
            ...options
        };
        
        this.container = null;
        this.refreshTimer = null;
        this.chart = null;
    }
    
    // =============================================
    // INITIALISATION
    // =============================================
    
    init(containerId) {
        this.container = document.getElementById(containerId);
        if (!this.container) {
            console.error('Container non trouvé:', containerId);
            return;
        }
        
        this.render();
        
        if (this.options.refreshInterval && this.options.onRefresh) {
            this.startAutoRefresh();
        }
        
        return this;
    }
    
    // =============================================
    // RENDU
    // =============================================
    
    render() {
        switch (this.options.type) {
            case 'stat':
                this.renderStatWidget();
                break;
            case 'chart':
                this.renderChartWidget();
                break;
            case 'list':
                this.renderListWidget();
                break;
            case 'activity':
                this.renderActivityWidget();
                break;
            case 'progress':
                this.renderProgressWidget();
                break;
            default:
                this.renderCustomWidget();
        }
        
        this.attachEvents();
    }
    
    renderStatWidget() {
        const html = `
            <div class="stat-card bg-${this.options.color} text-white ${this.options.onClick ? 'clickable' : ''}">
                <div class="stat-card-body">
                    ${this.options.icon ? `
                        <div class="stat-icon">
                            <i class="${this.options.icon}"></i>
                        </div>
                    ` : ''}
                    <div class="stat-details">
                        <h3 class="stat-value">${this.formatValue(this.options.value)}</h3>
                        <p class="stat-title">${this.options.title}</p>
                        ${this.options.subtitle ? `
                            <small class="stat-subtitle">${this.options.subtitle}</small>
                        ` : ''}
                    </div>
                </div>
                ${this.options.footer ? `
                    <div class="stat-card-footer">
                        ${this.options.footer}
                    </div>
                ` : ''}
            </div>
        `;
        
        this.container.innerHTML = html;
    }
    
    renderChartWidget() {
        const html = `
            <div class="card widget-card">
                <div class="card-header d-flex justify-content-between align-items-center">
                    <h5 class="mb-0">
                        ${this.options.icon ? `<i class="${this.options.icon} me-2"></i>` : ''}
                        ${this.options.title}
                    </h5>
                    <div class="widget-actions">
                        ${this.options.onRefresh ? `
                            <button class="btn btn-sm btn-link text-muted" data-action="refresh">
                                <i class="fas fa-sync-alt"></i>
                            </button>
                        ` : ''}
                    </div>
                </div>
                <div class="card-body">
                    <canvas id="${this.generateId('chart')}" height="${this.options.height || 200}"></canvas>
                </div>
                ${this.options.footer ? `
                    <div class="card-footer">
                        ${this.options.footer}
                    </div>
                ` : ''}
            </div>
        `;
        
        this.container.innerHTML = html;
        
        // Initialiser le graphique après le rendu
        setTimeout(() => {
            this.initChart();
        }, 100);
    }
    
    renderListWidget() {
        const html = `
            <div class="card widget-card">
                <div class="card-header d-flex justify-content-between align-items-center">
                    <h5 class="mb-0">
                        ${this.options.icon ? `<i class="${this.options.icon} me-2"></i>` : ''}
                        ${this.options.title}
                    </h5>
                    <div class="widget-actions">
                        ${this.options.viewAll ? `
                            <a href="${this.options.viewAll}" class="btn btn-sm btn-link">
                                Voir tout
                            </a>
                        ` : ''}
                    </div>
                </div>
                <div class="card-body p-0">
                    <div class="list-group list-group-flush" id="${this.generateId('list')}">
                        ${this.renderListItems()}
                    </div>
                </div>
                ${this.options.footer ? `
                    <div class="card-footer">
                        ${this.options.footer}
                    </div>
                ` : ''}
            </div>
        `;
        
        this.container.innerHTML = html;
    }
    
    renderActivityWidget() {
        const html = `
            <div class="card widget-card">
                <div class="card-header">
                    <h5 class="mb-0">
                        ${this.options.icon ? `<i class="${this.options.icon} me-2"></i>` : ''}
                        ${this.options.title}
                    </h5>
                </div>
                <div class="card-body">
                    <div class="activity-timeline" id="${this.generateId('activity')}">
                        ${this.renderActivityItems()}
                    </div>
                </div>
                ${this.options.footer ? `
                    <div class="card-footer">
                        ${this.options.footer}
                    </div>
                ` : ''}
            </div>
        `;
        
        this.container.innerHTML = html;
    }
    
    renderProgressWidget() {
        const progress = this.options.value;
        const html = `
            <div class="card widget-card">
                <div class="card-header">
                    <h5 class="mb-0">
                        ${this.options.icon ? `<i class="${this.options.icon} me-2"></i>` : ''}
                        ${this.options.title}
                    </h5>
                </div>
                <div class="card-body">
                    <div class="progress-wrapper">
                        <div class="d-flex justify-content-between mb-2">
                            <span>${this.options.subtitle || 'Progression'}</span>
                            <span class="text-${this.getProgressColor(progress)}">${progress}%</span>
                        </div>
                        <div class="progress" style="height: 10px;">
                            <div class="progress-bar bg-${this.getProgressColor(progress)}" 
                                 role="progressbar" 
                                 style="width: ${progress}%"
                                 aria-valuenow="${progress}" 
                                 aria-valuemin="0" 
                                 aria-valuemax="100">
                            </div>
                        </div>
                        ${this.options.details ? `
                            <div class="progress-details mt-3">
                                ${this.renderProgressDetails()}
                            </div>
                        ` : ''}
                    </div>
                </div>
            </div>
        `;
        
        this.container.innerHTML = html;
    }
    
    renderCustomWidget() {
        if (this.options.template) {
            this.container.innerHTML = this.options.template;
        } else {
            this.container.innerHTML = `
                <div class="card widget-card">
                    <div class="card-body">
                        <p class="text-muted">Widget personnalisé</p>
                    </div>
                </div>
            `;
        }
    }
    
    // =============================================
    // CONTENU SPÉCIFIQUE
    // =============================================
    
    renderListItems() {
        if (!this.options.items || this.options.items.length === 0) {
            return `
                <div class="list-group-item text-center text-muted py-4">
                    <i class="fas fa-inbox fa-2x mb-2"></i>
                    <p class="mb-0">Aucune donnée</p>
                </div>
            `;
        }
        
        return this.options.items.map(item => `
            <a href="${item.link || '#'}" class="list-group-item list-group-item-action">
                <div class="d-flex align-items-center">
                    ${item.icon ? `
                        <div class="flex-shrink-0 me-3">
                            <div class="widget-icon bg-${item.color || 'primary'} text-white">
                                <i class="${item.icon}"></i>
                            </div>
                        </div>
                    ` : ''}
                    <div class="flex-grow-1">
                        <h6 class="mb-1">${item.title}</h6>
                        ${item.subtitle ? `<p class="mb-0 text-muted small">${item.subtitle}</p>` : ''}
                    </div>
                    ${item.value !== undefined ? `
                        <div class="flex-shrink-0">
                            <span class="badge bg-${item.badgeColor || 'secondary'}">${item.value}</span>
                        </div>
                    ` : ''}
                </div>
            </a>
        `).join('');
    }
    
    renderActivityItems() {
        if (!this.options.activities || this.options.activities.length === 0) {
            return `
                <div class="text-center text-muted py-4">
                    <i class="fas fa-history fa-2x mb-2"></i>
                    <p class="mb-0">Aucune activité récente</p>
                </div>
            `;
        }
        
        return this.options.activities.map((activity, index) => `
            <div class="activity-item ${index === this.options.activities.length - 1 ? 'last' : ''}">
                <div class="activity-icon bg-${activity.color || 'primary'}">
                    <i class="${activity.icon || 'fas fa-circle'}"></i>
                </div>
                <div class="activity-content">
                    <div class="activity-header">
                        <strong>${activity.user}</strong> ${activity.action}
                    </div>
                    ${activity.details ? `
                        <div class="activity-details">${activity.details}</div>
                    ` : ''}
                    <div class="activity-time">
                        <i class="far fa-clock"></i> ${this.formatTime(activity.time)}
                    </div>
                </div>
            </div>
        `).join('');
    }
    
    renderProgressDetails() {
        return this.options.details.map(detail => `
            <div class="d-flex justify-content-between mb-2">
                <span class="text-muted">${detail.label}</span>
                <span>${detail.value}</span>
            </div>
        `).join('');
    }
    
    // =============================================
    // GRAPHIQUES
    // =============================================
    
    initChart() {
        const canvas = this.container.querySelector('canvas');
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        
        // Configuration par défaut selon le type de graphique
        const config = this.options.chartConfig || this.getDefaultChartConfig();
        
        this.chart = new Chart(ctx, config);
    }
    
    getDefaultChartConfig() {
        const type = this.options.chartType || 'line';
        
        const baseConfig = {
            type: type,
            data: this.options.data || {
                labels: [],
                datasets: []
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: this.options.showLegend !== false,
                        position: 'bottom'
                    }
                }
            }
        };
        
        // Configurations spécifiques par type
        if (type === 'doughnut' || type === 'pie') {
            baseConfig.options.plugins.legend.position = 'right';
        }
        
        return baseConfig;
    }
    
    updateChart(data) {
        if (!this.chart) return;
        
        this.chart.data = data;
        this.chart.update();
    }
    
    // =============================================
    // MISE À JOUR
    // =============================================
    
    async refresh() {
        if (!this.options.onRefresh) return;
        
        try {
            // Afficher un indicateur de chargement
            this.showLoading();
            
            const newData = await this.options.onRefresh();
            this.update(newData);
            
        } catch (error) {
            console.error('Erreur refresh widget:', error);
        } finally {
            this.hideLoading();
        }
    }
    
    update(data) {
        Object.assign(this.options, data);
        
        switch (this.options.type) {
            case 'stat':
                this.updateStatWidget();
                break;
            case 'chart':
                this.updateChart(data.data);
                break;
            case 'list':
                this.updateListWidget();
                break;
            case 'activity':
                this.updateActivityWidget();
                break;
            case 'progress':
                this.updateProgressWidget();
                break;
        }
    }
    
    updateStatWidget() {
        const valueEl = this.container.querySelector('.stat-value');
        const subtitleEl = this.container.querySelector('.stat-subtitle');
        
        if (valueEl) {
            valueEl.textContent = this.formatValue(this.options.value);
        }
        
        if (subtitleEl && this.options.subtitle) {
            subtitleEl.textContent = this.options.subtitle;
        }
    }
    
    updateListWidget() {
        const listEl = this.container.querySelector(`#${this.generateId('list')}`);
        if (listEl) {
            listEl.innerHTML = this.renderListItems();
        }
    }
    
    updateActivityWidget() {
        const activityEl = this.container.querySelector(`#${this.generateId('activity')}`);
        if (activityEl) {
            activityEl.innerHTML = this.renderActivityItems();
        }
    }
    
    updateProgressWidget() {
        const progressBar = this.container.querySelector('.progress-bar');
        const progressText = this.container.querySelector('.text-' + this.getProgressColor(this.options.value));
        
        if (progressBar) {
            progressBar.style.width = `${this.options.value}%`;
            progressBar.setAttribute('aria-valuenow', this.options.value);
            progressBar.className = `progress-bar bg-${this.getProgressColor(this.options.value)}`;
        }
        
        if (progressText) {
            progressText.textContent = `${this.options.value}%`;
        }
    }
    
    // =============================================
    // AUTO-REFRESH
    // =============================================
    
    startAutoRefresh() {
        this.stopAutoRefresh();
        
        this.refreshTimer = setInterval(() => {
            this.refresh();
        }, this.options.refreshInterval);
    }
    
    stopAutoRefresh() {
        if (this.refreshTimer) {
            clearInterval(this.refreshTimer);
            this.refreshTimer = null;
        }
    }
    
    // =============================================
    // ÉVÉNEMENTS
    // =============================================
    
    attachEvents() {
        // Click sur le widget
        if (this.options.onClick) {
            const clickable = this.container.querySelector('.clickable, .stat-card');
            if (clickable) {
                clickable.style.cursor = 'pointer';
                clickable.addEventListener('click', this.options.onClick);
            }
        }
        
        // Bouton refresh
        const refreshBtn = this.container.querySelector('[data-action="refresh"]');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.refresh();
            });
        }
    }
    
    // =============================================
    // UTILITAIRES
    // =============================================
    
    formatValue(value) {
        if (typeof value === 'number') {
            if (this.options.format === 'currency') {
                return new Intl.NumberFormat('fr-FR', {
                    style: 'currency',
                    currency: 'EUR'
                }).format(value);
            } else if (this.options.format === 'percent') {
                return value + '%';
            } else if (value >= 1000000) {
                return (value / 1000000).toFixed(1) + 'M';
            } else if (value >= 1000) {
                return (value / 1000).toFixed(1) + 'K';
            }
            return value.toLocaleString('fr-FR');
        }
        return value;
    }
    
    formatTime(time) {
        const date = new Date(time);
        const now = new Date();
        const diff = now - date;
        
        if (diff < 60000) {
            return 'À l\'instant';
        } else if (diff < 3600000) {
            return `Il y a ${Math.floor(diff / 60000)} min`;
        } else if (diff < 86400000) {
            return `Il y a ${Math.floor(diff / 3600000)} h`;
        } else {
            return date.toLocaleDateString('fr-FR');
        }
    }
    
    getProgressColor(value) {
        if (value >= 80) return 'success';
        if (value >= 60) return 'primary';
        if (value >= 40) return 'warning';
        return 'danger';
    }
    
    generateId(suffix) {
        return `widget-${Date.now()}-${suffix}`;
    }
    
    showLoading() {
        // Ajouter un overlay de chargement
        const overlay = document.createElement('div');
        overlay.className = 'widget-loading-overlay';
        overlay.innerHTML = '<div class="spinner-border spinner-border-sm" role="status"></div>';
        this.container.style.position = 'relative';
        this.container.appendChild(overlay);
    }
    
    hideLoading() {
        const overlay = this.container.querySelector('.widget-loading-overlay');
        if (overlay) {
            overlay.remove();
        }
    }
    
    // =============================================
    // API PUBLIQUE
    // =============================================
    
    destroy() {
        this.stopAutoRefresh();
        
        if (this.chart) {
            this.chart.destroy();
        }
        
        this.container.innerHTML = '';
    }
}

// =============================================
// GESTIONNAIRE DE DASHBOARD
// =============================================

class DashboardManager {
    constructor() {
        this.widgets = new Map();
        this.layout = null;
    }
    
    init(config) {
        this.layout = config.layout || 'default';
        
        // Créer les widgets selon la configuration
        config.widgets.forEach(widgetConfig => {
            this.addWidget(widgetConfig);
        });
        
        return this;
    }
    
    addWidget(config) {
        const widget = new DashboardWidget(config);
        widget.init(config.container);
        
        this.widgets.set(config.id || config.container, widget);
        
        return widget;
    }
    
    removeWidget(id) {
        const widget = this.widgets.get(id);
        if (widget) {
            widget.destroy();
            this.widgets.delete(id);
        }
    }
    
    getWidget(id) {
        return this.widgets.get(id);
    }
    
    refreshAll() {
        this.widgets.forEach(widget => {
            widget.refresh();
        });
    }
    
    destroy() {
        this.widgets.forEach(widget => {
            widget.destroy();
        });
        this.widgets.clear();
    }
}

// =============================================
// EXPORT
// =============================================

window.DashboardWidget = DashboardWidget;
window.DashboardManager = DashboardManager;