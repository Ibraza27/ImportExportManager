/**
 * Routes API pour la gestion des clients
 * Version complète avec toutes les améliorations
 */
const express = require('express');
const router = express.Router();
const { query, queryPrepared, transaction } = require('../database/connection');
const { logger } = require('../../shared/logger');
const authMiddleware = require('../middlewares/auth');
const { validateClient } = require('../middlewares/validation');
const auditService = require('../services/auditService');
const barcodeService = require('../services/barcodeService');

// Appliquer l'authentification à toutes les routes
router.use(authMiddleware);

/**
 * GET /api/clients
 * Récupérer tous les clients avec pagination et recherche
 */
router.get('/', async (req, res) => {
    try {
        const {
            page = 1,
            limit = 25,
            search,
            statut,
            ville,
            actif,
            sort = 'created_at:desc'
        } = req.query;

        const offset = (page - 1) * limit;
        const [sortField, sortOrder] = sort.split(':');

        // Construire la requête avec les bons noms de colonnes
        let whereClause = 'WHERE 1=1';
        const params = [];
        let paramIndex = 1;

        if (search) {
            whereClause += ` AND (
                LOWER(c.nom) LIKE LOWER($${paramIndex}) OR
                LOWER(c.prenom) LIKE LOWER($${paramIndex}) OR
                c.telephone_principal LIKE $${paramIndex} OR
                LOWER(c.email) LIKE LOWER($${paramIndex})
            )`;
            params.push(`%${search}%`);
            paramIndex++;
        }

        if (statut) {
            whereClause += ` AND c.statut = $${paramIndex}`;
            params.push(statut);
            paramIndex++;
        }

        if (ville) {
            whereClause += ` AND LOWER(c.ville) LIKE LOWER($${paramIndex})`;
            params.push(`%${ville}%`);
            paramIndex++;
        }

        if (actif !== undefined) {
            whereClause += ` AND c.actif = $${paramIndex}`;
            params.push(actif === 'true');
            paramIndex++;
        }

        // Requête pour le total
        const countQuery = `
            SELECT COUNT(*) as total
            FROM clients c
            ${whereClause}
        `;

        // Requête principale avec jointures optimisées
        const dataQuery = `
            SELECT
                c.*,
                COUNT(DISTINCT m.id) as total_colis,
                COUNT(DISTINCT m.conteneur_id) as total_conteneurs,
                COALESCE(SUM(m.cout_total), 0) as total_du,
                COALESCE((
                    SELECT SUM(p.montant_paye)
                    FROM paiements p
                    WHERE p.client_id = c.id AND p.statut = 'valide'
                ), 0) as total_paye
            FROM clients c
            LEFT JOIN marchandises m ON m.client_id = c.id
            ${whereClause}
            GROUP BY c.id
            ORDER BY ${sortField} ${sortOrder}
            LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
        `;

        params.push(parseInt(limit), offset);

        // Exécuter les requêtes
        const [countResult, dataResult] = await Promise.all([
            query(countQuery, params.slice(0, -2)),
            query(dataQuery, params)
        ]);

        const total = parseInt(countResult.rows[0]?.total || 0);

        res.json({
            success: true,
            data: dataResult.rows,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / limit)
            }
        });

    } catch (error) {
        logger.error('Erreur récupération clients:', error);
        res.status(500).json({
            success: false,
            error: 'Erreur lors de la récupération des clients'
        });
    }
});

/**
 * GET /api/clients/:id
 * Récupérer un client par ID avec toutes ses informations
 */
router.get('/:id', async (req, res) => {
    try {
        const clientId = parseInt(req.params.id);

        // Requête optimisée avec fonction PostgreSQL
        const clientQuery = `
            SELECT
                c.*,
                (SELECT row_to_json(s.*) FROM get_client_stats($1) s) as stats
            FROM clients c
            WHERE c.id = $1
        `;

        const result = await queryPrepared('getClientById', clientQuery, [clientId]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Client non trouvé'
            });
        }

        const client = result.rows[0];

        // Récupérer les adresses supplémentaires
        const adressesQuery = `
            SELECT * FROM adresses_livraison
            WHERE client_id = $1
            ORDER BY est_defaut DESC, created_at DESC
        `;

        const adressesResult = await query(adressesQuery, [clientId]);
        client.adresses_livraison = adressesResult.rows;

        // Récupérer les derniers paiements
        const paiementsQuery = `
            SELECT * FROM paiements
            WHERE client_id = $1 AND statut = 'valide'
            ORDER BY date_paiement DESC
            LIMIT 5
        `;
        const paiementsResult = await query(paiementsQuery, [clientId]);
        client.derniers_paiements = paiementsResult.rows;

        res.json({
            success: true,
            data: client
        });

    } catch (error) {
        logger.error('Erreur récupération client:', error);
        res.status(500).json({
            success: false,
            error: 'Erreur lors de la récupération du client'
        });
    }
});

