/**
 * Composant Notifications
 * Système de notifications temps réel et gestion des alertes
 */

class NotificationSystem {
    constructor(options = {}) {
        this.options = {
            position: 'top-right', // top-right, top-left, bottom-right, bottom-left
            maxNotifications: 5,
            defaultDuration: 5000,
            enableSound: true,
            enableDesktop: true,
            enableStorage: true,
            storageKey: 'app_notifications',
            ...options
        };
        
        this.container = null;
        this.notifications = new Map();
        this.queue = [];
        this.soundEnabled = this.options.enableSound;
        this.desktopEnabled = false;
        this.audioContext = null;
        
        this.init();
    }
    
    // =============================================
    // INITIALISATION
    // =============================================
    
    init() {
        // Créer le conteneur de notifications
        this.createContainer();
        
        // Initialiser les permissions desktop
        if (this.options.enableDesktop) {
            this.requestDesktopPermission();
        }
        
        // Initialiser le son
        if (this.options.enableSound) {
            this.initSound();
        }
        
        // Charger les notifications stockées
        if (this.options.enableStorage) {
            this.loadStoredNotifications();
        }
        
        // Écouter les événements WebSocket
        this.listenToWebSocket();
        
        return this;
    }
    
    createContainer() {
        // Vérifier si le conteneur existe déjà
        let container = document.getElementById('notification-container');
        
        if (!container) {
            container = document.createElement('div');
            container.id = 'notification-container';
            container.className = `notification-container notification-${this.options.position}`;
            document.body.appendChild(container);
        }
        
        this.container = container;
    }
    
    // =============================================
    // PERMISSIONS
    // =============================================
    
    async requestDesktopPermission() {
        if (!('Notification' in window)) {
            console.warn('Les notifications desktop ne sont pas supportées');
            return;
        }
        
        if (Notification.permission === 'granted') {
            this.desktopEnabled = true;
        } else if (Notification.permission !== 'denied') {
            const permission = await Notification.requestPermission();
            this.desktopEnabled = permission === 'granted';
        }
    }
    
    // =============================================
    // AFFICHAGE DES NOTIFICATIONS
    // =============================================
    
    show(options) {
        const notification = {
            id: options.id || this.generateId(),
            type: options.type || 'info', // success, error, warning, info
            title: options.title || '',
            message: options.message || '',
            icon: options.icon || this.getDefaultIcon(options.type),
            duration: options.duration !== undefined ? options.duration : this.options.defaultDuration,
            actions: options.actions || [],
            data: options.data || {},
            timestamp: new Date(),
            persistent: options.persistent || false,
            progress: options.progress || null,
            image: options.image || null,
            sound: options.sound !== undefined ? options.sound : true
        };
        
        // Ajouter à la file si trop de notifications
        if (this.notifications.size >= this.options.maxNotifications) {
            this.queue.push(notification);
            return notification.id;
        }
        
        // Créer et afficher la notification
        this.createNotification(notification);
        
        // Jouer le son
        if (this.soundEnabled && notification.sound) {
            this.playSound(notification.type);
        }
        
        // Afficher notification desktop
        if (this.desktopEnabled && !document.hasFocus()) {
            this.showDesktopNotification(notification);
        }
        
        // Sauvegarder si nécessaire
        if (this.options.enableStorage && notification.persistent) {
            this.saveNotification(notification);
        }
        
        return notification.id;
    }
    
