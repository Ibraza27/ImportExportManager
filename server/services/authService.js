/**
 * Service d'authentification
 * Gère la connexion, déconnexion et les tokens JWT
 */

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { db } = require('../database/connection');
const { logger } = require('../../shared/logger');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this';
const JWT_EXPIRES_IN = '24h';

class AuthService {
    /**
     * Authentifier un utilisateur
     */
    async login(email, password) {
        try {
            // Rechercher l'utilisateur
            const user = await db.findOne('utilisateurs', { email });
            
            if (!user || !user.actif) {
                throw new Error('Identifiants invalides');
            }
            
            // Vérifier le mot de passe
            const isValid = await bcrypt.compare(password, user.mot_de_passe);
            if (!isValid) {
                throw new Error('Identifiants invalides');
            }
            
            // Mettre à jour la dernière connexion
            await db.update('utilisateurs', user.id, {
                derniere_connexion: new Date()
            });
            
            // Générer le token JWT
            const token = this.generateToken(user);
            
            // Retirer le mot de passe de la réponse
            delete user.mot_de_passe;
            
            return {
                user,
                token
            };
            
        } catch (error) {
            logger.error('Erreur login:', error);
            throw error;
        }
    }
    
    /**
     * Créer un nouvel utilisateur
     */
    async register(userData) {
        try {
            // Vérifier si l'email existe déjà
            const exists = await db.count('utilisateurs', { email: userData.email });
            if (exists > 0) {
                throw new Error('Cet email est déjà utilisé');
            }
            
            // Hasher le mot de passe
            const hashedPassword = await bcrypt.hash(userData.mot_de_passe, 10);
            
            // Créer l'utilisateur
            const newUser = await db.insert('utilisateurs', {
                ...userData,
                mot_de_passe: hashedPassword,
                statut: 'actif',
                actif: true
            });
            
            delete newUser.mot_de_passe;
            return newUser;
            
        } catch (error) {
            logger.error('Erreur register:', error);
            throw error;
        }
    }
    
    /**
     * Changer le mot de passe
     */
    async changePassword(userId, oldPassword, newPassword) {
        try {
            const user = await db.findOne('utilisateurs', { id: userId });
            
            // Vérifier l'ancien mot de passe
            const isValid = await bcrypt.compare(oldPassword, user.mot_de_passe);
            if (!isValid) {
                throw new Error('Mot de passe actuel incorrect');
            }
            
            // Hasher le nouveau mot de passe
            const hashedPassword = await bcrypt.hash(newPassword, 10);
            
            // Mettre à jour
            await db.update('utilisateurs', userId, {
                mot_de_passe: hashedPassword
            });
            
            return { success: true };
            
        } catch (error) {
            logger.error('Erreur changement mot de passe:', error);
            throw error;
        }
    }
    
    /**
     * Générer un token JWT
     */
    generateToken(user) {
        const payload = {
            id: user.id,
            email: user.email,
            role: user.role,
            nom: `${user.prenom} ${user.nom}`
        };
        
        return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
    }
    
    /**
     * Vérifier un token JWT
     */
    verifyToken(token) {
        try {
            return jwt.verify(token, JWT_SECRET);
        } catch (error) {
            throw new Error('Token invalide');
        }
    }
    
    /**
     * Décoder un token sans vérification
     */
    decodeToken(token) {
        return jwt.decode(token);
    }
}

module.exports = new AuthService();