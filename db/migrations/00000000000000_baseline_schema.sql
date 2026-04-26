-- =====================================================================
-- 00000000000000_baseline_schema.sql — État initial du schéma
-- =====================================================================
-- Reflète l'état complet du schéma `public` à appliquer en PREMIER lors
-- d'une installation sur une nouvelle instance Supabase. Capture toutes
-- les tables, contraintes, index, triggers, fonctions et policies RLS
-- existantes AVANT les migrations 20260425* (étapes B et E).
--
-- Histoire :
--   Les 25 tables ci-dessous ont été créées progressivement entre mars
--   et avril 2026 via le Supabase Table Editor (interface web), donc
--   sans migration SQL versionnée. Ce fichier consolide leur structure
--   à la date du 25/04/2026.
--
-- Ordre d'application sur une instance vierge :
--   1. Ce fichier (baseline)
--   2. db/migrations/20260425000001_etape_b1_listes_referentiel.sql
--   3. db/migrations/20260425000002_etape_e1_user_roles_auth.sql
--   4. db/migrations/20260425000003_etape_e7_rls_tables_metier.sql
--
-- ⚠️  NE PAS appliquer les migrations 20260424* sur une instance neuve :
--     leurs ajouts (RGPD fields, etc.) sont déjà inclus dans ce baseline.
-- =====================================================================

-- ─── 1. Fonctions utilitaires (avant les triggers qui en dépendent) ────

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS trigger LANGUAGE plpgsql
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ─── 2. Tables métier ──────────────────────────────────────────────────

-- Plans de prévention (UUID, RLS auto-créée plus bas)
CREATE TABLE IF NOT EXISTS public.plans_prevention (
  id                       uuid                     NOT NULL DEFAULT gen_random_uuid(),
  created_at               timestamp with time zone DEFAULT now(),
  updated_at               timestamp with time zone DEFAULT now(),
  lieu                     text                     NOT NULL,
  entreprise_exterieure    text                     NOT NULL,
  date_travaux             date                     NOT NULL,
  responsable              text,
  contact_urgence          text,
  description_travaux      text,
  photos                   jsonb                    DEFAULT '[]'::jsonb,
  risques_selectionnes     jsonb                    DEFAULT '{}'::jsonb,
  mesures_prevention       text,
  statut                   text                     DEFAULT 'brouillon'::text,
  created_by               uuid,
  reponses                 jsonb                    DEFAULT '{}'::jsonb,
  observations_questions   jsonb                    DEFAULT '{}'::jsonb,
  photos_questions         jsonb                    DEFAULT '{}'::jsonb,
  type_travaux             text,
  type_intervention        text,
  environnement            jsonb                    DEFAULT '[]'::jsonb,
  meteo                    text,
  temperature              text,
  intervenants             text,
  score_risque             integer,
  niveau_risque            text,
  mesures_suggerees        jsonb                    DEFAULT '[]'::jsonb,
  signature_qhse           text,
  signature_responsable    text
);

-- Actions correctives (UUID liées aux plans de prévention)
CREATE TABLE IF NOT EXISTS public.actions_correctives (
  id           uuid                     NOT NULL DEFAULT gen_random_uuid(),
  plan_id      uuid                     NOT NULL,
  created_by   uuid,
  description  text                     NOT NULL DEFAULT ''::text,
  responsable  text                     NOT NULL DEFAULT ''::text,
  echeance     date,
  statut       text                     NOT NULL DEFAULT 'todo'::text,
  question_id  text,
  created_at   timestamp with time zone NOT NULL DEFAULT now(),
  updated_at   timestamp with time zone NOT NULL DEFAULT now()
);

-- Templates de plans de prévention (UUID)
CREATE TABLE IF NOT EXISTS public.templates_pdp (
  id          uuid                     NOT NULL DEFAULT gen_random_uuid(),
  created_by  uuid,
  name        text                     NOT NULL DEFAULT ''::text,
  data        jsonb                    NOT NULL DEFAULT '{}'::jsonb,
  created_at  timestamp with time zone NOT NULL DEFAULT now()
);

