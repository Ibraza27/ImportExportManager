// Contenu final et corrigé pour server.js

/**
 * Serveur principal - Express + Socket.IO
 */
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const { createServer } = require('http');
const { Server } = require('socket.io');
const path = require('path');

// Imports Personnalisés
const { logger } = require('../shared/logger');
const { testConnection, db, query, closePool, pool } = require('./database/connection'); // ✅ ON AJOUTE ", pool"
const authService = require('./services/authService');
const backupService = require('./services/backupService');
const notificationService = require('./services/notificationService');
const { errorHandler, notFoundHandler } = require('./middlewares/errorHandler');
const authMiddleware = require('./middlewares/auth');


// =============================================
// IMPORT DES ROUTES
// =============================================

// Routes d'authentification (doit être créé si n'existe pas)
const authRoutes = require('./routes/auth');

// Routes métier
const clientsRoutes = require('./routes/clients');
const marchandisesRoutes = require('./routes/marchandises');
const conteneursRoutes = require('./routes/conteneurs');
const financesRoutes = require('./routes/finances');
const rapportsRoutes = require('./routes/rapports');

// Routes du dashboard (nouveau fichier créé)
const dashboardRoutes = require('./routes/dashboard');

// Routes des notifications (nouveau fichier créé)
const notificationsRoutes = require('./routes/notifications');


// Initialisation
const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: "*", methods: ["GET", "POST", "PUT", "DELETE"] }});
const PORT = process.env.PORT || 3000;

// Middlewares Globaux
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: '*', credentials: true }));
app.use(compression());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100 });
app.use('/api/', limiter);

app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
        const duration = Date.now() - start;
        logger.info(`${req.method} ${req.originalUrl} - ${res.statusCode} - ${duration}ms`);
    });
    next();
});

app.set('io', io);

// Fichiers Statiques
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));
app.use('/exports', express.static(path.join(__dirname, '../output')));

// =============================================
// ROUTES API - ORDRE CRITIQUE
// =============================================

// =============================================
// CONFIGURATION DES ROUTES
// =============================================

// Routes publiques
app.get('/api/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        database: pool ? 'Connecté' : 'Déconnecté',
        version: '1.0.0'
    });
});

// Routes d'authentification (publiques)
app.use('/api/auth', authRoutes);

// Middleware d'authentification pour toutes les routes suivantes
app.use('/api/*', authMiddleware);

// Routes protégées
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/clients', clientsRoutes);
app.use('/api/marchandises', marchandisesRoutes);
app.use('/api/conteneurs', conteneursRoutes);
app.use('/api/finances', financesRoutes);

// Alias pour compatibilité
app.use('/api/paiements', financesRoutes);  // ✅ Redirection vers finances

app.use('/api/rapports', rapportsRoutes);
app.use('/api/notifications', notificationsRoutes);

// Route de recherche globale
app.get('/api/search', async (req, res) => {
    try {
        const { q, type } = req.query;
        // Implémenter la logique de recherche
        res.json({ results: [] });
    } catch (error) {
        logger.error('Erreur recherche:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

app.get('/api/download/:filename', (req, res) => { /* ... logique de téléchargement ... */ });

// =============================================
// WEBSOCKET - GESTION TEMPS RÉEL
// =============================================
io.on('connection', (socket) => {
    logger.info('Nouvelle connexion WebSocket:', socket.id);

    socket.on('authenticate', async (data) => {
        try {
            const decoded = authService.verifyToken(data.token);
            if (decoded) {
                socket.join(`user-${decoded.id}`);
                logger.info(`Utilisateur ${decoded.id} authentifié sur socket ${socket.id}`);
                // ... autre logique d'authentification ...
            }
        } catch (error) {
            logger.error('Erreur authentification WebSocket:', error);
        }
    });

    socket.on('disconnect', () => { logger.info('Déconnexion WebSocket:', socket.id); });
});

notificationService.setSocketIO(io);

// ❌ Les fonctions utilitaires ont été SUPPRIMÉES d'ici. Leur place est dans les services.

// =============================================
// GESTION DES ERREURS
// =============================================
app.use(notFoundHandler);
app.use(errorHandler);

// =============================================
// DÉMARRAGE DU SERVEUR
// =============================================
async function startServer() {
    try {
        await testConnection();
        logger.info('✅ Base de données connectée');
        backupService.scheduleAutoBackup();
        logger.info('✅ Sauvegardes automatiques programmées');
        
        httpServer.listen(PORT, () => {
            logger.info(`✅ Serveur démarré sur http://localhost:${PORT}`);
        });

    } catch (error) {
        logger.error('❌ Erreur démarrage serveur:', error);
        process.exit(1);
    }
}

// Gestion des arrêts propres
process.on('SIGTERM', async () => {
    logger.info('SIGTERM reçu, arrêt en cours...');
    io.close();
    httpServer.close(async () => {
        await closePool();
        logger.info('Serveur et pool de connexions fermés.');
        process.exit(0);
    });
});

// Gestion des erreurs - À ajouter tout à la fin
app.use(notFoundHandler);
app.use(errorHandler);

startServer();

// ❌ La ligne module.exports a été nettoyée.
module.exports = { app, io };