/**
 * Configuration de la connexion PostgreSQL
 */

require('dotenv').config();

const databaseConfig = {
    development: {
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 5432,
        database: process.env.DB_NAME || 'import_export_db',
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || 'postgres',
        max: 20, // Nombre maximum de connexions dans le pool
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
    },
    production: {
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        database: process.env.DB_NAME,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        max: 50,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
        ssl: {
            rejectUnauthorized: false
        }
    }
};

module.exports = databaseConfig[process.env.NODE_ENV || 'development'];