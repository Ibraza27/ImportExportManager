/**
 * Module WebSocket pour la communication temps réel
 * Gère les connexions, authentifications et diffusions
 */

const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const { logger } = require('../shared/logger');
const { db } = require('./database/connection');

class WebSocketManager {
    constructor(httpServer) {
        this.io = new Server(httpServer, {
            cors: {
                origin: "*",
                methods: ["GET", "POST", "PUT", "DELETE"],
                credentials: true
            },
            pingTimeout: 60000,
            pingInterval: 25000
        });
        
        this.rooms = new Map();
        this.userSockets = new Map();
        this.socketUsers = new Map();
        
        this.init();
    }
    
    // =============================================
    // INITIALISATION
    // =============================================
    
    init() {
        // Middleware d'authentification
        this.io.use(this.authMiddleware.bind(this));
        
        // Gestion des connexions
        this.io.on('connection', this.handleConnection.bind(this));
        
        logger.info('✅ Serveur WebSocket initialisé');
    }
    
    // =============================================
    // AUTHENTIFICATION
    // =============================================
    
    async authMiddleware(socket, next) {
        try {
            const token = socket.handshake.auth.token;
            
            if (!token) {
                return next(new Error('Token manquant'));
            }
            
            // Vérifier le token JWT
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            
            // Récupérer l'utilisateur
            const user = await db.findOne('utilisateurs', { id: decoded.id });
            
            if (!user || !user.actif) {
                return next(new Error('Utilisateur non autorisé'));
            }
            
            // Attacher les informations utilisateur au socket
            socket.userId = user.id;
            socket.userRole = user.role;
            socket.userName = `${user.prenom} ${user.nom}`;
            
            next();
            
        } catch (error) {
            logger.error('Erreur authentification WebSocket:', error);
            next(new Error('Authentification échouée'));
        }
    }
    
    // =============================================
    // GESTION DES CONNEXIONS
    // =============================================
    
    handleConnection(socket) {
        logger.info(`Nouvelle connexion WebSocket: ${socket.id} (User: ${socket.userName})`);
        
        // Enregistrer la connexion
        this.registerSocket(socket);
        
        // Joindre les rooms par défaut
        this.joinDefaultRooms(socket);
        
        // Attacher les gestionnaires d'événements
        this.attachEventHandlers(socket);
        
        // Notifier la connexion
        this.notifyUserStatus(socket.userId, 'online');
        
        // Gérer la déconnexion
        socket.on('disconnect', () => {
            this.handleDisconnection(socket);
        });
    }
    
    handleDisconnection(socket) {
        logger.info(`Déconnexion WebSocket: ${socket.id} (User: ${socket.userName})`);
        
        // Retirer de la liste des sockets
        this.unregisterSocket(socket);
        
        // Vérifier si l'utilisateur a d'autres connexions actives
        const userSockets = this.userSockets.get(socket.userId);
        if (!userSockets || userSockets.size === 0) {
            // Notifier le statut offline
            this.notifyUserStatus(socket.userId, 'offline');
        }
    }
    
    // =============================================
    // GESTION DES SOCKETS
    // =============================================
    
    registerSocket(socket) {
        // Ajouter à la map utilisateur -> sockets
        if (!this.userSockets.has(socket.userId)) {
            this.userSockets.set(socket.userId, new Set());
        }
        this.userSockets.get(socket.userId).add(socket.id);
        
        // Ajouter à la map socket -> utilisateur
        this.socketUsers.set(socket.id, socket.userId);
    }
    
    unregisterSocket(socket) {
        // Retirer de la map utilisateur -> sockets
        const userSockets = this.userSockets.get(socket.userId);
        if (userSockets) {
            userSockets.delete(socket.id);
            if (userSockets.size === 0) {
                this.userSockets.delete(socket.userId);
            }
        }
        
        // Retirer de la map socket -> utilisateur
        this.socketUsers.delete(socket.id);
    }
    
    // =============================================
    // ROOMS
    // =============================================
    
    joinDefaultRooms(socket) {
        // Room globale pour tous les utilisateurs connectés
        socket.join('global');
        
        // Room par rôle
        socket.join(`role:${socket.userRole}`);
        
        // Room personnelle
        socket.join(`user:${socket.userId}`);
        
        logger.debug(`Socket ${socket.id} a rejoint les rooms par défaut`);
    }
    
    // =============================================
    // ÉVÉNEMENTS
    // =============================================
    
