/**
 * Validateurs partagés entre client et serveur
 * Import Export Manager
 */

// Import des constantes selon l'environnement
const CONSTANTS = typeof window !== 'undefined' 
    ? window.CONSTANTS 
    : require('./constants');

// =============================================
// VALIDATEURS DE BASE
// =============================================

const validators = {
    /**
     * Vérifie si une valeur est définie
     */
    required(value, message = 'Ce champ est obligatoire') {
        if (value === null || value === undefined || value === '' || 
            (Array.isArray(value) && value.length === 0) ||
            (typeof value === 'string' && value.trim() === '')) {
            return { valid: false, message };
        }
        return { valid: true };
    },
    
    /**
     * Vérifie la longueur minimale
     */
    minLength(value, min, message) {
        if (!value || value.length < min) {
            return { 
                valid: false, 
                message: message || `Minimum ${min} caractères requis` 
            };
        }
        return { valid: true };
    },
    
    /**
     * Vérifie la longueur maximale
     */
    maxLength(value, max, message) {
        if (value && value.length > max) {
            return { 
                valid: false, 
                message: message || `Maximum ${max} caractères autorisés` 
            };
        }
        return { valid: true };
    },
    
    /**
     * Vérifie si la valeur est dans une plage
     */
    between(value, min, max, message) {
        const num = parseFloat(value);
        if (isNaN(num) || num < min || num > max) {
            return { 
                valid: false, 
                message: message || `La valeur doit être entre ${min} et ${max}` 
            };
        }
        return { valid: true };
    },
    
    /**
     * Vérifie le format email
     */
    email(value, message = 'Email invalide') {
        if (!value) return { valid: true }; // Optionnel
        
        if (!CONSTANTS.PATTERNS.EMAIL.test(value)) {
            return { valid: false, message };
        }
        return { valid: true };
    },
    
    /**
     * Vérifie le format téléphone
     */
    telephone(value, message = 'Numéro de téléphone invalide') {
        if (!value) return { valid: true }; // Optionnel
        
        // Nettoyer le numéro
        const cleaned = value.replace(/[\s\-\(\)\.]/g, '');
        
        if (cleaned.length < 10 || cleaned.length > 20) {
            return { valid: false, message };
        }
        
        if (!CONSTANTS.PATTERNS.TELEPHONE.test(cleaned)) {
            return { valid: false, message };
        }
        
        return { valid: true };
    },
    
    /**
     * Vérifie si c'est un nombre
     */
    numeric(value, message = 'Doit être un nombre') {
        if (value === '' || value === null || value === undefined) {
            return { valid: true }; // Optionnel
        }
        
        if (isNaN(value) || isNaN(parseFloat(value))) {
            return { valid: false, message };
        }
        return { valid: true };
    },
    
    /**
     * Vérifie si c'est un entier
     */
    integer(value, message = 'Doit être un nombre entier') {
        if (value === '' || value === null || value === undefined) {
            return { valid: true }; // Optionnel
        }
        
        if (!Number.isInteger(Number(value))) {
            return { valid: false, message };
        }
        return { valid: true };
    },
    
    /**
     * Vérifie si c'est une date valide
     */
    date(value, message = 'Date invalide') {
        if (!value) return { valid: true }; // Optionnel
        
        const date = new Date(value);
        if (isNaN(date.getTime())) {
            return { valid: false, message };
        }
        return { valid: true };
    },
    
    /**
     * Vérifie si la date est dans le futur
     */
    futureDate(value, message = 'La date doit être dans le futur') {
        if (!value) return { valid: true }; // Optionnel
        
        const date = new Date(value);
        if (date <= new Date()) {
            return { valid: false, message };
        }
        return { valid: true };
    },
    
    /**
     * Vérifie si la date est dans le passé
     */
    pastDate(value, message = 'La date doit être dans le passé') {
        if (!value) return { valid: true }; // Optionnel
        
        const date = new Date(value);
        if (date >= new Date()) {
            return { valid: false, message };
        }
        return { valid: true };
    },
    
    /**
     * Vérifie le format d'un code
     */
    pattern(value, pattern, message = 'Format invalide') {
        if (!value) return { valid: true }; // Optionnel
        
        const regex = pattern instanceof RegExp ? pattern : new RegExp(pattern);
        if (!regex.test(value)) {
            return { valid: false, message };
        }
        return { valid: true };
    },
    
    /**
     * Vérifie si la valeur est dans une liste
     */
    inList(value, list, message = 'Valeur non autorisée') {
        if (!value) return { valid: true }; // Optionnel
        
        if (!list.includes(value)) {
            return { valid: false, message };
        }
        return { valid: true };
    },
    
    /**
     * Vérifie le format d'un montant
     */
    amount(value, message = 'Montant invalide') {
        if (value === '' || value === null || value === undefined) {
            return { valid: true }; // Optionnel
        }
        
        const amount = parseFloat(value);
        if (isNaN(amount) || amount < 0) {
            return { valid: false, message };
        }
        
        // Vérifier maximum 2 décimales
        const parts = value.toString().split('.');
        if (parts.length > 1 && parts[1].length > 2) {
            return { valid: false, message: 'Maximum 2 décimales autorisées' };
        }
        
        return { valid: true };
    }
};

