/**
 * Routes API pour les rapports et statistiques
 */

const express = require('express');
const router = express.Router();
const { query } = require('../database/connection');
const { logger } = require('../../shared/logger');
const authMiddleware = require('../middlewares/auth');
const reportService = require('../services/reportService');
const auditService = require('../services/auditService');

// Appliquer l'authentification à toutes les routes
router.use(authMiddleware);

/**
 * GET /api/rapports/dashboard
 * Récupérer les données du tableau de bord
 */
router.get('/dashboard', async (req, res) => {
    try {
        const { periode = 'month' } = req.query;
        
        const data = await reportService.generateDashboardReport(periode);
        
        res.json(data);
        
    } catch (error) {
        logger.error('Erreur rapport dashboard:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

/**
 * GET /api/rapports/activity
 * Récupérer l'activité récente
 */
router.get('/activity', async (req, res) => {
    try {
        const { days = 7 } = req.query;
        
        const activity = await query(`
            SELECT 
                'client' as type,
                'Nouveau client' as description,
                c.nom || ' ' || c.prenom as details,
                c.created_at as date,
                u.nom || ' ' || u.prenom as created_by
            FROM clients c
            LEFT JOIN utilisateurs u ON c.created_by = u.id
            WHERE c.created_at >= CURRENT_DATE - INTERVAL '$1 days'
            
            UNION ALL
            
            SELECT 
                'marchandise' as type,
                'Nouvelle marchandise' as description,
                m.designation as details,
                m.created_at as date,
                u.nom || ' ' || u.prenom as created_by
            FROM marchandises m
            LEFT JOIN utilisateurs u ON m.created_by = u.id
            WHERE m.created_at >= CURRENT_DATE - INTERVAL '$1 days'
            
            UNION ALL
            
            SELECT 
                'paiement' as type,
                'Paiement reçu' as description,
                p.montant_paye || '€ - ' || c.nom || ' ' || c.prenom as details,
                p.created_at as date,
                u.nom || ' ' || u.prenom as created_by
            FROM paiements p
            JOIN clients c ON p.client_id = c.id
            LEFT JOIN utilisateurs u ON p.created_by = u.id
            WHERE p.created_at >= CURRENT_DATE - INTERVAL '$1 days'
            AND p.statut = 'valide'
            
            ORDER BY date DESC
            LIMIT 50
        `, [days]);
        
        res.json(activity.rows);
        
    } catch (error) {
        logger.error('Erreur rapport activité:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

/**
 * POST /api/rapports/financial
 * Générer un rapport financier
 */
router.post('/financial', authMiddleware.requirePermission('rapport.view'), async (req, res) => {
    try {
        const { startDate, endDate, format = 'json' } = req.body;
        
        if (!startDate || !endDate) {
            return res.status(400).json({ error: 'Dates requises' });
        }
        
        const data = await reportService.generateFinancialReport(startDate, endDate);
        
        if (format === 'excel') {
            const result = await reportService.exportToExcel(data, 'financial');
            
            // Log d'audit
            await auditService.log({
                utilisateur_id: req.user.id,
                action: 'EXPORT_REPORT',
                entite: 'rapports',
                nouvelles_valeurs: { type: 'financial', format: 'excel', periode: { startDate, endDate } }
            });
            
            res.json({
                filename: result.filename,
                url: `/api/download/${result.filename}`
            });
        } else {
            res.json(data);
        }
        
    } catch (error) {
        logger.error('Erreur rapport financier:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

/**
 * POST /api/rapports/containers
 * Générer un rapport sur les conteneurs
 */
router.post('/containers', authMiddleware.requirePermission('rapport.view'), async (req, res) => {
    try {
        const { startDate, endDate, format = 'json' } = req.body;
        
        if (!startDate || !endDate) {
            return res.status(400).json({ error: 'Dates requises' });
        }
        
        const data = await reportService.generateContainerReport(startDate, endDate);
        
        if (format === 'excel') {
            const result = await reportService.exportToExcel(data, 'container');
            
            res.json({
                filename: result.filename,
                url: `/api/download/${result.filename}`
            });
        } else {
            res.json(data);
        }
        
    } catch (error) {
        logger.error('Erreur rapport conteneurs:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

/**
 * GET /api/rapports/stats/clients
 * Statistiques des clients
 */
router.get('/stats/clients', async (req, res) => {
    try {
        const stats = await query(`
            SELECT 
                COUNT(*) as total,
                COUNT(CASE WHEN statut = 'actif' THEN 1 END) as actifs,
                COUNT(CASE WHEN created_at >= CURRENT_DATE - INTERVAL '30 days' THEN 1 END) as nouveaux_30j,
                COUNT(CASE WHEN created_at >= CURRENT_DATE - INTERVAL '7 days' THEN 1 END) as nouveaux_7j
            FROM clients
        `);
        
        const topClients = await query(`
            SELECT 
                c.id,
                c.nom || ' ' || c.prenom as nom_complet,
                c.ville,
                COUNT(DISTINCT m.id) as nombre_colis,
                COALESCE(SUM(m.cout_total), 0) as chiffre_affaires,
                COALESCE(SUM(p.montant_paye), 0) as total_paye
            FROM clients c
            LEFT JOIN marchandises m ON m.client_id = c.id
            LEFT JOIN paiements p ON p.client_id = c.id AND p.statut = 'valide'
            WHERE c.statut = 'actif'
            GROUP BY c.id
            ORDER BY chiffre_affaires DESC
            LIMIT 10
        `);
        
        res.json({
            summary: stats.rows[0],
            topClients: topClients.rows
        });
        
    } catch (error) {
        logger.error('Erreur stats clients:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

/**
 * GET /api/rapports/stats/marchandises
 * Statistiques des marchandises
 */
router.get('/stats/marchandises', async (req, res) => {
    try {
        const stats = await query(`
            SELECT 
                COUNT(*) as total,
                COUNT(CASE WHEN statut = 'en_attente' THEN 1 END) as en_attente,
                COUNT(CASE WHEN statut = 'en_transit' THEN 1 END) as en_transit,
                COUNT(CASE WHEN statut = 'livre' THEN 1 END) as livrees,
                SUM(nombre_colis) as total_colis,
                SUM(poids) as poids_total,
                SUM(volume) as volume_total
            FROM marchandises
        `);
        
        const byType = await query(`
            SELECT 
                type_marchandise,
                COUNT(*) as nombre,
                SUM(nombre_colis) as total_colis,
                AVG(poids) as poids_moyen
            FROM marchandises
            GROUP BY type_marchandise
            ORDER BY nombre DESC
        `);
        
        const byStatus = await query(`
            SELECT 
                statut,
                COUNT(*) as nombre,
                ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM marchandises), 2) as pourcentage
            FROM marchandises
            GROUP BY statut
            ORDER BY nombre DESC
        `);
        
        res.json({
            summary: stats.rows[0],
            byType: byType.rows,
            byStatus: byStatus.rows
        });
        
    } catch (error) {
        logger.error('Erreur stats marchandises:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

/**
 * GET /api/rapports/export/custom
 * Export personnalisé
 */
router.post('/export/custom', authMiddleware.requirePermission('rapport.export'), async (req, res) => {
    try {
        const { 
            entity, // clients, marchandises, conteneurs, paiements
            filters = {},
            fields = [],
            format = 'csv'
        } = req.body;
        
        // TODO: Implémenter l'export personnalisé
        res.status(501).json({ error: 'Export personnalisé non implémenté' });
        
    } catch (error) {
        logger.error('Erreur export personnalisé:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

/**
 * GET /api/rapports/audit
 * Récupérer l'historique d'audit
 */
router.get('/audit', authMiddleware.requireRole('admin'), async (req, res) => {
    try {
        const { 
            utilisateur_id,
            action,
            entite,
            date_debut,
            date_fin,
            page = 1,
            limit = 50
        } = req.query;
        
        const filters = {
            utilisateur_id,
            action,
            entite,
            date_debut,
            date_fin,
            limit: parseInt(limit),
            offset: (parseInt(page) - 1) * parseInt(limit)
        };
        
        const history = await auditService.getHistory(filters);
        
        res.json(history);
        
    } catch (error) {
        logger.error('Erreur récupération audit:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

module.exports = router;