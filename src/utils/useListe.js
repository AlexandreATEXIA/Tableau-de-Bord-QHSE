// =====================================================================
// src/utils/useListe.js — Hook React pour les listes de référence
// =====================================================================
// Encapsule la complexité asynchrone de l'étape B : lecture cache locale
// instantanée au mount, refresh Supabase en arrière-plan, propagation
// transparente lors d'une écriture (Supabase + cache + state local).
//
// Remplace l'usage historique :
//   const [liste, setListe] = useState(() => chargerListe(sk, k, def));
//
// Par :
//   const [liste, setListe] = useListe(sk, k, def);
//
// Comportement :
//   - Au mount : `liste` = cache local (instantané), puis fetch Supabase
//     met à jour si la valeur en base diffère.
//   - À l'écriture via setListe(newList) : optimistic update du state,
//     puis sauverListe (Supabase + cache). Si Supabase échoue, le cache
//     local reste à jour ; un warning est loggé (pas de toast forcé pour
//     ne pas perturber l'UX, l'utilisateur peut continuer à travailler).
//
// Note sur les dépendances de useEffect : `defaults` est volontairement
// exclu pour éviter une boucle infinie (les modules passent souvent un
// nouveau tableau littéral à chaque render). On fige sa valeur initiale
// via useRef.
// =====================================================================

import { useEffect, useState, useCallback, useRef } from 'react';
import { lireCacheLocal, ecrireCacheLocal, chargerListe, sauverListe } from './listes';
import { supabase } from '../supabaseClient';

export function useListe(storageKey, key, defaults = []) {
  // Fige la référence des defaults — évite les re-fetches quand le
  // composant parent passe un tableau littéral.
  const defaultsRef = useRef(defaults);

  const [list, setList] = useState(() =>
    lireCacheLocal(storageKey, key, defaultsRef.current)
  );

  // Fetch Supabase au mount (et si la clé change)
  useEffect(() => {
    let cancelled = false;
    chargerListe(storageKey, key, defaultsRef.current)
      .then(fresh => {
        if (!cancelled && Array.isArray(fresh)) setList(fresh);
      })
      .catch(() => { /* fallback déjà géré dans chargerListe */ });
    return () => { cancelled = true; };
  }, [storageKey, key]);

  // Étape B6 — Synchronisation Realtime entre utilisateurs.
  // Quand quelqu'un modifie cette liste sur Supabase (ajout, réorganisation,
  // suppression, fusion par import), tous les autres clients ouverts sur
  // la page reçoivent l'évènement et rafraîchissent leur état + cache.
  // Pas de boucle infinie : la mise à jour locale arrive aussi par ce canal,
  // mais setList(equal) ne re-render pas grâce à React strict equality sur
  // arrays — et même si re-render, il n'y a pas de nouveau .upsert.
  useEffect(() => {
    if (!storageKey || !key) return undefined;
    const channelName = `listes_realtime:${storageKey}:${key}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'listes_referentiel',
          filter: `storage_key=eq.${storageKey}`,
        },
        (payload) => {
          const row = payload.new || payload.old;
          if (!row || row.key !== key) return;
          if (payload.eventType === 'DELETE') {
            // Cas marginal — on revient aux defaults
            ecrireCacheLocal(storageKey, key, defaultsRef.current);
            setList([...defaultsRef.current]);
            return;
          }
          if (Array.isArray(row.valeurs)) {
            const fresh = row.valeurs.map(v => String(v));
            ecrireCacheLocal(storageKey, key, fresh);
            setList(fresh);
          }
        }
      )
      .subscribe();

    return () => {
      try { supabase.removeChannel(channel); } catch { /* déjà fermé */ }
    };
  }, [storageKey, key]);

  // Setter qui propage Supabase + cache + UI
  const updateList = useCallback(async (newList) => {
    const safe = Array.isArray(newList) ? [...newList] : [];
    setList(safe); // optimistic UI
    try {
      await sauverListe(storageKey, key, safe);
    } catch (e) {
      // Cache déjà mis à jour par sauverListe — on log mais on ne
      // bloque pas l'utilisateur. Un toast pourrait être ajouté ici
      // si on veut prévenir explicitement de l'absence de sync.
      console.warn(
        `[useListe] Sauvegarde Supabase échouée pour ${storageKey}/${key}:`,
        e?.message || e
      );
    }
  }, [storageKey, key]);

  return [list, updateList];
}