    createNotification(notification) {
        const element = document.createElement('div');
        element.className = `notification notification-${notification.type} notification-enter`;
        element.dataset.id = notification.id;
        
        element.innerHTML = `
            <div class="notification-content">
                ${notification.icon ? `
                    <div class="notification-icon">
                        <i class="${notification.icon}"></i>
                    </div>
                ` : ''}
                <div class="notification-body">
                    ${notification.title ? `
                        <div class="notification-title">${notification.title}</div>
                    ` : ''}
                    ${notification.message ? `
                        <div class="notification-message">${notification.message}</div>
                    ` : ''}
                    ${notification.progress !== null ? `
                        <div class="notification-progress">
                            <div class="progress">
                                <div class="progress-bar" style="width: ${notification.progress}%"></div>
                            </div>
                        </div>
                    ` : ''}
                    ${notification.actions.length > 0 ? `
                        <div class="notification-actions">
                            ${notification.actions.map(action => `
                                <button class="notification-action" data-action="${action.id}">
                                    ${action.label}
                                </button>
                            `).join('')}
                        </div>
                    ` : ''}
                </div>
                ${notification.image ? `
                    <div class="notification-image">
                        <img src="${notification.image}" alt="">
                    </div>
                ` : ''}
                <button class="notification-close" aria-label="Fermer">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;
        
        // Ajouter au conteneur
        this.container.appendChild(element);
        
        // Stocker la notification
        this.notifications.set(notification.id, {
            ...notification,
            element,
            timer: null
        });
        
        // Attacher les événements
        this.attachNotificationEvents(notification.id);
        
        // Animation d'entrée
        requestAnimationFrame(() => {
            element.classList.add('notification-entered');
        });
        
        // Auto-fermeture
        if (notification.duration > 0 && !notification.persistent) {
            this.setAutoClose(notification.id, notification.duration);
        }
    }
    
    attachNotificationEvents(id) {
        const notif = this.notifications.get(id);
        if (!notif) return;
        
        const element = notif.element;
        
        // Bouton fermer
        const closeBtn = element.querySelector('.notification-close');
        closeBtn.addEventListener('click', () => {
            this.close(id);
        });
        
        // Actions
        element.querySelectorAll('.notification-action').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const actionId = e.target.dataset.action;
                const action = notif.actions.find(a => a.id === actionId);
                
                if (action && action.handler) {
                    action.handler(notif.data);
                }
                
                if (action && !action.keepOpen) {
                    this.close(id);
                }
            });
        });
        
        // Pause sur hover
        element.addEventListener('mouseenter', () => {
            this.pauseAutoClose(id);
        });
        
        element.addEventListener('mouseleave', () => {
            this.resumeAutoClose(id);
        });
    }
    
    // =============================================
    // FERMETURE
    // =============================================
    
    close(id) {
        const notif = this.notifications.get(id);
        if (!notif) return;
        
        // Annuler le timer
        if (notif.timer) {
            clearTimeout(notif.timer);
        }
        
        // Animation de sortie
        notif.element.classList.add('notification-exit');
        
        // Supprimer après l'animation
        notif.element.addEventListener('animationend', () => {
            notif.element.remove();
            this.notifications.delete(id);
            
            // Supprimer du stockage
            if (this.options.enableStorage) {
                this.removeStoredNotification(id);
            }
            
            // Traiter la file d'attente
            this.processQueue();
        });
    }
    
    closeAll() {
        this.notifications.forEach((notif, id) => {
            this.close(id);
        });
    }
    
    // =============================================
    // GESTION DU TEMPS
    // =============================================
    
    setAutoClose(id, duration) {
        const notif = this.notifications.get(id);
        if (!notif) return;
        
        notif.timer = setTimeout(() => {
            this.close(id);
        }, duration);
        
        notif.remainingTime = duration;
        notif.startTime = Date.now();
    }
    
    pauseAutoClose(id) {
        const notif = this.notifications.get(id);
        if (!notif || !notif.timer) return;
        
        clearTimeout(notif.timer);
        notif.remainingTime -= Date.now() - notif.startTime;
    }
    
    resumeAutoClose(id) {
        const notif = this.notifications.get(id);
        if (!notif || !notif.remainingTime) return;
        
        notif.timer = setTimeout(() => {
            this.close(id);
        }, notif.remainingTime);
        
        notif.startTime = Date.now();
    }
    
    // =============================================
    // FILE D'ATTENTE
    // =============================================
    
    processQueue() {
        if (this.queue.length === 0) return;
        if (this.notifications.size >= this.options.maxNotifications) return;
        
        const notification = this.queue.shift();
        this.createNotification(notification);
    }
    
    // =============================================
    // MISE À JOUR
    // =============================================
    
    update(id, updates) {
        const notif = this.notifications.get(id);
        if (!notif) return;
        
        // Mettre à jour les propriétés
        Object.assign(notif, updates);
        
        // Mettre à jour l'affichage
        if (updates.title !== undefined) {
            const titleEl = notif.element.querySelector('.notification-title');
            if (titleEl) {
                titleEl.textContent = updates.title;
            }
        }
        
        if (updates.message !== undefined) {
            const messageEl = notif.element.querySelector('.notification-message');
            if (messageEl) {
                messageEl.textContent = updates.message;
            }
        }
        
        if (updates.progress !== undefined) {
            let progressEl = notif.element.querySelector('.notification-progress');
            
            if (!progressEl && updates.progress !== null) {
                // Créer la barre de progression
                const bodyEl = notif.element.querySelector('.notification-body');
                progressEl = document.createElement('div');
                progressEl.className = 'notification-progress';
                progressEl.innerHTML = `
                    <div class="progress">
                        <div class="progress-bar" style="width: ${updates.progress}%"></div>
                    </div>
                `;
                bodyEl.appendChild(progressEl);
            } else if (progressEl && updates.progress === null) {
                // Supprimer la barre
                progressEl.remove();
            } else if (progressEl) {
                // Mettre à jour
                const bar = progressEl.querySelector('.progress-bar');
                bar.style.width = `${updates.progress}%`;
            }
        }
    }
    
    // =============================================
    // NOTIFICATIONS DESKTOP
    // =============================================
    
    showDesktopNotification(notification) {
        if (!this.desktopEnabled) return;
        
        const options = {
            body: notification.message,
            icon: '/assets/images/icon.png',
            badge: '/assets/images/badge.png',
            tag: notification.id,
            requireInteraction: notification.persistent,
            silent: !notification.sound,
            data: notification.data
        };
        
        if (notification.image) {
            options.image = notification.image;
        }
        
        if (notification.actions.length > 0) {
            options.actions = notification.actions.slice(0, 2).map(action => ({
                action: action.id,
                title: action.label
            }));
        }
        
        const desktopNotif = new Notification(notification.title || 'Notification', options);
        
        desktopNotif.onclick = () => {
            window.focus();
            this.handleNotificationClick(notification);
        };
    }
    
    handleNotificationClick(notification) {
        // Action par défaut selon le type
        if (notification.data.url) {
            window.location.href = notification.data.url;
        } else if (notification.data.route) {
            window.location.hash = notification.data.route;
        }
    }
    
    // =============================================
    // SON
    // =============================================
    
    initSound() {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        
        // Précharger les sons
        this.sounds = {
            success: { frequency: 800, duration: 150 },
            error: { frequency: 300, duration: 250 },
            warning: { frequency: 500, duration: 200 },
            info: { frequency: 600, duration: 100 }
        };
    }
    
    playSound(type) {
        if (!this.audioContext || !this.soundEnabled) return;
        
        const sound = this.sounds[type] || this.sounds.info;
        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        
        oscillator.frequency.value = sound.frequency;
        oscillator.type = 'sine';
        
        gainNode.gain.setValueAtTime(0.3, this.audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + sound.duration / 1000);
        
        oscillator.start(this.audioContext.currentTime);
        oscillator.stop(this.audioContext.currentTime + sound.duration / 1000);
    }
    
    toggleSound(enabled) {
        this.soundEnabled = enabled;
    }
    
    // =============================================
    // STOCKAGE
    // =============================================
    
    saveNotification(notification) {
        try {
            const stored = this.getStoredNotifications();
            stored.push({
                ...notification,
                element: undefined,
                timer: undefined
            });
            
            // Garder seulement les 50 dernières
            if (stored.length > 50) {
                stored.splice(0, stored.length - 50);
            }
            
            localStorage.setItem(this.options.storageKey, JSON.stringify(stored));
        } catch (error) {
            console.error('Erreur sauvegarde notification:', error);
        }
    }
    
    removeStoredNotification(id) {
        try {
            const stored = this.getStoredNotifications();
            const filtered = stored.filter(n => n.id !== id);
            localStorage.setItem(this.options.storageKey, JSON.stringify(filtered));
        } catch (error) {
            console.error('Erreur suppression notification:', error);
        }
    }
    
    getStoredNotifications() {
        try {
            const stored = localStorage.getItem(this.options.storageKey);
            return stored ? JSON.parse(stored) : [];
        } catch (error) {
            console.error('Erreur lecture notifications:', error);
            return [];
        }
    }
    
    loadStoredNotifications() {
        const stored = this.getStoredNotifications();
        
        // Afficher les notifications persistantes
        stored.filter(n => n.persistent).forEach(notification => {
            this.show({
                ...notification,
                sound: false // Pas de son au chargement
            });
        });
    }
    
    // =============================================
    // WEBSOCKET
    // =============================================
    
    listenToWebSocket() {
        if (window.WebSocketManager) {
            window.WebSocketManager.on('notification', (data) => {
                this.show(data);
            });
        }
    }
    
    // =============================================
    // UTILITAIRES
    // =============================================
    
    generateId() {
        return `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
    
    getDefaultIcon(type) {
        const icons = {
            success: 'fas fa-check-circle',
            error: 'fas fa-times-circle',
            warning: 'fas fa-exclamation-triangle',
            info: 'fas fa-info-circle'
        };
        
        return icons[type] || icons.info;
    }
    
    // =============================================
    // API PUBLIQUE
    // =============================================
    
    success(title, message, options = {}) {
        return this.show({
            ...options,
            type: 'success',
            title,
            message
        });
    }
    
    error(title, message, options = {}) {
        return this.show({
            ...options,
            type: 'error',
            title,
            message
        });
    }
    
    warning(title, message, options = {}) {
        return this.show({
            ...options,
            type: 'warning',
            title,
            message
        });
    }
    
    info(title, message, options = {}) {
        return this.show({
            ...options,
            type: 'info',
            title,
            message
        });
    }
    
    progress(title, message, progress, options = {}) {
        return this.show({
            ...options,
            title,
            message,
            progress,
            duration: 0 // Pas d'auto-fermeture
        });
    }
    
    updateProgress(id, progress, message) {
        this.update(id, { progress, message });
    }
    
    confirm(title, message, onConfirm, onCancel) {
        return this.show({
            type: 'warning',
            title,
            message,
            persistent: true,
            actions: [
                {
                    id: 'confirm',
                    label: 'Confirmer',
                    handler: () => {
                        if (onConfirm) onConfirm();
                    }
                },
                {
                    id: 'cancel',
                    label: 'Annuler',
                    handler: () => {
                        if (onCancel) onCancel();
                    }
                }
            ]
        });
    }
    
    getAll() {
        return Array.from(this.notifications.values());
    }
    
    getCount() {
        return this.notifications.size;
    }
    
    clearAll() {
        this.closeAll();
        this.queue = [];
        
        if (this.options.enableStorage) {
            localStorage.removeItem(this.options.storageKey);
        }
    }
    
    destroy() {
        this.clearAll();
        if (this.container) {
            this.container.remove();
        }
    }
}

// =============================================
// NOTIFICATION BADGE
// =============================================

class NotificationBadge {
    constructor(element, options = {}) {
        this.element = element;
        this.options = {
            position: 'top-right',
            animated: true,
            max: 99,
            ...options
        };
        
        this.count = 0;
        this.badge = null;
        
        this.init();
    }
    
