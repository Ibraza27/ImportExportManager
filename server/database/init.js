/**
 * Script d'initialisation de la base de données
 * Crée la base de données et exécute le schéma SQL
 */

require('dotenv').config(); // ✅ On laisse dotenv chercher le .env dans le dossier courant
const { Client } = require('pg');
const fs = require('fs').promises;
const path = require('path');
const bcrypt = require('bcrypt');

const logger = console;

async function initDatabase() {
    // Connexion sans spécifier de base de données
    const client = new Client({
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD
    });

    try {
        logger.log('🔄 Connexion à PostgreSQL...');
        await client.connect();
        
        // Vérifier si la base de données existe
        const dbName = process.env.DB_NAME || 'import_export_db';
        const checkDbQuery = `SELECT 1 FROM pg_database WHERE datname = '${dbName}'`;
        const dbExists = await client.query(checkDbQuery);
        
        if (dbExists.rows.length === 0) {
            logger.log(`📦 Création de la base de données ${dbName}...`);
            await client.query(`CREATE DATABASE ${dbName}`);
            logger.log('✅ Base de données créée');
        } else {
            logger.log('ℹ️  La base de données existe déjà');
        }
        
        await client.end();
        
        // Se reconnecter à la base de données créée
        const dbClient = new Client({
            host: process.env.DB_HOST || 'localhost',
            port: process.env.DB_PORT || 5432,
            database: dbName,
            user: process.env.DB_USER || 'postgres',
            password: process.env.DB_PASSWORD || 'calvin'
        });
        
        await dbClient.connect();
        
        // Lire et exécuter le fichier schema.sql
        logger.log('📋 Lecture du fichier schema.sql...');
        const schemaPath = path.join(__dirname, 'schema.sql');
        const schema = await fs.readFile(schemaPath, 'utf8');
        
        // Remplacer le mot de passe hashé dans le schema
        const hashedPassword = await bcrypt.hash('calvin', 10);
        const schemaWithPassword = schema.replace('$2b$10$YourHashedPasswordHere', hashedPassword);
        
        logger.log('🏗️  Exécution du schéma SQL...');
        await dbClient.query(schemaWithPassword);
        
        logger.log('✅ Base de données initialisée avec succès !');
        logger.log('\n📌 Informations de connexion :');
        logger.log(`   - Email : ibrahim.ibraza@hotmail.fr`);
        logger.log(`   - Mot de passe : calvin`);
        logger.log(`   - Base de données : ${dbName}`);
        logger.log(`   - Host : ${process.env.DB_HOST || 'localhost'}`);
        logger.log(`   - Port : ${process.env.DB_PORT || 5432}`);
        
        await dbClient.end();
        
    } catch (error) {
        logger.error('❌ Erreur lors de l\'initialisation :', error.message);
        process.exit(1);
    }
}

// Ajouter le script au package.json
async function updatePackageJson() {
    try {
        const packagePath = path.join(__dirname, '../package.json');
        const packageContent = await fs.readFile(packagePath, 'utf8');
        const packageJson = JSON.parse(packageContent);
        
        if (!packageJson.scripts['db:init']) {
            packageJson.scripts['db:init'] = 'node database/init.js';
            packageJson.scripts['db:reset'] = 'node database/init.js --force';
            
            await fs.writeFile(packagePath, JSON.stringify(packageJson, null, 2));
            logger.log('✅ Scripts ajoutés au package.json');
        }
    } catch (error) {
        logger.warn('⚠️  Impossible de mettre à jour package.json:', error.message);
    }
}

// Exécution
(async () => {
    const forceReset = process.argv.includes('--force');
    
    if (forceReset) {
        logger.log('⚠️  Mode FORCE activé - La base de données sera réinitialisée');
    }
    
    await initDatabase();
    await updatePackageJson();
    
    logger.log('\n🎉 Initialisation terminée !');
    logger.log('Vous pouvez maintenant démarrer le serveur avec : npm start');
})();