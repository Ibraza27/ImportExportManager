/**
 * Module de gestion du scanner de codes-barres
 * Gère la lecture des codes-barres et QR codes pour l'identification rapide
 */

// Variables du module
let scannerActive = false;
let currentScanner = null;
let scanHistory = [];
let scanSound = null;
let continuousMode = false;

// =============================================
// INITIALISATION DU MODULE
// =============================================

export async function init() {
    window.electronAPI.log.info('Initialisation du module Scanner');
    
    try {
        // Initialiser l'interface
        initializeUI();
        
        // Initialiser Quagga (bibliothèque de scan)
        await initializeQuagga();
        
        // Initialiser les gestionnaires d'événements
        initializeEventHandlers();
        
        // Charger l'historique des scans récents
        await loadScanHistory();
        
        // Initialiser le son de scan
        initializeScanSound();
        
    } catch (error) {
        window.electronAPI.log.error('Erreur initialisation module scanner:', error);
        Helpers.showError('Erreur', 'Impossible d\'initialiser le scanner');
    }
}

// =============================================
// INTERFACE UTILISATEUR
// =============================================

function initializeUI() {
    const content = `
        <div class="container-fluid">
            <!-- En-tête -->
            <div class="row mb-4">
                <div class="col-12">
                    <div class="d-flex justify-content-between align-items-center">
                        <h4 class="mb-0">Scanner de Codes-barres</h4>
                        <div>
                            <button class="btn btn-primary" id="btn-start-scanner">
                                <i class="fas fa-barcode"></i> Démarrer le Scanner
                            </button>
                            <button class="btn btn-success ms-2" id="btn-manual-input">
                                <i class="fas fa-keyboard"></i> Saisie Manuelle
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Zone de scan -->
            <div class="row">
                <!-- Scanner vidéo -->
                <div class="col-lg-7">
                    <div class="card">
                        <div class="card-header">
                            <h5 class="mb-0">Zone de Scan</h5>
                        </div>
                        <div class="card-body">
                            <div id="scanner-viewport" class="scanner-viewport">
                                <div class="scanner-overlay">
                                    <div class="scanner-frame"></div>
                                    <p class="scanner-instructions">
                                        Placez le code-barres dans le cadre
                                    </p>
                                </div>
                                <video id="scanner-video" style="width: 100%; height: 400px;"></video>
                            </div>
                            
                            <!-- Contrôles scanner -->
                            <div class="mt-3 d-none" id="scanner-controls">
                                <div class="row align-items-center">
                                    <div class="col-md-6">
                                        <div class="form-check form-switch">
                                            <input class="form-check-input" type="checkbox" id="continuous-mode">
                                            <label class="form-check-label" for="continuous-mode">
                                                Mode continu
                                            </label>
                                        </div>
                                    </div>
                                    <div class="col-md-6 text-end">
                                        <button class="btn btn-danger" id="btn-stop-scanner">
                                            <i class="fas fa-stop"></i> Arrêter
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Résultat du scan -->
                <div class="col-lg-5">
                    <div class="card">
                        <div class="card-header">
                            <h5 class="mb-0">Résultat du Scan</h5>
                        </div>
                        <div class="card-body">
                            <div id="scan-result" class="text-center p-4">
                                <i class="fas fa-qrcode fa-3x text-muted mb-3"></i>
                                <p class="text-muted">Aucun code scanné</p>
                            </div>
                            
                            <!-- Détails après scan -->
                            <div id="scan-details" class="d-none">
                                <div class="mb-3">
                                    <label class="form-label">Code scanné</label>
                                    <div class="input-group">
                                        <input type="text" class="form-control" id="scanned-code" readonly>
                                        <button class="btn btn-outline-secondary" id="btn-copy-code">
                                            <i class="fas fa-copy"></i>
                                        </button>
                                    </div>
                                </div>
                                
                                <div class="mb-3">
                                    <label class="form-label">Type</label>
                                    <input type="text" class="form-control" id="scan-type" readonly>
                                </div>
                                
                                <div class="mb-3">
                                    <label class="form-label">Entité associée</label>
                                    <div id="scan-entity-info" class="alert alert-info">
                                        <i class="fas fa-spinner fa-spin"></i> Recherche en cours...
                                    </div>
                                </div>
                                
                                <!-- Actions rapides -->
                                <div class="d-grid gap-2">
                                    <button class="btn btn-primary" id="btn-open-entity">
                                        <i class="fas fa-external-link-alt"></i> Ouvrir la fiche
                                    </button>
                                    <button class="btn btn-success" id="btn-scan-another">
                                        <i class="fas fa-redo"></i> Scanner un autre code
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Historique des scans -->
            <div class="row mt-4">
                <div class="col-12">
                    <div class="card">
                        <div class="card-header d-flex justify-content-between align-items-center">
                            <h5 class="mb-0">Historique des Scans</h5>
                            <button class="btn btn-sm btn-outline-secondary" id="btn-clear-history">
                                <i class="fas fa-trash"></i> Effacer
                            </button>
                        </div>
                        <div class="card-body">
                            <div class="table-responsive">
                                <table class="table table-hover" id="scan-history-table">
                                    <thead>
                                        <tr>
                                            <th>Date/Heure</th>
                                            <th>Code</th>
                                            <th>Type</th>
                                            <th>Entité</th>
                                            <th>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody></tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    document.getElementById('main-content').innerHTML = content;
}

// =============================================
// INITIALISATION QUAGGA
// =============================================

async function initializeQuagga() {
    // Configuration de Quagga pour différents types de codes-barres
    window.scannerConfig = {
        inputStream: {
            name: "Live",
            type: "LiveStream",
            target: document.querySelector('#scanner-video'),
            constraints: {
                width: 1280,
                height: 720,
                facingMode: "environment"
            }
        },
        locator: {
            patchSize: "medium",
            halfSample: true
        },
        numOfWorkers: navigator.hardwareConcurrency || 4,
        decoder: {
            readers: [
                "code_128_reader",
                "ean_reader",
                "ean_8_reader",
                "code_39_reader",
                "code_39_vin_reader",
                "codabar_reader",
                "upc_reader",
                "upc_e_reader",
                "qr_reader"
            ]
        },
        locate: true
    };
}

// =============================================
// GESTION DU SCANNER
// =============================================

async function startScanner() {
    try {
        scannerActive = true;
        
        // Afficher les contrôles
        document.getElementById('scanner-controls').classList.remove('d-none');
        document.getElementById('btn-start-scanner').disabled = true;
        
        // Initialiser Quagga
        await new Promise((resolve, reject) => {
            Quagga.init(window.scannerConfig, (err) => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
        
        // Démarrer le scanner
        Quagga.start();
        
        // Écouter les détections
        Quagga.onDetected(handleScanDetected);
        
        window.electronAPI.log.info('Scanner démarré');
        
    } catch (error) {
        window.electronAPI.log.error('Erreur démarrage scanner:', error);
        Helpers.showError('Erreur', 'Impossible de démarrer le scanner');
        stopScanner();
    }
}

function stopScanner() {
    if (scannerActive) {
        Quagga.stop();
        scannerActive = false;
        
        // Masquer les contrôles
        document.getElementById('scanner-controls').classList.add('d-none');
        document.getElementById('btn-start-scanner').disabled = false;
        
        window.electronAPI.log.info('Scanner arrêté');
    }
}

// =============================================
// GESTION DES SCANS
// =============================================

async function handleScanDetected(result) {
    if (!scannerActive) return;
    
    const code = result.codeResult.code;
    const format = result.codeResult.format;
    
    // Jouer le son
    playBeep();
    
    // Ajouter à l'historique
    const scanData = {
        code,
        format,
        timestamp: new Date(),
        id: Date.now()
    };
    
    scanHistory.unshift(scanData);
    if (scanHistory.length > 50) {
        scanHistory = scanHistory.slice(0, 50);
    }
    
    // Afficher le résultat
    await displayScanResult(scanData);
    
    // Mode continu ?
    if (!continuousMode) {
        stopScanner();
    }
    
    window.electronAPI.log.info('Code scanné:', code);
}

async function displayScanResult(scanData) {
    // Masquer le placeholder
    document.getElementById('scan-result').classList.add('d-none');
    document.getElementById('scan-details').classList.remove('d-none');
    
    // Afficher les informations
    document.getElementById('scanned-code').value = scanData.code;
    document.getElementById('scan-type').value = scanData.format.toUpperCase();
    
    // Rechercher l'entité associée
    const entityInfo = document.getElementById('scan-entity-info');
    entityInfo.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Recherche en cours...';
    
    try {
        const entity = await searchEntityByCode(scanData.code);
        
        if (entity) {
            entityInfo.classList.remove('alert-info', 'alert-warning');
            entityInfo.classList.add('alert-success');
            entityInfo.innerHTML = formatEntityInfo(entity);
            
            // Activer le bouton d'ouverture
            const btnOpen = document.getElementById('btn-open-entity');
            btnOpen.disabled = false;
            btnOpen.onclick = () => openEntity(entity);
            
        } else {
            entityInfo.classList.remove('alert-info', 'alert-success');
            entityInfo.classList.add('alert-warning');
            entityInfo.innerHTML = `
                <i class="fas fa-exclamation-triangle"></i> 
                Aucune entité trouvée pour ce code
            `;
            
            document.getElementById('btn-open-entity').disabled = true;
        }
        
    } catch (error) {
        window.electronAPI.log.error('Erreur recherche entité:', error);
        entityInfo.classList.remove('alert-info', 'alert-success');
        entityInfo.classList.add('alert-danger');
        entityInfo.innerHTML = `
            <i class="fas fa-times-circle"></i> 
            Erreur lors de la recherche
        `;
    }
    
    // Mettre à jour l'historique
    updateHistoryTable();
}

// =============================================
// RECHERCHE D'ENTITÉ
// =============================================

async function searchEntityByCode(code) {
    try {
        // Rechercher dans différentes tables selon le format du code
        
        // Code client (format: CL-XXXXXX)
        if (code.startsWith('CL-')) {
            const response = await API.clients.getByCode(code);
            if (response) {
                return { type: 'client', data: response };
            }
        }
        
        // Code marchandise (format: MA-XXXXXX)
        if (code.startsWith('MA-')) {
            const response = await API.marchandises.scanBarcode(code);
            if (response) {
                return { type: 'marchandise', data: response };
            }
        }
        
        // Code conteneur (format: DO-XXXX-XXX)
        if (code.startsWith('DO-')) {
            const response = await API.conteneurs.getByDossier(code);
            if (response) {
                return { type: 'conteneur', data: response };
            }
        }
        
        // Recherche générale si format inconnu
        const searchResponse = await API.search({ code });
        if (searchResponse && searchResponse.length > 0) {
            return searchResponse[0];
        }
        
        return null;
        
    } catch (error) {
        window.electronAPI.log.error('Erreur recherche par code:', error);
        throw error;
    }
}

// =============================================
// FORMATAGE DES ENTITÉS
// =============================================

function formatEntityInfo(entity) {
    switch (entity.type) {
        case 'client':
            return `
                <div class="d-flex align-items-center">
                    <i class="fas fa-user fa-2x me-3 text-primary"></i>
                    <div>
                        <strong>Client</strong><br>
                        ${entity.data.nom} ${entity.data.prenom}<br>
                        <small class="text-muted">${entity.data.telephone_principal}</small>
                    </div>
                </div>
            `;
            
        case 'marchandise':
            return `
                <div class="d-flex align-items-center">
                    <i class="fas fa-box fa-2x me-3 text-warning"></i>
                    <div>
                        <strong>Marchandise</strong><br>
                        ${entity.data.designation}<br>
                        <small class="text-muted">
                            Client: ${entity.data.client_nom || 'Non défini'}
                        </small>
                    </div>
                </div>
            `;
            
        case 'conteneur':
            return `
                <div class="d-flex align-items-center">
                    <i class="fas fa-cube fa-2x me-3 text-success"></i>
                    <div>
                        <strong>Conteneur</strong><br>
                        ${entity.data.numero_conteneur}<br>
                        <small class="text-muted">
                            Destination: ${entity.data.destination_ville}
                        </small>
                    </div>
                </div>
            `;
            
        default:
            return `
                <div class="d-flex align-items-center">
                    <i class="fas fa-question-circle fa-2x me-3"></i>
                    <div>
                        <strong>Entité inconnue</strong><br>
                        Type: ${entity.type}
                    </div>
                </div>
            `;
    }
}

// =============================================
// ACTIONS SUR ENTITÉS
// =============================================

function openEntity(entity) {
    switch (entity.type) {
        case 'client':
            window.location.hash = `#clients?id=${entity.data.id}`;
            break;
            
        case 'marchandise':
            window.location.hash = `#marchandises?id=${entity.data.id}`;
            break;
            
        case 'conteneur':
            window.location.hash = `#conteneurs?id=${entity.data.id}`;
            break;
            
        default:
            Helpers.showError('Erreur', 'Type d\'entité non géré');
    }
}

