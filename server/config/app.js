/**
 * Configuration de l'application
 * Paramètres globaux et constantes système
 */

module.exports = {
    // =============================================
    // INFORMATIONS GÉNÉRALES
    // =============================================
    
    app: {
        name: 'Import Export Manager',
        version: '1.0.0',
        description: 'Système de gestion d\'import-export maritime',
        company: 'Votre Entreprise',
        support: {
            email: 'support@import-export.com',
            phone: '+33 1 23 45 67 89'
        }
    },
    
    // =============================================
    // PARAMÈTRES SERVEUR
    // =============================================
    
    server: {
        port: process.env.PORT || 3000,
        host: process.env.HOST || 'localhost',
        environment: process.env.NODE_ENV || 'development',
        cors: {
            origin: process.env.CORS_ORIGIN || '*',
            credentials: true
        },
        rateLimit: {
            windowMs: 15 * 60 * 1000, // 15 minutes
            max: 100, // Limite par IP
            message: 'Trop de requêtes, veuillez réessayer plus tard'
        }
    },
    
    // =============================================
    // BASE DE DONNÉES
    // =============================================
    
    database: {
        host: process.env.DB_HOST || 'localhost',
        port: process.env.DB_PORT || 5432,
        name: process.env.DB_NAME || 'import_export_db',
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || '',
        pool: {
            min: 2,
            max: 10,
            idleTimeoutMillis: 30000
        },
        migrations: {
            directory: './database/migrations',
            tableName: 'schema_migrations'
        }
    },
    
    // =============================================
    // AUTHENTIFICATION
    // =============================================
    
    auth: {
        jwt: {
            secret: process.env.JWT_SECRET || 'change-this-secret-key',
            expiresIn: process.env.JWT_EXPIRES_IN || '24h',
            refreshExpiresIn: '7d'
        },
        bcrypt: {
            saltRounds: 10
        },
        session: {
            timeout: 30 * 60 * 1000, // 30 minutes d'inactivité
            maxAge: 24 * 60 * 60 * 1000 // 24 heures max
        },
        passwordPolicy: {
            minLength: 8,
            requireUppercase: true,
            requireLowercase: true,
            requireNumbers: true,
            requireSpecialChars: true
        }
    },
    
    // =============================================
    // STOCKAGE FICHIERS
    // =============================================
    
    storage: {
        uploads: {
            directory: process.env.UPLOAD_DIR || './uploads',
            maxFileSize: 10 * 1024 * 1024, // 10 MB
            allowedMimeTypes: {
                images: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
                documents: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
                spreadsheets: ['application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']
            }
        },
        exports: {
            directory: process.env.EXPORT_DIR || './exports',
            retention: 7 * 24 * 60 * 60 * 1000 // 7 jours
        },
        backups: {
            directory: process.env.BACKUP_DIR || './backups',
            maxBackups: 30,
            schedule: '0 2 * * *' // Tous les jours à 2h du matin
        }
    },
    
    // =============================================
    // CODES-BARRES
    // =============================================
    
    barcodes: {
        formats: {
            client: {
                prefix: 'CL',
                length: 6,
                type: 'CODE128'
            },
            marchandise: {
                prefix: 'MA',
                length: 6,
                type: 'CODE128'
            },
            conteneur: {
                prefix: 'DO',
                format: 'YYYY-XXX', // DO-2024-001
                type: 'CODE128'
            }
        },
        qrCode: {
            errorCorrectionLevel: 'M',
            margin: 4,
            width: 200
        }
    },
    
    // =============================================
    // NOTIFICATIONS
    // =============================================
    
    notifications: {
        email: {
            enabled: process.env.EMAIL_ENABLED === 'true',
            host: process.env.EMAIL_HOST || 'smtp.gmail.com',
            port: process.env.EMAIL_PORT || 587,
            secure: false,
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            },
            from: process.env.EMAIL_FROM || 'Import Export Manager <noreply@import-export.com>',
            templates: {
                directory: './templates/emails'
            }
        },
        push: {
            enabled: false,
            vapidKeys: {
                publicKey: process.env.VAPID_PUBLIC_KEY,
                privateKey: process.env.VAPID_PRIVATE_KEY
            }
        },
        sms: {
            enabled: false,
            provider: 'twilio',
            accountSid: process.env.TWILIO_ACCOUNT_SID,
            authToken: process.env.TWILIO_AUTH_TOKEN,
            fromNumber: process.env.TWILIO_FROM_NUMBER
        }
    },
    
    // =============================================
    // PARAMÈTRES MÉTIER
    // =============================================
    
    business: {
        currency: {
            code: 'EUR',
            symbol: '€',
            decimal: 2
        },
        tax: {
            default: 20, // TVA 20%
            reduced: 10,
            superReduced: 5.5,
            special: 2.1
        },
        container: {
            types: [
                { code: '20GP', name: '20 pieds standard', volume: 33.2 },
                { code: '40GP', name: '40 pieds standard', volume: 67.7 },
                { code: '40HC', name: '40 pieds high cube', volume: 76.3 },
                { code: '20RF', name: '20 pieds frigorifique', volume: 28.3 },
                { code: '40RF', name: '40 pieds frigorifique', volume: 59.3 }
            ],
            destinations: {
                defaultCountry: 'FR',
                commonCountries: ['FR', 'BE', 'DE', 'ES', 'IT', 'NL', 'GB', 'US', 'CN', 'JP']
            }
        },
        payment: {
            methods: ['especes', 'cheque', 'virement', 'carte', 'mobile'],
            terms: [0, 30, 60, 90], // Délais de paiement en jours
            reminderDays: [7, 3, 0, -7] // Rappels avant/après échéance
        }
    },
    
    // =============================================
    // LOGS ET MONITORING
    // =============================================
    
    logging: {
        level: process.env.LOG_LEVEL || 'info',
        directory: './logs',
        filename: 'app-%DATE%.log',
        datePattern: 'YYYY-MM-DD',
        maxSize: '20m',
        maxFiles: '14d',
        format: 'combined', // combined, json, simple
        console: {
            enabled: true,
            colorize: true
        }
    },
    
    monitoring: {
        metrics: {
            enabled: false,
            port: 9090
        },
        healthCheck: {
            enabled: true,
            path: '/health',
            interval: 30000 // 30 secondes
        }
    },
    
    // =============================================
    // SÉCURITÉ
    // =============================================
    
    security: {
        helmet: {
            contentSecurityPolicy: false, // Géré séparément pour l'app Electron
            hsts: {
                maxAge: 31536000,
                includeSubDomains: true,
                preload: true
            }
        },
        csrf: {
            enabled: true,
            cookie: {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production'
            }
        },
        encryption: {
            algorithm: 'aes-256-gcm',
            keyLength: 32,
            ivLength: 16,
            tagLength: 16,
            saltLength: 64,
            iterations: 100000
        }
    },
    
    // =============================================
    // PERFORMANCES
    // =============================================
    
    performance: {
        cache: {
            enabled: true,
            ttl: 5 * 60, // 5 minutes par défaut
            checkPeriod: 60 // Vérification toutes les 60 secondes
        },
        pagination: {
            defaultLimit: 25,
            maxLimit: 100
        },
        compression: {
            enabled: true,
            level: 6 // 1-9, 6 est un bon compromis
        }
    },
    
    // =============================================
    // DÉVELOPPEMENT
    // =============================================
    
    development: {
        debug: process.env.NODE_ENV === 'development',
        mockData: {
            enabled: false,
            seed: 12345
        },
        hotReload: {
            enabled: true,
            port: 3001
        }
    },
    
    // =============================================
    // FONCTIONNALITÉS
    // =============================================
    
    features: {
        multiLanguage: {
            enabled: false,
            defaultLanguage: 'fr',
            supportedLanguages: ['fr', 'en', 'es']
        },
        darkMode: {
            enabled: true,
            default: 'auto' // auto, light, dark
        },
        export: {
            formats: ['pdf', 'excel', 'csv'],
            batchSize: 1000
        },
        import: {
            formats: ['csv', 'excel'],
            maxRows: 10000,
            validation: {
                strict: true
            }
        }
    }
};

// =============================================
// HELPERS
// =============================================

// Fonction pour obtenir une valeur de config avec un chemin
module.exports.get = function(path, defaultValue) {
    const keys = path.split('.');
    let value = module.exports;
    
    for (const key of keys) {
        if (value && typeof value === 'object' && key in value) {
            value = value[key];
        } else {
            return defaultValue;
        }
    }
    
    return value;
};

// Fonction pour vérifier si en production
module.exports.isProduction = function() {
    return process.env.NODE_ENV === 'production';
};

// Fonction pour vérifier si en développement
module.exports.isDevelopment = function() {
    return process.env.NODE_ENV === 'development';
};