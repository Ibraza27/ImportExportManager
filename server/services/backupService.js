/**
 * Service de sauvegarde automatique
 * Gère les sauvegardes de la base de données et des fichiers
 */

const { exec } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const archiver = require('archiver');
const { logger } = require('../../shared/logger');

class BackupService {
    constructor() {
        this.backupDir = path.join(__dirname, '../../backups');
        this.maxBackups = process.env.MAX_BACKUPS || 30;
        this.ensureBackupDirectory();
    }
    
    /**
     * Créer le dossier de sauvegarde s'il n'existe pas
     */
    async ensureBackupDirectory() {
        try {
            await fs.access(this.backupDir);
        } catch {
            await fs.mkdir(this.backupDir, { recursive: true });
        }
    }
    
    /**
     * Effectuer une sauvegarde complète
     */
    async performBackup(type = 'auto') {
        try {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const backupName = `backup_${type}_${timestamp}`;
            const backupPath = path.join(this.backupDir, backupName);
            
            // Créer le dossier de cette sauvegarde
            await fs.mkdir(backupPath);
            
            logger.info(`Démarrage sauvegarde ${type}: ${backupName}`);
            
            // 1. Sauvegarder la base de données
            await this.backupDatabase(backupPath);
            
            // 2. Sauvegarder les fichiers (photos, documents)
            await this.backupFiles(backupPath);
            
            // 3. Créer l'archive ZIP
            const zipPath = await this.createZipArchive(backupPath, backupName);
            
            // 4. Nettoyer le dossier temporaire
            await this.cleanupTempFiles(backupPath);
            
            // 5. Nettoyer les anciennes sauvegardes
            await this.cleanupOldBackups();
            
            logger.info(`Sauvegarde terminée: ${zipPath}`);
            
            return {
                success: true,
                name: backupName,
                path: zipPath,
                size: (await fs.stat(zipPath)).size,
                date: new Date()
            };
            
        } catch (error) {
            logger.error('Erreur sauvegarde:', error);
            throw error;
        }
    }
    
    /**
     * Sauvegarder la base de données
     */
    async backupDatabase(backupPath) {
        return new Promise((resolve, reject) => {
            const dbConfig = {
                host: process.env.DB_HOST || 'localhost',
                port: process.env.DB_PORT || 5432,
                database: process.env.DB_NAME || 'import_export_db',
                username: process.env.DB_USER || 'postgres',
                password: process.env.DB_PASSWORD
            };
            
            const dumpFile = path.join(backupPath, 'database.sql');
            
            // Définir la variable d'environnement pour le mot de passe
            process.env.PGPASSWORD = dbConfig.password;
            
            const command = `pg_dump -h ${dbConfig.host} -p ${dbConfig.port} -U ${dbConfig.username} -d ${dbConfig.database} -f "${dumpFile}" --no-owner --no-privileges`;
            
            exec(command, (error, stdout, stderr) => {
                // Nettoyer la variable d'environnement
                delete process.env.PGPASSWORD;
                
                if (error) {
                    logger.error('Erreur dump database:', stderr);
                    reject(error);
                } else {
                    logger.info('Base de données sauvegardée');
                    resolve(dumpFile);
                }
            });
        });
    }
    
    /**
     * Sauvegarder les fichiers uploadés
     */
    async backupFiles(backupPath) {
        const sourceDirs = [
            { name: 'photos', path: path.join(__dirname, '../../uploads/photos') },
            { name: 'documents', path: path.join(__dirname, '../../uploads/documents') },
            { name: 'output', path: path.join(__dirname, '../../output') }
        ];
        
        for (const dir of sourceDirs) {
            try {
                await fs.access(dir.path);
                const destPath = path.join(backupPath, dir.name);
                await this.copyDirectory(dir.path, destPath);
                logger.info(`Dossier ${dir.name} sauvegardé`);
            } catch (error) {
                logger.warn(`Dossier ${dir.name} introuvable, ignoré`);
            }
        }
    }
    
