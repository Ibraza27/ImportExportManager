/**
 * Point d'entrée principal Electron
 * Configuration sécurisée et optimisée pour l'application Import Export Manager
 */
const { app, BrowserWindow, Menu, ipcMain, dialog, shell, session } = require('electron');
const path = require('path');
const net = require('net');
const log = require('electron-log');

// Configuration de l'application
const config = {
    serverPort: 3000,
    serverUrl: 'http://localhost:3000',
    isDev: process.env.NODE_ENV === 'development' || process.argv.includes('--dev'),
    mainWindowConfig: {
        width: 1400,
        height: 900,
        minWidth: 1200,
        minHeight: 700,
        show: false,
        icon: path.join(__dirname, 'assets/images/icon.png'),
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js'),
            webSecurity: true, // Activé pour la sécurité
            allowRunningInsecureContent: false,
            experimentalFeatures: false,
            enableRemoteModule: false
        },
        titleBarStyle: 'default',
        backgroundColor: '#1e1e1e'
    }
};

// Configuration du logger Electron
log.transports.file.resolvePath = () => path.join(app.getPath('userData'), 'logs', 'electron.log');
log.transports.file.level = 'info';
log.transports.file.maxSize = 5 * 1024 * 1024; // 5MB
log.transports.console.level = config.isDev ? 'debug' : 'error';

// Variables globales
let mainWindow = null;
let splashWindow = null;
let serverProcess = null;



// =============================================
// SÉCURITÉ - Désactiver les fonctionnalités dangereuses
// =============================================
app.on('web-contents-created', (event, contents) => {
    contents.on('new-window', (event, navigationUrl) => {
        event.preventDefault();
        log.warn('Tentative d\'ouverture de nouvelle fenêtre bloquée:', navigationUrl);
    });

    contents.on('will-navigate', (event, navigationUrl) => {
        const parsedUrl = new URL(navigationUrl);
        if (parsedUrl.origin !== config.serverUrl && parsedUrl.protocol !== 'file:') {
            event.preventDefault();
            log.warn('Navigation externe bloquée:', navigationUrl);
        }
    });
});

app.on('ready', () => {
    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
        callback({
            responseHeaders: {
                ...details.responseHeaders,
                'Content-Security-Policy': [
                    "default-src 'self'",
                    "script-src 'self' 'unsafe-inline'",
                    "style-src 'self' 'unsafe-inline'",
                    "img-src 'self' data: blob:",
                    "connect-src 'self' ws://localhost:* http://localhost:*",
                    "font-src 'self'"
                ].join('; ')
            }
        });
    });
});

// =============================================
// FONCTIONS DE GESTION DES FENÊTRES
// =============================================
/**
 * Créer la fenêtre splash
 */
function createSplashWindow() {
    splashWindow = new BrowserWindow({
        width: 500,
        height: 300,
        frame: false,
        alwaysOnTop: true,
        transparent: true,
        resizable: false,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true
        }
    });

    splashWindow.loadFile(path.join(__dirname, 'src/splash.html'));
    splashWindow.on('closed', () => {
        splashWindow = null;
    });
}

/**
 * Créer la fenêtre principale
 */
function createMainWindow() {
    log.info('Création de la fenêtre principale');
    mainWindow = new BrowserWindow(config.mainWindowConfig);

    // Configuration CSP pour permettre les connexions au serveur local
    mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
        callback({
            responseHeaders: {
                ...details.responseHeaders,
                'Content-Security-Policy': ["default-src 'self' http://localhost:3000; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' http://localhost:3000 ws://localhost:3000;"]
            }
        });
    });

    // Gestion des erreurs de chargement
    mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
        log.error('Erreur de chargement:', errorCode, errorDescription);
        dialog.showErrorBox('Erreur de chargement',
            `L'application n'a pas pu se charger.\nCode d'erreur: ${errorCode}\n${errorDescription}`);
    });

    // Log des erreurs console
    mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
        if (level >= 2) { // Warnings et erreurs
            log.warn(`Console [${sourceId}:${line}]: ${message}`);
        }
    });

    // Charger l'application
    mainWindow.loadFile(path.join(__dirname, 'src/index.html'));

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

