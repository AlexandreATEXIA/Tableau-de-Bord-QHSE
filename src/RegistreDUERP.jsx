import { useTheme } from './ThemeContext';
import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Trash2, AlertOctagon, RefreshCw, Shield, Filter, X, Save, Grid } from 'lucide-react';
import { supabase } from './supabaseClient';
import GestionListes from './GestionListes';

const LISTE_UT_DEFAULT = [
  'Atelier Production', 'Magasin / Logistique', 'Bureaux Administratifs',
  'Maintenance', 'Chantier / Déplacement', 'Accueil / Réception', 'Direction'
];

const FAMILLES_DANGERS_DEFAULT = [
  'Chutes de plain-pied', 'Chutes de hauteur', 'Manutention manuelle',
  'Machines / Équipements', 'Électricité', 'Produits chimiques',
  'Bruit / Vibrations', 'Incendie / Explosion', 'Circulation',
  'Travail sur écran', 'Stress / RPS', 'Ambiances thermiques', 'Autre'
];

function getCriticiteInfo(score) {
  if (score >= 9)  return { label: 'Critique',    color: '#EF4444', bg: 'rgba(239,68,68,0.15)',   border: 'rgba(239,68,68,0.4)' };
  if (score >= 4)  return { label: 'Modéré',      color: '#F59E0B', bg: 'rgba(245,158,11,0.15)',  border: 'rgba(245,158,11,0.4)' };
  return           { label: 'Acceptable',          color: '#10B981', bg: 'rgba(16,185,129,0.15)',  border: 'rgba(16,185,129,0.4)' };
}

// Matrice 4×4
const MATRICE_COLORS = {
  1:  '#10B981', 2:  '#10B981', 3:  '#10B981', 4:  '#F59E0B',
  6:  '#F59E0B', 8:  '#F59E0B', 9:  '#EF4444', 12: '#EF4444',
  16: '#EF4444',
};
function getMatriceColor(g, p) {
  const c = g * p;
  if (c >= 9)  return '#EF4444';
  if (c >= 4)  return '#F59E0B';
  return '#10B981';
}

