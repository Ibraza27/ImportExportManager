-- =============================================
-- Migration 001: Ajout d'index pour les performances
-- =============================================

-- Index pour améliorer les recherches
CREATE INDEX IF NOT EXISTS idx_clients_search ON clients(nom, prenom, telephone_principal);
CREATE INDEX IF NOT EXISTS idx_marchandises_date ON marchandises(date_reception);
CREATE INDEX IF NOT EXISTS idx_conteneurs_dates ON conteneurs(date_depart_prevue, date_arrivee_prevue);
CREATE INDEX IF NOT EXISTS idx_paiements_client_date ON paiements(client_id, date_paiement);

-- Index pour les jointures fréquentes
CREATE INDEX IF NOT EXISTS idx_marchandises_client_conteneur ON marchandises(client_id, conteneur_id);
CREATE INDEX IF NOT EXISTS idx_paiements_marchandise ON paiements(marchandise_id);

-- Index pour les statuts
CREATE INDEX IF NOT EXISTS idx_marchandises_statut_client ON marchandises(statut, client_id);
CREATE INDEX IF NOT EXISTS idx_conteneurs_statut_date ON conteneurs(statut, date_depart_prevue);