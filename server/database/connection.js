/**
 * Module de gestion de connexion à PostgreSQL avec pool de connexions optimisé
 */
const { Pool } = require('pg');
const { logger } = require('../../shared/logger');

// Configuration optimisée du pool
const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'import_export_db',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',

    // Configuration optimisée pour performance
    max: 20,                      // Maximum de connexions
    min: 5,                       // Minimum de connexions maintenues
    idleTimeoutMillis: 30000,     // 30 secondes avant fermeture connexion idle
    connectionTimeoutMillis: 2000, // 2 secondes timeout connexion

    // Optimisations PostgreSQL
    statement_timeout: 30000,      // 30 secondes max par requête
    query_timeout: 30000,

    // Options de connexion
    application_name: 'ImportExportManager',
    keepAlive: true,
    keepAliveInitialDelayMillis: 10000
});

// Monitoring du pool - Supprimer les logs trop verbeux
pool.on('error', (err) => {
    logger.error('Erreur critique PostgreSQL:', err);
    process.exit(-1);
});

// Statistiques du pool (pour debug uniquement)
let queryCount = 0;
let slowQueryCount = 0;

// Cache pour les requêtes préparées
const preparedStatements = new Map();

// Fonction query optimisée avec cache de requêtes préparées
const query = async (text, params = []) => {
    const start = Date.now();
    queryCount++;

    try {
        const result = await pool.query(text, params);
        const duration = Date.now() - start;

        // Log uniquement les requêtes très lentes (>500ms)
        if (duration > 500) {
            slowQueryCount++;
            logger.warn(`Requête lente (${duration}ms): ${text.substring(0, 100)}...`);
        }

        return result;
    } catch (error) {
        const duration = Date.now() - start;
        logger.error('Erreur SQL', {
            query: text.substring(0, 200),
            error: error.message,
            duration
        });
        throw error;
    }
};

// Fonction pour requêtes préparées (plus rapide pour requêtes répétées)
const queryPrepared = async (name, text, params = []) => {
    if (!preparedStatements.has(name)) {
        preparedStatements.set(name, text);
    }

    const start = Date.now();
    try {
        const result = await pool.query({
            name,
            text: preparedStatements.get(name),
            values: params
        });

        const duration = Date.now() - start;
        return result;
    } catch (error) {
        logger.error(`Erreur requête préparée ${name}:`, error.message);
        throw error;
    }
};

// Fonction pour obtenir un client (pour les transactions)
async function getClient() {
    const client = await pool.connect();
    const query = client.query;
    const release = client.release;

    // Timeout après 5 secondes
    const timeout = setTimeout(() => {
        logger.error('Client PostgreSQL bloqué depuis plus de 5 secondes');
    }, 5000);

    // Monkey patch pour le log et le nettoyage
    client.query = (...args) => {
        return query.apply(client, args);
    };

    client.release = () => {
        clearTimeout(timeout);
        return release.apply(client);
    };

    return client;
}

// Transaction helper amélioré
const transaction = async (callback) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const result = await callback(client);
        await client.query('COMMIT');
        return result;
    } catch (error) {
        await client.query('ROLLBACK');
        logger.error('Transaction échouée', {
            error: error.message
        });
        throw error;
    } finally {
        client.release();
    }
};

// Fonction pour exécuter plusieurs requêtes en batch
const batchQuery = async (queries) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const results = [];

        for (const { text, params } of queries) {
            const result = await client.query(text, params || []);
            results.push(result);
        }

        await client.query('COMMIT');
        return results;
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
};

// Test de connexion au démarrage
const testConnection = async () => {
    try {
        const result = await query('SELECT NOW() as time');
        logger.info('Connexion à PostgreSQL réussie', { time: result.rows[0].time });

        // Créer les index manquants pour optimiser les performances
        await createOptimizationIndexes();

        return true;
    } catch (error) {
        logger.error('Impossible de se connecter à PostgreSQL:', error);
        return false;
    }
};