    attachEventHandlers(socket) {
        // Ping/Pong pour maintenir la connexion
        socket.on('ping', () => {
            socket.emit('pong', { timestamp: Date.now() });
        });
        
        // Rejoindre une room spécifique
        socket.on('join:room', (room) => {
            if (this.canJoinRoom(socket, room)) {
                socket.join(room);
                logger.debug(`Socket ${socket.id} a rejoint la room ${room}`);
            }
        });
        
        // Quitter une room
        socket.on('leave:room', (room) => {
            socket.leave(room);
            logger.debug(`Socket ${socket.id} a quitté la room ${room}`);
        });
        
        // Événements métier
        socket.on('client:update', (data) => this.handleClientUpdate(socket, data));
        socket.on('marchandise:update', (data) => this.handleMarchandiseUpdate(socket, data));
        socket.on('conteneur:update', (data) => this.handleConteneurUpdate(socket, data));
        socket.on('paiement:update', (data) => this.handlePaiementUpdate(socket, data));
        
        // Chat/Messages
        socket.on('message:send', (data) => this.handleMessage(socket, data));
        
        // Notifications
        socket.on('notification:read', (notificationId) => {
            this.markNotificationAsRead(socket.userId, notificationId);
        });
        
        // Activité utilisateur
        socket.on('activity:typing', (data) => this.handleTypingActivity(socket, data));
        socket.on('activity:viewing', (data) => this.handleViewingActivity(socket, data));
    }
    
    // =============================================
    // GESTIONNAIRES D'ÉVÉNEMENTS MÉTIER
    // =============================================
    
    handleClientUpdate(socket, data) {
        // Vérifier les permissions
        if (!this.hasPermission(socket, 'client.update')) {
            socket.emit('error', { message: 'Permission refusée' });
            return;
        }
        
        // Diffuser à tous sauf l'émetteur
        socket.broadcast.emit('client:updated', {
            ...data,
            updatedBy: socket.userName,
            timestamp: Date.now()
        });
        
        // Log l'activité
        this.logActivity('client_update', socket.userId, data);
    }
    
    handleMarchandiseUpdate(socket, data) {
        if (!this.hasPermission(socket, 'marchandise.update')) {
            socket.emit('error', { message: 'Permission refusée' });
            return;
        }
        
        // Diffuser aux utilisateurs concernés
        this.io.to('global').emit('marchandise:updated', {
            ...data,
            updatedBy: socket.userName,
            timestamp: Date.now()
        });
        
        this.logActivity('marchandise_update', socket.userId, data);
    }
    
    handleConteneurUpdate(socket, data) {
        if (!this.hasPermission(socket, 'conteneur.update')) {
            socket.emit('error', { message: 'Permission refusée' });
            return;
        }
        
        // Diffuser à tous
        this.io.to('global').emit('conteneur:updated', {
            ...data,
            updatedBy: socket.userName,
            timestamp: Date.now()
        });
        
        this.logActivity('conteneur_update', socket.userId, data);
    }
    
    handlePaiementUpdate(socket, data) {
        if (!this.hasPermission(socket, 'paiement.update')) {
            socket.emit('error', { message: 'Permission refusée' });
            return;
        }
        
        // Diffuser aux rôles concernés
        this.io.to('role:admin').to('role:comptable').emit('paiement:updated', {
            ...data,
            updatedBy: socket.userName,
            timestamp: Date.now()
        });
        
        this.logActivity('paiement_update', socket.userId, data);
    }
    
    // =============================================
    // MESSAGES ET CHAT
    // =============================================
    
    async handleMessage(socket, data) {
        try {
            // Valider le message
            if (!data.content || !data.recipientId) {
                socket.emit('error', { message: 'Message invalide' });
                return;
            }
            
            // Créer le message
            const message = {
                id: this.generateId(),
                senderId: socket.userId,
                senderName: socket.userName,
                recipientId: data.recipientId,
                content: data.content,
                type: data.type || 'text',
                timestamp: Date.now(),
                read: false
            };
            
            // Sauvegarder en base
            await db.insert('messages', message);
            
            // Envoyer au destinataire
            this.sendToUser(data.recipientId, 'message:received', message);
            
            // Confirmation à l'émetteur
            socket.emit('message:sent', message);
            
        } catch (error) {
            logger.error('Erreur envoi message:', error);
            socket.emit('error', { message: 'Erreur envoi du message' });
        }
    }
    
    // =============================================
    // NOTIFICATIONS
    // =============================================
    