    /**
     * Copier un dossier récursivement
     */
    async copyDirectory(source, destination) {
        await fs.mkdir(destination, { recursive: true });
        
        const entries = await fs.readdir(source, { withFileTypes: true });
        
        for (const entry of entries) {
            const sourcePath = path.join(source, entry.name);
            const destPath = path.join(destination, entry.name);
            
            if (entry.isDirectory()) {
                await this.copyDirectory(sourcePath, destPath);
            } else {
                await fs.copyFile(sourcePath, destPath);
            }
        }
    }
    
    /**
     * Créer l'archive ZIP
     */
    async createZipArchive(sourcePath, archiveName) {
        return new Promise((resolve, reject) => {
            const zipPath = path.join(this.backupDir, `${archiveName}.zip`);
            const output = require('fs').createWriteStream(zipPath);
            const archive = archiver('zip', {
                zlib: { level: 9 } // Compression maximale
            });
            
            output.on('close', () => {
                logger.info(`Archive créée: ${archive.pointer()} bytes`);
                resolve(zipPath);
            });
            
            archive.on('error', (err) => {
                logger.error('Erreur création archive:', err);
                reject(err);
            });
            
            archive.pipe(output);
            archive.directory(sourcePath, false);
            archive.finalize();
        });
    }
    
    /**
     * Nettoyer les fichiers temporaires
     */
    async cleanupTempFiles(tempPath) {
        try {
            await fs.rm(tempPath, { recursive: true, force: true });
            logger.info('Fichiers temporaires nettoyés');
        } catch (error) {
            logger.warn('Erreur nettoyage fichiers temporaires:', error);
        }
    }
    
    /**
     * Nettoyer les anciennes sauvegardes
     */
    async cleanupOldBackups() {
        try {
            const files = await fs.readdir(this.backupDir);
            const backupFiles = files
                .filter(f => f.endsWith('.zip'))
                .map(f => ({
                    name: f,
                    path: path.join(this.backupDir, f),
                    time: f.match(/backup_.*_(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2})/)?.[1]
                }))
                .filter(f => f.time)
                .sort((a, b) => b.time.localeCompare(a.time));
            
            // Garder seulement les N dernières sauvegardes
            if (backupFiles.length > this.maxBackups) {
                const toDelete = backupFiles.slice(this.maxBackups);
                
                for (const file of toDelete) {
                    await fs.unlink(file.path);
                    logger.info(`Ancienne sauvegarde supprimée: ${file.name}`);
                }
            }
        } catch (error) {
            logger.error('Erreur nettoyage anciennes sauvegardes:', error);
        }
    }
    
    /**
     * Restaurer une sauvegarde
     */
    async restoreBackup(backupFile) {
        // TODO: Implémenter la restauration
        throw new Error('Restauration non implémentée');
    }
    
    /**
     * Lister les sauvegardes disponibles
     */
    async listBackups() {
        try {
            const files = await fs.readdir(this.backupDir);
            const backups = [];
            
            for (const file of files) {
                if (file.endsWith('.zip')) {
                    const filePath = path.join(this.backupDir, file);
                    const stats = await fs.stat(filePath);
                    
                    backups.push({
                        name: file,
                        size: stats.size,
                        date: stats.mtime,
                        path: filePath
                    });
                }
            }
            
            return backups.sort((a, b) => b.date - a.date);
        } catch (error) {
            logger.error('Erreur liste sauvegardes:', error);
            return [];
        }
    }
    
    /**
     * Planifier les sauvegardes automatiques
     */
    scheduleAutoBackup() {
        // Sauvegarde quotidienne à 2h du matin
        const schedule = require('node-schedule');
        
        schedule.scheduleJob('0 2 * * *', async () => {
            logger.info('Démarrage sauvegarde automatique programmée');
            try {
                await this.performBackup('scheduled');
            } catch (error) {
                logger.error('Échec sauvegarde automatique:', error);
            }
        });
        
        logger.info('Sauvegardes automatiques programmées (tous les jours à 2h)');
    }
}

module.exports = new BackupService();