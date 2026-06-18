-- =====================================================================
-- Migration : Parcours d'accueil nouveau salarié
-- Intention : suivi 9 mois à jalons configurables + alerte in-app.
-- 3 tables : modèle de jalons (partagé), parcours (par salarié),
--            jalons instanciés (snapshot du modèle au démarrage).
-- RLS alignée sur les tables métier : lecture authentifiés,
--      écriture conditionnée par public.can_write().
-- =====================================================================

-- 1. Modèle de jalons (configurable dans Paramètres)
CREATE TABLE IF NOT EXISTS public.parcours_modele_jalons (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  libelle       text NOT NULL,
  delai_valeur  integer NOT NULL DEFAULT 1,
  delai_unite   text NOT NULL DEFAULT 'mois',   -- 'jours' | 'mois'
  responsable   text,
  ordre         integer NOT NULL DEFAULT 0,
  actif         boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- 2. Parcours d'un salarié
CREATE TABLE IF NOT EXISTS public.parcours_accueil (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  employe_id   bigint,
  employe      text,
  date_debut   date NOT NULL,
  statut       text NOT NULL DEFAULT 'En cours',  -- 'En cours' | 'Terminé' | 'Abandonné'
  commentaire  text,
  archived_at  timestamptz,
  archived_by  text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  created_by   text
);

-- 3. Jalons instanciés d'un parcours
CREATE TABLE IF NOT EXISTS public.parcours_jalons (
  id               bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  parcours_id      bigint NOT NULL REFERENCES public.parcours_accueil(id) ON DELETE CASCADE,
  libelle          text NOT NULL,
  date_echeance    date NOT NULL,
  responsable      text,
  statut           text NOT NULL DEFAULT 'À faire',  -- 'À faire' | 'Fait' | 'Non applicable'
  date_realisation date,
  commentaire      text,
  ordre            integer NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_parcours_jalons_parcours ON public.parcours_jalons(parcours_id);

-- RLS
ALTER TABLE public.parcours_modele_jalons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parcours_accueil       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parcours_jalons        ENABLE ROW LEVEL SECURITY;

CREATE POLICY "modele_lecture"  ON public.parcours_modele_jalons FOR SELECT TO authenticated USING (true);
CREATE POLICY "modele_ecriture" ON public.parcours_modele_jalons FOR ALL    TO authenticated USING (public.can_write()) WITH CHECK (public.can_write());

CREATE POLICY "parcours_lecture"  ON public.parcours_accueil FOR SELECT TO authenticated USING (true);
CREATE POLICY "parcours_ecriture" ON public.parcours_accueil FOR ALL    TO authenticated USING (public.can_write()) WITH CHECK (public.can_write());

CREATE POLICY "jalons_lecture"  ON public.parcours_jalons FOR SELECT TO authenticated USING (true);
CREATE POLICY "jalons_ecriture" ON public.parcours_jalons FOR ALL    TO authenticated USING (public.can_write()) WITH CHECK (public.can_write());

-- Seed du modèle par défaut (modifiable ensuite dans Paramètres)
INSERT INTO public.parcours_modele_jalons (libelle, delai_valeur, delai_unite, responsable, ordre) VALUES
  ('Accueil, remise EPI & livret d''accueil', 1, 'jours', 'RH',      1),
  ('Point fin de 1re semaine',                7, 'jours', 'Manager', 2),
  ('Entretien de suivi 1 mois',               1, 'mois',  'Manager', 3),
  ('Bilan fin de période d''essai',           2, 'mois',  'RH',      4),
  ('Entretien 3 mois',                        3, 'mois',  'Manager', 5),
  ('Entretien 6 mois',                        6, 'mois',  'Manager', 6),
  ('Bilan final du parcours',                 9, 'mois',  'RH',      7);

-- =====================================================================
-- VALIDATION POST-MIGRATION (exécuter et vérifier les résultats)
-- =====================================================================
-- Doit retourner 3 :
SELECT count(*) AS tables_creees FROM information_schema.tables
  WHERE table_schema='public'
    AND table_name IN ('parcours_modele_jalons','parcours_accueil','parcours_jalons');
-- Doit retourner 7 :
SELECT count(*) AS jalons_seed FROM public.parcours_modele_jalons;
