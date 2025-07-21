/**
 * Gestionnaire WebSocket avec reconnexion automatique et fonctionnalités avancées
 * Gère la connexion temps réel de manière robuste avec gestion des erreurs,
 * reconnexion automatique, heartbeat et file d'attente des messages.
 */
class WebSocketManager {
    constructor() {
        this.socket = null;
        this.config = {
            url: null,
            reconnectDelay: 3000,          // Délai initial de reconnexion
            maxReconnectDelay: 30000,       // Délai maximum de reconnexion
            reconnectDecay: 1.5,            // Facteur de backoff exponentiel
            maxReconnectAttempts: 10,       // Nombre maximum de tentatives
            timeoutInterval: 10000,         // Timeout de connexion
            enableHeartbeat: true,          // Activer le heartbeat
            heartbeatInterval: 30000        // Intervalle du heartbeat (ms)
        };

        // État interne
        this.reconnectAttempts = 0;
        this.shouldReconnect = true;
        this.isConnecting = false;
        this.forcedClose = false;
        this.lastPong = Date.now();

        // Gestion des événements et messages
        this.eventHandlers = new Map();
        this.messageQueue = [];
        this.heartbeatTimer = null;

        // État de connexion
        this.connectionState = 'disconnected';
        this.lastConnectedAt = null;
        this.lastDisconnectedAt = null;
    }

    /**
     * Initialiser la connexion WebSocket
     * @param {string} token - Token d'authentification
     * @returns {Promise<boolean>} - True si l'initialisation a réussi
     */
    async init(token) {
        try {
            // Obtenir l'URL du serveur (simulé ici, à adapter)
            const serverUrl = await this.getServerUrl();
            this.config.url = serverUrl.replace('http', 'ws');

            // Se connecter
            this.connect(token);

            // Configurer les événements de visibilité
            this.setupVisibilityHandlers();

            return true;
        } catch (error) {
            console.error('Erreur initialisation WebSocket:', error);
            return false;
        }
    }

    /**
     * Simuler l'obtention de l'URL du serveur
     * À remplacer par l'appel réel à votre API
     */
    async getServerUrl() {
        // Implémentation simulée - à remplacer par votre vrai appel
        return new Promise(resolve => {
            setTimeout(() => resolve('http://votre-serveur.com'), 100);
        });
    }

    /**
     * Se connecter au serveur WebSocket
     * @param {string} token - Token d'authentification
     */
    connect(token) {
        if (this.isConnecting || (this.socket && this.socket.connected)) {
            console.log('[WebSocket] Déjà connecté ou en cours de connexion');
            return;
        }

        if (!this.config.url) {
            console.error('[WebSocket] URL du serveur non configurée');
            return;
        }

        this.isConnecting = true;
        this.forcedClose = false;
        console.log('[WebSocket] Tentative de connexion à', this.config.url);

        try {
            // Créer la connexion Socket.IO
            this.socket = io(this.config.url, {
                transports: ['websocket', 'polling'], // Conserver les deux transports
                reconnection: false, // On gère nous-mêmes la reconnexion
                timeout: this.config.timeoutInterval,
                auth: { token }
            });

            // Configurer les gestionnaires d'événements
            this.setupEventHandlers();

        } catch (error) {
            console.error('[WebSocket] Erreur création socket:', error);
            this.isConnecting = false;
            this.scheduleReconnect();
        }
    }

    /**
     * Configurer les gestionnaires d'événements de base
     */
    setupEventHandlers() {
        // Connexion établie
        this.socket.on('connect', () => {
            console.log('[WebSocket] ✅ Connecté');
            this.isConnecting = false;
            this.connectionState = 'connected';
            this.lastConnectedAt = new Date();
            this.reconnectAttempts = 0;

            // Démarrer le heartbeat
            if (this.config.enableHeartbeat) {
                this.startHeartbeat();
            }

            // Vider la file de messages
            this.flushMessageQueue();

            // Notifier les listeners
            this.emitLocal('connected');
            this.showConnectionStatus('Connecté', 'success');
        });

        // Déconnexion
        this.socket.on('disconnect', (reason) => {
            console.log('[WebSocket] ❌ Déconnecté:', reason);
            this.connectionState = 'disconnected';
            this.lastDisconnectedAt = new Date();
            this.stopHeartbeat();

            // Notifier les listeners
            this.emitLocal('disconnected', reason);

            // Reconnexion automatique sauf si fermé volontairement
            if (!this.forcedClose && this.shouldReconnect) {
                this.showConnectionStatus('Déconnecté, reconnexion...', 'warning');
                this.scheduleReconnect();
            }
        });

        // Erreur de connexion
        this.socket.on('connect_error', (error) => {
            console.error('[WebSocket] Erreur connexion:', error.message);
            this.isConnecting = false;
            this.emitLocal('connection_error', error);

            if (error.type === 'TransportError') {
                this.showConnectionStatus('Serveur inaccessible', 'error');
            }
        });

        // Ping/Pong pour heartbeat
        this.socket.on('pong', () => {
            this.lastPong = Date.now();
            console.debug('[WebSocket] Pong reçu');
        });

        // Message de bienvenue du serveur
        this.socket.on('welcome', (data) => {
            console.log('[WebSocket] Message de bienvenue:', data);
            this.emitLocal('welcome', data);
        });

        // Événements métier (conservés de la version originale)
        this.setupBusinessEventHandlers();
    }

