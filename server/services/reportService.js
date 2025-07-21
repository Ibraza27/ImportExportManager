/**
 * Service de génération de rapports
 * Génère des rapports et statistiques
 */

const { db, query } = require('../database/connection');
const { logger } = require('../../shared/logger');
const ExcelJS = require('exceljs');
const path = require('path');
const fs = require('fs').promises;

class ReportService {
    constructor() {
        this.reportsDir = path.join(__dirname, '../../output/reports');
        this.ensureReportsDirectory();
    }
    
    /**
     * Créer le dossier des rapports s'il n'existe pas
     */
    async ensureReportsDirectory() {
        try {
            await fs.access(this.reportsDir);
        } catch {
            await fs.mkdir(this.reportsDir, { recursive: true });
        }
    }
    
    /**
     * Générer le rapport du tableau de bord
     */
    async generateDashboardReport(periode = 'month') {
        try {
            const endDate = new Date();
            let startDate = new Date();
            
            switch (periode) {
                case 'week':
                    startDate.setDate(startDate.getDate() - 7);
                    break;
                case 'month':
                    startDate.setMonth(startDate.getMonth() - 1);
                    break;
                case 'quarter':
                    startDate.setMonth(startDate.getMonth() - 3);
                    break;
                case 'year':
                    startDate.setFullYear(startDate.getFullYear() - 1);
                    break;
            }
            
            // Statistiques générales
            const stats = await query(`
                SELECT 
                    (SELECT COUNT(*) FROM clients WHERE statut = 'actif') as total_clients,
                    (SELECT COUNT(*) FROM marchandises WHERE created_at BETWEEN $1 AND $2) as nouvelles_marchandises,
                    (SELECT COUNT(*) FROM conteneurs WHERE created_at BETWEEN $1 AND $2) as nouveaux_conteneurs,
                    (SELECT COALESCE(SUM(montant_paye), 0) FROM paiements WHERE date_paiement BETWEEN $1 AND $2 AND statut = 'valide') as revenus_periode
            `, [startDate, endDate]);
            
            // Top clients
            const topClients = await query(`
                SELECT 
                    c.id,
                    c.nom,
                    c.prenom,
                    COUNT(DISTINCT m.id) as nombre_marchandises,
                    COALESCE(SUM(m.cout_total), 0) as chiffre_affaires
                FROM clients c
                JOIN marchandises m ON m.client_id = c.id
                WHERE m.created_at BETWEEN $1 AND $2
                GROUP BY c.id
                ORDER BY chiffre_affaires DESC
                LIMIT 10
            `, [startDate, endDate]);
            
            // Destinations populaires
            const destinations = await query(`
                SELECT 
                    destination_pays,
                    destination_ville,
                    COUNT(*) as nombre_conteneurs,
                    COUNT(DISTINCT m.client_id) as nombre_clients
                FROM conteneurs c
                JOIN marchandises m ON m.conteneur_id = c.id
                WHERE c.created_at BETWEEN $1 AND $2
                GROUP BY destination_pays, destination_ville
                ORDER BY nombre_conteneurs DESC
                LIMIT 10
            `, [startDate, endDate]);
            
            // Évolution mensuelle
            const evolution = await query(`
                SELECT 
                    TO_CHAR(date_paiement, 'YYYY-MM') as mois,
                    SUM(montant_paye) as revenus,
                    COUNT(DISTINCT client_id) as clients_actifs,
                    COUNT(*) as nombre_paiements
                FROM paiements
                WHERE statut = 'valide'
                AND date_paiement >= CURRENT_DATE - INTERVAL '12 months'
                GROUP BY mois
                ORDER BY mois
            `);
            
            return {
                periode: { startDate, endDate },
                stats: stats.rows[0],
                topClients: topClients.rows,
                destinations: destinations.rows,
                evolution: evolution.rows
            };
            
        } catch (error) {
            logger.error('Erreur génération rapport dashboard:', error);
            throw error;
        }
    }
    
