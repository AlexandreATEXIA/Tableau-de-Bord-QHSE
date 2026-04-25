// =====================================================================
// src/utils/exportXlsx.js — Export d'archive Excel (Lot C)
// =====================================================================
// Génère un .xlsx auto-suffisant contenant l'intégralité des données
// métier, à utiliser comme :
//   - sauvegarde de sécurité (RGPD : conservation hors ligne possible)
//   - vue consolidée à partager avec un consultant / commissaire
//   - source de réimport via l'écran ImportExcel (round-trip lossless
//     pour les onglets dont les libellés correspondent à MAPPINGS)
//
// Particularités :
//   - Tri DESC par date sur chaque feuille (la plus récente en premier)
//   - Libellés de colonnes alignés sur ImportExcel.MAPPINGS quand
//     applicable, pour que l'archive puisse être réimportée telle quelle
//   - Les colonnes calculées (`criticite`, booléens dérivés) sont
//     volontairement EXCLUES : elles seront recalculées à la
//     réimportation à partir des sources (gravité × probabilité,
//     présence de texte EPC/ORG/EPI). Les exporter créerait un risque
//     de double-comptage.
//   - Toggles RGPD : RH/Employés et journal d'audit sont opt-out
//   - Feuille `_metadata` (version app, date, totaux, hash signature)
//   - Feuille `_schema` (liste exhaustive colonnes/types par table —
//     utile si un jour reconstruction manuelle dans un autre outil)
// =====================================================================

import { supabase } from '../supabaseClient';

// ─── Chargement SheetJS (réutilisé depuis ImportExcel) ──────────────────
const SHEETJS_CDN = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';

function chargerSheetJS() {
  return new Promise(resolve => {
    if (window.XLSX) { resolve(window.XLSX); return; }
    const s = document.createElement('script');
    s.src = SHEETJS_CDN;
    s.onload = () => resolve(window.XLSX);
    document.head.appendChild(s);
  });
}

// ─── Configuration des tables à exporter ───────────────────────────────
// `dateColumn` : colonne pour le tri DESC (la plus récente en haut).
// `columns`    : map { "Libellé Excel": "supabase_col" }. L'ordre du dict
//                est préservé en JS modernes — c'est l'ordre dans le .xlsx.
// `sensitive`  : true si la table contient des données RGPD/personnelles.
// `volume`     : true si la table peut atteindre des volumes importants
//                (audit_log) — toggle pour exclure si besoin.
// `roundTrip`  : true si l'onglet est compatible avec une réimportation
//                via ImportExcel (libellés alignés sur MAPPINGS).
//
// Les colonnes calculées (criticite, a_mesure_*, etc.) sont sciemment
// absentes — voir docstring du fichier.

