/**
 * Service de génération PDF
 * Génère les factures, reçus et documents
 */

const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const { db, query } = require('../database/connection');
const { logger } = require('../../shared/logger');

class PDFService {
    constructor() {
        this.outputDir = path.join(__dirname, '../../output/pdf');
        this.ensureOutputDirectory();
    }
    
    /**
     * Créer le dossier de sortie s'il n'existe pas
     */
    ensureOutputDirectory() {
        if (!fs.existsSync(this.outputDir)) {
            fs.mkdirSync(this.outputDir, { recursive: true });
        }
    }
    
    /**
     * Générer une facture
     */
    async generateInvoice(marchandiseId) {
        try {
            // Récupérer les données
            const marchandise = await db.findOne('marchandises', { id: marchandiseId });
            const client = await db.findOne('clients', { id: marchandise.client_id });
            const paiements = await db.findMany('paiements', { marchandise_id: marchandiseId });
            
            const doc = new PDFDocument({
                size: 'A4',
                margin: 50
            });
            
            const filename = `facture_${marchandise.code_barre}_${Date.now()}.pdf`;
            const filepath = path.join(this.outputDir, filename);
            
            doc.pipe(fs.createWriteStream(filepath));
            
            // En-tête
            this.addHeader(doc, 'FACTURE');
            
            // Informations entreprise
            doc.fontSize(10)
               .text('Import Export Maritime SARL', 50, 100)
               .text('123 Rue du Commerce', 50, 115)
               .text('75001 Paris, France', 50, 130)
               .text('Tél: +33 1 23 45 67 89', 50, 145)
               .text('Email: contact@import-export.com', 50, 160);
            
            // Informations client
            doc.fontSize(10)
               .text('Facturé à:', 300, 100, { underline: true })
               .text(`${client.nom} ${client.prenom}`, 300, 120)
               .text(client.adresse_principale || '', 300, 135)
               .text(`${client.ville}, ${client.pays}`, 300, 150)
               .text(`Tél: ${client.telephone_principal}`, 300, 165);
            
            // Détails facture
            doc.fontSize(12)
               .text(`Facture N°: ${marchandise.code_barre}`, 50, 200)
               .text(`Date: ${new Date().toLocaleDateString('fr-FR')}`, 50, 220);
            
            // Tableau des articles
            this.addInvoiceTable(doc, marchandise, 250);
            
            // Total
            const totalY = 400;
            doc.fontSize(12)
               .text('Total HT:', 350, totalY, { width: 100, align: 'right' })
               .text(`${marchandise.cout_total.toFixed(2)} €`, 450, totalY, { width: 100, align: 'right' })
               .text('TVA (20%):', 350, totalY + 20, { width: 100, align: 'right' })
               .text(`${(marchandise.cout_total * 0.2).toFixed(2)} €`, 450, totalY + 20, { width: 100, align: 'right' })
               .fontSize(14)
               .text('Total TTC:', 350, totalY + 45, { width: 100, align: 'right', bold: true })
               .text(`${(marchandise.cout_total * 1.2).toFixed(2)} €`, 450, totalY + 45, { width: 100, align: 'right', bold: true });
            
            // Paiements
            if (paiements.length > 0) {
                this.addPaymentsSection(doc, paiements, totalY + 100);
            }
            
            // Pied de page
            this.addFooter(doc);
            
            doc.end();
            
            return { filename, filepath };
            
        } catch (error) {
            logger.error('Erreur génération facture:', error);
            throw error;
        }
    }
    