    init() {
        this.element.style.position = 'relative';
        this.createBadge();
    }
    
    createBadge() {
        this.badge = document.createElement('span');
        this.badge.className = `notification-badge badge-${this.options.position}`;
        
        if (this.options.animated) {
            this.badge.classList.add('badge-animated');
        }
        
        this.element.appendChild(this.badge);
        this.update(0);
    }
    
    update(count) {
        this.count = count;
        
        if (count === 0) {
            this.badge.style.display = 'none';
        } else {
            this.badge.style.display = '';
            this.badge.textContent = count > this.options.max ? `${this.options.max}+` : count;
            
            // Animation pulse
            if (this.options.animated && count > 0) {
                this.badge.classList.add('badge-pulse');
                setTimeout(() => {
                    this.badge.classList.remove('badge-pulse');
                }, 600);
            }
        }
    }
    
    increment() {
        this.update(this.count + 1);
    }
    
    decrement() {
        this.update(Math.max(0, this.count - 1));
    }
    
    clear() {
        this.update(0);
    }
    
    destroy() {
        if (this.badge) {
            this.badge.remove();
        }
    }
}

// =============================================
// EXPORT
// =============================================

window.NotificationSystem = NotificationSystem;
window.NotificationBadge = NotificationBadge;

// Instance globale
window.Notifications = new NotificationSystem();