/**
 * POST /api/clients
 * Créer un nouveau client
 */
router.post('/', validateClient, async (req, res) => {
    try {
        const clientData = req.body;

        // Générer un code client unique
        const codeClient = await generateClientCode();

        // Transaction pour créer le client et l'audit
        const result = await transaction(async (client) => {
            // Insérer le client
            const insertQuery = `
                INSERT INTO clients (
                    code_client, nom, prenom, telephone_principal,
                    telephone_secondaire, email, adresse_principale,
                    ville, code_postal, pays, notes, statut, actif,
                    created_by, updated_by
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $14)
                RETURNING *
            `;

            const values = [
                codeClient,
                clientData.nom,
                clientData.prenom,
                clientData.telephone_principal,
                clientData.telephone_secondaire || null,
                clientData.email || null,
                clientData.adresse_principale,
                clientData.ville,
                clientData.code_postal || null,
                clientData.pays || 'France',
                clientData.notes || null,
                clientData.statut || 'actif',
                clientData.actif !== false,
                req.user.id // created_by et updated_by
            ];

            const clientResult = await client.query(insertQuery, values);
            const newClient = clientResult.rows[0];

            // Générer un code-barres pour le client
            await barcodeService.generateBarcode(
                'CLIENT',
                newClient.id,
                codeClient
            );

            // Ajouter l'audit
            await auditService.log({
                user_id: req.user.id,
                action: 'CREATE',
                entity_type: 'client',
                entity_id: newClient.id,
                details: { nom: newClient.nom, prenom: newClient.prenom }
            }, client);

            return newClient;
        });

        // Émettre l'événement WebSocket si disponible
        if (req.io) {
            req.io.emit('nouveau_client', {
                id: result.id,
                nom: result.nom,
                prenom: result.prenom,
                statut: result.statut
            });
        }

        res.status(201).json({
            success: true,
            data: result,
            message: 'Client créé avec succès'
        });

    } catch (error) {
        logger.error('Erreur création client:', error);

        // Gérer l'erreur de code client dupliqué
        if (error.code === '23505' && error.constraint === 'clients_code_client_key') {
            return res.status(409).json({
                success: false,
                error: 'Ce code client existe déjà'
            });
        }

        res.status(500).json({
            success: false,
            error: 'Erreur lors de la création du client'
        });
    }
});

/**
 * PUT /api/clients/:id
 * Mettre à jour un client
 */
