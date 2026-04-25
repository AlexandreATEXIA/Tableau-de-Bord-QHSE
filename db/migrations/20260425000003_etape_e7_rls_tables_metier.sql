-- =====================================================================
-- Étape E7 — RLS sur toutes les tables métier
-- =====================================================================
-- Tant que cette migration n'est pas passée, n'importe qui ayant la clé
-- anon (visible dans le bundle JavaScript du navigateur) peut interroger
-- la base directement, contournant l'écran de login. Ce verrou applicatif
-- est INDISPENSABLE pour la conformité RGPD Art. 32.
--
-- Stratégie :
--   - SELECT autorisé pour tous les utilisateurs authentifiés (admin,
--     responsable_qhse, direction, lecteur, opérateur). Logique métier
--     adaptée par le rôle côté UI via menuAccess.
--   - INSERT / UPDATE / DELETE autorisés UNIQUEMENT si public.can_write()
--     retourne TRUE (rôle <> 'lecteur'). Le lecteur peut naviguer mais
--     pas modifier.
--   - anon : tout révoqué. Plus aucun accès aux tables métier sans login.
--   - audit_log : SELECT réservé à can_write (le lecteur ne voit pas les
--     traces), INSERT autorisé pour tout authenticated (chaque user trace
--     ses propres actions), pas d'UPDATE/DELETE (intégrité du journal).
--
-- Tables déjà RLS-protégées (intactes par cette migration) :
--   actions_correctives, analyses_risque, plans_prevention,
--   templates_pdp, user_roles
-- =====================================================================

-- ─── Helper : l'utilisateur courant peut-il écrire ? ───────────────────
-- Retourne TRUE pour tous les rôles SAUF 'lecteur'.
-- SECURITY DEFINER pour contourner la RLS de user_roles (la fonction
-- s'exécute avec les droits du propriétaire = postgres).
CREATE OR REPLACE FUNCTION public.can_write()
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role <> 'lecteur'
  );
$$;
GRANT EXECUTE ON FUNCTION public.can_write() TO authenticated;
COMMENT ON FUNCTION public.can_write() IS 'TRUE si l''utilisateur courant peut modifier des données (rôle <> lecteur).';

-- ─── Boucle d'activation RLS sur les 22 tables métier "standard" ──────
DO $$
DECLARE
  t TEXT;
  tables TEXT[] := ARRAY[
    'registre_duerp',
    'plan_actions',
    'habilitations',
    'securite_accidents',
    'environnement_flux',
    'qualite_audits',
    'qualite_nc',
    'qualite_satisfaction',
    'qualite_qvt',
    'rh_employes',
    'rh_formations',
    'rh_habilitations',
    'listes_referentiel',
    'calendrier_custom',
    'config_entreprise',
    'fournisseurs_eval',
    'kpi_mensuels',
    'kpi_objectifs',
    'objectifs_qhse',
    'reunions_qhse',
    'rgpd_demandes',
    'veille_reglementaire'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    -- Permissions de base : authenticated peut tout, anon plus rien
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon', t);

    -- Active RLS
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);

    -- Drop d'éventuelles policies existantes (idempotence)
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_select_all', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_insert_writer', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_update_writer', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_delete_writer', t);

    -- SELECT : tout authenticated peut lire
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (true)',
      t || '_select_all', t
    );

    -- INSERT : seuls les writers (rôle <> lecteur)
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (public.can_write())',
      t || '_insert_writer', t
    );

    -- UPDATE : seuls les writers (sur USING ET WITH CHECK pour cohérence)
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING (public.can_write()) WITH CHECK (public.can_write())',
      t || '_update_writer', t
    );

    -- DELETE : seuls les writers
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING (public.can_write())',
      t || '_delete_writer', t
    );
  END LOOP;
END
$$;

-- ─── audit_log : règles spéciales ─────────────────────────────────────
-- - SELECT réservé aux writers (le lecteur ne voit pas les traces de qui
--   a fait quoi — c'est une donnée RH/management)
-- - INSERT autorisé pour TOUT authenticated (chaque user trace ses
--   propres actions, y compris les sessions/logins du lecteur)
-- - UPDATE/DELETE bloqués (intégrité du journal, RGPD Art. 32)
GRANT SELECT, INSERT ON public.audit_log TO authenticated;
REVOKE UPDATE, DELETE ON public.audit_log FROM authenticated;
REVOKE ALL ON public.audit_log FROM anon;

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS audit_log_select_writer  ON public.audit_log;
DROP POLICY IF EXISTS audit_log_insert_all     ON public.audit_log;
DROP POLICY IF EXISTS audit_log_no_update      ON public.audit_log;
DROP POLICY IF EXISTS audit_log_no_delete      ON public.audit_log;

CREATE POLICY audit_log_select_writer ON public.audit_log
  FOR SELECT TO authenticated USING (public.can_write());

CREATE POLICY audit_log_insert_all ON public.audit_log
  FOR INSERT TO authenticated WITH CHECK (true);

-- Pas de policy UPDATE/DELETE = aucun n'est autorisé pour authenticated.

-- ─── Vérification post-migration ──────────────────────────────────────
-- Compte les tables encore SANS RLS (devrait être 0 hors tables système).
DO $$
DECLARE
  remaining INT;
BEGIN
  SELECT COUNT(*) INTO remaining
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relkind = 'r'
    AND c.relrowsecurity = false;
  IF remaining > 0 THEN
    RAISE NOTICE 'Étape E7 : % table(s) encore sans RLS — vérifier', remaining;
  END IF;
END
$$;
