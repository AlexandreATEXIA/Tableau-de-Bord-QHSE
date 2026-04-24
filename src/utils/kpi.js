// ─── src/utils/kpi.js ────────────────────────────────────────────────────────
// Helpers mathématiques pour les calculs d'indicateurs QHSE.
// Règles :
//   • Jamais de division par zéro silencieuse
//   • Jamais de NaN propagé dans un KPI affiché
//   • Jamais de Date invalide interprétée comme 1970-01-01
//   • Sémantique claire entre "pas de donnée" et "valeur nulle"
//
// Convention fallback retenue (auditeur ISO) : pas de donnée → null + hasData:false
// L'UI décide ensuite d'afficher "N/A" ou "—" plutôt qu'un 0/100 trompeur.
// -----------------------------------------------------------------------------

/**
 * Convertit v en Number fini. Retourne `fallback` si null/undefined/""/NaN/Infinity.
 * Utiliser partout où on fait Number(champSupabase) pour éviter les NaN silencieux.
 */
export function safeNumber(v, fallback = 0) {
  if (v === null || v === undefined || v === '') return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Division protégée. Retourne `fallback` si dénominateur <= 0 ou non fini.
 * ATTENTION : utiliser `toPercent` à la place pour les pourcentages —
 * cette fonction est utile pour les ratios simples (TF, TG, moyennes).
 */
export function safeDivide(num, den, fallback = 0) {
  const n = safeNumber(num, NaN);
  const d = safeNumber(den, NaN);
  if (!Number.isFinite(n) || !Number.isFinite(d) || d === 0) return fallback;
  return n / d;
}

/**
 * Calcule un taux en pourcentage arrondi (0–100), en signalant explicitement
 * l'absence de données plutôt que d'afficher 0 % ou 100 % par défaut.
 *
 * @returns { value: number|null, hasData: boolean }
 *   - { value: null, hasData: false } si den <= 0 (aucune donnée à mesurer)
 *   - { value: N,    hasData: true  } sinon, avec N ∈ [0, 100]
 *
 * Usage UI :
 *   const { value, hasData } = toPercent(cloturees, total);
 *   return hasData ? `${value}%` : 'N/A';
 */
export function toPercent(num, den) {
  const n = safeNumber(num, NaN);
  const d = safeNumber(den, NaN);
  if (!Number.isFinite(n) || !Number.isFinite(d) || d <= 0) {
    return { value: null, hasData: false };
  }
  const pct = Math.round((n / d) * 100);
  // Clamp défensif : un numérateur > dénominateur ne doit pas sortir > 100
  return { value: Math.min(100, Math.max(0, pct)), hasData: true };
}

/**
 * Parse une date. Retourne `null` si input falsy ou Date invalide.
 * Remplace les `new Date(x)` bruts qui donnent 1970-01-01 sur null.
 */
export function safeDate(input) {
  if (input === null || input === undefined || input === '') return null;
  const d = input instanceof Date ? input : new Date(input);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Calcule la différence en jours (entiers) entre deux dates.
 * Retourne `null` si l'une des dates est invalide — plus jamais de
 * "diffJ = -20000 jours" sur une échéance vide.
 *
 * @returns number (jours, Math.ceil) ou null
 */
export function diffJours(dateCible, dateRef = new Date()) {
  const c = safeDate(dateCible);
  const r = safeDate(dateRef);
  if (c === null || r === null) return null;
  return Math.ceil((c.getTime() - r.getTime()) / 86400000);
}

/**
 * Calcule la date d'expiration d'une habilitation = dateObtention + N années.
 * Source unique pour remplacer les 7 implémentations divergentes de `calcExp`
 * dans l'application.
 *
 * Retourne `null` si :
 *   • dateObtention est null/undefined/"" ou non parsable → protège contre
 *     `new Date(null)` qui donnait 01/01/1970 et classait l'habilitation
 *     comme "périmée" par défaut (faux positif classique).
 *   • validiteAnnees n'est pas un nombre fini → protège contre
 *     `Number(null) = 0` qui faisait expirer l'habilitation le jour même
 *     de son obtention (bug silencieux très grave).
 *   • la date d'expiration calculée est elle-même invalide (valeurs absurdes).
 *
 * ATTENTION UI : null peut se coercer en 0 dans une comparaison `<= new Date()`
 * (0 <= timestamp = true). Les appelants DOIVENT tester explicitement
 * `exp !== null` avant toute comparaison — ne jamais faire
 * `calcExpiration(...) <= now` directement.
 *
 * Pattern correct :
 *   const exp = calcExpiration(h.obtention, h.validiteAns);
 *   const perimee = exp !== null && exp <= new Date();
 */
export function calcExpiration(dateObtention, validiteAnnees) {
  const debut = safeDate(dateObtention);
  if (!debut) return null;
  const n = safeNumber(validiteAnnees, NaN);
  if (!Number.isFinite(n)) return null;
  // Copie défensive pour ne jamais muter la Date source si elle est réutilisée.
  const exp = new Date(debut.getTime());
  exp.setFullYear(exp.getFullYear() + n);
  return Number.isFinite(exp.getTime()) ? exp : null;
}

/**
 * Moyenne défensive : ignore les valeurs non finies et refuse les tableaux vides.
 *
 * @param arr    tableau d'éléments
 * @param getter fonction extrayant le nombre à moyenner
 * @returns { value: number|null, hasData: boolean, count: number }
 *          count = nombre d'éléments réellement pris en compte (après filtrage NaN)
 */
export function safeMean(arr, getter = (x) => x) {
  if (!Array.isArray(arr) || arr.length === 0) {
    return { value: null, hasData: false, count: 0 };
  }
  const valides = arr
    .map((x) => safeNumber(getter(x), NaN))
    .filter((n) => Number.isFinite(n));
  if (valides.length === 0) return { value: null, hasData: false, count: 0 };
  const somme = valides.reduce((s, n) => s + n, 0);
  return { value: somme / valides.length, hasData: true, count: valides.length };
}

/**
 * Pourcentage d'atteinte d'un objectif QHSE, gérant correctement le cas
 * "cible = 0" (ex: objectif zéro accident) qui était buggé auparavant.
 *
 * @param reel   valeur mesurée
 * @param cible  valeur cible
 * @param sens   'max' (plus c'est haut mieux c'est) ou 'min' (plus c'est bas mieux c'est)
 * @returns number ∈ [0, 100]
 *
 * Sémantique :
 *   • sens='min', cible=0 : 100 % si reel=0, sinon 0 % (objectif "zéro" binaire)
 *   • sens='min', cible>0 : 100 % si reel<=cible, sinon dégradé linéaire jusqu'à 0 %
 *   • sens='max', cible=0 : 100 % (tout reel ≥ 0 satisfait un objectif "≥0")
 *   • sens='max', cible>0 : min(100, reel/cible * 100)
 */
export function tauxAtteinteObjectif(reel, cible, sens = 'max') {
  const r = safeNumber(reel, 0);
  const c = safeNumber(cible, 0);

  if (sens === 'min') {
    if (c === 0) return r === 0 ? 100 : 0; // objectif "zéro" strict
    if (r <= c) return 100;
    return Math.max(0, Math.round((1 - (r - c) / c) * 100));
  }
  // sens === 'max'
  if (c === 0) return 100; // objectif "≥0" toujours satisfait
  return Math.min(100, Math.round((r / c) * 100));
}
