-- =====================================================================
-- Lot 6 Phase 1 — Fondations RGPD
-- Date      : 2026-04-24
-- Auteur    : Système expert QHSE
-- Références: RGPD Art. 5/6/12/15/17/20/30, ISO 27701, Code du travail
--
-- NOTE DÉPLOIEMENT :
--   Livré dans db/migrations/ — à copier dans supabase/migrations/
--   côté poste Windows pour `supabase db push`, ou à coller dans
--   Dashboard Supabase → SQL Editor pour déploiement manuel.
--
-- PORTÉE :
--   1. Traçabilité d'anonymisation sur tables à données personnelles
--   2. Consentement d'embauche sur rh_employes
--   3. Table rgpd_demandes (registre des demandes Art. 15-21)
--   4. Trigger updated_at sur rgpd_demandes
--
-- IMPACT SUR DONNÉES EXISTANTES :
--   - AUCUN : colonnes ajoutées en NULL par défaut (IF NOT EXISTS partout)
--   - Les CHECK constraints ne s'appliquent qu'aux INSERT futurs
--     (rgpd_demandes est créée vide).
--
-- NON INCLUS (reporté en Phase 2, nécessite Supabase Auth) :
--   - RLS sur rgpd_demandes (lecture admin/responsable_qhse uniquement)
--   - Policies employé self-service (consulter ses propres demandes)
--   - Création automatique de rgpd_demandes lors d'un export
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1. Colonne rgpd_anonymise_le — tables à données personnelles directes
--    Pattern d'anonymisation retenu (préserve l'intégrité des liens audit) :
--      UPDATE table SET nom='[ANONYMISÉ]', prenom='[ANONYMISÉ]',
--                       email=NULL, rgpd_anonymise_le=NOW()
-- ---------------------------------------------------------------------

ALTER TABLE IF EXISTS public.rh_employes
  ADD COLUMN IF NOT EXISTS rgpd_anonymise_le TIMESTAMPTZ;

ALTER TABLE IF EXISTS public.habilitations
  ADD COLUMN IF NOT EXISTS rgpd_anonymise_le TIMESTAMPTZ;

ALTER TABLE IF EXISTS public.rh_habilitations
  ADD COLUMN IF NOT EXISTS rgpd_anonymise_le TIMESTAMPTZ;

ALTER TABLE IF EXISTS public.rh_formations
  ADD COLUMN IF NOT EXISTS rgpd_anonymise_le TIMESTAMPTZ;

ALTER TABLE IF EXISTS public.securite_accidents
  ADD COLUMN IF NOT EXISTS rgpd_anonymise_le TIMESTAMPTZ;

COMMENT ON COLUMN public.rh_employes.rgpd_anonymise_le IS
  'Timestamp d''anonymisation RGPD Art. 17. NULL = actif. Préserve les liens audit.';

-- ---------------------------------------------------------------------
-- 2. Consentement à l'embauche (rh_employes uniquement)
--    Art. 13 : information de la personne au moment de la collecte
-- ---------------------------------------------------------------------

ALTER TABLE IF EXISTS public.rh_employes
  ADD COLUMN IF NOT EXISTS rgpd_consentement_date TIMESTAMPTZ;

COMMENT ON COLUMN public.rh_employes.rgpd_consentement_date IS
  'Date de signature de la notice d''information RGPD (Art. 13). NULL = à régulariser.';

-- ---------------------------------------------------------------------
-- 3. Table rgpd_demandes — registre des demandes d'exercice des droits
--    Art. 12 : délai de réponse 1 mois, extensible à 3 mois.
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.rgpd_demandes (
  id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Typage strict — alignement avec src/utils/rgpd.js TYPES_DEMANDE_RGPD
  type             TEXT         NOT NULL
                   CHECK (type IN ('ACCES','RECTIFICATION','EFFACEMENT',
                                   'LIMITATION','PORTABILITE','OPPOSITION')),
  statut           TEXT         NOT NULL DEFAULT 'EN_COURS'
                   CHECK (statut IN ('EN_COURS','TRAITEE','REJETEE','EXPIREE')),
  -- Personne concernée (employé référencé OU tiers externe)
  employe_id       UUID         REFERENCES public.rh_employes(id) ON DELETE SET NULL,
  nom_demandeur    TEXT         NOT NULL,
  email_demandeur  TEXT,
  -- Dates clés
  date_reception   DATE         NOT NULL DEFAULT CURRENT_DATE,
  date_echeance    DATE         NOT NULL,
  date_traitement  DATE,
  -- Justifications et suivi
  motif            TEXT,
  reponse          TEXT,
  pieces_jointes   JSONB        DEFAULT '[]'::jsonb,
  -- Audit minimal
  cree_par         TEXT,
  traite_par       TEXT,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  -- Cohérence temporelle (ISO-strict : pas de dates impossibles)
  CONSTRAINT rgpd_demandes_dates_coherentes
    CHECK (date_echeance >= date_reception),
  CONSTRAINT rgpd_demandes_traitement_coherent
    CHECK (date_traitement IS NULL OR date_traitement >= date_reception)
);

COMMENT ON TABLE public.rgpd_demandes IS
  'Registre des demandes d''exercice des droits RGPD (Art. 15-21). Délai légal 1 mois (Art. 12).';

-- ---------------------------------------------------------------------
-- 4. Index de performance
-- ---------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_rgpd_demandes_statut
  ON public.rgpd_demandes(statut);

CREATE INDEX IF NOT EXISTS idx_rgpd_demandes_employe
  ON public.rgpd_demandes(employe_id)
  WHERE employe_id IS NOT NULL;

-- Index partiel sur les demandes ouvertes — optimise l'alerte retards
CREATE INDEX IF NOT EXISTS idx_rgpd_demandes_echeance_ouvertes
  ON public.rgpd_demandes(date_echeance)
  WHERE statut = 'EN_COURS';

-- ---------------------------------------------------------------------
-- 5. Trigger updated_at — réutilise la fonction existante sécurisée
-- ---------------------------------------------------------------------

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
             WHERE n.nspname = 'public' AND p.proname = 'update_updated_at_column') THEN
    DROP TRIGGER IF EXISTS trg_rgpd_demandes_updated_at ON public.rgpd_demandes;
    CREATE TRIGGER trg_rgpd_demandes_updated_at
      BEFORE UPDATE ON public.rgpd_demandes
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  ELSIF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                WHERE n.nspname = 'public' AND p.proname = 'update_updated_at') THEN
    DROP TRIGGER IF EXISTS trg_rgpd_demandes_updated_at ON public.rgpd_demandes;
    CREATE TRIGGER trg_rgpd_demandes_updated_at
      BEFORE UPDATE ON public.rgpd_demandes
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
  END IF;
END $$;

COMMIT;

-- =====================================================================
-- VALIDATION POST-MIGRATION
-- =====================================================================
-- SELECT table_name, column_name FROM information_schema.columns
-- WHERE table_schema='public' AND column_name='rgpd_anonymise_le';
-- -- Doit retourner 5 lignes
--
-- SELECT COUNT(*) FROM public.rgpd_demandes;  -- = 0 à l'installation
--
-- INSERT INTO public.rgpd_demandes (type, nom_demandeur, date_echeance)
-- VALUES ('ACCES', 'TEST', CURRENT_DATE + INTERVAL '1 month');
-- DELETE FROM public.rgpd_demandes WHERE nom_demandeur='TEST';
-- =====================================================================