// =============================================
// VALIDATEURS MÉTIER
// =============================================

/**
 * Valide un client
 */
function validateClient(data) {
    const errors = {};
    
    // Nom
    const nomValidation = validators.required(data.nom);
    if (!nomValidation.valid) errors.nom = nomValidation.message;
    else {
        const nomLength = validators.between(
            data.nom.length, 
            CONSTANTS.LIMITES.TEXT.NOM_MIN, 
            CONSTANTS.LIMITES.TEXT.NOM_MAX,
            'Le nom doit contenir entre 2 et 100 caractères'
        );
        if (!nomLength.valid) errors.nom = nomLength.message;
    }
    
    // Prénom
    const prenomValidation = validators.required(data.prenom);
    if (!prenomValidation.valid) errors.prenom = prenomValidation.message;
    
    // Téléphone principal
    const telValidation = validators.required(data.telephone_principal);
    if (!telValidation.valid) {
        errors.telephone_principal = telValidation.message;
    } else {
        const telFormat = validators.telephone(data.telephone_principal);
        if (!telFormat.valid) errors.telephone_principal = telFormat.message;
    }
    
    // Email (optionnel)
    if (data.email) {
        const emailValidation = validators.email(data.email);
        if (!emailValidation.valid) errors.email = emailValidation.message;
    }
    
    // Code postal
    if (data.code_postal) {
        const cpValidation = validators.pattern(
            data.code_postal, 
            CONSTANTS.PATTERNS.CODE_POSTAL,
            'Code postal invalide (5 chiffres)'
        );
        if (!cpValidation.valid) errors.code_postal = cpValidation.message;
    }
    
    return {
        valid: Object.keys(errors).length === 0,
        errors
    };
}

/**
 * Valide une marchandise
 */
function validateMarchandise(data) {
    const errors = {};
    
    // Client ID
    const clientValidation = validators.required(data.client_id);
    if (!clientValidation.valid) errors.client_id = clientValidation.message;
    
    // Désignation
    const designationValidation = validators.required(data.designation);
    if (!designationValidation.valid) {
        errors.designation = designationValidation.message;
    } else {
        const maxLength = validators.maxLength(
            data.designation, 
            CONSTANTS.LIMITES.TEXT.DESCRIPTION_MAX
        );
        if (!maxLength.valid) errors.designation = maxLength.message;
    }
    
    // Type
    const typeValidation = validators.inList(
        data.type_marchandise,
        Object.values(CONSTANTS.TYPES.MARCHANDISE)
    );
    if (!typeValidation.valid) errors.type_marchandise = typeValidation.message;
    
    // Nombre de colis
    if (data.nombre_colis !== undefined) {
        const nbValidation = validators.integer(data.nombre_colis);
        if (!nbValidation.valid) {
            errors.nombre_colis = nbValidation.message;
        } else if (data.nombre_colis < 1) {
            errors.nombre_colis = 'Le nombre de colis doit être au moins 1';
        }
    }
    
    // Poids
    if (data.poids !== undefined) {
        const poidsValidation = validators.numeric(data.poids);
        if (!poidsValidation.valid) {
            errors.poids = poidsValidation.message;
        } else {
            const poidsBetween = validators.between(
                data.poids,
                CONSTANTS.LIMITES.NUMBERS.POIDS_MIN,
                CONSTANTS.LIMITES.NUMBERS.POIDS_MAX
            );
            if (!poidsBetween.valid) errors.poids = poidsBetween.message;
        }
    }
    
    // Volume
    if (data.volume !== undefined) {
        const volumeValidation = validators.numeric(data.volume);
        if (!volumeValidation.valid) {
            errors.volume = volumeValidation.message;
        } else {
            const volumeBetween = validators.between(
                data.volume,
                CONSTANTS.LIMITES.NUMBERS.VOLUME_MIN,
                CONSTANTS.LIMITES.NUMBERS.VOLUME_MAX
            );
            if (!volumeBetween.valid) errors.volume = volumeBetween.message;
        }
    }
    
    // État
    if (data.etat) {
        const etatValidation = validators.inList(
            data.etat,
            Object.values(CONSTANTS.ETATS.COLIS)
        );
        if (!etatValidation.valid) errors.etat = etatValidation.message;
    }
    
    return {
        valid: Object.keys(errors).length === 0,
        errors
    };
}

