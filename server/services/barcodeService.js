/**
 * Service de génération de codes-barres
 * Génère et vérifie les codes-barres et QR codes
 */

const { v4: uuidv4 } = require('uuid');
const { db, query } = require('../database/connection'); // <-- MODIFIÉ
const { logger } = require('../../shared/logger');

class BarcodeService {
    /**
     * Générer un code-barres unique
     */
    async generateBarcode(type = 'marchandise') {
        const prefix = this.getPrefix(type);
        const timestamp = Date.now().toString(36).toUpperCase();
        const random = Math.random().toString(36).substring(2, 6).toUpperCase();
        
        let barcode = `${prefix}${timestamp}${random}`;
        
        // Vérifier l'unicité
        let attempts = 0;
        while (await this.exists(barcode) && attempts < 10) {
            const newRandom = Math.random().toString(36).substring(2, 6).toUpperCase();
            barcode = `${prefix}${timestamp}${newRandom}`;
            attempts++;
        }
        
        if (attempts >= 10) {
            throw new Error('Impossible de générer un code-barres unique');
        }
        
        return barcode;
    }
    
    /**
     * Générer un code client
     */
    async generateClientCode() {
        const prefix = 'CLI';
        const year = new Date().getFullYear().toString().slice(-2);
        
        // Obtenir le dernier numéro
        const lastClient = await query(
            `SELECT code_client FROM clients 
             WHERE code_client LIKE $1 
             ORDER BY id DESC LIMIT 1`,
            [`${prefix}${year}%`]
        );
        
        let number = 1;
        if (lastClient.rows.length > 0) {
            const lastCode = lastClient.rows[0].code_client;
            const lastNumber = parseInt(lastCode.slice(-4));
            number = lastNumber + 1;
        }
        
        return `${prefix}${year}${number.toString().padStart(4, '0')}`;
    }
    
    /**
     * Générer un numéro de dossier conteneur
     */
    async generateDossierNumber() {
        const prefix = 'DOSS';
        const year = new Date().getFullYear();
        const month = (new Date().getMonth() + 1).toString().padStart(2, '0');
        
        // Compter les dossiers du mois
        const count = await query(
            `SELECT COUNT(*) FROM conteneurs 
             WHERE EXTRACT(YEAR FROM created_at) = $1 
             AND EXTRACT(MONTH FROM created_at) = $2`,
            [year, parseInt(month)]
        );
        
        const number = (parseInt(count.rows[0].count) + 1).toString().padStart(3, '0');
        return `${prefix}${year}${month}${number}`;
    }
    
    /**
     * Générer un numéro de reçu
     */
    async generateReceiptNumber() {
        const prefix = 'REC';
        const date = new Date();
        const year = date.getFullYear().toString().slice(-2);
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const day = date.getDate().toString().padStart(2, '0');
        
        // Compter les reçus du jour
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const count = await query(
            `SELECT COUNT(*) FROM paiements 
             WHERE created_at >= $1`,
            [today]
        );
        
        const number = (parseInt(count.rows[0].count) + 1).toString().padStart(3, '0');
        return `${prefix}${year}${month}${day}${number}`;
    }
    
    /**
     * Obtenir le préfixe selon le type
     */
    getPrefix(type) {
        const prefixes = {
            marchandise: 'CB',
            conteneur: 'CNT',
            client: 'CLI',
            paiement: 'PAY'
        };
        
        return prefixes[type] || 'GEN';
    }
    
    /**
     * Vérifier si un code existe déjà
     */
    async exists(barcode) {
        const count = await db.count('marchandises', { code_barre: barcode });
        return count > 0;
    }
    
    /**
     * Valider le format d'un code-barres
     */
    validateFormat(barcode) {
        // Le code doit commencer par un préfixe valide
        const validPrefixes = ['CB', 'CNT', 'CLI', 'PAY', 'GEN'];
        const prefix = barcode.substring(0, 2);
        
        if (!validPrefixes.includes(prefix)) {
            return false;
        }
        
        // Le code doit avoir au moins 10 caractères
        if (barcode.length < 10) {
            return false;
        }
        
        // Le code ne doit contenir que des lettres majuscules et des chiffres
        return /^[A-Z0-9]+$/.test(barcode);
    }
}

module.exports = new BarcodeService();