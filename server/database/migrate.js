
/**
 * Script de migration de la base de données
 * Applique les mises à jour de schéma nécessaires
 */

require('dotenv').config({ path: '../.env' });
const { query, testConnection } = require('./connection');
const fs = require('fs').promises;
const path = require('path');
const { logger } = require('../../shared/logger');

// Table pour suivre les migrations
const MIGRATIONS_TABLE = 'schema_migrations';

/**
 * Créer la table des migrations si elle n'existe pas
 */
async function createMigrationsTable() {
    await query(`
        CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE} (
            id SERIAL PRIMARY KEY,
            version VARCHAR(255) UNIQUE NOT NULL,
            executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    `);
}

/**
 * Vérifier si une migration a déjà été exécutée
 */
async function isMigrationExecuted(version) {
    const result = await query(
        `SELECT COUNT(*) FROM ${MIGRATIONS_TABLE} WHERE version = $1`,
        [version]
    );
    return parseInt(result.rows[0].count) > 0;
}

/**
 * Marquer une migration comme exécutée
 */
async function markMigrationExecuted(version) {
    await query(
        `INSERT INTO ${MIGRATIONS_TABLE} (version) VALUES ($1)`,
        [version]
    );
}

/**
 * Exécuter toutes les migrations
 */
async function runMigrations() {
    try {
        logger.info('🔄 Démarrage des migrations...');
        
        // Tester la connexion
        await testConnection();
        
        // Créer la table des migrations
        await createMigrationsTable();
        
        // Lire le dossier des migrations
        const migrationsDir = path.join(__dirname, 'migrations');
        
        // Créer le dossier s'il n'existe pas
        try {
            await fs.access(migrationsDir);
        } catch {
            await fs.mkdir(migrationsDir, { recursive: true });
            logger.info('Dossier migrations créé');
        }
        
        // Lire tous les fichiers de migration
        const files = await fs.readdir(migrationsDir);
        const migrations = files
            .filter(f => f.endsWith('.sql'))
            .sort(); // Ordre alphabétique (par date si nommage correct)
        
        if (migrations.length === 0) {
            logger.info('Aucune migration à exécuter');
            return;
        }
        
        // Exécuter chaque migration
        for (const migrationFile of migrations) {
            const version = migrationFile.replace('.sql', '');
            
            // Vérifier si déjà exécutée
            if (await isMigrationExecuted(version)) {
                logger.debug(`Migration ${version} déjà exécutée`);
                continue;
            }
            
            logger.info(`Exécution de la migration: ${version}`);
            
            // Lire le contenu SQL
            const sqlPath = path.join(migrationsDir, migrationFile);
            const sql = await fs.readFile(sqlPath, 'utf8');
            
            try {
                // Exécuter la migration
                await query(sql);
                
                // Marquer comme exécutée
                await markMigrationExecuted(version);
                
                logger.info(`✅ Migration ${version} réussie`);
            } catch (error) {
                logger.error(`❌ Échec migration ${version}:`, error);
                throw error;
            }
        }
        
        logger.info('✅ Toutes les migrations ont été exécutées');
        
    } catch (error) {
        logger.error('❌ Erreur lors des migrations:', error);
        process.exit(1);
    }
}

// Exécuter si appelé directement
if (require.main === module) {
    runMigrations()
        .then(() => {
            logger.info('✅ Migrations terminées');
            process.exit(0);
        })
        .catch(error => {
            logger.error('❌ Échec des migrations:', error);
            process.exit(1);
        });
}

module.exports = { runMigrations };