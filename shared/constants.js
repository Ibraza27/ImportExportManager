/**
 * Constantes partagées entre client et serveur
 * Import Export Manager
 */

// =============================================
// STATUTS
// =============================================

const STATUS = {
    // Statuts généraux
    ACTIVE: 'actif',
    INACTIVE: 'inactif',
    PENDING: 'en_attente',
    COMPLETED: 'complete',
    CANCELLED: 'annule',
    
    // Statuts clients
    CLIENT: {
        ACTIVE: 'actif',
        INACTIVE: 'inactif',
        BLACKLISTED: 'blackliste',
        PROSPECT: 'prospect'
    },
    
    // Statuts marchandises
    MARCHANDISE: {
        EN_ATTENTE: 'en_attente',
        AFFECTE: 'affecte',
        EN_TRANSIT: 'en_transit',
        ARRIVE: 'arrive',
        LIVRE: 'livre',
        PROBLEME: 'probleme',
        PERDU: 'perdu'
    },
    
    // Statuts conteneurs
    CONTENEUR: {
        EN_PREPARATION: 'en_preparation',
        EN_COURS_CHARGEMENT: 'en_cours_chargement',
        COMPLET: 'complet',
        EXPEDIE: 'expedie',
        EN_TRANSIT: 'en_transit',
        ARRIVE: 'arrive',
        EN_COURS_DEDOUANEMENT: 'en_cours_dedouanement',
        LIVRE: 'livre',
        CLOTURE: 'cloture'
    },
    
    // Statuts paiements
    PAIEMENT: {
        EN_ATTENTE: 'en_attente',
        VALIDE: 'valide',
        REFUSE: 'refuse',
        REMBOURSE: 'rembourse',
        ANNULE: 'annule'
    },
    
    // Statuts utilisateurs
    UTILISATEUR: {
        ACTIF: 'actif',
        INACTIF: 'inactif',
        SUSPENDU: 'suspendu',
        SUPPRIME: 'supprime'
    }
};

// =============================================
// TYPES
// =============================================

const TYPES = {
    // Types de marchandises
    MARCHANDISE: {
        COLIS: 'colis',
        PALETTE: 'palette',
        CONTENEUR_COMPLET: 'conteneur_complet',
        VEHICULE: 'vehicule',
        VRAC: 'vrac',
        FRAGILE: 'fragile',
        DANGEREUX: 'dangereux'
    },
    
    // Types d'envoi
    ENVOI: {
        STANDARD: 'standard',
        EXPRESS: 'express',
        ECONOMIQUE: 'economique',
        GROUPAGE: 'groupage',
        COMPLET: 'complet'
    },
    
    // Types de conteneurs
    CONTENEUR: {
        '20GP': '20_pieds_standard',
        '40GP': '40_pieds_standard',
        '40HC': '40_pieds_high_cube',
        '20RF': '20_pieds_frigo',
        '40RF': '40_pieds_frigo',
        'OPEN_TOP': 'open_top',
        'FLAT_RACK': 'flat_rack'
    },
    
    // Types de documents
    DOCUMENT: {
        FACTURE: 'facture',
        RECU: 'recu',
        BON_LIVRAISON: 'bon_livraison',
        MANIFESTE: 'manifeste',
        DOUANE: 'douane',
        ASSURANCE: 'assurance',
        PHOTO: 'photo',
        AUTRE: 'autre'
    },
    
    // Types de paiements
    PAIEMENT: {
        ESPECES: 'especes',
        CHEQUE: 'cheque',
        VIREMENT: 'virement',
        CARTE: 'carte',
        MOBILE: 'mobile',
        CRYPTO: 'crypto'
    },
    
    // Types de notifications
    NOTIFICATION: {
        INFO: 'info',
        SUCCESS: 'success',
        WARNING: 'warning',
        ERROR: 'error',
        SYSTEM: 'system',
        USER: 'user'
    }
};

// =============================================
// ÉTATS
// =============================================

const ETATS = {
    // États des colis
    COLIS: {
        NEUF: 'neuf',
        BON: 'bon',
        ACCEPTABLE: 'acceptable',
        ENDOMMAGE: 'endommage',
        TRES_ENDOMMAGE: 'tres_endommage',
        DETRUIT: 'detruit'
    },
    
    // États de paiement
    BALANCE: {
        PAYE: 'paye',
        PARTIEL: 'partiel',
        IMPAYE: 'impaye',
        EN_RETARD: 'en_retard',
        LITIGE: 'litige'
    }
};

// =============================================
// PRIORITÉS
// =============================================

const PRIORITES = {
    BASSE: 'basse',
    NORMALE: 'normale',
    HAUTE: 'haute',
    URGENTE: 'urgente',
    CRITIQUE: 'critique'
};

// =============================================
// LIMITES ET CONTRAINTES
// =============================================

