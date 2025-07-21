// ✅ CORRECTION : Ces fichiers sont déjà chargés via index.html
// Supprimer ces imports ou les transformer en scripts
// Import des nouveaux modules d'optimisation
//import './utils/cache.js';
//import './utils/websocket.js';

// Mock electronAPI si non disponible (pour éviter les erreurs)
if (typeof window.electronAPI === 'undefined') {
    window.electronAPI = {
        log: {
            info: console.log,
            warn: console.warn,
            error: console.error,
            debug: console.debug
        },
        configAPI: {
            getApiUrl: () => 'http://localhost:3000/api',
            getSocketUrl: () => 'http://localhost:3000'
        },
        errorAPI: {
            logUserAction: (action, details) => console.log(`User action: ${action}`, details)
        }
    };
}
/**
 * Application principale - Gestion de l'interface et de la navigation
 */
// Variables globales
let currentUser = null;
let currentPage = 'dashboard';
let socket = null;
let modules = {};
// =============================================
// INITIALISATION DE L'APPLICATION
// =============================================
document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Afficher le loader
        showLoader('Initialisation du système...');

        // Initialiser les APIs
        await initializeAPIs();

        // Vérifier la connexion au serveur
        const isConnected = await checkServerConnection();
        if (!isConnected) {
            throw new Error('Impossible de se connecter au serveur');
        }

        // Initialiser WebSocket
        await initWebSocket(); 

        // Charger les données utilisateur
        await loadUserData();

        await preloadData();

        // Initialiser l'interface
        initializeUI();

        // Charger la page par défaut
        await loadPage('dashboard');

        // Cacher le loader
        hideLoader();

        // Log de succès
        window.electronAPI.log.info('Application démarrée avec succès');

    } catch (error) {
        window.electronAPI.log.error('Erreur au démarrage:', error);

        // Cacher les DEUX loaders au cas où
        hideLoader();
        const appLoader = document.getElementById('app-loader');
        if (appLoader) appLoader.style.display = 'none';
        showError('Erreur de démarrage', error.message);
    }
});
// =============================================
// INITIALISATION DES APIS
// =============================================
async function initializeAPIs() {
    console.log('1. Début initializeAPIs');

    // Vérifier que les APIs Electron sont disponibles
    if (!window.electronAPI || !window.electronAPI.configAPI) {
        console.error('window.electronAPI ou configAPI est undefined !');
        throw new Error('APIs Electron (configAPI) non disponibles via preload.js');
    }

    console.log('2. electronAPI disponible:', Object.keys(window.electronAPI));

    // Initialiser l'API backend en utilisant le bon chemin
    const apiUrl = await window.electronAPI.configAPI.getApiUrl();
    console.log('3. API URL obtenue:', apiUrl);

    window.API.init(apiUrl);
    console.log('4. API initialisée');

    // Configurer les intercepteurs d'erreurs
    window.API.setErrorHandler((error) => {
        window.electronAPI.log.error('Erreur API:', error);
        handleAPIError(error);
    });
}

// =============================================
// VÉRIFICATION DE LA CONNEXION
// =============================================
async function checkServerConnection() {
    console.log('5. Vérification connexion serveur...');
    try {
        const response = await window.API.get('/health');
        console.log('6. Réponse serveur:', response);
        updateConnectionStatus(response.database === 'Connecté');
        return true;
    } catch (error) {
        console.error('7. Erreur connexion serveur:', error);
        updateConnectionStatus(false);
        return false;
    }
}
function updateConnectionStatus(isConnected) {
    const statusElement = document.getElementById('connection-status');
    if (isConnected) {
        statusElement.innerHTML = '<i class="fas fa-circle"></i> Connecté';
        statusElement.className = 'text-success';
    } else {
        statusElement.innerHTML = '<i class="fas fa-circle"></i> Déconnecté';
        statusElement.className = 'text-danger';
    }
}

