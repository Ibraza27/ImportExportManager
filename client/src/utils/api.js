/**
 * Module API optimisé avec cache, batch et debounce
 * Réduit drastiquement le nombre de requêtes au serveur
 */
class ApiClient {
    constructor() {
        this.baseUrl = 'http://localhost:3000/api';
        this.token = localStorage.getItem('token');

        // Configuration
        this.config = {
            timeout: 30000,
            retryAttempts: 3,
            retryDelay: 1000,
            batchDelay: 50, // Délai pour grouper les requêtes
            cacheEnabled: true
        };

        // Batch de requêtes
        this.batchQueue = new Map();
        this.batchTimer = null;

        // Debounce pour les recherches
        this.searchDebounce = new Map();

        // Intercepteurs
        this.interceptors = {
            request: [],
            response: [],
            error: []
        };

        // Statistiques
        this.stats = {
            requests: 0,
            cacheHits: 0,
            cacheMisses: 0,
            errors: 0,
            totalTime: 0
        };

        // Initialiser les sous-modules
        this.clients = this.createClientsModule();
        this.marchandises = this.createMarchandisesModule();
        this.conteneurs = this.createConteneursModule();
        this.paiements = this.createPaiementsModule();
        this.dashboard = this.createDashboardModule();
        this.rapports = this.createRapportsModule();
        this.utilisateurs = this.createUtilisateursModule();
        this.parametres = this.createParametresModule();
        this.notifications = this.createNotificationsModule();
        this.search = this.createSearchModule();
        this.logs = this.createLogsModule();
    }

    /**
     * Configuration de l'authentification
     */
    setToken(token) {
        this.token = token;
        if (token) {
            localStorage.setItem('token', token);
        } else {
            localStorage.removeItem('token');
        }
    }

    /**
     * Méthode principale de requête avec optimisations
     */
    async request(url, options = {}) {
        const start = Date.now();
        this.stats.requests++;

        // Construire l'URL complète
        const fullUrl = url.startsWith('http') ? url : `${this.baseUrl}${url}`;

        // Options par défaut
        const defaultOptions = {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': this.token ? `Bearer ${this.token}` : undefined
            },
            ...options
        };

        // Appliquer les intercepteurs de requête
        for (const interceptor of this.interceptors.request) {
            await interceptor(defaultOptions);
        }

        // Gestion du cache pour les GET
        if (defaultOptions.method === 'GET' && this.config.cacheEnabled && !options.noCache) {
            const cached = window.cache?.get(fullUrl);
            if (cached) {
                this.stats.cacheHits++;
                console.log(`[API Cache HIT] ${url}`);
                return cached;
            }
            this.stats.cacheMisses++;
        }