// Créer des index pour optimiser les requêtes fréquentes
const createOptimizationIndexes = async () => {
    const indexes = [
        'CREATE INDEX IF NOT EXISTS idx_marchandises_client_date ON marchandises(client_id, date_reception DESC)',
        'CREATE INDEX IF NOT EXISTS idx_paiements_client_date ON paiements(client_id, date_paiement DESC)',
        'CREATE INDEX IF NOT EXISTS idx_conteneurs_statut ON conteneurs(statut)',
        'CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(destinataire_id, lu)', // ✅ CORRIGÉ
        'CREATE INDEX IF NOT EXISTS idx_clients_created ON clients(created_at DESC)'
    ];

    try {
        for (const idx of indexes) {
            await query(idx);
        }
        logger.info('Index d\'optimisation créés/vérifiés');
    } catch (error) {
        logger.warn('Erreur création index:', error.message);
    }
};

// Fonction pour obtenir les stats du pool (debug)
const getPoolStats = () => ({
    total: pool.totalCount,
    idle: pool.idleCount,
    waiting: pool.waitingCount,
    queryCount,
    slowQueryCount
});

// Fermeture propre du pool
const closePool = async () => {
    try {
        await pool.end();
        logger.info('Pool de connexions PostgreSQL fermé');
    } catch (error) {
        logger.error('Erreur fermeture pool:', error);
    }
};

// Gestionnaire pour fermeture propre de l'application
process.on('SIGINT', async () => {
    await closePool();
    process.exit(0);
});


// =============================================
// HELPERS CRUD (pour la compatibilité)
// =============================================
const db = {
    async findOne(table, conditions = {}) {
        const keys = Object.keys(conditions);
        const values = Object.values(conditions);
        const whereClause = keys.length > 0 ? `WHERE ${keys.map((key, i) => `"${key}" = $${i + 1}`).join(' AND ')}` : '';
        const sql = `SELECT * FROM "${table}" ${whereClause} LIMIT 1`;
        const result = await query(sql, values);
        return result.rows[0];
    },
    async findMany(table, conditions = {}, options = {}) {
        const { fields = '*', orderBy = 'id', order = 'ASC', limit = null, offset = 0 } = options;
        const keys = Object.keys(conditions);
        const values = Object.values(conditions);
        const whereClause = keys.length > 0 ? `WHERE ${keys.map((key, i) => `"${key}" = $${i + 1}`).join(' AND ')}` : '';
        let sql = `SELECT ${fields} FROM "${table}" ${whereClause} ORDER BY "${orderBy}" ${order}`;
        if (limit) sql += ` LIMIT ${limit} OFFSET ${offset}`;
        const result = await query(sql, values);
        return result.rows;
    },
    async insert(table, data) {
        const keys = Object.keys(data);
        const values = Object.values(data);
        const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
        const sql = `INSERT INTO "${table}" ("${keys.join('", "')}") VALUES (${placeholders}) RETURNING *`;
        const result = await query(sql, values);
        return result.rows[0];
    },
    async update(table, id, data) {
        const keys = Object.keys(data);
        const values = Object.values(data);
        const setClause = keys.map((key, i) => `"${key}" = $${i + 1}`).join(', ');
        const sql = `UPDATE "${table}" SET ${setClause} WHERE id = $${keys.length + 1} RETURNING *`;
        const result = await query(sql, [...values, id]);
        return result.rows[0];
    },
    async delete(table, id) {
        const sql = `DELETE FROM "${table}" WHERE id = $1 RETURNING *`;
        const result = await query(sql, [id]);
        return result.rows[0];
    }
};


// Export des fonctions principales
module.exports = {
    pool,
    query,
    queryPrepared,
    getClient,
    transaction,
    batchQuery,
    testConnection,
    getPoolStats,
    closePool,
    db
};