export default function RegistreDUERP() {
  const { p, isDark } = useTheme();
  const [risques, setRisques]     = useState([]);
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(null);
  const [showForm, setShowForm]   = useState(false);
  const [showMatrice, setShowMatrice] = useState(false);
  const [filtreUT, setFiltreUT]   = useState('Tous');
  const [filtreNiveau, setFiltreNiveau] = useState('Tous');
  const [listeUT, setListeUT] = useState(LISTE_UT_DEFAULT);
  const [listeDangers, setListeDangers] = useState(FAMILLES_DANGERS_DEFAULT);
  const [form, setForm]           = useState({
    date_maj: new Date().toISOString().split('T')[0],
    unite_travail: listeUT[0], danger: '', risque: '',
    gravite: 2, probabilite: 2, criticite: 4,
    action_preventive: '', pilote: '', echeance: '',
  });

  useEffect(() => { fetchRisques(); }, []);

  const fetchRisques = async () => {
    setLoading(true);
    const { data } = await supabase.from('registre_duerp').select('*').order('criticite', { ascending: false });
    if (data) setRisques(data);
    setLoading(false);
  };

  const updateRow = (id, field, value) => {
    setRisques(prev => prev.map(row => {
      if (row.id !== id) return row;
      const updated = { ...row, [field]: value };
      if (field === 'gravite' || field === 'probabilite') {
        updated.criticite = Number(updated.gravite) * Number(updated.probabilite);
      }
      return updated;
    }));
  };

  const saveRow = async (row) => {
    if (!row) return;
    setSaving(row.id);
    await supabase.from('registre_duerp').update(row).eq('id', row.id);
    setSaving(null);
  };

  const ajouterRisque = async () => {
    if (!form.danger.trim()) return;
    const newRow = { ...form, criticite: Number(form.gravite) * Number(form.probabilite) };
    const { data } = await supabase.from('registre_duerp').insert([newRow]).select();
    if (data) {
      setRisques(prev => [...prev, data[0]].sort((a, b) => b.criticite - a.criticite));
      setShowForm(false);
      setForm({ date_maj: new Date().toISOString().split('T')[0], unite_travail: listeUT[0], danger: '', risque: '', gravite: 2, probabilite: 2, criticite: 4, action_preventive: '', pilote: '', echeance: '' });
    }
  };

  const deleteRow = async (id) => {
    await supabase.from('registre_duerp').delete().eq('id', id);
    setRisques(prev => prev.filter(r => r.id !== id));
  };

  // ── KPIs ──────────────────────────────────────────────────────────────────
  const kpis = useMemo(() => ({
    total:      risques.length,
    critiques:  risques.filter(r => (r.criticite || 1) >= 9).length,
    moderes:    risques.filter(r => (r.criticite || 1) >= 4 && (r.criticite || 1) < 9).length,
    acceptables:risques.filter(r => (r.criticite || 1) < 4).length,
    sansAction: risques.filter(r => (r.criticite || 1) >= 4 && !r.action_preventive).length,
  }), [risques]);

  // ── Filtres ───────────────────────────────────────────────────────────────
  const risquesFiltres = useMemo(() => risques.filter(r => {
    if (filtreUT !== 'Tous' && r.unite_travail !== filtreUT) return false;
    if (filtreNiveau === 'Critique'   && (r.criticite || 1) < 9)  return false;
    if (filtreNiveau === 'Modéré'     && ((r.criticite || 1) < 4 || (r.criticite || 1) >= 9)) return false;
    if (filtreNiveau === 'Acceptable' && (r.criticite || 1) >= 4) return false;
    return true;
  }), [risques, filtreUT, filtreNiveau]);

  // ── Matrice visuelle ──────────────────────────────────────────────────────
  const MatriceRisques = () => {
    const gravites = [4, 3, 2, 1];
    const probas   = [1, 2, 3, 4];
    return (
      <div className="glass-panel p-5 animate-fade-up">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-white font-bold flex items-center gap-2"><Grid size={18} className="text-purple-400"/> Matrice de criticité</h3>
          <button onClick={() => setShowMatrice(false)} className="text-slate-500 hover:text-white p-1"><X size={16}/></button>
        </div>
        <div className="flex gap-6 items-start">
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: '40px repeat(4, 52px)', gap: 4 }}>
              <div/>
              {probas.map(p => <div key={p} style={{ textAlign: 'center', fontSize: 11, color: '#64748B', fontWeight: 700, padding: '4px 0' }}>P={p}</div>)}
              {gravites.map(g => (
                <React.Fragment key={g}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: '#64748B', fontWeight: 700 }}>G={g}</div>
                  {probas.map(p => {
                    const c = g * p;
                    const color = getMatriceColor(g, p);
                    const count = risques.filter(r => Number(r.gravite) === g && Number(r.probabilite) === p).length;
                    return (
                      <div key={p} style={{ width: 52, height: 52, background: `${color}20`, border: `1px solid ${color}40`, borderRadius: 8, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700 }}>
                        <span style={{ color, fontSize: 16 }}>{c}</span>
                        {count > 0 && <span style={{ background: color, color: 'white', borderRadius: 100, padding: '0 5px', fontSize: 9, marginTop: 2 }}>{count}</span>}
                      </div>
                    );
                  })}
                </React.Fragment>
              ))}
            </div>
            <div style={{ marginTop: 12, display: 'flex', gap: 12 }}>
              {[{ color: '#10B981', label: '< 4 Acceptable' }, { color: '#F59E0B', label: '4-8 Modéré' }, { color: '#EF4444', label: '≥ 9 Critique' }].map(l => (
                <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11 }}>
                  <div style={{ width: 10, height: 10, background: l.color, borderRadius: 2 }}/>
                  <span style={{ color: '#64748B' }}>{l.label}</span>
                </div>
              ))}
            </div>
          </div>
          <div style={{ flex: 1 }}>
            <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-3">Risques critiques à traiter</p>
            <div className="space-y-2">
              {risques.filter(r => (r.criticite || 1) >= 9).length === 0
                ? <p className="text-emerald-400 text-sm">✓ Aucun risque critique !</p>
                : risques.filter(r => (r.criticite || 1) >= 9).map(r => (
                  <div key={r.id} style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: '8px 12px' }}>
                    <p className="text-white text-sm font-semibold">{r.danger}</p>
                    <p className="text-slate-400 text-xs">{r.unite_travail} · Criticité {r.criticite}</p>
                  </div>
                ))
              }
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-5 pb-10">

      {/* ── En-tête ──────────────────────────────────────────────────────── */}
      <header className="page-header">
        <div>
          <h2 className="page-title flex items-center gap-3">
            <Shield size={26} className="text-amber-400"/> Registre DUERP
          </h2>
          <p className="page-subtitle">Évaluation et maîtrise des risques professionnels</p>
        </div>
        <div className="flex gap-3">
          <GestionListes
            listes={{ 'Unités de travail': listeUT, 'Familles de dangers': listeDangers }}
            onSave={(key, list) => {
              if (key === 'Unités de travail') setListeUT(list);
              if (key === 'Familles de dangers') setListeDangers(list);
            }}
            storageKey="duerp"
          />
          <button onClick={() => setShowMatrice(!showMatrice)} className="btn-secondary">
            <Grid size={16}/> Matrice
          </button>
          <button onClick={fetchRisques} className="btn-secondary">
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''}/> Actualiser
          </button>
          <button onClick={() => setShowForm(true)} className="btn-primary" style={{ background: '#F59E0B', boxShadow: '0 0 20px rgba(245,158,11,0.3)' }}>
            <Plus size={16}/> Identifier un risque
          </button>
        </div>
      </header>

      {/* ── KPIs ─────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: 'Total risques',      val: kpis.total,       color: 'blue',  sub: 'Évalués' },
          { label: 'Critiques (≥9)',     val: kpis.critiques,   color: kpis.critiques > 0 ? 'red' : 'green',   sub: 'Action prioritaire' },
          { label: 'Modérés (4-8)',      val: kpis.moderes,     color: 'amber', sub: 'À surveiller' },
          { label: 'Acceptables (<4)',   val: kpis.acceptables, color: 'green', sub: 'Maîtrisés' },
          { label: 'Sans action',        val: kpis.sansAction,  color: kpis.sansAction > 0 ? 'amber' : 'green', sub: 'Risques ≥4 sans mesure' },
        ].map((k, i) => (
          <div key={i} className={`kpi-card ${k.color}`}>
            <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">{k.label}</p>
            <p className="text-3xl font-black text-white">{k.val}</p>
            <p className="text-xs text-slate-500 mt-2">{k.sub}</p>
          </div>
        ))}
      </div>

      {/* ── Alertes ──────────────────────────────────────────────────────── */}
      {kpis.critiques > 0 && (
        <div className="alert-banner alert-red">
          <AlertOctagon size={18} className="shrink-0"/>
          <div>
            <p className="font-bold">{kpis.critiques} risque{kpis.critiques > 1 ? 's' : ''} critique{kpis.critiques > 1 ? 's' : ''} — Criticité ≥ 9 — Action immédiate requise</p>
            <p className="text-xs mt-0.5 opacity-80">{risques.filter(r => (r.criticite||1) >= 9).map(r => r.danger?.substring(0, 40)).join(' · ')}</p>
          </div>
        </div>
      )}
      {kpis.sansAction > 0 && (
        <div className="alert-banner alert-amber">
          <AlertOctagon size={18} className="shrink-0"/>
          <p className="font-bold">{kpis.sansAction} risque{kpis.sansAction > 1 ? 's' : ''} modéré{kpis.sansAction > 1 ? 's' : ''} ou critique{kpis.sansAction > 1 ? 's' : ''} sans action préventive définie</p>
        </div>
      )}

      {/* ── Matrice ──────────────────────────────────────────────────────── */}
      {showMatrice && <MatriceRisques />}

      {/* ── Formulaire ───────────────────────────────────────────────────── */}
      {showForm && (
        <div className="glass-panel p-6 border border-amber-500/20 animate-fade-up">
          <div className="flex justify-between items-center mb-5">
            <h3 className="text-white font-bold text-lg flex items-center gap-2"><Plus size={18} className="text-amber-400"/> Nouveau risque</h3>
            <button onClick={() => setShowForm(false)} className="text-slate-500 hover:text-white p-1"><X size={18}/></button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-slate-400 text-xs font-bold uppercase tracking-wider block mb-1">Unité de travail</label>
              <select value={form.unite_travail} onChange={e => setForm({...form, unite_travail: e.target.value})} className="input-modern">
                {listeUT.map(ut => <option key={ut} value={ut}>{ut}</option>)}
              </select>
            </div>
            <div>
              <label className="text-slate-400 text-xs font-bold uppercase tracking-wider block mb-1">Famille de danger</label>
              <select value={form.danger} onChange={e => setForm({...form, danger: e.target.value})} className="input-modern">
                <option value="">Sélectionner ou saisir...</option>
                {listeDangers.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div>
              <label className="text-slate-400 text-xs font-bold uppercase tracking-wider block mb-1">Danger précis *</label>
              <input type="text" value={form.danger} onChange={e => setForm({...form, danger: e.target.value})} placeholder="Ex: Chute sur sol mouillé..." className="input-modern"/>
            </div>
            <div className="md:col-span-3">
              <label className="text-slate-400 text-xs font-bold uppercase tracking-wider block mb-1">Risque encouru</label>
              <input type="text" value={form.risque} onChange={e => setForm({...form, risque: e.target.value})} placeholder="Ex: Fracture, entorse..." className="input-modern"/>
            </div>
            {/* Curseurs G × P */}
            {[
              { label: 'Gravité (1=légère, 4=fatale)', key: 'gravite' },
              { label: 'Probabilité (1=rare, 4=certain)', key: 'probabilite' },
            ].map(f => (
              <div key={f.key}>
                <label className="text-slate-400 text-xs font-bold uppercase tracking-wider block mb-2">{f.label}</label>
                <div className="flex items-center gap-3">
                  {[1,2,3,4].map(v => {
                    const sel = Number(form[f.key]) === v;
                    const color = v >= 3 ? '#EF4444' : v >= 2 ? '#F59E0B' : '#10B981';
                    return (
                      <button key={v} onClick={() => setForm({...form, [f.key]: v, criticite: f.key === 'gravite' ? v * form.probabilite : form.gravite * v})}
                        style={{ width: 44, height: 44, borderRadius: 10, border: `2px solid ${sel ? color : 'rgba(255,255,255,0.1)'}`, background: sel ? `${color}25` : 'rgba(255,255,255,0.04)', color: sel ? color : '#64748B', fontWeight: 800, fontSize: 18, cursor: 'pointer', transition: 'all 0.15s' }}>
                        {v}
                      </button>
                    );
                  })}
                  <div style={{ ...getCriticiteInfo(Number(form.gravite) * Number(form.probabilite)), padding: '4px 12px', borderRadius: 8, fontSize: 12, fontWeight: 700, border: '1px solid', marginLeft: 8 }}>
                    Criticité : {Number(form.gravite) * Number(form.probabilite)}
                  </div>
                </div>
              </div>
            ))}
            <div className="md:col-span-3">
              <label className="text-slate-400 text-xs font-bold uppercase tracking-wider block mb-1">Action préventive</label>
              <input type="text" value={form.action_preventive} onChange={e => setForm({...form, action_preventive: e.target.value})} placeholder="Mesure de prévention ou protection..." className="input-modern"/>
            </div>
            <div>
              <label className="text-slate-400 text-xs font-bold uppercase tracking-wider block mb-1">Pilote</label>
              <input type="text" value={form.pilote || ''} onChange={e => setForm({...form, pilote: e.target.value})} placeholder="Responsable..." className="input-modern"/>
            </div>
            <div>
              <label className="text-slate-400 text-xs font-bold uppercase tracking-wider block mb-1">Échéance</label>
              <input type="date" value={form.echeance || ''} onChange={e => setForm({...form, echeance: e.target.value})} className="input-modern"/>
            </div>
            <div>
              <label className="text-slate-400 text-xs font-bold uppercase tracking-wider block mb-1">Date M.A.J</label>
              <input type="date" value={form.date_maj} onChange={e => setForm({...form, date_maj: e.target.value})} className="input-modern"/>
            </div>
          </div>
          <div className="flex gap-3 mt-5">
            <button onClick={() => setShowForm(false)} className="btn-secondary">Annuler</button>
            <button onClick={ajouterRisque} disabled={!form.danger.trim()} className="btn-primary" style={{ background: '#F59E0B', boxShadow: '0 0 16px rgba(245,158,11,0.3)' }}>
              <Save size={16}/> Enregistrer le risque
            </button>
          </div>
        </div>
      )}

      {/* ── Filtres ───────────────────────────────────────────────────────── */}
      <div className="glass-panel p-4 flex flex-wrap gap-3 items-center">
        <Filter size={15} className="text-slate-400 shrink-0"/>
        <div className="flex gap-2 flex-wrap">
          {['Tous', ...listeUT].map(ut => (
            <button key={ut} onClick={() => setFiltreUT(ut)} style={{ fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 100, border: '1px solid', cursor: 'pointer', transition: 'all 0.12s',
              background: filtreUT === ut ? 'rgba(245,158,11,0.2)' : 'rgba(255,255,255,0.04)',
              borderColor: filtreUT === ut ? 'rgba(245,158,11,0.4)' : 'rgba(255,255,255,0.08)',
              color: filtreUT === ut ? '#FCD34D' : '#64748B' }}>{ut}</button>
          ))}
        </div>
        <div className="w-px h-4 bg-white/10"/>
        {['Tous', 'Critique', 'Modéré', 'Acceptable'].map(n => {
          const color = n === 'Critique' ? '#EF4444' : n === 'Modéré' ? '#F59E0B' : n === 'Acceptable' ? '#10B981' : '#3B82F6';
          return (
            <button key={n} onClick={() => setFiltreNiveau(n)} style={{ fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 100, border: '1px solid', cursor: 'pointer', transition: 'all 0.12s',
              background: filtreNiveau === n ? `${color}20` : 'rgba(255,255,255,0.04)',
              borderColor: filtreNiveau === n ? `${color}50` : 'rgba(255,255,255,0.08)',
              color: filtreNiveau === n ? color : '#64748B' }}>{n}</button>
          );
        })}
        {(filtreUT !== 'Tous' || filtreNiveau !== 'Tous') && (
          <button onClick={() => { setFiltreUT('Tous'); setFiltreNiveau('Tous'); }} className="text-slate-500 hover:text-white text-xs flex items-center gap-1 ml-auto"><X size={12}/> Reset</button>
        )}
        <span className="text-slate-500 text-xs ml-auto">{risquesFiltres.length} risque{risquesFiltres.length > 1 ? 's' : ''}</span>
      </div>

      {/* ── Tableau ───────────────────────────────────────────────────────── */}
      <div className="glass-panel">
        {loading ? (
          <div className="p-10 text-center"><RefreshCw size={28} className="animate-spin text-blue-400 mx-auto mb-3"/><p className="text-slate-400">Chargement...</p></div>
        ) : risquesFiltres.length === 0 ? (
          <div className="p-10 text-center">
            <Shield size={36} className="text-emerald-400 mx-auto mb-3"/>
            <p className="text-white font-bold">{risques.length === 0 ? 'Aucun risque identifié.' : 'Aucun risque pour ces filtres.'}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table-modern">
              <thead>
                <tr>
                  <th style={{ width: 140 }}>Unité de travail</th>
                  <th>Danger</th>
                  <th>Risque</th>
                  <th style={{ width: 60, textAlign: 'center' }}>G</th>
                  <th style={{ width: 60, textAlign: 'center' }}>P</th>
                  <th style={{ width: 90, textAlign: 'center' }}>Criticité</th>
                  <th>Action préventive</th>
                  <th style={{ width: 110 }}>Pilote</th>
                  <th style={{ width: 50 }}></th>
                </tr>
              </thead>
              <tbody>
                {risquesFiltres.map(row => {
                  const cInfo = getCriticiteInfo(row.criticite || 1);
                  return (
                    <tr key={row.id} style={row.criticite >= 9 ? { borderLeft: '3px solid #EF4444' } : row.criticite >= 4 ? { borderLeft: '3px solid #F59E0B' } : {}}>
                      <td>
                        <select value={row.unite_travail || listeUT[0]} onChange={e => updateRow(row.id, 'unite_travail', e.target.value)} onBlur={() => saveRow(risques.find(r => r.id === row.id))} className="input-modern" style={{ padding: '5px 8px', fontSize: 12 }}>
                          {listeUT.map(ut => <option key={ut} value={ut}>{ut}</option>)}
                        </select>
                      </td>
                      <td>
                        <input type="text" value={row.danger || ''} onChange={e => updateRow(row.id, 'danger', e.target.value)} onBlur={() => saveRow(risques.find(r => r.id === row.id))} className="input-modern" style={{ padding: '5px 8px', fontSize: 13 }}/>
                      </td>
                      <td>
                        <input type="text" value={row.risque || ''} onChange={e => updateRow(row.id, 'risque', e.target.value)} onBlur={() => saveRow(risques.find(r => r.id === row.id))} className="input-modern" style={{ padding: '5px 8px', fontSize: 13 }}/>
                      </td>
                      {/* Gravité */}
                      <td className="text-center">
                        <select value={row.gravite || 1} onChange={e => { updateRow(row.id, 'gravite', Number(e.target.value)); setTimeout(() => saveRow({...row, gravite: Number(e.target.value), criticite: Number(e.target.value) * Number(row.probabilite)}), 0); }}
                          style={{ background: 'rgba(255,255,255,0.05)', color: Number(row.gravite) >= 3 ? '#EF4444' : '#F59E0B', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '5px 4px', fontSize: 14, fontWeight: 800, textAlign: 'center', outline: 'none', cursor: 'pointer', width: '100%' }}>
                          {[1,2,3,4].map(v => <option key={v} value={v} >{v}</option>)}
                        </select>
                      </td>
                      {/* Probabilité */}
                      <td className="text-center">
                        <select value={row.probabilite || 1} onChange={e => { updateRow(row.id, 'probabilite', Number(e.target.value)); setTimeout(() => saveRow({...row, probabilite: Number(e.target.value), criticite: Number(row.gravite) * Number(e.target.value)}), 0); }}
                          style={{ background: 'rgba(255,255,255,0.05)', color: Number(row.probabilite) >= 3 ? '#EF4444' : '#F59E0B', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '5px 4px', fontSize: 14, fontWeight: 800, textAlign: 'center', outline: 'none', cursor: 'pointer', width: '100%' }}>
                          {[1,2,3,4].map(v => <option key={v} value={v} >{v}</option>)}
                        </select>
                      </td>
                      {/* Criticité */}
                      <td className="text-center">
                        <div style={{ background: cInfo.bg, border: `1px solid ${cInfo.border}`, borderRadius: 8, padding: '6px 4px', fontWeight: 900, fontSize: 18, color: cInfo.color, textAlign: 'center' }}>
                          {row.criticite || 1}
                        </div>
                        <div style={{ fontSize: 9, color: cInfo.color, fontWeight: 700, marginTop: 2, textAlign: 'center' }}>{cInfo.label}</div>
                      </td>
                      {/* Action */}
                      <td>
                        <input type="text" value={row.action_preventive || ''} onChange={e => updateRow(row.id, 'action_preventive', e.target.value)} onBlur={() => saveRow(risques.find(r => r.id === row.id))} placeholder="Mesure préventive..." className="input-modern" style={{ padding: '5px 8px', fontSize: 12 }}/>
                      </td>
                      {/* Pilote */}
                      <td>
                        <input type="text" value={row.pilote || ''} onChange={e => updateRow(row.id, 'pilote', e.target.value)} onBlur={() => saveRow(risques.find(r => r.id === row.id))} placeholder="Pilote..." className="input-modern" style={{ padding: '5px 8px', fontSize: 12 }}/>
                      </td>
                      <td className="text-center">
                        {saving === row.id
                          ? <RefreshCw size={13} className="animate-spin text-blue-400 mx-auto"/>
                          : <button onClick={() => deleteRow(row.id)} className="text-slate-600 hover:text-red-400 p-1.5 rounded"><Trash2 size={14}/></button>
                        }
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
