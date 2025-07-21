-- =============================================
-- Migration: 001_add_photos_table.sql
-- Date: 2024-01-01
-- Description: Ajout d'une table pour stocker les photos des marchandises
-- =============================================

-- Vérifier si la migration a déjà été appliquée
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM schema_migrations WHERE version = '001') THEN
        
        -- Créer la table des photos
        CREATE TABLE IF NOT EXISTS photos (
            id SERIAL PRIMARY KEY,
            marchandise_id INTEGER NOT NULL,
            filename VARCHAR(255) NOT NULL,
            original_name VARCHAR(255),
            mime_type VARCHAR(100),
            size_bytes INTEGER,
            width INTEGER,
            height INTEGER,
            is_primary BOOLEAN DEFAULT FALSE,
            description TEXT,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            created_by INTEGER,
            
            -- Contraintes
            CONSTRAINT fk_photos_marchandise 
                FOREIGN KEY (marchandise_id) 
                REFERENCES marchandises(id) 
                ON DELETE CASCADE,
                
            CONSTRAINT fk_photos_user 
                FOREIGN KEY (created_by) 
                REFERENCES utilisateurs(id)
        );
        
        -- Index pour les performances
        CREATE INDEX idx_photos_marchandise ON photos(marchandise_id);
        CREATE INDEX idx_photos_primary ON photos(marchandise_id, is_primary) WHERE is_primary = TRUE;
        
        -- Trigger pour s'assurer qu'il n'y a qu'une seule photo principale par marchandise
        CREATE OR REPLACE FUNCTION ensure_single_primary_photo()
        RETURNS TRIGGER AS $$
        BEGIN
            IF NEW.is_primary = TRUE THEN
                UPDATE photos 
                SET is_primary = FALSE 
                WHERE marchandise_id = NEW.marchandise_id 
                    AND id != NEW.id 
                    AND is_primary = TRUE;
            END IF;
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
        
        CREATE TRIGGER trg_ensure_single_primary_photo
        BEFORE INSERT OR UPDATE ON photos
        FOR EACH ROW
        EXECUTE FUNCTION ensure_single_primary_photo();
        
        -- Ajouter une colonne sur marchandises pour référencer la photo principale
        ALTER TABLE marchandises 
        ADD COLUMN IF NOT EXISTS primary_photo_id INTEGER,
        ADD CONSTRAINT fk_marchandises_primary_photo 
            FOREIGN KEY (primary_photo_id) 
            REFERENCES photos(id) 
            ON DELETE SET NULL;
        
        -- Enregistrer la migration
        INSERT INTO schema_migrations (version, applied_at) 
        VALUES ('001', CURRENT_TIMESTAMP);
        
        RAISE NOTICE 'Migration 001_add_photos_table appliquée avec succès';
        
    ELSE
        RAISE NOTICE 'Migration 001_add_photos_table déjà appliquée';
    END IF;
END $$;

-- =============================================
-- Rollback (si nécessaire)
-- =============================================
-- Pour annuler cette migration, exécuter :
/*
DROP TRIGGER IF EXISTS trg_ensure_single_primary_photo ON photos;
DROP FUNCTION IF EXISTS ensure_single_primary_photo();
ALTER TABLE marchandises DROP COLUMN IF EXISTS primary_photo_id;
DROP TABLE IF EXISTS photos;
DELETE FROM schema_migrations WHERE version = '001';
*/