    /**
     * Générer un reçu de paiement
     */
    async generateReceipt(paiementId) {
        try {
            const paiement = await db.findOne('paiements', { id: paiementId });
            const client = await db.findOne('clients', { id: paiement.client_id });
            
            const doc = new PDFDocument({
                size: 'A5',
                margin: 40
            });
            
            const filename = `recu_${paiement.numero_recu}_${Date.now()}.pdf`;
            const filepath = path.join(this.outputDir, filename);
            
            doc.pipe(fs.createWriteStream(filepath));
            
            // En-tête
            this.addHeader(doc, 'REÇU DE PAIEMENT');
            
            // Numéro de reçu
            doc.fontSize(14)
               .text(`Reçu N°: ${paiement.numero_recu}`, 50, 100, { align: 'center' });
            
            // Date
            doc.fontSize(10)
               .text(`Date: ${new Date(paiement.date_paiement).toLocaleDateString('fr-FR')}`, 50, 130);
            
            // Client
            doc.fontSize(12)
               .text(`Reçu de: ${client.nom} ${client.prenom}`, 50, 160)
               .fontSize(10)
               .text(`${client.adresse_principale || ''}`, 50, 180)
               .text(`${client.ville}, ${client.pays}`, 50, 195);
            
            // Montant
            doc.fontSize(14)
               .text('Montant reçu:', 50, 230)
               .fontSize(20)
               .text(`${paiement.montant_paye.toFixed(2)} €`, 50, 250, { align: 'center' });
            
            // Mode de paiement
            doc.fontSize(12)
               .text(`Mode de paiement: ${this.formatPaymentMode(paiement.mode_paiement)}`, 50, 290);
            
            // Référence
            if (paiement.reference_transaction) {
                doc.text(`Référence: ${paiement.reference_transaction}`, 50, 310);
            }
            
            // Signature
            doc.fontSize(10)
               .text('Signature et cachet:', 50, 380)
               .rect(50, 400, 200, 60)
               .stroke();
            
            doc.end();
            
            return { filename, filepath };
            
        } catch (error) {
            logger.error('Erreur génération reçu:', error);
            throw error;
        }
    }
    
    /**
     * Générer un manifeste de conteneur
     */
    async generateManifest(conteneurId) {
        try {
            const conteneur = await db.findOne('conteneurs', { id: conteneurId });
            const marchandises = await query(
                `SELECT m.*, c.nom as client_nom, c.prenom as client_prenom
                 FROM marchandises m
                 JOIN clients c ON m.client_id = c.id
                 WHERE m.conteneur_id = $1
                 ORDER BY m.client_id, m.id`,
                [conteneurId]
            );
            
            const doc = new PDFDocument({
                size: 'A4',
                layout: 'landscape',
                margin: 40
            });
            
            const filename = `manifeste_${conteneur.numero_conteneur}_${Date.now()}.pdf`;
            const filepath = path.join(this.outputDir, filename);
            
            doc.pipe(fs.createWriteStream(filepath));
            
            // En-tête
            this.addHeader(doc, 'MANIFESTE DE CHARGEMENT');
            
            // Informations conteneur
            doc.fontSize(12)
               .text(`Conteneur: ${conteneur.numero_conteneur}`, 50, 100)
               .text(`Destination: ${conteneur.destination_ville}, ${conteneur.destination_pays}`, 300, 100)
               .text(`Date départ: ${new Date(conteneur.date_depart_prevue).toLocaleDateString('fr-FR')}`, 550, 100);
            
            // Tableau des marchandises
            this.addManifestTable(doc, marchandises.rows, 140);
            
            // Résumé
            const summary = this.calculateManifestSummary(marchandises.rows);
            const summaryY = 140 + (marchandises.rows.length * 20) + 40;
            
            doc.fontSize(10)
               .text(`Total clients: ${summary.totalClients}`, 50, summaryY)
               .text(`Total colis: ${summary.totalColis}`, 200, summaryY)
               .text(`Poids total: ${summary.totalPoids} kg`, 350, summaryY)
               .text(`Volume total: ${summary.totalVolume} m³`, 500, summaryY);
            
            // Signatures
            this.addSignatures(doc, summaryY + 40);
            
            doc.end();
            
            return { filename, filepath };
            
        } catch (error) {
            logger.error('Erreur génération manifeste:', error);
            throw error;
        }
    }
    
    /**
     * Ajouter l'en-tête du document
     */
    addHeader(doc, title) {
        doc.fontSize(20)
           .text(title, 50, 50, { align: 'center' })
           .moveDown();
    }
    
    /**
     * Ajouter le pied de page
     */
    addFooter(doc) {
        const pageHeight = doc.page.height;
        
        doc.fontSize(8)
           .text('Document généré automatiquement', 50, pageHeight - 50, { align: 'center' })
           .text(`Import Export Manager - ${new Date().toLocaleDateString('fr-FR')}`, 50, pageHeight - 35, { align: 'center' });
    }
    
