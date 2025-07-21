/**
 * Routes API pour la gestion des notifications
 */

const express = require('express');
const router = express.Router();
const { query, transaction } = require('../database/connection');
const { logger } = require('../../shared/logger');
const authMiddleware = require('../middlewares/auth');

// Appliquer l'authentification à toutes les routes
router.use(authMiddleware);

/**
 * GET /api/notifications
 * Récupérer les notifications de l'utilisateur
 */
router.get('/', async (req, res) => {
    try {
        const userId = req.user.id;
        const { 
            page = 1, 
            limit = 20, 
            lue,
            type 
        } = req.query;
        
        const offset = (page - 1) * limit;
        let whereClause = 'WHERE user_id = $1';
        const params = [userId];
        let paramIndex = 2;
        
        // Filtrer par statut de lecture
        if (lue !== undefined) {
            whereClause += ` AND lue = $${paramIndex}`;
            params.push(lue === 'true');
            paramIndex++;
        }
        
        // Filtrer par type
        if (type) {
            whereClause += ` AND type = $${paramIndex}`;
            params.push(type);
            paramIndex++;
        }
        
        // Requête pour le total
        const countQuery = `
            SELECT COUNT(*) as total 
            FROM notifications 
            ${whereClause}
        `;
        
        // Requête principale
        const dataQuery = `
            SELECT *
            FROM notifications
            ${whereClause}
            ORDER BY created_at DESC
            LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
        `;
        
        params.push(parseInt(limit), offset);
        
        // Exécuter les requêtes en parallèle
        const [countResult, dataResult] = await Promise.all([
            query(countQuery, params.slice(0, -2)),
            query(dataQuery, params)
        ]);
        
        const total = parseInt(countResult.rows[0]?.total || 0);
        const totalNonLues = await query(
            'SELECT COUNT(*) as count FROM notifications WHERE user_id = $1 AND lue = false',
            [userId]
        );
        
        res.json({
            success: true,
            data: dataResult.rows,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / limit)
            },
            unread_count: parseInt(totalNonLues.rows[0]?.count || 0)
        });
        
    } catch (error) {
        logger.error('Erreur récupération notifications:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Erreur lors de la récupération des notifications' 
        });
    }
});

/**
 * POST /api/notifications/mark-read
 * Marquer des notifications comme lues
 */
router.post('/mark-read', async (req, res) => {
    try {
        const userId = req.user.id;
        const { notification_ids, mark_all } = req.body;
        
        let updateQuery;
        let params = [userId];
        
        if (mark_all) {
            // Marquer toutes les notifications comme lues
            updateQuery = `
                UPDATE notifications 
                SET lue = true, updated_at = CURRENT_TIMESTAMP
                WHERE user_id = $1 AND lue = false
                RETURNING id
            `;
        } else if (notification_ids && Array.isArray(notification_ids)) {
            // Marquer des notifications spécifiques
            updateQuery = `
                UPDATE notifications 
                SET lue = true, updated_at = CURRENT_TIMESTAMP
                WHERE user_id = $1 AND id = ANY($2) AND lue = false
                RETURNING id
            `;
            params.push(notification_ids);
        } else {
            return res.status(400).json({ 
                success: false, 
                error: 'Paramètres invalides' 
            });
        }
        
        const result = await query(updateQuery, params);
        
        // Émettre l'événement WebSocket pour mettre à jour le badge
        const io = req.app.get('io');
        if (io) {
            const newCount = await query(
                'SELECT COUNT(*) as count FROM notifications WHERE user_id = $1 AND lue = false',
                [userId]
            );
            
            io.to(`user-${userId}`).emit('notifications:updated', {
                unread_count: parseInt(newCount.rows[0]?.count || 0),
                marked_ids: result.rows.map(r => r.id)
            });
        }
        
        res.json({
            success: true,
            marked_count: result.rows.length,
            message: `${result.rows.length} notification(s) marquée(s) comme lue(s)`
        });
        
    } catch (error) {
        logger.error('Erreur marquage notifications:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Erreur lors du marquage des notifications' 
        });
    }
});

/**
 * DELETE /api/notifications/:id
 * Supprimer une notification
 */
router.delete('/:id', async (req, res) => {
    try {
        const userId = req.user.id;
        const notificationId = parseInt(req.params.id);
        
        const deleteQuery = `
            DELETE FROM notifications 
            WHERE id = $1 AND user_id = $2
            RETURNING id
        `;
        
        const result = await query(deleteQuery, [notificationId, userId]);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ 
                success: false, 
                error: 'Notification non trouvée' 
            });
        }
        
        res.json({
            success: true,
            message: 'Notification supprimée avec succès'
        });
        
    } catch (error) {
        logger.error('Erreur suppression notification:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Erreur lors de la suppression de la notification' 
        });
    }
});

/**
 * POST /api/notifications
 * Créer une notification (usage interne principalement)
 */
router.post('/', async (req, res) => {
    try {
        // Vérifier les droits admin
        if (req.user.role !== 'admin' && req.user.role !== 'gestionnaire') {
            return res.status(403).json({ 
                success: false, 
                error: 'Droits insuffisants' 
            });
        }
        
        const { user_id, type, titre, message, data } = req.body;
        
        if (!user_id || !type || !titre || !message) {
            return res.status(400).json({ 
                success: false, 
                error: 'Paramètres manquants' 
            });
        }
        
        const insertQuery = `
            INSERT INTO notifications (user_id, type, titre, message, data)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *
        `;
        
        const result = await query(insertQuery, [
            user_id,
            type,
            titre,
            message,
            data || {}
        ]);
        
        const notification = result.rows[0];
        
        // Émettre via WebSocket
        const io = req.app.get('io');
        if (io) {
            io.to(`user-${user_id}`).emit('nouvelle_notification', notification);
        }
        
        res.status(201).json({
            success: true,
            data: notification
        });
        
    } catch (error) {
        logger.error('Erreur création notification:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Erreur lors de la création de la notification' 
        });
    }
});

/**
 * GET /api/notifications/summary
 * Obtenir un résumé des notifications
 */
router.get('/summary', async (req, res) => {
    try {
        const userId = req.user.id;
        
        const summaryQuery = `
            SELECT 
                type,
                COUNT(*) as total,
                COUNT(*) FILTER (WHERE lue = false) as non_lues
            FROM notifications
            WHERE user_id = $1
            GROUP BY type
        `;
        
        const result = await query(summaryQuery, [userId]);
        
        const summary = {
            by_type: result.rows,
            total_unread: result.rows.reduce((sum, row) => sum + parseInt(row.non_lues), 0)
        };
        
        res.json({
            success: true,
            data: summary
        });
        
    } catch (error) {
        logger.error('Erreur résumé notifications:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Erreur lors de la récupération du résumé' 
        });
    }
});

module.exports = router;