/**
 * Valide un conteneur
 */
function validateConteneur(data) {
    const errors = {};
    
    // Numéro de conteneur
    if (data.numero_conteneur) {
        const numValidation = validators.pattern(
            data.numero_conteneur,
            CONSTANTS.PATTERNS.NUMERO_CONTENEUR,
            'Format invalide (ex: ABCD1234567)'
        );
        if (!numValidation.valid) errors.numero_conteneur = numValidation.message;
    }
    
    // Type de conteneur
    const typeValidation = validators.inList(
        data.type_conteneur,
        Object.keys(CONSTANTS.TYPES.CONTENEUR)
    );
    if (!typeValidation.valid) errors.type_conteneur = typeValidation.message;
    
    // Destination
    const destValidation = validators.required(data.destination_pays);
    if (!destValidation.valid) errors.destination_pays = destValidation.message;
    
    // Date prévue
    if (data.date_prevue_depart) {
        const dateValidation = validators.date(data.date_prevue_depart);
        if (!dateValidation.valid) {
            errors.date_prevue_depart = dateValidation.message;
        } else {
            const futureDateValidation = validators.futureDate(data.date_prevue_depart);
            if (!futureDateValidation.valid) {
                errors.date_prevue_depart = futureDateValidation.message;
            }
        }
    }
    
    // Type d'envoi
    if (data.type_envoi) {
        const envoidValidation = validators.inList(
            data.type_envoi,
            Object.values(CONSTANTS.TYPES.ENVOI)
        );
        if (!envoidValidation.valid) errors.type_envoi = envoidValidation.message;
    }
    
    return {
        valid: Object.keys(errors).length === 0,
        errors
    };
}

/**
 * Valide un paiement
 */
function validatePaiement(data) {
    const errors = {};
    
    // Montant
    const montantValidation = validators.required(data.montant);
    if (!montantValidation.valid) {
        errors.montant = montantValidation.message;
    } else {
        const amountValidation = validators.amount(data.montant);
        if (!amountValidation.valid) {
            errors.montant = amountValidation.message;
        } else {
            const montantBetween = validators.between(
                data.montant,
                CONSTANTS.LIMITES.NUMBERS.MONTANT_MIN,
                CONSTANTS.LIMITES.NUMBERS.MONTANT_MAX
            );
            if (!montantBetween.valid) errors.montant = montantBetween.message;
        }
    }
    
    // Mode de paiement
    const modeValidation = validators.inList(
        data.mode_paiement,
        Object.values(CONSTANTS.TYPES.PAIEMENT)
    );
    if (!modeValidation.valid) errors.mode_paiement = modeValidation.message;
    
    // Date de paiement
    const dateValidation = validators.required(data.date_paiement);
    if (!dateValidation.valid) {
        errors.date_paiement = dateValidation.message;
    } else {
        const dateFormat = validators.date(data.date_paiement);
        if (!dateFormat.valid) errors.date_paiement = dateFormat.message;
    }
    
    // Référence (selon mode de paiement)
    if (['cheque', 'virement'].includes(data.mode_paiement)) {
        const refValidation = validators.required(data.reference);
        if (!refValidation.valid) {
            errors.reference = 'La référence est obligatoire pour ce mode de paiement';
        }
    }
    
    return {
        valid: Object.keys(errors).length === 0,
        errors
    };
}

/**
 * Valide un utilisateur
 */
