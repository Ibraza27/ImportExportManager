/**
 * Middleware de gestion des erreurs globales
 */
const { logger } = require('../../shared/logger');

/**
 * Gestionnaire d'erreurs 404
 */
function notFoundHandler(req, res, next) {
    res.status(404).json({
        error: 'Route non trouvée',
        path: req.originalUrl,
        method: req.method
    });
}

/**
 * Gestionnaire d'erreurs global
 */
function errorHandler(err, req, res, next) {
    // Logger l'erreur
    logger.error('Erreur serveur:', {
        error: err.message,
        stack: err.stack,
        url: req.originalUrl,
        method: req.method,
        ip: req.ip,
        user: req.user?.id
    });

    // Erreurs de validation
    if (err.name === 'ValidationError') {
        return res.status(400).json({
            error: 'Données invalides',
            details: err.details
        });
    }

    // Erreurs d'authentification
    if (err.name === 'UnauthorizedError') {
        return res.status(401).json({
            error: 'Non autorisé'
        });
    }

    // Erreurs d'accès refusé
    if (err.name === 'ForbiddenError') {
        return res.status(403).json({
            error: 'Accès refusé'
        });
    }

    // Erreurs de base de données
    if (err.code === '23505') { // Violation de contrainte unique PostgreSQL
        return res.status(409).json({
            error: 'Cette valeur existe déjà'
        });
    }

    if (err.code === '23503') { // Violation de clé étrangère PostgreSQL
        return res.status(400).json({
            error: 'Référence invalide'
        });
    }

    // Erreur par défaut
    const statusCode = err.statusCode || 500;
    const message = err.message || 'Erreur serveur interne';

    const response = {
        error: message,
        statusCode
    };

    // En développement, ajouter plus de détails
    if (process.env.NODE_ENV === 'development') {
        response.details = err.stack;
        response.originalError = err.message;
    }

    res.status(statusCode).json(response);
}

/**
 * Wrapper async pour éviter les try/catch répétitifs
 */
function asyncHandler(fn) {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
}

/**
 * Créer une erreur personnalisée
 */
class AppError extends Error {
    constructor(message, statusCode = 500) {
        super(message);
        this.statusCode = statusCode;
        this.isOperational = true;
        Error.captureStackTrace(this, this.constructor);
    }
}

module.exports = {
    errorHandler,
    notFoundHandler,
    asyncHandler,
    AppError
};
