/* eslint-disable react-refresh/only-export-components --
   * Cette règle ne tolère que des exports de composants dans un .jsx, mais
   * ce fichier exporte aussi des constantes, hooks ou contextes utilisés
   * ailleurs dans l'app. Splitter en fichier .js séparé n'apporterait pas
   * de bénéfice pratique (HMR fonctionne, la valeur est statique). */
import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from './supabaseClient';

// =====================================================================
// UserContext — Identité, rôle et permissions de l'utilisateur connecté
// =====================================================================
// Étape E (auth + RGPD) : le rôle métier est désormais lu depuis la table
// `public.user_roles` (créée en E1) plutôt que depuis `user_metadata`.
// Avantage : changement de rôle pris en compte instantanément (sans
// attendre le refresh JWT, qui peut prendre jusqu'à 1h).
//
// Rôles supportés :
//   - admin            : plein accès (Responsable QHSE, gestion utilisateurs)
//   - responsable_qhse : plein accès, sans gestion utilisateurs (équivalent admin
//                        pour évolutions futures multi-personnes)
//   - direction        : accès réduit (Comex, revue, stats, objectifs, KPI, calendrier, rapport)
//   - lecteur          : voit tout, n'écrit rien (DG en consultation)
//   - operateur        : accès réduit + droit d'écriture (Comex, accidents, PDCA, calendrier)
//
// Si un compte authentifié n'a PAS de ligne dans user_roles, on défaut à
// `null` (aucun rôle, aucun accès) — affichage explicite à l'utilisateur
// dans App.jsx pour qu'il sache qu'il faut contacter l'admin.
// =====================================================================

// `menuAccess`        : null = tous les menus, sinon liste blanche d'IDs.
// `menuAccessExclude` : liste noire — masque ces IDs même si menuAccess les autoriserait.
//                       Utilisé pour le `lecteur` : il voit tout SAUF les écrans d'écriture
//                       (Import Excel) qui n'auraient aucun sens à afficher.
// `readOnly`          : si true, les boutons d'écriture sont grisés via canWrite.
export const ROLES = {
  admin:            { label: 'Administrateur',     color: '#8B5CF6', menuAccess: null, menuAccessExclude: [],            readOnly: false },
  responsable_qhse: { label: 'Responsable QHSE',   color: '#3B82F6', menuAccess: null, menuAccessExclude: [],            readOnly: false },
  direction:        { label: 'Direction',           color: '#F59E0B', menuAccess: ['comex','revue','stats','objectifs','kpis','calendrier','rapport'], menuAccessExclude: [], readOnly: false },
  lecteur:          { label: 'Lecteur',              color: '#06B6D4', menuAccess: null, menuAccessExclude: ['import','parametres','notifications'], readOnly: true  },
  operateur:        { label: 'Opérateur',           color: '#10B981', menuAccess: ['comex','accidents','pdca','calendrier'], menuAccessExclude: [], readOnly: false },
};

const UserContext = createContext(null);

export function UserProvider({ children }) {
  const [user, setUser]       = useState(null);
  const [role, setRole]       = useState(null);
  const [loading, setLoading] = useState(true);

  // ─── Chargement du rôle depuis public.user_roles ──────────────────────
  // Appelé à chaque changement de session. En cas d'erreur (réseau coupé,
  // RLS bloque, ligne inexistante) on retombe sur null = aucun accès.
  // C'est le comportement le plus sûr : un user mal configuré ne peut
  // pas accidentellement passer en admin.
  const fetchRole = async (currentUser) => {
    if (!currentUser) { setRole(null); return; }
    try {
      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', currentUser.id)
        .maybeSingle();
      if (error) throw error;
      setRole(data?.role ?? null);
    } catch {
      setRole(null);
    }
  };

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!mounted) return;
      const u = session?.user ?? null;
      setUser(u);
      await fetchRole(u);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!mounted) return;
      const u = session?.user ?? null;
      setUser(u);
      await fetchRole(u);
    });

    return () => { mounted = false; subscription.unsubscribe(); };
  }, []);

  const displayName = user?.user_metadata?.prenom
    || user?.user_metadata?.name
    || user?.email?.split('@')[0]
    || 'Utilisateur';
  const initiale    = displayName.charAt(0).toUpperCase();

  const logout = () => supabase.auth.signOut();

  // canAccess : le rôle peut-il voir cet onglet ? menuAccess: null = tout,
  // sauf les menus listés dans menuAccessExclude (liste noire pour lecteur).
  const canAccess = (menuId) => {
    if (!role) return false;          // pas de rôle = pas d'accès
    const conf = ROLES[role];
    if (!conf) return false;
    if (conf.menuAccessExclude?.includes(menuId)) return false;
    if (!conf.menuAccess) return true; // null = tous les menus restants
    return conf.menuAccess.includes(menuId);
  };

  // canWrite : le rôle a-t-il le droit d'écrire ? Branchés dans les
  // composants pour griser les boutons (Ajouter, Supprimer, Modifier…).
  // La VRAIE protection viendra de la RLS Supabase (E7) — `canWrite`
  // n'est qu'une amélioration UX (pas de boutons fantômes).
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