// =============================================
// GESTION DU MENU
// =============================================
function createMenu() {
    const template = [
        {
            label: 'Fichier',
            submenu: [
                {
                    label: 'Nouveau Client',
                    accelerator: 'CmdOrCtrl+N',
                    click: () => {
                        mainWindow.webContents.send('menu-action', 'new-client');
                    }
                },
                {
                    label: 'Nouveau Conteneur',
                    accelerator: 'CmdOrCtrl+Shift+N',
                    click: () => {
                        mainWindow.webContents.send('menu-action', 'new-conteneur');
                    }
                },
                { type: 'separator' },
                {
                    label: 'Importer Données',
                    click: () => {
                        mainWindow.webContents.send('menu-action', 'import-data');
                    }
                },
                {
                    label: 'Exporter Données',
                    click: () => {
                        mainWindow.webContents.send('menu-action', 'export-data');
                    }
                },
                { type: 'separator' },
                {
                    label: 'Quitter',
                    accelerator: 'CmdOrCtrl+Q',
                    click: () => {
                        app.quit();
                    }
                }
            ]
        },
        {
            label: 'Édition',
            submenu: [
                { label: 'Annuler', accelerator: 'CmdOrCtrl+Z', role: 'undo' },
                { label: 'Rétablir', accelerator: 'CmdOrCtrl+Y', role: 'redo' },
                { type: 'separator' },
                { label: 'Couper', accelerator: 'CmdOrCtrl+X', role: 'cut' },
                { label: 'Copier', accelerator: 'CmdOrCtrl+C', role: 'copy' },
                { label: 'Coller', accelerator: 'CmdOrCtrl+V', role: 'paste' }
            ]
        },
        {
            label: 'Affichage',
            submenu: [
                {
                    label: 'Actualiser',
                    accelerator: 'F5',
                    click: () => {
                        mainWindow.reload();
                    }
                },
                {
                    label: 'Plein écran',
                    accelerator: 'F11',
                    click: () => {
                        mainWindow.setFullScreen(!mainWindow.isFullScreen());
                    }
                },
                { type: 'separator' },
                {
                    label: 'Zoom +',
                    accelerator: 'CmdOrCtrl+Plus',
                    click: () => {
                        mainWindow.webContents.zoomLevel += 0.5;
                    }
                },
                {
                    label: 'Zoom -',
                    accelerator: 'CmdOrCtrl+-',
                    click: () => {
                        mainWindow.webContents.zoomLevel -= 0.5;
                    }
                },
                {
                    label: 'Zoom 100%',
                    accelerator: 'CmdOrCtrl+0',
                    click: () => {
                        mainWindow.webContents.zoomLevel = 0;
                    }
                }
            ]
        },
        {
            label: 'Outils',
            submenu: [
                {
                    label: 'Scanner Code-barres',
                    accelerator: 'CmdOrCtrl+B',
                    click: () => {
                        mainWindow.webContents.send('menu-action', 'open-scanner');
                    }
                },
                {
                    label: 'Calculatrice',
                    click: () => {
                        mainWindow.webContents.send('menu-action', 'open-calculator');
                    }
                },
                { type: 'separator' },
                {
                    label: 'Paramètres',
                    accelerator: 'CmdOrCtrl+,',
                    click: () => {
                        mainWindow.webContents.send('menu-action', 'open-settings');
                    }
                }
            ]
        },
        {
            label: 'Aide',
            submenu: [
                {
                    label: 'Documentation',
                    click: () => {
                        shell.openExternal('file://' + path.join(__dirname, '../docs/USER_GUIDE.md'));
                    }
                },
                {
                    label: 'Raccourcis clavier',
                    click: () => {
                        mainWindow.webContents.send('menu-action', 'show-shortcuts');
                    }
                },
                { type: 'separator' },
                {
                    label: 'Vérifier les mises à jour',
                    click: () => {
                        mainWindow.webContents.send('menu-action', 'check-updates');
                    }
                },
                { type: 'separator' },
                {
                    label: 'À propos',
                    click: () => {
                        dialog.showMessageBox(mainWindow, {
                            type: 'info',
                            title: 'À propos',
                            message: 'Import Export Manager',
                            detail: 'Version 1.0.0\n\nSystème de gestion d\'import-export maritime\n© 2024 Votre Entreprise',
                            buttons: ['OK']
                        });
                    }
                }
            ]
        }
    ];

    // Ajouter menu développeur en mode dev
    if (config.isDev) {
        template.push({
            label: 'Développeur',
            submenu: [
                {
                    label: 'Outils de développement',
                    accelerator: 'F12',
                    click: () => {
                        mainWindow.webContents.toggleDevTools();
                    }
                },
                { type: 'separator' },
                {
                    label: 'Recharger sans cache',
                    accelerator: 'CmdOrCtrl+Shift+R',
                    click: () => {
                        mainWindow.webContents.reloadIgnoringCache();
                    }
                }
            ]
        });
    }

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
}

