/**
 * Système de cache intelligent pour optimiser les performances
 * Gère le cache mémoire et localStorage avec expiration
 */

class CacheManager {
    constructor() {
        // Cache mémoire pour les données temporaires
        this.memoryCache = new Map();
        
        // Configuration
        this.config = {
            maxMemoryItems: 100,
            defaultTTL: 300000, // 5 minutes par défaut
            cleanupInterval: 60000, // Nettoyage toutes les minutes
            persistentKeys: ['user_preferences', 'app_config'] // Clés à persister
        };
        
        // Préfixe pour localStorage
        this.storagePrefix = 'iem_cache_';
        
        // Démarrer le nettoyage automatique
        this.startCleanup();
        
        // Charger les données persistantes au démarrage
        this.loadPersistentData();
    }

    /**
     * Obtenir une valeur du cache
     */
    get(key, options = {}) {
        // Vérifier d'abord le cache mémoire
        const memoryItem = this.memoryCache.get(key);
        if (memoryItem && !this.isExpired(memoryItem)) {
            return memoryItem.value;
        }
        
        // Si pas en mémoire, vérifier localStorage
        if (options.persistent !== false) {
            const storageItem = this.getFromStorage(key);
            if (storageItem && !this.isExpired(storageItem)) {
                // Remettre en cache mémoire pour accès plus rapide
                this.memoryCache.set(key, storageItem);
                return storageItem.value;
            }
        }
        
        return null;
    }

    /**
     * Mettre une valeur en cache
     */
    set(key, value, options = {}) {
        const ttl = options.ttl || this.config.defaultTTL;
        const expires = ttl === Infinity ? Infinity : Date.now() + ttl;
        
        const cacheItem = {
            key,
            value,
            expires,
            created: Date.now(),
            hits: 0
        };
        
        // Toujours mettre en cache mémoire
        this.setMemoryCache(key, cacheItem);
        
        // Persister si demandé ou si c'est une clé persistante
        if (options.persistent || this.config.persistentKeys.includes(key)) {
            this.setStorage(key, cacheItem);
        }
        
        return value;
    }

    /**
     * Supprimer une entrée du cache
     */
    delete(key) {
        this.memoryCache.delete(key);
        this.removeFromStorage(key);
    }

    /**
     * Vider tout le cache
     */
    clear(options = {}) {
        if (options.memory !== false) {
            this.memoryCache.clear();
        }
        
        if (options.storage !== false) {
            this.clearStorage();
        }
    }

    /**
     * Obtenir ou calculer une valeur (cache-aside pattern)
     */
    async getOrSet(key, factory, options = {}) {
        // Vérifier le cache
        const cached = this.get(key, options);
        if (cached !== null) {
            return cached;
        }
        
        // Si pas en cache, calculer la valeur
        try {
            const value = await factory();
            return this.set(key, value, options);
        } catch (error) {
            console.error(`Erreur calcul valeur pour ${key}:`, error);
            throw error;
        }
    }

    /**
     * Cache pour les requêtes API
     */
    async fetchWithCache(url, options = {}) {
        const cacheKey = this.generateCacheKey('api', url, options);
        const cacheTTL = options.cacheTTL || 60000; // 1 minute par défaut
        
        // Vérifier le cache
        const cached = this.get(cacheKey);
        if (cached && !options.forceRefresh) {
            console.log(`[Cache HIT] ${url}`);
            return cached;
        }
        
        console.log(`[Cache MISS] ${url}`);
        
        // Faire la requête
        try {
            const response = await window.api.request(url, options);
            
            // Mettre en cache seulement les réponses réussies
            if (response.success) {
                this.set(cacheKey, response, { 
                    ttl: cacheTTL,
                    persistent: options.persistCache 
                });
            }
            
            return response;
        } catch (error) {
            // En cas d'erreur, retourner la valeur cachée si disponible
            if (cached) {
                console.warn('Erreur API, utilisation du cache:', error);
                return cached;
            }
            throw error;
        }
    }

    /**
     * Invalider le cache par pattern
     */
    invalidate(pattern) {
        const regex = new RegExp(pattern);
        let count = 0;
        
        // Invalider dans le cache mémoire
        for (const key of this.memoryCache.keys()) {
            if (regex.test(key)) {
                this.memoryCache.delete(key);
                count++;
            }
        }
        
        // Invalider dans localStorage
        const storageKeys = this.getStorageKeys();
        for (const key of storageKeys) {
            if (regex.test(key)) {
                this.removeFromStorage(key);
                count++;
            }
        }
        
        console.log(`Cache invalidé: ${count} entrées supprimées (pattern: ${pattern})`);
        return count;
    }