    /**
     * Générer un rapport financier
     */
    async generateFinancialReport(startDate, endDate) {
        try {
            // Revenus par mode de paiement
            const revenuesByMode = await query(`
                SELECT 
                    mode_paiement,
                    COUNT(*) as nombre_paiements,
                    SUM(montant_paye) as total,
                    AVG(montant_paye) as moyenne
                FROM paiements
                WHERE statut = 'valide'
                AND date_paiement BETWEEN $1 AND $2
                GROUP BY mode_paiement
                ORDER BY total DESC
            `, [startDate, endDate]);
            
            // Impayés
            const unpaid = await query(`
                SELECT 
                    c.nom || ' ' || c.prenom as client,
                    COUNT(p.*) as nombre_factures,
                    SUM(p.montant_restant) as total_impaye,
                    MIN(p.date_echeance) as plus_ancienne_echeance
                FROM paiements p
                JOIN clients c ON p.client_id = c.id
                WHERE p.montant_restant > 0
                AND p.statut = 'valide'
                GROUP BY c.id, c.nom, c.prenom
                HAVING SUM(p.montant_restant) > 0
                ORDER BY total_impaye DESC
            `);
            
            // Évolution quotidienne
            const dailyRevenue = await query(`
                SELECT 
                    DATE(date_paiement) as jour,
                    COUNT(*) as nombre_paiements,
                    SUM(montant_paye) as total
                FROM paiements
                WHERE statut = 'valide'
                AND date_paiement BETWEEN $1 AND $2
                GROUP BY jour
                ORDER BY jour
            `, [startDate, endDate]);
            
            // Résumé
            const summary = await query(`
                SELECT 
                    COUNT(DISTINCT client_id) as clients_payants,
                    COUNT(*) as total_paiements,
                    SUM(montant_paye) as total_encaisse,
                    SUM(montant_total_du) as total_facture,
                    SUM(montant_restant) as total_restant,
                    AVG(montant_paye) as paiement_moyen
                FROM paiements
                WHERE statut = 'valide'
                AND date_paiement BETWEEN $1 AND $2
            `, [startDate, endDate]);
            
            return {
                periode: { startDate, endDate },
                summary: summary.rows[0],
                revenuesByMode: revenuesByMode.rows,
                unpaid: unpaid.rows,
                dailyRevenue: dailyRevenue.rows
            };
            
        } catch (error) {
            logger.error('Erreur génération rapport financier:', error);
            throw error;
        }
    }
    
    /**
     * Générer un rapport d'activité des conteneurs
     */
    async generateContainerReport(startDate, endDate) {
        try {
            // Conteneurs par statut
            const byStatus = await query(`
                SELECT 
                    statut,
                    COUNT(*) as nombre,
                    AVG(capacite_volume_utilise / NULLIF(capacite_volume_total, 0) * 100) as taux_remplissage_moyen
                FROM conteneurs
                WHERE created_at BETWEEN $1 AND $2
                GROUP BY statut
                ORDER BY nombre DESC
            `, [startDate, endDate]);
            
            // Destinations
            const destinations = await query(`
                SELECT 
                    destination_pays,
                    destination_ville,
                    COUNT(*) as nombre_conteneurs,
                    SUM(capacite_volume_utilise) as volume_total,
                    SUM(capacite_poids_utilise) as poids_total,
                    COUNT(DISTINCT m.client_id) as clients_uniques
                FROM conteneurs c
                LEFT JOIN marchandises m ON m.conteneur_id = c.id
                WHERE c.created_at BETWEEN $1 AND $2
                GROUP BY destination_pays, destination_ville
                ORDER BY nombre_conteneurs DESC
            `, [startDate, endDate]);
            
            // Performance des conteneurs
            const performance = await query(`
                SELECT 
                    c.numero_conteneur,
                    c.destination_pays || ', ' || c.destination_ville as destination,
                    c.statut,
                    COUNT(DISTINCT m.client_id) as nombre_clients,
                    COUNT(m.id) as nombre_marchandises,
                    ROUND((c.capacite_volume_utilise / NULLIF(c.capacite_volume_total, 0)) * 100, 2) as taux_volume,
                    ROUND((c.capacite_poids_utilise / NULLIF(c.capacite_poids_total, 0)) * 100, 2) as taux_poids,
                    c.cout_total as cout,
                    COALESCE(SUM(p.montant_paye), 0) as montant_collecte
                FROM conteneurs c
                LEFT JOIN marchandises m ON m.conteneur_id = c.id
                LEFT JOIN paiements p ON p.conteneur_id = c.id AND p.statut = 'valide'
                WHERE c.created_at BETWEEN $1 AND $2
                GROUP BY c.id
                ORDER BY c.created_at DESC
            `, [startDate, endDate]);
            
            return {
                periode: { startDate, endDate },
                byStatus: byStatus.rows,
                destinations: destinations.rows,
                performance: performance.rows
            };
            
        } catch (error) {
            logger.error('Erreur génération rapport conteneurs:', error);
            throw error;
        }
    }
    
    /**
     * Exporter un rapport en Excel
     */
    async exportToExcel(reportData, reportType) {
        try {
            const workbook = new ExcelJS.Workbook();
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const filename = `rapport_${reportType}_${timestamp}.xlsx`;
            const filepath = path.join(this.reportsDir, filename);
            
            // Métadonnées
            workbook.creator = 'Import Export Manager';
            workbook.created = new Date();
            
            // Ajouter les feuilles selon le type de rapport
            switch (reportType) {
                case 'dashboard':
                    this.addDashboardSheets(workbook, reportData);
                    break;
                case 'financial':
                    this.addFinancialSheets(workbook, reportData);
                    break;
                case 'container':
                    this.addContainerSheets(workbook, reportData);
                    break;
                default:
                    this.addGenericSheet(workbook, reportData);
            }
            
            // Sauvegarder le fichier
            await workbook.xlsx.writeFile(filepath);
            
            return { filename, filepath };
            
        } catch (error) {
            logger.error('Erreur export Excel:', error);
            throw error;
        }
    }
    