// =============================================
// INITIALISATION WEBSOCKET (NOUVELLE VERSION)
// =============================================
async function initWebSocket() {
    try {
        const socketUrl = await window.electronAPI.configAPI.getSocketUrl();
        const authToken = localStorage.getItem('authToken');
        
        // Initialiser la connexion WebSocket via le module
        window.socket.init(socketUrl, authToken);
        
        // Configuration des événements globaux
        window.socket.on('connected', () => {
            window.electronAPI.log.info('WebSocket connecté');
            updateConnectionStatus(true);
        });
        
        window.socket.on('disconnected', (reason) => {
            window.electronAPI.log.warn(`WebSocket déconnecté: ${reason}`);
            updateConnectionStatus(false);
        });
        
        // Événements métier
        window.socket.on('client:updated', (data) => {
            handleRealtimeUpdate('client', data);
        });
        
        window.socket.on('conteneur:updated', (data) => {
            handleRealtimeUpdate('conteneur', data);
        });
        
        window.socket.on('paiement:created', (data) => {
            handleRealtimeUpdate('paiement', data);
            showNotification('Nouveau paiement', `Paiement de ${data.montant}€ enregistré`);
        });
        
        window.socket.on('scan:processed', (data) => {
            handleRealtimeUpdate('scan', data);
        });
        
        // Gestion des erreurs WebSocket
        window.socket.on('error', (error) => {
            window.electronAPI.log.error('Erreur WebSocket:', error);
        });
        
    } catch (error) {
        window.electronAPI.log.error('Erreur d\'initialisation WebSocket:', error);
    }
}

// =============================================
// GESTION DES MISES À JOUR TEMPS RÉEL
// =============================================
function handleRealtimeUpdate(type, data) {
    window.electronAPI.log.info(`Mise à jour temps réel: ${type}`, data);

    // Mettre à jour l'interface si nécessaire
    if (modules[currentPage] && modules[currentPage].handleRealtimeUpdate) {
        modules[currentPage].handleRealtimeUpdate(type, data);
    }

    // Mettre à jour les badges
    updateBadges();

    // Mettre à jour l'heure de dernière sync
    document.getElementById('last-sync').textContent =
        `Dernière sync: ${new Date().toLocaleTimeString('fr-FR')}`;
}

// =============================================
// CHARGEMENT DES DONNÉES UTILISATEUR
// =============================================
async function loadUserData() {
    console.log('8. Chargement données utilisateur...');
    try {
        // ÉTAPE 1: Essayer de se connecter en tant qu'admin par défaut
        // Ces identifiants doivent correspondre à ceux dans votre schema.sql
        const credentials = {
            email: 'ibrahim.ibraza@hotmail.fr',
            password: 'calvin'                  // Ce mot de passe correspond à celui dans init.js
        };
        console.log('9. Tentative de login...');
        const authResponse = await window.API.post('/auth/login', credentials);
        console.log('10. Réponse auth:', authResponse);

        if (authResponse && authResponse.token) {
            // ÉTAPE 2: Succès ! On a un token. On le sauvegarde.
            window.API.setAuthToken(authResponse.token);
            currentUser = authResponse.user;
            // ÉTAPE 3: Mettre à jour l'interface avec les vraies données
            document.querySelector('.user-name').textContent = `${currentUser.prenom} ${currentUser.nom}`;
            document.querySelector('.user-role').textContent = getRoleName(currentUser.role);

            console.log('11. Utilisateur connecté:', currentUser);
            window.electronAPI.log.info('Utilisateur authentifié avec succès:', currentUser.email);
        } else {
            throw new Error("Échec de l'authentification automatique");
        }
    } catch (error) {
        console.error('12. Erreur auth:', error);
        window.electronAPI.log.error('Erreur chargement/authentification utilisateur:', error);
        // Si l'authentification échoue, on affiche un message clair
        showError('Échec de l\'authentification', 'Impossible de se connecter. Vérifiez vos identifiants par défaut et la connexion au serveur.');
        throw error; // Important de propager l'erreur pour arrêter l'initialisation
    }
}

