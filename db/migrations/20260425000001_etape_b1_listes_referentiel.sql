-- =====================================================================
-- Étape B1 — Centralisation des listes de référence dans Supabase
-- =====================================================================
-- Source unique pour les listes éditables (Familles de risques, Origines,
-- Postes, etc.) afin que tous les utilisateurs partagent les mêmes
-- valeurs. Avant : localStorage par navigateur (étape A) — chaque poste
-- avait sa propre version, pas de synchronisation.
--
-- Le client garde localStorage comme cache (rapidité + offline), mais la
-- vérité est désormais dans cette table.
--
-- POSTURE SÉCURITÉ : RLS désactivé pour rester homogène avec les autres
-- tables métier (registre_duerp, plan_actions, etc.) qui sont également
-- en RLS off à ce jour. Quand l'authentification sera activée globalement
-- (Lot 6 RGPD ou suivant), une migration dédiée activera RLS sur toutes
-- les tables d'un seul coup, y compris celle-ci.
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.listes_referentiel (
  id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  storage_key  TEXT         NOT NULL,
  key          TEXT         NOT NULL,
  valeurs      JSONB        NOT NULL DEFAULT '[]'::jsonb,
  updated_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_by   TEXT,
  CONSTRAINT listes_referentiel_unique UNIQUE (storage_key, key),
  -- Contrainte de forme : valeurs DOIT être un tableau JSON (et pas un objet/scalaire)
  CONSTRAINT listes_referentiel_valeurs_array CHECK (jsonb_typeof(valeurs) = 'array')
);

-- Index secondaire pour les requêtes par module
CREATE INDEX IF NOT EXISTS idx_listes_referentiel_storage_key
  ON public.listes_referentiel (storage_key);

-- Trigger updated_at — fonction `update_updated_at_column` déjà présente
DROP TRIGGER IF EXISTS trg_listes_referentiel_updated_at ON public.listes_referentiel;
CREATE TRIGGER trg_listes_referentiel_updated_at
  BEFORE UPDATE ON public.listes_referentiel
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

COMMENT ON TABLE  public.listes_referentiel IS 'Listes de référence éditables partagées (étape B). Utilisé par RegistreDUERP, PlanActions, Habilitations, Environnement, QualiteAudits, SocialRH, SecuriteAccidents.';
COMMENT ON COLUMN public.listes_referentiel.storage_key IS 'Identifiant du module (ex. duerp, plan_actions, accidents). Aligné sur GestionListes.';
COMMENT ON COLUMN public.listes_referentiel.key         IS 'Libellé de la liste dans le module (ex. "Familles de risques", "Origines"). Aligné sur LISTES_<MODULE>.';
COMMENT ON COLUMN public.listes_referentiel.valeurs     IS 'Tableau JSON de chaînes — la liste finale, dans l''ordre voulu par l''utilisateur.';

-- Étape B6 — Realtime : permet aux clients React abonnés de recevoir
-- en direct toute modification (ajout, réorganisation, suppression, fusion
-- par import) effectuée par un autre poste. Le hook useListe s'abonne
-- automatiquement par (storage_key, key).
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname='supabase_realtime' AND schemaname='public' AND tablename='listes_referentiel'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.listes_referentiel';
  END IF;
END $$;
