/**
 * Types et interfaces partagés entre client et serveur
 * Import Export Manager
 * 
 * Note: Ce fichier utilise JSDoc pour la documentation des types
 * Compatible avec TypeScript via les commentaires JSDoc
 */

// =============================================
// TYPES DE BASE
// =============================================

/**
 * @typedef {string} UUID
 * @description Identifiant unique universel
 */

/**
 * @typedef {string} ISODate
 * @description Date au format ISO 8601
 */

/**
 * @typedef {number} Timestamp
 * @description Timestamp Unix en millisecondes
 */

/**
 * @typedef {Object} Coordinates
 * @property {number} latitude
 * @property {number} longitude
 */

/**
 * @typedef {Object} Address
 * @property {string} rue
 * @property {string} [complement]
 * @property {string} code_postal
 * @property {string} ville
 * @property {string} pays
 * @property {Coordinates} [coordinates]
 */

/**
 * @typedef {Object} Money
 * @property {number} amount - Montant
 * @property {string} currency - Code devise (EUR, USD, etc.)
 */

/**
 * @typedef {Object} Dimensions
 * @property {number} longueur
 * @property {number} largeur
 * @property {number} hauteur
 * @property {string} unite - Unité de mesure (cm, m, etc.)
 */

// =============================================
// ENTITÉS MÉTIER
// =============================================

/**
 * @typedef {Object} Client
 * @property {number} id
 * @property {string} code_client - Format: CL-XXXXXX
 * @property {string} nom
 * @property {string} prenom
 * @property {string} telephone_principal
 * @property {string} [telephone_secondaire]
 * @property {string} [email]
 * @property {Address} adresse
 * @property {Address} [adresse_livraison]
 * @property {string} [type_client] - particulier, entreprise
 * @property {string} [numero_fiscal]
 * @property {string} statut - actif, inactif, blackliste
 * @property {string} [notes]
 * @property {ISODate} created_at
 * @property {ISODate} updated_at
 * @property {number} created_by
 * @property {number} [updated_by]
 */

/**
 * @typedef {Object} Marchandise
 * @property {number} id
 * @property {string} code_barre - Format: MA-XXXXXX
 * @property {number} client_id
 * @property {string} designation
 * @property {string} [description]
 * @property {string} type_marchandise - colis, palette, vehicule, etc.
 * @property {number} nombre_colis
 * @property {number} [poids] - En kg
 * @property {number} [volume] - En m³
 * @property {Dimensions} [dimensions]
 * @property {string} etat - neuf, bon, endommage, etc.
 * @property {number} [valeur_declaree]
 * @property {string} [unite_valeur] - EUR, USD, etc.
 * @property {ISODate} date_reception
 * @property {string} statut - en_attente, affecte, en_transit, etc.
 * @property {number} [conteneur_id]
 * @property {string} [lieu_stockage]
 * @property {string} [notes]
 * @property {Photo[]} [photos]
 * @property {ISODate} created_at
 * @property {ISODate} updated_at
 * @property {number} created_by
 * @property {number} [updated_by]
 */

/**
 * @typedef {Object} Conteneur
 * @property {number} id
 * @property {string} numero_dossier - Format: DO-YYYY-XXX
 * @property {string} [numero_conteneur] - Format standard
 * @property {string} type_conteneur - 20GP, 40GP, etc.
 * @property {string} destination_pays
 * @property {string} destination_ville
 * @property {string} [destination_port]
 * @property {string} type_envoi - standard, express, etc.
 * @property {boolean} avec_dedouanement
 * @property {ISODate} [date_prevue_depart]
 * @property {ISODate} [date_depart_reel]
 * @property {ISODate} [date_arrivee_prevue]
 * @property {ISODate} [date_arrivee_reelle]
 * @property {string} statut - en_preparation, expedie, etc.
 * @property {number} capacite_max - Volume max en m³
 * @property {number} poids_max - Poids max en kg
 * @property {number} [volume_utilise]
 * @property {number} [poids_utilise]
 * @property {number} [taux_remplissage] - Pourcentage
 * @property {string} [transporteur]
 * @property {string} [numero_tracking]
 * @property {string} [notes]
 * @property {ISODate} created_at
 * @property {ISODate} updated_at
 * @property {number} created_by
 * @property {number} [updated_by]
 * @property {ISODate} [closed_at]
 * @property {number} [closed_by]
 */