// =============================================
// HISTORIQUE DES SCANS
// =============================================

async function loadScanHistory() {
    try {
        // Charger depuis le localStorage pour cette session
        const stored = localStorage.getItem('scan_history');
        if (stored) {
            scanHistory = JSON.parse(stored);
            updateHistoryTable();
        }
    } catch (error) {
        window.electronAPI.log.error('Erreur chargement historique:', error);
    }
}

function updateHistoryTable() {
    const tbody = document.querySelector('#scan-history-table tbody');
    tbody.innerHTML = '';
    
    if (scanHistory.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="text-center text-muted py-4">
                    Aucun scan dans l'historique
                </td>
            </tr>
        `;
        return;
    }
    
    scanHistory.forEach(scan => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${new Date(scan.timestamp).toLocaleString('fr-FR')}</td>
            <td><code>${scan.code}</code></td>
            <td><span class="badge bg-secondary">${scan.format}</span></td>
            <td>${scan.entity ? formatEntityBadge(scan.entity) : '-'}</td>
            <td>
                <button class="btn btn-sm btn-outline-primary" onclick="rescanCode('${scan.code}')">
                    <i class="fas fa-redo"></i>
                </button>
            </td>
        `;
        tbody.appendChild(row);
    });
    
    // Sauvegarder l'historique
    localStorage.setItem('scan_history', JSON.stringify(scanHistory));
}