    /**
     * Précharger des données en cache
     */
    async preload(requests) {
        const promises = requests.map(({ url, options }) => 
            this.fetchWithCache(url, { ...options, forceRefresh: true })
        );
        
        try {
            await Promise.all(promises);
            console.log(`Préchargement terminé: ${requests.length} requêtes`);
        } catch (error) {
            console.error('Erreur préchargement:', error);
        }
    }

    // =============================================
    // MÉTHODES PRIVÉES
    // =============================================

    /**
     * Vérifier si un élément est expiré
     */
    isExpired(item) {
        return item.expires !== Infinity && item.expires < Date.now();
    }

    /**
     * Gérer le cache mémoire avec limite de taille
     */
    setMemoryCache(key, item) {
        // Si limite atteinte, supprimer les éléments les moins utilisés
        if (this.memoryCache.size >= this.config.maxMemoryItems) {
            this.evictLRU();
        }
        
        this.memoryCache.set(key, item);
    }

    /**
     * Éviction LRU (Least Recently Used)
     */
    evictLRU() {
        let lruKey = null;
        let lruTime = Infinity;
        
        for (const [key, item] of this.memoryCache.entries()) {
            const lastAccess = item.lastAccess || item.created;
            if (lastAccess < lruTime) {
                lruTime = lastAccess;
                lruKey = key;
            }
        }
        
        if (lruKey) {
            this.memoryCache.delete(lruKey);
        }
    }

    /**
     * Opérations localStorage
     */
    getFromStorage(key) {
        try {
            const data = localStorage.getItem(this.storagePrefix + key);
            return data ? JSON.parse(data) : null;
        } catch (error) {
            console.error('Erreur lecture localStorage:', error);
            return null;
        }
    }

    setStorage(key, value) {
        try {
            localStorage.setItem(this.storagePrefix + key, JSON.stringify(value));
        } catch (error) {
            console.error('Erreur écriture localStorage:', error);
            // Si quota dépassé, nettoyer et réessayer
            if (error.name === 'QuotaExceededError') {
                this.cleanupStorage();
                try {
                    localStorage.setItem(this.storagePrefix + key, JSON.stringify(value));
                } catch (retryError) {
                    console.error('Impossible de sauvegarder après nettoyage:', retryError);
                }
            }
        }
    }

    removeFromStorage(key) {
        localStorage.removeItem(this.storagePrefix + key);
    }

    getStorageKeys() {
        const keys = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key.startsWith(this.storagePrefix)) {
                keys.push(key.substring(this.storagePrefix.length));
            }
        }
        return keys;
    }

    clearStorage() {
        const keys = this.getStorageKeys();
        keys.forEach(key => this.removeFromStorage(key));
    }

    /**
     * Nettoyer les éléments expirés
     */
    cleanup() {
        let cleanedCount = 0;
        
        // Nettoyer le cache mémoire
        for (const [key, item] of this.memoryCache.entries()) {
            if (this.isExpired(item)) {
                this.memoryCache.delete(key);
                cleanedCount++;
            }
        }
        
        // Nettoyer localStorage
        const storageKeys = this.getStorageKeys();
        for (const key of storageKeys) {
            const item = this.getFromStorage(key);
            if (item && this.isExpired(item)) {
                this.removeFromStorage(key);
                cleanedCount++;
            }
        }
        
        if (cleanedCount > 0) {
            console.log(`Cache nettoyé: ${cleanedCount} entrées expirées supprimées`);
        }
    }

    /**
     * Démarrer le nettoyage automatique
     */
    startCleanup() {
        this.cleanupInterval = setInterval(() => {
            this.cleanup();
        }, this.config.cleanupInterval);
    }

    /**
     * Arrêter le nettoyage automatique
     */
    stopCleanup() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
        }
    }

    /**
     * Charger les données persistantes
     */
    loadPersistentData() {
        for (const key of this.config.persistentKeys) {
            const data = this.getFromStorage(key);
            if (data) {
                this.memoryCache.set(key, data);
            }
        }
    }

    /**
     * Générer une clé de cache unique
     */
    generateCacheKey(prefix, ...params) {
        const hash = params
            .map(p => typeof p === 'object' ? JSON.stringify(p) : String(p))
            .join('|');
        return `${prefix}:${hash}`;
    }

    /**
     * Obtenir des statistiques du cache
     */
    getStats() {
        const storageKeys = this.getStorageKeys();
        const memorySize = JSON.stringify([...this.memoryCache.values()]).length;
        
        return {
            memory: {
                count: this.memoryCache.size,
                sizeEstimate: `${(memorySize / 1024).toFixed(2)} KB`
            },
            storage: {
                count: storageKeys.length,
                keys: storageKeys
            },
            total: this.memoryCache.size + storageKeys.length
        };
    }
}

// Instance singleton
const cacheManager = new CacheManager();

// Exposer globalement
window.cache = cacheManager;

// Export pour les modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = cacheManager;
}