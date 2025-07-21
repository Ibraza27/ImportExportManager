/**
 * Middleware de validation des données
 * Utilise Joi pour valider les entrées
 */

const Joi = require('joi');
const { logger } = require('../../shared/logger');

/**
 * Middleware générique de validation
 */
function validate(schema) {
    return (req, res, next) => {
        const { error, value } = schema.validate(req.body, {
            abortEarly: false,
            stripUnknown: true
        });
        
        if (error) {
            const errors = error.details.map(detail => ({
                field: detail.path.join('.'),
                message: detail.message
            }));
            
            return res.status(400).json({
                error: 'Données invalides',
                errors
            });
        }
        
        // Remplacer req.body par les données validées et nettoyées
        req.body = value;
        next();
    };
}

/**
 * Schémas de validation
 */

// Client
const clientSchema = Joi.object({
    nom: Joi.string().required().max(100),
    prenom: Joi.string().required().max(100),
    telephone_principal: Joi.string().required().max(20),
    telephone_secondaire: Joi.string().allow(null, '').max(20),
    email: Joi.string().email().allow(null, ''),
    adresse_principale: Joi.string().required().max(500),
    adresse_secondaire: Joi.string().allow(null, '').max(500),
    ville: Joi.string().required().max(100),
    code_postal: Joi.string().allow(null, '').max(20),
    pays: Joi.string().required().max(100),
    notes: Joi.string().allow(null, ''),
    type_client: Joi.string().valid('particulier', 'entreprise').default('particulier'),
    statut: Joi.string().valid('actif', 'inactif', 'suspendu').default('actif')
});

// Marchandise
const marchandiseSchema = Joi.object({
    client_id: Joi.number().required(),
    conteneur_id: Joi.number().allow(null),
    mode_reception: Joi.string().valid('poste', 'depot_client', 'coursier').default('depot_client'),
    etat_reception: Joi.string().valid('bon_etat', 'endommage', 'fragile', 'manquant').default('bon_etat'),
    type_marchandise: Joi.string().valid('colis', 'vehicule', 'palette', 'autre').required(),
    designation: Joi.string().required(),
    description_detaillee: Joi.string().allow(null, ''),
    nombre_colis: Joi.number().integer().min(1).default(1),
    poids: Joi.number().positive().allow(null),
    longueur: Joi.number().positive().allow(null),
    largeur: Joi.number().positive().allow(null),
    hauteur: Joi.number().positive().allow(null),
    volume: Joi.number().positive().allow(null),
    valeur_declaree: Joi.number().positive().allow(null),
    provenance: Joi.string().valid('poste', 'depot', 'domicile').default('depot'),
    numero_suivi_postal: Joi.string().allow(null, '').max(100),
    position_conteneur: Joi.string().allow(null, '').max(50),
    statut: Joi.string().valid(
        'receptionne', 'en_attente', 'affecte', 'en_conteneur', 
        'en_transit', 'arrive', 'livre', 'probleme', 'perdu', 'endommage'
    ).default('en_attente'),
    cout_transport: Joi.number().min(0).default(0),
    cout_manutention: Joi.number().min(0).default(0),
    cout_assurance: Joi.number().min(0).default(0),
    cout_stockage: Joi.number().min(0).default(0),
    commentaires: Joi.string().allow(null, ''),
    notes: Joi.string().allow(null, '')
});

// Conteneur
const conteneurSchema = Joi.object({
    numero_conteneur: Joi.string().required().max(50),
    destination_ville: Joi.string().required().max(100),
    destination_pays: Joi.string().required().max(100),
    destination_port: Joi.string().allow(null, '').max(100),
    date_depart_prevue: Joi.date().required(),
    date_arrivee_prevue: Joi.date().min(Joi.ref('date_depart_prevue')).required(),
    type_envoi: Joi.string().valid('avec_dedouanement', 'simple_envoi').required(),
    transitaire: Joi.string().allow(null, '').max(255),
    capacite_volume_total: Joi.number().positive().default(0),
    capacite_poids_total: Joi.number().positive().default(0),
    statut: Joi.string().valid(
        'ouvert', 'en_preparation', 'en_cours_chargement', 
        'pret_expedition', 'en_transit', 'arrive', 'cloture', 'livre'
    ).default('ouvert'),
    cout_transport: Joi.number().min(0).default(0),
    cout_dedouanement: Joi.number().min(0).default(0),
    cout_manutention: Joi.number().min(0).default(0),
    transporteur: Joi.string().allow(null, '').max(255),
    numero_tracking: Joi.string().allow(null, '').max(100),
    numero_plomb: Joi.string().allow(null, '').max(50)
});

// Paiement
const paiementSchema = Joi.object({
    client_id: Joi.number().required(),
    conteneur_id: Joi.number().allow(null),
    marchandise_id: Joi.number().allow(null),
    type_paiement: Joi.string().valid('acompte', 'solde', 'total', 'remboursement').required(),
    montant_total_du: Joi.number().positive().required(),
    montant_paye: Joi.number().positive().required(),
    date_paiement: Joi.date().max('now').default(() => new Date()),
    mode_paiement: Joi.string().valid('especes', 'virement', 'cheque', 'carte', 'mobile_money').required(),
    reference_transaction: Joi.string().allow(null, '').max(100),
    date_echeance: Joi.date().allow(null),
    statut: Joi.string().valid('valide', 'en_attente', 'rejete', 'annule').default('valide'),
    commentaires: Joi.string().allow(null, '')
});

// Authentification
const loginSchema = Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().required()
});

const registerSchema = Joi.object({
    nom: Joi.string().required().max(100),
    prenom: Joi.string().required().max(100),
    email: Joi.string().email().required(),
    mot_de_passe: Joi.string().min(8).required(),
    role: Joi.string().valid('admin', 'manager', 'gestionnaire', 'employe', 'operateur', 'comptable', 'viewer', 'invite').required(),
    telephone: Joi.string().allow(null, '').max(20)
});

const changePasswordSchema = Joi.object({
    oldPassword: Joi.string().required(),
    newPassword: Joi.string().min(8).required()
});

/**
 * Export des middlewares de validation
 */
module.exports = {
    validate,
    validateClient: validate(clientSchema),
    validateMarchandise: validate(marchandiseSchema),
    validateConteneur: validate(conteneurSchema),
    validatePaiement: validate(paiementSchema),
    validateLogin: validate(loginSchema),
    validateRegister: validate(registerSchema),
    validateChangePassword: validate(changePasswordSchema)
};