-- Analyses de risques chantier (BIGINT manuel, l'app fournit l'id)
CREATE TABLE IF NOT EXISTS public.analyses_risque (
  id                    bigint  NOT NULL,
  chantier              text,
  adresse               text,
  type                  text,
  type_custom           text,
  type_intervention     text,
  environnement         jsonb   DEFAULT '[]'::jsonb,
  meteo                 text,
  temperature           text,
  responsable           text,
  entreprise            text,
  intervenants          text,
  date                  text,
  heure                 text,
  reponses              jsonb   DEFAULT '{}'::jsonb,
  observations          jsonb   DEFAULT '{}'::jsonb,
  actions_preventives   jsonb   DEFAULT '[]'::jsonb,
  statut                text    DEFAULT 'en_cours'::text,
  saved_at              timestamp with time zone DEFAULT now(),
  created_at            timestamp with time zone DEFAULT now(),
  signature             text,
  photos                jsonb   DEFAULT '{}'::jsonb
);

-- Audit log (BIGINT IDENTITY ALWAYS — incrément contrôlé)
CREATE TABLE IF NOT EXISTS public.audit_log (
  id          bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  table_name  text,
  record_id   text,
  action      text,
  details     jsonb DEFAULT '{}'::jsonb,
  user_name   text,
  created_at  timestamp with time zone DEFAULT now()
);

-- Calendrier custom
CREATE TABLE IF NOT EXISTS public.calendrier_custom (
  id          bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  titre       text,
  date_debut  date,
  date_fin    date,
  type        text,
  description text,
  created_at  timestamp with time zone DEFAULT now()
);

-- Configuration entreprise (singleton id=1)
CREATE TABLE IF NOT EXISTS public.config_entreprise (
  id         integer NOT NULL DEFAULT 1,
  nom        text    DEFAULT 'DEF Réunion'::text,
  effectif   integer DEFAULT 50,
  h_an       integer DEFAULT 1607,
  updated_at timestamp with time zone DEFAULT now()
);

-- Environnement / flux (BIGINT IDENTITY BY DEFAULT)
CREATE TABLE IF NOT EXISTS public.environnement_flux (
  id              bigint GENERATED BY DEFAULT AS IDENTITY NOT NULL,
  date_releve     date,
  flux            text,
  quantite        numeric,
  unite           text,
  date_relevement date,
  type_flux       text,
  notes           text
);

-- Fournisseurs évaluations
CREATE TABLE IF NOT EXISTS public.fournisseurs_eval (
  id              bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  nom             text NOT NULL,
  contact         text,
  secteur         text,
  statut          text DEFAULT 'En évaluation'::text,
  note_qualite    integer,
  note_delai      integer,
  note_prix       integer,
  note_service    integer,
  note_conformite integer,
  commentaire     text,
  date_eval       date DEFAULT CURRENT_DATE
);

-- Habilitations (avec colonnes RGPD lot6)
CREATE TABLE IF NOT EXISTS public.habilitations (
  id                 bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  employe            text,
  domaine            text,
  obtention          date,
  "validiteAns"      integer DEFAULT 2,
  archived_at        timestamp with time zone,
  archived_by        text,
  rgpd_anonymise_le  timestamp with time zone
);

-- KPIs mensuels (suivi annuel)
CREATE TABLE IF NOT EXISTS public.kpi_mensuels (
  id            bigint GENERATED BY DEFAULT AS IDENTITY NOT NULL,
  mois          text,
  ordre         integer,
  tf1           numeric,
  qualite_nc    numeric,
  carbone       numeric,
  satisfaction  numeric
);

-- KPIs objectifs (singleton id=1)
CREATE TABLE IF NOT EXISTS public.kpi_objectifs (
  id              integer NOT NULL DEFAULT 1,
  tf              numeric DEFAULT 10,
  tg              numeric DEFAULT 1,
  taux_cloture    integer DEFAULT 70,
  taux_habs       integer DEFAULT 90,
  taux_maitrise   integer DEFAULT 70,
  acc_arret       integer DEFAULT 0,
  actions_retard  integer DEFAULT 0,
  satisfaction    numeric DEFAULT 7,
  updated_at      timestamp with time zone DEFAULT now()
);