router.put('/:id', validateClient, async (req, res) => {
    try {
        const clientId = parseInt(req.params.id);
        const updates = req.body;

        // Construire la requête de mise à jour dynamiquement
        const fields = [];
        const values = [];
        let paramIndex = 1;

        // Liste des champs modifiables
        const allowedFields = [
            'nom', 'prenom', 'telephone_principal', 'telephone_secondaire',
            'email', 'adresse_principale', 'ville', 'code_postal', 'pays',
            'notes', 'statut', 'actif'
        ];

        for (const field of allowedFields) {
            if (updates.hasOwnProperty(field)) {
                fields.push(`${field} = $${paramIndex}`);
                values.push(updates[field]);
                paramIndex++;
            }
        }

        if (fields.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Aucune modification fournie'
            });
        }

        // Ajouter l'ID, l'utilisateur et la date de modification
        fields.push(`updated_at = CURRENT_TIMESTAMP`);
        fields.push(`updated_by = $${paramIndex}`);
        values.push(req.user.id);
        values.push(clientId);

        const updateQuery = `
            UPDATE clients
            SET ${fields.join(', ')}
            WHERE id = $${paramIndex + 1}
            RETURNING *
        `;

        const result = await transaction(async (client) => {
            // Récupérer l'ancien client pour l'audit
            const oldClientResult = await client.query('SELECT * FROM clients WHERE id = $1', [clientId]);

            if (oldClientResult.rows.length === 0) {
                throw new Error('Client non trouvé');
            }
            const oldClient = oldClientResult.rows[0];

            // Effectuer la mise à jour
            const updateResult = await client.query(updateQuery, values);
            const updatedClient = updateResult.rows[0];

            // Enregistrer l'audit
            await auditService.log({
                user_id: req.user.id,
                action: 'UPDATE',
                entity_type: 'client',
                entity_id: clientId,
                old_value: oldClient,
                new_value: updatedClient,
                details: { fields_updated: Object.keys(updates) }
            }, client);

            return updatedClient;
        });

        // Émettre l'événement WebSocket si disponible
        if (req.io) {
            req.io.emit('client_modifie', {
                id: result.id,
                updates: Object.keys(updates)
            });
        }

        res.json({
            success: true,
            data: result,
            message: 'Client mis à jour avec succès'
        });

    } catch (error) {
        logger.error('Erreur mise à jour client:', error);

        if (error.message === 'Client non trouvé') {
            return res.status(404).json({
                success: false,
                error: 'Client non trouvé'
            });
        }

        res.status(500).json({
            success: false,
            error: 'Erreur lors de la mise à jour du client'
        });
    }
});

/**
 * DELETE /api/clients/:id
 * Supprimer un client (soft delete)
 */
router.delete('/:id', async (req, res) => {
    try {
        const clientId = parseInt(req.params.id);

        // Vérifier s'il y a des marchandises actives
        const checkQuery = `
            SELECT COUNT(*) as count
            FROM marchandises
            WHERE client_id = $1 AND statut != 'livre'
        `;

        const checkResult = await query(checkQuery, [clientId]);

        if (parseInt(checkResult.rows[0].count) > 0) {
            return res.status(400).json({
                success: false,
                error: 'Impossible de supprimer un client avec des marchandises actives'
            });
        }

        // Soft delete
        const deleteQuery = `
            UPDATE clients
            SET actif = false, updated_at = CURRENT_TIMESTAMP, updated_by = $2
            WHERE id = $1
            RETURNING id, nom, prenom
        `;

        const result = await transaction(async (client) => {
            // Récupérer les données avant suppression pour l'audit
            const oldClientResult = await client.query('SELECT * FROM clients WHERE id = $1', [clientId]);
            const oldClient = oldClientResult.rows[0];

            // Effectuer la suppression logique
            const deleteResult = await client.query(deleteQuery, [clientId, req.user.id]);

            if (deleteResult.rows.length === 0) {
                throw new Error('Client non trouvé');
            }

            // Enregistrer l'audit
            await auditService.log({
                user_id: req.user.id,
                action: 'DELETE',
                entity_type: 'client',
                entity_id: clientId,
                old_value: oldClient,
                details: { nom: oldClient.nom, prenom: oldClient.prenom }
            }, client);

            return deleteResult.rows[0];
        });

        // Émettre l'événement WebSocket si disponible
        if (req.io) {
            req.io.emit('client_supprime', {
                id: result.id
            });
        }

        res.json({
            success: true,
            message: 'Client désactivé avec succès'
        });

    } catch (error) {
        logger.error('Erreur suppression client:', error);

        if (error.message === 'Client non trouvé') {
            return res.status(404).json({
                success: false,
                error: 'Client non trouvé'
            });
        }

        res.status(500).json({
            success: false,
            error: 'Erreur lors de la suppression du client'
        });
    }
});

/**
 * GET /api/clients/:id/marchandises
 * Récupérer les marchandises d'un client
 */
