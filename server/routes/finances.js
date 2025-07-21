/**
 * Routes API pour la gestion financière
 */

const express = require('express');
const router = express.Router();
const { db, query } = require('../database/connection');
const { logger } = require('../../shared/logger');
const authMiddleware = require('../middlewares/auth');
const { validatePaiement } = require('../middlewares/validation');
const auditService = require('../services/auditService');
const barcodeService = require('../services/barcodeService');
const pdfService = require('../services/pdfService');
const notificationService = require('../services/notificationService');

// Appliquer l'authentification à toutes les routes
router.use(authMiddleware);

/**
 * GET /api/paiements
 * Récupérer tous les paiements
 */
router.get('/', async (req, res) => {
    try {
        const { 
            page = 1, 
            limit = 25, 
            search, 
            statut,
            mode_paiement,
            client_id,
            conteneur_id,
            date_debut,
            date_fin,
            sort = 'date_paiement:desc' 
        } = req.query;
        
        // Construire la requête
        let queryText = `
            SELECT p.*,
                   c.nom as client_nom,
                   c.prenom as client_prenom,
                   c.telephone_principal as client_telephone,
                   cnt.numero_conteneur,
                   m.code_barre as marchandise_code
            FROM paiements p
            JOIN clients c ON p.client_id = c.id
            LEFT JOIN conteneurs cnt ON p.conteneur_id = cnt.id
            LEFT JOIN marchandises m ON p.marchandise_id = m.id
            WHERE 1=1
        `;
        
        const params = [];
        let paramIndex = 1;
        
        // Filtres
        if (search) {
            queryText += ` AND (p.numero_recu LIKE $${paramIndex} OR p.reference_transaction LIKE $${paramIndex})`;
            params.push(`%${search}%`);
            paramIndex++;
        }
        
        if (statut) {
            queryText += ` AND p.statut = $${paramIndex}`;
            params.push(statut);
            paramIndex++;
        }
        
        if (mode_paiement) {
            queryText += ` AND p.mode_paiement = $${paramIndex}`;
            params.push(mode_paiement);
            paramIndex++;
        }
        
        if (client_id) {
            queryText += ` AND p.client_id = $${paramIndex}`;
            params.push(client_id);
            paramIndex++;
        }
        
        if (conteneur_id) {
            queryText += ` AND p.conteneur_id = $${paramIndex}`;
            params.push(conteneur_id);
            paramIndex++;
        }
        
        if (date_debut) {
            queryText += ` AND p.date_paiement >= $${paramIndex}`;
            params.push(date_debut);
            paramIndex++;
        }
        
        if (date_fin) {
            queryText += ` AND p.date_paiement <= $${paramIndex}`;
            params.push(date_fin);
            paramIndex++;
        }
        
        // Tri
        const [sortField, sortOrder] = sort.split(':');
        queryText += ` ORDER BY p.${sortField} ${sortOrder.toUpperCase()}`;
        
        // Pagination
        const offset = (page - 1) * limit;
        queryText += ` LIMIT ${limit} OFFSET ${offset}`;
        
        // Exécuter la requête
        const result = await query(queryText, params);
        
        // Compter le total
        const countQuery = queryText.split('ORDER BY')[0].replace(/SELECT.*FROM/, 'SELECT COUNT(*) FROM');
        const countResult = await query(countQuery, params);
        const total = (countResult.rows && countResult.rows.length > 0) ? parseInt(countResult.rows[0].count) : 0; // ✅ CORRIGÉ
        
        res.json({
            data: result.rows,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / limit)
            }
        });
        
    } catch (error) {
        logger.error('Erreur récupération paiements:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

/**
 * GET /api/paiements/pending
 * Récupérer les paiements en attente
 */
router.get('/pending', async (req, res) => {
    try {
        const paiements = await query(`
            SELECT p.*,
                   c.nom as client_nom,
                   c.prenom as client_prenom,
                   m.designation as marchandise_designation
            FROM paiements p
            JOIN clients c ON p.client_id = c.id
            LEFT JOIN marchandises m ON p.marchandise_id = m.id
            WHERE p.montant_paye < p.montant_total_du
            AND p.statut = 'valide'
            ORDER BY p.date_echeance ASC
        `);
        
        res.json(paiements.rows);
        
    } catch (error) {
        logger.error('Erreur récupération paiements en attente:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

/**
 * GET /api/paiements/overdue
 * Récupérer les paiements en retard
 */
router.get('/overdue', async (req, res) => {
    try {
        const paiements = await query(`
            SELECT p.*,
                   c.nom as client_nom,
                   c.prenom as client_prenom,
                   CURRENT_DATE - p.date_echeance as jours_retard
            FROM paiements p
            JOIN clients c ON p.client_id = c.id
            WHERE p.montant_paye < p.montant_total_du
            AND p.statut = 'valide'
            AND p.date_echeance < CURRENT_DATE
            ORDER BY p.date_echeance ASC
        `);
        
        res.json(paiements.rows);
        
    } catch (error) {
        logger.error('Erreur récupération paiements en retard:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

/**
 * GET /api/paiements/:id
 * Récupérer un paiement par ID
 */
router.get('/:id', async (req, res) => {
    try {
        const paiement = await query(`
            SELECT p.*,
                   c.nom as client_nom,
                   c.prenom as client_prenom,
                   c.email as client_email,
                   c.telephone_principal as client_telephone,
                   cnt.numero_conteneur,
                   m.code_barre as marchandise_code,
                   m.designation as marchandise_designation
            FROM paiements p
            JOIN clients c ON p.client_id = c.id
            LEFT JOIN conteneurs cnt ON p.conteneur_id = cnt.id
            LEFT JOIN marchandises m ON p.marchandise_id = m.id
            WHERE p.id = $1
        `, [req.params.id]);
        
        if (paiement.rows.length === 0) {
            return res.status(404).json({ error: 'Paiement non trouvé' });
        }
        
        res.json(paiement.rows[0]);
        
    } catch (error) {
        logger.error('Erreur récupération paiement:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

/**
 * POST /api/paiements
 * Créer un nouveau paiement
 */
router.post('/', validatePaiement, async (req, res) => {
    try {
        // Générer le numéro de reçu
        const numero_recu = await barcodeService.generateReceiptNumber();
        
        // Calculer le montant restant
        const montant_restant = (req.body.montant_total_du || 0) - (req.body.montant_paye || 0);
        
        const newPaiement = await db.insert('paiements', {
            ...req.body,
            numero_recu,
            montant_restant,
            created_by: req.user.id
        });
        
        // Si paiement lié à une marchandise, mettre à jour la facture
        if (newPaiement.marchandise_id) {
            await db.update('marchandises', newPaiement.marchandise_id, {
                facture_generee: true
            });
        }
        
        // Log d'audit
        await auditService.log({
            utilisateur_id: req.user.id,
            action: 'CREATE',
            entite: 'paiements',
            entite_id: newPaiement.id,
            nouvelles_valeurs: newPaiement
        });
        
        // Notification temps réel
        req.io.emit('paiement:created', newPaiement);
        
        // Notification au client si email disponible
        const client = await db.findOne('clients', { id: newPaiement.client_id });
        if (client.email) {
            await notificationService.sendPaymentConfirmation(client, newPaiement);
        }
        
        res.status(201).json(newPaiement);
        
    } catch (error) {
        logger.error('Erreur création paiement:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

/**
 * PUT /api/paiements/:id
 * Mettre à jour un paiement
 */
router.put('/:id', validatePaiement, async (req, res) => {
    try {
        const oldPaiement = await db.findOne('paiements', { id: req.params.id });
        
        if (!oldPaiement) {
            return res.status(404).json({ error: 'Paiement non trouvé' });
        }
        
        // Interdire la modification du numéro de reçu
        delete req.body.numero_recu;
        
        // Recalculer le montant restant
        if (req.body.montant_paye !== undefined || req.body.montant_total_du !== undefined) {
            const montant_total_du = req.body.montant_total_du || oldPaiement.montant_total_du;
            const montant_paye = req.body.montant_paye || oldPaiement.montant_paye;
            req.body.montant_restant = montant_total_du - montant_paye;
        }
        
        const updatedPaiement = await db.update('paiements', req.params.id, req.body);
        
        // Log d'audit
        await auditService.log({
            utilisateur_id: req.user.id,
            action: 'UPDATE',
            entite: 'paiements',
            entite_id: updatedPaiement.id,
            anciennes_valeurs: oldPaiement,
            nouvelles_valeurs: updatedPaiement
        });
        
        // Notification temps réel
        req.io.emit('paiement:updated', updatedPaiement);
        
        res.json(updatedPaiement);
        
    } catch (error) {
        logger.error('Erreur mise à jour paiement:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

/**
 * DELETE /api/paiements/:id
 * Annuler un paiement
 */
router.delete('/:id', async (req, res) => {
    try {
        const paiement = await db.findOne('paiements', { id: req.params.id });
        
        if (!paiement) {
            return res.status(404).json({ error: 'Paiement non trouvé' });
        }
        
        // Ne pas supprimer mais annuler
        const updatedPaiement = await db.update('paiements', req.params.id, {
            statut: 'annule',
            date_annulation: new Date(),
            annule_par: req.user.id
        });
        
        // Log d'audit
        await auditService.log({
            utilisateur_id: req.user.id,
            action: 'CANCEL',
            entite: 'paiements',
            entite_id: req.params.id,
            anciennes_valeurs: paiement,
            nouvelles_valeurs: updatedPaiement
        });
        
        // Notification temps réel
        req.io.emit('paiement:cancelled', updatedPaiement);
        
        res.json({ message: 'Paiement annulé avec succès' });
        
    } catch (error) {
        logger.error('Erreur annulation paiement:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

/**
 * POST /api/paiements/:id/receipt
 * Générer un reçu PDF
 */
router.post('/:id/receipt', async (req, res) => {
    try {
        const result = await pdfService.generateReceipt(req.params.id);
        
        res.json({
            filename: result.filename,
            url: `/api/download/${result.filename}`
        });
        
    } catch (error) {
        logger.error('Erreur génération reçu:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

/**
 * GET /api/paiements/stats/summary
 * Récupérer les statistiques financières
 */
router.get('/stats/summary', async (req, res) => {
    try {
        const stats = await query(`
            SELECT 
                COUNT(*) as total_paiements,
                SUM(montant_paye) as total_encaisse,
                SUM(montant_total_du - montant_paye) as total_restant,
                COUNT(CASE WHEN date_echeance < CURRENT_DATE AND montant_restant > 0 THEN 1 END) as paiements_retard,
                SUM(CASE WHEN date_echeance < CURRENT_DATE THEN montant_restant ELSE 0 END) as montant_retard
            FROM paiements
            WHERE statut = 'valide'
        `);
        
        // Statistiques par mode de paiement
        const byMode = await query(`
            SELECT 
                mode_paiement,
                COUNT(*) as nombre,
                SUM(montant_paye) as total
            FROM paiements
            WHERE statut = 'valide'
            GROUP BY mode_paiement
            ORDER BY total DESC
        `);
        
        // Évolution mensuelle
        const monthly = await query(`
            SELECT 
                TO_CHAR(date_paiement, 'YYYY-MM') as mois,
                SUM(montant_paye) as total
            FROM paiements
            WHERE statut = 'valide'
            AND date_paiement >= CURRENT_DATE - INTERVAL '12 months'
            GROUP BY mois
            ORDER BY mois
        `);
        
        res.json({
            summary: stats.rows[0],
            byMode: byMode.rows,
            monthly: monthly.rows
        });
        
    } catch (error) {
        logger.error('Erreur statistiques financières:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

/**
 * GET /api/paiements/export
 * Exporter les paiements (CSV/Excel)
 */
router.get('/export', async (req, res) => {
    try {
        const { format = 'csv', ...filters } = req.query;
        
        // TODO: Implémenter l'export
        res.status(501).json({ error: 'Export non implémenté' });
        
    } catch (error) {
        logger.error('Erreur export paiements:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

/**
 * POST /api/paiements/bulk-reminder
 * Envoyer des rappels de paiement en masse
 */
router.post('/bulk-reminder', async (req, res) => {
    try {
        const overduePayments = await query(`
            SELECT p.*, c.email, c.nom, c.prenom
            FROM paiements p
            JOIN clients c ON p.client_id = c.id
            WHERE p.montant_restant > 0
            AND p.statut = 'valide'
            AND p.date_echeance < CURRENT_DATE
            AND c.email IS NOT NULL
        `);
        
        let sent = 0;
        for (const payment of overduePayments.rows) {
            try {
                await notificationService.sendPaymentReminder(payment);
                sent++;
            } catch (error) {
                logger.error(`Erreur envoi rappel paiement ${payment.id}:`, error);
            }
        }
        
        res.json({
            total: overduePayments.rows.length,
            sent,
            failed: overduePayments.rows.length - sent
        });
        
    } catch (error) {
        logger.error('Erreur envoi rappels:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

module.exports = router;