// =============================================
// GESTIONNAIRES IPC (Communication avec le renderer)
// =============================================
// Dialogue pour sélectionner un fichier
ipcMain.handle('dialog:openFile', async (event, options) => {
    const defaultOptions = {
        properties: ['openFile'],
        filters: [
            { name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif'] },
            { name: 'Documents', extensions: ['pdf', 'doc', 'docx'] },
            { name: 'Tous les fichiers', extensions: ['*'] }
        ]
    };
    const result = await dialog.showOpenDialog(mainWindow, options || defaultOptions);
    return result;
});

// Dialogue pour sauvegarder un fichier
ipcMain.handle('dialog:saveFile', async (event, options) => {
    const defaultOptions = {
        filters: [
            { name: 'PDF', extensions: ['pdf'] },
            { name: 'Excel', extensions: ['xlsx'] },
            { name: 'CSV', extensions: ['csv'] }
        ]
    };
    const result = await dialog.showSaveDialog(mainWindow, options || defaultOptions);
    return result;
});

// Afficher une notification
ipcMain.handle('notification:show', async (event, options) => {
    return await dialog.showMessageBox(mainWindow, options);
});

// Obtenir les informations système
ipcMain.handle('system:getInfo', async () => {
    return {
        version: app.getVersion(),
        electron: process.versions.electron,
        node: process.versions.node,
        chrome: process.versions.chrome,
        platform: process.platform,
        arch: process.arch
    };
});

// Contrôles fenêtre
ipcMain.on('app:minimize', () => {
    if (mainWindow) mainWindow.minimize();
});

ipcMain.on('app:maximize', () => {
    if (mainWindow) {
        if (mainWindow.isMaximized()) {
            mainWindow.unmaximize();
        } else {
            mainWindow.maximize();
        }
    }
});

ipcMain.on('app:close', () => {
    if (mainWindow) mainWindow.close();
});

ipcMain.handle('app:isMaximized', () => {
    return mainWindow ? mainWindow.isMaximized() : false;
});

// Logs
ipcMain.on('log:info', (event, { message, data }) => {
    log.info(message, data);
});

ipcMain.on('log:warn', (event, { message, data }) => {
    log.warn(message, data);
});

ipcMain.on('log:error', (event, { message, data }) => {
    log.error(message, data);
});

// =============================================
// FONCTION DE VÉRIFICATION DU SERVEUR (la version simple qui attend)
// =============================================
function checkServerAndShow() {
    log.info(`Vérification de la connexion au serveur sur le port ${config.serverPort}...`);
    
    const client = net.connect({ port: config.serverPort, host: '127.0.0.1' }, () => {
        log.info('✅ Le serveur est en ligne et répond. Lancement de l\'application.');
        client.end();
        
        if (splashWindow) splashWindow.close();
        if (mainWindow) {
            mainWindow.show();
            if (config.isDev) {
                mainWindow.webContents.openDevTools({ mode: 'detach' });
            }
        }
    });

    client.on('error', (err) => {
        log.warn(`Serveur non encore prêt (Erreur: ${err.code}). Nouvelle tentative dans 2 secondes...`);
        setTimeout(checkServerAndShow, 2000);
    });
}

/**
 * Attendre que le serveur soit prêt
 */
async function waitForServer(maxAttempts = 30) {
    log.info('Attente du serveur...');

    for (let i = 0; i < maxAttempts; i++) {
        if (await checkServerReady()) {
            log.info('✅ Serveur prêt !');
            return true;
        }

        if (i % 5 === 0) {
            log.info(`Tentative ${i + 1}/${maxAttempts}...`);
        }

        await new Promise(resolve => setTimeout(resolve, 1000));
    }

    log.error('❌ Le serveur n\'a pas démarré après 30 secondes');
    return false;
}

/**
 * Démarrer le serveur backend
 */
function startServer() {
    return new Promise((resolve, reject) => {
        try {
            log.info('Démarrage du serveur backend...');

            const serverPath = path.join(__dirname, '..', 'start-server.bat');
            
            // ✅ CORRECTION : On entoure le chemin de guillemets pour gérer les espaces
            const command = `"${serverPath}"`; 

            serverProcess = spawn('cmd.exe', ['/c', command], {
                detached: false,
                stdio: 'pipe',
                windowsHide: true
            });
            serverProcess.stdout.on('data', (data) => {
                const message = data.toString();
                log.info(`[SERVER] ${message}`);

                if (message.includes('Serveur démarré')) {
                    resolve();
                }
            });

            serverProcess.stderr.on('data', (data) => {
                log.error(`[SERVER ERROR] ${data}`);
            });

            serverProcess.on('error', (error) => {
                log.error('Erreur démarrage serveur:', error);
                reject(error);
            });

            // Timeout de sécurité
            setTimeout(() => resolve(), 5000);

        } catch (error) {
            log.error('Erreur lancement serveur:', error);
            reject(error);
        }
    });
}

// =============================================
// CYCLE DE VIE DE L'APPLICATION (VERSION CORRIGÉE ET SIMPLIFIÉE)
// =============================================
app.whenReady().then(() => {
    log.info('Application Electron prête');

    createSplashWindow();
    createMainWindow(); // La fenêtre est créée mais reste cachée
    createMenu();

    // On ne démarre PLUS le serveur ici, on ATTEND simplement qu'il soit prêt.
    checkServerAndShow(); 

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createMainWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('before-quit', async (event) => {
    log.info('Fermeture de l\'application...');

    // Terminer le serveur proprement
    if (serverProcess) {
        event.preventDefault();

        try {
            serverProcess.kill('SIGTERM');
            setTimeout(() => {
                if (serverProcess) {
                    serverProcess.kill('SIGKILL');
                }
                app.quit();
            }, 5000);
        } catch (error) {
            log.error('Erreur fermeture serveur:', error);
        }
    }
});

// Empêcher multiple instances
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
    app.quit();
} else {
    app.on('second-instance', () => {
        // Si quelqu'un essaie de lancer une deuxième instance
        if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.focus();
        }
    });
}

// Gestion des erreurs non capturées
process.on('uncaughtException', (error) => {
    log.error('Exception non capturée:', error);
    dialog.showErrorBox('Erreur inattendue', error.message);
});

process.on('unhandledRejection', (error) => {
    log.error('Promesse rejetée non gérée:', error);
});