router.get('/:id/marchandises', async (req, res) => {
    try {
        const clientId = parseInt(req.params.id);
        const { page = 1, limit = 50, statut, conteneur_id } = req.query;
        const offset = (page - 1) * limit;

        let whereClause = 'WHERE m.client_id = $1';
        const params = [clientId];
        let paramIndex = 2;

        if (statut) {
            whereClause += ` AND m.statut = $${paramIndex}`;
            params.push(statut);
            paramIndex++;
        }

        if (conteneur_id) {
            whereClause += ` AND m.conteneur_id = $${paramIndex}`;
            params.push(parseInt(conteneur_id));
            paramIndex++;
        }

        const marchandisesQuery = `
            SELECT
                m.*,
                c.numero_conteneur,
                c.destination_pays,
                c.statut as conteneur_statut
            FROM marchandises m
            LEFT JOIN conteneurs c ON m.conteneur_id = c.id
            ${whereClause}
            ORDER BY m.date_reception DESC
            LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
        `;

        const countQuery = `
            SELECT COUNT(*) as total
            FROM marchandises m
            LEFT JOIN conteneurs c ON m.conteneur_id = c.id
            ${whereClause}
        `;

        params.push(parseInt(limit), offset);

        const [result, countResult] = await Promise.all([
            query(marchandisesQuery, params),
            query(countQuery, params.slice(0, -2))
        ]);

        res.json({
            success: true,
            data: result.rows,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: parseInt(countResult.rows[0]?.total || 0),
                pages: Math.ceil((parseInt(countResult.rows[0]?.total || 0)) / limit)
            }
        });

    } catch (error) {
        logger.error('Erreur récupération marchandises client:', error);
        res.status(500).json({
            success: false,
            error: 'Erreur lors de la récupération des marchandises'
        });
    }
});

/**
 * GET /api/clients/:id/paiements
 * Récupérer tous les paiements d'un client
 */
router.get('/:id/paiements', async (req, res) => {
    try {
        const clientId = parseInt(req.params.id);
        const { page = 1, limit = 50, statut } = req.query;
        const offset = (page - 1) * limit;

        let whereClause = 'WHERE p.client_id = $1';
        const params = [clientId];
        let paramIndex = 2;

        if (statut) {
            whereClause += ` AND p.statut = $${paramIndex}`;
            params.push(statut);
            paramIndex++;
        }

        const paiementsQuery = `
            SELECT p.*
            FROM paiements p
            ${whereClause}
            ORDER BY p.date_paiement DESC
            LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
        `;

        const countQuery = `
            SELECT COUNT(*) as total
            FROM paiements p
            ${whereClause}
        `;

        params.push(parseInt(limit), offset);

        const [result, countResult] = await Promise.all([
            query(paiementsQuery, params),
            query(countQuery, params.slice(0, -2))
        ]);

        res.json({
            success: true,
            data: result.rows,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: parseInt(countResult.rows[0]?.total || 0),
                pages: Math.ceil((parseInt(countResult.rows[0]?.total || 0)) / limit)
            }
        });

    } catch (error) {
        logger.error('Erreur récupération paiements client:', error);
        res.status(500).json({
            success: false,
            error: 'Erreur lors de la récupération des paiements'
        });
    }
});

/**
 * GET /api/clients/:id/balance
 * Récupérer le solde d'un client
 */
router.get('/:id/balance', async (req, res) => {
    try {
        const clientId = parseInt(req.params.id);

        const balanceQuery = `
            SELECT
                COALESCE(SUM(m.cout_total), 0) as total_due,
                COALESCE(SUM(p.montant_paye), 0) as total_paid,
                COALESCE(SUM(m.cout_total), 0) - COALESCE(SUM(p.montant_paye), 0) as balance
            FROM clients c
            LEFT JOIN marchandises m ON m.client_id = c.id
            LEFT JOIN paiements p ON p.client_id = c.id AND p.statut = 'valide'
            WHERE c.id = $1
            GROUP BY c.id
        `;

        const result = await query(balanceQuery, [clientId]);

        res.json({
            success: true,
            data: result.rows[0] || {
                total_due: 0,
                total_paid: 0,
                balance: 0
            }
        });

    } catch (error) {
        logger.error('Erreur récupération balance client:', error);
        res.status(500).json({
            success: false,
            error: 'Erreur lors de la récupération du solde'
        });
    }
});

/**
 * GET /api/clients/search/quick
 * Recherche rapide de clients (pour autocomplete)
 */
