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

/**
 * Gestionnaire de stockage local
 * Gère le cache, les préférences utilisateur et les données temporaires
 */

window.Storage = (function() {
    // Préfixes pour organiser les clés
    const PREFIXES = {
        CACHE: 'cache_',
        PREF: 'pref_',
        TEMP: 'temp_',
        USER: 'user_'
    };
    
    // Durée de vie par défaut du cache (en millisecondes)
    const DEFAULT_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
    
    // =============================================
    // MÉTHODES DE BASE
    // =============================================
    
    function set(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
            return true;
        } catch (error) {
            electronAPI.log.error('Erreur stockage local:', error);
            return false;
        }
    }
    
    function get(key, defaultValue = null) {
        try {
            const item = localStorage.getItem(key);
            return item ? JSON.parse(item) : defaultValue;
        } catch (error) {
            electronAPI.log.error('Erreur lecture stockage local:', error);
            return defaultValue;
        }
    }
    
    function remove(key) {
        localStorage.removeItem(key);
    }
    
    function clear(prefix = null) {
        if (prefix) {
            // Supprimer seulement les clés avec le préfixe
            const keys = Object.keys(localStorage);
            keys.forEach(key => {
                if (key.startsWith(prefix)) {
                    localStorage.removeItem(key);
                }
            });
        } else {
            // Tout supprimer
            localStorage.clear();
        }
    }
    
    function exists(key) {
        return localStorage.getItem(key) !== null;
    }
    
    // =============================================
    // GESTION DU CACHE
    // =============================================
    
    function setCache(key, value, duration = DEFAULT_CACHE_DURATION) {
        const cacheKey = PREFIXES.CACHE + key;
        const cacheData = {
            value: value,
            timestamp: Date.now(),
            expiry: Date.now() + duration
        };
        set(cacheKey, cacheData);
    }
    
    function getCache(key, defaultValue = null) {
        const cacheKey = PREFIXES.CACHE + key;
        const cacheData = get(cacheKey);
        
        if (!cacheData) return defaultValue;
        
        // Vérifier si le cache a expiré
        if (Date.now() > cacheData.expiry) {
            remove(cacheKey);
            return defaultValue;
        }
        
        return cacheData.value;
    }
    
    function invalidateCache(key = null) {
        if (key) {
            remove(PREFIXES.CACHE + key);
        } else {
            clear(PREFIXES.CACHE);
        }
    }
    
    function getCacheInfo() {
        const keys = Object.keys(localStorage);
        const cacheKeys = keys.filter(key => key.startsWith(PREFIXES.CACHE));
        
        return cacheKeys.map(key => {
            const data = get(key);
            return {
                key: key.replace(PREFIXES.CACHE, ''),
                size: JSON.stringify(data).length,
                timestamp: data.timestamp,
                expiry: data.expiry,
                expired: Date.now() > data.expiry
            };
        });
    }
    
    // =============================================
    // GESTION DES PRÉFÉRENCES
    // =============================================
    
    function setPreference(key, value) {
        const prefKey = PREFIXES.PREF + key;
        set(prefKey, value);
        
        // Émettre un événement pour notifier le changement
        window.dispatchEvent(new CustomEvent('preferenceChanged', {
            detail: { key, value }
        }));
    }
    
    function getPreference(key, defaultValue = null) {
        const prefKey = PREFIXES.PREF + key;
        return get(prefKey, defaultValue);
    }
    
    function getAllPreferences() {
        const keys = Object.keys(localStorage);
        const preferences = {};
        
        keys.forEach(key => {
            if (key.startsWith(PREFIXES.PREF)) {
                const prefKey = key.replace(PREFIXES.PREF, '');
                preferences[prefKey] = get(key);
            }
        });
        
        return preferences;
    }
    
    // Préférences par défaut
    const DEFAULT_PREFERENCES = {
        theme: 'dark',
        language: 'fr',
        itemsPerPage: 25,
        autoSave: true,
        notifications: true,
        compactView: false,
        showTips: true
    };
    
    function initializePreferences() {
        Object.entries(DEFAULT_PREFERENCES).forEach(([key, value]) => {
            if (!exists(PREFIXES.PREF + key)) {
                setPreference(key, value);
            }
        });
    }
    
    // =============================================
    // DONNÉES TEMPORAIRES
    // =============================================
    
    function setTemp(key, value) {
        const tempKey = PREFIXES.TEMP + key;
        set(tempKey, {
            value: value,
            timestamp: Date.now()
        });
    }
    
    function getTemp(key, defaultValue = null) {
        const tempKey = PREFIXES.TEMP + key;
        const data = get(tempKey);
        return data ? data.value : defaultValue;
    }
    
    function clearTemp() {
        clear(PREFIXES.TEMP);
    }
    
    // =============================================
    // DONNÉES UTILISATEUR
    // =============================================
    
    function setUserData(key, value) {
        const userKey = PREFIXES.USER + key;
        set(userKey, value);
    }
    
    function getUserData(key, defaultValue = null) {
        const userKey = PREFIXES.USER + key;
        return get(userKey, defaultValue);
    }
    
    function clearUserData() {
        clear(PREFIXES.USER);
    }
    
    // =============================================
    // GESTION DES FORMULAIRES
    // =============================================
    
    function saveFormData(formId, data) {
        setTemp(`form_${formId}`, data);
    }
    
    function getFormData(formId) {
        return getTemp(`form_${formId}`, {});
    }
    
    function clearFormData(formId) {
        remove(PREFIXES.TEMP + `form_${formId}`);
    }
    
    // Auto-sauvegarde des formulaires
    function enableFormAutoSave(formElement, formId) {
        let saveTimeout;
        
        formElement.addEventListener('input', () => {
            clearTimeout(saveTimeout);
            saveTimeout = setTimeout(() => {
                const formData = new FormData(formElement);
                const data = {};
                formData.forEach((value, key) => {
                    data[key] = value;
                });
                saveFormData(formId, data);
                electronAPI.log.debug(`Formulaire ${formId} sauvegardé automatiquement`);
            }, 1000); // Sauvegarder après 1 seconde d'inactivité
        });
        
        // Restaurer les données au chargement
        const savedData = getFormData(formId);
        if (Object.keys(savedData).length > 0) {
            Object.entries(savedData).forEach(([key, value]) => {
                const field = formElement.elements[key];
                if (field) {
                    field.value = value;
                }
            });
            electronAPI.log.debug(`Formulaire ${formId} restauré`);
        }
    }
    
    // =============================================
    // STATISTIQUES DE STOCKAGE
    // =============================================
    
    function getStorageSize() {
        let totalSize = 0;
        
        Object.keys(localStorage).forEach(key => {
            const value = localStorage.getItem(key);
            totalSize += key.length + value.length;
        });
        
        return {
            bytes: totalSize,
            kilobytes: (totalSize / 1024).toFixed(2),
            megabytes: (totalSize / 1024 / 1024).toFixed(2),
            percentage: ((totalSize / 5242880) * 100).toFixed(2) // 5MB limite approximative
        };
    }
    
    function getStorageStats() {
        const keys = Object.keys(localStorage);
        const stats = {
            total: keys.length,
            cache: 0,
            preferences: 0,
            temporary: 0,
            user: 0,
            other: 0
        };
        
        keys.forEach(key => {
            if (key.startsWith(PREFIXES.CACHE)) stats.cache++;
            else if (key.startsWith(PREFIXES.PREF)) stats.preferences++;
            else if (key.startsWith(PREFIXES.TEMP)) stats.temporary++;
            else if (key.startsWith(PREFIXES.USER)) stats.user++;
            else stats.other++;
        });
        
        return stats;
    }
    
    // =============================================
    // NETTOYAGE ET MAINTENANCE
    // =============================================
    
    function cleanup() {
        electronAPI.log.info('Nettoyage du stockage local...');
        
        // Supprimer le cache expiré
        const cacheInfo = getCacheInfo();
        let cleaned = 0;
        
        cacheInfo.forEach(item => {
            if (item.expired) {
                remove(PREFIXES.CACHE + item.key);
                cleaned++;
            }
        });
        
        // Supprimer les données temporaires anciennes (> 24h)
        const keys = Object.keys(localStorage);
        keys.forEach(key => {
            if (key.startsWith(PREFIXES.TEMP)) {
                const data = get(key);
                if (data && data.timestamp && Date.now() - data.timestamp > 86400000) {
                    remove(key);
                    cleaned++;
                }
            }
        });
        
        electronAPI.log.info(`Nettoyage terminé: ${cleaned} éléments supprimés`);
        return cleaned;
    }
    
    // Nettoyage automatique au démarrage
    setTimeout(cleanup, 5000); // 5 secondes après le chargement
    
    // Nettoyage périodique
    setInterval(cleanup, 3600000); // Toutes les heures
    
    // =============================================
    // EXPORT PUBLIC API
    // =============================================
    
    return {
        // Méthodes de base
        set,
        get,
        remove,
        clear,
        exists,
        
        // Cache
        setCache,
        getCache,
        invalidateCache,
        getCacheInfo,
        
        // Préférences
        setPreference,
        getPreference,
        getAllPreferences,
        initializePreferences,
        
        // Données temporaires
        setTemp,
        getTemp,
        clearTemp,
        
        // Données utilisateur
        setUserData,
        getUserData,
        clearUserData,
        
        // Formulaires
        saveFormData,
        getFormData,
        clearFormData,
        enableFormAutoSave,
        
        // Statistiques et maintenance
        getStorageSize,
        getStorageStats,
        cleanup
    };
})();

// Initialiser les préférences par défaut
Storage.initializePreferences();