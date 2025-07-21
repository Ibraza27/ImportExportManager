-- =============================================
-- SCRIPT DE CRÉATION DE LA BASE DE DONNÉES FUSIONNÉE
-- Système de Gestion Import-Export Maritime
-- =============================================
-- Supprimer les tables existantes (ordre inverse des dépendances)
DROP TABLE IF EXISTS logs_audit CASCADE;
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS paiements CASCADE;
DROP TABLE IF EXISTS marchandises CASCADE;
DROP TABLE IF EXISTS conteneurs CASCADE;
DROP TABLE IF EXISTS clients CASCADE;
DROP TABLE IF EXISTS utilisateurs CASCADE;
DROP TABLE IF EXISTS parametres_systeme CASCADE;

-- =============================================
-- TABLE: parametres_systeme
-- Stocke les paramètres globaux de l'application
-- =============================================
CREATE TABLE parametres_systeme (
    id SERIAL PRIMARY KEY,
    cle VARCHAR(100) UNIQUE NOT NULL,
    valeur TEXT,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =============================================
-- TABLE: utilisateurs
-- Gestion des utilisateurs du système
-- =============================================
CREATE TABLE utilisateurs (
    id SERIAL PRIMARY KEY,
    nom VARCHAR(100) NOT NULL,
    prenom VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    mot_de_passe VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('admin', 'manager', 'gestionnaire', 'employe', 'operateur', 'comptable', 'viewer', 'invite')),
    statut VARCHAR(20) DEFAULT 'actif' CHECK (statut IN ('actif', 'inactif', 'suspendu')),
    actif BOOLEAN DEFAULT true,
    telephone VARCHAR(20),
    avatar_url VARCHAR(500),
    derniere_connexion TIMESTAMP,
    preferences JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index pour améliorer les performances
CREATE INDEX idx_utilisateurs_email ON utilisateurs(email);
CREATE INDEX idx_utilisateurs_role ON utilisateurs(role);

-- =============================================
-- TABLE: clients
-- Informations complètes des clients
-- =============================================
CREATE TABLE clients (
    id SERIAL PRIMARY KEY,
    code_client VARCHAR(50) UNIQUE NOT NULL,
    nom VARCHAR(100) NOT NULL,
    prenom VARCHAR(100) NOT NULL,
    telephone_principal VARCHAR(20) NOT NULL,
    telephone_secondaire VARCHAR(20),
    email VARCHAR(255),
    adresse_principale TEXT NOT NULL,
    adresse_livraison TEXT,
    ville VARCHAR(100),
    pays VARCHAR(100) DEFAULT 'France',
    code_postal VARCHAR(20),

    -- Informations complémentaires
    type_client VARCHAR(50) DEFAULT 'particulier' CHECK (type_client IN ('particulier', 'entreprise')),
    nom_entreprise VARCHAR(255),
    numero_entreprise VARCHAR(50),
    numero_tva VARCHAR(50),
    commentaires TEXT,
    photo_identite VARCHAR(255),

    -- Statistiques et finances
    nombre_envois INTEGER DEFAULT 0,
    volume_total DECIMAL(10,2) DEFAULT 0,
    chiffre_affaires_total DECIMAL(12,2) DEFAULT 0,
    credit_limite DECIMAL(12, 2) DEFAULT 0,
    balance_courante DECIMAL(12, 2) DEFAULT 0,
    total_achats DECIMAL(12, 2) DEFAULT 0,

    -- Statut et dates
    statut VARCHAR(20) DEFAULT 'actif' CHECK (statut IN ('actif', 'inactif', 'suspendu')),
    created_by INTEGER REFERENCES utilisateurs(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index pour optimiser les recherches
CREATE INDEX idx_clients_nom ON clients(nom);
CREATE INDEX idx_clients_prenom ON clients(prenom);
CREATE INDEX idx_clients_telephone ON clients(telephone_principal);
CREATE INDEX idx_clients_code ON clients(code_client);
CREATE INDEX idx_clients_statut ON clients(statut);

-- =============================================
-- TABLE: conteneurs
-- Gestion des conteneurs/dossiers
-- =============================================
CREATE TABLE conteneurs (
    id SERIAL PRIMARY KEY,
    numero_conteneur VARCHAR(50) UNIQUE NOT NULL,
    numero_dossier VARCHAR(50) UNIQUE NOT NULL,
    type_conteneur VARCHAR(50) DEFAULT '20_pieds' CHECK (type_conteneur IN ('20_pieds', '40_pieds', '40_pieds_hc')),
    destination_port VARCHAR(100) NOT NULL,
    destination_ville VARCHAR(100),
    destination_pays VARCHAR(100) NOT NULL,

    -- Type d'envoi et dates
    type_envoi VARCHAR(50) NOT NULL CHECK (type_envoi IN ('avec_dedouanement', 'sans_dedouanement')),
    date_ouverture DATE DEFAULT CURRENT_DATE,
    date_creation DATE DEFAULT CURRENT_DATE,
    date_chargement DATE,
    date_depart_prevue DATE,
    date_depart_reelle DATE,
    date_arrivee_prevue DATE,
    date_arrivee_reelle DATE,
    date_cloture DATE,

    -- Capacités
    capacite_volume_total DECIMAL(10,2) DEFAULT 0,
    capacite_poids_total DECIMAL(10,2) DEFAULT 0,
    capacite_volume_utilise DECIMAL(10, 2) DEFAULT 0,
    capacite_poids_utilise DECIMAL(10, 2) DEFAULT 0,

    -- Statut et coûts
    statut VARCHAR(50) DEFAULT 'ouvert' CHECK (statut IN ('ouvert', 'en_preparation', 'en_cours_chargement', 'pret_expedition', 'en_transit', 'arrive', 'cloture', 'livre')),
    cout_transport DECIMAL(10,2) DEFAULT 0,
    cout_dedouanement DECIMAL(10,2) DEFAULT 0,
    cout_manutention DECIMAL(10,2) DEFAULT 0,
    cout_total DECIMAL(10,2) GENERATED ALWAYS AS (cout_transport + cout_dedouanement + cout_manutention) STORED,

    -- Transports
    transporteur VARCHAR(255),
    numero_tracking VARCHAR(100),
    numero_plomb VARCHAR(50),

    -- Documents
    manifeste_path VARCHAR(255),
    documents JSONB DEFAULT '{}',

    -- Métadonnées
    created_by INTEGER REFERENCES utilisateurs(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index pour les recherches
CREATE INDEX idx_conteneurs_numero ON conteneurs(numero_conteneur);
CREATE INDEX idx_conteneurs_statut ON conteneurs(statut);
CREATE INDEX idx_conteneurs_destination ON conteneurs(destination_pays);
CREATE INDEX idx_conteneurs_dates ON conteneurs(date_depart_prevue, date_arrivee_prevue);

-- =============================================
-- TABLE: marchandises
-- Gestion des colis et marchandises
-- =============================================
CREATE TABLE marchandises (
    id SERIAL PRIMARY KEY,
    code_barre VARCHAR(100) UNIQUE NOT NULL,
    client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
    conteneur_id INTEGER REFERENCES conteneurs(id) ON DELETE SET NULL,

    -- Informations de réception
    date_reception TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    mode_reception VARCHAR(50) CHECK (mode_reception IN ('poste', 'depot_client', 'coursier')),
    etat_reception VARCHAR(50) DEFAULT 'bon_etat' CHECK (etat_reception IN ('bon_etat', 'endommage', 'fragile', 'manquant')),

    -- Description de la marchandise
    type_marchandise VARCHAR(50) NOT NULL CHECK (type_marchandise IN ('colis', 'vehicule', 'palette', 'autre')),
    designation TEXT NOT NULL,
    description_detaillee TEXT,
    nombre_colis INTEGER DEFAULT 1,
    poids DECIMAL(10,2),
    longueur DECIMAL(10,2),
    largeur DECIMAL(10,2),
    hauteur DECIMAL(10,2),
    volume DECIMAL(10,2),
    valeur_declaree DECIMAL(10,2),

    -- Provenance et suivi
    provenance VARCHAR(50) DEFAULT 'depot' CHECK (provenance IN ('poste', 'depot', 'domicile')),
    date_ajout_conteneur DATE,
    date_expedition TIMESTAMP,
    date_livraison TIMESTAMP,
    numero_suivi_postal VARCHAR(100),
    position_conteneur VARCHAR(50),

    -- État et statut
    etat VARCHAR(50) DEFAULT 'bon_etat' CHECK (etat IN ('bon_etat', 'endommage', 'fragile', 'perissable')),
    statut VARCHAR(50) DEFAULT 'en_attente' CHECK (statut IN ('receptionne', 'en_attente', 'affecte', 'en_conteneur', 'en_transit', 'arrive', 'livre', 'probleme', 'perdu', 'endommage')),

    -- Photos et documents
    photos JSONB DEFAULT '[]',
    documents JSONB DEFAULT '[]',

    -- Tarification
    cout_transport DECIMAL(10,2) DEFAULT 0,
    cout_manutention DECIMAL(10,2) DEFAULT 0,
    cout_assurance DECIMAL(10,2) DEFAULT 0,
    cout_stockage DECIMAL(10,2) DEFAULT 0,
    cout_total DECIMAL(10,2) GENERATED ALWAYS AS (cout_transport + cout_manutention + cout_assurance + cout_stockage) STORED,

    -- Facturation
    facture_generee BOOLEAN DEFAULT FALSE,

    -- Commentaires et métadonnées
    commentaires TEXT,
    scan_history JSONB DEFAULT '[]',
    notes TEXT,
    created_by INTEGER REFERENCES utilisateurs(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index pour optimiser les performances
CREATE INDEX idx_marchandises_code_barre ON marchandises(code_barre);
CREATE INDEX idx_marchandises_client ON marchandises(client_id);
CREATE INDEX idx_marchandises_conteneur ON marchandises(conteneur_id);
CREATE INDEX idx_marchandises_statut ON marchandises(statut);
CREATE INDEX idx_marchandises_dates ON marchandises(date_reception);

-- =============================================
-- TABLE: paiements
-- Gestion des paiements et transactions
-- =============================================
CREATE TABLE paiements (
    id SERIAL PRIMARY KEY,
    numero_recu VARCHAR(50) UNIQUE NOT NULL,
    client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE RESTRICT,
    conteneur_id INTEGER REFERENCES conteneurs(id) ON DELETE SET NULL,
    marchandise_id INTEGER REFERENCES marchandises(id) ON DELETE SET NULL,
    type_paiement VARCHAR(50) NOT NULL CHECK (type_paiement IN ('especes', 'virement', 'cheque', 'mobile_money', 'carte', 'acompte', 'solde', 'total', 'remboursement')),
    mode_paiement VARCHAR(50) NOT NULL CHECK (mode_paiement IN ('especes', 'virement', 'cheque', 'carte', 'mobile_money')),

    -- Montants
    montant_total_du DECIMAL(10,2),
    montant_paye DECIMAL(10,2) NOT NULL,
    montant_restant DECIMAL(10,2) GENERATED ALWAYS AS (montant_total_du - montant_paye) STORED,
    montant DECIMAL(12, 2) NOT NULL,
    devise VARCHAR(3) DEFAULT 'EUR',

    -- Détails du paiement
    date_paiement TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    date_echeance DATE,
    reference_transaction VARCHAR(100),
    reference_paiement VARCHAR(100),
    banque VARCHAR(100),
    numero_cheque VARCHAR(50),

    -- Statut et validation
    statut VARCHAR(50) DEFAULT 'valide' CHECK (statut IN ('en_attente', 'valide', 'annule', 'rembourse', 'rejete')),
    rappel_envoye BOOLEAN DEFAULT false,
    motif TEXT,
    facture_associee VARCHAR(100),

    -- Documents et métadonnées
    methode_details JSONB DEFAULT '{}',
    recu_path VARCHAR(255),
    recu_url VARCHAR(500),
    commentaires TEXT,
    notes TEXT,
    created_by INTEGER REFERENCES utilisateurs(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index pour les performances
CREATE INDEX idx_paiements_client ON paiements(client_id);
CREATE INDEX idx_paiements_conteneur ON paiements(conteneur_id);
CREATE INDEX idx_paiements_statut ON paiements(statut);
CREATE INDEX idx_paiements_date ON paiements(date_paiement);
CREATE INDEX idx_paiements_numero ON paiements(numero_recu);

-- =============================================
-- TABLE: notifications
-- Gestion des notifications système
-- =============================================
CREATE TABLE notifications (
    id SERIAL PRIMARY KEY,
    type VARCHAR(50) NOT NULL,
    titre VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    niveau VARCHAR(20) DEFAULT 'info' CHECK (niveau IN ('info', 'warning', 'error', 'success')),
    destinataire_id INTEGER REFERENCES utilisateurs(id) ON DELETE CASCADE,
    entite_type VARCHAR(50),
    entite_id INTEGER,
    lu BOOLEAN DEFAULT FALSE,
    date_lecture TIMESTAMP,
    donnees JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =============================================
-- TABLE: logs_audit
-- Journal d'audit pour traçabilité complète
-- =============================================
CREATE TABLE logs_audit (
    id SERIAL PRIMARY KEY,
    utilisateur_id INTEGER REFERENCES utilisateurs(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    entite VARCHAR(50) NOT NULL,
    entite_id INTEGER,
    anciennes_valeurs JSONB,
    nouvelles_valeurs JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index pour les recherches dans les logs
CREATE INDEX idx_logs_utilisateur ON logs_audit(utilisateur_id);
CREATE INDEX idx_logs_action ON logs_audit(action);
CREATE INDEX idx_logs_entite ON logs_audit(entite, entite_id);
CREATE INDEX idx_logs_date ON logs_audit(created_at);

-- =============================================
-- VUES UTILES
-- =============================================
-- Vue pour le tableau de bord des conteneurs
CREATE VIEW vue_conteneurs_dashboard AS
SELECT
    c.id,
    c.numero_conteneur,
    c.destination_pays,
    c.statut,
    c.date_depart_prevue,
    COUNT(DISTINCT m.client_id) as nombre_clients,
    COUNT(m.id) as nombre_marchandises,
    c.capacite_volume_utilise as volume_utilise,
    c.capacite_poids_utilise as poids_utilise,
    ROUND((c.capacite_volume_utilise / NULLIF(c.capacite_volume_total, 0)) * 100, 2) as taux_remplissage,
    c.cout_total,
    COALESCE(SUM(p.montant_paye), 0) as total_paye,
    c.cout_total - COALESCE(SUM(p.montant_paye), 0) as total_restant
FROM conteneurs c
LEFT JOIN marchandises m ON m.conteneur_id = c.id
LEFT JOIN paiements p ON p.conteneur_id = c.id AND p.statut = 'valide'
GROUP BY c.id;

-- Vue pour le résumé client
CREATE VIEW vue_clients_resume AS
SELECT
    cl.id,
    cl.code_client,
    cl.nom,
    cl.prenom,
    cl.telephone_principal,
    COUNT(DISTINCT m.id) as nombre_colis,
    COUNT(DISTINCT m.conteneur_id) as nombre_conteneurs,
    COALESCE(SUM(p.montant_total_du), 0) as total_du,
    COALESCE(SUM(p.montant_paye), 0) as total_paye,
    COALESCE(SUM(p.montant_total_du), 0) - COALESCE(SUM(p.montant_paye), 0) as solde
FROM clients cl
LEFT JOIN marchandises m ON m.client_id = cl.id
LEFT JOIN paiements p ON p.client_id = cl.id AND p.statut = 'valide'
WHERE cl.statut = 'actif'
GROUP BY cl.id;

-- =============================================
-- TRIGGERS POUR MISE À JOUR AUTOMATIQUE
-- =============================================
-- Fonction pour mettre à jour updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Appliquer le trigger à toutes les tables
CREATE TRIGGER update_clients_updated_at BEFORE UPDATE ON clients
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_conteneurs_updated_at BEFORE UPDATE ON conteneurs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_marchandises_updated_at BEFORE UPDATE ON marchandises
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_paiements_updated_at BEFORE UPDATE ON paiements
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_utilisateurs_updated_at BEFORE UPDATE ON utilisateurs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- DONNÉES INITIALES
-- =============================================
-- Paramètres système par défaut
INSERT INTO parametres_systeme (cle, valeur, description) VALUES
('DEVISE_DEFAUT', 'EUR', 'Devise par défaut'),
('TAUX_TVA', '20', 'Taux de TVA en pourcentage'),
('PREFIX_CODE_CLIENT', 'CLI', 'Préfixe pour les codes clients'),
('PREFIX_CODE_BARRE', 'CB', 'Préfixe pour les codes-barres'),
('PREFIX_NUMERO_RECU', 'REC', 'Préfixe pour les numéros de reçu'),
('DELAI_RAPPEL_PAIEMENT', '7', 'Délai en jours avant rappel de paiement'),
('PAYS_DEFAUT', 'France', 'Pays par défaut');

-- Utilisateur admin par défaut
INSERT INTO utilisateurs (nom, prenom, email, mot_de_passe, role, telephone) VALUES
('IBRAHIM', 'IBRAZA', 'ibrahim.ibraza@hotmail.fr', '$2b$10$YourHashedPasswordHere', 'admin', '0668452834');

-- Données de test (optionnel)
INSERT INTO clients (code_client, nom, prenom, email, telephone_principal, adresse_principale, ville, pays, created_by) VALUES
('CLI001', 'DUPONT', 'Jean', 'jean.dupont@email.com', '0612345678', '123 Rue de la Paix', 'Brazzaville', 'Congo', 1),
('CLI002', 'MARTIN', 'Marie', 'marie.martin@email.com', '0623456789', '456 Avenue des Champs', 'Pointe-Noire', 'Congo', 1);

-- Message de confirmation
DO $$
BEGIN
    RAISE NOTICE 'Base de données créée avec succès !';
    RAISE NOTICE 'Tables créées: parametres_systeme, utilisateurs, clients, conteneurs, marchandises, paiements, notifications, logs_audit';
    RAISE NOTICE 'Utilisateur admin créé: admin@import-export.com';
END $$;