router.get('/search/quick', async (req, res) => {
    try {
        const { q } = req.query;

        if (!q || q.length < 2) {
            return res.json({ success: true, data: [] });
        }

        const searchQuery = `
            SELECT
                id, code_client, nom, prenom,
                telephone_principal, email
            FROM clients
            WHERE actif = true AND (
                LOWER(nom) LIKE LOWER($1) OR
                LOWER(prenom) LIKE LOWER($1) OR
                code_client LIKE $1 OR
                telephone_principal LIKE $1
            )
            ORDER BY nom, prenom
            LIMIT 10
        `;

        const result = await queryPrepared('quickSearchClients', searchQuery, [`%${q}%`]);

        res.json({
            success: true,
            data: result.rows
        });

    } catch (error) {
        logger.error('Erreur recherche rapide clients:', error);
        res.status(500).json({
            success: false,
            error: 'Erreur lors de la recherche'
        });
    }
});

/**
 * POST /api/clients/import
 * Importer des clients depuis un fichier CSV
 */
router.post('/import', async (req, res) => {
    try {
        // Vérifier si un fichier a été envoyé
        if (!req.files || !req.files.file) {
            return res.status(400).json({
                success: false,
                error: 'Aucun fichier Uploadé'
            });
        }

        const file = req.files.file;
        const results = [];

        // Lire et parser le fichier CSV
        const csvData = file.data.toString('utf8');
        const lines = csvData.split('\n');
        const headers = lines[0].split(',');

        // Valider les en-têtes
        const requiredHeaders = ['nom', 'prenom', 'telephone', 'email'];
        if (!requiredHeaders.every(h => headers.includes(h))) {
            return res.status(400).json({
                success: false,
                error: 'Format de fichier CSV invalide'
            });
        }

        // Préparer les données
        const clientsData = [];
        for (let i = 1; i < lines.length; i++) {
            if (!lines[i].trim()) continue;

            const values = lines[i].split(',');
            const client = {};

            headers.forEach((header, index) => {
                client[header.toLowerCase()] = values[index]?.trim();
            });

            // Ajouter les champs par défaut
            client.code_client = `IMP-${Date.now()}-${i}`;
            client.actif = true;
            client.statut = 'actif';
            client.created_by = req.user.id;
            client.updated_by = req.user.id;
            client.adresse_principale = client.adresse_principale || '';
            client.ville = client.ville || '';
            client.code_postal = client.code_postal || '';
            client.pays = 'France'; // Valeur par défaut

            clientsData.push(client);
        }

        // Transaction pour l'importation
        const result = await transaction(async (client) => {
            // Insérer tous les clients
            for (const clientData of clientsData) {
                const insertQuery = `
                    INSERT INTO clients (
                        code_client, nom, prenom, telephone_principal,
                        telephone_secondaire, email, adresse_principale,
                        ville, code_postal, pays, statut, actif,
                        created_by, updated_by
                    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
                    RETURNING *
                `;

                const values = [
                    clientData.code_client,
                    clientData.nom,
                    clientData.prenom,
                    clientData.telephone,
                    clientData.telephone_secondaire || null,
                    clientData.email || null,
                    clientData.adresse_principale || '',
                    clientData.ville || '',
                    clientData.code_postal || null,
                    clientData.pays || 'France',
                    clientData.statut || 'actif',
                    clientData.actif !== false,
                    req.user.id, // created_by
                    req.user.id  // updated_by
                ];

                const result = await client.query(insertQuery, values);
                results.push(result.rows[0]);

                // Générer un code-barres pour le client
                await barcodeService.generateBarcode(
                    'CLIENT',
                    result.rows[0].id,
                    clientData.code_client
                );
            }

            return results;
        });

        res.status(201).json({
            success: true,
            data: results,
            message: `${results.length} clients importés avec succès`
        });

    } catch (error) {
        logger.error('Erreur importation clients:', error);
        res.status(500).json({
            success: false,
            error: 'Erreur lors de l\'importation des clients'
        });
    }
});

/**
 * Fonction utilitaire pour générer un code client unique
 */
async function generateClientCode() {
    const year = new Date().getFullYear();
    const lastClient = await query(
        `SELECT code_client FROM clients
         WHERE code_client LIKE $1
         ORDER BY code_client DESC
         LIMIT 1`,
        [`CLI-${year}-%`]
    );

    let sequence = 1;
    if (lastClient.rows.length > 0) {
        const lastCode = lastClient.rows[0].code_client;
        const lastSequence = parseInt(lastCode.split('-')[2]);
        sequence = lastSequence + 1;
    }

    return `CLI-${year}-${sequence.toString().padStart(4, '0')}`;
}

module.exports = router;