/**
 * @typedef {Object} Paiement
 * @property {number} id
 * @property {string} numero_paiement - Format: PAY-YYYYMM-XXX
 * @property {number} client_id
 * @property {number} [marchandise_id]
 * @property {number} [conteneur_id]
 * @property {string} type_frais - reception, expedition, stockage, etc.
 * @property {number} montant
 * @property {string} devise - EUR, USD, etc.
 * @property {number} montant_paye
 * @property {number} montant_restant
 * @property {string} mode_paiement - especes, cheque, virement, etc.
 * @property {string} [reference] - Référence chèque/virement
 * @property {ISODate} date_paiement
 * @property {ISODate} [date_echeance]
 * @property {string} statut - en_attente, valide, refuse, etc.
 * @property {string} [motif_refus]
 * @property {string} [notes]
 * @property {string} [recu_numero]
 * @property {ISODate} created_at
 * @property {ISODate} updated_at
 * @property {number} created_by
 * @property {number} [validated_by]
 * @property {ISODate} [validated_at]
 */

/**
 * @typedef {Object} Utilisateur
 * @property {number} id
 * @property {string} nom
 * @property {string} prenom
 * @property {string} email
 * @property {string} [telephone]
 * @property {string} role - admin, gestionnaire, operateur, etc.
 * @property {boolean} actif
 * @property {string} statut - actif, inactif, suspendu
 * @property {ISODate} [derniere_connexion]
 * @property {string} [ip_derniere_connexion]
 * @property {string} [preferences] - JSON string
 * @property {string} [photo_url]
 * @property {ISODate} created_at
 * @property {ISODate} updated_at
 * @property {number} [created_by]
 * @property {number} [updated_by]
 */

/**
 * @typedef {Object} Photo
 * @property {number} id
 * @property {number} marchandise_id
 * @property {string} filename
 * @property {string} [original_name]
 * @property {string} [mime_type]
 * @property {number} [size_bytes]
 * @property {number} [width]
 * @property {number} [height]
 * @property {boolean} is_primary
 * @property {string} [description]
 * @property {ISODate} created_at
 * @property {number} created_by
 */

// =============================================
// TYPES DE REQUÊTES/RÉPONSES
// =============================================

/**
 * @typedef {Object} PaginationParams
 * @property {number} [page=1]
 * @property {number} [limit=25]
 * @property {string} [sort] - Champ de tri
 * @property {string} [order=asc] - asc ou desc
 */

/**
 * @typedef {Object} PaginatedResponse
 * @property {Array} data - Données de la page
 * @property {number} total - Nombre total d'éléments
 * @property {number} page - Page actuelle
 * @property {number} limit - Limite par page
 * @property {number} totalPages - Nombre total de pages
 * @property {boolean} hasNext
 * @property {boolean} hasPrev
 */

/**
 * @typedef {Object} SearchParams
 * @property {string} q - Terme de recherche
 * @property {string[]} [fields] - Champs à rechercher
 * @property {number} [limit=10]
 */

/**
 * @typedef {Object} ApiResponse
 * @property {boolean} success
 * @property {*} [data]
 * @property {string} [message]
 * @property {Object} [errors]
 * @property {number} [code]
 */

/**
 * @typedef {Object} ValidationError
 * @property {string} field
 * @property {string} message
 * @property {string} [code]
 */

// =============================================
// TYPES DE NOTIFICATIONS
// =============================================

/**
 * @typedef {Object} Notification
 * @property {string} id
 * @property {number} userId
 * @property {string} type - info, success, warning, error
 * @property {string} title
 * @property {string} message
 * @property {string} [icon]
 * @property {Object} [data] - Données additionnelles
 * @property {boolean} [persistent=false]
 * @property {boolean} read
 * @property {Timestamp} timestamp
 * @property {Timestamp} [readAt]
 * @property {NotificationAction[]} [actions]
 */

/**
 * @typedef {Object} NotificationAction
 * @property {string} id
 * @property {string} label
 * @property {string} [type] - primary, secondary, danger
 * @property {string} [url]
 * @property {Function} [handler]
 */

// =============================================
// TYPES D'ÉVÉNEMENTS
// =============================================

/**
 * @typedef {Object} WebSocketEvent
 * @property {string} type - Type d'événement
 * @property {Object} data - Données de l'événement
 * @property {number} userId - ID de l'utilisateur émetteur
 * @property {string} userName
 * @property {Timestamp} timestamp
 */

/**
 * @typedef {Object} ActivityLog
 * @property {number} id
 * @property {number} utilisateur_id
 * @property {string} action - CREATE, UPDATE, DELETE, etc.
 * @property {string} entite - client, marchandise, etc.
 * @property {number} entite_id
 * @property {Object} [anciennes_valeurs]
 * @property {Object} [nouvelles_valeurs]
 * @property {string} [ip_address]
 * @property {string} [user_agent]
 * @property {ISODate} created_at
 */

// =============================================
// TYPES DE RAPPORTS
// =============================================