function validateUtilisateur(data) {
    const errors = {};
    
    // Nom
    const nomValidation = validators.required(data.nom);
    if (!nomValidation.valid) errors.nom = nomValidation.message;
    
    // Prénom
    const prenomValidation = validators.required(data.prenom);
    if (!prenomValidation.valid) errors.prenom = prenomValidation.message;
    
    // Email
    const emailRequired = validators.required(data.email);
    if (!emailRequired.valid) {
        errors.email = emailRequired.message;
    } else {
        const emailValidation = validators.email(data.email);
        if (!emailValidation.valid) errors.email = emailValidation.message;
    }
    
    // Mot de passe (si création)
    if (data.password !== undefined) {
        const passwordValidation = validatePassword(data.password);
        if (!passwordValidation.valid) {
            errors.password = passwordValidation.errors.join('. ');
        }
    }
    
    // Rôle
    if (data.role) {
        const roleValidation = validators.inList(
            data.role,
            ['admin', 'gestionnaire', 'operateur', 'comptable', 'invite']
        );
        if (!roleValidation.valid) errors.role = roleValidation.message;
    }
    
    return {
        valid: Object.keys(errors).length === 0,
        errors
    };
}

/**
 * Valide un mot de passe
 */
function validatePassword(password) {
    const errors = [];
    
    if (!password || password.length < 8) {
        errors.push('Le mot de passe doit contenir au moins 8 caractères');
    }
    
    if (!/[A-Z]/.test(password)) {
        errors.push('Le mot de passe doit contenir au moins une majuscule');
    }
    
    if (!/[a-z]/.test(password)) {
        errors.push('Le mot de passe doit contenir au moins une minuscule');
    }
    
    if (!/[0-9]/.test(password)) {
        errors.push('Le mot de passe doit contenir au moins un chiffre');
    }
    
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
        errors.push('Le mot de passe doit contenir au moins un caractère spécial');
    }
    
    return {
        valid: errors.length === 0,
        errors
    };
}

// =============================================
// UTILITAIRES
// =============================================

/**
 * Nettoie et formate un numéro de téléphone
 */
function formatTelephone(value) {
    if (!value) return '';
    
    // Retirer tous les caractères non numériques sauf le +
    let cleaned = value.replace(/[^\d+]/g, '');
    
    // Ajouter le préfixe pays si nécessaire
    if (cleaned.length === 10 && !cleaned.startsWith('+')) {
        cleaned = '+33' + cleaned; // Défaut France
    }
    
    return cleaned;
}

/**
 * Nettoie et formate un montant
 */
function formatMontant(value) {
    if (!value) return 0;
    
    // Remplacer la virgule par un point
    const cleaned = value.toString().replace(',', '.');
    
    // Parser et arrondir à 2 décimales
    const amount = parseFloat(cleaned);
    if (isNaN(amount)) return 0;
    
    return Math.round(amount * 100) / 100;
}

/**
 * Valide un fichier upload
 */
function validateFile(file, options = {}) {
    const errors = [];
    const {
        maxSize = CONSTANTS.LIMITES.UPLOAD.MAX_FILE_SIZE,
        allowedTypes = [...CONSTANTS.LIMITES.UPLOAD.ALLOWED_IMAGE_TYPES, ...CONSTANTS.LIMITES.UPLOAD.ALLOWED_DOCUMENT_TYPES]
    } = options;
    
    // Vérifier la taille
    if (file.size > maxSize) {
        errors.push(`Le fichier est trop volumineux (max ${maxSize / 1024 / 1024} MB)`);
    }
    
    // Vérifier le type
    if (!allowedTypes.includes(file.type)) {
        errors.push('Type de fichier non autorisé');
    }
    
    return {
        valid: errors.length === 0,
        errors
    };
}

// =============================================
// EXPORT
// =============================================

// Export pour Node.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        validators,
        validateClient,
        validateMarchandise,
        validateConteneur,
        validatePaiement,
        validateUtilisateur,
        validatePassword,
        validateFile,
        formatTelephone,
        formatMontant
    };
}

// Export pour ES6
if (typeof window !== 'undefined') {
    window.Validators = {
        validators,
        validateClient,
        validateMarchandise,
        validateConteneur,
        validatePaiement,
        validateUtilisateur,
        validatePassword,
        validateFile,
        formatTelephone,
        formatMontant
    };
}