/**
 * Constantes globales de l'application
 * Centralise toutes les valeurs constantes utilisées dans l'application
 */

window.CONSTANTS = {
    // =============================================
    // STATUTS
    // =============================================
    
    // Statuts des clients
    CLIENT_STATUS: {
        ACTIVE: 'actif',
        INACTIVE: 'inactif',
        SUSPENDED: 'suspendu'
    },
    
    // Types de clients
    CLIENT_TYPES: {
        PARTICULAR: 'particulier',
        COMPANY: 'entreprise'
    },
    
    // Statuts des marchandises
    GOODS_STATUS: {
        RECEIVED: 'receptionne',
        WAITING: 'en_attente',
        ASSIGNED: 'affecte',
        IN_TRANSIT: 'en_transit',
        ARRIVED: 'arrive',
        DELIVERED: 'livre',
        PROBLEM: 'probleme'
    },
    
    // États de réception
    RECEPTION_STATE: {
        GOOD: 'bon_etat',
        DAMAGED: 'endommage',
        FRAGILE: 'fragile',
        MISSING: 'manquant'
    },
    
    // Modes de réception
    RECEPTION_MODE: {
        POST: 'poste',
        CLIENT_DEPOSIT: 'depot_client',
        COURIER: 'coursier'
    },
    
    // Types de marchandises
    GOODS_TYPES: {
        PACKAGE: 'colis',
        VEHICLE: 'vehicule',
        PALLET: 'palette',
        OTHER: 'autre'
    },
    
    // Statuts des conteneurs
    CONTAINER_STATUS: {
        OPEN: 'ouvert',
        PREPARING: 'en_preparation',
        IN_TRANSIT: 'en_transit',
        ARRIVED: 'arrive',
        CLOSED: 'cloture'
    },
    
    // Types d'envoi
    SHIPPING_TYPES: {
        WITH_CUSTOMS: 'avec_dedouanement',
        SIMPLE: 'simple_envoi'
    },
    
    // Statuts des paiements
    PAYMENT_STATUS: {
        PENDING: 'en_attente',
        VALID: 'valide',
        CANCELLED: 'annule',
        REFUNDED: 'rembourse'
    },
    
    // Types de paiements
    PAYMENT_TYPES: {
        DEPOSIT: 'acompte',
        BALANCE: 'solde',
        TOTAL: 'total',
        REFUND: 'remboursement'
    },
    
    // Modes de paiement
    PAYMENT_MODES: {
        CASH: 'especes',
        TRANSFER: 'virement',
        CHECK: 'cheque',
        CARD: 'carte',
        MOBILE_MONEY: 'mobile_money'
    },
    
    // =============================================
    // COULEURS ET BADGES
    // =============================================
    
    // Couleurs des statuts
    STATUS_COLORS: {
        // Général
        active: 'success',
        inactive: 'secondary',
        suspended: 'danger',
        
        // Marchandises
        receptionne: 'info',
        en_attente: 'warning',
        affecte: 'primary',
        en_transit: 'info',
        arrive: 'success',
        livre: 'success',
        probleme: 'danger',
        
        // Conteneurs
        ouvert: 'primary',
        en_preparation: 'warning',
        cloture: 'secondary',
        
        // Paiements
        valide: 'success',
        annule: 'danger',
        rembourse: 'info'
    },
    
    // Icônes des statuts
    STATUS_ICONS: {
        // Général
        active: 'fa-check-circle',
        inactive: 'fa-pause-circle',
        suspended: 'fa-ban',
        
        // Marchandises
        receptionne: 'fa-inbox',
        en_attente: 'fa-clock',
        affecte: 'fa-link',
        en_transit: 'fa-truck',
        arrive: 'fa-flag-checkered',
        livre: 'fa-check',
        probleme: 'fa-exclamation-triangle',
        
        // États
        bon_etat: 'fa-check',
        endommage: 'fa-exclamation-triangle',
        fragile: 'fa-glass',
        manquant: 'fa-question',
        
        // Conteneurs
        ouvert: 'fa-box-open',
        en_preparation: 'fa-cog',
        cloture: 'fa-lock',
        
        // Paiements
        especes: 'fa-money-bill',
        virement: 'fa-exchange-alt',
        cheque: 'fa-file-invoice',
        carte: 'fa-credit-card',
        mobile_money: 'fa-mobile-alt'
    },
    
    // =============================================
    // CONFIGURATIONS
    // =============================================
    
    // Pagination
    PAGINATION: {
        DEFAULT_PAGE_SIZE: 25,
        PAGE_SIZE_OPTIONS: [10, 25, 50, 100],
        MAX_PAGE_SIZE: 100
    },
    
    // Limites
    LIMITS: {
        MAX_FILE_SIZE: 10 * 1024 * 1024, // 10 MB
        MAX_PHOTOS_PER_ITEM: 5,
        MIN_PASSWORD_LENGTH: 8,
        MAX_SEARCH_RESULTS: 100,
        CACHE_DURATION: 5 * 60 * 1000, // 5 minutes
        SESSION_TIMEOUT: 24 * 60 * 60 * 1000 // 24 heures
    },
    
    // Formats
    FORMATS: {
        DATE: 'DD/MM/YYYY',
        DATETIME: 'DD/MM/YYYY HH:mm',
        TIME: 'HH:mm',
        CURRENCY: 'EUR',
        WEIGHT_UNIT: 'kg',
        VOLUME_UNIT: 'm³',
        BARCODE_PREFIX: 'CB',
        CLIENT_CODE_PREFIX: 'CLI',
        RECEIPT_PREFIX: 'REC'
    },
    
    // Intervalles de rafraîchissement (en ms)
    REFRESH_INTERVALS: {
        DASHBOARD: 30000, // 30 secondes
        NOTIFICATIONS: 60000, // 1 minute
        AUTO_SAVE: 30000, // 30 secondes
        CONNECTION_CHECK: 10000 // 10 secondes
    },
    
    // =============================================
    // MESSAGES
    // =============================================
    
    MESSAGES: {
        // Succès
        SUCCESS: {
            SAVED: 'Enregistrement effectué avec succès',
            UPDATED: 'Mise à jour effectuée avec succès',
            DELETED: 'Suppression effectuée avec succès',
            SENT: 'Envoi effectué avec succès',
            COPIED: 'Copié dans le presse-papier',
            CONNECTED: 'Connexion établie',
            PAYMENT_RECORDED: 'Paiement enregistré avec succès'
        },
        
        // Erreurs
        ERROR: {
            GENERIC: 'Une erreur est survenue',
            CONNECTION: 'Erreur de connexion au serveur',
            VALIDATION: 'Veuillez vérifier les données saisies',
            NOT_FOUND: 'Élément introuvable',
            UNAUTHORIZED: 'Action non autorisée',
            FILE_TOO_LARGE: 'Le fichier est trop volumineux',
            INVALID_FORMAT: 'Format invalide',
            REQUIRED_FIELD: 'Ce champ est obligatoire'
        },
        
        // Confirmations
        CONFIRM: {
            DELETE: 'Êtes-vous sûr de vouloir supprimer cet élément ?',
            LOGOUT: 'Êtes-vous sûr de vouloir vous déconnecter ?',
            CANCEL: 'Êtes-vous sûr de vouloir annuler ?',
            CLOSE_CONTAINER: 'Êtes-vous sûr de vouloir clôturer ce conteneur ?'
        },
        
        // Informations
        INFO: {
            LOADING: 'Chargement en cours...',
            NO_DATA: 'Aucune donnée disponible',
            SEARCH_HINT: 'Entrez au moins 2 caractères pour rechercher',
            DEVELOPING: 'Cette fonctionnalité est en cours de développement'
        }
    },
    
    // =============================================
    // RÔLES ET PERMISSIONS
    // =============================================
    
    ROLES: {
        ADMIN: 'admin',
        MANAGER: 'gestionnaire',
        OPERATOR: 'operateur',
        ACCOUNTANT: 'comptable',
        GUEST: 'invite'
    },
    
    PERMISSIONS: {
        // Clients
        CLIENT_VIEW: 'client.view',
        CLIENT_CREATE: 'client.create',
        CLIENT_UPDATE: 'client.update',
        CLIENT_DELETE: 'client.delete',
        
        // Marchandises
        GOODS_VIEW: 'goods.view',
        GOODS_CREATE: 'goods.create',
        GOODS_UPDATE: 'goods.update',
        GOODS_DELETE: 'goods.delete',
        GOODS_SCAN: 'goods.scan',
        
        // Conteneurs
        CONTAINER_VIEW: 'container.view',
        CONTAINER_CREATE: 'container.create',
        CONTAINER_UPDATE: 'container.update',
        CONTAINER_DELETE: 'container.delete',
        CONTAINER_CLOSE: 'container.close',
        
        // Paiements
        PAYMENT_VIEW: 'payment.view',
        PAYMENT_CREATE: 'payment.create',
        PAYMENT_UPDATE: 'payment.update',
        PAYMENT_DELETE: 'payment.delete',
        
        // Rapports
        REPORT_VIEW: 'report.view',
        REPORT_EXPORT: 'report.export',
        
        // Administration
        USER_MANAGE: 'user.manage',
        SETTINGS_MANAGE: 'settings.manage',
        BACKUP_MANAGE: 'backup.manage'
    },
    
    // Mapping rôles -> permissions
    ROLE_PERMISSIONS: {
        admin: '*', // Toutes les permissions
        gestionnaire: [
            'client.*', 'goods.*', 'container.*', 'payment.*', 'report.*'
        ],
        operateur: [
            'client.view', 'client.create', 'client.update',
            'goods.*', 'container.view', 'container.update',
            'payment.view', 'payment.create'
        ],
        comptable: [
            'client.view', 'goods.view', 'container.view',
            'payment.*', 'report.*'
        ],
        invite: [
            'client.view', 'goods.view', 'container.view',
            'payment.view', 'report.view'
        ]
    },
    
    // =============================================
    // REGEX PATTERNS
    // =============================================
    
    PATTERNS: {
        EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        PHONE: /^[\d\s\-\+\(\)]+$/,
        BARCODE: /^[A-Z0-9\-]+$/,
        CLIENT_CODE: /^CLI[A-Z0-9]+$/,
        CONTAINER_NUMBER: /^[A-Z]{4}\d{7}$/,
        POSTAL_CODE: /^\d{5}$/
    },
    
    // =============================================
    // DESTINATIONS POPULAIRES
    // =============================================
    
    POPULAR_DESTINATIONS: [
        { country: 'France', port: 'Le Havre' },
        { country: 'France', port: 'Marseille' },
        { country: 'Belgique', port: 'Anvers' },
        { country: 'Pays-Bas', port: 'Rotterdam' },
        { country: 'Allemagne', port: 'Hambourg' },
        { country: 'Espagne', port: 'Barcelone' },
        { country: 'Italie', port: 'Gênes' },
        { country: 'Maroc', port: 'Casablanca' },
        { country: 'Algérie', port: 'Alger' },
        { country: 'Tunisie', port: 'Tunis' },
        { country: 'Sénégal', port: 'Dakar' },
        { country: 'Côte d\'Ivoire', port: 'Abidjan' }
    ],
    
    // =============================================
    // RACCOURCIS CLAVIER
    // =============================================
    
    SHORTCUTS: {
        NEW_CLIENT: 'Ctrl+N',
        NEW_CONTAINER: 'Ctrl+Shift+N',
        SEARCH: 'Ctrl+K',
        SCANNER: 'Ctrl+B',
        SAVE: 'Ctrl+S',
        REFRESH: 'F5',
        HELP: 'F1',
        FULLSCREEN: 'F11',
        ESCAPE: 'Esc'
    }
};