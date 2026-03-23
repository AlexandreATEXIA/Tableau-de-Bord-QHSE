import { useTheme } from './ThemeContext';
import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Trash2, RefreshCw, Filter, CheckCircle, AlertTriangle, Clock, Target, Save, X } from 'lucide-react';
import { supabase } from './supabaseClient';
import GestionListes from './GestionListes';

const ORIGINES_DEFAULT  = ['Évaluation DUERP', 'Analyse AT/MP', 'Audit', 'Revue de Direction', 'Fiche NC', 'Client', 'Autre'];
const DOMAINES_DEFAULT  = ['Qualité', 'Sécurité', 'Environnement', 'Énergie', 'RH / Social', 'RSE / Transverse'];
const PRIORITES = ['🔴 1-Urgente', '🟠 2-Majeure', '🟡 3-Normale', '🟢 4-Mineure'];
const STATUTS   = ['🔴 À faire', '🟠 En cours', '🟣 En attente', '🟢 Terminé', '⚪ Annulé'];

const PRIORITE_COLOR = {
  '🔴 1-Urgente': '#EF4444',
  '🟠 2-Majeure': '#F97316',
  '🟡 3-Normale': '#F59E0B',
  '🟢 4-Mineure': '#10B981',
};

const STATUT_STYLE = {
  '🔴 À faire':    { color: '#EF4444', bg: 'rgba(239,68,68,0.12)',   border: 'rgba(239,68,68,0.3)' },
  '🟠 En cours':   { color: '#F97316', bg: 'rgba(249,115,22,0.12)',  border: 'rgba(249,115,22,0.3)' },
  '🟣 En attente': { color: '#8B5CF6', bg: 'rgba(139,92,246,0.12)',  border: 'rgba(139,92,246,0.3)' },
  '🟢 Terminé':    { color: '#10B981', bg: 'rgba(16,185,129,0.12)',  border: 'rgba(16,185,129,0.3)' },
  '⚪ Annulé':     { color: '#64748B', bg: 'rgba(100,116,139,0.12)', border: 'rgba(100,116,139,0.3)' },
};

const DOMAINE_COLOR = {
  'Qualité':         '#3B82F6',
  'Sécurité':        '#EF4444',
  'Environnement':   '#10B981',
  'Énergie':         '#F59E0B',
  'RH / Social':     '#8B5CF6',
  'RSE / Transverse':'#06B6D4',
};

function diffJours(echeance) {
  if (!echeance) return null;
  return Math.ceil((new Date(echeance) - new Date()) / 86400000);
}

function BadgeEcheance({ echeance, statut }) {
  if (!echeance || statut?.includes('Terminé') || statut?.includes('Annulé')) return null;
  const j = diffJours(echeance);
  let color, label;
  if (j < 0)        { color = '#EF4444'; label = `${Math.abs(j)}j retard`; }
  else if (j <= 7)  { color = '#F59E0B'; label = `${j}j restants`; }
  else if (j <= 30) { color = '#3B82F6'; label = `${j}j`; }
  else return <span style={{ fontSize: 10, color: '#475569' }}>{echeance}</span>;
  return (
    <span style={{ fontSize: 10, fontWeight: 700, color, background: `${color}15`, border: `1px solid ${color}40`, padding: '2px 7px', borderRadius: 100, display: 'inline-block', marginTop: 3 }}>
      {label}
    </span>
  );
}