-- Objectifs QHSE annuels
CREATE TABLE IF NOT EXISTS public.objectifs_qhse (
  id              bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  annee           integer DEFAULT (EXTRACT(year FROM now()))::integer,
  categorie       text,
  titre           text,
  description     text,
  valeur_cible    numeric,
  valeur_reelle   numeric,
  unite           text DEFAULT '%'::text,
  sens            text DEFAULT 'max'::text,
  actif           boolean DEFAULT true
);

-- Plan d'actions (PDCA)
CREATE TABLE IF NOT EXISTS public.plan_actions (
  id                            bigint GENERATED BY DEFAULT AS IDENTITY NOT NULL,
  origine                       text,
  domaine                       text,
  action                        text,
  pilote                        text,
  echeance                      date,
  priorite                      text,
  statut                        text,
  created_at                    timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  commentaire                   text,
  cause_racine                  text,
  type_action                   text DEFAULT 'Corrective'::text,
  cout_estime                   numeric DEFAULT 0,
  cout_reel                     numeric,
  reference_source              text,
  date_cible_revisee            date,
  avancement_pct                integer DEFAULT 0,
  date_verification_efficacite  date,
  resultat_efficacite           text DEFAULT 'Non évalué'::text,
  nombre_reports                integer DEFAULT 0,
  archived_at                   timestamp with time zone,
  archived_by                   text,
  titre                         text
);

-- Audits qualité
CREATE TABLE IF NOT EXISTS public.qualite_audits (
  id           bigint GENERATED BY DEFAULT AS IDENTITY NOT NULL,
  processus    text,
  auditeur     text,
  date_prevue  date,
  statut       text,
  score        numeric,
  titre        text DEFAULT 'Audit'::text,
  type_audit   text,
  date         date
);

-- Non-conformités
CREATE TABLE IF NOT EXISTS public.qualite_nc (
  id                 bigint GENERATED BY DEFAULT AS IDENTITY NOT NULL,
  date_nc            date,
  processus          text,
  origine            text,
  description        text,
  type_nc            text DEFAULT 'Mineure'::text,
  statut_nc          text DEFAULT 'Ouverte'::text,
  action_corrective  text,
  archived_at        timestamp with time zone,
  archived_by        text
);

-- Qualité de vie au travail (campagnes)
CREATE TABLE IF NOT EXISTS public.qualite_qvt (
  id              bigint GENERATED BY DEFAULT AS IDENTITY NOT NULL,
  date_campagne   date,
  nom_campagne    text,
  effectif_total  integer DEFAULT 0,
  reponses        integer DEFAULT 0,
  note_moyenne    numeric DEFAULT 0
);

-- Satisfaction client
CREATE TABLE IF NOT EXISTS public.qualite_satisfaction (
  id            bigint GENERATED BY DEFAULT AS IDENTITY NOT NULL,
  date_enquete  date,
  client        text,
  projet        text,
  note_globale  numeric,
  commentaire   text
);

-- Registre DUERP (évaluation des risques)
CREATE TABLE IF NOT EXISTS public.registre_duerp (
  id                     bigint GENERATED BY DEFAULT AS IDENTITY NOT NULL,
  date_maj               date,
  unite_travail          text,
  danger                 text,
  risque                 text,
  gravite                numeric,
  probabilite            numeric,
  criticite              numeric,
  action_preventive      text,
  pilote                 text,
  echeance               date,
  famille_risque         text,
  evenement_declencheur  text,
  dommage_potentiel      text,
  personnes_exposees     text,
  a_mesure_epc           boolean DEFAULT false,
  mesures_epc            text,
  a_mesure_orga          boolean DEFAULT false,
  mesures_orga           text,
  a_mesure_epi           boolean DEFAULT false,
  mesures_epi            text,
  criticite_resid        integer,
  coefficient_reducteur  numeric(4,2),
  archived_at            timestamp with time zone,
  archived_by            text
);

-- Réunions QHSE
CREATE TABLE IF NOT EXISTS public.reunions_qhse (
  id              bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  date            date,
  type            text,
  statut          text DEFAULT 'Planifiée'::text,
  lieu            text,
  animateur       text,
  participants    text,
  ordre_du_jour   text,
  decisions       text,
  actions_json    json DEFAULT '[]'::json
);