function getRoleName(role) {
    const roles = {
        'admin': 'Administrateur',
        'gestionnaire': 'Gestionnaire',
        'operateur': 'Opérateur',
        'comptable': 'Comptable',
        'invite': 'Invité'
    };
    return roles[role] || role;
}
// =============================================
// INITIALISATION DE L'INTERFACE
// =============================================
function initializeUI() {
    // Gestionnaire du menu sidebar
    initializeSidebar();

    // Gestionnaire du thème
    initializeTheme();

    // Gestionnaire des actions rapides
    initializeQuickActions();

    // Gestionnaire des notifications
    initializeNotifications();

    // Gestionnaire de recherche globale
    initializeGlobalSearch();

    // Gestionnaire des raccourcis clavier
    initializeKeyboardShortcuts();

    // Écouter les actions du menu Electron
    window.electronAPI.onMenuAction((action) => {
        handleMenuAction(action);
    });
}
// =============================================
// GESTION DE LA SIDEBAR
// =============================================
function initializeSidebar() {
    // Toggle sidebar
    document.getElementById('sidebar-toggle').addEventListener('click', () => {
        document.getElementById('sidebar').classList.toggle('collapsed');
        localStorage.setItem('sidebarCollapsed',
            document.getElementById('sidebar').classList.contains('collapsed'));
    });

    // Restaurer l'état de la sidebar
    if (localStorage.getItem('sidebarCollapsed') === 'true') {
        document.getElementById('sidebar').classList.add('collapsed');
    }

    // Gestionnaire des clics sur les items du menu
    document.querySelectorAll('.menu-item').forEach(item => {
        item.addEventListener('click', async (e) => {
            e.preventDefault();
            const page = item.dataset.page;
            if (page && page !== currentPage) {
                await loadPage(page);
            }
        });
    });

    // Bouton déconnexion
    document.getElementById('btn-logout').addEventListener('click', () => {
        confirmLogout();
    });
}
// =============================================
// GESTION DU THÈME
// =============================================
function initializeTheme() {
    const themeButton = document.getElementById('btn-toggle-theme');
    const themeStyle = document.getElementById('theme-style');

    // Charger le thème sauvegardé
    const savedTheme = localStorage.getItem('theme') || 'dark';
    if (savedTheme === 'light') {
        themeStyle.href = 'styles/light-theme.css';
        themeButton.innerHTML = '<i class="fas fa-sun"></i>';
    }

    // Toggle thème
    themeButton.addEventListener('click', () => {
        const isLight = themeStyle.href.includes('light');
        if (isLight) {
            themeStyle.href = 'styles/dark-theme.css';
            themeButton.innerHTML = '<i class="fas fa-moon"></i>';
            localStorage.setItem('theme', 'dark');
        } else {
            themeStyle.href = 'styles/light-theme.css';
            themeButton.innerHTML = '<i class="fas fa-sun"></i>';
            localStorage.setItem('theme', 'light');
        }
    });
}

// =============================================
// PRÉCHARGEMENT DES DONNÉES IMPORTANTES
// =============================================
async function preloadData() {
    try {
        window.electronAPI.log.info('Préchargement des données importantes...');
        
        // Précharger les données et les mettre en cache
        await Promise.all([
            window.cache.preload('/clients?limit=100', { cacheTTL: 300000 }), // 5 minutes
            window.cache.preload('/conteneurs/active', { cacheTTL: 60000 }),   // 1 minute
            window.cache.preload('/config/app', { 
                cacheTTL: 3600000, 
                persistCache: true 
            })
        ]);
        
    } catch (error) {
        if (error.isNetworkError) {
            window.electronAPI.log.warn('Préchargement retardé: réseau indisponible');
            // Réessayer plus tard
            setTimeout(preloadData, 30000); 
        } else {
            window.electronAPI.log.error('Erreur critique lors du préchargement:', error);
        }
    }
}

// =============================================
// CHARGEMENT DES PAGES
// =============================================
async function loadPage(pageName) {
    try {
        showContentLoader();

        // Mettre à jour la navigation active
        document.querySelectorAll('.menu-item').forEach(item => {
            item.classList.remove('active');
        });
        document.querySelector(`[data-page="${pageName}"]`).classList.add('active');

        // Mettre à jour le titre et breadcrumb
        updatePageHeader(pageName);

        // Charger le module si pas déjà chargé
        if (!modules[pageName]) {
            await loadModule(pageName, { forceReload: false });
        }

        // Charger le contenu HTML
        const contentArea = document.getElementById('content-area');
        const htmlPath = `pages/${pageName}.html`;

        try {
            const htmlContent = await fetch(htmlPath).then(r => r.text());
            contentArea.innerHTML = htmlContent;
        } catch (error) {
            // Si le fichier HTML n'existe pas, utiliser un template par défaut
            contentArea.innerHTML = getDefaultPageTemplate(pageName);
        }

        // Initialiser le module
        if (modules[pageName] && modules[pageName].init) {
            await modules[pageName].init();
        }

        currentPage = pageName;
        hideContentLoader();

        // Log navigation
        window.electronAPI.log.info(`Page chargée: ${pageName}`);
        window.electronAPI.errorAPI.logUserAction('navigation', { page: pageName });

    } catch (error) {
        hideContentLoader();
        window.electronAPI.log.error(`Erreur chargement page ${pageName}:`, error);
        showError('Erreur de chargement', `Impossible de charger la page ${pageName}`);
    }
}

