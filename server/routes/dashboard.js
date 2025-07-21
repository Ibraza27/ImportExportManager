/**
 * Routes optimisées pour le dashboard
 */
const express = require('express');
const router = express.Router();
const { query, batchQuery } = require('../database/connection');
const { logger } = require('../../shared/logger');
const authMiddleware = require('../middlewares/auth');

// Cache mémoire simple pour les données qui changent peu
const cache = new Map();
const CACHE_DURATION = 30 * 1000; // 30 secondes

// Middleware de cache
const cacheMiddleware = (key, duration = CACHE_DURATION) => {
    return async (req, res, next) => {
        const cached = cache.get(key);
        if (cached && cached.timestamp > Date.now() - duration) {
            logger.debug(`Cache hit for ${key}`);
            return res.json(cached.data);
        }
        logger.debug(`Cache miss for ${key}, fetching fresh data`);
        next();
    };
};

// Fonction pour mettre en cache
const setCache = (key, data) => {
    cache.set(key, {
        data,
        timestamp: Date.now()
    });
    logger.debug(`Data cached for key: ${key}`);
};

// Appliquer l'authentification à toutes les routes
router.use(authMiddleware);

/**
 * GET /api/dashboard/all
 * Route unifiée pour récupérer toutes les données du dashboard en une seule requête
 */
