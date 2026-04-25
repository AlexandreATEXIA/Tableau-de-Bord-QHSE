// =====================================================================
// src/utils/listes.js — Gestion centralisée des listes de référence
// =====================================================================
// Source de vérité : table Supabase `listes_referentiel` (étape B).
// Cache local (localStorage `gl_${storageKey}`) conservé pour :
//   - performance : affichage instantané au mount via `lireCacheLocal`
//   - mode offline : l'app reste utilisable si Supabase est inaccessible
//
// Le cache reste aligné sur le format historique de GestionListes.jsx
// (même préfixe `gl_`, même structure d'objet `{ "<key>": [...] }`)
// pour éviter toute divergence avec le composant existant.
//
// API publique (toutes async) :
//   - chargerListe(storageKey, key, defaults)  → Promise<string[]>
//   - sauverListe(storageKey, key, list)        → Promise<void>
//   - fusionnerDansListe(storageKey, key, vals) → Promise<{ liste, ajoutes }>
//
// Helper synchrone exposé pour le hook useListe (init rapide cache) :
//   - lireCacheLocal(storageKey, key, defaults) → string[]
//
// Migration A→B sans perte : à la première lecture d'un (storage_key, key)
// absent de Supabase, le contenu du cache local est uploadé automatiquement.
// Les listes déjà personnalisées par l'utilisateur en étape A ne sont
// donc jamais perdues lors du passage en étape B.
// =====================================================================

import { supabase } from '../supabaseClient';

const PREFIX = 'gl_';
const TABLE  = 'listes_referentiel';

// ─── Cache localStorage ─────────────────────────────────────────────────
function lireObjet(storageKey) {
  if (!storageKey) return {};
  try {
    const raw = localStorage.getItem(`${PREFIX}${storageKey}`);
    return raw ? (JSON.parse(raw) || {}) : {};
  } catch {
    return {};
  }
}

function ecrireObjet(storageKey, obj) {
  if (!storageKey) return;
  try {
    localStorage.setItem(`${PREFIX}${storageKey}`, JSON.stringify(obj));
  } catch {
    // Quota dépassé ou mode navigation privée — silencieux (non bloquant).
  }
}

/**
 * Lecture synchrone du cache local — retourne la valeur persistée si elle
 * existe (même tableau vide), sinon les defaults. Utilisé par useListe
 * pour afficher quelque chose immédiatement avant le fetch Supabase.
 *
 * @param {string} storageKey
 * @param {string} key
 * @param {string[]} defaults
 * @returns {string[]}
 */
export function lireCacheLocal(storageKey, key, defaults = []) {
  const obj = lireObjet(storageKey);
  if (Object.prototype.hasOwnProperty.call(obj, key)) {
    return Array.isArray(obj[key]) ? [...obj[key]] : [...defaults];
  }
  return [...defaults];
}

/**
 * Écriture synchrone du cache local. Exporté pour permettre au hook
 * useListe de rafraîchir le cache lorsqu'un évènement Realtime arrive
 * (étape B6) sans forcer un round-trip Supabase.
 *
 * @param {string} storageKey
 * @param {string} key
 * @param {string[]} list
 */
export function ecrireCacheLocal(storageKey, key, list) {
  const obj = lireObjet(storageKey);
  obj[key] = Array.isArray(list) ? [...list] : [];
  ecrireObjet(storageKey, obj);
}

/**
 * Charge une liste depuis Supabase, met à jour le cache local et retourne.
 *
 * Logique :
 *   1. SELECT sur listes_referentiel(storage_key, key)
 *   2a. Trouvé → met à jour le cache local + retourne les valeurs
 *   2b. Absent → SEED automatique :
 *        - si le cache local a déjà des valeurs personnalisées (étape A),
 *          on les UPLOADE vers Supabase (migration A→B sans perte)
 *        - sinon on initialise avec `defaults`
 *   3. En cas d'erreur réseau (offline, Supabase down) : fallback sur le
 *      cache local. L'app reste fonctionnelle, mais en lecture seule
 *      cohérente avec le poste local.
 *
 * @param {string} storageKey
 * @param {string} key
 * @param {string[]} defaults
 * @returns {Promise<string[]>}
 */
