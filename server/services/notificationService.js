/**
 * Service de notifications
 * Gère les notifications en temps réel et par email
 */

const { db, query } = require('../database/connection');
const { logger } = require('../../shared/logger');
const nodemailer = require('nodemailer');

class NotificationService {
    constructor() {
        this.io = null;
        this.emailTransporter = this.createEmailTransporter();
    }
    
    /**
     * Initialiser avec Socket.IO
     */
    setSocketIO(io) {
        this.io = io;
    }
    
    /**
     * Créer le transporteur email
     */
    
    createEmailTransporter() {
        if (!process.env.SMTP_HOST) {
            logger.warn('Configuration SMTP manquante');
            return null;
        }
        
        return nodemailer.createTransport({ // <-- CORRECT, sans "er"
            host: process.env.SMTP_HOST,
            port: process.env.SMTP_PORT || 587,
            secure: process.env.SMTP_SECURE === 'true',
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS
            }
        });
    }
    
    /**
     * Créer une notification dans la base de données
     */
    async create(notificationData) {
        try {
            const notification = await db.insert('notifications', {
                ...notificationData,
                lu: false
            });
            
            // Envoyer en temps réel si Socket.IO disponible
                        if (this.io && notification.destinataire_id) {
                            this.io.to(`user-${notification.destinataire_id}`).emit('notification:new', notification);
                        }
                        
                        return notification;
                        
                    } catch (error) {
                        logger.error('Erreur création notification:', error);
                        throw error;
                    }
                }
                
                /**
                 * Envoyer une notification système
                 */
                async sendSystemNotification(userId, titre, message, type = 'info') {
                    return this.create({
                        destinataire_id: userId,
                        type,
                        titre,
                        message
                    });
                }
                
                /**
                 * Envoyer une notification à tous les utilisateurs d'un rôle
                 */
                async notifyRole(role, titre, message, type = 'info') {
                    try {
                        const users = await db.findMany('utilisateurs', { role, actif: true });
                        
                        const notifications = await Promise.all(
                            users.map(user => this.create({
                                destinataire_id: user.id,
                                type,
                                titre,
                                message
                            }))
                        );
                        
                        return notifications;
                        
                    } catch (error) {
                        logger.error('Erreur notification par rôle:', error);
                        throw error;
                    }
                }

                /**
                 * Récupérer les notifications d'un utilisateur avec pagination
                 */
                async getUserNotifications(userId, options = {}) {
                    const { page = 1, limit = 20, unreadOnly = false } = options;
                    const offset = (page - 1) * limit;

                    let queryText = 'SELECT * FROM notifications WHERE destinataire_id = $1';
                    const params = [userId];

                    if (unreadOnly) {
                        queryText += ' AND lu = false';
                    }

                    // Ajoute la pagination et le tri
                    queryText += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
                    params.push(limit, offset);

                    // Utilise la fonction 'query' déjà importée en haut du fichier
                    const result = await query(queryText, params);
                    return result; // La fonction query renvoie déjà les lignes
                }
                
                /**
                 * Marquer une notification comme lue
                 */
                async markAsRead(notificationId, userId) {
                    try {
                        const notification = await db.findOne('notifications', {
                            id: notificationId,
                            destinataire_id: userId
                        });
                        
                        if (!notification) {
                            throw new Error('Notification non trouvée');
                        }
                        
                        if (!notification.lu) {
                            await db.update('notifications', notificationId, {
                                lu: true,
                                date_lecture: new Date()
                            });
                            
                            // Notifier en temps réel
                            if (this.io) {
                                this.io.to(`user-${userId}`).emit('notification:read', notificationId);
                            }
                        }
                        
                        return true;
                        
                    } catch (error) {
                        logger.error('Erreur marquage notification:', error);
                        throw error;
                    }
                }
                
                /**
                 * Marquer toutes les notifications comme lues
                 */
                async markAllAsRead(userId) {
                    try {
                        await query(`
                            UPDATE notifications 
                            SET lu = true, date_lecture = CURRENT_TIMESTAMP
                            WHERE destinataire_id = $1 AND lu = false
                        `, [userId]);
                        
                        // Notifier en temps réel
                        if (this.io) {
                            this.io.to(`user-${userId}`).emit('notifications:all-read');
                        }
                        
                        return true;
                        
                    } catch (error) {
                        logger.error('Erreur marquage toutes notifications:', error);
                        throw error;
                    }
                }
                
                /**
                * Envoyer un email
                */
                async sendEmail(to, subject, html, attachments = []) {
                    if (!this.emailTransporter) {
                        logger.warn('Email non envoyé: transporteur non configuré');
                        return false;
                    }
                    
                    try {
                        const info = await this.emailTransporter.sendMail({
                            from: `"${process.env.SMTP_FROM_NAME || 'Import Export Manager'}" <${process.env.SMTP_FROM_EMAIL}>`,
                            to,
                            subject,
                            html,
                            attachments
                        });
                        
                        logger.info(`Email envoyé: ${info.messageId}`);
                        return true;
                        
                    } catch (error) {
                        logger.error('Erreur envoi email:', error);
                        throw error;
                    }
                }
                
                /**
                * Envoyer une confirmation de paiement
                */
                async sendPaymentConfirmation(client, paiement) {
                    if (!client.email) return false;
                    
                    const html = `
                        <h2>Confirmation de paiement</h2>
                        <p>Bonjour ${client.prenom} ${client.nom},</p>
                        <p>Nous confirmons la réception de votre paiement:</p>
                        <ul>
                            <li><strong>Numéro de reçu:</strong> ${paiement.numero_recu}</li>
                            <li><strong>Montant:</strong> ${paiement.montant_paye} €</li>
                            <li><strong>Date:</strong> ${new Date(paiement.date_paiement).toLocaleDateString('fr-FR')}</li>
                            <li><strong>Mode de paiement:</strong> ${paiement.mode_paiement}</li>
                        </ul>
                        <p>Merci de votre confiance.</p>
                        <p>Cordialement,<br>L'équipe Import Export Manager</p>
                    `;
                    
                    await this.sendEmail(
                        client.email,
                        `Confirmation de paiement - ${paiement.numero_recu}`,
                        html
                    );
                    
                    // Créer aussi une notification système
                    await this.create({
                        destinataire_id: client.created_by,
                        type: 'paiement',
                        titre: 'Nouveau paiement reçu',
                        message: `Paiement de ${paiement.montant_paye}€ reçu de ${client.nom} ${client.prenom}`,
                        donnees: { paiement_id: paiement.id }
                    });
                    
                    return true;
                }
                
                /**
                * Envoyer un rappel de paiement
                */
                async sendPaymentReminder(paiement) {
                    const html = `
                        <h2>Rappel de paiement</h2>
                        <p>Bonjour ${paiement.prenom} ${paiement.nom},</p>
                        <p>Nous vous rappelons qu'un paiement est en attente:</p>
                        <ul>
                            <li><strong>Montant dû:</strong> ${paiement.montant_restant} €</li>
                            <li><strong>Date d'échéance:</strong> ${new Date(paiement.date_echeance).toLocaleDateString('fr-FR')}</li>
                            <li><strong>Jours de retard:</strong> ${paiement.jours_retard || 0}</li>
                        </ul>
                        <p>Merci de régulariser votre situation dans les plus brefs délais.</p>
                        <p>Cordialement,<br>L'équipe Import Export Manager</p>
                    `;
                    
                    return this.sendEmail(
                        paiement.email,
                        'Rappel de paiement en attente',
                        html
                    );
                }
                
                /**
                * Notifier l'expédition d'un conteneur
                */
                async notifyContainerShipment(conteneur) {
                    try {
                        // Récupérer tous les clients concernés
                        const clients = await query(`
                            SELECT DISTINCT c.*
                            FROM clients c
                            JOIN marchandises m ON m.client_id = c.id
                            WHERE m.conteneur_id = $1
                        `, [conteneur.id]);
                        
                        // Envoyer des notifications à chaque client
                        for (const client of clients.rows) {
                            if (client.email) {
                                const html = `
                                    <h2>Expédition de votre marchandise</h2>
                                    <p>Bonjour ${client.prenom} ${client.nom},</p>
                                    <p>Nous vous informons que le conteneur ${conteneur.numero_conteneur} contenant votre marchandise a été expédié.</p>
                                    <ul>
                                        <li><strong>Destination:</strong> ${conteneur.destination_ville}, ${conteneur.destination_pays}</li>
                                        <li><strong>Date de départ:</strong> ${new Date(conteneur.date_depart_reelle || conteneur.date_depart_prevue).toLocaleDateString('fr-FR')}</li>
                                        <li><strong>Date d'arrivée prévue:</strong> ${new Date(conteneur.date_arrivee_prevue).toLocaleDateString('fr-FR')}</li>
                                        ${conteneur.numero_tracking ? `<li><strong>Numéro de suivi:</strong> ${conteneur.numero_tracking}</li>` : ''}
                                    </ul>
                                    <p>Vous recevrez une notification à l'arrivée du conteneur.</p>
                                    <p>Cordialement,<br>L'équipe Import Export Manager</p>
                                `;
                                
                                await this.sendEmail(
                                    client.email,
                                    `Expédition conteneur ${conteneur.numero_conteneur}`,
                                    html
                                );
                            }
                            
                            // Notification système
                            await this.create({
                                destinataire_id: client.created_by,
                                type: 'expedition',
                                titre: 'Conteneur expédié',
                                message: `Le conteneur ${conteneur.numero_conteneur} a été expédié vers ${conteneur.destination_ville}`,
                                donnees: { conteneur_id: conteneur.id }
                            });
                        }
                        
                    } catch (error) {
                        logger.error('Erreur notification expédition:', error);
                        throw error;
                    }
                }
                
                /**
                * Nettoyer les anciennes notifications
                */
                async cleanup(daysToKeep = 30) {
                    try {
                        const result = await query(`
                            DELETE FROM notifications
                            WHERE created_at < CURRENT_DATE - INTERVAL '$1 days'
                            AND lu = true
                        `, [daysToKeep]);
                        
                        logger.info(`Nettoyage notifications: ${result.rowCount} supprimées`);
                        return result.rowCount;
                        
                    } catch (error) {
                        logger.error('Erreur nettoyage notifications:', error);
                        throw error;
                    }
                }
            }

            module.exports = new NotificationService();