    /**
     * Ajouter un tableau de facture
     */
    addInvoiceTable(doc, marchandise, startY) {
        // En-têtes
        doc.fontSize(10)
           .text('Description', 50, startY)
           .text('Quantité', 250, startY)
           .text('Prix unitaire', 350, startY)
           .text('Total', 450, startY);
        
        // Ligne
        doc.moveTo(50, startY + 15)
           .lineTo(550, startY + 15)
           .stroke();
        
        // Contenu
        const y = startY + 25;
        doc.text(marchandise.designation, 50, y)
           .text(marchandise.nombre_colis.toString(), 250, y)
           .text(`${(marchandise.cout_total / marchandise.nombre_colis).toFixed(2)} €`, 350, y)
           .text(`${marchandise.cout_total.toFixed(2)} €`, 450, y);
        
        // Services additionnels
        if (marchandise.cout_transport > 0) {
            doc.text('Transport', 50, y + 20)
               .text('1', 250, y + 20)
               .text(`${marchandise.cout_transport.toFixed(2)} €`, 350, y + 20)
               .text(`${marchandise.cout_transport.toFixed(2)} €`, 450, y + 20);
        }
    }
    
    /**
     * Ajouter la section paiements
     */
    addPaymentsSection(doc, paiements, startY) {
        doc.fontSize(12)
           .text('Paiements reçus:', 50, startY);
        
        let y = startY + 20;
        paiements.forEach(paiement => {
            doc.fontSize(10)
               .text(`${new Date(paiement.date_paiement).toLocaleDateString('fr-FR')} - ${this.formatPaymentMode(paiement.mode_paiement)}: ${paiement.montant_paye.toFixed(2)} €`, 70, y);
            y += 15;
        });
    }
    
    /**
     * Ajouter le tableau du manifeste
     */
    addManifestTable(doc, marchandises, startY) {
        // En-têtes
        const headers = ['Code', 'Client', 'Désignation', 'Nb Colis', 'Poids (kg)', 'Volume (m³)', 'Valeur (€)'];
        const colWidths = [80, 120, 150, 60, 70, 70, 80];
        let x = 50;
        
        doc.fontSize(10);
        headers.forEach((header, i) => {
            doc.text(header, x, startY);
            x += colWidths[i];
        });
        
        // Ligne
        doc.moveTo(50, startY + 15)
           .lineTo(730, startY + 15)
           .stroke();
        
        // Contenu
        let y = startY + 25;
        marchandises.forEach(item => {
            x = 50;
            doc.fontSize(9);
            
            const data = [
                item.code_barre,
                `${item.client_nom} ${item.client_prenom}`,
                item.designation.substring(0, 30),
                item.nombre_colis.toString(),
                item.poids?.toFixed(2) || '0.00',
                item.volume?.toFixed(3) || '0.000',
                item.valeur_declaree?.toFixed(2) || '0.00'
            ];
            
            data.forEach((text, i) => {
                doc.text(text, x, y, { width: colWidths[i] - 5, ellipsis: true });
                x += colWidths[i];
            });
            
            y += 20;
        });
    }
    
    /**
     * Calculer le résumé du manifeste
     */
    calculateManifestSummary(marchandises) {
        const clients = new Set(marchandises.map(m => m.client_id));
        
        return {
            totalClients: clients.size,
            totalColis: marchandises.reduce((sum, m) => sum + m.nombre_colis, 0),
            totalPoids: marchandises.reduce((sum, m) => sum + (m.poids || 0), 0).toFixed(2),
            totalVolume: marchandises.reduce((sum, m) => sum + (m.volume || 0), 0).toFixed(3)
        };
    }
    
    /**
     * Ajouter les zones de signature
     */
    addSignatures(doc, startY) {
        doc.fontSize(10)
           .text('Responsable chargement:', 50, startY)
           .rect(50, startY + 20, 200, 40)
           .stroke()
           .text('Transporteur:', 400, startY)
           .rect(400, startY + 20, 200, 40)
           .stroke();
    }
    
    /**
     * Formater le mode de paiement
     */
    formatPaymentMode(mode) {
        const modes = {
            especes: 'Espèces',
            virement: 'Virement bancaire',
            cheque: 'Chèque',
            carte: 'Carte bancaire',
            mobile_money: 'Mobile Money'
        };
        
        return modes[mode] || mode;
    }
}

module.exports = new PDFService();