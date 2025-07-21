/**
 * Composant DataTable
 * Tableaux dynamiques avec tri, filtre, pagination et actions
 */

class DataTable {
    constructor(options = {}) {
        this.options = {
            columns: [],
            data: [],
            pageSize: 25,
            pageSizes: [10, 25, 50, 100],
            searchable: true,
            sortable: true,
            selectable: false,
            actions: null,
            emptyMessage: 'Aucune donnée disponible',
            loadingMessage: 'Chargement...',
            responsive: true,
            striped: true,
            hover: true,
            condensed: false,
            onRowClick: null,
            onSelectionChange: null,
            serverSide: false,
            ajax: null,
            ...options
        };
        
        this.container = null;
        this.table = null;
        this.dataTableInstance = null;
        this.selectedRows = new Set();
        this.currentPage = 1;
        this.totalPages = 1;
        this.filteredData = [];
        this.sortColumn = null;
        this.sortDirection = 'asc';
        this.searchTerm = '';
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
        
        if (this.options.serverSide && this.options.ajax) {
            this.loadServerData();
        } else {
            this.setData(this.options.data);
        }
        
        return this;
    }
    
    // =============================================
    // RENDU
    // =============================================
    
    render() {
        const tableClass = [
            'table',
            this.options.striped ? 'table-striped' : '',
            this.options.hover ? 'table-hover' : '',
            this.options.condensed ? 'table-sm' : '',
            'datatable'
        ].filter(Boolean).join(' ');
        
        const html = `
            <div class="datatable-wrapper">
                ${this.renderHeader()}
                <div class="table-responsive">
                    <table class="${tableClass}" id="${this.generateId('table')}">
                        <thead>
                            ${this.renderTableHeader()}
                        </thead>
                        <tbody></tbody>
                    </table>
                    <div class="datatable-loading d-none">
                        <div class="text-center py-5">
                            <div class="spinner-border text-primary" role="status">
                                <span class="visually-hidden">${this.options.loadingMessage}</span>
                            </div>
                            <p class="mt-2">${this.options.loadingMessage}</p>
                        </div>
                    </div>
                </div>
                ${this.renderFooter()}
            </div>
        `;
        
        this.container.innerHTML = html;
        
        // Références
        this.table = this.container.querySelector('table');
        this.tbody = this.table.querySelector('tbody');
        this.loadingDiv = this.container.querySelector('.datatable-loading');
        
        // Attacher les événements
        this.attachEvents();
    }
    
    renderHeader() {
        if (!this.options.searchable && !this.options.actions) {
            return '';
        }
        
        return `
            <div class="datatable-header">
                <div class="row align-items-center mb-3">
                    <div class="col-md-6">
                        ${this.options.searchable ? `
                            <div class="datatable-search">
                                <div class="input-group">
                                    <span class="input-group-text">
                                        <i class="fas fa-search"></i>
                                    </span>
                                    <input 
                                        type="text" 
                                        class="form-control" 
                                        placeholder="Rechercher..."
                                        id="${this.generateId('search')}"
                                    >
                                </div>
                            </div>
                        ` : ''}
                    </div>
                    <div class="col-md-6 text-end">
                        ${this.options.actions ? this.renderActions() : ''}
                    </div>
                </div>
            </div>
        `;
    }
    
    renderActions() {
        if (typeof this.options.actions === 'function') {
            return this.options.actions();
        }
        
        let html = '<div class="datatable-actions">';
        
        if (this.options.actions.export) {
            html += `
                <button class="btn btn-sm btn-outline-secondary me-2" data-action="export">
                    <i class="fas fa-download"></i> Exporter
                </button>
            `;
        }
        
        if (this.options.actions.refresh) {
            html += `
                <button class="btn btn-sm btn-outline-secondary me-2" data-action="refresh">
                    <i class="fas fa-sync"></i>
                </button>
            `;
        }
        
        if (this.options.actions.custom) {
            this.options.actions.custom.forEach(action => {
                html += `
                    <button class="btn btn-sm ${action.class || 'btn-primary'}" data-action="${action.name}">
                        ${action.icon ? `<i class="${action.icon}"></i>` : ''} ${action.label}
                    </button>
                `;
            });
        }
        
        html += '</div>';
        return html;
    }
    
