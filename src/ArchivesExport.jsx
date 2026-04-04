import React, { useState, useEffect, useRef } from 'react';
import { useTheme } from './ThemeContext';
import { supabase } from './supabaseClient';
import {
  Archive, Download, Search, Upload, RefreshCw, CheckCircle,
  Clock, Database, FileSpreadsheet, X, AlertTriangle, History
} from 'lucide-react';

// ─── Configuration des tables à exporter ──────────────────────────────────────
const TABLES = [
  { id: 'securite_accidents',   label: 'Accidents & Incidents',    color: '#EF4444' },
  { id: 'plan_actions',         label: "Plan d'Actions (PDCA)",    color: '#3B82F6' },
  { id: 'habilitations',        label: 'Habilitations',            color: '#10B981' },
  { id: 'registre_duerp',       label: 'Registre DUERP',           color: '#F59E0B' },
  { id: 'qualite_nc',           label: 'Non-Conformités',          color: '#8B5CF6' },
  { id: 'qualite_audits',       label: 'Audits',                   color: '#06B6D4' },
  { id: 'qualite_satisfaction', label: 'Satisfaction Client',      color: '#EC4899' },
  { id: 'qualite_qvt',          label: 'QVT',                      color: '#84CC16' },
  { id: 'environnement_flux',   label: 'Environnement',            color: '#22C55E' },
  { id: 'rh_employes',          label: 'Employés',                 color: '#64748B' },
  { id: 'rh_formations',        label: 'Formations',               color: '#0EA5E9' },
  { id: 'objectifs_qhse',       label: 'Objectifs QHSE',           color: '#F97316' },
  { id: 'veille_reglementaire', label: 'Veille Réglementaire',     color: '#A855F7' },
  { id: 'reunions_qhse',        label: 'Réunions QHSE',            color: '#14B8A6' },
  { id: 'fournisseurs_eval',    label: 'Fournisseurs',             color: '#FB923C' },
  { id: 'calendrier_custom',    label: 'Calendrier',               color: '#818CF8' },
  { id: 'audit_log',            label: "Journal d'audit",          color: '#94A3B8' },
];

const HISTORY_KEY = 'qhse_export_history';
const MAX_HISTORY = 24;

function getHistory() {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'); } catch { return []; }
}
function saveHistory(h) {
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(h.slice(0, MAX_HISTORY))); } catch {}
}

const loadXLSX = () => new Promise(resolve => {
  if (window.XLSX) { resolve(window.XLSX); return; }
  const s = document.createElement('script');
  s.src = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
  s.onload = () => resolve(window.XLSX);
  document.head.appendChild(s);
});

// ─── Formatage d'une valeur pour Excel ────────────────────────────────────────
function fmt(v) {
  if (v === null || v === undefined) return '';
  if (typeof v === 'object') return JSON.stringify(v);
  return v;
}

