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
router.post('/login', validateLogin, async (req, res) => {
    try {
        const { email, password } = req.body;
        
        const result = await authService.login(email, password);
        
        // Log d'audit
        await auditService.log({
            utilisateur_id: result.user.id,
            action: 'LOGIN',
            entite: 'auth',
            entite_id: result.user.id,
            ip_address: req.ip,
            user_agent: req.get('user-agent')
        });
        
        res.json({
            success: true,
            user: result.user,
            token: result.token
        });
        
    } catch (error) {
        logger.error('Erreur login:', error);
        
        // Log d'audit pour tentative échouée
        await auditService.log({
            action: 'LOGIN_FAILED',
            entite: 'auth',
            nouvelles_valeurs: { email: req.body.email },
            ip_address: req.ip,
            user_agent: req.get('user-agent')
        });
        
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
        
        // Log d'audit
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
        
        if (error.message.includes('email')) {
            return res.status(409).json({ error: error.message });
        }
        
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

/**
 * GET /api/auth/me
 * Récupérer le profil de l'utilisateur connecté
 */
router.get('/me', authMiddleware, async (req, res) => {
    try {
        const user = await authService.getProfile(req.user.id);
        res.json(user);
    } catch (error) {
        logger.error('Erreur récupération profil:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

/**
 * PUT /api/auth/me
 * Mettre à jour le profil de l'utilisateur connecté
 */
router.put('/me', authMiddleware, async (req, res) => {
    try {
        // Interdire la modification de certains champs
        const allowedFields = ['nom', 'prenom', 'telephone', 'avatar_url', 'preferences'];
        const updates = {};
        
        for (const field of allowedFields) {
            if (req.body[field] !== undefined) {
                updates[field] = req.body[field];
            }
        }
        
        const updatedUser = await authService.updateProfile(req.user.id, updates);
        
        // Log d'audit
        await auditService.log({
            utilisateur_id: req.user.id,
            action: 'UPDATE_PROFILE',
            entite: 'utilisateurs',
            entite_id: req.user.id,
            nouvelles_valeurs: updates
        });
        
        res.json(updatedUser);
        
    } catch (error) {
        logger.error('Erreur mise à jour profil:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

/**
 * POST /api/auth/change-password
 * Changer le mot de passe
 */
router.post('/change-password', [authMiddleware, validateChangePassword], async (req, res) => {
    try {
        const { oldPassword, newPassword } = req.body;
        
        await authService.changePassword(req.user.id, oldPassword, newPassword);
        
        // Log d'audit
        await auditService.log({
            utilisateur_id: req.user.id,
            action: 'CHANGE_PASSWORD',
            entite: 'utilisateurs',
            entite_id: req.user.id
        });
        
        res.json({ success: true, message: 'Mot de passe modifié avec succès' });
        
    } catch (error) {
        logger.error('Erreur changement mot de passe:', error);
        
        if (error.message.includes('incorrect')) {
            return res.status(401).json({ error: error.message });
        }
        
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

/**
 * POST /api/auth/logout
 * Déconnexion
 */
router.post('/logout', authMiddleware, async (req, res) => {
    try {
        // Log d'audit
        await auditService.log({
            utilisateur_id: req.user.id,
            action: 'LOGOUT',
            entite: 'auth',
            entite_id: req.user.id
        });
        
        // TODO: Invalider le token si blacklist implémentée
        
        res.json({ success: true, message: 'Déconnexion réussie' });
        
    } catch (error) {
        logger.error('Erreur logout:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

/**
 * POST /api/auth/refresh
 * Rafraîchir le token
 */
router.post('/refresh', authMiddleware, async (req, res) => {
    try {
        const newToken = authService.generateToken(req.user);
        
        res.json({
            success: true,
            token: newToken
        });
        
    } catch (error) {
        logger.error('Erreur refresh token:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

/**
 * GET /api/auth/permissions
 * Récupérer les permissions de l'utilisateur
 */
router.get('/permissions', authMiddleware, async (req, res) => {
    try {
        const permissions = authService.getUserPermissions(req.user.role);
        
        res.json({
            role: req.user.role,
            permissions
        });
        
    } catch (error) {
        logger.error('Erreur récupération permissions:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

module.exports = router;