    async sendNotification(userId, notification) {
        try {
            // Enrichir la notification
            const fullNotification = {
                id: this.generateId(),
                userId,
                ...notification,
                timestamp: Date.now(),
                read: false
            };
            
            // Sauvegarder en base
            await db.insert('notifications', fullNotification);
            
            // Envoyer à l'utilisateur
            this.sendToUser(userId, 'notification:new', fullNotification);
            
            return fullNotification;
            
        } catch (error) {
            logger.error('Erreur envoi notification:', error);
            throw error;
        }
    }
    
    async markNotificationAsRead(userId, notificationId) {
        try {
            await db.update('notifications', notificationId, {
                read: true,
                readAt: Date.now()
            });
            
            // Confirmer la lecture
            this.sendToUser(userId, 'notification:read', { notificationId });
            
        } catch (error) {
            logger.error('Erreur marquage notification:', error);
        }
    }
    
    // =============================================
    // ACTIVITÉ TEMPS RÉEL
    // =============================================
    
    handleTypingActivity(socket, data) {
        // Diffuser l'activité de frappe
        socket.broadcast.to(data.room || 'global').emit('activity:user-typing', {
            userId: socket.userId,
            userName: socket.userName,
            isTyping: data.isTyping,
            context: data.context
        });
    }
    
    handleViewingActivity(socket, data) {
        // Diffuser l'activité de consultation
        socket.broadcast.to(data.room || 'global').emit('activity:user-viewing', {
            userId: socket.userId,
            userName: socket.userName,
            entityType: data.entityType,
            entityId: data.entityId
        });
    }
    
    // =============================================
    // MÉTHODES UTILITAIRES
    // =============================================
    
    canJoinRoom(socket, room) {
        // Logique de vérification des permissions pour les rooms
        // Par exemple, vérifier si l'utilisateur a accès à un conteneur spécifique
        return true; // Simplification
    }
    
    hasPermission(socket, permission) {
        // Vérifier les permissions selon le rôle
        const rolePermissions = {
            admin: '*',
            gestionnaire: ['client.*', 'marchandise.*', 'conteneur.*', 'paiement.*'],
            operateur: ['client.view', 'client.update', 'marchandise.*', 'conteneur.view'],
            comptable: ['client.view', 'paiement.*'],
            invite: ['*.view']
        };
        
        const userPerms = rolePermissions[socket.userRole] || [];
        
        // Admin a toutes les permissions
        if (userPerms === '*' || userPerms.includes('*')) return true;
        
        // Vérifier permission exacte ou wildcard
        return userPerms.some(perm => {
            if (perm === permission) return true;
            if (perm.endsWith('.*')) {
                const prefix = perm.slice(0, -2);
                return permission.startsWith(prefix + '.');
            }
            return false;
        });
    }
    
    sendToUser(userId, event, data) {
        const userSockets = this.userSockets.get(userId);
        if (userSockets) {
            userSockets.forEach(socketId => {
                this.io.to(socketId).emit(event, data);
            });
        }
    }
    
    notifyUserStatus(userId, status) {
        this.io.to('global').emit('user:status', {
            userId,
            status,
            timestamp: Date.now()
        });
    }
    
    async logActivity(action, userId, data) {
        try {
            await db.insert('activity_logs', {
                action,
                userId,
                data,
                timestamp: Date.now()
            });
        } catch (error) {
            logger.error('Erreur log activité:', error);
        }
    }
    
    generateId() {
        return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
    
    // =============================================
    // API PUBLIQUE
    // =============================================
    
    // Diffuser un événement à tous
    broadcast(event, data) {
        this.io.emit(event, data);
    }
    
    // Diffuser à une room spécifique
    broadcastToRoom(room, event, data) {
        this.io.to(room).emit(event, data);
    }
    
    // Diffuser à un rôle
    broadcastToRole(role, event, data) {
        this.io.to(`role:${role}`).emit(event, data);
    }
    
    // Obtenir les utilisateurs en ligne
    getOnlineUsers() {
        return Array.from(this.userSockets.keys());
    }
    
    // Obtenir le nombre de connexions
    getConnectionsCount() {
        return this.io.sockets.sockets.size;
    }
    
    // Déconnecter un utilisateur
    disconnectUser(userId) {
        const userSockets = this.userSockets.get(userId);
        if (userSockets) {
            userSockets.forEach(socketId => {
                const socket = this.io.sockets.sockets.get(socketId);
                if (socket) {
                    socket.disconnect(true);
                }
            });
        }
    }
}

// =============================================
// EXPORT
// =============================================

module.exports = WebSocketManager;