function formatEntityBadge(entity) {
    const colors = {
        client: 'primary',
        marchandise: 'warning',
        conteneur: 'success'
    };
    
    return `<span class="badge bg-${colors[entity.type] || 'secondary'}">${entity.type}</span>`;
}

// =============================================
// SAISIE MANUELLE
// =============================================

async function showManualInput() {
    const { value: code } = await Swal.fire({
        title: 'Saisie manuelle du code',
        input: 'text',
        inputLabel: 'Entrez le code-barres ou QR code',
        inputPlaceholder: 'Ex: CL-123456, MA-789012, DO-2024-001',
        showCancelButton: true,
        confirmButtonText: 'Valider',
        cancelButtonText: 'Annuler',
        inputValidator: (value) => {
            if (!value) {
                return 'Veuillez entrer un code';
            }
        }
    });
    
    if (code) {
        // Simuler un scan
        const scanData = {
            code,
            format: 'MANUAL',
            timestamp: new Date(),
            id: Date.now()
        };
        
        scanHistory.unshift(scanData);
        await displayScanResult(scanData);
    }
}

// =============================================
// UTILITAIRES
// =============================================

function initializeScanSound() {
    // Créer un son de beep pour les scans
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    
    window.playBeep = () => {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.value = 1000;
        oscillator.type = 'sine';
        
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
        
        oscillator.start(audioContext.currentTime);
        oscillator.stop(audioContext.currentTime + 0.1);
    };
}