        try {
            // Faire la requête avec retry automatique
            const response = await this.fetchWithRetry(fullUrl, defaultOptions);

            // Parser la réponse
            const data = await response.json();

            // Vérifier le statut
            if (!response.ok) {
                throw new ApiError(response.status, data.error || 'Erreur serveur', data);
            }

            // Appliquer les intercepteurs de réponse
            for (const interceptor of this.interceptors.response) {
                await interceptor(data, response);
            }

            // Mettre en cache si GET et succès
            if (defaultOptions.method === 'GET' && data.success && window.cache) {
                const cacheTTL = options.cacheTTL || 60000; // 1 minute par défaut
                window.cache.set(fullUrl, data, { ttl: cacheTTL });
            }

            // Statistiques
            this.stats.totalTime += Date.now() - start;

            return data;

        } catch (error) {
            this.stats.errors++;

            // Appliquer les intercepteurs d'erreur
            for (const interceptor of this.interceptors.error) {
                await interceptor(error);
            }

            // Logger l'erreur
            console.error(`[API Error] ${url}:`, error);

            // Si erreur 401, déconnecter l'utilisateur
            if (error.status === 401) {
                this.handleAuthError();
            }

            throw error;
        }
    }

    /**
     * Fetch avec retry automatique
     */
    async fetchWithRetry(url, options, attempt = 1) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

            const response = await fetch(url, {
                ...options,
                signal: controller.signal
            });

            clearTimeout(timeoutId);
            return response;

        } catch (error) {
            if (attempt < this.config.retryAttempts && this.shouldRetry(error)) {
                console.log(`[API Retry] Tentative ${attempt + 1}/${this.config.retryAttempts}`);
                await this.sleep(this.config.retryDelay * attempt);
                return this.fetchWithRetry(url, options, attempt + 1);
            }
            throw error;
        }
    }

    /**
     * Déterminer si on doit réessayer
     */
    shouldRetry(error) {
        // Réessayer sur erreur réseau ou timeout
        return error.name === 'AbortError' ||
               error.name === 'NetworkError' ||
               error.message.includes('Failed to fetch');
    }

    /**
     * Méthodes HTTP simplifiées
     */
    async get(url, options = {}) {
        return this.request(url, { ...options, method: 'GET' });
    }

    async post(url, data, options = {}) {
        return this.request(url, {
            ...options,
            method: 'POST',
            body: JSON.stringify(data)
        });
    }

    async put(url, data, options = {}) {
        return this.request(url, {
            ...options,
            method: 'PUT',
            body: JSON.stringify(data)
        });
    }

    async delete(url, options = {}) {
        return this.request(url, { ...options, method: 'DELETE' });
    }

    /**
     * Requête avec debounce (pour les recherches)
     */
    async searchDebounced(url, params, delay = 300) {
        const key = `${url}:${JSON.stringify(params)}`;

        // Annuler la requête précédente
        if (this.searchDebounce.has(key)) {
            clearTimeout(this.searchDebounce.get(key).timer);
            this.searchDebounce.get(key).cancel();
        }

        // Créer une nouvelle promesse avec debounce
        return new Promise((resolve, reject) => {
            const timer = setTimeout(async () => {
                try {
                    const result = await this.get(url, { params });
                    resolve(result);
                    this.searchDebounce.delete(key);
                } catch (error) {
                    reject(error);
                    this.searchDebounce.delete(key);
                }
            }, delay);

            this.searchDebounce.set(key, {
                timer,
                cancel: () => reject(new Error('Requête annulée'))
            });
        });
    }

    /**
     * Batch de requêtes pour optimiser
     */
    async batch(requests) {
        if (!Array.isArray(requests) || requests.length === 0) {
            return [];
        }

        // Si une seule requête, la faire directement
        if (requests.length === 1) {
            const result = await this.request(requests[0].url, requests[0].options);
            return [result];
        }

        // Envoyer toutes les requêtes en parallèle
        const promises = requests.map(req =>
            this.request(req.url, req.options).catch(error => ({ error }))
        );

        return Promise.all(promises);
    }

    /**
     * Requête batch avec délai (pour grouper les requêtes)
     */
    batchDelayed(id, url, options = {}) {
        return new Promise((resolve, reject) => {
            // Ajouter à la queue
            this.batchQueue.set(id, { url, options, resolve, reject });

            // Réinitialiser le timer
            if (this.batchTimer) {
                clearTimeout(this.batchTimer);
            }

            // Déclencher le batch après le délai
            this.batchTimer = setTimeout(() => {
                this.processBatchQueue();
            }, this.config.batchDelay);
        });
    }

    /**
     * Traiter la queue de batch
     */
    async processBatchQueue() {
        if (this.batchQueue.size === 0) return;

        const requests = Array.from(this.batchQueue.values());
        this.batchQueue.clear();

        console.log(`[API Batch] Traitement de ${requests.length} requêtes`);

        try {
            // Grouper par endpoint si possible
            const grouped = this.groupRequests(requests);

            for (const group of grouped) {
                if (group.length === 1) {
                    // Requête simple
                    const { url, options, resolve, reject } = group[0];
                    try {
                        const result = await this.request(url, options);
                        resolve(result);
                    } catch (error) {
                        reject(error);
                    }
                } else {
                    // Requêtes multiples vers le même endpoint
                    const results = await this.batch(group);
                    group.forEach((req, index) => {
                        if (results[index].error) {
                            req.reject(results[index].error);
                        } else {
                            req.resolve(results[index]);
                        }
                    });
                }
            }
        } catch (error) {
            // En cas d'erreur globale, rejeter toutes les promesses
            requests.forEach(req => req.reject(error));
        }
    }

    /**
     * Grouper les requêtes par endpoint
     */
    groupRequests(requests) {
        const groups = new Map();

        for (const req of requests) {
            const endpoint = req.url.split('?')[0];
            if (!groups.has(endpoint)) {
                groups.set(endpoint, []);
            }
            groups.get(endpoint).push(req);
        }

        return Array.from(groups.values());
    }

    /**
     * Gestion des erreurs d'authentification
     */
    handleAuthError() {
        this.setToken(null);

        // Rediriger vers la page de connexion
        if (window.location.pathname !== '/login') {
            window.location.href = '/login';
        }

        // Émettre un événement
        window.dispatchEvent(new CustomEvent('auth:expired'));
    }

    /**
     * Invalider le cache pour un pattern d'URL
     */
    invalidateCache(pattern) {
        if (window.cache) {
            const count = window.cache.invalidate(`api:${pattern}`);
            console.log(`[API Cache] ${count} entrées invalidées`);
        }
    }

    /**
     * Précharger des endpoints
     */
    async preload(endpoints) {
        console.log(`[API Preload] Préchargement de ${endpoints.length} endpoints`);

        const promises = endpoints.map(endpoint =>
            this.get(endpoint.url, {
                cacheTTL: endpoint.ttl || 300000,
                ...endpoint.options
            }).catch(error => {
                console.error(`[API Preload Error] ${endpoint.url}:`, error);
                return null;
            })
        );

        await Promise.all(promises);
    }

    /**
     * Obtenir les statistiques
     */
    getStats() {
        const avgTime = this.stats.requests > 0
            ? Math.round(this.stats.totalTime / this.stats.requests)
            : 0;

        const cacheRatio = this.stats.cacheHits + this.stats.cacheMisses > 0
            ? Math.round((this.stats.cacheHits / (this.stats.cacheHits + this.stats.cacheMisses)) * 100)
            : 0;

        return {
            ...this.stats,
            averageTime: avgTime,
            cacheHitRatio: cacheRatio
        };
    }

    /**
     * Réinitialiser les statistiques
     */
    resetStats() {
        this.stats = {
            requests: 0,
            cacheHits: 0,
            cacheMisses: 0,
            errors: 0,
            totalTime: 0
        };
    }

    /**
     * Utilitaire sleep
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Modules pour les différentes entités
     */
    createClientsModule() {
        return {
            getAll: (params = {}) => this.get('/clients', params),
            getById: (id) => this.get(`/clients/${id}`),
            create: (data) => this.post('/clients', data),
            update: (id, data) => this.put(`/clients/${id}`, data),
            delete: (id) => this.delete(`/clients/${id}`),
            search: (query) => this.get('/clients/search', { q: query }),
            count: () => this.get('/clients/count'),
            getHistory: (id) => this.get(`/clients/${id}/history`),
            getPayments: (id) => this.get(`/clients/${id}/payments`),
            getShipments: (id) => this.get(`/clients/${id}/shipments`),
            getBalance: (id) => this.get(`/clients/${id}/balance`)
        };
    }

    createMarchandisesModule() {
        return {
            getAll: (params = {}) => this.get('/marchandises', params),
            getById: (id) => this.get(`/marchandises/${id}`),
            create: (data) => this.post('/marchandises', data),
            update: (id, data) => this.put(`/marchandises/${id}`, data),
            delete: (id) => this.delete(`/marchandises/${id}`),
            count: () => this.get('/marchandises/count'),
            scanBarcode: (code) => this.get(`/marchandises/scan/${code}`),
            assignToContainer: (id, containerId) => this.post(`/marchandises/${id}/assign`, { containerId }),
            updateStatus: (id, status) => this.patch(`/marchandises/${id}/status`, { status }),
            uploadPhoto: async (id, file) => {
                const formData = new FormData();
                formData.append('photo', file);
                return this.request('POST', `/marchandises/${id}/photo`, formData, {
                    headers: {} // Laisser le navigateur définir le Content-Type
                });
            }
        };
    }

    createConteneursModule() {
        return {
            getAll: (params) => this.get('/conteneurs', params),
            getById: (id) => this.get(`/conteneurs/${id}`),
            create: (data) => this.post('/conteneurs', data),
            update: (id, data) => this.put(`/conteneurs/${id}`, data),
            delete: (id) => this.delete(`/conteneurs/${id}`),
            getActive: () => this.get('/conteneurs/active'),
            getManifest: (id) => this.get(`/conteneurs/${id}/manifest`),
            close: (id) => this.post(`/conteneurs/${id}/close`),
            reopen: (id) => this.post(`/conteneurs/${id}/reopen`),
            calculateFilling: (id) => this.get(`/conteneurs/${id}/filling`),
            generateDocuments: (id) => this.post(`/conteneurs/${id}/documents`)
        };
    }

    createPaiementsModule() {
        return {
            getAll: (params) => this.get('/finances', params),
            getById: (id) => this.get(`/finances/${id}`),
            create: (data) => this.post('/finances', data),
            update: (id, data) => this.put(`/finances/${id}`, data),
            delete: (id) => this.delete(`/finances/${id}`),
            getPending: () => this.get('/paiements/pending'),
            getOverdue: () => this.get('/paiements/overdue'),
            getByClient: (clientId) => this.get(`/paiements/client/${clientId}`),
            getByContainer: (containerId) => this.get(`/paiements/container/${containerId}`),
            generateReceipt: (id) => this.post(`/paiements/${id}/receipt`),
            sendReminder: (id) => this.post(`/paiements/${id}/reminder`)
        };
    }

    createDashboardModule() {
        return {
            getAllData: (period) => this.get(`/dashboard/all?period=${period}`),
            getStats: () => this.get('/dashboard/stats'),
            getCharts: (period) => this.get(`/dashboard/charts?period=${period}`),
            getActivity: (period) => this.get(`/dashboard/activity?period=${period}`)
        };
    }

    createRapportsModule() {
        return {
            getDashboard: () => this.get('/dashboard/stats'),
            getActivity: (period) => this.get(`/dashboard/activity?period=${period}`),
            exportPDF: (type, params) => this.post(`/rapports/export/${type}`, params),
            getCustom: (params) => this.post('/rapports/custom', params)
        };
    }

    createUtilisateursModule() {
        return {
            login: (credentials) => this.post('/auth/login', credentials),
            logout: () => this.post('/auth/logout'),
            getCurrentUser: () => this.get('/auth/me'),
            updateProfile: (data) => this.put('/auth/profile', data),
            changePassword: (data) => this.post('/auth/change-password', data),
            getAll: () => this.get('/utilisateurs'),
            getById: (id) => this.get(`/utilisateurs/${id}`),
            create: (data) => this.post('/utilisateurs', data),
            update: (id, data) => this.put(`/utilisateurs/${id}`, data),
            delete: (id) => this.delete(`/utilisateurs/${id}`),
            resetPassword: (id) => this.post(`/utilisateurs/${id}/reset-password`)
        };
    }

    createParametresModule() {
        return {
            getAll: () => this.get('/parametres'),
            get: (key) => this.get(`/parametres/${key}`),
            update: (key, value) => this.put(`/parametres/${key}`, { value }),
            getCompany: () => this.get('/parametres/company'),
            updateCompany: (data) => this.put('/parametres/company', data),
            getEmailSettings: () => this.get('/parametres/email'),
            updateEmailSettings: (data) => this.put('/parametres/email', data),
            testEmailSettings: (data) => this.post('/parametres/email/test', data)
        };
    }

    createNotificationsModule() {
        return {
            getAll: () => this.get('/notifications'),
            markAsRead: (id) => this.patch(`/notifications/${id}/read`),
            markAllAsRead: () => this.post('/notifications/read-all'),
            delete: (id) => this.delete(`/notifications/${id}`)
        };
    }

    createSearchModule() {
        return {
            global: (query) => this.get('/search', { q: query }),
            clients: (query) => this.get('/search/clients', { q: query }),
            marchandises: (query) => this.get('/search/marchandises', { q: query }),
            conteneurs: (query) => this.get('/search/conteneurs', { q: query }),
            barcode: (code) => this.get('/search/barcode', { code: code })
        };
    }

    createLogsModule() {
        return {
            getAll: (params = {}) => this.get('/logs', params),
            getByEntity: (entity, id) => this.get(`/logs/${entity}/${id}`),
            logError: (error) => this.post('/logs/error', error),
            logAction: (action) => this.post('/logs/action', action)
        };
    }

    /**
     * Méthodes utilitaires
     */
    async uploadFile(endpoint, file, additionalData = {}) {
        const formData = new FormData();
        formData.append('file', file);

        // Ajouter les données supplémentaires
        Object.keys(additionalData).forEach(key => {
            formData.append(key, additionalData[key]);
        });

        return this.request('POST', endpoint, formData, {
            headers: {} // Laisser le navigateur définir le Content-Type
        });
    }

    async downloadFile(endpoint, filename) {
        try {
            const response = await fetch(`${this.baseUrl}${endpoint}`, {
                headers: {
                    'Authorization': this.token ? `Bearer ${this.token}` : ''
                }
            });

            if (!response.ok) throw new Error('Erreur de téléchargement');

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);

        } catch (error) {
            console.error('Erreur téléchargement:', error);
            throw error;
        }
    }

    async testConnection() {
        try {
            await this.get('/health');
            return true;
        } catch (error) {
            return false;
        }
    }
}

/**
 * Classe d'erreur personnalisée
 */
class ApiError extends Error {
    constructor(status, message, data) {
        super(message);
        this.name = 'ApiError';
        this.status = status;
        this.data = data;
    }
}

// Mock electronAPI si non disponible (pour éviter les erreurs)
if (typeof electronAPI === 'undefined') {
    window.electronAPI = {
        log: {
            info: console.log,
            warn: console.warn,
            error: console.error,
            debug: console.debug
        },
        configAPI: {
            getApiUrl: () => 'http://localhost:3000/api',
            getSocketUrl: () => 'http://localhost:3000'
        }
    };
}

// Instance singleton
const apiClient = new ApiClient();

// Initialiser avec l'URL de l'API
const apiUrl = electronAPI.configAPI.getApiUrl();
apiClient.baseUrl = apiUrl;

// Exposer globalement
window.api = apiClient;
window.API = new APIClient();

// Export pour les modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = apiClient;
}