export default function ArchivesExport() {
  const { p, isDark } = useTheme();
  const [tab, setTab]             = useState('export');
  const [counts, setCounts]       = useState({});
  const [loading, setLoading]     = useState(false);
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress]   = useState(0);
  const [history, setHistory]     = useState(getHistory);
  const [searchQuery, setSearch]  = useState('');
  const [archiveData, setArchive] = useState(null);
  const [searchResults, setResults] = useState(null);
  const [searching, setSearching] = useState(false);
  const fileRef = useRef();

  useEffect(() => { chargerCompteurs(); }, []);

  const chargerCompteurs = async () => {
    setLoading(true);
    const res = await Promise.all(
      TABLES.map(t => supabase.from(t.id).select('id', { count: 'exact', head: true }))
    );
    const c = {};
    TABLES.forEach((t, i) => { c[t.id] = res[i].count || 0; });
    setCounts(c);
    setLoading(false);
  };

  // ─── Export Excel complet ──────────────────────────────────────────────────
  const exporterArchive = async () => {
    setExporting(true);
    setProgress(0);
    const XLSX = await loadXLSX();
    const wb   = XLSX.utils.book_new();
    const recap = {};

    for (let i = 0; i < TABLES.length; i++) {
      const t = TABLES[i];
      setProgress(Math.round((i / TABLES.length) * 90));

      const { data } = await supabase.from(t.id).select('*').order('created_at', { ascending: false });
      const rows = data || [];
      recap[t.id] = rows.length;

      if (rows.length === 0) {
        const ws = XLSX.utils.aoa_to_sheet([['Aucune donnée']]);
        XLSX.utils.book_append_sheet(wb, ws, t.label.substring(0, 31));
        continue;
      }

      const headers = Object.keys(rows[0]);
      const wsData  = [
        headers,
        ...rows.map(r => headers.map(h => fmt(r[h]))),
      ];
      const ws = XLSX.utils.aoa_to_sheet(wsData);
      ws['!cols'] = headers.map(() => ({ wch: 20 }));

      // Ligne d'en-tête en gras
      headers.forEach((_, ci) => {
        const cell = ws[XLSX.utils.encode_cell({ r: 0, c: ci })];
        if (cell) cell.s = { font: { bold: true }, fill: { fgColor: { rgb: '1E3A5F' } } };
      });

      XLSX.utils.book_append_sheet(wb, ws, t.label.substring(0, 31));
    }

    // Onglet "Récapitulatif"
    const recapRows = [
      ['SMI Dashboard Pro — Archive QHSE', '', ''],
      ['Exporté le', new Date().toLocaleDateString('fr-FR', { day:'2-digit', month:'long', year:'numeric', hour:'2-digit', minute:'2-digit' }), ''],
      ['', '', ''],
      ['Module', 'Table Supabase', 'Nb enregistrements'],
      ...TABLES.map(t => [t.label, t.id, recap[t.id]]),
      ['', '', ''],
      ['TOTAL', '', Object.values(recap).reduce((s, v) => s + v, 0)],
    ];
    const wsRecap = XLSX.utils.aoa_to_sheet(recapRows);
    wsRecap['!cols'] = [{ wch: 30 }, { wch: 28 }, { wch: 22 }];
    XLSX.utils.book_append_sheet(wb, wsRecap, 'Récapitulatif');

    setProgress(95);

    const now      = new Date();
    const dateStr  = now.toISOString().substring(0, 10);
    const filename = `Archive_QHSE_${dateStr}.xlsx`;
    XLSX.writeFile(wb, filename);

    // Sauvegarder dans l'historique
    const entry = {
      date: now.toISOString(),
      filename,
      tables: recap,
      total: Object.values(recap).reduce((s, v) => s + v, 0),
    };
    const h = [entry, ...getHistory()];
    saveHistory(h);
    setHistory(h);
    setCounts(recap);

    setProgress(100);
    setTimeout(() => { setExporting(false); setProgress(0); }, 1200);
  };

  // ─── Recherche dans une archive importée ──────────────────────────────────
  const importerArchive = async (file) => {
    if (!file) return;
    setSearching(true);
    setResults(null);
    const XLSX  = await loadXLSX();
    const buf   = await file.arrayBuffer();
    const wb    = XLSX.read(buf, { type: 'array', cellDates: true });
    const sheets = {};
    wb.SheetNames.forEach(name => {
      if (name === 'Récapitulatif') return;
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[name], { defval: '' });
      if (rows.length > 0) sheets[name] = rows;
    });
    setArchive({ filename: file.name, sheets, date: new Date().toISOString() });
    setSearching(false);
    if (searchQuery.trim()) rechercherDansArchive(sheets, searchQuery);
  };

  const rechercherDansArchive = (sheets, query) => {
    if (!query.trim()) { setResults(null); return; }
    const q = query.toLowerCase();
    const results = [];
    Object.entries(sheets || archiveData?.sheets || {}).forEach(([sheet, rows]) => {
      rows.forEach((row, ri) => {
        const values = Object.values(row).map(v => String(v).toLowerCase());
        if (values.some(v => v.includes(q))) {
          results.push({ sheet, row, rowIndex: ri + 2 });
        }
      });
    });
    setResults(results);
  };

  const lancerRecherche = () => {
    if (!archiveData) return;
    rechercherDansArchive(archiveData.sheets, searchQuery);
  };

  const totalRecords = Object.values(counts).reduce((s, v) => s + v, 0);

  const TAB_STYLE = (id) => ({
    padding: '8px 18px', borderRadius: 8, border: '1px solid',
    cursor: 'pointer', fontSize: 13, fontWeight: 600, transition: 'all 0.15s',
    background: tab === id ? 'rgba(59,130,246,0.15)' : p.whiteFaint2,
    borderColor: tab === id ? 'rgba(59,130,246,0.4)' : p.border,
    color: tab === id ? '#60A5FA' : p.text3,
    display: 'flex', alignItems: 'center', gap: 7,
  });

  return (
    <div className="space-y-5 pb-10">

      <header className="page-header">
        <div>
          <h2 className="page-title flex items-center gap-3">
            <Archive size={26} className="text-blue-400"/> Archives & Export
          </h2>
          <p className="page-subtitle">Export Excel mensuel de toutes vos données · Recherche dans les archives passées</p>
        </div>
        <button onClick={chargerCompteurs} className="btn-secondary">
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''}/> Actualiser
        </button>
      </header>

      {/* ── Tabs ──────────────────────────────────────────────────────────── */}
      <div style={{ display:'flex', gap:8 }}>
        <button style={TAB_STYLE('export')}     onClick={() => setTab('export')}>
          <Download size={15}/> Exporter une archive
        </button>
        <button style={TAB_STYLE('historique')} onClick={() => setTab('historique')}>
          <History size={15}/> Historique ({history.length})
        </button>
        <button style={TAB_STYLE('recherche')}  onClick={() => setTab('recherche')}>
          <Search size={15}/> Recherche dans les archives
        </button>
      </div>

      {/* ══════════════════════════════════════════════════════════════════ */}
      {tab === 'export' && (
        <div className="space-y-5">

          {/* Résumé global */}
          <div className="glass-panel p-5" style={{ borderLeft: '3px solid #3B82F6' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:14 }}>
              <div>
                <p style={{ fontSize:14, fontWeight:700, color:p.text1, marginBottom:4 }}>
                  Snapshot complet de la base de données
                </p>
                <p style={{ fontSize:13, color:p.text3 }}>
                  <span style={{ color:'#3B82F6', fontWeight:800, fontSize:22 }}>{totalRecords.toLocaleString('fr-FR')}</span> enregistrements dans {TABLES.length} tables
                  · <span style={{ color:p.text4 }}>Dernier export : {history[0] ? new Date(history[0].date).toLocaleDateString('fr-FR') : 'jamais'}</span>
                </p>
              </div>
              <button onClick={exporterArchive} disabled={exporting}
                className="btn-primary shrink-0"
                style={{ background:'linear-gradient(135deg,#4F63E7,#06B6D4)', boxShadow:'0 0 20px rgba(79,99,231,0.3)', padding:'10px 22px', fontSize:14, fontWeight:700 }}>
                <Download size={17}/>
                {exporting ? `Export en cours... ${progress}%` : `Exporter Archive_QHSE_${new Date().toISOString().substring(0,10)}.xlsx`}
              </button>
            </div>

            {exporting && (
              <div style={{ marginTop:14 }}>
                <div style={{ height:6, background:p.whiteFaint, borderRadius:3 }}>
                  <div style={{ height:'100%', width:`${progress}%`, background:'linear-gradient(90deg,#4F63E7,#06B6D4)', borderRadius:3, transition:'width 0.3s' }}/>
                </div>
                <p style={{ fontSize:11, color:p.text4, marginTop:5 }}>Récupération des données... {progress}%</p>
              </div>
            )}
          </div>

          {/* Grille des tables */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(200px, 1fr))', gap:10 }}>
            {TABLES.map(t => (
              <div key={t.id} className="glass-panel p-4" style={{ borderLeft:`3px solid ${t.color}` }}>
                <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
                  <Database size={13} style={{ color:t.color, flexShrink:0 }}/>
                  <p style={{ fontSize:12, fontWeight:700, color:p.text2, lineHeight:1.3 }}>{t.label}</p>
                </div>
                <p style={{ fontSize:22, fontWeight:900, color:p.text1 }}>
                  {loading ? '…' : (counts[t.id] || 0).toLocaleString('fr-FR')}
                </p>
                <p style={{ fontSize:10, color:p.text4, marginTop:1 }}>enregistrements</p>
              </div>
            ))}
          </div>

          <div className="glass-panel p-4 flex items-start gap-3" style={{ background:'rgba(59,130,246,0.04)' }}>
            <FileSpreadsheet size={16} style={{ color:'#3B82F6', flexShrink:0, marginTop:2 }}/>
            <div style={{ fontSize:12, color:p.text3, lineHeight:1.7 }}>
              <strong style={{ color:p.text2 }}>Format du fichier exporté :</strong> un onglet Excel par module, plus un onglet "Récapitulatif" avec les totaux.
              Le fichier est nommé automatiquement avec la date du jour.
              <br/>Recommandation : exporter une fois par mois et archiver dans un dossier <code>Archives_QHSE/</code> sur votre poste ou OneDrive.
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {tab === 'historique' && (
        <div className="space-y-4">
          {history.length === 0 ? (
            <div className="glass-panel p-12 text-center">
              <Archive size={40} className="text-slate-600 mx-auto mb-4"/>
              <p className="text-white font-semibold mb-1">Aucun export réalisé</p>
              <p className="text-slate-500 text-sm">Allez dans "Exporter une archive" pour créer votre premier snapshot.</p>
            </div>
          ) : (
            <>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                <p style={{ fontSize:12, color:p.text4 }}>{history.length} export{history.length > 1 ? 's' : ''} — les {MAX_HISTORY} derniers sont conservés</p>
                <button onClick={() => { if(window.confirm('Effacer tout l\'historique ?')) { saveHistory([]); setHistory([]); }}}
                  style={{ fontSize:11, color:'#EF4444', background:'none', border:'none', cursor:'pointer', textDecoration:'underline' }}>
                  Effacer l'historique
                </button>
              </div>

              {history.map((h, i) => {
                const d    = new Date(h.date);
                const isLast = i === 0;
                return (
                  <div key={i} className="glass-panel p-5" style={{ borderLeft: isLast ? '3px solid #10B981' : `3px solid ${p.border}` }}>
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12, flexWrap:'wrap', gap:8 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                        {isLast && <CheckCircle size={16} style={{ color:'#10B981', flexShrink:0 }}/>}
                        <div>
                          <p style={{ fontSize:14, fontWeight:700, color:p.text1 }}>{h.filename}</p>
                          <p style={{ fontSize:12, color:p.text4 }}>
                            {d.toLocaleDateString('fr-FR', { weekday:'long', day:'2-digit', month:'long', year:'numeric' })}
                            &nbsp;à {d.toLocaleTimeString('fr-FR', { hour:'2-digit', minute:'2-digit' })}
                          </p>
                        </div>
                      </div>
                      <div style={{ textAlign:'right' }}>
                        <p style={{ fontSize:20, fontWeight:900, color:p.text1 }}>{h.total.toLocaleString('fr-FR')}</p>
                        <p style={{ fontSize:11, color:p.text4 }}>enregistrements totaux</p>
                      </div>
                    </div>
                    <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                      {TABLES.filter(t => (h.tables[t.id] || 0) > 0).map(t => (
                        <span key={t.id} style={{ fontSize:11, padding:'2px 9px', borderRadius:100, fontWeight:600,
                          background:`${t.color}15`, color:t.color, border:`1px solid ${t.color}30` }}>
                          {t.label} : {h.tables[t.id]}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {tab === 'recherche' && (
        <div className="space-y-5">

          {/* Zone d'import */}
          {!archiveData ? (
            <div className="glass-panel p-8 text-center"
              style={{ border:`2px dashed ${p.border2}`, cursor:'pointer' }}
              onClick={() => fileRef.current?.click()}
              onDragOver={e => e.preventDefault()}
              onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) importerArchive(f); }}>
              <input ref={fileRef} type="file" accept=".xlsx" style={{ display:'none' }}
                onChange={e => importerArchive(e.target.files[0])}/>
              <Upload size={36} className="text-blue-400 mx-auto mb-4"/>
              <p className="text-white font-bold text-lg mb-2">Importer une archive Excel</p>
              <p className="text-slate-400 text-sm mb-4">Glissez-déposez un fichier Archive_QHSE_*.xlsx pour y rechercher des données passées</p>
              <div style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'6px 14px', borderRadius:8, background:'rgba(59,130,246,0.1)', border:'1px solid rgba(59,130,246,0.3)', fontSize:12, color:'#60A5FA' }}>
                <FileSpreadsheet size={14}/> Sélectionner un fichier .xlsx
              </div>
              {searching && <p className="text-slate-400 text-sm mt-4 animate-pulse">Lecture du fichier...</p>}
            </div>
          ) : (
            <>
              {/* Archive chargée */}
              <div className="glass-panel p-4 flex items-center justify-between">
                <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                  <FileSpreadsheet size={20} style={{ color:'#10B981' }}/>
                  <div>
                    <p style={{ fontSize:13, fontWeight:700, color:p.text1 }}>{archiveData.filename}</p>
                    <p style={{ fontSize:11, color:p.text4 }}>
                      {Object.keys(archiveData.sheets).length} feuilles ·&nbsp;
                      {Object.values(archiveData.sheets).reduce((s, r) => s + r.length, 0).toLocaleString('fr-FR')} lignes au total
                    </p>
                  </div>
                </div>
                <button onClick={() => { setArchive(null); setResults(null); setSearch(''); }}
                  style={{ background:'none', border:'none', cursor:'pointer', color:p.text4, padding:4 }}>
                  <X size={16}/>
                </button>
              </div>

              {/* Champ de recherche */}
              <div style={{ display:'flex', gap:10 }}>
                <div style={{ flex:1, position:'relative' }}>
                  <Search size={15} style={{ position:'absolute', left:12, top:'50%', transform:'translateY(-50%)', color:p.text4 }}/>
                  <input
                    type="text" placeholder="Rechercher un nom, une date, une description, une référence..."
                    value={searchQuery}
                    onChange={e => setSearch(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && lancerRecherche()}
                    style={{ width:'100%', padding:'10px 12px 10px 36px', background:p.bgInput, border:`1px solid ${p.border}`, borderRadius:10, color:p.text1, fontSize:13, outline:'none', fontFamily:'inherit' }}
                  />
                </div>
                <button onClick={lancerRecherche} className="btn-primary" disabled={!searchQuery.trim()}>
                  <Search size={15}/> Rechercher
                </button>
                {searchResults && (
                  <button onClick={() => { setResults(null); setSearch(''); }} className="btn-secondary">
                    <X size={15}/> Effacer
                  </button>
                )}
              </div>

              {/* Résultats */}
              {searchResults !== null && (
                <div>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
                    <p style={{ fontSize:13, fontWeight:600, color:p.text2 }}>
                      {searchResults.length === 0
                        ? 'Aucun résultat trouvé'
                        : <><span style={{ color:'#3B82F6', fontWeight:800 }}>{searchResults.length}</span> résultat{searchResults.length > 1 ? 's' : ''} pour "<em>{searchQuery}</em>"</>}
                    </p>
                  </div>

                  {searchResults.length === 0 ? (
                    <div className="glass-panel p-8 text-center">
                      <Search size={32} className="text-slate-600 mx-auto mb-3"/>
                      <p className="text-slate-400 text-sm">Aucune ligne ne contient "<strong>{searchQuery}</strong>" dans cette archive.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {/* Résumé par feuille */}
                      <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:4 }}>
                        {Object.entries(
                          searchResults.reduce((acc, r) => { acc[r.sheet] = (acc[r.sheet] || 0) + 1; return acc; }, {})
                        ).map(([sheet, count]) => {
                          const t = TABLES.find(t => t.label === sheet || t.label.substring(0,31) === sheet);
                          return (
                            <span key={sheet} style={{ fontSize:11, padding:'2px 10px', borderRadius:100, fontWeight:600,
                              background:`${t?.color || '#64748B'}15`, color: t?.color || '#64748B',
                              border:`1px solid ${t?.color || '#64748B'}30` }}>
                              {sheet} : {count}
                            </span>
                          );
                        })}
                      </div>

                      {/* Lignes résultats */}
                      <div className="glass-panel" style={{ maxHeight:500, overflowY:'auto' }}>
                        <table className="table-modern">
                          <thead>
                            <tr>
                              <th style={{ width:160 }}>Module</th>
                              <th style={{ width:70 }}>Ligne</th>
                              <th>Contenu</th>
                            </tr>
                          </thead>
                          <tbody>
                            {searchResults.slice(0, 200).map((r, i) => {
                              const t = TABLES.find(t => t.label === r.sheet || t.label.substring(0,31) === r.sheet);
                              const cells = Object.entries(r.row).filter(([, v]) =>
                                String(v).toLowerCase().includes(searchQuery.toLowerCase())
                              );
                              return (
                                <tr key={i}>
                                  <td>
                                    <span style={{ fontSize:11, padding:'2px 8px', borderRadius:100, fontWeight:600,
                                      background:`${t?.color || '#64748B'}15`, color: t?.color || '#64748B',
                                      border:`1px solid ${t?.color || '#64748B'}30` }}>
                                      {r.sheet}
                                    </span>
                                  </td>
                                  <td style={{ fontSize:12, color:p.text4, textAlign:'center' }}>#{r.rowIndex}</td>
                                  <td style={{ fontSize:12 }}>
                                    {cells.slice(0, 4).map(([k, v]) => {
                                      const str   = String(v);
                                      const idx   = str.toLowerCase().indexOf(searchQuery.toLowerCase());
                                      const before = str.substring(0, idx);
                                      const match  = str.substring(idx, idx + searchQuery.length);
                                      const after  = str.substring(idx + searchQuery.length, idx + searchQuery.length + 60);
                                      return (
                                        <span key={k} style={{ marginRight:12 }}>
                                          <span style={{ fontSize:10, color:p.text4, fontWeight:600 }}>{k} : </span>
                                          <span style={{ color:p.text2 }}>{before}</span>
                                          <span style={{ background:'rgba(251,191,36,0.3)', color:'#FCD34D', fontWeight:700, borderRadius:3, padding:'0 2px' }}>{match}</span>
                                          <span style={{ color:p.text2 }}>{after}{after.length >= 60 ? '…' : ''}</span>
                                        </span>
                                      );
                                    })}
                                    {cells.length === 0 && (
                                      <span style={{ color:p.text4, fontSize:11 }}>
                                        {Object.entries(r.row).slice(0, 3).map(([k, v]) => `${k}: ${v}`).join(' · ')}
                                      </span>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                            {searchResults.length > 200 && (
                              <tr>
                                <td colSpan={3} style={{ textAlign:'center', fontSize:12, color:p.text4, padding:12 }}>
                                  ... et {searchResults.length - 200} résultats supplémentaires. Affinez votre recherche.
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Aperçu des feuilles */}
              {searchResults === null && (
                <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(180px, 1fr))', gap:8 }}>
                  {Object.entries(archiveData.sheets).map(([name, rows]) => {
                    const t = TABLES.find(t => t.label === name || t.label.substring(0,31) === name);
                    return (
                      <div key={name} className="glass-panel p-4" style={{ borderLeft:`3px solid ${t?.color || '#64748B'}` }}>
                        <p style={{ fontSize:12, fontWeight:700, color:p.text2, marginBottom:4 }}>{name}</p>
                        <p style={{ fontSize:20, fontWeight:900, color:p.text1 }}>{rows.length.toLocaleString('fr-FR')}</p>
                        <p style={{ fontSize:10, color:p.text4 }}>lignes archivées</p>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
