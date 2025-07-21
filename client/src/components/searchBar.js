/**
 * Composant SearchBar
 * Barre de recherche globale avec autocomplétion et recherche multi-entités
 */

class SearchBar {
    constructor(options = {}) {
        this.options = {
            placeholder: 'Rechercher clients, marchandises, conteneurs...',
            minLength: 2,
            delay: 300,
            maxResults: 10,
            showCategories: true,
            allowNavigation: true,
            onSelect: null,
            onSearch: null,
            ...options
        };
        
        this.container = null;
        this.input = null;
        this.resultsContainer = null;
        this.searchTimeout = null;
        this.currentFocus = -1;
        this.results = [];
        this.isSearching = false;
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
        this.attachEvents();
        
        return this;
    }
    
    // =============================================
    // RENDU
    // =============================================
    
    render() {
        const html = `
            <div class="search-bar-wrapper">
                <div class="search-bar">
                    <div class="search-icon">
                        <i class="fas fa-search"></i>
                    </div>
                    <input 
                        type="text" 
                        class="search-input" 
                        id="global-search-input"
                        placeholder="${this.options.placeholder}"
                        autocomplete="off"
                    >
                    <div class="search-loader d-none">
                        <div class="spinner-border spinner-border-sm" role="status">
                            <span class="visually-hidden">Recherche...</span>
                        </div>
                    </div>
                    <button class="search-clear d-none" id="search-clear-btn">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="search-results d-none" id="search-results">
                    <div class="search-results-inner"></div>
                </div>
            </div>
        `;
        
        this.container.innerHTML = html;
        
        // Références aux éléments
        this.input = this.container.querySelector('#global-search-input');
        this.resultsContainer = this.container.querySelector('#search-results');
        this.resultsInner = this.container.querySelector('.search-results-inner');
        this.loader = this.container.querySelector('.search-loader');
        this.clearBtn = this.container.querySelector('#search-clear-btn');
    }
    
    // =============================================
    // ÉVÉNEMENTS
    // =============================================
    
