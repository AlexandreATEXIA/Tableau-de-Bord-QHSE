// =====================================================================
// src/utils/rgpd.js — Helpers RGPD centralisés (Lot 6 Phase 1)
// =====================================================================
// Références :
//   - RGPD Art. 5  (minimisation, limitation conservation)
//   - RGPD Art. 6  (bases légales)
//   - RGPD Art. 9  (catégories particulières — données santé)
//   - RGPD Art. 12 (délai 1 mois pour répondre aux demandes)
//   - RGPD Art. 15 / 17 / 20 (droits d'accès, effacement, portabilité)
//   - RGPD Art. 30 (registre des traitements)
//
// Principe ISO-strict : toutes les fonctions retournent des valeurs sûres
// (null, false, 0) en cas de saisie invalide — jamais NaN / Invalid Date.
// =====================================================================

// Tables contenant des données à caractère personnel (directes ou indirectes)
export const TABLES_DONNEES_PERSONNELLES = [
  'rh_employes',
  'rh_habilitations',
  'habilitations',
  'rh_formations',
  'securite_accidents',
  'plan_actions',       // indirect : nom du pilote
  'reunions_qhse',      // indirect : participants
  'audit_log',          // indirect : utilisateur
];

// Durées de conservation par table (années)
// Sources : Code du travail, Code de la santé publique, arrêtés ministériels
export const DUREES_CONSERVATION_ANNEES = {
  rh_employes:          5,    // Code du travail L3243-4 (bulletins de paie)
  rh_habilitations:    10,    // Traçabilité accidents différés
  habilitations:       10,
  rh_formations:        5,    // Code du travail L6321-1
  securite_accidents:  50,    // Prescription MP différée (L441-4 CSS)
  audit_log:           10,    // ISO 9001 §7.5.3 + diligence RGPD
  plan_actions:         5,
  reunions_qhse:        5,
  registre_duerp:      40,    // Décret 2022-395
  veille_reglementaire: 5,
  objectifs_qhse:       5,
  fournisseurs_eval:    5,
};

// Catégories de données RGPD par table (Art. 30.1.c)
export const CATEGORIES_RGPD_PAR_TABLE = {
  rh_employes:        ['Identité', 'Coordonnées professionnelles', 'Vie professionnelle'],
  rh_habilitations:   ['Identité', 'Qualifications professionnelles'],
  habilitations:      ['Identité', 'Qualifications professionnelles'],
  rh_formations:      ['Identité', 'Parcours de formation'],
  securite_accidents: ['Identité', 'Santé (Art. 9 — catégorie particulière)', 'Circonstances AT/MP'],
  plan_actions:       ['Identité (pilote)', "Contenu d'action"],
  reunions_qhse:      ['Identité (participants)', 'Contenu de réunion'],
  audit_log:          ['Identité (utilisateur)', 'Actions techniques'],
};

// Base légale par table (Art. 6)
export const BASE_LEGALE_PAR_TABLE = {
  rh_employes:        { article: '6.1.b', nom: 'Exécution du contrat de travail' },
  rh_habilitations:   { article: '6.1.c', nom: 'Obligation légale (sécurité au travail)' },
  habilitations:      { article: '6.1.c', nom: 'Obligation légale (sécurité au travail)' },
  rh_formations:      { article: '6.1.c', nom: 'Obligation légale (Code du travail L6321-1)' },
  securite_accidents: { article: '6.1.c + 6.1.d', nom: 'Obligation légale (AT-MP) + intérêt vital' },
  plan_actions:       { article: '6.1.f', nom: 'Intérêt légitime (pilotage QHSE)' },
  reunions_qhse:      { article: '6.1.f', nom: 'Intérêt légitime (pilotage QHSE)' },
  audit_log:          { article: '6.1.f', nom: 'Intérêt légitime (traçabilité ISO 9001 §7.5.3)' },
};

// Types de demandes RGPD (Art. 15-21)
export const TYPES_DEMANDE_RGPD = [
  { id: 'ACCES',         label: "Droit d'accès",          article: 'Art. 15' },
  { id: 'RECTIFICATION', label: 'Droit de rectification', article: 'Art. 16' },
  { id: 'EFFACEMENT',    label: "Droit à l'effacement",   article: 'Art. 17' },
  { id: 'LIMITATION',    label: 'Droit à la limitation',  article: 'Art. 18' },
  { id: 'PORTABILITE',   label: 'Droit à la portabilité', article: 'Art. 20' },
  { id: 'OPPOSITION',    label: "Droit d'opposition",     article: 'Art. 21' },
];

export const STATUTS_DEMANDE_RGPD = [
  { id: 'EN_COURS', label: 'En cours',  couleur: '#F59E0B' },
  { id: 'TRAITEE',  label: 'Traitée',   couleur: '#10B981' },
  { id: 'REJETEE',  label: 'Rejetée',   couleur: '#6B7280' },
  { id: 'EXPIREE',  label: 'Expirée',   couleur: '#EF4444' },
];

// ---------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------

/**
 * Calcule la date d'échéance CNIL (1 mois après réception — Art. 12).
 * En cas de demande complexe, extensible à 3 mois (à gérer manuellement).
 * Retourne null si la date d'entrée est invalide (ISO-strict).
 */
export function calculerEcheanceRGPD(dateReception = new Date()) {
  const d = new Date(dateReception);
  if (isNaN(d.getTime())) return null;
  d.setMonth(d.getMonth() + 1);
  return d;
}

/**
 * Retourne true si la demande est en retard : statut EN_COURS et date_echeance passée.
 * Null-safe et date-safe.
 */
export function estDemandeEnRetard(demande) {
  if (!demande || demande.statut !== 'EN_COURS') return false;
  if (!demande.date_echeance) return false;
  const echeance = new Date(demande.date_echeance);
  if (isNaN(echeance.getTime())) return false;
  return echeance.getTime() < Date.now();
}

/**
 * Retourne true si la ligne est périmée selon la durée de conservation de sa table.
 * @param {string|Date} dateRef - date de référence (ex: date_sortie, date_accident)
 * @param {string} tableName - nom de la table Supabase
 */
export function estPerime(dateRef, tableName) {
  if (!dateRef) return false;
  const dureeAnnees = DUREES_CONSERVATION_ANNEES[tableName];
  if (!dureeAnnees) return false;
  const d = new Date(dateRef);
  if (isNaN(d.getTime())) return false;
  const limite = new Date();
  limite.setFullYear(limite.getFullYear() - dureeAnnees);
  return d.getTime() < limite.getTime();
}

/**
 * Formate une date en FR court (dd/mm/yyyy). ISO-strict : retourne '—' si invalide.
 */
export function formatDateFR(d) {
  if (!d) return '—';
  const date = new Date(d);
  if (isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/**
 * Retourne le nombre de jours restants avant échéance (négatif = en retard).
 * Null-safe.
 */
export function joursAvantEcheance(dateEcheance) {
  if (!dateEcheance) return null;
  const d = new Date(dateEcheance);
  if (isNaN(d.getTime())) return null;
  const diffMs = d.getTime() - Date.now();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}