    /**
     * Configurer les gestionnaires d'événements métier
     */
    setupBusinessEventHandlers() {
        // Mises à jour des données
        this.socket.on('data_update', (data) => {
            console.debug('[WebSocket] Mise à jour de données:', data.type);
            this.emitLocal('data_update', data);

            // Émettre un événement spécifique selon le type
            if (data.type) {
                this.emitLocal(`${data.type}_update`, data.payload);
            }
        });

        // Notifications
        this.socket.on('notification', (notification) => {
            console.info('[WebSocket] Notification reçue:', notification);
            this.emitLocal('notification', notification);
        });

        // Synchronisation
        this.socket.on('sync_required', (data) => {
            console.info('[WebSocket] Synchronisation requise:', data);
            this.emitLocal('sync_required', data);
        });

        // Messages broadcast
        this.socket.on('broadcast', (message) => {
            console.info('[WebSocket] Message broadcast:', message);
            this.emitLocal('broadcast', message);
        });

        // Utilisateur en ligne/hors ligne
        this.socket.on('user_online', (userId) => {
            console.debug('[WebSocket] Utilisateur en ligne:', userId);
            this.emitLocal('user_online', userId);
        });

        this.socket.on('user_offline', (userId) => {
            console.debug('[WebSocket] Utilisateur hors ligne:', userId);
            this.emitLocal('user_offline', userId);
        });

        // Liste des utilisateurs connectés
        this.socket.on('users_list', (users) => {
            console.debug('[WebSocket] Liste des utilisateurs:', users.length);
            this.emitLocal('users_list', users);
        });

        // Réattacher tous les gestionnaires d'événements personnalisés
        this.reattachCustomHandlers();
    }

    /**
     * Réattacher les gestionnaires d'événements personnalisés
     */
    reattachCustomHandlers() {
        for (const [event, handlers] of this.eventHandlers.entries()) {
            handlers.forEach(handler => {
                this.socket.on(event, handler);
            });
        }
    }

    /**
     * Programmer une reconnexion
     */
    scheduleReconnect() {
        if (!this.shouldReconnect || this.isConnecting) {
            return;
        }

        this.reconnectAttempts++;

        // Vérifier si le nombre maximum de tentatives est atteint
        if (this.config.maxReconnectAttempts &&
            this.reconnectAttempts > this.config.maxReconnectAttempts) {
            console.error('[WebSocket] Nombre maximum de tentatives de reconnexion atteint');
            this.emitLocal('reconnect_failed');
            this.showConnectionStatus('Connexion perdue', 'error');
            return;
        }

        // Calculer le délai avec backoff exponentiel
        const delay = Math.min(
            this.config.reconnectDelay * Math.pow(this.config.reconnectDecay, this.reconnectAttempts - 1),
            this.config.maxReconnectDelay
        );

        console.log(`[WebSocket] Reconnexion dans ${delay}ms (tentative ${this.reconnectAttempts}/${this.config.maxReconnectAttempts})`);

        setTimeout(() => {
            if (this.shouldReconnect && !this.isConnecting) {
                const token = localStorage.getItem('token');
                if (token) {
                    this.connect(token);
                } else {
                    console.warn('[WebSocket] Impossible de se reconnecter: pas de token');
                }
            }
        }, delay);
    }

    /**
     * Démarrer le heartbeat pour vérifier la connexion
     */
    startHeartbeat() {
        this.stopHeartbeat();

        this.heartbeatTimer = setInterval(() => {
            if (this.socket && this.socket.connected) {
                const pingTime = Date.now();
                this.socket.emit('ping');

                // Vérifier si le serveur répond
                setTimeout(() => {
                    if (this.lastPong && Date.now() - this.lastPong > this.config.heartbeatInterval * 2) {
                        console.warn('[WebSocket] Heartbeat timeout, reconnexion...');
                        if (this.socket) this.socket.disconnect();
                        this.scheduleReconnect();
                    }
                }, this.config.heartbeatInterval / 2);
            }
        }, this.config.heartbeatInterval);
    }