-- RH — Employés (avec colonnes RGPD lot6)
CREATE TABLE IF NOT EXISTS public.rh_employes (
  id                       bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  nom                      text,
  prenom                   text,
  poste                    text,
  service                  text,
  contrat                  text DEFAULT 'CDI'::text,
  date_entree              date,
  actif                    boolean DEFAULT true,
  rgpd_anonymise_le        timestamp with time zone,
  rgpd_consentement_date   timestamp with time zone
);

-- RH — Formations (avec colonnes RGPD lot6)
CREATE TABLE IF NOT EXISTS public.rh_formations (
  id                  bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  titre               text,
  type_formation      text,
  organisme           text,
  date_debut          date,
  date_fin            date,
  duree_heures        numeric DEFAULT 7,
  participants        text,
  cout                numeric,
  statut              text DEFAULT 'Planifiée'::text,
  notes               text,
  rgpd_anonymise_le   timestamp with time zone
);

-- RH — Habilitations (table héritée d'une ancienne version, conservée pour compatibilité)
CREATE TABLE IF NOT EXISTS public.rh_habilitations (
  id                  bigint GENERATED BY DEFAULT AS IDENTITY NOT NULL,
  employe             text,
  domaine             text,
  obtention           date,
  validite_ans        numeric,
  rgpd_anonymise_le   timestamp with time zone
);

-- Sécurité / Accidents (avec colonnes RGPD lot6)
CREATE TABLE IF NOT EXISTS public.securite_accidents (
  id                    bigint GENERATED BY DEFAULT AS IDENTITY NOT NULL,
  date_evenement        date,
  type_evenement        text,
  lieu                  text,
  description           text,
  jours_perdus          integer DEFAULT 0,
  statut_enquete        text,
  victime               text,
  temoin                text,
  cause_immediate       text,
  mesures_immediates    text,
  actions_correctives   text,
  archived_at           timestamp with time zone,
  archived_by           text,
  rgpd_anonymise_le     timestamp with time zone
);

-- Veille réglementaire
CREATE TABLE IF NOT EXISTS public.veille_reglementaire (
  id              bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  titre           text,
  domaine         text,
  source          text,
  date_parution   date,
  resume          text,
  url             text,
  statut          text DEFAULT 'À analyser'::text,
  impact          text DEFAULT 'Moyen'::text,
  notes           text,
  archive         boolean DEFAULT false,
  date_detection  date
);

-- ─── 3. Contraintes (PK, FK, CHECK, UNIQUE) ────────────────────────────

-- Primary keys
ALTER TABLE public.actions_correctives    ADD CONSTRAINT actions_correctives_pkey    PRIMARY KEY (id);
ALTER TABLE public.analyses_risque        ADD CONSTRAINT analyses_risque_pkey        PRIMARY KEY (id);
ALTER TABLE public.audit_log              ADD CONSTRAINT audit_log_pkey              PRIMARY KEY (id);
ALTER TABLE public.calendrier_custom      ADD CONSTRAINT calendrier_custom_pkey      PRIMARY KEY (id);
ALTER TABLE public.config_entreprise      ADD CONSTRAINT config_entreprise_pkey      PRIMARY KEY (id);
ALTER TABLE public.environnement_flux     ADD CONSTRAINT environnement_flux_pkey     PRIMARY KEY (id);
ALTER TABLE public.fournisseurs_eval      ADD CONSTRAINT fournisseurs_eval_pkey      PRIMARY KEY (id);
ALTER TABLE public.habilitations          ADD CONSTRAINT habilitations_pkey          PRIMARY KEY (id);
ALTER TABLE public.kpi_mensuels           ADD CONSTRAINT kpi_mensuels_pkey           PRIMARY KEY (id);
ALTER TABLE public.kpi_objectifs          ADD CONSTRAINT kpi_objectifs_pkey          PRIMARY KEY (id);
ALTER TABLE public.objectifs_qhse         ADD CONSTRAINT objectifs_qhse_pkey         PRIMARY KEY (id);
ALTER TABLE public.plan_actions           ADD CONSTRAINT plan_actions_pkey           PRIMARY KEY (id);
ALTER TABLE public.plans_prevention       ADD CONSTRAINT plans_prevention_pkey       PRIMARY KEY (id);
ALTER TABLE public.qualite_audits         ADD CONSTRAINT qualite_audits_pkey         PRIMARY KEY (id);
ALTER TABLE public.qualite_nc             ADD CONSTRAINT qualite_nc_pkey             PRIMARY KEY (id);
ALTER TABLE public.qualite_qvt            ADD CONSTRAINT qualite_qvt_pkey            PRIMARY KEY (id);
ALTER TABLE public.qualite_satisfaction   ADD CONSTRAINT qualite_satisfaction_pkey   PRIMARY KEY (id);
ALTER TABLE public.registre_duerp         ADD CONSTRAINT registre_duerp_pkey         PRIMARY KEY (id);
ALTER TABLE public.reunions_qhse          ADD CONSTRAINT reunions_qhse_pkey          PRIMARY KEY (id);
ALTER TABLE public.rh_employes            ADD CONSTRAINT rh_employes_pkey            PRIMARY KEY (id);
ALTER TABLE public.rh_formations          ADD CONSTRAINT rh_formations_pkey          PRIMARY KEY (id);
ALTER TABLE public.rh_habilitations       ADD CONSTRAINT rh_habilitations_pkey       PRIMARY KEY (id);
ALTER TABLE public.securite_accidents     ADD CONSTRAINT securite_accidents_pkey     PRIMARY KEY (id);
ALTER TABLE public.templates_pdp          ADD CONSTRAINT templates_pdp_pkey          PRIMARY KEY (id);
ALTER TABLE public.veille_reglementaire   ADD CONSTRAINT veille_reglementaire_pkey   PRIMARY KEY (id);

-- Foreign keys
ALTER TABLE public.actions_correctives ADD CONSTRAINT actions_correctives_plan_id_fkey
  FOREIGN KEY (plan_id) REFERENCES public.plans_prevention(id) ON DELETE CASCADE;
ALTER TABLE public.actions_correctives ADD CONSTRAINT actions_correctives_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.plans_prevention    ADD CONSTRAINT plans_prevention_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.templates_pdp       ADD CONSTRAINT templates_pdp_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Check constraints
ALTER TABLE public.actions_correctives ADD CONSTRAINT actions_correctives_statut_check
  CHECK (statut IN ('todo','doing','done'));
ALTER TABLE public.plans_prevention    ADD CONSTRAINT plans_prevention_statut_check
  CHECK (statut IN ('brouillon','valide','archive'));

-- ─── 4. Index secondaires (non-PK) ─────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_actions_created_by    ON public.actions_correctives USING btree (created_by);
CREATE INDEX IF NOT EXISTS idx_actions_plan_id       ON public.actions_correctives USING btree (plan_id);
CREATE INDEX IF NOT EXISTS idx_habs_archived         ON public.habilitations       USING btree (archived_at);
CREATE INDEX IF NOT EXISTS idx_actions_archived      ON public.plan_actions        USING btree (archived_at);
CREATE INDEX IF NOT EXISTS idx_pdp_created_by        ON public.plans_prevention    USING btree (created_by);
CREATE INDEX IF NOT EXISTS idx_pdp_date_travaux      ON public.plans_prevention    USING btree (date_travaux DESC);
CREATE INDEX IF NOT EXISTS idx_pdp_statut            ON public.plans_prevention    USING btree (statut);
CREATE INDEX IF NOT EXISTS idx_nc_archived           ON public.qualite_nc          USING btree (archived_at);
CREATE INDEX IF NOT EXISTS idx_duerp_archived        ON public.registre_duerp      USING btree (archived_at);
CREATE INDEX IF NOT EXISTS idx_accidents_archived    ON public.securite_accidents  USING btree (archived_at);
CREATE INDEX IF NOT EXISTS idx_templates_created_by  ON public.templates_pdp       USING btree (created_by);

-- ─── 5. Triggers (updated_at automatique) ──────────────────────────────

DROP TRIGGER IF EXISTS set_actions_updated_at ON public.actions_correctives;
CREATE TRIGGER set_actions_updated_at
  BEFORE UPDATE ON public.actions_correctives
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_pdp_updated_at ON public.plans_prevention;
CREATE TRIGGER trg_pdp_updated_at
  BEFORE UPDATE ON public.plans_prevention
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ─── 6. RLS pré-existantes (sur les 4 tables qui en avaient déjà) ──────
-- Note : la migration 20260425000003_etape_e7_rls_tables_metier.sql ne
-- touchera PAS ces 4 tables (déjà en RLS), on les laisse avec leur
-- stratégie originelle "données privées par utilisateur" (created_by).

-- actions_correctives — accès lié au créateur
ALTER TABLE public.actions_correctives ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Lecture actions propres"      ON public.actions_correctives;
DROP POLICY IF EXISTS "Insertion actions propres"    ON public.actions_correctives;
DROP POLICY IF EXISTS "Modification actions propres" ON public.actions_correctives;
DROP POLICY IF EXISTS "Suppression actions propres"  ON public.actions_correctives;
CREATE POLICY "Lecture actions propres"
  ON public.actions_correctives FOR SELECT TO public USING (created_by = auth.uid());
CREATE POLICY "Insertion actions propres"
  ON public.actions_correctives FOR INSERT TO public WITH CHECK (created_by = auth.uid());
CREATE POLICY "Modification actions propres"
  ON public.actions_correctives FOR UPDATE TO public USING (created_by = auth.uid());
CREATE POLICY "Suppression actions propres"
  ON public.actions_correctives FOR DELETE TO public USING (created_by = auth.uid());

-- analyses_risque — accès libre (table interne sans donnée RGPD critique)
ALTER TABLE public.analyses_risque ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS acces_libre ON public.analyses_risque;
CREATE POLICY acces_libre
  ON public.analyses_risque FOR ALL TO public USING (true) WITH CHECK (true);

-- plans_prevention — accès lié au créateur
ALTER TABLE public.plans_prevention ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Lecture ses propres plans"  ON public.plans_prevention;
DROP POLICY IF EXISTS "Création de ses plans"      ON public.plans_prevention;
DROP POLICY IF EXISTS "Modification de ses plans"  ON public.plans_prevention;
DROP POLICY IF EXISTS "Suppression de ses plans"   ON public.plans_prevention;
CREATE POLICY "Lecture ses propres plans"
  ON public.plans_prevention FOR SELECT TO public USING (auth.uid() = created_by);
CREATE POLICY "Création de ses plans"
  ON public.plans_prevention FOR INSERT TO public WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Modification de ses plans"
  ON public.plans_prevention FOR UPDATE TO public USING (auth.uid() = created_by);
CREATE POLICY "Suppression de ses plans"
  ON public.plans_prevention FOR DELETE TO public USING (auth.uid() = created_by);

-- templates_pdp — accès lié au créateur
ALTER TABLE public.templates_pdp ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Lecture templates propres"     ON public.templates_pdp;
DROP POLICY IF EXISTS "Insertion templates propres"   ON public.templates_pdp;
DROP POLICY IF EXISTS "Suppression templates propres" ON public.templates_pdp;
CREATE POLICY "Lecture templates propres"
  ON public.templates_pdp FOR SELECT TO public USING (created_by = auth.uid());
CREATE POLICY "Insertion templates propres"
  ON public.templates_pdp FOR INSERT TO public WITH CHECK (created_by = auth.uid());
CREATE POLICY "Suppression templates propres"
  ON public.templates_pdp FOR DELETE TO public USING (created_by = auth.uid());

-- ─── 7. Vérification post-migration ────────────────────────────────────
DO $$
DECLARE
  count_tables INT;
BEGIN
  SELECT COUNT(*) INTO count_tables
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relkind = 'r';

  IF count_tables < 25 THEN
    RAISE WARNING 'Baseline schema: seulement % tables créées (attendu >= 25)', count_tables;
  ELSE
    RAISE NOTICE 'Baseline schema: % tables créées avec succès', count_tables;
  END IF;
END
$$;