const LIMITES = {
    // Pagination
    PAGINATION: {
        MIN: 10,
        DEFAULT: 25,
        MAX: 100,
        OPTIONS: [10, 25, 50, 100]
    },
    
    // Uploads
    UPLOAD: {
        MAX_FILE_SIZE: 10 * 1024 * 1024, // 10 MB
        MAX_FILES: 10,
        ALLOWED_IMAGE_TYPES: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
        ALLOWED_DOCUMENT_TYPES: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
    },
    
    // Textes
    TEXT: {
        NOM_MIN: 2,
        NOM_MAX: 100,
        DESCRIPTION_MAX: 500,
        COMMENTAIRE_MAX: 1000,
        CODE_LENGTH: 6,
        TELEPHONE_MIN: 10,
        TELEPHONE_MAX: 20
    },
    
    // Nombres
    NUMBERS: {
        MONTANT_MIN: 0,
        MONTANT_MAX: 999999999.99,
        POIDS_MIN: 0,
        POIDS_MAX: 99999.999,
        VOLUME_MIN: 0,
        VOLUME_MAX: 9999.999
    },
    
    // Dates
    DATES: {
        MIN_YEAR: 2020,
        MAX_FUTURE_DAYS: 365
    }
};

// =============================================
// FORMATS
// =============================================

const FORMATS = {
    // Formats de date
    DATE: {
        DISPLAY: 'DD/MM/YYYY',
        INPUT: 'YYYY-MM-DD',
        DATETIME: 'DD/MM/YYYY HH:mm',
        TIME: 'HH:mm',
        API: 'YYYY-MM-DDTHH:mm:ss.SSSZ'
    },
    
    // Formats de numéros
    NUMBER: {
        DECIMAL_SEPARATOR: ',',
        THOUSAND_SEPARATOR: ' ',
        CURRENCY_DECIMALS: 2,
        WEIGHT_DECIMALS: 3,
        VOLUME_DECIMALS: 3
    },
    
    // Formats de codes
    CODE: {
        CLIENT: 'CL-{NUMBER}',
        MARCHANDISE: 'MA-{NUMBER}',
        CONTENEUR: 'DO-{YEAR}-{NUMBER}',
        PAIEMENT: 'PAY-{YEAR}{MONTH}-{NUMBER}',
        FACTURE: 'FAC-{YEAR}-{NUMBER}'
    }
};

// =============================================
// MESSAGES
// =============================================

const MESSAGES = {
    // Messages de succès
    SUCCESS: {
        CREATE: 'Création effectuée avec succès',
        UPDATE: 'Mise à jour effectuée avec succès',
        DELETE: 'Suppression effectuée avec succès',
        SAVE: 'Enregistrement effectué avec succès',
        SEND: 'Envoi effectué avec succès',
        IMPORT: 'Import effectué avec succès',
        EXPORT: 'Export effectué avec succès',
        LOGIN: 'Connexion réussie',
        LOGOUT: 'Déconnexion réussie'
    },
    
    // Messages d'erreur
    ERROR: {
        GENERIC: 'Une erreur est survenue',
        NETWORK: 'Erreur de connexion réseau',
        SERVER: 'Erreur serveur',
        VALIDATION: 'Données invalides',
        NOT_FOUND: 'Élément non trouvé',
        UNAUTHORIZED: 'Non autorisé',
        FORBIDDEN: 'Accès interdit',
        CONFLICT: 'Conflit de données',
        FILE_TOO_LARGE: 'Fichier trop volumineux',
        INVALID_FILE_TYPE: 'Type de fichier non autorisé',
        REQUIRED_FIELD: 'Ce champ est obligatoire',
        INVALID_FORMAT: 'Format invalide',
        MIN_LENGTH: 'Longueur minimale non respectée',
        MAX_LENGTH: 'Longueur maximale dépassée'
    },
    
    // Messages de confirmation
    CONFIRM: {
        DELETE: 'Êtes-vous sûr de vouloir supprimer cet élément ?',
        LOGOUT: 'Êtes-vous sûr de vouloir vous déconnecter ?',
        CANCEL: 'Êtes-vous sûr de vouloir annuler ?',
        CLOSE: 'Êtes-vous sûr de vouloir fermer ?',
        SEND: 'Êtes-vous sûr de vouloir envoyer ?'
    },
    
    // Messages d'information
    INFO: {
        LOADING: 'Chargement en cours...',
        PROCESSING: 'Traitement en cours...',
        NO_DATA: 'Aucune donnée disponible',
        EMPTY_LIST: 'La liste est vide',
        SEARCH_HINT: 'Rechercher...',
        SELECT_HINT: 'Sélectionner...'
    }
};

// =============================================
// COULEURS
// =============================================

const COLORS = {
    // Couleurs de statut
    STATUS: {
        SUCCESS: '#10b981',
        WARNING: '#f59e0b',
        ERROR: '#ef4444',
        INFO: '#3b82f6',
        SECONDARY: '#6b7280'
    },
    
    // Couleurs de priorité
    PRIORITY: {
        BASSE: '#6b7280',
        NORMALE: '#3b82f6',
        HAUTE: '#f59e0b',
        URGENTE: '#ef4444',
        CRITIQUE: '#7c3aed'
    },
    
    // Couleurs de thème
    THEME: {
        PRIMARY: '#3b82f6',
        SECONDARY: '#6b7280',
        SUCCESS: '#10b981',
        WARNING: '#f59e0b',
        DANGER: '#ef4444',
        INFO: '#06b6d4',
        LIGHT: '#f3f4f6',
        DARK: '#1f2937'
    }
};

