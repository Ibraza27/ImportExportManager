/**
 * Helpers - Fonctions utilitaires globales
 * Centralise toutes les fonctions d'aide utilisées dans l'application
 */

// Mock electronAPI si non disponible
if (typeof electronAPI === 'undefined') {
    window.electronAPI = {
        log: {
            info: console.log,
            warn: console.warn,
            error: console.error,
            debug: console.debug
        }
    };
}

window.Helpers = (function() {
    // =============================================
    // GESTION DU LOADER
    // =============================================

    /**
     * Afficher un loader
     */
    function showLoader(message = 'Chargement...') {
        document.getElementById('loading-message').textContent = message;
        $('#loadingModal').modal('show');
    }

    /**
     * Masquer le loader
     */
    function hideLoader() {
        $('#loadingModal').modal('hide');
    }

    // =============================================
    // NOTIFICATIONS ET MESSAGES
    // =============================================

    /**
     * Afficher un toast
     */
    function showToast(message, type = 'info', duration = 3000) {
        const Toast = Swal.mixin({
            toast: true,
            position: 'top-end',
            showConfirmButton: false,
            timer: duration,
            timerProgressBar: true,
            didOpen: (toast) => {
                toast.addEventListener('mouseenter', Swal.stopTimer);
                toast.addEventListener('mouseleave', Swal.resumeTimer);
            }
        });

        Toast.fire({
            icon: type,
            title: message
        });
    }

    /**
     * Afficher un message de succès
     */
    function showSuccess(title, message) {
        Swal.fire({
            icon: 'success',
            title: title,
            text: message,
            confirmButtonText: 'OK',
            confirmButtonColor: '#22c55e'
        });
    }

    /**
     * Afficher un message d'erreur
     */
    function showError(title, message) {
        Swal.fire({
            icon: 'error',
            title: title,
            text: message,
            confirmButtonText: 'OK',
            confirmButtonColor: '#ef4444'
        });
    }

    /**
     * Afficher un message d'avertissement
     */
    function showWarning(title, message) {
        Swal.fire({
            icon: 'warning',
            title: title,
            text: message,
            confirmButtonText: 'OK',
            confirmButtonColor: '#f59e0b'
        });
    }

    /**
     * Demander une confirmation
     */
    async function confirm(title, message, confirmText = 'Confirmer', cancelText = 'Annuler') {
        const result = await Swal.fire({
            icon: 'question',
            title: title,
            text: message,
            showCancelButton: true,
            confirmButtonText: confirmText,
            cancelButtonText: cancelText,
            confirmButtonColor: '#3b82f6',
            cancelButtonColor: '#6b7280'
        });

        return result.isConfirmed;
    }

    // =============================================
    // FORMATAGE DES DONNÉES
    // =============================================

    /**
     * Formater un montant en devise
     */
    function formatCurrency(amount, currency = 'EUR') {
        return new Intl.NumberFormat('fr-FR', {
            style: 'currency',
            currency: currency
        }).format(amount);
    }

    /**
     * Formater une date
     */
    function formatDate(date, format = 'short') {
        if (!date) return '-';

        const dateObj = date instanceof Date ? date : new Date(date);

        switch (format) {
            case 'short':
                return dateObj.toLocaleDateString('fr-FR');
            case 'long':
                return dateObj.toLocaleDateString('fr-FR', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                });
            case 'datetime':
                return dateObj.toLocaleString('fr-FR');
            case 'time':
                return dateObj.toLocaleTimeString('fr-FR', {
                    hour: '2-digit',
                    minute: '2-digit'
                });
            case 'iso':
                return dateObj.toISOString();
            case 'relative':
                return getRelativeTime(dateObj);
            default:
                return dateObj.toLocaleDateString('fr-FR');
        }
    }

    /**
     * Obtenir un temps relatif (il y a X temps)
     */
    function getRelativeTime(date) {
        const now = new Date();
        const diffInMs = now - date;
        const diffInSec = Math.floor(diffInMs / 1000);
        const diffInMin = Math.floor(diffInSec / 60);
        const diffInHour = Math.floor(diffInMin / 60);
        const diffInDay = Math.floor(diffInHour / 24);
        const diffInWeek = Math.floor(diffInDay / 7);
        const diffInMonth = Math.floor(diffInDay / 30);
        const diffInYear = Math.floor(diffInDay / 365);

        if (diffInSec < 60) return 'À l\'instant';
        if (diffInMin < 60) return `Il y a ${diffInMin} minute${diffInMin > 1 ? 's' : ''}`;
        if (diffInHour < 24) return `Il y a ${diffInHour} heure${diffInHour > 1 ? 's' : ''}`;
        if (diffInDay < 7) return `Il y a ${diffInDay} jour${diffInDay > 1 ? 's' : ''}`;
        if (diffInWeek < 4) return `Il y a ${diffInWeek} semaine${diffInWeek > 1 ? 's' : ''}`;
        if (diffInMonth < 12) return `Il y a ${diffInMonth} mois`;
        return `Il y a ${diffInYear} an${diffInYear > 1 ? 's' : ''}`;
    }

    /**
     * Formater un numéro de téléphone
     */
    function formatPhone(phone) {
        if (!phone) return '-';

        // Supprimer tous les caractères non numériques
        const cleaned = phone.replace(/\D/g, '');

        // Format international (exemple pour le Congo avec indicatif +242)
        if (cleaned.length === 9) {
            return `+242 ${cleaned.substring(0, 1)} ${cleaned.substring(1, 4)} ${cleaned.substring(4, 7)} ${cleaned.substring(7)}`;
        }

        // Format français
        if (cleaned.length === 10 && cleaned.startsWith('0')) {
            return cleaned.replace(/(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/, '$1 $2 $3 $4 $5');
        }

        // Format international générique
        if (cleaned.length > 10) {
            return `+${cleaned.substring(0, 2)} ${cleaned.substring(2).match(/.{1,2}/g).join(' ')}`;
        }

        return phone;
    }

    /**
     * Formater un poids
     */
    function formatWeight(weight, unit = 'kg') {
        if (!weight) return '0 ' + unit;

        if (unit === 'kg' && weight >= 1000) {
            return `${(weight / 1000).toFixed(2)} tonnes`;
        }

        return `${parseFloat(weight).toFixed(2)} ${unit}`;
    }

    /**
     * Formater un volume
     */
    function formatVolume(volume, unit = 'm³') {
        if (!volume) return '0 ' + unit;
        return `${parseFloat(volume).toFixed(2)} ${unit}`;
    }

    /**
     * Formater un pourcentage
     */
    function formatPercentage(value, decimals = 0) {
        return `${parseFloat(value).toFixed(decimals)}%`;
    }

    /**
     * Formater la taille d'un fichier
     */
    function formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';

        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));

        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    // =============================================
    // VALIDATION
    // =============================================

    /**
     * Valider une adresse email
     */
    function isValidEmail(email) {
        const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return regex.test(email);
    }

    /**
     * Valider un numéro de téléphone
     */
    function isValidPhone(phone) {
        const cleaned = phone.replace(/\D/g, '');
        // Accepte les numéros de 9 à 15 chiffres (pour couvrir différents formats internationaux)
        return cleaned.length >= 9 && cleaned.length <= 15;
    }

    /**
     * Valider un champ obligatoire
     */
    function validateRequired(value) {
        return value && value.toString().trim() !== '';
    }

    /**
     * Valider un code-barres
     */
    function isValidBarcode(code) {
        // Code-barres EAN-13
        if (code.length === 13 && /^\d+$/.test(code)) {
            return validateEAN13(code);
        }
        // Autres formats acceptés
        return code.length >= 8;
    }

    /**
     * Valider un code EAN-13
     */
    function validateEAN13(code) {
        let sum = 0;
        for (let i = 0; i < 12; i++) {
            sum += parseInt(code[i]) * (i % 2 === 0 ? 1 : 3);
        }
        const checkDigit = (10 - (sum % 10)) % 10;
        return checkDigit === parseInt(code[12]);
    }

    // =============================================
    // GÉNÉRATION DE CODES
    // =============================================

    /**
     * Générer un code client
     */
    function generateClientCode(prefix = 'CLI') {
        const timestamp = Date.now().toString(36).toUpperCase();
        const random = Math.random().toString(36).substring(2, 5).toUpperCase();
        return `${prefix}${timestamp}${random}`;
    }

    /**
     * Générer un code-barres interne
     */
    function generateBarcode(prefix = 'CB') {
        const date = new Date();
        const year = date.getFullYear().toString().substring(2);
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const day = date.getDate().toString().padStart(2, '0');
        const random = Math.floor(Math.random() * 100000).toString().padStart(5, '0');
        return `${prefix}${year}${month}${day}${random}`;
    }

    /**
     * Générer un numéro de reçu
     */
    function generateReceiptNumber(prefix = 'REC') {
        const date = new Date();
        const year = date.getFullYear();
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const count = Storage.getUserData('receipt_counter') || 0;
        const newCount = count + 1;
        Storage.setUserData('receipt_counter', newCount);
        return `${prefix}-${year}${month}-${newCount.toString().padStart(4, '0')}`;
    }

    // =============================================
    // MANIPULATION DE DONNÉES
    // =============================================

    /**
     * Grouper un tableau par propriété
     */
    function groupBy(array, key) {
        return array.reduce((result, item) => {
            const group = item[key];
            if (!result[group]) result[group] = [];
            result[group].push(item);
            return result;
        }, {});
    }

    /**
     * Trier un tableau d'objets
     */
    function sortBy(array, key, order = 'asc') {
        return [...array].sort((a, b) => {
            if (a[key] < b[key]) return order === 'asc' ? -1 : 1;
            if (a[key] > b[key]) return order === 'asc' ? 1 : -1;
            return 0;
        });
    }

    /**
     * Filtrer un tableau avec recherche floue
     */
    function fuzzySearch(array, query, keys) {
        const lowercaseQuery = query.toLowerCase();
        return array.filter(item => {
            return keys.some(key => {
                const value = item[key];
                if (value && typeof value === 'string') {
                    return value.toLowerCase().includes(lowercaseQuery);
                }
                return false;
            });
        });
    }

    /**
     * Paginer un tableau
     */
    function paginate(array, page = 1, perPage = 25) {
        const start = (page - 1) * perPage;
        const end = start + perPage;

        return {
            data: array.slice(start, end),
            total: array.length,
            page: page,
            perPage: perPage,
            totalPages: Math.ceil(array.length / perPage),
            hasNext: end < array.length,
            hasPrev: page > 1
        };
    }

    // =============================================
    // UTILITAIRES UI
    // =============================================

    /**
     * Initialiser un select2
     */
    function initSelect2(selector, options = {}) {
        const defaultOptions = {
            theme: 'bootstrap-5',
            width: '100%',
            language: 'fr',
            placeholder: 'Sélectionnez...',
            allowClear: true,
            ...options
        };

        return $(selector).select2(defaultOptions);
    }

    /**
     * Initialiser un datepicker
     */
    function initDatePicker(selector, options = {}) {
        const defaultOptions = {
            locale: 'fr',
            dateFormat: 'd/m/Y',
            allowInput: true,
            ...options
        };

        return flatpickr(selector, defaultOptions);
    }

    /**
     * Initialiser un DataTable
     */
    function initDataTable(selector, options = {}) {
        const defaultOptions = {
            language: {
                url: '//cdn.datatables.net/plug-ins/1.13.7/i18n/fr-FR.json'
            },
            responsive: true,
            pageLength: 25,
            dom: 'Bfrtip',
            buttons: ['copy', 'excel', 'pdf', 'print'],
            ...options
        };

        return $(selector).DataTable(defaultOptions);
    }

    // =============================================
    // CALCULS MÉTIER
    // =============================================

    /**
     * Calculer le taux de remplissage
     */
    function calculateFillingRate(used, total) {
        if (!total || total === 0) return 0;
        return Math.min((used / total) * 100, 100);
    }

    /**
     * Calculer le total avec TVA
     */
    function calculateWithTax(amount, taxRate = 20) {
        const tax = amount * (taxRate / 100);
        return {
            ht: amount,
            tax: tax,
            ttc: amount + tax
        };
    }

    /**
     * Calculer les frais de port
     */
    function calculateShippingCost(weight, volume, destination) {
        // Logique simplifiée - à adapter selon vos tarifs
        const baseRate = 50; // Tarif de base
        const weightRate = 2; // Par kg
        const volumeRate = 100; // Par m³

        let cost = baseRate;
        cost += weight * weightRate;
        cost += volume * volumeRate;

        // Majoration selon destination
        if (destination && destination.toLowerCase().includes('international')) {
            cost *= 1.5;
        }

        return cost;
    }

    // =============================================
    // UTILITAIRES DIVERS
    // =============================================

    /**
     * Debounce une fonction
     */
    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    /**
     * Throttle une fonction
     */
    function throttle(func, limit) {
        let inThrottle;
        return function(...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }

    /**
     * Copier dans le presse-papier
     */
    async function copyToClipboard(text) {
        try {
            await navigator.clipboard.writeText(text);
            showToast('Copié dans le presse-papier', 'success');
            return true;
        } catch (error) {
            electronAPI.log.error('Erreur copie presse-papier:', error);
            return false;
        }
    }

    /**
     * Télécharger un fichier
     */
    function downloadFile(content, filename, type = 'text/plain') {
        const blob = new Blob([content], { type });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
    }

    /**
     * Générer un CSV
     */
    function generateCSV(data, headers) {
        const csvHeaders = headers.join(';');
        const csvRows = data.map(row =>
            headers.map(header => `"${row[header] || ''}"`).join(';')
        );

        return [csvHeaders, ...csvRows].join('\n');
    }

    /**
     * Parser un CSV
     */
    function parseCSV(csv, delimiter = ';') {
        const lines = csv.split('\n');
        const headers = lines[0].split(delimiter).map(h => h.trim().replace(/"/g, ''));

        return lines.slice(1).map(line => {
            const values = line.split(delimiter).map(v => v.trim().replace(/"/g, ''));
            return headers.reduce((obj, header, index) => {
                obj[header] = values[index];
                return obj;
            }, {});
        });
    }

    // Alias pour compatibilité descendante
    function formatRelativeDate(date) {
        return getRelativeTime(new Date(date));
    }

    // =============================================
    // EXPORT PUBLIC API
    // =============================================

    return {
        // Loader
        showLoader,
        hideLoader,

        // Notifications
        showToast,
        showSuccess,
        showError,
        showWarning,
        confirm,

        // Formatage
        formatCurrency,
        formatDate,
        formatRelativeDate,
        formatPhone,
        formatWeight,
        formatVolume,
        formatPercentage,
        formatFileSize,

        // Validation
        validateEmail: isValidEmail,
        validatePhone: isValidPhone,
        validateRequired,
        isValidBarcode,

        // Génération
        generateClientCode,
        generateBarcode,
        generateReceiptNumber,

        // Manipulation de données
        groupBy,
        sortBy,
        fuzzySearch,
        paginate,

        // Interface utilisateur
        initSelect2,
        initDatePicker,
        initDataTable,

        // Calculs métier
        calculateFillingRate,
        calculateWithTax,
        calculateShippingCost,

        // Utilitaires
        debounce,
        throttle,
        copyToClipboard,
        downloadFile,
        generateCSV,
        parseCSV
    };
})();