    /**
     * Ajouter les feuilles du dashboard
     */
    addDashboardSheets(workbook, data) {
        // Feuille de résumé
        const summarySheet = workbook.addWorksheet('Résumé');
        summarySheet.columns = [
            { header: 'Indicateur', key: 'indicator', width: 30 },
            { header: 'Valeur', key: 'value', width: 20 }
        ];
        
        summarySheet.addRows([
            { indicator: 'Total Clients', value: data.stats.total_clients },
            { indicator: 'Nouvelles Marchandises', value: data.stats.nouvelles_marchandises },
            { indicator: 'Nouveaux Conteneurs', value: data.stats.nouveaux_conteneurs },
            { indicator: 'Revenus Période', value: `${data.stats.revenus_periode} €` }
        ]);
        
        // Feuille des top clients
        const clientsSheet = workbook.addWorksheet('Top Clients');
        clientsSheet.columns = [
            { header: 'Nom', key: 'nom', width: 20 },
            { header: 'Prénom', key: 'prenom', width: 20 },
            { header: 'Marchandises', key: 'nombre_marchandises', width: 15 },
            { header: 'Chiffre d\'affaires', key: 'chiffre_affaires', width: 20 }
        ];
        clientsSheet.addRows(data.topClients);
        
        // Feuille des destinations
        const destSheet = workbook.addWorksheet('Destinations');
        destSheet.columns = [
            { header: 'Pays', key: 'destination_pays', width: 20 },
            { header: 'Ville', key: 'destination_ville', width: 20 },
            { header: 'Conteneurs', key: 'nombre_conteneurs', width: 15 },
            { header: 'Clients', key: 'nombre_clients', width: 15 }
        ];
        destSheet.addRows(data.destinations);
        
        // Appliquer le style
        [summarySheet, clientsSheet, destSheet].forEach(sheet => {
            sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
            sheet.getRow(1).fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FF1E88E5' }
            };
        });
    }
    
    /**
     * Ajouter les feuilles financières
     */
    addFinancialSheets(workbook, data) {
        // Feuille de résumé
        const summarySheet = workbook.addWorksheet('Résumé Financier');
        summarySheet.columns = [
            { header: 'Indicateur', key: 'indicator', width: 30 },
            { header: 'Valeur', key: 'value', width: 20 }
        ];
        
        const summary = data.summary;
        summarySheet.addRows([
            { indicator: 'Clients Payants', value: summary.clients_payants },
            { indicator: 'Total Paiements', value: summary.total_paiements },
            { indicator: 'Total Encaissé', value: `${summary.total_encaisse} €` },
            { indicator: 'Total Facturé', value: `${summary.total_facture} €` },
            { indicator: 'Total Restant', value: `${summary.total_restant} €` },
            { indicator: 'Paiement Moyen', value: `${parseFloat(summary.paiement_moyen).toFixed(2)} €` }
        ]);
        
        // Feuille des modes de paiement
        const modesSheet = workbook.addWorksheet('Modes de Paiement');
        modesSheet.columns = [
            { header: 'Mode', key: 'mode_paiement', width: 20 },
            { header: 'Nombre', key: 'nombre_paiements', width: 15 },
            { header: 'Total', key: 'total', width: 20 },
            { header: 'Moyenne', key: 'moyenne', width: 20 }
        ];
        modesSheet.addRows(data.revenuesByMode);
        
        // Feuille des impayés
        const unpaidSheet = workbook.addWorksheet('Impayés');
        unpaidSheet.columns = [
            { header: 'Client', key: 'client', width: 30 },
            { header: 'Factures', key: 'nombre_factures', width: 15 },
            { header: 'Total Impayé', key: 'total_impaye', width: 20 },
            { header: 'Plus Ancienne', key: 'plus_ancienne_echeance', width: 20 }
        ];
        unpaidSheet.addRows(data.unpaid);
    }
    
    /**
     * Ajouter une feuille générique
     */
    addGenericSheet(workbook, data) {
        const sheet = workbook.addWorksheet('Données');
        
        if (Array.isArray(data) && data.length > 0) {
            // Utiliser les clés du premier objet comme en-têtes
            const headers = Object.keys(data[0]);
            sheet.columns = headers.map(header => ({
                header: header.charAt(0).toUpperCase() + header.slice(1).replace(/_/g, ' '),
                key: header,
                width: 20
            }));
            
            sheet.addRows(data);
        }
    }
}

module.exports = new ReportService();