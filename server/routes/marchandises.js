/**
 * Routes API pour la gestion des marchandises
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { db, query } = require('../database/connection');
const { logger } = require('../../shared/logger');
const authMiddleware = require('../middlewares/auth');
const { validateMarchandise } = require('../middlewares/validation');
const auditService = require('../services/auditService');
const barcodeService = require('../services/barcodeService');

// Configuration multer pour l'upload de photos
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(__dirname, '../../uploads/photos'));
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ 
    storage,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif|webp/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        
        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('Seules les images sont autorisées'));
        }
    }
});

// Appliquer l'authentification à toutes les routes
router.use(authMiddleware);

/**
 * GET /api/marchandises
 * Récupérer toutes les marchandises
 */
router.get('/', async (req, res) => {
    try {
        const { 
            page = 1, 
            limit = 25, 
            search, 
            statut, 
            client_id,
            conteneur_id,
            type_marchandise,
            date_debut,
            date_fin,
            sort = 'date_reception:desc' 
        } = req.query;
        
        // Construire la requête
        let queryText = `
            SELECT m.*, 
                   c.nom as client_nom, 
                   c.prenom as client_prenom,
                   c.telephone_principal as client_telephone,
                   cnt.numero_conteneur
            FROM marchandises m
            LEFT JOIN clients c ON m.client_id = c.id
            LEFT JOIN conteneurs cnt ON m.conteneur_id = cnt.id
            WHERE 1=1
        `;
        
        const params = [];
        let paramIndex = 1;
        
        // Filtres
        if (search) {
            queryText += ` AND (m.code_barre LIKE $${paramIndex} OR m.designation ILIKE $${paramIndex} OR m.description_detaillee ILIKE $${paramIndex})`;
            params.push(`%${search}%`);
            paramIndex++;
        }
        
        if (statut) {
            queryText += ` AND m.statut = $${paramIndex}`;
            params.push(statut);
            paramIndex++;
        }
        
        if (client_id) {
            queryText += ` AND m.client_id = $${paramIndex}`;
            params.push(client_id);
            paramIndex++;
        }
        
        if (conteneur_id) {
            queryText += ` AND m.conteneur_id = $${paramIndex}`;
            params.push(conteneur_id);
            paramIndex++;
        }
        
        if (type_marchandise) {
            queryText += ` AND m.type_marchandise = $${paramIndex}`;
            params.push(type_marchandise);
            paramIndex++;
        }
        
        if (date_debut) {
            queryText += ` AND m.date_reception >= $${paramIndex}`;
            params.push(date_debut);
            paramIndex++;
        }
        
        if (date_fin) {
            queryText += ` AND m.date_reception <= $${paramIndex}`;
            params.push(date_fin);
            paramIndex++;
        }
        
        // Tri
        const [sortField, sortOrder] = sort.split(':');
        queryText += ` ORDER BY m.${sortField} ${sortOrder.toUpperCase()}`;
        
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
        logger.error('Erreur récupération marchandises:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

/**
 * GET /api/marchandises/:id
 * Récupérer une marchandise par ID
 */
router.get('/:id', async (req, res) => {
    try {
        const marchandise = await query(`
            SELECT m.*, 
                   c.nom as client_nom, 
                   c.prenom as client_prenom,
                   c.email as client_email,
                   c.telephone_principal as client_telephone,
                   cnt.numero_conteneur,
                   cnt.destination_ville,
                   cnt.destination_pays
            FROM marchandises m
            LEFT JOIN clients c ON m.client_id = c.id
            LEFT JOIN conteneurs cnt ON m.conteneur_id = cnt.id
            WHERE m.id = $1
        `, [req.params.id]);
        
        if (marchandise.rows.length === 0) {
            return res.status(404).json({ error: 'Marchandise non trouvée' });
        }
        
        res.json(marchandise.rows[0]);
        
    } catch (error) {
        logger.error('Erreur récupération marchandise:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

/**
 * POST /api/marchandises
 * Créer une nouvelle marchandise
 */
router.post('/', validateMarchandise, async (req, res) => {
    try {
        // Générer le code-barres
        const code_barre = await barcodeService.generateBarcode('marchandise');
        
        // Calculer les coûts
        const cout_total = (req.body.cout_transport || 0) + 
                          (req.body.cout_manutention || 0) + 
                          (req.body.cout_assurance || 0) + 
                          (req.body.cout_stockage || 0);
        
        const newMarchandise = await db.insert('marchandises', {
            ...req.body,
            code_barre,
            cout_total,
            created_by: req.user.id
        });
        
        // Log d'audit
        await auditService.log({
            utilisateur_id: req.user.id,
            action: 'CREATE',
            entite: 'marchandises',
            entite_id: newMarchandise.id,
            nouvelles_valeurs: newMarchandise
        });
        
        // Notification temps réel
        req.io.emit('marchandise:created', newMarchandise);
        
        // Si affectée à un conteneur, mettre à jour les capacités
        if (newMarchandise.conteneur_id) {
            await updateConteneurCapacite(newMarchandise.conteneur_id);
        }
        
        res.status(201).json(newMarchandise);
        
    } catch (error) {
        logger.error('Erreur création marchandise:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

/**
 * PUT /api/marchandises/:id
 * Mettre à jour une marchandise
 */
router.put('/:id', validateMarchandise, async (req, res) => {
    try {
        // Récupérer l'ancienne marchandise
        const oldMarchandise = await db.findOne('marchandises', { id: req.params.id });
        
        if (!oldMarchandise) {
            return res.status(404).json({ error: 'Marchandise non trouvée' });
        }
        
        // Interdire la modification du code-barres
        delete req.body.code_barre;
        
        const updatedMarchandise = await db.update('marchandises', req.params.id, req.body);
        
        // Log d'audit
        await auditService.log({
            utilisateur_id: req.user.id,
            action: 'UPDATE',
            entite: 'marchandises',
            entite_id: updatedMarchandise.id,
            anciennes_valeurs: oldMarchandise,
            nouvelles_valeurs: updatedMarchandise
        });
        
        // Notification temps réel
        req.io.emit('marchandise:updated', updatedMarchandise);
        
        // Mettre à jour les capacités des conteneurs si changement
        if (oldMarchandise.conteneur_id !== updatedMarchandise.conteneur_id) {
            if (oldMarchandise.conteneur_id) {
                await updateConteneurCapacite(oldMarchandise.conteneur_id);
            }
            if (updatedMarchandise.conteneur_id) {
                await updateConteneurCapacite(updatedMarchandise.conteneur_id);
            }
        }
        
        res.json(updatedMarchandise);
        
    } catch (error) {
        logger.error('Erreur mise à jour marchandise:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

/**
 * DELETE /api/marchandises/:id
 * Supprimer une marchandise
 */
router.delete('/:id', async (req, res) => {
    try {
        const marchandise = await db.findOne('marchandises', { id: req.params.id });
        
        if (!marchandise) {
            return res.status(404).json({ error: 'Marchandise non trouvée' });
        }
        
        // Vérifier si elle n'est pas déjà expédiée
        if (['en_transit', 'arrive', 'livre'].includes(marchandise.statut)) {
            return res.status(400).json({ 
                error: 'Impossible de supprimer une marchandise déjà expédiée' 
            });
        }
        
        await db.delete('marchandises', req.params.id);
        
        // Log d'audit
        await auditService.log({
            utilisateur_id: req.user.id,
            action: 'DELETE',
            entite: 'marchandises',
            entite_id: req.params.id,
            anciennes_valeurs: marchandise
        });
        
        // Notification temps réel
        req.io.emit('marchandise:deleted', { id: req.params.id });
        
        // Mettre à jour la capacité du conteneur
        if (marchandise.conteneur_id) {
            await updateConteneurCapacite(marchandise.conteneur_id);
        }
        
        res.json({ message: 'Marchandise supprimée avec succès' });
        
    } catch (error) {
        logger.error('Erreur suppression marchandise:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

/**
 * POST /api/marchandises/:id/photos
 * Ajouter des photos à une marchandise
 */
router.post('/:id/photos', upload.array('photos', 5), async (req, res) => {
    try {
        const marchandise = await db.findOne('marchandises', { id: req.params.id });
        
        if (!marchandise) {
            return res.status(404).json({ error: 'Marchandise non trouvée' });
        }
        
        // Ajouter les nouvelles photos
        const photos = marchandise.photos || [];
        const newPhotos = req.files.map(file => ({
            filename: file.filename,
            originalname: file.originalname,
            path: `/uploads/photos/${file.filename}`,
            size: file.size,
            uploadedAt: new Date()
        }));
        
        photos.push(...newPhotos);
        
        // Mettre à jour la marchandise
        await db.update('marchandises', req.params.id, { photos });
        
        res.json({ photos: newPhotos });
        
    } catch (error) {
        logger.error('Erreur upload photos:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

/**
 * POST /api/marchandises/:id/scan
 * Scanner une marchandise
 */
router.post('/:id/scan', async (req, res) => {
    try {
        const { location, action } = req.body;
        
        const marchandise = await db.findOne('marchandises', { id: req.params.id });
        
        if (!marchandise) {
            return res.status(404).json({ error: 'Marchandise non trouvée' });
        }
        
        // Ajouter à l'historique de scan
        const scan_history = marchandise.scan_history || [];
        scan_history.push({
            timestamp: new Date(),
            location,
            action,
            user_id: req.user.id,
            user_name: req.user.nom
        });
        
        // Mettre à jour le statut selon l'action
        let newStatus = marchandise.statut;
        switch (action) {
            case 'reception':
                newStatus = 'receptionne';
                break;
            case 'affectation':
                newStatus = 'affecte';
                break;
            case 'chargement':
                newStatus = 'en_conteneur';
                break;
            case 'livraison':
                newStatus = 'livre';
                break;
        }
        
        await db.update('marchandises', req.params.id, {
            scan_history,
            statut: newStatus
        });
        
        // Notification temps réel
        req.io.emit('marchandise:scanned', {
            id: req.params.id,
            action,
            location,
            newStatus
        });
        
        res.json({ success: true, newStatus });
        
    } catch (error) {
        logger.error('Erreur scan marchandise:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

/**
 * GET /api/marchandises/barcode/:code
 * Rechercher une marchandise par code-barres
 */
router.get('/barcode/:code', async (req, res) => {
    try {
        const marchandise = await query(`
            SELECT m.*, 
                   c.nom as client_nom, 
                   c.prenom as client_prenom,
                   cnt.numero_conteneur
            FROM marchandises m
            LEFT JOIN clients c ON m.client_id = c.id
            LEFT JOIN conteneurs cnt ON m.conteneur_id = cnt.id
            WHERE m.code_barre = $1
        `, [req.params.code]);
        
        if (marchandise.rows.length === 0) {
            return res.status(404).json({ error: 'Marchandise non trouvée' });
        }
        
        res.json(marchandise.rows[0]);
        
    } catch (error) {
        logger.error('Erreur recherche par code-barres:', error);
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