    renderTableHeader() {
        let html = '<tr>';
        
        if (this.options.selectable) {
            html += `
                <th style="width: 40px;">
                    <div class="form-check">
                        <input 
                            class="form-check-input" 
                            type="checkbox" 
                            id="${this.generateId('select-all')}"
                        >
                    </div>
                </th>
            `;
        }
        
        this.options.columns.forEach((column, index) => {
            const sortable = column.sortable !== false && this.options.sortable;
            const width = column.width ? `style="width: ${column.width}"` : '';
            const className = column.className || '';
            
            html += `
                <th 
                    ${width} 
                    class="${className} ${sortable ? 'sortable' : ''}"
                    data-column="${index}"
                    data-field="${column.field}"
                >
                    <div class="th-content">
                        <span>${column.title}</span>
                        ${sortable ? `
                            <span class="sort-icon">
                                <i class="fas fa-sort"></i>
                            </span>
                        ` : ''}
                    </div>
                </th>
            `;
        });
        
        html += '</tr>';
        return html;
    }
    
    renderFooter() {
        return `
            <div class="datatable-footer">
                <div class="row align-items-center">
                    <div class="col-md-6">
                        <div class="datatable-info">
                            <span id="${this.generateId('info')}"></span>
                        </div>
                    </div>
                    <div class="col-md-6">
                        <div class="datatable-pagination">
                            <nav>
                                <ul class="pagination pagination-sm justify-content-end mb-0">
                                </ul>
                            </nav>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
    
    // =============================================
    // GESTION DES DONNÉES
    // =============================================
    
    setData(data) {
        this.options.data = data;
        this.filteredData = [...data];
        this.currentPage = 1;
        this.applyFilters();
        this.renderData();
    }
    
    async loadServerData(params = {}) {
        if (!this.options.ajax) return;
        
        this.showLoading();
        
        try {
            const requestParams = {
                page: this.currentPage,
                pageSize: this.options.pageSize,
                search: this.searchTerm,
                sort: this.sortColumn,
                direction: this.sortDirection,
                ...params
            };
            
            const response = await this.options.ajax(requestParams);
            
            this.options.data = response.data;
            this.filteredData = response.data;
            this.totalPages = Math.ceil(response.total / this.options.pageSize);
            
            this.renderData();
            this.updateInfo(response.total);
            this.renderPagination();
            
        } catch (error) {
            console.error('Erreur chargement données:', error);
            this.showError();
        } finally {
            this.hideLoading();
        }
    }
    
    renderData() {
        if (this.filteredData.length === 0) {
            this.renderEmpty();
            return;
        }
        
        let html = '';
        
        const start = (this.currentPage - 1) * this.options.pageSize;
        const end = start + this.options.pageSize;
        const pageData = this.filteredData.slice(start, end);
        
        pageData.forEach((row, index) => {
            html += this.renderRow(row, start + index);
        });
        
        this.tbody.innerHTML = html;
        
        // Attacher les événements des lignes
        this.attachRowEvents();
        
        // Mettre à jour les infos et la pagination
        if (!this.options.serverSide) {
            this.updateInfo();
            this.renderPagination();
        }
    }
    
    renderRow(row, index) {
        const rowId = row.id || index;
        const selected = this.selectedRows.has(rowId);
        
        let html = `<tr data-id="${rowId}" ${selected ? 'class="selected"' : ''}>`;
        
        if (this.options.selectable) {
            html += `
                <td>
                    <div class="form-check">
                        <input 
                            class="form-check-input row-select" 
                            type="checkbox" 
                            ${selected ? 'checked' : ''}
                        >
                    </div>
                </td>
            `;
        }
        
        this.options.columns.forEach(column => {
            const value = this.getNestedValue(row, column.field);
            const formattedValue = column.formatter ? column.formatter(value, row) : value;
            const className = column.className || '';
            
            html += `<td class="${className}">${formattedValue !== null && formattedValue !== undefined ? formattedValue : ''}</td>`;
        });
        
        html += '</tr>';
        return html;
    }
    
    getNestedValue(obj, path) {
        return path.split('.').reduce((current, key) => current?.[key], obj);
    }
    
    // =============================================
    // FILTRAGE ET TRI
    // =============================================
    
    applyFilters() {
        let filtered = [...this.options.data];
        
        // Recherche
        if (this.searchTerm) {
            filtered = filtered.filter(row => {
                return this.options.columns.some(column => {
                    if (column.searchable === false) return false;
                    
                    const value = this.getNestedValue(row, column.field);
                    if (value === null || value === undefined) return false;
                    
                    return value.toString().toLowerCase().includes(this.searchTerm.toLowerCase());
                });
            });
        }
        
        // Tri
        if (this.sortColumn !== null) {
            const column = this.options.columns[this.sortColumn];
            
            filtered.sort((a, b) => {
                let aVal = this.getNestedValue(a, column.field);
                let bVal = this.getNestedValue(b, column.field);
                
                // Gestion des valeurs nulles
                if (aVal === null || aVal === undefined) aVal = '';
                if (bVal === null || bVal === undefined) bVal = '';
                
                // Comparaison selon le type
                if (column.type === 'number') {
                    aVal = parseFloat(aVal) || 0;
                    bVal = parseFloat(bVal) || 0;
                } else if (column.type === 'date') {
                    aVal = new Date(aVal);
                    bVal = new Date(bVal);
                } else {
                    aVal = aVal.toString().toLowerCase();
                    bVal = bVal.toString().toLowerCase();
                }
                
                if (aVal < bVal) return this.sortDirection === 'asc' ? -1 : 1;
                if (aVal > bVal) return this.sortDirection === 'asc' ? 1 : -1;
                return 0;
            });
        }
        
        this.filteredData = filtered;
        this.totalPages = Math.ceil(filtered.length / this.options.pageSize);
        
        // Réinitialiser à la page 1 si nécessaire
        if (this.currentPage > this.totalPages) {
            this.currentPage = 1;
        }
    }
    
    // =============================================
    // PAGINATION
    // =============================================
    
    renderPagination() {
        const pagination = this.container.querySelector('.pagination');
        if (!pagination) return;
        
        let html = '';
        
        // Bouton précédent
        html += `
            <li class="page-item ${this.currentPage === 1 ? 'disabled' : ''}">
                <a class="page-link" href="#" data-page="prev">
                    <i class="fas fa-chevron-left"></i>
                </a>
            </li>
        `;
        
        // Pages
        const pages = this.getPaginationPages();
        pages.forEach(page => {
            if (page === '...') {
                html += `<li class="page-item disabled"><span class="page-link">...</span></li>`;
            } else {
                html += `
                    <li class="page-item ${page === this.currentPage ? 'active' : ''}">
                        <a class="page-link" href="#" data-page="${page}">${page}</a>
                    </li>
                `;
            }
        });
        
        // Bouton suivant
        html += `
            <li class="page-item ${this.currentPage === this.totalPages ? 'disabled' : ''}">
                <a class="page-link" href="#" data-page="next">
                    <i class="fas fa-chevron-right"></i>
                </a>
            </li>
        `;
        
        pagination.innerHTML = html;
        
        // Attacher les événements
        pagination.querySelectorAll('.page-link').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const page = e.currentTarget.dataset.page;
                
                if (page === 'prev' && this.currentPage > 1) {
                    this.goToPage(this.currentPage - 1);
                } else if (page === 'next' && this.currentPage < this.totalPages) {
                    this.goToPage(this.currentPage + 1);
                } else if (page !== 'prev' && page !== 'next') {
                    this.goToPage(parseInt(page));
                }
            });
        });
    }
    
    getPaginationPages() {
        const pages = [];
        const maxVisible = 5;
        
        if (this.totalPages <= maxVisible + 2) {
            // Afficher toutes les pages
            for (let i = 1; i <= this.totalPages; i++) {
                pages.push(i);
            }
        } else {
            // Toujours afficher la première page
            pages.push(1);
            
            if (this.currentPage <= 3) {
                // Début
                for (let i = 2; i <= 4; i++) {
                    pages.push(i);
                }
                pages.push('...');
            } else if (this.currentPage >= this.totalPages - 2) {
                // Fin
                pages.push('...');
                for (let i = this.totalPages - 3; i < this.totalPages; i++) {
                    pages.push(i);
                }
            } else {
                // Milieu
                pages.push('...');
                for (let i = this.currentPage - 1; i <= this.currentPage + 1; i++) {
                    pages.push(i);
                }
                pages.push('...');
            }
            
            // Toujours afficher la dernière page
            pages.push(this.totalPages);
        }
        
        return pages;
    }
    
    goToPage(page) {
        if (page < 1 || page > this.totalPages) return;
        
        this.currentPage = page;
        
        if (this.options.serverSide) {
            this.loadServerData();
        } else {
            this.renderData();
        }
    }
    
    // =============================================
    // INFORMATIONS
    // =============================================
    
    updateInfo(total) {
        const info = this.container.querySelector(`#${this.generateId('info')}`);
        if (!info) return;
        
        const totalRecords = total || this.filteredData.length;
        const start = totalRecords === 0 ? 0 : (this.currentPage - 1) * this.options.pageSize + 1;
        const end = Math.min(start + this.options.pageSize - 1, totalRecords);
        
        if (totalRecords === 0) {
            info.textContent = 'Aucun enregistrement';
        } else {
            info.textContent = `Affichage de ${start} à ${end} sur ${totalRecords} enregistrements`;
            
            if (this.searchTerm && this.filteredData.length < this.options.data.length) {
                info.textContent += ` (filtrés sur ${this.options.data.length} total)`;
            }
        }
    }
    
