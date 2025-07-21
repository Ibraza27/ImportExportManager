/**
 * Script de préchargement (Preload) - Bridge Sécurisé et Cohérent
 * -----------------------------------------------------------------
 * Ce script agit comme un pont sécurisé entre le processus de rendu (Renderer)
 * et le processus principal (Main). Il expose une API soigneusement définie
 * au contexte de la fenêtre (window) via `contextBridge`, sans exposer
 * les modules Node.js complets.
 *
 * Principes :
 * 1. Sécurité : Aucune API Node.js (comme `fs` ou `path`) n'est directement
 *    exposée. Toute opération sensible est demandée au processus principal via IPC.
 * 2. Isolation : Le renderer ne peut interagir avec le système d'exploitation
 *    qu'à travers les fonctions définies ici.
 * 3. Clarté : L'API est organisée par domaines de responsabilité (système,
 *    fichiers, dialogues, etc.).
 */
const { contextBridge, ipcRenderer } = require('electron');

// Liste des canaux IPC autorisés pour une meilleure lisibilité et maintenance.
// Bien que non utilisé pour une validation d'exécution ici, c'est une excellente pratique.
const IPC_CHANNELS = {
    INVOKE: [
        'system:getInfo', 'system:getEnvironment', 'system:getVersion',
        'config:get', 'config:set',
        'window:isMaximized',
        'dialog:openFile', 'dialog:saveFile', 'dialog:showMessage',
        'file:read', 'file:write', 'file:exists',
        'backup:create', 'backup:restore', 'backup:list',
        'print:pdf', 'print:preview',
        'update:check',
        'error:capture' // Pour remonter les erreurs capturées au main process
    ],
    SEND: [
        'log:info', 'log:warn', 'log:error', 'log:debug',
        'window:minimize', 'window:maximize', 'window:close',
        'scanner:start', 'scanner:stop',
        'log:userAction'
    ],
    ON: [
        'menu-action',
        'scanner:data',
        'update:available', 'update:progress', 'update:complete'
    ]
};

// --- API Exposée au Renderer ---
contextBridge.exposeInMainWorld('electronAPI', {

    // --- Informations Système (lecture seule) ---
    system: {
        getInfo: () => ipcRenderer.invoke('system:getInfo'), // e.g., { platform, arch, versions }
        getEnvironment: () => ipcRenderer.invoke('system:getEnvironment'), // 'development' or 'production'
        getVersion: () => ipcRenderer.invoke('system:getVersion'), // App version from package.json
    },

    // --- Journalisation (Logging) via le processus principal ---
    log: {
        info: (message, data) => ipcRenderer.send('log:info', { message, data }),
        warn: (message, data) => ipcRenderer.send('log:warn', { message, data }),
        error: (message, data) => ipcRenderer.send('log:error', { message, data }),
        debug: (message, data) => ipcRenderer.send('log:debug', { message, data }),
    },

    // --- Configuration (gérée par le processus principal) ---
    config: {
        get: (key) => ipcRenderer.invoke('config:get', key),
        set: (key, value) => ipcRenderer.invoke('config:set', key, value),
        getServerUrl: () => ipcRenderer.invoke('config:get', 'apiUrl'),
        getSocketUrl: () => ipcRenderer.invoke('config:get', 'socketUrl'),
    },

    // --- Contrôles de Fenêtre ---
    window: {
        minimize: () => ipcRenderer.send('window:minimize'),
        maximize: () => ipcRenderer.send('window:maximize'),
        close: () => ipcRenderer.send('window:close'),
        isMaximized: () => ipcRenderer.invoke('window:isMaximized'),
    },

    // --- Dialogues Système ---
    dialog: {
        openFile: (options) => ipcRenderer.invoke('dialog:openFile', options),
        saveFile: (options) => ipcRenderer.invoke('dialog:saveFile', options),
        showMessage: (options) => ipcRenderer.invoke('dialog:showMessage', options),
    },

    // --- Gestion de Fichiers (sécurisée via le processus principal) ---
    file: {
        read: (path) => ipcRenderer.invoke('file:read', path),
        write: (path, data) => ipcRenderer.invoke('file:write', path, data),
        exists: (path) => ipcRenderer.invoke('file:exists', path),
    },

    // --- Gestion des Actions du Menu ---
    onMenuAction: (callback) => {
        // Nettoie les anciens listeners pour éviter les fuites de mémoire
        ipcRenderer.removeAllListeners('menu-action');
        ipcRenderer.on('menu-action', (_event, action) => callback(action));
    },

    // --- Scanner (Exemple) ---
    scanner: {
        start: () => ipcRenderer.send('scanner:start'),
        stop: () => ipcRenderer.send('scanner:stop'),
        onData: (callback) => {
            ipcRenderer.removeAllListeners('scanner:data');
            ipcRenderer.on('scanner:data', (_event, data) => callback(data));
        }
    },
    
    // --- Mises à jour Automatiques ---
    updates: {
        check: () => ipcRenderer.invoke('update:check'),
        onAvailable: (callback) => {
            ipcRenderer.removeAllListeners('update:available');
            ipcRenderer.on('update:available', (_event, info) => callback(info));
        },
        onProgress: (callback) => {
            ipcRenderer.removeAllListeners('update:progress');
            ipcRenderer.on('update:progress', (_event, progress) => callback(progress));
        },
        onComplete: (callback) => {
            ipcRenderer.removeAllListeners('update:complete');
            ipcRenderer.on('update:complete', (_event) => callback());
        }
    },

    // --- API de Gestion des Erreurs ---
    error: {
        /**
         * Capture et remonte une erreur au processus principal pour journalisation
         * et envoi éventuel à un service de monitoring.
         */
        capture: (error, context = {}) => {
            const errorInfo = {
                message: error.message || 'Erreur inconnue',
                stack: error.stack,
                timestamp: new Date().toISOString(),
                context, // Contexte supplémentaire fourni par le développeur
                location: window.location.href, // URL où l'erreur s'est produite
            };
            // On envoie l'erreur au processus principal qui décidera quoi en faire
            ipcRenderer.invoke('error:capture', errorInfo);
        },
        
        /**
         * Journalise une action utilisateur importante pour le débogage.
         */
        logUserAction: (action, details = {}) => {
            ipcRenderer.send('log:userAction', { action, details, timestamp: new Date().toISOString() });
        }
    }
});

// --- Interception Globale des Erreurs du Renderer ---
// Ces écouteurs attrapent les erreurs non capturées dans votre code React/Vue/etc.

window.addEventListener('error', (event) => {
    // Empêche l'erreur de s'afficher dans la console du renderer,
    // car nous allons la gérer nous-mêmes.
    event.preventDefault();

    // Utilise notre API de capture unifiée
    window.electronAPI.error.capture(event.error, {
        source: 'Global window.onerror',
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
    });
});

window.addEventListener('unhandledrejection', (event) => {
    // Empêche l'erreur de s'afficher dans la console.
    event.preventDefault();

    // La 'reason' peut être une instance d'Error ou autre chose.
    const reason = event.reason;
    const error = reason instanceof Error ? reason : new Error(JSON.stringify(reason));

    // Utilise notre API de capture unifiée
    window.electronAPI.error.capture(error, {
        source: 'Global unhandledrejection'
    });
});

console.log('✅ Preload script chargé et bridge "electronAPI" initialisé.');