async function loadModule(moduleName, params = {}) {
    try {
        const cacheKey = `module:${moduleName}`;
        const cachedModule = window.cache.get(cacheKey);
        
        // Utiliser le cache si disponible et pas de rechargement forcé
        if (cachedModule && !params.forceReload) {
            window.electronAPI.log.info(`Chargement du module ${moduleName} depuis le cache`);
            modules[moduleName] = cachedModule;
            return;
        }
        
        // Charger dynamiquement le module
        const module = await import(`./modules/${moduleName}.js`);
        modules[moduleName] = module;
        
        // Mettre en cache les modules réutilisables
        if (['clients', 'marchandises', 'conteneurs'].includes(moduleName)) {
            window.cache.set(cacheKey, module, { ttl: 3600000 }); // Cache pour 1 heure
        }
        
    } catch (error) {
        window.electronAPI.log.warn(`Module ${moduleName} non trouvé, utilisation du module par défaut`);
        modules[moduleName] = getDefaultModule(moduleName);
    }
}

function getDefaultModule(moduleName) {
    return {
        init: async () => {
            window.electronAPI.log.info(`Module par défaut initialisé pour: ${moduleName}`);
        },
        handleRealtimeUpdate: (type, data) => {
            window.electronAPI.log.info(`Mise à jour reçue pour ${moduleName}:`, type, data);
        }
    };
}
function getDefaultPageTemplate(pageName) {
    const titles = {
        'dashboard': 'Tableau de bord',
        'clients': 'Gestion des Clients',
        'marchandises': 'Gestion des Marchandises',
        'conteneurs': 'Gestion des Conteneurs',
        'finances': 'Gestion Financière',
        'scanner': 'Scanner de Codes-barres',
        'rapports': 'Rapports et Statistiques',
        'parametres': 'Paramètres'
    };

    return `
        <div class="container-fluid">
            <div class="row">
                <div class="col-12">
                    <div class="card">
                        <div class="card-header">
                            <h5 class="mb-0">${titles[pageName] || pageName}</h5>
                        </div>
                        <div class="card-body">
                            <div class="text-center py-5">
                                <i class="fas fa-hammer fa-3x text-muted mb-3"></i>
                                <h5>Module en cours de développement</h5>
                                <p class="text-muted">Cette fonctionnalité sera bientôt disponible.</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}
// =============================================
// MISE À JOUR DE L'INTERFACE
// =============================================
function updatePageHeader(pageName) {
    const titles = {
        'dashboard': 'Tableau de bord',
        'clients': 'Clients',
        'marchandises': 'Marchandises',
        'conteneurs': 'Conteneurs',
        'finances': 'Finances',
        'scanner': 'Scanner',
        'rapports': 'Rapports',
        'parametres': 'Paramètres'
    };

    document.getElementById('page-title').textContent = titles[pageName] || pageName;

    // Mettre à jour le breadcrumb
    const breadcrumb = document.getElementById('breadcrumb');
    breadcrumb.innerHTML = `
        <li class="breadcrumb-item"><a href="#dashboard">Accueil</a></li>
        <li class="breadcrumb-item active">${titles[pageName] || pageName}</li>
    `;
}
async function updateBadges() {
    try {
        // TODO: Récupérer les vrais compteurs depuis l'API
        const counts = {
            clients: await API.get('/clients/count'),
            marchandises: await API.get('/marchandises/count'),
            conteneurs: await API.get('/conteneurs/count'),
            finances: await API.get('/paiements/pending/count')
        };

        document.getElementById('badge-clients').textContent = counts.clients || 0;
        document.getElementById('badge-marchandises').textContent = counts.marchandises || 0;
        document.getElementById('badge-conteneurs').textContent = counts.conteneurs || 0;
        document.getElementById('badge-finances').textContent = counts.finances || 0;
    } catch (error) {
        window.electronAPI.log.error('Erreur mise à jour badges:', error);
    }
}
// =============================================
// ACTIONS RAPIDES
// =============================================
function initializeQuickActions() {
    document.getElementById('quick-add-client').addEventListener('click', (e) => {
        e.preventDefault();
        openQuickAddModal('client');
    });

    document.getElementById('quick-add-colis').addEventListener('click', (e) => {
        e.preventDefault();
        openQuickAddModal('colis');
    });

    document.getElementById('quick-add-conteneur').addEventListener('click', (e) => {
        e.preventDefault();
        openQuickAddModal('conteneur');
    });

    document.getElementById('quick-add-paiement').addEventListener('click', (e) => {
        e.preventDefault();
        openQuickAddModal('paiement');
    });
}
// =============================================
// RECHERCHE GLOBALE
// =============================================
function initializeGlobalSearch() {
    const searchInput = document.getElementById('global-search');
    let searchTimeout;

    searchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        const query = e.target.value.trim();

        if (query.length < 2) return;

        searchTimeout = setTimeout(() => {
            performGlobalSearch(query);
        }, 300);
    });

    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            performGlobalSearch(e.target.value.trim());
        }
    });
}
async function performGlobalSearch(query) {
    try {
        showLoader('Recherche en cours...');

        const results = await API.get('/search', { q: query });

        // TODO: Afficher les résultats dans un dropdown ou modal
        window.electronAPI.log.info('Résultats de recherche:', results);

        hideLoader();
    } catch (error) {
        hideLoader();
        window.electronAPI.log.error('Erreur recherche:', error);
    }
}
// =============================================
// RACCOURCIS CLAVIER
// =============================================
function initializeKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
        // Ctrl/Cmd + K : Focus recherche
        if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
            e.preventDefault();
            document.getElementById('global-search').focus();
        }

        // Ctrl/Cmd + N : Nouveau client
        if ((e.ctrlKey || e.metaKey) && e.key === 'n' && !e.shiftKey) {
            e.preventDefault();
            openQuickAddModal('client');
        }

        // Ctrl/Cmd + Shift + N : Nouveau conteneur
        if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'N') {
            e.preventDefault();
            openQuickAddModal('conteneur');
        }

        // Ctrl/Cmd + B : Scanner
        if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
            e.preventDefault();
            loadPage('scanner');
        }

        // F1 : Aide
        if (e.key === 'F1') {
            e.preventDefault();
            showHelp();
        }

        // Échap : Fermer modals
        if (e.key === 'Escape') {
            closeAllModals();
        }
    });
}
// =============================================
// GESTION DES NOTIFICATIONS
// =============================================
function initializeNotifications() {
    // Charger les notifications initiales
    loadNotifications();

    // Rafraîchir toutes les 30 secondes
    setInterval(loadNotifications, 30000);
}
async function loadNotifications() {
    try {
        const notifications = await API.get('/notifications');
        updateNotificationUI(notifications);
    } catch (error) {
        window.electronAPI.log.error('Erreur chargement notifications:', error);
    }
}
function updateNotificationUI(notifications) {
    const count = document.getElementById('notification-count');
    const list = document.getElementById('notification-list');

    count.textContent = notifications.length;
    count.style.display = notifications.length > 0 ? 'inline-block' : 'none';

    // TODO: Construire la liste des notifications
}
function showNotification(title, message, type = 'info') {
    // Notification système Electron
    window.electronAPI.showNotification({
        type: type,
        title: title,
        message: message,
        buttons: ['OK']
    });

    // Notification dans l'app (toast)
    Helpers.showToast(message, type);
}
// =============================================
// GESTIONNAIRES D'ACTIONS
// =============================================
function handleMenuAction(action) {
    window.electronAPI.log.info('Action menu:', action);

    switch (action) {
        case 'new-client':
            openQuickAddModal('client');
            break;
        case 'new-conteneur':
            openQuickAddModal('conteneur');
            break;
        case 'open-scanner':
            loadPage('scanner');
            break;
        case 'open-settings':
            loadPage('parametres');
            break;
        case 'show-shortcuts':
            showKeyboardShortcuts();
            break;
        case 'check-updates':
            checkForUpdates();
            break;
        default:
            window.electronAPI.log.warn('Action menu non gérée:', action);
    }
}
function openQuickAddModal(type) {
    // TODO: Implémenter les modals d'ajout rapide
    window.electronAPI.log.info(`Ouverture modal ajout rapide: ${type}`);
    showNotification('En développement', `L'ajout rapide de ${type} sera bientôt disponible`, 'info');
}
// =============================================
// UTILITAIRES UI
// =============================================
// ✅ CORRECTION : Utiliser window.Helpers pour être cohérent
function showLoader(message = 'Chargement...') {
    if (window.Helpers && window.Helpers.showLoader) {
        window.Helpers.showLoader(message);
    } else {
        // Fallback si Helpers n'est pas encore chargé
        document.getElementById('loading-message').textContent = message;
        $('#loadingModal').modal('show');
    }
}