// =============================================
// ICÔNES
// =============================================

const ICONS = {
    // Icônes d'entités
    ENTITY: {
        CLIENT: 'fas fa-users',
        MARCHANDISE: 'fas fa-box',
        CONTENEUR: 'fas fa-cube',
        PAIEMENT: 'fas fa-euro-sign',
        UTILISATEUR: 'fas fa-user',
        RAPPORT: 'fas fa-chart-bar'
    },
    
    // Icônes d'actions
    ACTION: {
        ADD: 'fas fa-plus',
        EDIT: 'fas fa-edit',
        DELETE: 'fas fa-trash',
        VIEW: 'fas fa-eye',
        SEARCH: 'fas fa-search',
        FILTER: 'fas fa-filter',
        EXPORT: 'fas fa-download',
        IMPORT: 'fas fa-upload',
        PRINT: 'fas fa-print',
        SAVE: 'fas fa-save',
        CANCEL: 'fas fa-times',
        REFRESH: 'fas fa-sync',
        SCAN: 'fas fa-barcode'
    },
    
    // Icônes de statut
    STATUS: {
        SUCCESS: 'fas fa-check-circle',
        WARNING: 'fas fa-exclamation-triangle',
        ERROR: 'fas fa-times-circle',
        INFO: 'fas fa-info-circle',
        PENDING: 'fas fa-clock'
    }
};

// =============================================
// REGEX PATTERNS
// =============================================

const PATTERNS = {
    EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    TELEPHONE: /^[+]?[(]?[0-9]{3}[)]?[-\s.]?[(]?[0-9]{3}[)]?[-\s.]?[0-9]{4,6}$/,
    CODE_POSTAL: /^[0-9]{5}$/,
    NUMERO_CONTENEUR: /^[A-Z]{4}[0-9]{7}$/,
    CODE_CLIENT: /^CL-[0-9]{6}$/,
    CODE_MARCHANDISE: /^MA-[0-9]{6}$/,
    CODE_DOSSIER: /^DO-[0-9]{4}-[0-9]{3}$/
};

// =============================================
// UNITÉS
// =============================================

const UNITES = {
    POIDS: {
        KG: 'kg',
        TON: 't',
        LB: 'lb'
    },
    
    VOLUME: {
        M3: 'm³',
        L: 'L',
        FT3: 'ft³'
    },
    
    DIMENSION: {
        M: 'm',
        CM: 'cm',
        MM: 'mm',
        FT: 'ft',
        IN: 'in'
    },
    
    MONNAIE: {
        EUR: '€',
        USD: '$',
        GBP: '£',
        XOF: 'FCFA'
    }
};

// =============================================
// PAYS ET VILLES
// =============================================

const LOCATIONS = {
    // Pays fréquents
    PAYS: {
        FR: { code: 'FR', nom: 'France', phone: '+33' },
        BE: { code: 'BE', nom: 'Belgique', phone: '+32' },
        DE: { code: 'DE', nom: 'Allemagne', phone: '+49' },
        ES: { code: 'ES', nom: 'Espagne', phone: '+34' },
        IT: { code: 'IT', nom: 'Italie', phone: '+39' },
        NL: { code: 'NL', nom: 'Pays-Bas', phone: '+31' },
        GB: { code: 'GB', nom: 'Royaume-Uni', phone: '+44' },
        US: { code: 'US', nom: 'États-Unis', phone: '+1' },
        CN: { code: 'CN', nom: 'Chine', phone: '+86' },
        JP: { code: 'JP', nom: 'Japon', phone: '+81' }
    },
    
    // Ports principaux
    PORTS: {
        LEHAVRE: { code: 'FRLEH', nom: 'Le Havre', pays: 'FR' },
        MARSEILLE: { code: 'FRFOS', nom: 'Marseille', pays: 'FR' },
        ANVERS: { code: 'BEANR', nom: 'Anvers', pays: 'BE' },
        ROTTERDAM: { code: 'NLRTM', nom: 'Rotterdam', pays: 'NL' },
        HAMBOURG: { code: 'DEHAM', nom: 'Hambourg', pays: 'DE' },
        SHANGHAI: { code: 'CNSHA', nom: 'Shanghai', pays: 'CN' }
    }
};

// =============================================
// EXPORT
// =============================================

// Export pour Node.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        STATUS,
        TYPES,
        ETATS,
        PRIORITES,
        LIMITES,
        FORMATS,
        MESSAGES,
        COLORS,
        ICONS,
        PATTERNS,
        UNITES,
        LOCATIONS
    };
}

// Export pour ES6
if (typeof window !== 'undefined') {
    window.CONSTANTS = {
        STATUS,
        TYPES,
        ETATS,
        PRIORITES,
        LIMITES,
        FORMATS,
        MESSAGES,
        COLORS,
        ICONS,
        PATTERNS,
        UNITES,
        LOCATIONS
    };
}