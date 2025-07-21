/**
 * Middleware d'authentification
 * Vérifie les tokens JWT et gère les permissions
 */

const jwt = require('jsonwebtoken');
const { db, query } = require('../database/connection');
const { logger } = require('../../shared/logger');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this';

/**
 * Middleware d'authentification principal
 */
async function authMiddleware(req, res, next) {
    try {
        // Extraire le token de l'en-tête Authorization
        const authHeader = req.headers.authorization;
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Token manquant' });
        }
        
        const token = authHeader.substring(7);
        
        // Vérifier le token
        let decoded;
        try {
            decoded = jwt.verify(token, JWT_SECRET);
        } catch (error) {
            if (error.name === 'TokenExpiredError') {
                return res.status(401).json({ error: 'Token expiré' });
            }
            return res.status(401).json({ error: 'Token invalide' });
        }
        
        // Récupérer l'utilisateur depuis la base de données
        const user = await db.findOne('utilisateurs', { id: decoded.id });
        
        if (!user) {
            return res.status(401).json({ error: 'Utilisateur non trouvé' });
        }
        
        if (!user.actif || user.statut !== 'actif') {
            return res.status(403).json({ error: 'Compte désactivé' });
        }
        
        // Ajouter l'utilisateur à la requête
        req.user = {
            id: user.id,
            email: user.email,
            nom: `${user.prenom} ${user.nom}`,
            role: user.role
        };
        
        // Ajouter l'accès Socket.IO
        req.io = req.app.get('io');
        
        next();
        
    } catch (error) {
        logger.error('Erreur authentification:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
}

/**
 * Middleware de vérification des rôles
 */
function requireRole(...roles) {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: 'Non authentifié' });
        }
        
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ error: 'Accès refusé' });
        }
        
        next();
    };
}

/**
 * Middleware de vérification des permissions
 */
function requirePermission(permission) {
    return async (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: 'Non authentifié' });
        }
        
        // Les admins ont toutes les permissions
        if (req.user.role === 'admin') {
            return next();
        }
        
        // Vérifier les permissions du rôle
        const rolePermissions = getRolePermissions(req.user.role);
        
        if (!rolePermissions.includes(permission) && !rolePermissions.includes('*')) {
            return res.status(403).json({ error: 'Permission refusée' });
        }
        
        next();
    };
}

/**
 * Obtenir les permissions d'un rôle
 */
function getRolePermissions(role) {
    const permissions = {
        admin: ['*'],
        gestionnaire: [
            'client.*', 
            'marchandise.*', 
            'conteneur.*', 
            'paiement.*', 
            'rapport.*'
        ],
        operateur: [
            'client.view', 'client.create', 'client.update',
            'marchandise.*',
            'conteneur.view', 'conteneur.update',
            'paiement.view', 'paiement.create'
        ],
        comptable: [
            'client.view',
            'marchandise.view',
            'conteneur.view',
            'paiement.*',
            'rapport.*'
        ],
        invite: [
            'client.view',
            'marchandise.view',
            'conteneur.view',
            'paiement.view',
            'rapport.view'
        ]
    };
    
    return expandPermissions(permissions[role] || []);
}

/**
 * Développer les permissions avec wildcards
 */
function expandPermissions(permissions) {
    const expanded = [];
    
    for (const perm of permissions) {
        if (perm === '*') {
            return ['*']; // Toutes les permissions
        }
        
        if (perm.endsWith('.*')) {
            const prefix = perm.slice(0, -2);
            expanded.push(
                `${prefix}.view`,
                `${prefix}.create`,
                `${prefix}.update`,
                `${prefix}.delete`
            );
        } else {
            expanded.push(perm);
        }
    }
    
    return expanded;
}

/**
 * Middleware optionnel d'authentification
 * Ne bloque pas si pas de token, mais ajoute l'utilisateur si présent
 */
async function optionalAuth(req, res, next) {
    try {
        const authHeader = req.headers.authorization;
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return next();
        }
        
        const token = authHeader.substring(7);
        
        try {
            const decoded = jwt.verify(token, JWT_SECRET);
            const user = await db.findOne('utilisateurs', { id: decoded.id });
            
            if (user && user.actif && user.statut === 'actif') {
                req.user = {
                    id: user.id,
                    email: user.email,
                    nom: `${user.prenom} ${user.nom}`,
                    role: user.role
                };
            }
        } catch (error) {
            // Ignorer les erreurs, continuer sans authentification
        }
        
        next();
        
    } catch (error) {
        next();
    }
}

module.exports = authMiddleware;
module.exports.requireRole = requireRole;
module.exports.requirePermission = requirePermission;
module.exports.optionalAuth = optionalAuth;