    // =============================================
    // ÉVÉNEMENTS
    // =============================================
    
    attachEvents() {
        // Recherche
        const searchInput = this.container.querySelector(`#${this.generateId('search')}`);
        if (searchInput) {
            let searchTimeout;
            searchInput.addEventListener('input', (e) => {
                clearTimeout(searchTimeout);
                searchTimeout = setTimeout(() => {
                    this.searchTerm = e.target.value;
                    this.currentPage = 1;
                    
                    if (this.options.serverSide) {
                        this.loadServerData();
                    } else {
                        this.applyFilters();
                        this.renderData();
                    }
                }, 300);
            });
        }
        
        // Tri
        this.container.querySelectorAll('th.sortable').forEach(th => {
            th.addEventListener('click', () => {
                const columnIndex = parseInt(th.dataset.column);
                
                if (this.sortColumn === columnIndex) {
                    this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
                } else {
                    this.sortColumn = columnIndex;
                    this.sortDirection = 'asc';
                }
                
                this.updateSortIcons();
                
                if (this.options.serverSide) {
                    this.loadServerData();
                } else {
                    this.applyFilters();
                    this.renderData();
                }
            });
        });
        
        // Select all
        const selectAll = this.container.querySelector(`#${this.generateId('select-all')}`);
        if (selectAll) {
            selectAll.addEventListener('change', (e) => {
                this.selectAll(e.target.checked);
            });
        }
        
        // Actions
        this.container.querySelectorAll('[data-action]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const action = e.currentTarget.dataset.action;
                this.handleAction(action);
            });
        });
    }
    
    attachRowEvents() {
        // Click sur ligne
        if (this.options.onRowClick) {
            this.tbody.querySelectorAll('tr').forEach(tr => {
                tr.addEventListener('click', (e) => {
                    if (e.target.classList.contains('form-check-input')) return;
                    
                    const id = tr.dataset.id;
                    const data = this.getRowData(id);
                    this.options.onRowClick(data, tr);
                });
            });
        }
        
        // Sélection
        if (this.options.selectable) {
            this.tbody.querySelectorAll('.row-select').forEach(checkbox => {
                checkbox.addEventListener('change', (e) => {
                    const tr = e.target.closest('tr');
                    const id = tr.dataset.id;
                    
                    if (e.target.checked) {
                        this.selectedRows.add(id);
                        tr.classList.add('selected');
                    } else {
                        this.selectedRows.delete(id);
                        tr.classList.remove('selected');
                    }
                    
                    this.updateSelectAllState();
                    
                    if (this.options.onSelectionChange) {
                        this.options.onSelectionChange(this.getSelectedData());
                    }
                });
            });
        }
    }
    
    // =============================================
    // SÉLECTION
    // =============================================
    
    selectAll(checked) {
        this.tbody.querySelectorAll('.row-select').forEach(checkbox => {
            checkbox.checked = checked;
            const tr = checkbox.closest('tr');
            const id = tr.dataset.id;
            
            if (checked) {
                this.selectedRows.add(id);
                tr.classList.add('selected');
            } else {
                this.selectedRows.delete(id);
                tr.classList.remove('selected');
            }
        });
        
        if (this.options.onSelectionChange) {
            this.options.onSelectionChange(this.getSelectedData());
        }
    }
    
    updateSelectAllState() {
        const selectAll = this.container.querySelector(`#${this.generateId('select-all')}`);
        if (!selectAll) return;
        
        const checkboxes = this.tbody.querySelectorAll('.row-select');
        const checkedCount = this.tbody.querySelectorAll('.row-select:checked').length;
        
        selectAll.checked = checkboxes.length > 0 && checkedCount === checkboxes.length;
        selectAll.indeterminate = checkedCount > 0 && checkedCount < checkboxes.length;
    }
    
    getSelectedData() {
        return Array.from(this.selectedRows).map(id => this.getRowData(id)).filter(Boolean);
    }
    
    getRowData(id) {
        return this.options.data.find(row => (row.id || this.options.data.indexOf(row)).toString() === id);
    }
    
    // =============================================
    // ACTIONS
    // =============================================
    
    handleAction(action) {
        switch (action) {
            case 'refresh':
                this.refresh();
                break;
                
            case 'export':
                this.export();
                break;
                
            default:
                // Action personnalisée
                const customAction = this.options.actions.custom?.find(a => a.name === action);
                if (customAction && customAction.handler) {
                    customAction.handler(this);
                }
        }
    }
    
    refresh() {
        if (this.options.serverSide) {
            this.loadServerData();
        } else {
            this.renderData();
        }
    }
    
    async export() {
        const format = await Swal.fire({
            title: 'Format d\'export',
            input: 'select',
            inputOptions: {
                'csv': 'CSV',
                'excel': 'Excel',
                'pdf': 'PDF'
            },
            inputPlaceholder: 'Sélectionnez un format',
            showCancelButton: true,
            confirmButtonText: 'Exporter',
            cancelButtonText: 'Annuler'
        });
        
        if (format.value) {
            // Logique d'export
            console.log('Export en', format.value);
            
            // Ici, vous pouvez appeler une API d'export ou générer le fichier côté client
            const data = this.options.serverSide ? await this.getAllData() : this.filteredData;
            
            switch (format.value) {
                case 'csv':
                    this.exportCSV(data);
                    break;
                case 'excel':
                    this.exportExcel(data);
                    break;
                case 'pdf':
                    this.exportPDF(data);
                    break;
            }
        }
    }
    
    exportCSV(data) {
        const headers = this.options.columns.map(col => col.title);
        const rows = data.map(row => {
            return this.options.columns.map(col => {
                const value = this.getNestedValue(row, col.field);
                return value !== null && value !== undefined ? value : '';
            });
        });
        
        let csv = headers.join(',') + '\n';
        rows.forEach(row => {
            csv += row.map(cell => `"${cell}"`).join(',') + '\n';
        });
        
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'export.csv';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
    }
    
    exportExcel(data) {
        // Nécessite une bibliothèque comme SheetJS
        console.log('Export Excel non implémenté');
        Helpers.showInfo('Info', 'L\'export Excel sera disponible prochainement');
    }
    
    exportPDF(data) {
        // Nécessite une bibliothèque comme jsPDF
        console.log('Export PDF non implémenté');
        Helpers.showInfo('Info', 'L\'export PDF sera disponible prochainement');
    }
    
    // =============================================
    // ÉTATS
    // =============================================
    
    showLoading() {
        this.tbody.style.display = 'none';
        this.loadingDiv.classList.remove('d-none');
    }
    
    hideLoading() {
        this.tbody.style.display = '';
        this.loadingDiv.classList.add('d-none');
    }
    
    renderEmpty() {
        this.tbody.innerHTML = `
            <tr>
                <td colspan="${this.options.columns.length + (this.options.selectable ? 1 : 0)}" class="text-center py-5">
                    <i class="fas fa-inbox fa-3x text-muted mb-3"></i>
                    <p class="text-muted">${this.options.emptyMessage}</p>
                </td>
            </tr>
        `;
        
        this.updateInfo();
        this.renderPagination();
    }
    
    showError() {
        this.tbody.innerHTML = `
            <tr>
                <td colspan="${this.options.columns.length + (this.options.selectable ? 1 : 0)}" class="text-center py-5">
                    <i class="fas fa-exclamation-triangle fa-3x text-danger mb-3"></i>
                    <p class="text-danger">Erreur lors du chargement des données</p>
                </td>
            </tr>
        `;
    }
    
    // =============================================
    // UTILITAIRES
    // =============================================
    
    generateId(suffix) {
        return `datatable-${Date.now()}-${suffix}`;
    }
    
    updateSortIcons() {
        this.container.querySelectorAll('th.sortable').forEach((th, index) => {
            const icon = th.querySelector('.sort-icon i');
            
            if (index === this.sortColumn) {
                icon.className = this.sortDirection === 'asc' ? 'fas fa-sort-up' : 'fas fa-sort-down';
                th.classList.add('sorted');
            } else {
                icon.className = 'fas fa-sort';
                th.classList.remove('sorted');
            }
        });
    }
    
    async getAllData() {
        if (!this.options.serverSide) {
            return this.filteredData;
        }
        
        // Charger toutes les données depuis le serveur
        const response = await this.options.ajax({
            page: 1,
            pageSize: -1, // Toutes les données
            search: this.searchTerm,
            sort: this.sortColumn,
            direction: this.sortDirection
        });
        
        return response.data;
    }
    
    // =============================================
    // API PUBLIQUE
    // =============================================
    
    destroy() {
        this.container.innerHTML = '';
        this.selectedRows.clear();
    }
    
    reload() {
        this.refresh();
    }
    
    getSelected() {
        return this.getSelectedData();
    }
    
    clearSelection() {
        this.selectAll(false);
    }
    
    search(term) {
        const searchInput = this.container.querySelector(`#${this.generateId('search')}`);
        if (searchInput) {
            searchInput.value = term;
            searchInput.dispatchEvent(new Event('input'));
        }
    }
    
    sort(field, direction = 'asc') {
        const columnIndex = this.options.columns.findIndex(col => col.field === field);
        if (columnIndex >= 0) {
            this.sortColumn = columnIndex;
            this.sortDirection = direction;
            this.updateSortIcons();
            
            if (this.options.serverSide) {
                this.loadServerData();
            } else {
                this.applyFilters();
                this.renderData();
            }
        }
    }
}

// =============================================
// EXPORT
// =============================================

window.DataTable = DataTable;