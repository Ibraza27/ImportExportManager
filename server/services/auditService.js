/**
 * Service d'audit
 * Enregistre toutes les actions importantes dans la base de données
 */

const { db, query } = require('../database/connection');
const { logger } = require('../../shared/logger');

class AuditService {
    /**
     * Enregistrer une action dans le journal d'audit
     */
    async log(auditData) {
        try {
            const {
                utilisateur_id,
                action,
                entite,
                entite_id,
                anciennes_valeurs,
                nouvelles_valeurs,
                ip_address,
                user_agent
            } = auditData;
            
            await db.insert('logs_audit', {
                utilisateur_id,
                action,
                entite,
                entite_id,
                anciennes_valeurs: anciennes_valeurs ? JSON.stringify(anciennes_valeurs) : null,
                nouvelles_valeurs: nouvelles_valeurs ? JSON.stringify(nouvelles_valeurs) : null,
                ip_address,
                user_agent
            });
            
            logger.debug(`Audit: ${action} sur ${entite} #${entite_id} par utilisateur #${utilisateur_id}`);
            
        } catch (error) {
            logger.error('Erreur enregistrement audit:', error);
            // Ne pas propager l'erreur pour ne pas bloquer l'opération principale
        }
    }
    
    /**
     * Récupérer l'historique d'audit
     */
    async getHistory(filters = {}) {
        try {
            let queryText = `
                SELECT 
                    la.*,
                    u.nom as utilisateur_nom,
                    u.prenom as utilisateur_prenom
                FROM logs_audit la
                LEFT JOIN utilisateurs u ON la.utilisateur_id = u.id
                WHERE 1=1
            `;
            
            const params = [];
            let paramIndex = 1;
            
            // Filtres
            if (filters.utilisateur_id) {
                queryText += ` AND la.utilisateur_id = $${paramIndex}`;
                params.push(filters.utilisateur_id);
                paramIndex++;
            }
            
            if (filters.action) {
                queryText += ` AND la.action = $${paramIndex}`;
                params.push(filters.action);
                paramIndex++;
            }
            
            if (filters.entite) {
                queryText += ` AND la.entite = $${paramIndex}`;
                params.push(filters.entite);
                paramIndex++;
            }
            
            if (filters.entite_id) {
                queryText += ` AND la.entite_id = $${paramIndex}`;
                params.push(filters.entite_id);
                paramIndex++;
            }
            
            if (filters.date_debut) {
                queryText += ` AND la.created_at >= $${paramIndex}`;
                params.push(filters.date_debut);
                paramIndex++;
            }
            
            if (filters.date_fin) {
                queryText += ` AND la.created_at <= $${paramIndex}`;
                params.push(filters.date_fin);
                paramIndex++;
            }
            
            // Tri et pagination
            queryText += ' ORDER BY la.created_at DESC';
            
            if (filters.limit) {
                queryText += ` LIMIT ${filters.limit}`;
                if (filters.offset) {
                    queryText += ` OFFSET ${filters.offset}`;
                }
            }
            
            const result = await query(queryText, params);
            return result.rows;
            
        } catch (error) {
            logger.error('Erreur récupération historique audit:', error);
            throw error;
        }
    }
    
    /**
     * Récupérer l'historique d'une entité spécifique
     */
    async getEntityHistory(entite, entite_id) {
        return this.getHistory({ entite, entite_id });
    }
    
    /**
     * Récupérer l'historique d'un utilisateur
     */
    async getUserHistory(utilisateur_id) {
        return this.getHistory({ utilisateur_id });
    }
    
    /**
     * Nettoyer les anciens logs
     */
    async cleanup(daysToKeep = 90) {
        try {
            const result = await query(`
                DELETE FROM logs_audit
                WHERE created_at < CURRENT_DATE - INTERVAL '$1 days'
            `, [daysToKeep]);
            
            logger.info(`Nettoyage audit: ${result.rowCount} entrées supprimées`);
            return result.rowCount;
            
        } catch (error) {
            logger.error('Erreur nettoyage audit:', error);
            throw error;
        }
    }
    
    /**
     * Générer un rapport d'audit
     */
    async generateReport(startDate, endDate) {
        try {
            // Actions par utilisateur
            const userActivity = await query(`
                SELECT 
                    u.nom || ' ' || u.prenom as utilisateur,
                    COUNT(*) as total_actions,
                    COUNT(DISTINCT la.entite) as entites_modifiees,
                    COUNT(DISTINCT DATE(la.created_at)) as jours_actifs
                FROM logs_audit la
                JOIN utilisateurs u ON la.utilisateur_id = u.id
                WHERE la.created_at BETWEEN $1 AND $2
                GROUP BY u.id, u.nom, u.prenom
                ORDER BY total_actions DESC
            `, [startDate, endDate]);
            
            // Actions par type
            const actionTypes = await query(`
                SELECT 
                    action,
                    COUNT(*) as nombre
                FROM logs_audit
                WHERE created_at BETWEEN $1 AND $2
                GROUP BY action
                ORDER BY nombre DESC
            `, [startDate, endDate]);
            
            // Entités les plus modifiées
            const topEntities = await query(`
                SELECT 
                    entite,
                    COUNT(*) as modifications
                FROM logs_audit
                WHERE created_at BETWEEN $1 AND $2
                GROUP BY entite
                ORDER BY modifications DESC
                LIMIT 10
            `, [startDate, endDate]);
            
            return {
                period: { startDate, endDate },
                userActivity: userActivity.rows,
                actionTypes: actionTypes.rows,
                topEntities: topEntities.rows
            };
            
        } catch (error) {
            logger.error('Erreur génération rapport audit:', error);
            throw error;
        }
    }
}

module.exports = new AuditService();