export const EXPORT_CONFIG = [
  {
    sheetName: 'DUERP',
    table: 'registre_duerp',
    dateColumn: 'date_maj',
    roundTrip: true,
    columns: {
      'Date M.A.J':                       'date_maj',
      'Famille de risque':                'famille_risque',
      'Unité de Travail':                 'unite_travail',
      'Danger identifié':                 'danger',
      'Événement déclencheur':            'evenement_declencheur',
      'Risque encouru':                   'risque',
      'Dommage potentiel':                'dommage_potentiel',
      'Personnes exposées':               'personnes_exposees',
      'Gravité (1-4)':                    'gravite',
      'Probabilité (1-4)':                'probabilite',
      'Mesure EPC (description)':         'mesures_epc',
      'Mesure Organisation (description)':'mesures_orga',
      'Mesure EPI (description)':         'mesures_epi',
      'Coefficient réducteur':            'coefficient_reducteur',
      'Action préventive':                'action_preventive',
      'Pilote':                           'pilote',
      'Échéance':                         'echeance',
      'Archivé le':                       'archived_at',
      'Archivé par':                      'archived_by',
    },
  },
  {
    sheetName: 'Plan_Actions',
    table: 'plan_actions',
    dateColumn: 'created_at',
    roundTrip: true,
    columns: {
      'Origine':                          'origine',
      'Domaine':                          'domaine',
      "Type d'action":                    'type_action',
      'Titre':                            'titre',
      "Description de l'action":          'action',
      'Cause racine':                     'cause_racine',
      'Référence source':                 'reference_source',
      'Pilote':                           'pilote',
      'Échéance':                         'echeance',
      'Date cible révisée':               'date_cible_revisee',
      'Avancement (%)':                   'avancement_pct',
      'Priorité':                         'priorite',
      'Coût estimé (€)':                  'cout_estime',
      'Coût réel (€)':                    'cout_reel',
      'Statut':                           'statut',
      'Date vérification efficacité':     'date_verification_efficacite',
      'Résultat efficacité':              'resultat_efficacite',
      'Nombre reports':                   'nombre_reports',
      'Commentaire':                      'commentaire',
      'Créé le':                          'created_at',
      'Archivé le':                       'archived_at',
      'Archivé par':                      'archived_by',
    },
  },
  {
    sheetName: 'Habilitations',
    table: 'habilitations',
    dateColumn: 'obtention',
    roundTrip: true,
    columns: {
      'Employé':                          'employe',
      "Domaine d'habilitation":           'domaine',
      "Date d'obtention":                 'obtention',
      'Validité (ans)':                   'validiteAns',
      'Archivé le':                       'archived_at',
      'Archivé par':                      'archived_by',
    },
  },
  {
    sheetName: 'Accidents_Incidents',
    table: 'securite_accidents',
    dateColumn: 'date_evenement',
    roundTrip: true,
    columns: {
      'Date':                             'date_evenement',
      "Type d'événement":                 'type_evenement',
      'Lieu':                             'lieu',
      'Description':                      'description',
      'Cause immédiate':                  'cause_immediate',
      'Victime':                          'victime',
      'Témoin':                           'temoin',
      'Jours perdus':                     'jours_perdus',
      'Mesures immédiates':               'mesures_immediates',
      'Actions correctives':              'actions_correctives',
      "Statut enquête":                   'statut_enquete',
      'Archivé le':                       'archived_at',
      'Archivé par':                      'archived_by',
    },
  },
  {
    sheetName: 'Environnement',
    table: 'environnement_flux',
    dateColumn: 'date_relevement',
    roundTrip: true,
    columns: {
      'Date':                             'date_relevement',
      'Type de flux':                     'type_flux',
      'Quantité':                         'quantite',
      'Unité':                            'unite',
      'Notes':                            'notes',
    },
  },
  {
    sheetName: 'Audits',
    table: 'qualite_audits',
    dateColumn: 'date',
    roundTrip: false,
    columns: {
      'Titre':                            'titre',
      "Type d'audit":                     'type_audit',
      'Processus':                        'processus',
      'Auditeur':                         'auditeur',
      'Date prévue':                      'date_prevue',
      'Date réalisée':                    'date',
      'Statut':                           'statut',
      'Score (%)':                        'score',
    },
  },
  {
    sheetName: 'NC',
    table: 'qualite_nc',
    dateColumn: 'date_nc',
    roundTrip: true,
    columns: {
      'Date':                             'date_nc',
      'Processus':                        'processus',
      'Origine':                          'origine',
      'Type':                             'type_nc',
      'Description':                      'description',
      'Action corrective':                'action_corrective',
      'Statut':                           'statut_nc',
      'Archivé le':                       'archived_at',
      'Archivé par':                      'archived_by',
    },
  },
  {
    sheetName: 'Satisfaction',
    table: 'qualite_satisfaction',
    dateColumn: 'date_enquete',
    roundTrip: false,
    columns: {
      "Date enquête":                     'date_enquete',
      'Client':                           'client',
      'Projet':                           'projet',
      'Note globale':                     'note_globale',
      'Commentaire':                      'commentaire',
    },
  },
  {
    sheetName: 'QVT',
    table: 'qualite_qvt',
    dateColumn: 'date_campagne',
    roundTrip: false,
    columns: {
      'Date campagne':                    'date_campagne',
      'Nom campagne':                     'nom_campagne',
      'Effectif total':                   'effectif_total',
      'Réponses':                         'reponses',
      'Note moyenne':                     'note_moyenne',
    },
  },
  {
    sheetName: 'Employes',
    table: 'rh_employes',
    dateColumn: 'date_entree',
    roundTrip: true,
    sensitive: true,                     // RGPD : nom, prénom, poste
    columns: {
      'Nom':                              'nom',
      'Prénom':                           'prenom',
      'Poste':                            'poste',
      'Service':                          'service',
      'Contrat':                          'contrat',
      'Date entrée':                      'date_entree',
      'Actif':                            'actif',
      'Consentement RGPD':                'rgpd_consentement_date',
      'Anonymisé le':                     'rgpd_anonymise_le',
    },
  },
  {
    sheetName: 'Formations',
    table: 'rh_formations',
    dateColumn: 'date_debut',
    roundTrip: true,
    sensitive: true,                     // contient les listes participants
    columns: {
      'Titre':                            'titre',
      'Type':                             'type_formation',
      'Organisme':                        'organisme',
      'Date début':                       'date_debut',
      'Date fin':                         'date_fin',
      'Durée (h)':                        'duree_heures',
      'Participants':                     'participants',
      'Coût (€)':                         'cout',
      'Statut':                           'statut',
      'Notes':                            'notes',
      'Anonymisé le':                     'rgpd_anonymise_le',
    },
  },
  {
    sheetName: 'Listes_Referentiel',
    table: 'listes_referentiel',
    dateColumn: 'updated_at',
    roundTrip: false,
    columns: {
      'Module':                           'storage_key',
      'Liste':                            'key',
      'Valeurs (JSON)':                   'valeurs',     // sérialisé en chaîne
      'Mise à jour':                      'updated_at',
      'Modifié par':                      'updated_by',
    },
  },
  {
    sheetName: 'Audit_Log',
    table: 'audit_log',
    dateColumn: 'created_at',
    roundTrip: false,
    volume: true,                        // peut être très volumineux
    columns: {
      'Date':                             'created_at',
      'Table':                            'table_name',
      'Enregistrement':                   'record_id',
      'Action':                           'action',
      'Utilisateur':                      'user_name',
      'Détails (JSON)':                   'details',
    },
  },
];