router.get('/all', async (req, res) => {
    try {
        const userId = req.user.id;
        const { period = '7days' } = req.query;

        // Calcul des dates selon la période
        let dateFilter;
        switch(period) {
            case 'today':
                dateFilter = "DATE(created_at) = CURRENT_DATE";
                break;
            case '7days':
                dateFilter = "created_at >= CURRENT_DATE - INTERVAL '7 days'";
                break;
            case '30days':
                dateFilter = "created_at >= CURRENT_DATE - INTERVAL '30 days'";
                break;
            case 'year':
                dateFilter = "created_at >= CURRENT_DATE - INTERVAL '1 year'";
                break;
            default:
                dateFilter = "1=1"; // Pas de filtrage par défaut
        }

        // Exécution de toutes les requêtes en parallèle avec batchQuery
        const queries = [
            // Stats générales
            {
                text: `
                    SELECT
                        (SELECT COUNT(*) FROM clients WHERE statut = 'actif') as total_clients,
                        (SELECT COUNT(*) FROM marchandises WHERE ${dateFilter}) as total_marchandises,
                        (SELECT COUNT(*) FROM conteneurs WHERE statut = 'actif') as conteneurs_actifs,
                        (SELECT COALESCE(SUM(montant_paye), 0) FROM paiements WHERE ${dateFilter} AND statut = 'valide') as total_paiements,
                        (SELECT COUNT(*) FROM notifications WHERE destinataire_id = $1 AND lu = false) as notifications_non_lues
                `,
                params: [userId]
            },

            // Statistiques clients
            {
                text: `
                    SELECT
                        COUNT(*) as total,
                        COUNT(CASE WHEN created_at > CURRENT_DATE - INTERVAL '30 days' THEN 1 END) as nouveaux
                    FROM clients
                    WHERE statut = 'actif'
                `
            },

            // Statistiques conteneurs
            {
                text: `
                    SELECT
                        COUNT(CASE WHEN statut = 'en_preparation' THEN 1 END) as en_preparation,
                        COUNT(CASE WHEN statut = 'en_transit' THEN 1 END) as en_transit,
                        COUNT(CASE WHEN statut = 'arrive' THEN 1 END) as arrives,
                        COUNT(*) as total
                    FROM conteneurs
                    WHERE date_creation > CURRENT_DATE - INTERVAL '90 days'
                `
            },

            // Statistiques financières
            {
                text: `
                    SELECT
                        COALESCE(SUM(montant_total_du), 0) as total_facture,
                        COALESCE(SUM(montant_paye), 0) as total_paye
                    FROM paiements WHERE statut = 'valide'
                `
            },

            // Tendances
            {
                text: `
                    WITH current_month AS (
                        SELECT COUNT(*) as count
                        FROM clients
                        WHERE created_at >= DATE_TRUNC('month', CURRENT_DATE)
                    ),
                    previous_month AS (
                        SELECT COUNT(*) as count
                        FROM clients
                        WHERE created_at >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month')
                        AND created_at < DATE_TRUNC('month', CURRENT_DATE)
                    )
                    SELECT
                        CASE
                            WHEN previous_month.count = 0 THEN 100
                            ELSE ROUND((((current_month.count::float - previous_month.count) / previous_month.count) * 100)::numeric, 1)
                        END as client_trend
                    FROM current_month, previous_month
                `
            },

            // Derniers clients (top 5)
            {
                text: `
                    SELECT
                        c.id, c.nom, c.prenom, c.telephone_principal, c.email,
                        COUNT(DISTINCT m.id) as total_colis,
                        COALESCE(SUM(m.cout_total), 0) as total_du,
                        COALESCE(SUM(p.montant_paye), 0) as total_paye,
                        c.created_at
                    FROM clients c
                    LEFT JOIN marchandises m ON m.client_id = c.id
                    LEFT JOIN paiements p ON p.client_id = c.id AND p.statut = 'valide'
                    GROUP BY c.id
                    ORDER BY c.created_at DESC
                    LIMIT 5
                `
            },

            // Dernières marchandises (top 10)
            {
                text: `
                    SELECT
                        m.id, m.numero_tracking, m.description, m.poids, m.statut,
                        m.date_reception, m.cout_total,
                        c.nom as client_nom, c.prenom as client_prenom,
                        cn.numero_conteneur
                    FROM marchandises m
                    LEFT JOIN clients c ON m.client_id = c.id
                    LEFT JOIN conteneurs cn ON m.conteneur_id = cn.id
                    ORDER BY m.date_reception DESC
                    LIMIT 10
                `
            },

            // Derniers paiements (top 10)
            {
                text: `
                    SELECT
                        p.id, p.montant_paye, p.date_paiement, p.mode_paiement,
                        p.reference, p.statut,
                        c.nom as client_nom, c.prenom as client_prenom
                    FROM paiements p
                    LEFT JOIN clients c ON p.client_id = c.id
                    WHERE p.statut = 'valide'
                    ORDER BY p.date_paiement DESC
                    LIMIT 10
                `
            },

            // Conteneurs actifs
            {
                text: `
                    SELECT
                        cn.id, cn.numero_conteneur, cn.destination_pays, cn.statut,
                        cn.date_creation, cn.date_depart_prevu,
                        COUNT(DISTINCT m.id) as nombre_colis,
                        COUNT(DISTINCT m.client_id) as nombre_clients
                    FROM conteneurs cn
                    LEFT JOIN marchandises m ON m.conteneur_id = cn.id
                    WHERE cn.statut IN ('actif', 'en_preparation')
                    GROUP BY cn.id
                    ORDER BY cn.date_creation DESC
                    LIMIT 5
                `
            },

            // Données pour les graphiques
            {
                text: `
                    WITH date_series AS (
                        SELECT generate_series(
                            CURRENT_DATE - INTERVAL '30 days',
                            CURRENT_DATE,
                            '1 day'::interval
                        )::date AS date
                    ),
                    marchandises_data AS (
                        SELECT
                            DATE(date_reception) as date,
                            COUNT(*) as count
                        FROM marchandises
                        WHERE ${dateFilter}
                        GROUP BY DATE(date_reception)
                    ),
                    paiements_data AS (
                        SELECT
                            DATE(date_paiement) as date,
                            COALESCE(SUM(montant_paye), 0) as total
                        FROM paiements
                        WHERE ${dateFilter} AND statut = 'valide'
                        GROUP BY DATE(date_paiement)
                    )
                    SELECT
                        ds.date,
                        COALESCE(md.count, 0) as marchandises,
                        COALESCE(pd.total, 0) as paiements
                    FROM date_series ds
                    LEFT JOIN marchandises_data md ON ds.date = md.date
                    LEFT JOIN paiements_data pd ON ds.date = pd.date
                    ORDER BY ds.date ASC
                `
            },

            // Notifications récentes
            {
                text: `
                    SELECT
                        id, type, titre, message, lue, created_at
                    FROM notifications
                    WHERE destinataire_id = $1
                    ORDER BY created_at DESC
                    LIMIT 10
                `,
                params: [userId]
            }
        ];

        // Exécution en batch
        const results = await batchQuery(queries);

        // Construction de la réponse
        const response = {
            stats: {
                general: results[0].rows[0],
                clients: results[1].rows[0],
                conteneurs: results[2].rows[0],
                finances: results[3].rows[0],
                tendances: results[4].rows[0]
            },
            clients: results[5].rows,
            marchandises: results[6].rows,
            paiements: results[7].rows,
            conteneurs: results[8].rows,
            charts: {
                data: results[9].rows
            },
            notifications: results[10].rows,
            timestamp: new Date().toISOString()
        };

        res.json({ success: true, data: response });

    } catch (error) {
        logger.error('Erreur dashboard unifié:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

/**
 * GET /api/dashboard/stats
 * Stats uniquement (avec cache)
 */
router.get('/stats', cacheMiddleware('stats', 10000), async (req, res) => {
    try {
        const stats = await query(`
            SELECT
                (SELECT COUNT(*) FROM clients WHERE statut = 'actif') as total_clients,
                (SELECT COUNT(*) FROM marchandises WHERE DATE(created_at) = CURRENT_DATE) as marchandises_jour,
                (SELECT COUNT(*) FROM conteneurs WHERE statut = 'actif') as conteneurs_actifs,
                (SELECT COALESCE(SUM(montant_paye), 0) FROM paiements WHERE DATE(date_paiement) = CURRENT_DATE AND statut = 'valide') as paiements_jour
        `);

        const clientStats = await query(`
            SELECT
                COUNT(*) as total,
                COUNT(CASE WHEN created_at > CURRENT_DATE - INTERVAL '30 days' THEN 1 END) as nouveaux
            FROM clients
            WHERE statut = 'actif'
        `);

        const conteneurStats = await query(`
            SELECT
                COUNT(CASE WHEN statut = 'en_preparation' THEN 1 END) as en_preparation,
                COUNT(CASE WHEN statut = 'en_transit' THEN 1 END) as en_transit,
                COUNT(CASE WHEN statut = 'arrive' THEN 1 END) as arrives,
                COUNT(*) as total
            FROM conteneurs
            WHERE date_creation > CURRENT_DATE - INTERVAL '90 days'
        `);

        const financeStats = await query(`
            SELECT
                COALESCE(SUM(montant_total_du), 0) as total_facture,
                COALESCE(SUM(montant_paye), 0) as total_paye
            FROM paiements WHERE statut = 'valide'
        `);

        const tendances = await query(`
            WITH current_month AS (
                SELECT COUNT(*) as count
                FROM clients
                WHERE created_at >= DATE_TRUNC('month', CURRENT_DATE)
            ),
            previous_month AS (
                SELECT COUNT(*) as count
                FROM clients
                WHERE created_at >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month')
                AND created_at < DATE_TRUNC('month', CURRENT_DATE)
            )
            SELECT
                CASE
                    WHEN previous_month.count = 0 THEN 100
                    ELSE ROUND((((current_month.count::float - previous_month.count) / previous_month.count) * 100)::numeric, 1)
                END as client_trend
            FROM current_month, previous_month
        `);

        const data = {
            general: stats.rows[0],
            clients: clientStats.rows[0],
            conteneurs: conteneurStats.rows[0],
            finances: financeStats.rows[0],
            tendances: tendances.rows[0]
        };

        setCache('stats', data);
        res.json(data);

    } catch (error) {
        logger.error('Erreur stats dashboard:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

/**
 * GET /api/dashboard/charts
 * Données graphiques optimisées
 */
router.get('/charts', async (req, res) => {
    try {
        const { period = '7days' } = req.query;

        // Calcul des dates selon la période
        let interval;
        let dateFilter;
        switch(period) {
            case '24hours':
                interval = '24 hours';
                dateFilter = "DATE(date_paiement) >= CURRENT_DATE - INTERVAL '1 day'";
                break;
            case '7days':
                interval = '7 days';
                dateFilter = "DATE(date_paiement) >= CURRENT_DATE - INTERVAL '7 days'";
                break;
            case '30days':
                interval = '30 days';
                dateFilter = "DATE(date_paiement) >= CURRENT_DATE - INTERVAL '30 days'";
                break;
            case '12months':
                interval = '12 months';
                dateFilter = "DATE(date_paiement) >= CURRENT_DATE - INTERVAL '12 months'";
                break;
            default:
                interval = '7 days';
                dateFilter = "DATE(date_paiement) >= CURRENT_DATE - INTERVAL '7 days'";
        }

        // Requête optimisée pour les graphiques
        const chartData = await query(`
            WITH date_series AS (
                SELECT generate_series(
                    CURRENT_DATE - INTERVAL '${interval}',
                    CURRENT_DATE,
                    '1 day'::interval
                )::date AS date
            ),
            marchandises_data AS (
                SELECT
                    DATE(date_reception) as date,
                    COUNT(*) as count
                FROM marchandises
                WHERE DATE(date_reception) >= CURRENT_DATE - INTERVAL '${interval}'
                GROUP BY DATE(date_reception)
            ),
            paiements_data AS (
                SELECT
                    DATE(date_paiement) as date,
                    COALESCE(SUM(montant_paye), 0) as total
                FROM paiements
                WHERE ${dateFilter} AND statut = 'valide'
                GROUP BY DATE(date_paiement)
            ),
            conteneurs_data AS (
                SELECT
                    DATE(date_creation) as date,
                    COUNT(*) as count
                FROM conteneurs
                WHERE DATE(date_creation) >= CURRENT_DATE - INTERVAL '${interval}'
                GROUP BY DATE(date_creation)
            )
            SELECT
                ds.date,
                COALESCE(md.count, 0) as marchandises,
                COALESCE(pd.total, 0) as paiements,
                COALESCE(cd.count, 0) as conteneurs
            FROM date_series ds
            LEFT JOIN marchandises_data md ON ds.date = md.date
            LEFT JOIN paiements_data pd ON ds.date = pd.date
            LEFT JOIN conteneurs_data cd ON ds.date = cd.date
            ORDER BY ds.date ASC
        `);

        // Top destinations
        const destinationsData = await query(`
            SELECT
                destination_pays as pays,
                COUNT(*) as total
            FROM conteneurs
            WHERE date_creation > CURRENT_DATE - INTERVAL '${interval}'
            GROUP BY destination_pays
            ORDER BY total DESC
            LIMIT 6
        `);

        res.json({
            period,
            timeSeries: chartData.rows.map(row => ({
                date: row.date,
                marchandises: parseInt(row.marchandises),
                paiements: parseFloat(row.paiements),
                conteneurs: parseInt(row.conteneurs)
            })),
            destinations: destinationsData.rows.map(row => ({
                pays: row.pays,
                total: parseInt(row.total)
            }))
        });

    } catch (error) {
        logger.error('Erreur charts dashboard:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

/**
 * GET /api/dashboard/activity
 * Récupérer l'activité récente (conservé pour compatibilité)
 */
router.get('/activity', async (req, res) => {
    try {
        const activities = await query(`
            SELECT
                action,
                entite,
                entite_id,
                utilisateur_id,
                created_at,
                u.prenom,
                u.nom
            FROM logs_audit a
            JOIN utilisateurs u ON a.utilisateur_id = u.id
            ORDER BY a.created_at DESC
            LIMIT 20
        `);

        res.json(activities.rows);

    } catch (error) {
        logger.error('Erreur récupération activité:', error);
        res.status(500).json({ error: 'Erreur serveur' });
    }
});

// Nettoyer le cache périodiquement
setInterval(() => {
    const now = Date.now();
    for (const [key, value] of cache.entries()) {
        if (value.timestamp < now - CACHE_DURATION * 2) {
            cache.delete(key);
            logger.debug(`Cache cleared for key: ${key}`);
        }
    }
}, 60000); // Toutes les minutes

module.exports = router;
