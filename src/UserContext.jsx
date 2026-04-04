import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from './supabaseClient';

export const ROLES = {
  admin:            { label: 'Administrateur',   color: '#8B5CF6', menuAccess: null },
  responsable_qhse: { label: 'Responsable QHSE', color: '#3B82F6', menuAccess: null },
  direction:        { label: 'Direction',         color: '#F59E0B', menuAccess: ['comex','revue','stats','objectifs','kpis','calendrier','rapport'] },
  operateur:        { label: 'Opérateur',         color: '#10B981', menuAccess: ['comex','accidents','pdca','calendrier'] },
};

const UserContext = createContext(null);

export function UserProvider({ children }) {
  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  const role        = user?.user_metadata?.role || 'responsable_qhse';
  const displayName = user?.user_metadata?.prenom || user?.user_metadata?.name || user?.email?.split('@')[0] || 'Utilisateur';
  const initiale    = displayName.charAt(0).toUpperCase();

  const logout = () => supabase.auth.signOut();

  const canAccess = (menuId) => {
    const access = ROLES[role]?.menuAccess;
    if (!access) return true;
    return access.includes(menuId);
  };

  return (
    <UserContext.Provider value={{ user, role, displayName, initiale, loading, logout, canAccess }}>
      {children}
    </UserContext.Provider>
  );
}

export const useUser = () => useContext(UserContext);
