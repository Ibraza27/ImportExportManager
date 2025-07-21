/**
 * Routes API pour la gestion des conteneurs
 */

const express = require('express');
const router = express.Router();
const { db, query } = require('../database/connection');
const { logger } = require('../../shared/logger');
const authMiddleware = require('../middlewares/auth');
const { validateConteneur } = require('../middlewares/validation');
const auditService = require('../services/auditService');
const barcodeService = require('../services/barcodeService');
const pdfService = require('../services/pdfService');

// Appliquer l'authentification à toutes les routes
router.use(authMiddleware);

/**
 * GET /api/conteneurs
 * Récupérer tous les conteneurs
 */
router.get('/', async (req, res) => {
    try {
        const { 
            page = 1, 
            limit = 25, 
            search, 
            statut, 
            destination_pays,
            type_envoi,
            date_debut,
            date_fin,
            sort = 'created_at:desc' 
        } = req.query;
        
        // Construire la requête
        let queryText = `
            SELECT c.*,
                   COUNT(DISTINCT m.client_id) as nombre_clients,
                   COUNT(m.id) as nombre_marchandises,
                   COALESCE(SUM(m.cout_total), 0) as valeur_totale
            FROM conteneurs c
            LEFT JOIN marchandises m ON m.conteneur_id = c.id
            WHERE 1=1
        `;
        
        const params = [];
        let paramIndex = 1;
        
        // Filtres
        if (search) {
            queryText += ` AND (c.numero_conteneur LIKE $${paramIndex} OR c.numero_dossier LIKE $${paramIndex})`;
            params.push(`%${search}%`);
            paramIndex++;
        }
        
        if (statut) {
            queryText += ` AND c.statut = $${paramIndex}`;
            params.push(statut);
            paramIndex++;
        }
        
        if (destination_pays) {
            queryText += ` AND c.destination_pays = $${paramIndex}`;
            params.push(destination_pays);
            paramIndex++;
        }
        
        if (type_envoi) {
            queryText += ` AND c.type_envoi = $${paramIndex}`;
            params.push(type_envoi);
            paramIndex++;
        }
        
        if (date_debut) {
            queryText += ` AND c.date_depart_prevue >= $${paramIndex}`;
            params.push(date_debut);
            paramIndex++;
        }
        
        if (date_fin) {
            queryText += ` AND c.date_depart_prevue <= $${paramIndex}`;
            params.push(date_fin);
            paramIndex++;
        }
        
        // Grouper par conteneur
        queryText += ' GROUP BY c.id';
        
        // Tri
        const [sortField, sortOrder] = sort.split(':');
        queryText += ` ORDER BY c.${sortField} ${sortOrder.toUpperCase()}`;
        
        // Pagination
        const offset = (page - 1) * limit;
        queryText += ` LIMIT ${limit} OFFSET ${offset}`;
        
        // Exécuter la requête
        const result = await query(queryText, params);
        
        // Compter le total
        const countQuery = `
            SELECT COUNT(DISTINCT c.id) 
            FROM conteneurs c 
            WHERE 1=1 ${params.length > 0 ? queryText.split('WHERE 1=1')[1].split('GROUP BY')[0] : ''}
        `;
        const countResult = await query(countQuery, params);
        const total = parseInt(countResult.rows[0].count);
        
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
        logger.error('Erreur récupération conteneurs:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

/**
 * GET /api/conteneurs/active
 * Récupérer les conteneurs actifs (non clôturés)
 */
router.get('/active', async (req, res) => {
    try {
        const conteneurs = await query(`
            SELECT c.*,
                   COUNT(DISTINCT m.client_id) as nombre_clients,
                   COUNT(m.id) as nombre_marchandises,
                   ROUND((c.capacite_volume_utilise / NULLIF(c.capacite_volume_total, 0)) * 100, 2) as taux_remplissage
            FROM conteneurs c
            LEFT JOIN marchandises m ON m.conteneur_id = c.id
            WHERE c.statut NOT IN ('cloture', 'livre')
            GROUP BY c.id
            ORDER BY c.date_depart_prevue ASC
        `);
        
        res.json(conteneurs.rows);
        
    } catch (error) {
        logger.error('Erreur récupération conteneurs actifs:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

/**
 * GET /api/conteneurs/:id
 * Récupérer un conteneur par ID
 */
router.get('/:id', async (req, res) => {
    try {
        const conteneur = await db.findOne('conteneurs', { id: req.params.id });
        
        if (!conteneur) {
            return res.status(404).json({ error: 'Conteneur non trouvé' });
        }
        
        // Récupérer les statistiques
        const stats = await query(`
            SELECT 
                COUNT(DISTINCT client_id) as nombre_clients,
                COUNT(id) as nombre_marchandises,
                COALESCE(SUM(nombre_colis), 0) as total_colis,
                COALESCE(SUM(cout_total), 0) as valeur_totale,
                COALESCE(SUM(CASE WHEN p.montant_paye >= m.cout_total THEN m.cout_total ELSE p.montant_paye END), 0) as total_paye
            FROM marchandises m
            LEFT JOIN (
                SELECT marchandise_id, SUM(montant_paye) as montant_paye
                FROM paiements
                WHERE statut = 'valide'
                GROUP BY marchandise_id
            ) p ON p.marchandise_id = m.id
            WHERE m.conteneur_id = $1
        `, [req.params.id]);
        
        conteneur.stats = stats.rows[0];
        
        res.json(conteneur);
        
    } catch (error) {
        logger.error('Erreur récupération conteneur:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

/**
 * POST /api/conteneurs
 * Créer un nouveau conteneur
 */
router.post('/', validateConteneur, async (req, res) => {
    try {
        // Générer le numéro de dossier
        const numero_dossier = await barcodeService.generateDossierNumber();
        
        const newConteneur = await db.insert('conteneurs', {
            ...req.body,
            numero_dossier,
            created_by: req.user.id
        });
        
        // Log d'audit
        await auditService.log({
            utilisateur_id: req.user.id,
            action: 'CREATE',
            entite: 'conteneurs',
            entite_id: newConteneur.id,
            nouvelles_valeurs: newConteneur
        });
        
        // Notification temps réel
        req.io.emit('conteneur:created', newConteneur);
        
        res.status(201).json(newConteneur);
        
    } catch (error) {
        logger.error('Erreur création conteneur:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

/**
 * PUT /api/conteneurs/:id
 * Mettre à jour un conteneur
 */
router.put('/:id', validateConteneur, async (req, res) => {
    try {
        const oldConteneur = await db.findOne('conteneurs', { id: req.params.id });
        
        if (!oldConteneur) {
            return res.status(404).json({ error: 'Conteneur non trouvé' });
        }
        
        // Interdire la modification si clôturé
        if (oldConteneur.statut === 'cloture') {
            return res.status(400).json({ error: 'Impossible de modifier un conteneur clôturé' });
        }
        
        // Interdire la modification du numéro de dossier
        delete req.body.numero_dossier;
        
        const updatedConteneur = await db.update('conteneurs', req.params.id, req.body);
        
        // Log d'audit
        await auditService.log({
            utilisateur_id: req.user.id,
            action: 'UPDATE',
            entite: 'conteneurs',
            entite_id: updatedConteneur.id,
            anciennes_valeurs: oldConteneur,
            nouvelles_valeurs: updatedConteneur
        });
        
        // Notification temps réel
        req.io.emit('conteneur:updated', updatedConteneur);
        
        res.json(updatedConteneur);
        
    } catch (error) {
        logger.error('Erreur mise à jour conteneur:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

/**
 * DELETE /api/conteneurs/:id
 * Supprimer un conteneur
 */
router.delete('/:id', async (req, res) => {
    try {
        // Vérifier s'il y a des marchandises associées
        const marchandisesCount = await db.count('marchandises', { conteneur_id: req.params.id });
        
        if (marchandisesCount > 0) {
            return res.status(400).json({ 
                error: 'Impossible de supprimer ce conteneur car il contient des marchandises' 
            });
        }
        
        const deletedConteneur = await db.delete('conteneurs', req.params.id);
        
        if (!deletedConteneur) {
            return res.status(404).json({ error: 'Conteneur non trouvé' });
        }
        
        // Log d'audit
        await auditService.log({
            utilisateur_id: req.user.id,
            action: 'DELETE',
            entite: 'conteneurs',
            entite_id: req.params.id,
            anciennes_valeurs: deletedConteneur
        });
        
        // Notification temps réel
        req.io.emit('conteneur:deleted', { id: req.params.id });
        
        res.json({ message: 'Conteneur supprimé avec succès' });
        
    } catch (error) {
        logger.error('Erreur suppression conteneur:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

/**
 * GET /api/conteneurs/:id/manifest
 * Récupérer le manifeste d'un conteneur
 */
router.get('/:id/manifest', async (req, res) => {
    try {
        const manifest = await query(`
            SELECT m.*,
                   c.nom as client_nom,
                   c.prenom as client_prenom,
                   c.telephone_principal as client_telephone,
                   COALESCE(p.montant_paye, 0) as montant_paye
            FROM marchandises m
            JOIN clients c ON m.client_id = c.id
            LEFT JOIN (
                SELECT marchandise_id, SUM(montant_paye) as montant_paye
                FROM paiements
                WHERE statut = 'valide'
                GROUP BY marchandise_id
            ) p ON p.marchandise_id = m.id
            WHERE m.conteneur_id = $1
            ORDER BY c.nom, c.prenom, m.id
        `, [req.params.id]);
        
        res.json(manifest.rows);
        
    } catch (error) {
        logger.error('Erreur récupération manifeste:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

/**
 * POST /api/conteneurs/:id/close
 * Clôturer un conteneur
 */
router.post('/:id/close', async (req, res) => {
    try {
        const conteneur = await db.findOne('conteneurs', { id: req.params.id });
        
        if (!conteneur) {
            return res.status(404).json({ error: 'Conteneur non trouvé' });
        }
        
        if (conteneur.statut === 'cloture') {
            return res.status(400).json({ error: 'Ce conteneur est déjà clôturé' });
        }
        
        // Vérifier qu'il y a des marchandises
        const marchandisesCount = await db.count('marchandises', { conteneur_id: req.params.id });
        
        if (marchandisesCount === 0) {
            return res.status(400).json({ error: 'Impossible de clôturer un conteneur vide' });
        }
        
        // Mettre à jour le statut
        const updatedConteneur = await db.update('conteneurs', req.params.id, {
            statut: 'cloture',
            date_cloture: new Date()
        });
        
        // Mettre à jour le statut des marchandises
        await query(`
            UPDATE marchandises 
            SET statut = 'en_transit' 
            WHERE conteneur_id = $1 AND statut NOT IN ('livre', 'probleme')
        `, [req.params.id]);
        
        // Log d'audit
        await auditService.log({
            utilisateur_id: req.user.id,
            action: 'CLOSE',
            entite: 'conteneurs',
            entite_id: req.params.id,
            nouvelles_valeurs: { statut: 'cloture' }
        });
        
        // Notification temps réel
        req.io.emit('conteneur:closed', updatedConteneur);
        
        res.json(updatedConteneur);
        
    } catch (error) {
        logger.error('Erreur clôture conteneur:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

/**
 * POST /api/conteneurs/:id/assign-marchandises
 * Affecter des marchandises à un conteneur
 */
router.post('/:id/assign-marchandises', async (req, res) => {
    try {
        const { marchandise_ids } = req.body;
        
        if (!Array.isArray(marchandise_ids) || marchandise_ids.length === 0) {
            return res.status(400).json({ error: 'Liste de marchandises invalide' });
        }
        
        const conteneur = await db.findOne('conteneurs', { id: req.params.id });
        
        if (!conteneur) {
            return res.status(404).json({ error: 'Conteneur non trouvé' });
        }
        
        if (conteneur.statut === 'cloture') {
            return res.status(400).json({ error: 'Impossible d\'affecter des marchandises à un conteneur clôturé' });
        }
        
        // Mettre à jour les marchandises
        await query(`
            UPDATE marchandises 
            SET conteneur_id = $1, 
                statut = 'affecte',
                date_ajout_conteneur = CURRENT_DATE
            WHERE id = ANY($2::int[]) 
            AND conteneur_id IS NULL
        `, [req.params.id, marchandise_ids]);
        
        // Mettre à jour la capacité du conteneur
        await updateConteneurCapacite(req.params.id);
        
        // Notification temps réel
        req.io.emit('marchandises:assigned', {
            conteneur_id: req.params.id,
            marchandise_ids
        });
        
        res.json({ success: true });
        
    } catch (error) {
        logger.error('Erreur affectation marchandises:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

/**
 * GET /api/conteneurs/:id/export-manifest
 * Exporter le manifeste en PDF
 */
router.get('/:id/export-manifest', async (req, res) => {
    try {
        const result = await pdfService.generateManifest(req.params.id);
        
        res.json({
            filename: result.filename,
            url: `/api/download/${result.filename}`
        });
        
    } catch (error) {
        logger.error('Erreur export manifeste:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

/**
 * Fonction utilitaire pour mettre à jour la capacité d'un conteneur
 */
async function updateConteneurCapacite(conteneurId) {
    try {
        const result = await query(`
            SELECT 
                COALESCE(SUM(poids), 0) as poids_total,
                COALESCE(SUM(volume), 0) as volume_total
            FROM marchandises
            WHERE conteneur_id = $1
        `, [conteneurId]);
        
        await db.update('conteneurs', conteneurId, {
            capacite_poids_utilise: result.rows[0].poids_total,
            capacite_volume_utilise: result.rows[0].volume_total
        });
        
    } catch (error) {
        logger.error('Erreur mise à jour capacité conteneur:', error);
    }
}

module.exports = router;