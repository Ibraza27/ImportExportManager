/**
 * Système de logging unifié pour Node.js, Electron et navigateur
 * Centralise les traces, erreurs et opérations avec gestion multi-environnement
 */

// Détection de l'environnement
const isNode = typeof process !== 'undefined' && process.versions && typeof process.versions.node !== 'undefined';
const isElectron = isNode && process.versions.electron;
const isBrowser = !isNode && typeof window !== 'undefined';
const isServer = isNode && !isElectron || (isElectron && process.type === 'browser');
const isClient = isBrowser || (isElectron && process.type === 'renderer');

// Configuration principale
let logger;
const logUtils = {};

if (isServer) {
    // Environnement serveur (Node.js ou main process Electron)
    try {
        const winston = require('winston');
        const path = require('path');
        const fs = require('fs');
        const { combine, timestamp, errors, printf, colorize, simple } = winston.format;

        // Création du dossier logs
        const logsDir = path.join(__dirname, '..', 'logs');
        if (!fs.existsSync(logsDir)) {
            fs.mkdirSync(logsDir, { recursive: true });
        }

        // Format personnalisé
        const logFormat = printf(({ timestamp, level, message, stack, ...metadata }) => {
            let log = `[${timestamp}] [${level.toUpperCase()}]: ${message}`;

            if (Object.keys(metadata).length > 0) {
                log += ` | DATA: ${JSON.stringify(metadata)}`;
            }

            if (stack) {
                log += `\n${stack}`;
            }

            return log;
        });

        // Configuration Winston
        logger = winston.createLogger({
            level: process.env.LOG_LEVEL || 'info',
            format: combine(
                timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
                errors({ stack: true }),
                logFormat
            ),
            transports: [
                new winston.transports.File({
                    filename: path.join(logsDir, 'error.log'),
                    level: 'error',
                    maxsize: 10485760, // 10MB
                    maxFiles: 5
                }),
                new winston.transports.File({
                    filename: path.join(logsDir, `app-${new Date().toISOString().split('T')[0]}.log`),
                    maxsize: 10485760, // 10MB
                    maxFiles: 30
                }),
                new winston.transports.File({
                    filename: path.join(logsDir, 'api.log'),
                    level: 'info',
                    maxsize: 10485760, // 10MB
                    maxFiles: 5
                })
            ]
        });

        // Ajout de la console en développement
        if (process.env.NODE_ENV !== 'production') {
            logger.add(new winston.transports.Console({
                format: combine(colorize(), simple())
            }));
        }
    } catch (error) {
        // ====> AJOUTEZ CETTE LIGNE <====
        console.error("!!! VÉRITABLE ERREUR LORS DE L'INITIALISATION DU LOGGER :", error); 
        
        console.warn('Winston non trouvé, utilisation de console.log');
        logger = {
            info: (message, data) => console.log('[INFO]', message, data),
            warn: (message, data) => console.warn('[WARN]', message, data),
            error: (message, data) => console.error('[ERROR]', message, data),
            debug: (message, data) => console.debug('[DEBUG]', message, data)
        };
    }

    // Fonctions utilitaires serveur
    logUtils.logRequest = (req, userId = null) => {
        logger.info('Requête API', {
            method: req.method,
            url: req.url,
            ip: req.ip,
            userId,
            userAgent: req.get('user-agent')
        });
    };

    logUtils.logError = (error, context = {}) => {
        logger.error(error.message || 'Erreur inconnue', {
            stack: error.stack,
            code: error.code,
            ...context
        });
    };

    logUtils.logUserAction = (userId, action, details = {}) => {
        logger.info(`Action utilisateur: ${action}`, {
            userId,
            action,
            ...details
        });
    };

    logUtils.logPerformance = (operation, duration, details = {}) => {
        logger.info(`Performance: ${operation}`, {
            operation,
            duration: `${duration}ms`,
            ...details
        });
    };

    logUtils.logTransaction = (type, amount, clientId, containerId, details = {}) => {
        logger.info(`Transaction: ${type}`, {
            type,
            amount,
            clientId,
            containerId,
            ...details
        });
    };

    logUtils.logStateChange = (entity, entityId, oldState, newState, userId) => {
        logger.info(`Changement d'état: ${entity}`, {
            entity,
            entityId,
            oldState,
            newState,
            userId
        });
    };

    // Gestion des erreurs globales
    process.on('uncaughtException', (error) => {
        logger.error('Exception non capturée', {
            error: error.message,
            stack: error.stack
        });
        setTimeout(() => process.exit(1), 1000);
    });

    process.on('unhandledRejection', (reason, promise) => {
        logger.error('Promesse rejetée non gérée', {
            reason: reason?.message || reason,
            promise
        });
    });
} else {
    // Environnement client (Browser ou Renderer process Electron)
    logger = {
        info: (message, data) => console.log(`[INFO] ${message}`, data),
        warn: (message, data) => console.warn(`[WARN] ${message}`, data),
        error: (message, data) => console.error(`[ERROR] ${message}`, data),
        debug: (message, data) => console.debug(`[DEBUG] ${message}`, data)
    };

    // Stubs pour les fonctions utilitaires
    logUtils.logRequest = () => {};
    logUtils.logError = (error, context = {}) => {
        console.error('Erreur:', error.message || error, context);
    };
    logUtils.logUserAction = (userId, action, details = {}) => {
        console.info(`Action utilisateur: ${action}`, { userId, ...details });
    };
    logUtils.logPerformance = (operation, duration, details = {}) => {
        console.debug(`Performance: ${operation} (${duration}ms)`, details);
    };
    logUtils.logTransaction = (type, amount, clientId, containerId, details = {}) => {
        console.info(`Transaction: ${type}`, { amount, clientId, containerId, ...details });
    };
    logUtils.logStateChange = (entity, entityId, oldState, newState, userId) => {
        console.info(`Changement d'état: ${entity}`, { entityId, oldState, newState, userId });
    };
}

// Interface unifiée
module.exports = {
    logger,
    ...logUtils
};