window.rescanCode = async (code) => {
    const scanData = {
        code,
        format: 'RESCAN',
        timestamp: new Date(),
        id: Date.now()
    };
    
    await displayScanResult(scanData);
};

// =============================================
// GESTIONNAIRES D'ÉVÉNEMENTS
// =============================================

function initializeEventHandlers() {
    // Bouton démarrer scanner
    document.getElementById('btn-start-scanner').addEventListener('click', startScanner);
    
    // Bouton arrêter scanner
    document.getElementById('btn-stop-scanner').addEventListener('click', stopScanner);
    
    // Saisie manuelle
    document.getElementById('btn-manual-input').addEventListener('click', showManualInput);
    
    // Mode continu
    document.getElementById('continuous-mode').addEventListener('change', (e) => {
        continuousMode = e.target.checked;
    });
    
    // Copier le code
    document.getElementById('btn-copy-code').addEventListener('click', () => {
        const code = document.getElementById('scanned-code').value;
        navigator.clipboard.writeText(code);
        Helpers.showSuccess('Copié', 'Code copié dans le presse-papiers');
    });
    
    // Scanner un autre code
    document.getElementById('btn-scan-another').addEventListener('click', () => {
        document.getElementById('scan-result').classList.remove('d-none');
        document.getElementById('scan-details').classList.add('d-none');
        if (!scannerActive) {
            startScanner();
        }
    });
    
    // Effacer l'historique
    document.getElementById('btn-clear-history').addEventListener('click', async () => {
        const result = await Helpers.confirmAction(
            'Effacer l\'historique ?',
            'Cette action est irréversible'
        );
        
        if (result.isConfirmed) {
            scanHistory = [];
            updateHistoryTable();
            localStorage.removeItem('scan_history');
            Helpers.showSuccess('Succès', 'Historique effacé');
        }
    });
}

// =============================================
// GESTION TEMPS RÉEL
// =============================================

export function handleRealtimeUpdate(type, data) {
    // Pas de mise à jour temps réel nécessaire pour le scanner
    window.electronAPI.log.debug('Update reçue dans scanner:', type, data);
}

// =============================================
// NETTOYAGE
// =============================================

export function cleanup() {
    // Arrêter le scanner si actif
    if (scannerActive) {
        stopScanner();
    }
    
    window.electronAPI.log.info('Module Scanner nettoyé');
}