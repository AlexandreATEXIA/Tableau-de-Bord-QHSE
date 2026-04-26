import React, { useState, useEffect } from 'react';
import { useTheme } from './ThemeContext';
import { supabase } from './supabaseClient';
import { getLocalLogs, clearLocalLogs } from './auditLog';
import { ClipboardList, RefreshCw, Trash2, Filter, Database, HardDrive } from 'lucide-react';

const ACTION_META = {
  CREATE: { bg: 'rgba(16,185,129,0.15)',  color: '#10B981', label: 'Création' },
  UPDATE: { bg: 'rgba(59,130,246,0.15)',  color: '#3B82F6', label: 'Modification' },
  DELETE: { bg: 'rgba(239,68,68,0.15)',   color: '#EF4444', label: 'Suppression' },
};

const TABLE_LABELS = {
  securite_accidents:   'Accidents',
  plan_actions:         "Plan d'Actions",
  habilitations:        'Habilitations',
  registre_duerp:       'DUERP',
  qualite_nc:           'Non-Conformités',
  qualite_audits:       'Audits',
  qualite_satisfaction: 'Satisfaction',
  rh_employes:          'Employés',
  rh_formations:        'Formations',
  veille_reglementaire: 'Veille Réglementaire',
  reunions_qhse:        'Réunions QHSE',
  fournisseurs_eval:    'Fournisseurs',
};