    attachEvents() {
        // Input
        this.input.addEventListener('input', this.handleInput.bind(this));
        this.input.addEventListener('keydown', this.handleKeydown.bind(this));
        this.input.addEventListener('focus', this.handleFocus.bind(this));
        
        // Clear button
        this.clearBtn.addEventListener('click', this.clear.bind(this));
        
        // Click outside
        document.addEventListener('click', (e) => {
            if (!this.container.contains(e.target)) {
                this.hideResults();
            }
        });
        
        // Prevent form submission
        this.input.closest('form')?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.selectCurrent();
        });
    }
    
    handleInput(e) {
        const query = e.target.value.trim();
        
        // Afficher/masquer le bouton clear
        this.clearBtn.classList.toggle('d-none', !query);
        
        // Annuler la recherche précédente
        clearTimeout(this.searchTimeout);
        
        if (query.length < this.options.minLength) {
            this.hideResults();
            return;
        }
        
        // Déclencher la recherche après le délai
        this.searchTimeout = setTimeout(() => {
            this.search(query);
        }, this.options.delay);
    }
    
    handleKeydown(e) {
        const resultsVisible = !this.resultsContainer.classList.contains('d-none');
        
        switch (e.key) {
            case 'ArrowDown':
                if (resultsVisible) {
                    e.preventDefault();
                    this.navigateResults(1);
                }
                break;
                
            case 'ArrowUp':
                if (resultsVisible) {
                    e.preventDefault();
                    this.navigateResults(-1);
                }
                break;
                
            case 'Enter':
                e.preventDefault();
                if (resultsVisible && this.currentFocus >= 0) {
                    this.selectResult(this.results[this.currentFocus]);
                } else {
                    this.selectCurrent();
                }
                break;
                
            case 'Escape':
                this.hideResults();
                this.input.blur();
                break;
        }
    }
    
    handleFocus() {
        if (this.input.value.trim().length >= this.options.minLength && this.results.length > 0) {
            this.showResults();
        }
    }
    
    // =============================================
    // RECHERCHE
    // =============================================
    
    async search(query) {
        if (this.isSearching) return;
        
        this.isSearching = true;
        this.showLoader();
        
        try {
            // Callback de recherche personnalisée
            if (this.options.onSearch) {
                this.results = await this.options.onSearch(query);
            } else {
                // Recherche par défaut via l'API
                this.results = await this.defaultSearch(query);
            }
            
            this.displayResults();
            
        } catch (error) {
            console.error('Erreur recherche:', error);
            this.showError();
        } finally {
            this.isSearching = false;
            this.hideLoader();
        }
    }
    
    async defaultSearch(query) {
        const response = await API.search({ 
            q: query, 
            limit: this.options.maxResults 
        });
        
        return this.formatResults(response);
    }
    
    formatResults(data) {
        const results = [];
        
        // Clients
        if (data.clients && data.clients.length > 0) {
            data.clients.forEach(client => {
                results.push({
                    type: 'client',
                    id: client.id,
                    title: `${client.nom} ${client.prenom}`,
                    subtitle: client.telephone_principal,
                    icon: 'fas fa-user',
                    color: 'primary',
                    data: client
                });
            });
        }
        
        // Marchandises
        if (data.marchandises && data.marchandises.length > 0) {
            data.marchandises.forEach(item => {
                results.push({
                    type: 'marchandise',
                    id: item.id,
                    title: item.designation,
                    subtitle: `Code: ${item.code_barre}`,
                    icon: 'fas fa-box',
                    color: 'warning',
                    data: item
                });
            });
        }
        
        // Conteneurs
        if (data.conteneurs && data.conteneurs.length > 0) {
            data.conteneurs.forEach(conteneur => {
                results.push({
                    type: 'conteneur',
                    id: conteneur.id,
                    title: conteneur.numero_conteneur,
                    subtitle: `Dossier: ${conteneur.numero_dossier}`,
                    icon: 'fas fa-cube',
                    color: 'success',
                    data: conteneur
                });
            });
        }
        
        return results;
    }
    
    // =============================================
    // AFFICHAGE DES RÉSULTATS
    // =============================================
    
    displayResults() {
        if (this.results.length === 0) {
            this.showNoResults();
            return;
        }
        
        let html = '';
        
        if (this.options.showCategories) {
            // Grouper par type
            const grouped = this.groupResultsByType();
            
            Object.entries(grouped).forEach(([type, items]) => {
                html += `
                    <div class="search-category">
                        <div class="search-category-header">${this.getCategoryName(type)}</div>
                        ${items.map((item, index) => this.renderResultItem(item, index)).join('')}
                    </div>
                `;
            });
        } else {
            // Liste simple
            html = this.results.map((item, index) => this.renderResultItem(item, index)).join('');
        }
        
        this.resultsInner.innerHTML = html;
        this.showResults();
        this.attachResultEvents();
    }
    
    renderResultItem(item, index) {
        return `
            <div class="search-result-item" data-index="${index}">
                <div class="search-result-icon text-${item.color}">
                    <i class="${item.icon}"></i>
                </div>
                <div class="search-result-content">
                    <div class="search-result-title">${this.highlightMatch(item.title)}</div>
                    <div class="search-result-subtitle">${item.subtitle}</div>
                </div>
                ${this.options.allowNavigation ? `
                    <div class="search-result-action">
                        <i class="fas fa-chevron-right"></i>
                    </div>
                ` : ''}
            </div>
        `;
    }
    
    highlightMatch(text) {
        const query = this.input.value.trim();
        const regex = new RegExp(`(${query})`, 'gi');
        return text.replace(regex, '<mark>$1</mark>');
    }
    
    groupResultsByType() {
        const grouped = {};
        
        this.results.forEach(item => {
            if (!grouped[item.type]) {
                grouped[item.type] = [];
            }
            grouped[item.type].push(item);
        });
        
        return grouped;
    }
    
    getCategoryName(type) {
        const names = {
            client: 'Clients',
            marchandise: 'Marchandises',
            conteneur: 'Conteneurs'
        };
        
        return names[type] || type;
    }
    
    // =============================================
    // NAVIGATION
    // =============================================
    
    navigateResults(direction) {
        const items = this.resultsContainer.querySelectorAll('.search-result-item');
        
        this.currentFocus += direction;
        
        if (this.currentFocus >= items.length) {
            this.currentFocus = 0;
        } else if (this.currentFocus < 0) {
            this.currentFocus = items.length - 1;
        }
        
        this.updateFocus(items);
    }
    
    updateFocus(items) {
        items.forEach((item, index) => {
            if (index === this.currentFocus) {
                item.classList.add('active');
                item.scrollIntoView({ block: 'nearest' });
            } else {
                item.classList.remove('active');
            }
        });
    }
    
    attachResultEvents() {
        const items = this.resultsContainer.querySelectorAll('.search-result-item');
        
        items.forEach((item, index) => {
            item.addEventListener('click', () => {
                this.selectResult(this.results[index]);
            });
            
            item.addEventListener('mouseenter', () => {
                this.currentFocus = index;
                this.updateFocus(items);
            });
        });
    }
    
    // =============================================
    // SÉLECTION
    // =============================================
    
    selectResult(result) {
        if (this.options.onSelect) {
            this.options.onSelect(result);
        } else {
            this.defaultSelect(result);
        }
        
        this.hideResults();
        this.clear();
    }
    
    selectCurrent() {
        const query = this.input.value.trim();
        
        if (query && this.options.onSearch) {
            // Déclencher une recherche globale
            window.location.hash = `#search?q=${encodeURIComponent(query)}`;
        }
    }
    
    defaultSelect(result) {
        // Navigation par défaut selon le type
        switch (result.type) {
            case 'client':
                window.location.hash = `#clients?id=${result.id}`;
                break;
                
            case 'marchandise':
                window.location.hash = `#marchandises?id=${result.id}`;
                break;
                
            case 'conteneur':
                window.location.hash = `#conteneurs?id=${result.id}`;
                break;
        }
    }
    
    // =============================================
    // ÉTATS D'AFFICHAGE
    // =============================================
    
    showResults() {
        this.resultsContainer.classList.remove('d-none');
        this.currentFocus = -1;
    }
    
    hideResults() {
        this.resultsContainer.classList.add('d-none');
        this.currentFocus = -1;
    }
    
    showLoader() {
        this.loader.classList.remove('d-none');
    }
    
    hideLoader() {
        this.loader.classList.add('d-none');
    }
    
    showNoResults() {
        this.resultsInner.innerHTML = `
            <div class="search-no-results">
                <i class="fas fa-search text-muted"></i>
                <p>Aucun résultat trouvé</p>
            </div>
        `;
        this.showResults();
    }
    
    showError() {
        this.resultsInner.innerHTML = `
            <div class="search-error">
                <i class="fas fa-exclamation-triangle text-danger"></i>
                <p>Erreur lors de la recherche</p>
            </div>
        `;
        this.showResults();
    }
    
    // =============================================
    // UTILITAIRES
    // =============================================
    
    clear() {
        this.input.value = '';
        this.clearBtn.classList.add('d-none');
        this.hideResults();
        this.results = [];
        this.currentFocus = -1;
    }
    
    focus() {
        this.input.focus();
    }
    
    setValue(value) {
        this.input.value = value;
        this.clearBtn.classList.toggle('d-none', !value);
    }
    
    getValue() {
        return this.input.value.trim();
    }
    
    disable() {
        this.input.disabled = true;
        this.clearBtn.disabled = true;
    }
    
    enable() {
        this.input.disabled = false;
        this.clearBtn.disabled = false;
    }
    
    destroy() {
        clearTimeout(this.searchTimeout);
        this.container.innerHTML = '';
    }
}

// =============================================
// EXPORT
// =============================================

window.SearchBar = SearchBar;