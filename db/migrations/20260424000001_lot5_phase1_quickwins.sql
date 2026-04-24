-- =====================================================================
-- Lot 5 Phase 1 — Quick wins sécurité sans impact fonctionnel
-- Date      : 2026-04-24
-- Auteur    : Système expert QHSE
-- Références: Supabase Advisors (2026-04-24), ISO 27001 A.9, RGPD Art. 32
--
-- NOTE DÉPLOIEMENT :
--   Ce fichier est destiné à être copié vers supabase/migrations/ lors
--   du déploiement via Supabase CLI (`supabase db push`). Le dossier
--   supabase/migrations/ du dépôt Windows n'étant pas exposé à ce sandbox,
--   les migrations sont livrées dans db/migrations/ pour archivage côté
--   code. À exécuter aussi par le Dashboard Supabase → SQL Editor.
--
-- PORTÉE :
--   1. Figer le search_path des fonctions utilitaires (mutable → immutable)
--   2. Retirer la policy de listing public du bucket Storage
--
-- NON INCLUS (reporté en Phase 2, car nécessite Supabase Auth) :
--   - RLS strict sur les 21 tables exposées
--   - Correction policy permissive sur analyses_risque
--   - kpi_automatiques : passage en SECURITY INVOKER
--   - audit_log : RLS INSERT-only
--
-- ACTION MANUELLE COMPLÉMENTAIRE (console Supabase) :
--   Dashboard → Authentication → Policies → Enable Leaked Password Protection
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1. Fonctions utilitaires : search_path fixe (Supabase Advisor #SEC-02)
--    Sans search_path explicite, un schéma malveillant dans le path peut
--    détourner une résolution de nom (ex: public.audit_log → evil.audit_log)
-- ---------------------------------------------------------------------

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
             WHERE n.nspname = 'public' AND p.proname = 'update_updated_at_column') THEN
    EXECUTE 'ALTER FUNCTION public.update_updated_at_column() SET search_path = public, pg_temp';
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
             WHERE n.nspname = 'public' AND p.proname = 'update_updated_at') THEN
    EXECUTE 'ALTER FUNCTION public.update_updated_at() SET search_path = public, pg_temp';
  END IF;
END $$;

-- ---------------------------------------------------------------------
-- 2. Bucket storage : pas de listing public (Supabase Advisor #SEC-04)
--    La policy "Lecture publique photos PdP" autorise n'importe quel
--    anonyme à lister le bucket. Les URLs signées restent valides.
-- ---------------------------------------------------------------------

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies
             WHERE schemaname = 'storage' AND tablename = 'objects'
               AND policyname = 'Lecture publique photos PdP') THEN
    EXECUTE 'DROP POLICY "Lecture publique photos PdP" ON storage.objects';
  END IF;
END $$;

COMMIT;

-- =====================================================================
-- VALIDATION POST-MIGRATION
-- =====================================================================
--   SELECT proname, proconfig FROM pg_proc p
--   JOIN pg_namespace n ON n.oid = p.pronamespace
--   WHERE n.nspname = 'public'
--     AND proname IN ('update_updated_at', 'update_updated_at_column');
--
--   SELECT policyname FROM pg_policies
--   WHERE schemaname = 'storage' AND tablename = 'objects';
-- =====================================================================