export default function JournalAudit() {
  const { p } = useTheme();
  const [logs, setLogs]             = useState([]);
  const [loading, setLoading]       = useState(false);
  const [source, setSource]         = useState('local');
  const [filtreAction, setFA]       = useState('Tous');
  const [filtreTable, setFT]        = useState('Toutes');
  const [page, setPage]             = useState(0);

  const PAGE_SIZE = 50;

  useEffect(() => { charger(); }, []);

  const charger = async () => {
    setLoading(true);
    let entries = getLocalLogs();
    let src = 'local';

    try {
      const { data, error } = await supabase
        .from('audit_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500);
      if (!error && data?.length > 0) { entries = data; src = 'supabase'; }
    } catch { /* silencieux : non bloquant */ }

    setLogs(entries);
    setSource(src);
    setLoading(false);
    setPage(0);
  };

  const vider = () => {
    if (!window.confirm('Effacer tout le journal local ? Cette action est irréversible.')) return;
    clearLocalLogs();
    charger();
  };

  const tables = ['Toutes', ...new Set(logs.map(l => l.table_name).filter(Boolean)).values()];

  const filtered = logs.filter(l => {
    if (filtreAction !== 'Tous'   && l.action     !== filtreAction) return false;
    if (filtreTable  !== 'Toutes' && l.table_name !== filtreTable)  return false;
    return true;
  });

  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);

  const counts = { CREATE: 0, UPDATE: 0, DELETE: 0 };
  logs.forEach(l => { if (counts[l.action] !== undefined) counts[l.action]++; });

  return (
    <div className="space-y-5 pb-10">

      <header className="page-header">
        <div>
          <h2 className="page-title flex items-center gap-3">
            <ClipboardList size={26} className="text-blue-400"/> Journal d'audit
          </h2>
          <p className="page-subtitle">
            Traçabilité complète des modifications —&nbsp;
            {source === 'supabase'
              ? <span style={{ color: '#10B981' }}><Database size={12} style={{ display:'inline', verticalAlign:'middle', marginRight:3 }}/>Supabase</span>
              : <span style={{ color: '#F59E0B' }}><HardDrive size={12} style={{ display:'inline', verticalAlign:'middle', marginRight:3 }}/>Stockage local</span>}
          </p>
        </div>
        <div className="flex gap-3">
          {source === 'local' && logs.length > 0 && (
            <button onClick={vider} className="btn-secondary" style={{ color:'#EF4444', borderColor:'rgba(239,68,68,0.3)' }}>
              <Trash2 size={15}/> Effacer
            </button>
          )}
          <button onClick={charger} className="btn-primary">
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''}/> Actualiser
          </button>
        </div>
      </header>

      {/* Compteurs */}
      <div className="grid grid-cols-3 gap-4">
        {(['CREATE','UPDATE','DELETE']).map(a => {
          const m = ACTION_META[a];
          return (
            <div key={a} className="glass-panel p-4" style={{ borderLeft: `3px solid ${m.color}` }}>
              <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">{m.label}s</p>
              <p className="text-3xl font-black text-white">{counts[a]}</p>
            </div>
          );
        })}
      </div>

      {source === 'local' && (
        <div className="glass-panel p-4 flex items-start gap-3" style={{ borderLeft: '3px solid #F59E0B', background: 'rgba(245,158,11,0.05)' }}>
          <Database size={16} style={{ color:'#F59E0B', flexShrink:0, marginTop:1 }}/>
          <div>
            <p style={{ fontSize:13, fontWeight:600, color:'#F59E0B' }}>Table <code>audit_log</code> non trouvée dans Supabase</p>
            <p style={{ fontSize:12, color:p.text3, marginTop:3 }}>
              Les logs sont stockés localement. Pour persister en base, créez la table selon le commentaire dans <code>auditLog.js</code>.
            </p>
          </div>
        </div>
      )}

      {/* Filtres */}
      <div className="glass-panel p-4 flex flex-wrap gap-3 items-center">
        <Filter size={15} className="text-slate-400 shrink-0"/>
        <select value={filtreTable} onChange={e => { setFT(e.target.value); setPage(0); }}
          className="input-modern" style={{ width:'auto', padding:'5px 12px', fontSize:12 }}>
          {tables.map(t => <option key={t} value={t}>{TABLE_LABELS[t] || t}</option>)}
        </select>
        <div style={{ width:1, height:16, background:p.border }}/>
        {['Tous','CREATE','UPDATE','DELETE'].map(a => {
          const c = a === 'CREATE' ? '#10B981' : a === 'UPDATE' ? '#3B82F6' : a === 'DELETE' ? '#EF4444' : p.text3;
          const isActive = filtreAction === a;
          return (
            <button key={a} onClick={() => { setFA(a); setPage(0); }}
              style={{ fontSize:11, fontWeight:600, padding:'4px 12px', borderRadius:100, border:'1px solid', cursor:'pointer',
                background: isActive ? `${c === p.text3 ? '#64748B' : c}20` : p.whiteFaint2,
                borderColor: isActive ? `${c === p.text3 ? '#64748B' : c}50` : p.border,
                color: isActive ? (c === p.text3 ? '#94A3B8' : c) : p.text3 }}>
              {a === 'Tous' ? 'Toutes actions' : ACTION_META[a]?.label || a}
            </button>
          );
        })}
        <span style={{ fontSize:12, color:p.text4, marginLeft:'auto' }}>{filtered.length} entrée{filtered.length > 1 ? 's' : ''}</span>
      </div>

      {/* Table */}
      <div className="glass-panel">
        {loading ? (
          <div className="p-10 text-center">
            <RefreshCw size={28} className="animate-spin text-blue-400 mx-auto mb-3"/>
            <p className="text-slate-400">Chargement du journal...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <ClipboardList size={40} className="text-slate-600 mx-auto mb-4"/>
            <p className="text-white font-semibold mb-1">Journal vide</p>
            <p className="text-slate-500 text-sm">Les modifications apparaîtront ici après les premières sauvegardes.<br/>Importez <code>logAction</code> depuis <code>auditLog.js</code> dans vos modules.</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="table-modern">
                <thead>
                  <tr>
                    <th style={{ width:130 }}>Date / Heure</th>
                    <th>Module</th>
                    <th style={{ width:120, textAlign:'center' }}>Action</th>
                    <th style={{ width:140 }}>Utilisateur</th>
                    <th>Détails</th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.map((l, i) => {
                    const m   = ACTION_META[l.action] || ACTION_META.UPDATE;
                    const dt  = new Date(l.created_at);
                    const det = typeof l.details === 'string'
                      ? l.details
                      : Object.entries(l.details || {}).map(([k, v]) => `${k}: ${v}`).join(' · ').substring(0, 140);
                    return (
                      <tr key={l.id || i}>
                        <td style={{ whiteSpace:'nowrap' }}>
                          <div style={{ fontSize:12, fontWeight:600, color:p.text1 }}>
                            {dt.toLocaleDateString('fr-FR')}
                          </div>
                          <div style={{ fontSize:11, color:p.text4 }}>
                            {dt.toLocaleTimeString('fr-FR', { hour:'2-digit', minute:'2-digit', second:'2-digit' })}
                          </div>
                        </td>
                        <td style={{ fontSize:12, fontWeight:600, color:p.text2 }}>
                          {TABLE_LABELS[l.table_name] || l.table_name || '—'}
                        </td>
                        <td style={{ textAlign:'center' }}>
                          <span style={{ display:'inline-block', padding:'3px 10px', borderRadius:100, fontSize:11, fontWeight:700, background:m.bg, color:m.color }}>
                            {m.label}
                          </span>
                        </td>
                        <td style={{ fontSize:12, color:p.text2 }}>{l.user_name || '—'}</td>
                        <td style={{ fontSize:11, color:p.text3, maxWidth:300 }}>{det || '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:8, padding:'14px', borderTop:`1px solid ${p.border}` }}>
                <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
                  className="btn-secondary" style={{ padding:'5px 12px', fontSize:12 }}>← Préc.</button>
                <span style={{ fontSize:12, color:p.text3 }}>Page {page + 1} / {totalPages}</span>
                <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
                  className="btn-secondary" style={{ padding:'5px 12px', fontSize:12 }}>Suiv. →</button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