export async function chargerListe(storageKey, key, defaults = []) {
  if (!storageKey || !key) return [...defaults];

  try {
    const { data, error } = await supabase
      .from(TABLE)
      .select('valeurs')
      .eq('storage_key', storageKey)
      .eq('key', key)
      .maybeSingle();

    if (error) throw error;

    if (data && Array.isArray(data.valeurs)) {
      // Trouvé en base — la base fait foi, on rafraîchit le cache local
      const liste = data.valeurs.map(v => String(v));
      ecrireCacheLocal(storageKey, key, liste);
      return liste;
    }

    // Pas trouvé : seed initial
    const cache = lireCacheLocal(storageKey, key, defaults);
    const seed  = (cache && cache.length > 0) ? cache : [...defaults];
    // Insertion silencieuse — si une autre session vient de créer la ligne
    // entre-temps (course critique), on ignore l'erreur de duplicate.
    await supabase.from(TABLE).insert({ storage_key: storageKey, key, valeurs: seed });
    ecrireCacheLocal(storageKey, key, seed);
    return [...seed];
  } catch {
    // Fallback hors-ligne : on retourne le cache local (ou defaults)
    return lireCacheLocal(storageKey, key, defaults);
  }
}

/**
 * Remplace intégralement la liste (réorganisation, suppression, etc.).
 * Écrit AVANT en Supabase puis dans le cache — si Supabase échoue, on
 * garde quand même le cache à jour pour ne pas dégrader l'UX, mais on
 * remonte l'erreur via `throw` pour que l'appelant puisse afficher un
 * avertissement (ex. toast "modifications non synchronisées").
 *
 * @param {string} storageKey
 * @param {string} key
 * @param {string[]} list
 * @returns {Promise<void>}
 */
export async function sauverListe(storageKey, key, list) {
  if (!storageKey || !key) return;
  const liste = Array.isArray(list) ? list.map(v => String(v)) : [];

  // Cache local d'abord (résilience offline + retour visuel immédiat)
  ecrireCacheLocal(storageKey, key, liste);

  // Puis Supabase (upsert sur la contrainte unique storage_key+key)
  const { error } = await supabase
    .from(TABLE)
    .upsert(
      { storage_key: storageKey, key, valeurs: liste },
      { onConflict: 'storage_key,key' }
    );
  if (error) throw error;
}

/**
 * Fusion idempotente — n'ajoute que les valeurs nouvelles à la liste
 * existante. Normalisation : trim + comparaison casse-insensible. Vide
 * ignoré. Utilisée après un import Excel pour enrichir les dropdowns
 * avec les valeurs distinctes du fichier, sans créer de doublons.
 *
 * Étape B : la liste de référence est lue depuis Supabase, la fusion
 * calculée côté client, puis ré-uploadée en un seul upsert. Si la
 * connexion échoue, on tombe en mode dégradé (fusion sur le cache local
 * uniquement) plutôt que de bloquer l'import — l'utilisateur peut
 * toujours réimporter plus tard, l'opération est idempotente.
 *
 * @param {string} storageKey
 * @param {string} key
 * @param {Iterable<string>} nouvellesValeurs
 * @returns {Promise<{ liste: string[], ajoutes: string[] }>}
 */
export async function fusionnerDansListe(storageKey, key, nouvellesValeurs) {
  // 1. Charger l'existant (Supabase si dispo, sinon cache)
  const existants = await chargerListe(storageKey, key, []);
  const setNorme  = new Set(existants.map(v => String(v).trim().toLowerCase()));
  const ajoutes   = [];

  for (const v of (nouvellesValeurs || [])) {
    if (v === null || v === undefined) continue;
    const s = String(v).trim();
    if (!s) continue;
    const n = s.toLowerCase();
    if (setNorme.has(n)) continue;
    setNorme.add(n);
    ajoutes.push(s);
  }

  if (ajoutes.length === 0) return { liste: existants, ajoutes: [] };

  const liste = [...existants, ...ajoutes];
  try {
    await sauverListe(storageKey, key, liste);
  } catch {
    // Mode dégradé : Supabase indisponible. On a déjà mis à jour le cache
    // local via sauverListe. Le ré-import idempotent corrigera plus tard.
  }
  return { liste, ajoutes };
}