function hideLoader() {
    if (window.Helpers && window.Helpers.hideLoader) {
        window.Helpers.hideLoader();
    } else {
        // Fallback si Helpers n'est pas encore chargé
        $('#loadingModal').modal('hide');
    }
    
    // S'assurer aussi de cacher le loader initial
    const appLoader = document.getElementById('app-loader');
    if (appLoader) {
        appLoader.style.display = 'none';
    }
}
function showContentLoader() {
    const contentArea = document.getElementById('content-area');
    contentArea.innerHTML = `
        <div class="loading-content text-center py-5">
            <div class="spinner-border text-primary" role="status">
                <span class="visually-hidden">Chargement...</span>
            </div>
            <p class="mt-3">Chargement du contenu...</p>
        </div>
    `;
}
function hideContentLoader() {
    // Le contenu est remplacé par loadPage
}
function showError(title, message) {
    Swal.fire({
        icon: 'error',
        title: title,
        text: message,
        confirmButtonText: 'OK',
        confirmButtonColor: '#ef4444'
    });
}
function handleAPIError(error) {
    if (error.response) {
        // Erreur de réponse du serveur
        const status = error.response.status;
        const message = error.response.data?.error || error.message;

        if (status === 401) {
            // Non authentifié
            showError('Session expirée', 'Veuillez vous reconnecter');
            // TODO: Rediriger vers login
        } else if (status === 403) {
            // Non autorisé
            showError('Accès refusé', 'Vous n\'avez pas les permissions nécessaires');
        } else if (status === 404) {
            // Non trouvé
            showError('Introuvable', 'La ressource demandée n\'existe pas');
        } else if (status >= 500) {
            // Erreur serveur
            showError('Erreur serveur', 'Une erreur est survenue sur le serveur');
        } else {
            showError('Erreur', message);
        }
    } else if (error.request) {
        // Pas de réponse du serveur
        showError('Erreur de connexion', 'Impossible de contacter le serveur');
        updateConnectionStatus(false);
    } else {
        // Autre erreur
        showError('Erreur', error.message);
    }
}
function confirmLogout() {
    Swal.fire({
        title: 'Déconnexion',
        text: 'Êtes-vous sûr de vouloir vous déconnecter ?',
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Oui, me déconnecter',
        cancelButtonText: 'Annuler',
        confirmButtonColor: '#ef4444'
    }).then((result) => {
        if (result.isConfirmed) {
            logout();
        }
    });
}
function logout() {
    // TODO: Implémenter la déconnexion
    window.electronAPI.log.info('Déconnexion utilisateur');
    localStorage.clear();
    window.location.reload();
}
function showHelp() {
    // TODO: Afficher l'aide
    window.electronAPI.log.info('Affichage aide');
}
function showKeyboardShortcuts() {
    // TODO: Afficher les raccourcis clavier
    window.electronAPI.log.info('Affichage raccourcis clavier');
}
function checkForUpdates() {
    // TODO: Vérifier les mises à jour
    window.electronAPI.log.info('Vérification des mises à jour');
    showNotification('Mises à jour', 'Votre application est à jour', 'success');
}
function closeAllModals() {
    $('.modal').modal('hide');
}
// =============================================
// INITIALISATION AU CHARGEMENT
// =============================================
// Masquer le loader initial après chargement complet
window.addEventListener('load', () => {
    setTimeout(() => {
        const appLoader = document.getElementById('app-loader');
        if (appLoader) {
            appLoader.classList.add('hide');
            setTimeout(() => appLoader.remove(), 500);
        }
    }, 500);
});
