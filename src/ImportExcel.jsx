import { useTheme } from './ThemeContext';
import React, { useState, useRef } from 'react';
import { supabase } from './supabaseClient';
import {
  Upload, FileSpreadsheet, CheckCircle, AlertTriangle, X,
  Download, Loader, ChevronRight, RefreshCw, Eye, Trash2, Info
} from 'lucide-react';

// ─── Mappings Excel → Supabase ────────────────────────────────────────────────
const MAPPINGS = {
  DUERP: {
    table: 'registre_duerp', label: 'Registre DUERP', color: '#F59E0B',
    colonnes: { 'Date M.A.J':'date_maj','Unité de Travail':'unite_travail','Danger identifié':'danger','Risque encouru':'risque','Gravité (1-4)':'gravite','Probabilité (1-4)':'probabilite','Criticité (auto)':'criticite','Action préventive':'action_preventive' },
    requis: ['Danger identifié'],
  },
  Plan_Actions: {
    table: 'plan_actions', label: "Plan d'Actions", color: '#3B82F6',
    colonnes: { 'Origine':'origine','Domaine':'domaine',"Description de l'action":'action','Pilote':'pilote','Échéance':'echeance','Priorité':'priorite','Statut':'statut' },
    requis: ["Description de l'action"],
  },
  Habilitations: {
    table: 'habilitations', label: 'Habilitations', color: '#10B981',
    colonnes: { 'Employé':'employe',"Domaine d'habilitation":'domaine',"Date d'obtention":'obtention','Validité (ans)':'validiteAns' },
    requis: ['Employé',"Domaine d'habilitation"],
  },
  Accidents_Incidents: {
    table: 'securite_accidents', label: 'Accidents & Inc.', color: '#EF4444',
    colonnes: { 'Date':'date_evenement',"Type d'événement":'type_evenement','Lieu':'lieu','Description':'description','Jours perdus':'jours_perdus',"Statut enquête":'statut_enquete' },
    requis: ['Date'],
  },
  Environnement: {
    table: 'environnement_flux', label: 'Environnement', color: '#06B6D4',
    colonnes: { 'Date':'date_relevement','Type de flux':'type_flux','Quantité':'quantite','Unité':'unite','Notes':'notes' },
    requis: ['Date','Type de flux','Quantité'],
  },
  Employes: {
    table: 'rh_employes', label: 'Employés RH', color: '#8B5CF6',
    colonnes: { 'Nom':'nom','Prénom':'prenom','Poste':'poste','Service':'service','Contrat':'contrat','Date entrée':'date_entree' },
    requis: ['Nom'],
  },
  Formations: {
    table: 'rh_formations', label: 'Plan de Formation', color: '#EC4899',
    colonnes: { 'Titre':'titre','Type':'type_formation','Organisme':'organisme','Date début':'date_debut','Date fin':'date_fin','Durée (h)':'duree_heures','Participants':'participants','Coût (€)':'cout','Statut':'statut','Notes':'notes' },
    requis: ['Titre'],
  },
  NC: {
    table: 'qualite_nc', label: 'Non-Conformités', color: '#F97316',
    colonnes: { 'Date':'date_nc','Processus':'processus','Origine':'origine','Type':'type_nc','Description':'description','Action corrective':'action_corrective','Statut':'statut_nc' },
    requis: ['Date','Description'],
  },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatDate(val) {
  if (!val) return null;
  if (val instanceof Date) return val.toISOString().split('T')[0];
  if (typeof val === 'number') return new Date((val - 25569) * 86400 * 1000).toISOString().split('T')[0];
  if (typeof val === 'string' && val.match(/^\d{4}-\d{2}-\d{2}/)) return val.split('T')[0];
  if (typeof val === 'string' && val.match(/^\d{2}\/\d{2}\/\d{4}/)) {
    const [d,m,y] = val.split('/'); return `${y}-${m.padStart(2,'0')}-${d.padStart(2,'0')}`;
  }
  return String(val);
}

function transformRow(row, mapping) {
  const result = {};
  for (const [excelCol, supaCol] of Object.entries(mapping.colonnes)) {
    let val = row[excelCol];
    if (val === undefined || val === null || val === '') continue;
    if (supaCol.includes('date') || ['obtention','echeance','date_debut','date_fin'].includes(supaCol)) {
      val = formatDate(val);
    }
    if (['gravite','probabilite','criticite','jours_perdus','validiteAns','duree_heures','cout','quantite'].includes(supaCol)) {
      val = parseFloat(String(val).replace(',','.')) || 0;
    }
    result[supaCol] = val;
  }
  // Calculer criticité auto pour DUERP
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
        transformed.push(transformRow(r, mapping));
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
      res.push({ sheet:sheetName, label:mapping.label, color:mapping.color, ok, count:rows.length, err:errMsg });
      setProg(Math.round(((i+1) / apercu.length) * 100));
    }
    setResultats(res);
    setLoading(false);
    setEtape('done');
  };

  const reset = () => { setFichier(null); setApercu(null); setValid({}); setResultats(null); setEtape('upload'); setProg(0); };

  const handleDrop = (e) => {
    e.preventDefault(); setDragging(false);
    const f = e.dataTransfer.files[0];
    if (f?.name.match(/\.(xlsx|xls)$/i)) lireFichier(f);
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
        <a href="#" onClick={e => { e.preventDefault(); alert('Téléchargez le fichier SMI_Templates_Import.xlsx depuis les fichiers générés précédemment.'); }} className="btn-secondary" style={{textDecoration:'none'}}>
          <Download size={15}/> Templates Excel
        </a>
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
              background:modeUpdate?'rgba(245,158,11,0.15)':'rgba(255,255,255,0.04)',
              borderColor:modeUpdate?'rgba(245,158,11,0.4)':'rgba(255,255,255,0.08)',
              color:modeUpdate?'#FCD34D':'#64748B'}}>
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
              style={{ border:`2px dashed ${dragging?'rgba(59,130,246,0.6)':'rgba(255,255,255,0.1)'}`, background:dragging?'rgba(59,130,246,0.04)':undefined, transition:'all 0.2s', padding:'52px 36px', display:'flex', flexDirection:'column', alignItems:'center', cursor:'pointer' }}
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
                  <p style={{fontSize:22,fontWeight:900,color:'white'}}>{a.count}</p>
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
                <div key={i} style={{background:p.whiteFaint2,border:'1px solid rgba(255,255,255,0.08)',borderRadius:10,padding:'14px',textAlign:'center'}}>
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
    </div>
  );
}
