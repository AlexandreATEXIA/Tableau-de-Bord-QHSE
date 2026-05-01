/* eslint-disable react-refresh/only-export-components --
   * Ce fichier exporte aussi des constantes et hooks utilisés ailleurs. */
import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from './supabaseClient';

// =====================================================================
// UserContext — Identité, rôle et permissions de l'utilisateur connecté
// =====================================================================

export const ROLES = {
  admin:            { label: 'Administrateur',     color: '#8B5CF6', menuAccess: null, menuAccessExclude: [],            readOnly: false },
  responsable_qhse: { label: 'Responsable QHSE',   color: '#3B82F6', menuAccess: null, menuAccessExclude: [],            readOnly: false },
  direction:        { label: 'Direction',           color: '#F59E0B', menuAccess: ['comex','revue','stats','objectifs','kpis','calendrier','rapport'], menuAccessExclude: [], readOnly: false },
  lecteur:          { label: 'Lecteur',              color: '#06B6D4', menuAccess: null, menuAccessExclude: ['import','parametres','notifications'], readOnly: true  },
  operateur:        { label: 'Opérateur',           color: '#10B981', menuAccess: ['comex','accidents','pdca','calendrier'], menuAccessExclude: [], readOnly: false },
};

// ─── Cache localStorage du rôle ──────────────────────────────────────────────
// Permet de restituer le rôle instantanément au rechargement, sans attendre
// Supabase (cold-start pouvant dépasser 8–15 s sur le plan gratuit).
// La clé contient l'userId pour éviter les collisions multi-comptes.
const ROLE_CACHE_KEY = 'smi_role_cache';

function getCachedRole(userId) {
  try {
    const raw = localStorage.getItem(ROLE_CACHE_KEY);
    if (!raw) return null;
    const { uid, role } = JSON.parse(raw);
    return uid === userId ? (role || null) : null;
  } catch { return null; }
}

function setCachedRole(userId, role) {
  try { localStorage.setItem(ROLE_CACHE_KEY, JSON.stringify({ uid: userId, role })); } catch {}
}

function clearCachedRole() {
  try { localStorage.removeItem(ROLE_CACHE_KEY); } catch {}
}

// ─── Contexte ─────────────────────────────────────────────────────────────────
const UserContext = createContext(null);

export function UserProvider({ children }) {
  const [user, setUser]       = useState(null);
  const [role, setRole]       = useState(null);
  const [loading, setLoading] = useState(true);

  // ─── Chargement du rôle depuis public.user_roles ──────────────────────────
  // `fromCache` = true quand le cache a déjà fourni un rôle valide.
  //   → en cas d'échec réseau on NE remet PAS role à null (évite la
  //     déconnexion surprise) ; on laisse le cache tenir.
  // `fromCache` = false (premier login, pas de cache)
  //   → en cas d'échec on retombe sur null = "Compte non configuré".
  const fetchRole = async (currentUser, fromCache = false) => {
    if (!currentUser) { setRole(null); clearCachedRole(); return; }

    try {
      const result = await Promise.race([
        supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', currentUser.id)
          .maybeSingle(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('fetchRole timeout 30s')), 30000)
        ),
      ]);
      const { data, error } = result;
      if (error) throw error;
      const newRole = data?.role ?? null;
      setRole(newRole);
      if (newRole) setCachedRole(currentUser.id, newRole);
      else clearCachedRole();
    } catch (e) {
      console.warn('[UserContext] fetchRole failed:', e?.message || e);
      // Si le cache avait fourni un rôle : on le conserve (pas de déconnexion).
      // Sinon : role reste null → l'écran "Compte non configuré" s'affiche.
      if (!fromCache) setRole(null);
    }
  };

  useEffect(() => {
    let mounted = true;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!mounted) return;
      const u = session?.user ?? null;
      setUser(u);

      if (!u) {
        // Déconnexion : on efface tout
        setRole(null);
        clearCachedRole();
        setLoading(false);
        return;
      }

      // Vérifie si on a un rôle en cache pour cet utilisateur
      const cached = getCachedRole(u.id);
      if (cached) {
        // Rôle connu : on l'applique immédiatement → pas de spinner, pas de
        // déconnexion même si Supabase est lent.
        setRole(cached);
        setLoading(false);
        // Rafraîchissement silencieux en arrière-plan
        fetchRole(u, true);
      } else {
        // Premier login sur ce poste : on attend Supabase (30 s max)
        await fetchRole(u, false);
        setLoading(false);
      }
    });

    return () => { mounted = false; subscription.unsubscribe(); };
  }, []);

  const displayName = user?.user_metadata?.prenom
    || user?.user_metadata?.name
    || user?.email?.split('@')[0]
    || 'Utilisateur';
  const initiale    = displayName.charAt(0).toUpperCase();

  const logout = () => { clearCachedRole(); supabase.auth.signOut(); };

  const canAccess = (menuId) => {
    if (!role) return false;
    const conf = ROLES[role];
    if (!conf) return false;
    if (conf.menuAccessExclude?.includes(menuId)) return false;
    if (!conf.menuAccess) return true;
    return conf.menuAccess.includes(menuId);
  };

  const isReadOnly = !!ROLES[role]?.readOnly;
  const canWrite   = !!role && !isReadOnly;

  return (
    <UserContext.Provider value={{
      user, role, displayName, initiale, loading, logout,
      canAccess, canWrite, isReadOnly,
    }}>
      {children}
    </UserContext.Provider>
  );
}

export const useUser = () => useContext(UserContext);