export default function PlanActions() {
  const { p, isDark } = useTheme();
  const [actions, setActions]     = useState([]);
  const [listeOrigines, setOrigines] = useState(ORIGINES_DEFAULT);
  const [listeDomaines, setDomaines] = useState(DOMAINES_DEFAULT);
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(null);
  const [showForm, setShowForm]   = useState(false);
  const [filtreDomaine, setFD]    = useState('Tous');
  const [filtreStatut, setFS]     = useState('Tous');
  const [filtreRetard, setFR]     = useState(false);
  const [form, setForm]           = useState({
    origine: listeOrigines[0], domaine: listeDomaines[0], action: '', pilote: '',
    echeance: new Date(Date.now() + 30*86400000).toISOString().split('T')[0],
    priorite: PRIORITES[2], statut: STATUTS[0], commentaire: '',
  });

  useEffect(() => { fetchActions(); }, []);

  const fetchActions = async () => {
    setLoading(true);
    const { data } = await supabase.from('plan_actions').select('*').order('id', { ascending: true });
    if (data) setActions(data);
    setLoading(false);
  };

  const updateRow = (id, field, value) => setActions(prev => prev.map(r => r.id === id ? {...r, [field]: value} : r));

  const saveRow = async (row) => {
    if (!row) return;
    setSaving(row.id);
    await supabase.from('plan_actions').update(row).eq('id', row.id);
    setSaving(null);
  };

  const ajouterAction = async () => {
    if (!form.action.trim()) return;
    const { data } = await supabase.from('plan_actions').insert([form]).select();
    if (data) { setActions(prev => [...prev, data[0]]); setShowForm(false); }
  };

  const deleteRow = async (id) => {
    await supabase.from('plan_actions').delete().eq('id', id);
    setActions(prev => prev.filter(r => r.id !== id));
  };

  const kpis = useMemo(() => {
    const actives   = actions.filter(a => !a.statut?.includes('Annulé'));
    const terminees = actions.filter(a => a.statut?.includes('Terminé'));
    const retard    = actives.filter(a => !a.statut?.includes('Terminé') && diffJours(a.echeance) < 0);
    const urgentes  = actives.filter(a => a.priorite?.includes('1-Urgente') && !a.statut?.includes('Terminé'));
    return { total: actions.length, terminees: terminees.length, retard: retard.length, urgentes: urgentes.length, taux: actives.length > 0 ? Math.round((terminees.length / actives.length) * 100) : 0 };
  }, [actions]);

  const actionsFiltrees = useMemo(() => actions.filter(a => {
    if (filtreDomaine !== 'Tous' && a.domaine !== filtreDomaine) return false;
    if (filtreStatut  !== 'Tous' && a.statut  !== filtreStatut)  return false;
    if (filtreRetard && !(diffJours(a.echeance) < 0 && !a.statut?.includes('Terminé') && !a.statut?.includes('Annulé'))) return false;
    return true;
  }), [actions, filtreDomaine, filtreStatut, filtreRetard]);

  return (
    <div className="space-y-5 pb-10">

      <header className="page-header">
        <div>
          <h2 className="page-title flex items-center gap-3"><Target size={26} className="text-blue-400"/> Plan d'Actions PDCA</h2>
          <p className="page-subtitle">Suivi des actions correctives et préventives — sauvegarde automatique</p>
        </div>
        <div className="flex gap-3">
          <GestionListes
            listes={{ 'Origines': listeOrigines, 'Domaines': listeDomaines }}
            onSave={(key, list) => {
              if (key === 'Origines') setOrigines(list);
              if (key === 'Domaines') setDomaines(list);
            }}
            storageKey="plan_actions"
          />
          <button onClick={fetchActions} className="btn-secondary"><RefreshCw size={16} className={loading ? 'animate-spin' : ''}/> Actualiser</button>
          <button onClick={() => setShowForm(true)} className="btn-primary"><Plus size={16}/> Nouvelle action</button>
        </div>
      </header>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total actions',     val: kpis.total,     color: 'blue',  sub: 'Plan complet' },
          { label: 'Terminées',         val: kpis.terminees, color: 'green', sub: `Taux : ${kpis.taux}%` },
          { label: 'En retard',         val: kpis.retard,    color: kpis.retard > 0 ? 'red' : 'green', sub: 'Échéances dépassées' },
          { label: 'Urgentes ouvertes', val: kpis.urgentes,  color: kpis.urgentes > 0 ? 'amber' : 'green', sub: 'Priorité 1' },
        ].map((k, i) => (
          <div key={i} className={`kpi-card ${k.color}`}>
            <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">{k.label}</p>
            <p className="text-4xl font-black text-white">{k.val}</p>
            <div style={{ height: 3, background: 'rgba(255,255,255,0.06)', borderRadius: 2, margin: '10px 0 4px' }}>
              {k.label === 'Terminées' && <div style={{ height: '100%', width: `${kpis.taux}%`, background: '#10B981', borderRadius: 2 }}/>}
            </div>
            <p className="text-xs text-slate-500">{k.sub}</p>
          </div>
        ))}
      </div>

      {/* Alertes */}
      {kpis.retard > 0 && (
        <div className="alert-banner alert-red">
          <AlertTriangle size={18} className="shrink-0"/>
          <div>
            <p className="font-bold">{kpis.retard} action{kpis.retard > 1 ? 's' : ''} en retard — Traitement prioritaire requis</p>
            <button onClick={() => setFR(true)} className="text-xs underline mt-0.5 opacity-80">Voir uniquement les actions en retard</button>
          </div>
        </div>
      )}
      {kpis.urgentes > 0 && (
        <div className="alert-banner alert-amber">
          <Clock size={18} className="shrink-0"/>
          <p className="font-bold">{kpis.urgentes} action{kpis.urgentes > 1 ? 's' : ''} urgente{kpis.urgentes > 1 ? 's' : ''} en cours</p>
        </div>
      )}

      {/* Formulaire */}
      {showForm && (
        <div className="glass-panel p-6 border border-blue-500/20 animate-fade-up">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-white font-bold text-lg">Nouvelle action</h3>
            <button onClick={() => setShowForm(false)} className="text-slate-500 hover:text-white p-1"><X size={18}/></button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-3">
              <label className="text-slate-400 text-xs font-bold uppercase tracking-wider block mb-1">Description *</label>
              <input type="text" value={form.action} onChange={e => setForm({...form, action: e.target.value})} placeholder="Décrivez précisément l'action..." className="input-modern text-base"/>
            </div>
            {[
              { label: 'Origine',  key: 'origine',  type: 'select', options: listeOrigines },
              { label: 'Domaine',  key: 'domaine',  type: 'select', options: listeDomaines },
              { label: 'Pilote',   key: 'pilote',   type: 'text',   placeholder: 'Responsable...' },
              { label: 'Échéance', key: 'echeance', type: 'date' },
              { label: 'Priorité', key: 'priorite', type: 'select', options: PRIORITES },
              { label: 'Statut',   key: 'statut',   type: 'select', options: STATUTS },
            ].map(f => (
              <div key={f.key}>
                <label className="text-slate-400 text-xs font-bold uppercase tracking-wider block mb-1">{f.label}</label>
                {f.type === 'select'
                  ? <select value={form[f.key]} onChange={e => setForm({...form, [f.key]: e.target.value})} className="input-modern">{f.options.map(o => <option key={o}>{o}</option>)}</select>
                  : <input type={f.type} value={form[f.key]} onChange={e => setForm({...form, [f.key]: e.target.value})} placeholder={f.placeholder} className="input-modern"/>}
              </div>
            ))}
            <div className="md:col-span-3">
              <label className="text-slate-400 text-xs font-bold uppercase tracking-wider block mb-1">Commentaire</label>
              <input type="text" value={form.commentaire || ''} onChange={e => setForm({...form, commentaire: e.target.value})} placeholder="Informations complémentaires..." className="input-modern"/>
            </div>
          </div>
          <div className="flex gap-3 mt-5">
            <button onClick={() => setShowForm(false)} className="btn-secondary">Annuler</button>
            <button onClick={ajouterAction} disabled={!form.action.trim()} className="btn-primary"><Save size={16}/> Ajouter</button>
          </div>
        </div>
      )}

      {/* Filtres */}
      <div className="glass-panel p-4 flex flex-wrap gap-3 items-center">
        <Filter size={15} className="text-slate-400 shrink-0"/>
        {['Tous', ...listeDomaines].map(d => (
          <button key={d} onClick={() => setFD(d)} style={{ fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 100, border: '1px solid', cursor: 'pointer', transition: 'all 0.12s',
            background: filtreDomaine === d ? `${DOMAINE_COLOR[d] || '#3B82F6'}25` : 'rgba(255,255,255,0.04)',
            borderColor: filtreDomaine === d ? `${DOMAINE_COLOR[d] || '#3B82F6'}50` : 'rgba(255,255,255,0.08)',
            color: filtreDomaine === d ? (DOMAINE_COLOR[d] || '#60A5FA') : '#64748B' }}>{d}</button>
        ))}
        <div className="w-px h-4 bg-white/10"/>
        {['Tous', ...STATUTS].map(s => {
          const st = STATUT_STYLE[s];
          return <button key={s} onClick={() => setFS(s)} style={{ fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 100, border: '1px solid', cursor: 'pointer', transition: 'all 0.12s',
            background: filtreStatut === s ? (st?.bg || 'rgba(59,130,246,0.15)') : 'rgba(255,255,255,0.04)',
            borderColor: filtreStatut === s ? (st?.border || 'rgba(59,130,246,0.3)') : 'rgba(255,255,255,0.08)',
            color: filtreStatut === s ? (st?.color || '#60A5FA') : '#64748B' }}>{s === 'Tous' ? 'Tous statuts' : s}</button>;
        })}
        <button onClick={() => setFR(!filtreRetard)} style={{ fontSize: 11, fontWeight: 700, padding: '4px 12px', borderRadius: 100, border: '1px solid', cursor: 'pointer',
          background: filtreRetard ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.04)',
          borderColor: filtreRetard ? 'rgba(239,68,68,0.4)' : 'rgba(255,255,255,0.08)',
          color: filtreRetard ? '#FCA5A5' : '#64748B' }}>⏰ En retard</button>
        {(filtreDomaine !== 'Tous' || filtreStatut !== 'Tous' || filtreRetard) && (
          <button onClick={() => { setFD('Tous'); setFS('Tous'); setFR(false); }} className="text-slate-500 hover:text-white text-xs flex items-center gap-1 ml-auto"><X size={12}/> Reset</button>
        )}
        <span className="text-slate-500 text-xs ml-auto">{actionsFiltrees.length} action{actionsFiltrees.length > 1 ? 's' : ''}</span>
      </div>

      {/* Tableau */}
      <div className="glass-panel">
        {loading ? (
          <div className="p-10 text-center"><RefreshCw size={28} className="animate-spin text-blue-400 mx-auto mb-3"/><p className="text-slate-400">Chargement...</p></div>
        ) : actionsFiltrees.length === 0 ? (
          <div className="p-10 text-center"><CheckCircle size={36} className="text-emerald-400 mx-auto mb-3"/><p className="text-white font-bold">{actions.length === 0 ? 'Aucune action. Cliquez sur "Nouvelle action".' : 'Aucune action pour ces filtres.'}</p></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table-modern">
              <thead><tr><th style={{width:130}}>Domaine</th><th>Description</th><th style={{width:130}}>Pilote</th><th style={{width:145}}>Échéance</th><th style={{width:120}}>Priorité</th><th style={{width:140}}>Statut</th><th style={{width:50}}></th></tr></thead>
              <tbody>
                {actionsFiltrees.map(row => {
                  const st     = STATUT_STYLE[row.statut]   || STATUT_STYLE['🔴 À faire'];
                  const pColor = PRIORITE_COLOR[row.priorite] || '#64748B';
                  const dColor = DOMAINE_COLOR[row.domaine]   || '#3B82F6';
                  const j      = diffJours(row.echeance);
                  const isRet  = j !== null && j < 0 && !row.statut?.includes('Terminé') && !row.statut?.includes('Annulé');

                  return (
                    <tr key={row.id} style={isRet ? { borderLeft: '3px solid #EF4444' } : {}}>
                      <td>
                        <select value={row.domaine || listeDomaines[0]} onChange={e => updateRow(row.id, 'domaine', e.target.value)} onBlur={() => saveRow(actions.find(a => a.id === row.id))}
                          style={{ background: `${dColor}15`, color: dColor, border: `1px solid ${dColor}40`, borderRadius: 8, padding: '5px 8px', fontSize: 12, fontWeight: 600, outline: 'none', cursor: 'pointer', width: '100%' }}>
                          {listeDomaines.map(d => <option key={d} value={d} >{d}</option>)}
                        </select>
                      </td>
                      <td>
                        <input type="text" value={row.action || ''} onChange={e => updateRow(row.id, 'action', e.target.value)} onBlur={() => saveRow(actions.find(a => a.id === row.id))} className="input-modern" style={{ padding: '6px 10px', fontSize: 13 }}/>
                        {row.commentaire && <p className="text-slate-500 text-xs mt-1 truncate italic">{row.commentaire}</p>}
                      </td>
                      <td>
                        <input type="text" value={row.pilote || ''} onChange={e => updateRow(row.id, 'pilote', e.target.value)} onBlur={() => saveRow(actions.find(a => a.id === row.id))} placeholder="Pilote..." className="input-modern" style={{ padding: '6px 10px', fontSize: 13 }}/>
                      </td>
                      <td>
                        <input type="date" value={row.echeance || ''} onChange={e => updateRow(row.id, 'echeance', e.target.value)} onBlur={() => saveRow(actions.find(a => a.id === row.id))} className="input-modern" style={{ padding: '5px 8px', fontSize: 12 }}/>
                        <BadgeEcheance echeance={row.echeance} statut={row.statut}/>
                      </td>
                      <td>
                        <select value={row.priorite || PRIORITES[2]} onChange={e => { updateRow(row.id, 'priorite', e.target.value); setTimeout(() => saveRow({...row, priorite: e.target.value}), 0); }}
                          style={{ background: `${pColor}15`, color: pColor, border: `1px solid ${pColor}40`, borderRadius: 8, padding: '5px 8px', fontSize: 12, fontWeight: 700, outline: 'none', cursor: 'pointer', width: '100%' }}>
                          {PRIORITES.map(p => <option key={p} value={p}>{p}</option>)}
                        </select>
                      </td>
                      <td>
                        <select value={row.statut || STATUTS[0]} onChange={e => { updateRow(row.id, 'statut', e.target.value); setTimeout(() => saveRow({...row, statut: e.target.value}), 0); }}
                          style={{ background: st.bg, color: st.color, border: `1px solid ${st.border}`, borderRadius: 8, padding: '5px 8px', fontSize: 12, fontWeight: 600, outline: 'none', cursor: 'pointer', width: '100%' }}>
                          {STATUTS.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </td>
                      <td className="text-center">
                        {saving === row.id
                          ? <RefreshCw size={13} className="animate-spin text-blue-400 mx-auto"/>
                          : <button onClick={() => deleteRow(row.id)} className="text-slate-600 hover:text-red-400 transition-colors p-1.5 rounded"><Trash2 size={14}/></button>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