// ─── Helpers ────────────────────────────────────────────────────────────

/**
 * Récupère toutes les lignes d'une table avec pagination 1000 (limite
 * par défaut Supabase). Tri par dateColumn DESC. Si `includeArchived`
 * est false ET que la table a une colonne `archived_at`, on filtre
 * `archived_at IS NULL`.
 */
async function fetchAll(tableName, { dateColumn, includeArchived }) {
  const PAGE = 1000;
  let from = 0;
  let total = [];

  while (true) {
    let q = supabase.from(tableName).select('*', { count: 'exact' });
    if (!includeArchived) {
      // Ne s'applique que si la colonne existe — sinon Supabase ignore
      // silencieusement le filtre sur colonne inexistante via la syntaxe
      // .is(). On utilise donc un try/catch côté caller via la requête
      // initiale.
      q = q.is('archived_at', null);
    }
    if (dateColumn) {
      q = q.order(dateColumn, { ascending: false, nullsFirst: false });
    }
    q = q.range(from, from + PAGE - 1);

    const { data, error } = await q;
    if (error) {
      // Si l'erreur vient de archived_at inexistant, on retente sans le filtre
      if (!includeArchived && /archived_at/i.test(error.message)) {
        return fetchAll(tableName, { dateColumn, includeArchived: true });
      }
      throw error;
    }
    if (!data || data.length === 0) break;
    total = total.concat(data);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return total;
}

/**
 * Sérialise une valeur pour Excel :
 *  - null/undefined → ''
 *  - Date → ISO YYYY-MM-DD (Excel reconnaîtra le format date)
 *  - JSON object/array → chaîne JSON.stringify (lisible et réimportable)
 *  - boolean → 'oui'/'non' pour lisibilité humaine
 *  - reste → tel quel (string, number)
 */
function valeurExcel(v) {
  if (v === null || v === undefined) return '';
  if (typeof v === 'boolean') return v ? 'oui' : 'non';
  if (typeof v === 'object') {
    try { return JSON.stringify(v); } catch { return String(v); }
  }
  return v;
}

/**
 * Calcule un hash SHA-256 court (8 hex) à partir d'une chaîne.
 * Sert d'empreinte de cohérence dans la feuille `_metadata`.
 * Si crypto.subtle indisponible (très vieux navigateur), retourne ''.
 */
async function hashCourt(str) {
  try {
    const enc = new TextEncoder().encode(str);
    const buf = await crypto.subtle.digest('SHA-256', enc);
    const hex = Array.from(new Uint8Array(buf))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    return hex.substring(0, 16);
  } catch {
    return '';
  }
}

/**
 * Récupère le schéma `information_schema.columns` filtré sur les tables
 * exportées, pour la feuille `_schema`. Si l'appel échoue (permissions),
 * retourne [] silencieusement et la feuille sera juste vide.
 */
async function fetchSchema(tableNames) {
  // Note : information_schema n'est pas exposé via PostgREST par défaut.
  // On reconstruit donc le schéma à partir d'EXPORT_CONFIG, ce qui suffit
  // amplement pour documenter l'archive (et reste en cohérence avec ce
  // qu'on a réellement exporté).
  const rows = [];
  for (const cfg of EXPORT_CONFIG) {
    if (!tableNames.includes(cfg.table)) continue;
    for (const [excelLabel, supaCol] of Object.entries(cfg.columns)) {
      rows.push({
        'Onglet':           cfg.sheetName,
        'Table Supabase':   cfg.table,
        'Colonne Excel':    excelLabel,
        'Colonne Supabase': supaCol,
        'Round-trip OK':    cfg.roundTrip ? 'oui' : 'non',
      });
    }
  }
  return rows;
}

// ─── API publique ───────────────────────────────────────────────────────

/**
 * Génère et télécharge l'archive Excel complète.
 *
 * @param {object}  opts
 * @param {boolean} [opts.includeArchived=true]   inclure les enregistrements `archived_at IS NOT NULL`
 * @param {boolean} [opts.includeSensitive=true]  inclure les tables RGPD (rh_employes, rh_formations)
 * @param {boolean} [opts.includeVolume=true]     inclure les tables volumineuses (audit_log)
 * @param {string}  [opts.appVersion='']          version de l'app (depuis package.json côté caller)
 * @param {function}[opts.onProgress]             callback (current, total, sheetName) — pour barre de progression UI
 * @returns {Promise<{ filename: string, totals: object, signature: string }>}
 */
export async function exporterArchive({
  includeArchived = true,
  includeSensitive = true,
  includeVolume = true,
  appVersion = '',
  onProgress,
} = {}) {
  const XLSX = await chargerSheetJS();
  const wb   = XLSX.utils.book_new();

  // Filtrage des tables selon les toggles
  const cfgs = EXPORT_CONFIG.filter(c => {
    if (c.sensitive && !includeSensitive) return false;
    if (c.volume    && !includeVolume)    return false;
    return true;
  });

  const totals = {};
  let totalLignes = 0;
  let signatureSrc = '';

  for (let i = 0; i < cfgs.length; i++) {
    const cfg = cfgs[i];
    if (typeof onProgress === 'function') {
      onProgress(i, cfgs.length, cfg.sheetName);
    }

    let rows = [];
    try {
      rows = await fetchAll(cfg.table, {
        dateColumn: cfg.dateColumn,
        includeArchived,
      });
    } catch (e) {
      // Table inexistante (ex : audit_log pas encore créé) — on log et continue
      console.warn(`[exportXlsx] Table "${cfg.table}" ignorée : ${e?.message || e}`);
      totals[cfg.sheetName] = 'erreur';
      continue;
    }

    // Transformation Supabase → libellés Excel
    const aoa = rows.map(r => {
      const out = {};
      for (const [excelLabel, supaCol] of Object.entries(cfg.columns)) {
        out[excelLabel] = valeurExcel(r[supaCol]);
      }
      return out;
    });

    const ws = XLSX.utils.json_to_sheet(aoa, { header: Object.keys(cfg.columns) });
    // Largeur de colonnes proportionnelle au libellé
    ws['!cols'] = Object.keys(cfg.columns).map(h => ({ wch: Math.max(h.length + 2, 14) }));
    XLSX.utils.book_append_sheet(wb, ws, cfg.sheetName);

    totals[cfg.sheetName] = aoa.length;
    totalLignes += aoa.length;
    // Source de signature : on hash uniquement les ids et les comptages
    // pour éviter d'avoir à parcourir tout le contenu (rapide, suffisant
    // pour détecter un échange de fichier).
    signatureSrc += `${cfg.sheetName}:${aoa.length}|`;
  }

  if (typeof onProgress === 'function') {
    onProgress(cfgs.length, cfgs.length, '_metadata');
  }

  // ── Feuille _metadata ──────────────────────────────────────────
  const signature = await hashCourt(`${signatureSrc}${new Date().toISOString()}`);
  const meta = [
    { Clé: 'Date export',            Valeur: new Date().toLocaleString('fr-FR') },
    { Clé: 'Version application',    Valeur: appVersion || 'inconnue' },
    { Clé: 'Tables exportées',       Valeur: cfgs.length },
    { Clé: 'Lignes totales',         Valeur: totalLignes },
    { Clé: 'Inclure archivés',       Valeur: includeArchived ? 'oui' : 'non' },
    { Clé: 'Inclure RH (RGPD)',      Valeur: includeSensitive ? 'oui' : 'non' },
    { Clé: 'Inclure journal audit',  Valeur: includeVolume ? 'oui' : 'non' },
    { Clé: 'Signature SHA-256',      Valeur: signature },
    { Clé: '',                       Valeur: '' },
    { Clé: '──── Détail par onglet ────', Valeur: '' },
    ...Object.entries(totals).map(([sheet, n]) => ({ Clé: sheet, Valeur: n })),
  ];
  const wsMeta = XLSX.utils.json_to_sheet(meta, { header: ['Clé', 'Valeur'] });
  wsMeta['!cols'] = [{ wch: 30 }, { wch: 32 }];
  XLSX.utils.book_append_sheet(wb, wsMeta, '_metadata');

  // ── Feuille _schema ───────────────────────────────────────────
  const schemaRows = await fetchSchema(cfgs.map(c => c.table));
  const wsSchema = XLSX.utils.json_to_sheet(schemaRows, {
    header: ['Onglet', 'Table Supabase', 'Colonne Excel', 'Colonne Supabase', 'Round-trip OK'],
  });
  wsSchema['!cols'] = [{ wch: 22 }, { wch: 22 }, { wch: 30 }, { wch: 26 }, { wch: 14 }];
  XLSX.utils.book_append_sheet(wb, wsSchema, '_schema');

  // Mettre _metadata + _schema en tête : ré-ordonnancement des SheetNames
  wb.SheetNames = ['_metadata', '_schema', ...cfgs.map(c => c.sheetName)];

  // Nom de fichier : SMI_archive_YYYY-MM-DD_HHhMM.xlsx
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm   = String(now.getMonth() + 1).padStart(2, '0');
  const dd   = String(now.getDate()).padStart(2, '0');
  const hh   = String(now.getHours()).padStart(2, '0');
  const mn   = String(now.getMinutes()).padStart(2, '0');
  const filename = `SMI_archive_${yyyy}-${mm}-${dd}_${hh}h${mn}.xlsx`;

  XLSX.writeFile(wb, filename);

  return { filename, totals, signature };
}
