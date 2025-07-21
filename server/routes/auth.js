// Contenu pour le NOUVEAU fichier : server/routes/auth.js

/**
 * Routes API pour l'authentification
 */

const express = require('express');
const router = express.Router();
const authService = require('../services/authService');
const { validateLogin, validateRegister, validateChangePassword } = require('../middlewares/validation');
const authMiddleware = require('../middlewares/auth');
const { logger } = require('../../shared/logger');
const auditService = require('../services/auditService');

/**
 * POST /api/auth/login
 * Connexion utilisateur
 */
router.post('/login', validateLogin, async (req, res, next) => {
    try {
        const { email, password } = req.body;
        const result = await authService.login(email, password);

        await auditService.log({
            utilisateur_id: result.user.id,
            action: 'LOGIN',
            entite: 'auth',
            entite_id: result.user.id,
            ip_address: req.ip,
        });

        res.json({
            success: true,
            user: result.user,
            token: result.token
        });
    } catch (error) {
        logger.error('Erreur login:', error);
        res.status(401).json({ error: error.message });
    }
});

/**
 * POST /api/auth/register
 * Inscription d'un nouvel utilisateur (admin uniquement)
 */
router.post('/register', [authMiddleware, authMiddleware.requireRole('admin'), validateRegister], async (req, res) => {
    try {
        const newUser = await authService.register(req.body);

        await auditService.log({
            utilisateur_id: req.user.id,
            action: 'CREATE_USER',
            entite: 'utilisateurs',
            entite_id: newUser.id,
            nouvelles_valeurs: newUser
        });

        res.status(201).json({
            success: true,
            user: newUser
        });
    } catch (error) {
        logger.error('Erreur inscription:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

/**
 * GET /api/auth/me
 * Récupérer le profil de l'utilisateur connecté
 */
router.get('/me', authMiddleware, async (req, res) => {
    // Le middleware a déjà attaché req.user, on peut le renvoyer directement
    res.json(req.user);
});

module.exports = router;