/**
 * @typedef {Object} DashboardStats
 * @property {Object} clients
 * @property {number} clients.total
 * @property {number} clients.new
 * @property {number} clients.active
 * @property {Object} marchandises
 * @property {number} marchandises.total
 * @property {number} marchandises.pending
 * @property {number} marchandises.inTransit
 * @property {Object} conteneurs
 * @property {number} conteneurs.total
 * @property {number} conteneurs.preparing
 * @property {number} conteneurs.shipped
 * @property {Object} revenue
 * @property {number} revenue.total
 * @property {number} revenue.paid
 * @property {number} revenue.pending
 * @property {number} revenue.growth
 */

/**
 * @typedef {Object} ReportData
 * @property {string} type - Type de rapport
 * @property {Object} filters - Filtres appliqués
 * @property {Object} data - Données du rapport
 * @property {Object} summary - Résumé
 * @property {ISODate} generatedAt
 * @property {number} generatedBy
 */

// =============================================
// TYPES DE CONFIGURATION
// =============================================

/**
 * @typedef {Object} UserPreferences
 * @property {string} theme - light, dark, auto
 * @property {string} language - fr, en, es
 * @property {boolean} emailNotifications
 * @property {boolean} soundEnabled
 * @property {number} itemsPerPage
 * @property {string} dateFormat
 * @property {string} currencyFormat
 * @property {Object} dashboard - Configuration dashboard
 */

/**
 * @typedef {Object} SystemConfig
 * @property {Object} company
 * @property {string} company.name
 * @property {string} company.logo
 * @property {Address} company.address
 * @property {Object} email
 * @property {boolean} email.enabled
 * @property {string} email.from
 * @property {Object} backup
 * @property {boolean} backup.enabled
 * @property {string} backup.schedule
 * @property {number} backup.retention
 */

// =============================================
// ÉNUMÉRATIONS
// =============================================

/**
 * @typedef {Object} Enums
 * @property {Object} ClientStatus
 * @property {Object} MarchandiseStatus
 * @property {Object} ConteneurStatus
 * @property {Object} PaiementStatus
 * @property {Object} UserRole
 */

const Enums = {
    ClientStatus: {
        ACTIF: 'actif',
        INACTIF: 'inactif',
        BLACKLISTE: 'blackliste'
    },
    
    MarchandiseStatus: {
        EN_ATTENTE: 'en_attente',
        AFFECTE: 'affecte',
        EN_TRANSIT: 'en_transit',
        ARRIVE: 'arrive',
        LIVRE: 'livre',
        PROBLEME: 'probleme'
    },
    
    ConteneurStatus: {
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
    
    PaiementStatus: {
        EN_ATTENTE: 'en_attente',
        VALIDE: 'valide',
        REFUSE: 'refuse',
        REMBOURSE: 'rembourse',
        ANNULE: 'annule'
    },
    
    UserRole: {
        ADMIN: 'admin',
        GESTIONNAIRE: 'gestionnaire',
        OPERATEUR: 'operateur',
        COMPTABLE: 'comptable',
        INVITE: 'invite'
    }
};

// =============================================
// FONCTIONS UTILITAIRES DE TYPE
// =============================================

/**
 * Vérifie si une valeur est du type Client
 * @param {*} value
 * @returns {boolean}
 */
function isClient(value) {
    return value 
        && typeof value === 'object'
        && 'code_client' in value
        && 'nom' in value
        && 'telephone_principal' in value;
}

/**
 * Vérifie si une valeur est du type Marchandise
 * @param {*} value
 * @returns {boolean}
 */
function isMarchandise(value) {
    return value 
        && typeof value === 'object'
        && 'code_barre' in value
        && 'client_id' in value
        && 'designation' in value;
}

/**
 * Vérifie si une valeur est du type Conteneur
 * @param {*} value
 * @returns {boolean}
 */
function isConteneur(value) {
    return value 
        && typeof value === 'object'
        && 'numero_dossier' in value
        && 'type_conteneur' in value
        && 'destination_pays' in value;
}

/**
 * Vérifie si une valeur est du type Paiement
 * @param {*} value
 * @returns {boolean}
 */
function isPaiement(value) {
    return value 
        && typeof value === 'object'
        && 'numero_paiement' in value
        && 'client_id' in value
        && 'montant' in value;
}

// =============================================
// EXPORT
// =============================================

// Export pour Node.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        Enums,
        isClient,
        isMarchandise,
        isConteneur,
        isPaiement
    };
}

// Export pour ES6
if (typeof window !== 'undefined') {
    window.Types = {
        Enums,
        isClient,
        isMarchandise,
        isConteneur,
        isPaiement
    };
}