import { useTheme } from './ThemeContext';
import React, { useState, useRef } from 'react';
import { supabase } from './supabaseClient';
import {
  Upload, FileSpreadsheet, CheckCircle, AlertTriangle, X,
  Download, Loader, ChevronRight, RefreshCw, Eye, Trash2, Info, Sparkles, Archive
} from 'lucide-react';
import { fusionnerDansListe } from './utils/listes';
import { exporterArchive, EXPORT_CONFIG } from './utils/exportXlsx';

// Version application — récupérée depuis package.json par Vite (import direct).
// Si l'import échoue (cas rare en dev), fallback à 'inconnue' pour ne pas casser.
import pkg from '../package.json';
const APP_VERSION = pkg?.version || 'inconnue';

// ─── Mappings Excel → Supabase ────────────────────────────────────────────────
// `listesAEnrichir` : pour chaque colonne Supabase (après transformation),
// on indique le couple [storageKey, listKey] du référentiel à enrichir
// automatiquement avec les valeurs distinctes rencontrées dans le fichier.
// La fusion est idempotente (voir utils/listes.js) : aucune duplication,
// aucune perte des valeurs existantes — les dropdowns des modules restent
// rétro-compatibles et se mettent simplement à jour au prochain mount.
const MAPPINGS = {
  DUERP: {
    table: 'registre_duerp', label: 'Registre DUERP', color: '#F59E0B',
    colonnes: {
      'Date M.A.J':'date_maj',
      'Famille de risque':'famille_risque',
      'Unité de Travail':'unite_travail',
      'Danger identifié':'danger',
      'Événement déclencheur':'evenement_declencheur',
      'Risque encouru':'risque',
      'Dommage potentiel':'dommage_potentiel',
      'Personnes exposées':'personnes_exposees',
      'Gravité (1-4)':'gravite',
      'Probabilité (1-4)':'probabilite',
      'Mesure EPC (description)':'mesures_epc',
      'Mesure Organisation (description)':'mesures_orga',
      'Mesure EPI (description)':'mesures_epi',
      'Action préventive':'action_preventive',
      'Pilote':'pilote',
    },
    requis: ['Danger identifié'],
    // Colonnes booléennes à dériver de la présence de texte
    boolFromText: { mesures_epc:'a_mesure_epc', mesures_orga:'a_mesure_orga', mesures_epi:'a_mesure_epi' },
    // Auto-enrichissement des référentiels éditables du module RegistreDUERP
    listesAEnrichir: {
      famille_risque:      ['duerp', 'Familles de risques'],
      unite_travail:       ['duerp', 'Unités de travail'],
      personnes_exposees:  ['duerp', 'Personnes exposées'],
    },
  },
  Plan_Actions: {
    table: 'plan_actions', label: "Plan d'Actions", color: '#3B82F6',
    colonnes: {
      'Origine':'origine',
      'Domaine':'domaine',
      "Type d'action":'type_action',
      "Description de l'action":'action',
      'Cause racine':'cause_racine',
      'Référence source':'reference_source',
      'Pilote':'pilote',
      'Échéance':'echeance',
      'Date cible révisée':'date_cible_revisee',
      'Avancement (%)':'avancement_pct',
      'Priorité':'priorite',
      'Coût estimé (€)':'cout_estime',
      'Coût réel (€)':'cout_reel',
      'Statut':'statut',
      'Résultat efficacité':'resultat_efficacite',
    },
    requis: ["Description de l'action"],
    listesAEnrichir: {
      origine: ['plan_actions', 'Origines'],
      domaine: ['plan_actions', 'Domaines'],
    },
  },
  Habilitations: {
    table: 'habilitations', label: 'Habilitations', color: '#10B981',
    colonnes: { 'Employé':'employe',"Domaine d'habilitation":'domaine',"Date d'obtention":'obtention','Validité (ans)':'validiteAns' },
    requis: ['Employé',"Domaine d'habilitation"],
    listesAEnrichir: {
      domaine: ['habilitations', 'Habilitations'],
    },
  },
  Accidents_Incidents: {
    table: 'securite_accidents', label: 'Accidents & Inc.', color: '#EF4444',
    colonnes: { 'Date':'date_evenement',"Type d'événement":'type_evenement','Lieu':'lieu','Description':'description','Jours perdus':'jours_perdus',"Statut enquête":'statut_enquete' },
    requis: ['Date'],
    listesAEnrichir: {
      type_evenement: ['accidents', "Types d'événements"],
      lieu:           ['accidents', 'Lieux'],
    },
  },
  Environnement: {
    table: 'environnement_flux', label: 'Environnement', color: '#06B6D4',
    colonnes: { 'Date':'date_relevement','Type de flux':'type_flux','Quantité':'quantite','Unité':'unite','Notes':'notes' },
    requis: ['Date','Type de flux','Quantité'],
    listesAEnrichir: {
      type_flux: ['environnement', 'Types de flux'],
      unite:     ['environnement', 'Unités'],
    },
  },
  Employes: {
    table: 'rh_employes', label: 'Employés RH', color: '#8B5CF6',
    colonnes: { 'Nom':'nom','Prénom':'prenom','Poste':'poste','Service':'service','Contrat':'contrat','Date entrée':'date_entree' },
    requis: ['Nom'],
    listesAEnrichir: {
      poste:   ['social_rh', 'Postes'],
      service: ['social_rh', 'Services'],
      contrat: ['social_rh', 'Contrats'],
    },
  },
  Formations: {
    table: 'rh_formations', label: 'Plan de Formation', color: '#EC4899',
    colonnes: { 'Titre':'titre','Type':'type_formation','Organisme':'organisme','Date début':'date_debut','Date fin':'date_fin','Durée (h)':'duree_heures','Participants':'participants','Coût (€)':'cout','Statut':'statut','Notes':'notes' },
    requis: ['Titre'],
    listesAEnrichir: {
      type_formation: ['social_rh', 'Types de formation'],
      organisme:      ['social_rh', 'Organismes'],
    },
  },
  NC: {
    table: 'qualite_nc', label: 'Non-Conformités', color: '#F97316',
    colonnes: { 'Date':'date_nc','Processus':'processus','Origine':'origine','Type':'type_nc','Description':'description','Action corrective':'action_corrective','Statut':'statut_nc' },
    requis: ['Date','Description'],
    listesAEnrichir: {
      processus: ['qualite_audits', 'Processus / Services'],
      origine:   ['qualite_audits', 'Origines NC'],
      type_nc:   ['qualite_audits', 'Types de NC'],
    },
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Convertit une valeur Excel en chaîne ISO YYYY-MM-DD.
 * Lance une erreur explicite si la date est invalide (mois > 12, jour > 31,
 * 31 février, etc.) — pour que l'utilisateur sache ligne par ligne ce qui
 * coince, au lieu de recevoir un cryptique "value out of range" Postgres.
 *
 * Formats acceptés :
 *   - Date (objet) — sortie de SheetJS avec cellDates: true
 *   - Number       — numéro de série Excel (depuis 1900-01-01)
 *   - "YYYY-MM-DD" ou "YYYY-MM-DDTHH:..." — ISO
 *   - "DD/MM/YYYY" — format français saisi en texte
 */
function formatDate(val) {
  if (val === null || val === undefined || val === '') return null;

  // Cas 1 : objet Date (SheetJS cellDates)
  if (val instanceof Date) {
    if (isNaN(val.getTime())) {
      throw new Error(`date invalide (objet Date corrompu)`);
    }
    return val.toISOString().split('T')[0];
  }

  // Cas 2 : nombre — numéro de série Excel
  if (typeof val === 'number') {
    const d = new Date((val - 25569) * 86400 * 1000);
    if (isNaN(d.getTime())) {
      throw new Error(`numéro de série Excel invalide (${val})`);
    }
    return d.toISOString().split('T')[0];
  }

  // Cas 3 : chaîne — ISO ou français
  if (typeof val === 'string') {
    let candidate = null;
    let m;
    if ((m = val.match(/^(\d{4})-(\d{2})-(\d{2})/))) {
      candidate = `${m[1]}-${m[2]}-${m[3]}`;
    } else if ((m = val.match(/^(\d{2})\/(\d{2})\/(\d{4})/))) {
      candidate = `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
    }
    if (candidate) {
      // Validation stricte : mois 01-12, jour 01-31, et round-trip Date pour
      // attraper les cas type "31 février" ou "30 février" (le constructeur
      // JS les convertit silencieusement, le round-trip ISO ne correspondra
      // alors plus à la chaîne d'origine).
      const [y, mo, d] = candidate.split('-').map(Number);
      if (mo < 1 || mo > 12) {
        throw new Error(`date invalide "${val}" : mois "${String(mo).padStart(2,'0')}" hors plage (01-12)`);
      }
      if (d < 1 || d > 31) {
        throw new Error(`date invalide "${val}" : jour "${String(d).padStart(2,'0')}" hors plage (01-31)`);
      }
      const dt = new Date(`${candidate}T00:00:00Z`);
      if (isNaN(dt.getTime())) {
        throw new Error(`date invalide "${val}"`);
      }
      const iso = dt.toISOString().substring(0, 10);
      if (iso !== candidate) {
        throw new Error(`date invalide "${val}" : ne correspond à aucun jour réel`);
      }
      return candidate;
    }
    // Format inconnu : on remonte l'erreur explicitement plutôt que de
    // laisser Postgres rejeter avec un message peu clair.
    throw new Error(`format de date non reconnu "${val}" — formats acceptés : YYYY-MM-DD ou DD/MM/YYYY`);
  }

  throw new Error(`type de date inattendu : ${typeof val}`);
}

const DATE_COLS  = new Set(['obtention','echeance','date_debut','date_fin','date_cible_revisee','date_verification_efficacite']);
const NUM_COLS   = new Set(['gravite','probabilite','criticite','criticite_resid','coefficient_reducteur','jours_perdus','validiteAns','duree_heures','cout','cout_estime','cout_reel','quantite','avancement_pct','nombre_reports']);

/**
 * Transforme une ligne Excel en objet Supabase prêt à insérer.
 * Reporte la colonne fautive dans le message d'erreur — utile pour
 * pointer l'utilisateur sur la cellule à corriger.
 */
function transformRow(row, mapping) {
  const result = {};
  for (const [excelCol, supaCol] of Object.entries(mapping.colonnes)) {
    let val = row[excelCol];
    if (val === undefined || val === null || val === '') continue;
    try {
      if (supaCol.includes('date') || DATE_COLS.has(supaCol)) {
        val = formatDate(val);
      } else if (NUM_COLS.has(supaCol)) {
        val = parseFloat(String(val).replace(',', '.')) || 0;
      }
    } catch (e) {
      // Re-lance avec contexte colonne — capté plus haut pour reporting ligne
      throw new Error(`colonne "${excelCol}" : ${e.message}`);
    }
    if (val !== null) result[supaCol] = val;
  }
  // Dériver les booléens EPC/ORG/EPI depuis la présence de texte
  if (mapping.boolFromText) {
    for (const [textCol, boolCol] of Object.entries(mapping.boolFromText)) {
      if (result[textCol]) result[boolCol] = true;
    }
  }
  // Calculer criticité initiale auto pour DUERP (CI = G × F)
  if (result.gravite && result.probabilite && !result.criticite) {
    result.criticite = result.gravite * result.probabilite;
  }
  return result;
}

function validerLigne(row, mapping, idx) {
  const erreurs = [];
  for (const col of (mapping.requis || [])) {
    if (!row[col] || String(row[col]).trim() === '') {
      erreurs.push(`Ligne ${idx + 2} : colonne "${col}" obligatoire manquante`);
    }
  }
  return erreurs;
}

/**
 * Enrichit les listes de référence à partir des lignes déjà transformées
 * (supaCol → valeur). Silencieux : aucune interruption si la fusion échoue
 * (quota localStorage, panne réseau Supabase, navigation privée…). Retourne
 * uniquement les nouvelles valeurs ajoutées par liste (diagnostic UI).
 *
 * Étape B : la fusion devient asynchrone (lit/écrit Supabase via
 * `fusionnerDansListe`). Les listes par module sont traitées en série
 * — le volume est faible (≤ 3 listes par onglet × ≤ 50 valeurs distinctes),
 * pas besoin de paralléliser et on garde un séquencement déterministe
 * pour le diagnostic UI.
 */
async function enrichirListesDepuisImport(rows, mapping) {
  const diag = [];
  if (!mapping.listesAEnrichir) return diag;
  for (const [supaCol, [storageKey, listKey]] of Object.entries(mapping.listesAEnrichir)) {
    // Collecte des valeurs distinctes non vides de cette colonne
    const valeurs = [];
    for (const r of rows) {
      const v = r?.[supaCol];
      if (v === null || v === undefined) continue;
      const s = String(v).trim();
      if (s) valeurs.push(s);
    }
    if (valeurs.length === 0) continue;
    try {
      const { ajoutes } = await fusionnerDansListe(storageKey, listKey, valeurs);
      if (ajoutes.length > 0) {
        diag.push({ storageKey, listKey, ajoutes });
      }
    } catch {
      // Silencieux — l'import des données ne doit jamais être bloqué par une
      // erreur de fusion de liste. La fusion est idempotente : un ré-import
      // plus tard rattrapera les valeurs manquantes.
    }
  }
  return diag;
}

// ─── Composant principal ──────────────────────────────────────────────────────
export default function ImportExcel() {
  const { p, isDark } = useTheme();
  const [dragging, setDragging]   = useState(false);
  const [fichier, setFichier]     = useState(null);
  const [apercu, setApercu]       = useState(null);
  const [validations, setValid]   = useState({});
  const [loading, setLoading]     = useState(false);
  const [progression, setProg]    = useState(0);
  const [resultats, setResultats] = useState(null);
  const [etape, setEtape]         = useState('upload');
  const [modeUpdate, setMode]     = useState(false);
  const fileRef = useRef();

  // ── État de la modale d'export d'archive (Lot C) ───────────────────────
  // Toggles cochés par défaut pour une archive complète (sécurité maximale).
  // L'utilisateur peut décocher pour exclure RGPD ou journal volumineux.
  const [exportOpen,    setExportOpen]    = useState(false);
  const [expArchived,   setExpArchived]   = useState(true);
  const [expSensitive,  setExpSensitive]  = useState(true);
  const [expVolume,     setExpVolume]     = useState(true);
  const [exportLoading, setExportLoading] = useState(false);
  const [exportError,   setExportError]   = useState('');
  const [exportDoneInfo,setExportDoneInfo]= useState(null);
  const [exportStep,    setExportStep]    = useState({ current: 0, total: 0, sheet: '' });

  const loadXLSX = () => new Promise(resolve => {
    if (window.XLSX) { resolve(window.XLSX); return; }
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
    s.onload = () => resolve(window.XLSX);
    document.head.appendChild(s);
  });

  const lireFichier = async (file) => {
    if (!file) return;
    setFichier(file); setLoading(true); setResultats(null); setApercu(null);
    const XLSX  = await loadXLSX();
    const buf   = await file.arrayBuffer();
    const wb    = XLSX.read(buf, { type:'array', cellDates:true });
    const previews = [];
    const valids   = {};

    for (const sheetName of wb.SheetNames) {
      const mapping = MAPPINGS[sheetName];
      if (!mapping) continue;
      const ws   = wb.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(ws, { defval:'' });
      if (rows.length === 0) continue;

      const transformed = [];
      const erreurs     = [];
      rows.filter(r => Object.values(r).some(v => v !== '')).forEach((r, idx) => {
        const errs = validerLigne(r, mapping, idx);
        if (errs.length > 0) { erreurs.push(...errs); return; }
        try {
          transformed.push(transformRow(r, mapping));
        } catch (e) {
          // Erreur de transformation (date invalide, format inattendu) —
          // on consigne ligne + colonne pour que l'utilisateur sache où
          // corriger sans bloquer l'import des autres lignes valides.
          erreurs.push(`Ligne ${idx + 2} : ${e.message}`);
        }
      });

      previews.push({ sheetName, label:mapping.label, color:mapping.color, rows:transformed, count:transformed.length, ignored:rows.length - transformed.length });
      valids[sheetName] = { erreurs, ok:erreurs.length === 0 };
    }

    setApercu(previews);
    setValid(valids);
    setLoading(false);
    setEtape('apercu');
  };

  const importerDonnees = async () => {
    if (!apercu) return;
    setLoading(true); setProg(0); setResultats(null);
    const res = [];
    for (let i = 0; i < apercu.length; i++) {
      const { sheetName, rows } = apercu[i];
      const mapping = MAPPINGS[sheetName];
      setProg(Math.round(((i) / apercu.length) * 100));

      // Auto-enrichissement des référentiels éditables AVANT l'insertion en base.
      // Volontairement placé avant le try/catch Supabase : même si l'insert
      // échoue pour une raison réseau, les listes auront vu passer les valeurs
      // utiles — et un ré-import ne créera pas de doublons (fusion idempotente).
      // Étape B : await obligatoire car fusionnerDansListe parle à Supabase.
      const listesEnrichies = await enrichirListesDepuisImport(rows, mapping);

      // Insérer par lots de 50
      const CHUNK = 50;
      let ok = true; let errMsg = '';
      for (let j = 0; j < rows.length; j += CHUNK) {
        const chunk = rows.slice(j, j + CHUNK);
        const { error } = modeUpdate
          ? await supabase.from(mapping.table).upsert(chunk)
          : await supabase.from(mapping.table).insert(chunk);
        if (error) { ok = false; errMsg = error.message; break; }
      }
      res.push({ sheet:sheetName, label:mapping.label, color:mapping.color, ok, count:rows.length, err:errMsg, listesEnrichies });
      setProg(Math.round(((i+1) / apercu.length) * 100));
    }
    setResultats(res);
    setLoading(false);
    setEtape('done');
  };

  const reset = () => { setFichier(null); setApercu(null); setValid({}); setResultats(null); setEtape('upload'); setProg(0); };

  const telechargerTemplate = async () => {
    const XLSX = await loadXLSX();
    const wb = XLSX.utils.book_new();
    for (const [sheetName, mapping] of Object.entries(MAPPINGS)) {
      const headers = Object.keys(mapping.colonnes);
      const ws = XLSX.utils.aoa_to_sheet([headers]);
      // Largeur automatique
      ws['!cols'] = headers.map(() => ({ wch: 22 }));
      XLSX.utils.book_append_sheet(wb, ws, sheetName);
    }
    XLSX.writeFile(wb, 'SMI_Templates_Import.xlsx');
  };

  const handleDrop = (e) => {
    e.preventDefault(); setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f?.name.match(/\.(xlsx|xls)$/i)) lireFichier(f);
  };

  // ── Lancement de l'export d'archive ────────────────────────────────────
  // Le bouton "Télécharger l'archive" de la modale appelle cette fonction.
  // Tous les toggles d'inclusion sont passés à exporterArchive ; le suivi
  // de progression alimente exportStep pour l'UI.
  const lancerExportArchive = async () => {
    setExportLoading(true);
    setExportError('');
    setExportDoneInfo(null);
    setExportStep({ current: 0, total: 0, sheet: '' });
    try {
      const info = await exporterArchive({
        includeArchived:  expArchived,
        includeSensitive: expSensitive,
        includeVolume:    expVolume,
        appVersion:       APP_VERSION,
        onProgress: (current, total, sheet) =>
          setExportStep({ current, total, sheet }),
      });
      setExportDoneInfo(info);
    } catch (e) {
      setExportError(e?.message || String(e));
    } finally {
      setExportLoading(false);
    }
  };

  const fermerExportModal = () => {
    if (exportLoading) return;  // on bloque la fermeture pendant la génération
    setExportOpen(false);
    setExportError('');
    setExportDoneInfo(null);
  };

  const ONGLETS_INFO = Object.entries(MAPPINGS).map(([key, m]) => ({ key, label:m.label, color:m.color }));

  const STEPS = ['Choisir le fichier', 'Vérifier', 'Importer'];

  return (
    <div className="space-y-6 pb-10">

      {/* ── En-tête ──────────────────────────────────────────────────────── */}
      <header className="page-header">
        <div>
          <h2 className="page-title flex items-center gap-3">
            <FileSpreadsheet size={26} className="text-green-400"/> Import Excel
          </h2>
          <p className="page-subtitle">Importez vos données QHSE depuis un fichier Excel vers Supabase</p>
        </div>
        <div className="flex gap-2">
          <button onClick={telechargerTemplate} className="btn-secondary">
            <Download size={15}/> Templates Excel
          </button>
          <button
            onClick={() => setExportOpen(true)}
            className="btn-secondary"
            style={{ background: 'rgba(139,92,246,0.12)', borderColor: 'rgba(139,92,246,0.35)', color: '#C4B5FD' }}
            title="Sauvegarde complète des données métier en .xlsx"
          >
            <Archive size={15}/> Exporter l'archive
          </button>
        </div>
      </header>

      {/* ── Étapes ───────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2">
        {STEPS.map((label, i) => {
          const steps = ['upload','apercu','done'];
          const isActive = etape === steps[i];
          const isDone   = steps.indexOf(etape) > i;
          return (
            <React.Fragment key={i}>
              <div className={`flex items-center gap-2 text-sm font-medium ${isActive?'text-blue-400':isDone?'text-emerald-400':'text-slate-500'}`}>
                <div style={{width:28,height:28,borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:800,border:`2px solid ${isActive?'#3B82F6':isDone?'#10B981':'#334155'}`,background:isActive?'rgba(59,130,246,0.15)':isDone?'rgba(16,185,129,0.15)':'transparent',color:isActive?'#60A5FA':isDone?'#34D399':'#475569'}}>
                  {isDone ? '✓' : i+1}
                </div>
                {label}
              </div>
              {i < STEPS.length-1 && <ChevronRight size={13} style={{color:p.text4}}/>}
            </React.Fragment>
          );
        })}
        <div style={{marginLeft:'auto',display:'flex',alignItems:'center',gap:8}}>
          <span style={{fontSize:12,color:p.text3}}>Mode :</span>
          <button onClick={()=>setMode(!modeUpdate)}
            style={{fontSize:12,fontWeight:600,padding:'4px 12px',borderRadius:100,border:'1px solid',cursor:'pointer',transition:'all 0.15s',
              background:modeUpdate?'rgba(245,158,11,0.15)':p.whiteFaint2,
              borderColor:modeUpdate?'rgba(245,158,11,0.4)':p.border,
              color:modeUpdate?'#FCD34D':p.text3}}>
            {modeUpdate ? '⚡ Mise à jour (upsert)' : '➕ Ajout uniquement'}
          </button>
        </div>
      </div>

      {/* ── Zone upload ──────────────────────────────────────────────────── */}
      {etape === 'upload' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2">
            <div
              className="glass-panel"
              style={{ border:`2px dashed ${dragging?'rgba(59,130,246,0.6)':p.border}`, background:dragging?'rgba(59,130,246,0.04)':undefined, transition:'all 0.2s', padding:'52px 36px', display:'flex', flexDirection:'column', alignItems:'center', cursor:'pointer' }}
              onDragOver={e=>{e.preventDefault();setDragging(true);}} onDragLeave={()=>setDragging(false)} onDrop={handleDrop}
              onClick={()=>fileRef.current?.click()}
            >
              <input ref={fileRef} type="file" accept=".xlsx,.xls" style={{display:'none'}} onChange={e=>lireFichier(e.target.files[0])}/>
              <div style={{width:60,height:60,background:'rgba(59,130,246,0.12)',border:'1px solid rgba(59,130,246,0.3)',borderRadius:16,display:'flex',alignItems:'center',justifyContent:'center',marginBottom:18}}>
                <Upload size={26} className="text-blue-400"/>
              </div>
              <p className="text-white text-lg font-bold mb-2">Glissez votre fichier Excel ici</p>
              <p className="text-slate-400 text-sm mb-5">ou cliquez pour sélectionner</p>
              <div className="flex gap-2">{['.xlsx','.xls'].map(e=><span key={e} className="badge badge-blue">{e}</span>)}</div>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">Onglets reconnus ({ONGLETS_INFO.length})</p>
            {ONGLETS_INFO.map(s => (
              <div key={s.key} className="glass-panel p-3 flex items-center gap-3" style={{borderLeft:`3px solid ${s.color}`}}>
                <FileSpreadsheet size={15} style={{color:s.color,flexShrink:0}}/>
                <div>
                  <p className="text-white text-xs font-semibold">{s.key}</p>
                  <p className="text-slate-400 text-xs">{s.label}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Chargement ───────────────────────────────────────────────────── */}
      {loading && etape !== 'done' && (
        <div className="glass-panel p-10 text-center">
          <Loader size={32} className="animate-spin text-blue-400 mx-auto mb-3"/>
          <p className="text-slate-300 font-medium">
            {etape === 'apercu' && progression > 0 ? `Import en cours... ${progression}%` : 'Analyse du fichier...'}
          </p>
          {progression > 0 && (
            <div style={{height:6,background:p.whiteFaint,borderRadius:3,margin:'12px auto',width:300}}>
              <div style={{height:'100%',width:`${progression}%`,background:'#3B82F6',borderRadius:3,transition:'width 0.3s'}}/>
            </div>
          )}
        </div>
      )}

      {/* ── Aperçu ───────────────────────────────────────────────────────── */}
      {etape === 'apercu' && apercu && !loading && (
        <div className="space-y-4">
          {/* Erreurs de validation */}
          {Object.entries(validations).some(([,v]) => v.erreurs.length > 0) && (
            <div className="glass-panel p-4 border border-amber-500/20">
              <h3 className="text-amber-400 font-bold mb-3 flex items-center gap-2"><AlertTriangle size={16}/> Avertissements de validation</h3>
              {Object.entries(validations).map(([sheet, v]) =>
                v.erreurs.map((err, i) => (
                  <p key={`${sheet}-${i}`} style={{fontSize:12,color:'#FCD34D',marginBottom:4}}>· {err}</p>
                ))
              )}
            </div>
          )}

          <div className="glass-panel p-5">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="text-white font-bold text-lg">Aperçu des données</h3>
                <p className="text-slate-400 text-sm mt-0.5">{apercu.reduce((s,a)=>s+a.count,0)} ligne(s) valide(s) à importer</p>
              </div>
              <div className="flex gap-3">
                <button onClick={reset} className="btn-secondary"><X size={14}/> Annuler</button>
                <button onClick={importerDonnees} className="btn-primary" style={{background:'#10B981',boxShadow:'0 0 16px rgba(16,185,129,0.3)'}}>
                  <Upload size={14}/> Importer {apercu.reduce((s,a)=>s+a.count,0)} ligne(s)
                </button>
              </div>
            </div>

            {/* Résumé par onglet */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
              {apercu.map(a => (
                <div key={a.sheetName} style={{background:`${a.color}10`,border:`1px solid ${a.color}30`,borderRadius:10,padding:'10px 14px'}}>
                  <p style={{fontSize:11,color:a.color,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:4}}>{a.label}</p>
                  <p style={{fontSize:22,fontWeight:900,color:p.text1}}>{a.count}</p>
                  {a.ignored > 0 && <p style={{fontSize:10,color:'#F59E0B',marginTop:2}}>{a.ignored} ligne(s) ignorée(s)</p>}
                </div>
              ))}
            </div>

            {/* Tableaux aperçu */}
            {apercu.map(({ sheetName, label, color, rows }) => (
              <div key={sheetName} className="mb-5">
                <div className="flex items-center gap-2 mb-2">
                  <div style={{width:8,height:8,background:color,borderRadius:'50%'}}/>
                  <span className="text-white font-semibold text-sm">{sheetName}</span>
                  <span className="badge badge-blue text-xs">{rows.length} lignes</span>
                </div>
                <div className="overflow-x-auto rounded-xl border border-white/5">
                  <table className="table-modern">
                    <thead><tr>{Object.keys(rows[0]||{}).slice(0,6).map(k=><th key={k}>{k}</th>)}</tr></thead>
                    <tbody>
                      {rows.slice(0,3).map((row,i)=>(
                        <tr key={i}>{Object.values(row).slice(0,6).map((v,j)=><td key={j} style={{maxWidth:140,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{String(v??'').substring(0,45)}</td>)}</tr>
                      ))}
                      {rows.length>3 && <tr><td colSpan={6} style={{textAlign:'center',color:p.text4,fontStyle:'italic',fontSize:12}}>... et {rows.length-3} ligne(s) de plus</td></tr>}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Résultats ────────────────────────────────────────────────────── */}
      {etape === 'done' && resultats && (
        <div className="space-y-4">
          <div className="glass-panel p-5">
            <h3 className="text-white font-bold text-lg mb-4 flex items-center gap-2">
              <CheckCircle size={20} className="text-emerald-400"/> Résultats de l'import
            </h3>

            {/* Bilan */}
            <div className="grid grid-cols-3 gap-4 mb-5">
              {[
                {label:'Tables importées', val:resultats.filter(r=>r.ok).length, color:'#10B981'},
                {label:'Lignes importées', val:resultats.filter(r=>r.ok).reduce((s,r)=>s+r.count,0), color:'#3B82F6'},
                {label:'Erreurs', val:resultats.filter(r=>!r.ok).length, color:resultats.some(r=>!r.ok)?'#EF4444':'#10B981'},
              ].map((k,i) => (
                <div key={i} style={{background:p.whiteFaint2,border:`1px solid ${p.border}`,borderRadius:10,padding:'14px',textAlign:'center'}}>
                  <p style={{fontSize:10,color:p.text3,fontWeight:700,textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:6}}>{k.label}</p>
                  <p style={{fontSize:28,fontWeight:900,color:k.color}}>{k.val}</p>
                </div>
              ))}
            </div>

            <div className="space-y-2">
              {resultats.map(r => (
                <div key={r.sheet} className={`alert-banner ${r.ok?'alert-green':'alert-red'}`}>
                  {r.ok ? <CheckCircle size={16} className="shrink-0"/> : <AlertTriangle size={16} className="shrink-0"/>}
                  <div>
                    <p className="font-bold">{r.label} — {r.ok ? `${r.count} ligne(s) importée(s)` : 'Erreur'}</p>
                    {r.err && <p className="text-xs mt-0.5 opacity-80">{r.err}</p>}
                    {Array.isArray(r.listesEnrichies) && r.listesEnrichies.length > 0 && (
                      <p className="text-xs mt-1 opacity-90" style={{color:'#A7F3D0'}}>
                        <Sparkles size={11} style={{display:'inline',verticalAlign:'-2px',marginRight:4}}/>
                        Listes enrichies : {r.listesEnrichies.map(e => `${e.listKey} (+${e.ajoutes.length})`).join(' · ')}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex gap-3 mt-5">
              <button onClick={reset} className="btn-secondary"><Upload size={14}/> Importer un autre fichier</button>
              <button onClick={()=>window.location.reload()} className="btn-primary"><CheckCircle size={14}/> Voir les données</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Aucun onglet reconnu ──────────────────────────────────────────── */}
      {etape === 'apercu' && apercu?.length === 0 && !loading && (
        <div className="glass-panel p-10 text-center">
          <AlertTriangle size={36} className="text-amber-400 mx-auto mb-3"/>
          <p className="text-white font-bold text-lg mb-2">Aucun onglet reconnu</p>
          <p className="text-slate-400 text-sm">Onglets acceptés : {Object.keys(MAPPINGS).join(', ')}</p>
          <button onClick={reset} className="btn-secondary mt-5"><X size={14}/> Réessayer</button>
        </div>
      )}

      {/* ── Info mode ────────────────────────────────────────────────────── */}
      <div className="glass-panel p-4 border border-blue-500/15">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2"><Info size={13}/> Modes d'import</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[
            {icon:'➕',titre:'Mode Ajout (défaut)',desc:'Ajoute les nouvelles lignes. Si une ligne existe déjà (même ID), elle sera ignorée ou créera un doublon.'},
            {icon:'⚡',titre:'Mode Mise à jour (upsert)',desc:'Ajoute les nouvelles lignes ET met à jour les existantes. Utile pour re-importer un fichier corrigé.'},
          ].map((m,i) => (
            <div key={i} style={{background:p.bgCard2,borderRadius:10,padding:'11px 14px',display:'flex',gap:10}}>
              <span style={{fontSize:18,flexShrink:0}}>{m.icon}</span>
              <div><p style={{fontSize:12,fontWeight:700,color:p.text1,marginBottom:2}}>{m.titre}</p><p style={{fontSize:11,color:p.text4}}>{m.desc}</p></div>
            </div>
          ))}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* ── Modale d'export d'archive (Lot C) ───────────────────────────── */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {exportOpen && (
        <div
          onClick={e => { if (e.target === e.currentTarget) fermerExportModal(); }}
          style={{
            position:'fixed', top:0, left:0, right:0, bottom:0, zIndex:999999,
            background:'rgba(0,0,0,0.78)', display:'flex',
            alignItems:'center', justifyContent:'center', padding:20,
          }}
        >
          <div style={{
            background:'#0F1729', border:'1px solid rgba(139,92,246,0.25)',
            borderRadius:16, width:'100%', maxWidth:560, maxHeight:'85vh',
            display:'flex', flexDirection:'column',
            boxShadow:'0 40px 100px rgba(0,0,0,0.9)',
          }}>
            {/* Header modale */}
            <div style={{ padding:'16px 20px', borderBottom:'1px solid rgba(255,255,255,0.08)', display:'flex', justifyContent:'space-between', alignItems:'center', flexShrink:0 }}>
              <div>
                <div style={{ fontSize:15, fontWeight:800, color:'#F1F5F9', display:'flex', alignItems:'center', gap:8 }}>
                  <Archive size={17} color="#A78BFA"/> Archive complète
                </div>
                <p style={{ fontSize:11, color:'#64748B', marginTop:2 }}>
                  Sauvegarde Excel de toutes les données métier — lisible et ré-importable.
                </p>
              </div>
              <button
                onClick={fermerExportModal}
                disabled={exportLoading}
                style={{
                  background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)',
                  borderRadius:8, color:'#94A3B8', padding:'6px 8px', display:'flex',
                  cursor: exportLoading ? 'not-allowed' : 'pointer',
                  opacity: exportLoading ? 0.5 : 1,
                }}
              >
                <X size={16}/>
              </button>
            </div>

            {/* Body modale */}
            <div style={{ flex:1, overflowY:'auto', padding:'18px 22px' }}>

              {/* Résultat post-export (succès) */}
              {exportDoneInfo && !exportLoading && (
                <div style={{
                  background:'rgba(16,185,129,0.1)', border:'1px solid rgba(16,185,129,0.3)',
                  borderRadius:10, padding:'12px 14px', marginBottom:14,
                }}>
                  <p style={{ fontSize:13, fontWeight:800, color:'#34D399', marginBottom:4 }}>
                    <CheckCircle size={14} style={{display:'inline',verticalAlign:'-2px',marginRight:6}}/>
                    Archive téléchargée
                  </p>
                  <p style={{ fontSize:12, color:'#A7F3D0', marginBottom:6 }}>{exportDoneInfo.filename}</p>
                  <p style={{ fontSize:11, color:'#86EFAC', fontFamily:'monospace' }}>
                    Signature : {exportDoneInfo.signature || '—'}
                  </p>
                </div>
              )}

              {/* Résultat post-export (erreur) */}
              {exportError && !exportLoading && (
                <div style={{
                  background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.3)',
                  borderRadius:10, padding:'12px 14px', marginBottom:14,
                }}>
                  <p style={{ fontSize:13, fontWeight:800, color:'#F87171', marginBottom:4 }}>
                    <AlertTriangle size={14} style={{display:'inline',verticalAlign:'-2px',marginRight:6}}/>
                    Échec de l'export
                  </p>
                  <p style={{ fontSize:12, color:'#FCA5A5' }}>{exportError}</p>
                </div>
              )}

              {/* Génération en cours */}
              {exportLoading && (
                <div style={{ textAlign:'center', padding:'20px 0' }}>
                  <Loader size={28} className="animate-spin text-purple-400 mx-auto mb-3"/>
                  <p style={{ fontSize:13, color:'#E2E8F0', fontWeight:600 }}>
                    Génération en cours…
                  </p>
                  <p style={{ fontSize:11, color:'#94A3B8', marginTop:4 }}>
                    {exportStep.sheet
                      ? `Onglet ${exportStep.current + 1}/${exportStep.total} — ${exportStep.sheet}`
                      : 'Préparation…'}
                  </p>
                  {exportStep.total > 0 && (
                    <div style={{ height:6, background:'rgba(255,255,255,0.08)', borderRadius:3, margin:'14px auto', width:280 }}>
                      <div style={{
                        height:'100%',
                        width:`${Math.round((exportStep.current / exportStep.total) * 100)}%`,
                        background:'#A78BFA', borderRadius:3, transition:'width 0.3s',
                      }}/>
                    </div>
                  )}
                </div>
              )}

              {/* Options (tant qu'aucun export en cours/terminé) */}
              {!exportLoading && !exportDoneInfo && (
                <>
                  <p style={{ fontSize:12, color:'#94A3B8', marginBottom:14, lineHeight:1.5 }}>
                    L'archive contient un onglet par module, plus deux feuilles techniques
                    (<code style={{ color:'#A78BFA' }}>_metadata</code> et
                    <code style={{ color:'#A78BFA' }}> _schema</code>).
                    Les onglets compatibles peuvent être ré-importés via cet écran pour
                    reconstituer les données.
                  </p>

                  {[
                    {
                      checked: expArchived, set: setExpArchived,
                      titre: 'Inclure les enregistrements archivés',
                      desc:  'Concerne les actions, NC, accidents et DUERP archivés (archived_at non vide). À garder pour une sauvegarde exhaustive.',
                    },
                    {
                      checked: expSensitive, set: setExpSensitive,
                      titre: 'Inclure RH et Formations (RGPD)',
                      desc:  'Contient noms, prénoms, postes, organismes et liste des participants. À décocher pour partager l\'archive avec un consultant externe.',
                    },
                    {
                      checked: expVolume, set: setExpVolume,
                      titre: 'Inclure le journal d\'audit',
                      desc:  'Trace exhaustive des actions réalisées dans l\'app. Peut atteindre plusieurs milliers de lignes.',
                    },
                  ].map((opt, i) => (
                    <label
                      key={i}
                      style={{
                        display:'flex', gap:10, padding:'10px 12px', marginBottom:8,
                        background:'rgba(255,255,255,0.03)',
                        border:`1px solid ${opt.checked ? 'rgba(139,92,246,0.35)' : 'rgba(255,255,255,0.08)'}`,
                        borderRadius:9, cursor:'pointer',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={opt.checked}
                        onChange={e => opt.set(e.target.checked)}
                        style={{ marginTop:3, accentColor:'#A78BFA', cursor:'pointer' }}
                      />
                      <div>
                        <p style={{ fontSize:13, fontWeight:700, color:'#E2E8F0' }}>{opt.titre}</p>
                        <p style={{ fontSize:11, color:'#94A3B8', marginTop:2, lineHeight:1.4 }}>{opt.desc}</p>
                      </div>
                    </label>
                  ))}

                  {/* Aperçu compact des onglets qui seront générés */}
                  <div style={{ marginTop:14, padding:'10px 12px', background:'rgba(59,130,246,0.06)', border:'1px solid rgba(59,130,246,0.15)', borderRadius:9 }}>
                    <p style={{ fontSize:11, fontWeight:700, color:'#60A5FA', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:8 }}>
                      Onglets qui seront exportés
                    </p>
                    <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                      {EXPORT_CONFIG
                        .filter(c => (expSensitive || !c.sensitive) && (expVolume || !c.volume))
                        .map(c => (
                          <span key={c.sheetName} style={{
                            fontSize:11, fontWeight:600, padding:'3px 9px', borderRadius:100,
                            background:'rgba(139,92,246,0.12)', color:'#C4B5FD',
                            border:'1px solid rgba(139,92,246,0.2)',
                          }}>{c.sheetName}</span>
                        ))}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Footer modale */}
            <div style={{ padding:'12px 20px', borderTop:'1px solid rgba(255,255,255,0.07)', display:'flex', justifyContent:'space-between', alignItems:'center', flexShrink:0, background:'rgba(0,0,0,0.2)' }}>
              <span style={{ fontSize:11, color:'#475569' }}>
                {exportLoading
                  ? 'Ne fermez pas cette fenêtre…'
                  : exportDoneInfo
                    ? 'Fichier sauvegardé sur votre poste.'
                    : `Version ${APP_VERSION}`}
              </span>
              <div className="flex gap-2">
                {exportDoneInfo && !exportLoading && (
                  <button
                    onClick={() => { setExportDoneInfo(null); setExportError(''); }}
                    className="btn-secondary"
                    style={{ fontSize:13 }}
                  >
                    <RefreshCw size={13}/> Nouvel export
                  </button>
                )}
                <button
                  onClick={fermerExportModal}
                  disabled={exportLoading}
                  className="btn-secondary"
                  style={{ fontSize:13, opacity: exportLoading ? 0.5 : 1 }}
                >
                  Fermer
                </button>
                {!exportLoading && !exportDoneInfo && (
                  <button
                    onClick={lancerExportArchive}
                    className="btn-primary"
                    style={{ fontSize:13, background:'#8B5CF6', boxShadow:'0 0 16px rgba(139,92,246,0.35)' }}
                  >
                    <Download size={13}/> Télécharger l'archive
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
