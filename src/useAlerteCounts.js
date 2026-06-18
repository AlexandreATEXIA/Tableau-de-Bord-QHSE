import { useState, useEffect, useCallback } from 'react';
import { supabase } from './supabaseClient';

// Charge les compteurs d'urgences par module, rafraîchi toutes les 5 min
export function useAlerteCounts() {
  const [counts, setCounts] = useState({});

  const refresh = useCallback(async () => {
    const now = new Date().toISOString().split('T')[0];
    const [r1, r2, r3, r4, r5, r6] = await Promise.all([
      // accidents non clôturés (actifs uniquement)
      supabase.from('securite_accidents').select('id', { count: 'exact', head: true })
        .neq('statut_enquete', 'Clôturée').is('archived_at', null),
      // actions en retard (actives uniquement)
      supabase.from('plan_actions').select('id', { count: 'exact', head: true })
        .lt('echeance', now).not('statut', 'in', '("Terminé","Annulé")').is('archived_at', null),
      // risques critiques actifs (criticite >= 9)
      supabase.from('registre_duerp').select('id', { count: 'exact', head: true })
        .gte('criticite', 9).is('archived_at', null),
      // NC ouvertes actives
      supabase.from('qualite_nc').select('id', { count: 'exact', head: true })
        .neq('statut_nc', 'Clôturée').is('archived_at', null),
      // habilitations périmées actives
      supabase.from('habilitations').select('id,obtention,validiteAns').is('archived_at', null),
      // jalons de parcours en cours, échus et non faits
      supabase.from('parcours_jalons')
        .select('id, date_echeance, statut, parcours_accueil!inner(statut, archived_at)')
        .eq('statut', 'À faire')
        .lte('date_echeance', now)
        .eq('parcours_accueil.statut', 'En cours')
        .is('parcours_accueil.archived_at', null),
    ]);

    const now2 = new Date();
    const habsExpired = (r5.data || []).filter(h => {
      if (!h.obtention) return false;
      const exp = new Date(h.obtention);
      exp.setFullYear(exp.getFullYear() + Number(h.validiteAns || 1));
      return exp <= now2;
    }).length;

    const habsSoon = (r5.data || []).filter(h => {
      if (!h.obtention) return false;
      const exp = new Date(h.obtention);
      exp.setFullYear(exp.getFullYear() + Number(h.validiteAns || 1));
      const diff = (exp - now2) / 86400000;
      return diff > 0 && diff <= 30;
    }).length;

    setCounts({
      accidents: r1.count || 0,
      pdca:      r2.count || 0,
      duerp:     r3.count || 0,
      qualite:   r4.count || 0,
      rh:        habsExpired + habsSoon,
      rhCritical: habsExpired,
      parcours:  r6.count ?? (r6.data ? r6.data.length : 0),
    });
  }, []);

  // Étape E (post-RLS) : avant de lancer une requête Supabase, on vérifie
  // qu'une session existe. Sans JWT, RLS bloque tout en 401 — ce qui
  // arrivait au démarrage de l'app, AVANT que l'utilisateur se logue.
  useEffect(() => {
    let cancelled = false;

    const tick = async () => {
      if (cancelled) return;
      const { data: { session } } = await supabase.auth.getSession();
      if (!session || cancelled) return;
      refresh();
    };

    tick(); // initial — silencieusement skippé si pas encore loggé
    const interval = setInterval(tick, 5 * 60 * 1000);

    // Réagit aux changements d'auth — refresh immédiat dès qu'on se logue
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session && !cancelled) refresh();
    });

    return () => {
      cancelled = true;
      clearInterval(interval);
      subscription.unsubscribe();
    };
  }, [refresh]);

  return { counts, refresh };
}
