import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from './supabaseClient';
import { useAnnee, plageAnnee } from './AnneeContext';

const AlertesContext = createContext(null);

// Charge uniquement des counts — très léger, pas de données complètes
async function fetchCounts(anneeActive) {
  const { debut, fin } = plageAnnee(anneeActive);
  const now = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  const [r1, r2, r3, r4, r5] = await Promise.all([
    // Actions PDCA en retard (échéance dépassée, non terminées/annulées)
    supabase.from('plan_actions')
      .select('*', { count: 'exact', head: true })
      .gte('echeance', debut).lt('echeance', fin)
      .lt('echeance', now)
      .not('statut', 'in', '("Terminé","Annulé")'),

    // Enquêtes accidents non clôturées
    supabase.from('securite_accidents')
      .select('*', { count: 'exact', head: true })
      .gte('date_evenement', debut).lt('date_evenement', fin)
      .neq('statut_enquete', 'Clôturée')
      .neq('type_evenement', "Presqu'accident"),

    // Risques critiques DUERP (registre permanent, pas de filtre année)
    supabase.from('registre_duerp')
      .select('*', { count: 'exact', head: true })
      .gte('criticite', 9),

    // NC qualité ouvertes
    supabase.from('qualite_nc')
      .select('*', { count: 'exact', head: true })
      .gte('date_nc', debut).lt('date_nc', fin)
      .eq('statut_nc', 'Ouverte'),

    // Habilitations périmées (registre permanent)
    supabase.from('habilitations')
      .select('obtention,validiteAns'),
  ]);

  // Calcul habilitations périmées côté client (nécessite les données pour calcExp)
  const habsPerimees = (r5.data || []).filter(h => {
    if (!h.obtention || !h.validiteAns) return false;
    const exp = new Date(h.obtention);
    exp.setFullYear(exp.getFullYear() + Number(h.validiteAns));
    return exp <= new Date();
  }).length;

  return {
    pdca:      r1.count ?? 0,
    accidents: r2.count ?? 0,
    duerp:     r3.count ?? 0,
    qualite:   r4.count ?? 0,
    habs:      habsPerimees,
  };
}

export function AlertesProvider({ children }) {
  const { anneeActive } = useAnnee();
  const [badges, setBadges] = useState({ pdca: 0, accidents: 0, duerp: 0, qualite: 0, habs: 0 });

  const refresh = useCallback(async () => {
    try {
      const counts = await fetchCounts(anneeActive);
      setBadges(counts);
    } catch { /* silencieux — ne pas bloquer l'app */ }
  }, [anneeActive]);

  useEffect(() => {
    refresh();
    // Rafraîchit toutes les 5 minutes automatiquement
    const id = setInterval(refresh, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, [refresh]);

  return (
    <AlertesContext.Provider value={{ badges, refresh }}>
      {children}
    </AlertesContext.Provider>
  );
}

export function useAlertes() {
  const ctx = useContext(AlertesContext);
  if (!ctx) throw new Error('useAlertes doit être utilisé dans AlertesProvider');
  return ctx;
}
