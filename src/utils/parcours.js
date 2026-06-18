// Logique pure du module Parcours d'accueil — testable sans Supabase ni React.

// Calcule la date d'échéance (YYYY-MM-DD) d'un jalon à partir d'une date
// de début et d'un délai. 'mois' = mois calendaire ; 'jours' = jours.
export function computeEcheance(dateDebut, delaiValeur, delaiUnite) {
  const d = new Date(`${dateDebut}T00:00:00`);
  const n = Number(delaiValeur) || 0;
  if (delaiUnite === 'mois') d.setMonth(d.getMonth() + n);
  else d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

// Progression d'un parcours : un jalon est "traité" s'il est Fait ou Non applicable.
export function progression(jalons) {
  const total = jalons.length;
  const traites = jalons.filter(j => j.statut === 'Fait' || j.statut === 'Non applicable').length;
  const pct = total === 0 ? 0 : Math.round((traites / total) * 100);
  return { traites, total, pct };
}

// Un parcours est terminé quand il a au moins un jalon et plus aucun "À faire".
export function parcoursEstTermine(jalons) {
  return jalons.length > 0 && jalons.every(j => j.statut !== 'À faire');
}

// Un jalon est en alerte s'il est encore À faire et que son échéance est atteinte/dépassée.
export function jalonEnAlerte(jalon, todayISO) {
  return jalon.statut === 'À faire' && jalon.date_echeance <= todayISO;
}

// Prochain jalon À faire (le plus proche dans le temps), ou null.
export function prochainJalon(jalons) {
  const aFaire = jalons
    .filter(j => j.statut === 'À faire')
    .sort((a, b) => a.date_echeance.localeCompare(b.date_echeance));
  return aFaire[0] || null;
}