    /**
     * Arrêter le heartbeat
     */
    stopHeartbeat() {
        if (this.heartbeatTimer) {
            clearInterval(this.heartbeatTimer);
            this.heartbeatTimer = null;
        }
    }

    /**
     * Gérer la visibilité de la page
     */
    setupVisibilityHandlers() {
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                console.log('[WebSocket] Page cachée, pause heartbeat');
                this.stopHeartbeat();
            } else {
                console.log('[WebSocket] Page visible, reprise connexion');
                if (this.connectionState === 'disconnected') {
                    const token = localStorage.getItem('token');
                    if (token) {
                        this.connect(token);
                    }
                } else if (this.config.enableHeartbeat) {
                    this.startHeartbeat();
                }
            }
        });

        // Reconnexion après réveil de veille
        let lastActivity = Date.now();
        setInterval(() => {
            const now = Date.now();
            if (now - lastActivity > 60000) { // Plus d'1 minute d'inactivité
                console.log('[WebSocket] Réveil détecté, vérification connexion');
                if (this.connectionState === 'disconnected') {
                    const token = localStorage.getItem('token');
                    if (token) {
                        this.connect(token);
                    }
                }
            }
            lastActivity = now;
        }, 5000);
    }

    /**
     * Envoyer un message (avec mise en file si déconnecté)
     * @param {string} event - Nom de l'événement
     * @param {...any} args - Arguments à envoyer
     */
    emit(event, ...args) {
        // Événements locaux (ne sont pas envoyés au serveur)
        const localEvents = [
            'connected', 'disconnected', 'connection_error',
            'connection_timeout', 'error', 'reconnect_failed'
        ];

        if (localEvents.includes(event)) {
            this.emitLocal(event, ...args);
            return;
        }

        if (this.socket && this.socket.connected) {
            this.socket.emit(event, ...args);
        } else {
            // Mettre en file d'attente
            this.messageQueue.push({
                event,
                args,
                timestamp: Date.now()
            });
            console.log(`[WebSocket] Message mis en file: ${event}`);
        }
    }

    /**
     * Émettre un événement localement
     * @param {string} event - Nom de l'événement
     * @param {...any} args - Arguments à passer aux handlers
     */
    emitLocal(event, ...args) {
        if (this.eventHandlers.has(event)) {
            this.eventHandlers.get(event).forEach(handler => {
                try {
                    handler(...args);
                } catch (error) {
                    console.error(`Erreur dans le handler de ${event}:`, error);
                }
            });
        }
    }

    /**
     * Écouter un événement
     * @param {string} event - Nom de l'événement
     * @param {Function} handler - Fonction de callback
     */
    on(event, handler) {
        if (!this.eventHandlers.has(event)) {
            this.eventHandlers.set(event, new Set());
        }
        this.eventHandlers.get(event).add(handler);

        // L'attacher immédiatement si connecté
        if (this.socket) {
            this.socket.on(event, handler);
        }
    }

    /**
     * Retirer un listener
     * @param {string} event - Nom de l'événement
     * @param {Function} handler - Fonction de callback à retirer
     */
    off(event, handler) {
        if (this.eventHandlers.has(event)) {
            this.eventHandlers.get(event).delete(handler);
        }

        if (this.socket) {
            this.socket.off(event, handler);
        }
    }

    /**
     * Ajouter un listener qui s'exécute une seule fois
     * @param {string} event - Nom de l'événement
     * @param {Function} handler - Fonction de callback
     */
    once(event, handler) {
        const wrappedHandler = (...args) => {
            handler(...args);
            this.off(event, wrappedHandler);
        };
        this.on(event, wrappedHandler);
    }

    /**
     * Vider la file de messages
     */
    flushMessageQueue() {
        const now = Date.now();
        const maxAge = 60000; // 1 minute

        // Filtrer les messages trop vieux
        this.messageQueue = this.messageQueue.filter(msg =>
            now - msg.timestamp < maxAge
        );

        // Envoyer les messages restants
        while (this.messageQueue.length > 0) {
            const { event, args } = this.messageQueue.shift();
            try {
                this.socket.emit(event, ...args);
            } catch (error) {
                console.error(`[WebSocket] Erreur envoi message en file: ${event}`, error);
            }
        }
    }

    /**
     * Se déconnecter proprement
     */
    disconnect() {
        this.forcedClose = true;
        this.shouldReconnect = false;
        this.stopHeartbeat();

        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
        }

        this.connectionState = 'disconnected';
        this.eventHandlers.clear();
        this.messageQueue = [];
        this.showConnectionStatus('Déconnecté', 'warning');
    }

    /**
     * Afficher le statut de connexion dans l'interface
     * @param {string} message - Message à afficher
     * @param {string} type - Type de message (success, warning, error, info)
     */
    showConnectionStatus(message, type = 'info') {
        // À implémenter selon votre interface utilisateur
        console.log(`[WebSocket] Statut: ${message} (${type})`);

        // Exemple d'implémentation basique:
        const statusElement = document.getElementById('connection-status');
        if (statusElement) {
            statusElement.className = `connection-status ${type}`;
            statusElement.textContent = message;
            statusElement.style.display = 'block';

            if (type === 'success') {
                setTimeout(() => {
                    statusElement.style.display = 'none';
                }, 3000);
            }
        }
    }

    /**
     * Obtenir les statistiques de connexion
     * @returns {Object} - Statistiques de connexion
     */
    getStats() {
        return {
            state: this.connectionState,
            connected: this.socket && this.socket.connected,
            reconnectAttempts: this.reconnectAttempts,
            lastConnected: this.lastConnectedAt,
            lastDisconnected: this.lastDisconnectedAt,
            queuedMessages: this.messageQueue.length,
            uptime: this.lastConnectedAt ? Date.now() - this.lastConnectedAt.getTime() : 0
        };
    }

    /**
     * Forcer une reconnexion
     */
    reconnect() {
        console.log('[WebSocket] Reconnexion forcée');
        this.shouldReconnect = true;
        this.forcedClose = false;

        if (this.socket) {
            this.socket.disconnect();
        }

        const token = localStorage.getItem('token');
        if (token) {
            this.connect(token);
        }
    }

    /**
     * Méthodes métier spécifiques
     */

    /**
     * Authentifier l'utilisateur
     * @param {string} userId - ID de l'utilisateur
     * @param {string} token - Token d'authentification
     */
    authenticate(userId, token) {
        if (!this.isConnected()) {
            console.error('[WebSocket] Impossible de s\'authentifier: non connecté');
            return;
        }
        this.emit('authenticate', { userId, token });
    }

    /**
     * Rejoindre une room
     * @param {string} roomName - Nom de la room
     */
    joinRoom(roomName) {
        if (!this.isConnected()) {
            console.error('[WebSocket] Impossible de rejoindre la room: non connecté');
            return;
        }
        this.emit('join_room', roomName);
    }

    /**
     * Quitter une room
     * @param {string} roomName - Nom de la room
     */
    leaveRoom(roomName) {
        if (!this.isConnected()) return;
        this.emit('leave_room', roomName);
    }

    /**
     * Envoyer une mise à jour
     * @param {string} type - Type de mise à jour
     * @param {Object} data - Données à envoyer
     */
    sendUpdate(type, data) {
        this.emit('update', {
            type,
            data,
            timestamp: new Date().toISOString()
        });
    }

    /**
     * Demander une synchronisation
     * @param {string} type - Type de synchronisation
     */
    requestSync(type = 'all') {
        this.emit('request_sync', { type });
    }

    /**
     * Effectuer un ping pour vérifier la connexion
     * @returns {Promise<number|boolean>} - Latence en ms ou false si échoué
     */
    ping() {
        if (!this.isConnected()) return Promise.resolve(false);

        const pingTime = Date.now();
        this.socket.emit('ping');

        return new Promise((resolve) => {
            const timeout = setTimeout(() => resolve(false), 5000);

            this.once('pong', () => {
                clearTimeout(timeout);
                const latency = Date.now() - pingTime;
                console.debug(`[WebSocket] Pong reçu, latence: ${latency}ms`);
                resolve(latency);
            });
        });
    }

    /**
     * Vérifier si la connexion est active
     * @returns {boolean} - True si connecté
     */
    isConnected() {
        return this.socket && this.socket.connected;
    }

    /**
     * Obtenir l'ID de socket
     * @returns {string|null} - ID de socket ou null
     */
    getSocketId() {
        return this.socket ? this.socket.id : null;
    }

    /**
     * Obtenir l'état de la connexion
     * @returns {string} - État de la connexion
     */
    getConnectionState() {
        if (!this.socket) return 'disconnected';
        if (this.socket.connected) return 'connected';
        if (this.isConnecting) return 'connecting';
        return 'disconnected';
    }
}

// Instance singleton
const websocketManager = new WebSocketManager();

// Exposer globalement pour compatibilité avec l'ancienne version
window.WebSocketManager = websocketManager;
window.socket = websocketManager;

// Export pour les modules (si utilisé avec Node.js)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = websocketManager;
}
