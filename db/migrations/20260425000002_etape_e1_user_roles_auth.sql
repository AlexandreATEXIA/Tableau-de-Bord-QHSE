-- =====================================================================
-- Étape E1 — Authentification : table user_roles + helpers SQL
-- =====================================================================
-- Associe chaque utilisateur Supabase Auth (auth.users) à un rôle métier
-- (`admin` = QHSE plein accès, `lecteur` = DG en lecture seule).
--
-- Les policies RLS d'application (E7, sur les tables métier) s'appuieront
-- sur la fonction `public.is_admin()` exposée ici. Cette fonction est
-- déclarée SECURITY DEFINER pour pouvoir lire user_roles sans déclencher
-- le piège classique « j'ai besoin d'être admin pour vérifier que je
-- suis admin ».
--
-- À ce stade : RLS est activée UNIQUEMENT sur user_roles, pas encore
-- sur les tables métier (qui restent en `anon` accessible) — la bascule
-- complète viendra en E7, après que l'auth flow soit testé fonctionnel.
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.user_roles (
  user_id    UUID         PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role       TEXT         NOT NULL CHECK (role IN ('admin', 'lecteur')),
  email      TEXT,
  nom        TEXT,
  created_at TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ  NOT NULL DEFAULT now()
);

COMMENT ON TABLE  public.user_roles IS 'Rôles métier des utilisateurs (étape E1). admin = plein accès QHSE, lecteur = consultation seule.';
COMMENT ON COLUMN public.user_roles.user_id IS 'FK vers auth.users.id — supprimé automatiquement si l''utilisateur Supabase Auth est supprimé.';
COMMENT ON COLUMN public.user_roles.role    IS 'admin | lecteur — référencé par les policies RLS via public.is_admin().';

-- Trigger updated_at (fonction déjà présente dans le projet)
DROP TRIGGER IF EXISTS trg_user_roles_updated_at ON public.user_roles;
CREATE TRIGGER trg_user_roles_updated_at
  BEFORE UPDATE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ─── Permissions de base ────────────────────────────────────────────────
-- service_role (côté backend) : tout
-- authenticated (clients React) : SELECT uniquement, et seul leur propre rôle (RLS)
-- anon : aucun accès (table sensible, pas de leak de la liste des comptes)
GRANT SELECT ON public.user_roles TO authenticated;
REVOKE ALL ON public.user_roles FROM anon;

-- ─── RLS : un utilisateur ne voit QUE sa propre ligne ───────────────────
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_roles_select_own ON public.user_roles;
CREATE POLICY user_roles_select_own ON public.user_roles
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- ─── Fonction : suis-je administrateur ? ───────────────────────────────
-- SECURITY DEFINER permet de contourner RLS pour la lecture (sinon
-- récursion : la policy de user_roles bloquerait la fonction).
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
COMMENT ON FUNCTION public.is_admin() IS 'Renvoie TRUE si l''utilisateur courant a le rôle admin. Utilisable dans les policies RLS des tables métier (E7).';

-- ─── Fonction : quel est mon rôle ? ────────────────────────────────────
-- Utilisée côté React pour adapter l'UI (boutons grisés en lecteur, etc.).
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS TEXT
LANGUAGE SQL
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT role FROM public.user_roles WHERE user_id = auth.uid();
$$;

GRANT EXECUTE ON FUNCTION public.current_user_role() TO authenticated;
COMMENT ON FUNCTION public.current_user_role() IS 'Retourne le rôle de l''utilisateur courant (admin | lecteur | NULL si non authentifié).';
