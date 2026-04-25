import { useTheme } from './ThemeContext';
import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Trash2, Droplets, Zap, Recycle, Wind, Leaf, RefreshCw, Save, TrendingDown, TrendingUp } from 'lucide-react';
import { supabase } from './supabaseClient';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell, Legend } from 'recharts';
import GestionListes from './GestionListes';
import { useListe } from './utils/useListe';
import { WriteOnly } from './WriteGuard';

// Identifiants de persistance des listes éditables — alignés sur la convention
// utilisée par GestionListes (clé localStorage `gl_${STORAGE_KEY}`). L'export
// permet à ImportExcel de fusionner automatiquement les nouvelles valeurs
// rencontrées dans un fichier .xlsx sans casser le référentiel existant.
export const LISTES_ENVIRONNEMENT = {
  STORAGE_KEY: 'environnement',
  FLUX: 'Types de flux',
  UNITES: 'Unités',
};

const FLUX_DEFAULT = [
  'Électricité', 'Gaz naturel', 'Carburant (véhicules)',
  'Eau potable', 'Eau process',
  'DIB (Déchets Industriels Banaux)', 'Déchets Dangereux (DID)',
  'Carton / Papier', 'Plastique', 'Métal / Ferraille',
  'Déchets verts', 'DEEE', 'Autre'
];

const UNITES_DEFAULT = ['kWh', 'MWh', 'm³', 'Litres', 'Tonnes', 'kg', 'tCO2e'];

const CATEGORIES = {
  'Électricité':             { cat: 'energie',  color: '#F59E0B', icon: '⚡', co2: 0.0571 },
  'Gaz naturel':             { cat: 'energie',  color: '#F97316', icon: '🔥', co2: 0.2010 },
  'Carburant (véhicules)':   { cat: 'energie',  color: '#EF4444', icon: '⛽', co2: 2.6900 },
  'Eau potable':             { cat: 'eau',      color: '#3B82F6', icon: '💧', co2: 0 },
  'Eau process':             { cat: 'eau',      color: '#06B6D4', icon: '🌊', co2: 0 },
  'DIB (Déchets Industriels Banaux)': { cat: 'dechets', color: '#8B5CF6', icon: '🗑️', co2: 0 },
  'Déchets Dangereux (DID)': { cat: 'dechets',  color: '#EF4444', icon: '☣️', co2: 0 },
  'Carton / Papier':         { cat: 'dechets',  color: '#10B981', icon: '📦', co2: 0 },
  'Plastique':               { cat: 'dechets',  color: '#06B6D4', icon: '♻️', co2: 0 },
  'Métal / Ferraille':       { cat: 'dechets',  color: '#94A3B8', icon: '🔩', co2: 0 },
};

export default function Environnement() {
  const { p, isDark } = useTheme();
  const [releves, setReleves]     = useState([]);
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(null);
  const [listeFlux, setListeFlux]     = useListe(LISTES_ENVIRONNEMENT.STORAGE_KEY, LISTES_ENVIRONNEMENT.FLUX,   FLUX_DEFAULT);
  const [listeUnites, setListeUnites] = useListe(LISTES_ENVIRONNEMENT.STORAGE_KEY, LISTES_ENVIRONNEMENT.UNITES, UNITES_DEFAULT);
  const [form, setForm]           = useState({
    date_relevement: new Date().toISOString().split('T')[0],
    type_flux: FLUX_DEFAULT[0], quantite: '', unite: 'kWh', notes: '',
  });
  const [showForm, setShowForm]   = useState(false);
  const [filtreFlux, setFiltreFlux] = useState('Tous');

  useEffect(() => { fetchReleves(); }, []);

  const fetchReleves = async () => {
    setLoading(true);
    const { data } = await supabase.from('environnement_flux').select('*').order('date_relevement', { ascending: false });
    if (data) setReleves(data);
    // Si table vide, créer les exemples
    if (data && data.length === 0) {
      const exemples = [
        { date_relevement: '2026-03-01', type_flux: 'Électricité',   quantite: 4500, unite: 'kWh',    notes: '' },
        { date_relevement: '2026-03-01', type_flux: 'Eau potable',    quantite: 120,  unite: 'm³',     notes: '' },
        { date_relevement: '2026-03-10', type_flux: 'DIB (Déchets Industriels Banaux)', quantite: 2.5, unite: 'Tonnes', notes: '' },
        { date_relevement: '2026-02-01', type_flux: 'Électricité',   quantite: 4200, unite: 'kWh',    notes: '' },
        { date_relevement: '2026-02-01', type_flux: 'Eau potable',    quantite: 110,  unite: 'm³',     notes: '' },
        { date_relevement: '2026-01-01', type_flux: 'Électricité',   quantite: 4800, unite: 'kWh',    notes: '' },
      ];
      const { data: ins } = await supabase.from('environnement_flux').insert(exemples).select();
      if (ins) setReleves(ins);
    }
    setLoading(false);
  };

  const ajouterReleve = async () => {
    if (!form.quantite) return;
    const { data } = await supabase.from('environnement_flux').insert([{ ...form, quantite: Number(form.quantite) }]).select();
    if (data) {
      setReleves(prev => [data[0], ...prev]);
      setShowForm(false);
      setForm({ date_relevement: new Date().toISOString().split('T')[0], type_flux: listeFlux[0], quantite: '', unite: 'kWh', notes: '' });
    }
  };

  const updateRow = (id, field, value) => setReleves(prev => prev.map(r => r.id === id ? {...r, [field]: value} : r));

  const saveRow = async (row) => {
    setSaving(row.id);
    await supabase.from('environnement_flux').update(row).eq('id', row.id);
    setSaving(null);
  };

  const deleteRow = async (id) => {
    await supabase.from('environnement_flux').delete().eq('id', id);
    setReleves(prev => prev.filter(r => r.id !== id));
  };

  // ── KPIs ──────────────────────────────────────────────────────────────────
  const kpis = useMemo(() => {
    const energie = releves.filter(r => ['Électricité','Gaz naturel','Carburant (véhicules)'].includes(r.type_flux));
    const eau     = releves.filter(r => r.type_flux?.includes('Eau'));
    const dechets = releves.filter(r => ['DIB (Déchets Industriels Banaux)','Déchets Dangereux (DID)','Carton / Papier','Plastique','Métal / Ferraille','Déchets verts','DEEE'].some(d => r.type_flux?.includes(d.split(' ')[0])));

    const totalElec   = releves.filter(r => r.type_flux === 'Électricité').reduce((s, r) => s + Number(r.quantite || 0), 0);
    const totalEau    = eau.reduce((s, r) => s + Number(r.quantite || 0), 0);
    const totalDech   = dechets.reduce((s, r) => s + Number(r.quantite || 0), 0);

    // Bilan CO2 simplifié
    const co2 = releves.reduce((s, r) => {
      const info = Object.entries(CATEGORIES).find(([k]) => r.type_flux?.includes(k.split(' ')[0]));
      return s + (info ? Number(r.quantite || 0) * (info[1].co2 || 0) : 0);
    }, 0);

    return { totalElec, totalEau, totalDech, co2: (co2 / 1000).toFixed(2) };
  }, [releves]);

  // ── Graphique mensuel ─────────────────────────────────────────────────────
  const chartData = useMemo(() => {
    const moisMap = {};
    releves.forEach(r => {
      const mois = r.date_relevement?.substring(0, 7);
      if (!mois) return;
      if (!moisMap[mois]) moisMap[mois] = { mois, energie: 0, eau: 0, dechets: 0 };
      if (['Électricité','Gaz naturel','Carburant (véhicules)'].includes(r.type_flux)) moisMap[mois].energie += Number(r.quantite || 0);
      if (r.type_flux?.includes('Eau')) moisMap[mois].eau += Number(r.quantite || 0);
      if (['DIB','Carton','Plastique','Métal','Déchet'].some(d => r.type_flux?.includes(d))) moisMap[mois].dechets += Number(r.quantite || 0);
    });
    return Object.values(moisMap).sort((a, b) => a.mois.localeCompare(b.mois)).slice(-12);
  }, [releves]);

  // ── Répartition par flux ──────────────────────────────────────────────────
  const repartition = useMemo(() => {
    const map = {};
    releves.forEach(r => {
      if (!map[r.type_flux]) map[r.type_flux] = 0;
      map[r.type_flux] += Number(r.quantite || 0);
    });
    return Object.entries(map).map(([flux, total], i) => ({
      flux: flux.substring(0, 20),
      total: Math.round(total * 10) / 10,
      color: CATEGORIES[flux]?.color || ['#3B82F6','#10B981','#F59E0B','#8B5CF6','#EF4444'][i % 5],
    })).sort((a, b) => b.total - a.total).slice(0, 8);
  }, [releves]);

  const relevesFiltres = useMemo(() =>
    filtreFlux === 'Tous' ? releves : releves.filter(r => r.type_flux === filtreFlux),
  [releves, filtreFlux]);

  const FLUX_CATEGORIES = ['Tous', 'Électricité', 'Eau potable', 'DIB (Déchets Industriels Banaux)', 'Carton / Papier'];

  return (
    <div className="space-y-5 pb-10">

      {/* ── En-tête ──────────────────────────────────────────────────────── */}
      <header className="page-header">
        <div>
          <h2 className="page-title flex items-center gap-3">
            <Leaf size={26} className="text-emerald-400"/> Suivi Environnemental
          </h2>
          <p className="page-subtitle">Consommations, rejets et valorisation des déchets — données cloud</p>
        </div>
        <div className="flex gap-3">
          <GestionListes
            listes={{ 'Types de flux': listeFlux, 'Unités': listeUnites }}
            onSave={(key, list) => {
              if (key === 'Types de flux') setListeFlux(list);
              if (key === 'Unités') setListeUnites(list);
            }}
            storageKey="environnement"
          />
          <button onClick={fetchReleves} className="btn-secondary">
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''}/> Actualiser
          </button>
          <WriteOnly><button onClick={() => setShowForm(true)} className="btn-primary" style={{ background: '#10B981', boxShadow: '0 0 20px rgba(16,185,129,0.3)' }}>
            <Plus size={16}/> Ajouter un relevé
          </button></WriteOnly>
        </div>
      </header>

      {/* ── KPIs ─────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Énergie (élec)',  val: `${kpis.totalElec.toLocaleString()} kWh`, color: 'amber',  icon: <Zap size={20}/> },
          { label: 'Eau consommée',  val: `${kpis.totalEau.toLocaleString()} m³`,   color: 'blue',   icon: <Droplets size={20}/> },
          { label: 'Déchets',        val: `${kpis.totalDech.toLocaleString()} T`,   color: 'purple', icon: <Recycle size={20}/> },
          { label: 'Bilan CO₂ est.', val: `${kpis.co2} tCO₂e`,                     color: 'green',  icon: <Wind size={20}/> },
        ].map((k, i) => (
          <div key={i} className={`kpi-card ${k.color}`}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: p.whiteFaint3, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{k.icon}</div>
              <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">{k.label}</p>
            </div>
            <p className="text-3xl font-black text-white">{k.val}</p>
            <p className="text-xs text-slate-500 mt-2">Cumul période</p>
          </div>
        ))}
      </div>

      {/* ── Graphiques ───────────────────────────────────────────────────── */}
      {chartData.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="glass-panel p-5">
            <h3 className="text-white font-bold mb-4 flex items-center gap-2">
              <TrendingDown size={16} className="text-emerald-400"/> Évolution mensuelle
            </h3>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke={p.chartGrid} vertical={false}/>
                  <XAxis dataKey="mois" stroke={p.chartAxis} tick={{fill:'#64748B', fontSize:11}}/>
                  <YAxis stroke={p.chartAxis} tick={{fill:'#64748B', fontSize:10}}/>
                  <Tooltip contentStyle={{background:p.tooltipBg, border:`1px solid ${p.tooltipBorder}`, borderRadius:10, fontSize:11}}/>
                  <Legend wrapperStyle={{fontSize:11, color:p.text2}}/>
                  <Bar dataKey="energie" name="Énergie (kWh)" fill="#F59E0B" radius={[4,4,0,0]}/>
                  <Bar dataKey="eau"     name="Eau (m³)"      fill="#3B82F6" radius={[4,4,0,0]}/>
                  <Bar dataKey="dechets" name="Déchets (T)"   fill="#8B5CF6" radius={[4,4,0,0]}/>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="glass-panel p-5">
            <h3 className="text-white font-bold mb-4 flex items-center gap-2">
              <Recycle size={16} className="text-purple-400"/> Répartition par flux
            </h3>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={repartition} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke={p.chartGrid} horizontal={false}/>
                  <XAxis type="number" stroke={p.chartAxis} tick={{fill:'#64748B', fontSize:10}}/>
                  <YAxis type="category" dataKey="flux" stroke={p.chartAxis} tick={{fill:'#64748B', fontSize:10}} width={110}/>
                  <Tooltip contentStyle={{background:p.tooltipBg, border:`1px solid ${p.tooltipBorder}`, borderRadius:10, fontSize:11}}/>
                  <Bar dataKey="total" name="Quantité" radius={[0,4,4,0]}>
                    {repartition.map((r, i) => <Cell key={i} fill={r.color}/>)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* ── Formulaire ───────────────────────────────────────────────────── */}
      {showForm && (
        <div className="glass-panel p-5 border border-emerald-500/20 animate-fade-up">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-white font-bold flex items-center gap-2"><Plus size={16} className="text-emerald-400"/> Nouveau relevé</h3>
            <button onClick={() => setShowForm(false)} className="text-slate-500 hover:text-white p-1">✕</button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="text-slate-400 text-xs font-bold uppercase tracking-wider block mb-1">Date *</label>
              <input type="date" value={form.date_relevement} onChange={e => setForm({...form, date_relevement: e.target.value})} className="input-modern"/>
            </div>
            <div>
              <label className="text-slate-400 text-xs font-bold uppercase tracking-wider block mb-1">Type de flux *</label>
              <select value={form.type_flux} onChange={e => setForm({...form, type_flux: e.target.value})} className="input-modern">
                {listeFlux.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
            <div>
              <label className="text-slate-400 text-xs font-bold uppercase tracking-wider block mb-1">Quantité *</label>
              <input type="number" min="0" step="0.01" value={form.quantite} onChange={e => setForm({...form, quantite: e.target.value})} placeholder="0" className="input-modern"/>
            </div>
            <div>
              <label className="text-slate-400 text-xs font-bold uppercase tracking-wider block mb-1">Unité</label>
              <select value={form.unite} onChange={e => setForm({...form, unite: e.target.value})} className="input-modern">
                {listeUnites.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <div className="col-span-2 md:col-span-4">
              <label className="text-slate-400 text-xs font-bold uppercase tracking-wider block mb-1">Notes</label>
              <input type="text" value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} placeholder="Commentaire optionnel..." className="input-modern"/>
            </div>
          </div>
          <div className="flex gap-3 mt-4">
            <button onClick={() => setShowForm(false)} className="btn-secondary">Annuler</button>
            <button onClick={ajouterReleve} disabled={!form.quantite} className="btn-primary" style={{ background: '#10B981', boxShadow: '0 0 12px rgba(16,185,129,0.3)' }}>
              <Save size={15}/> Enregistrer
            </button>
          </div>
        </div>
      )}

      {/* ── Filtres rapides ───────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-2 items-center">
        {['Tous', ...new Set(releves.map(r => r.type_flux).filter(Boolean))].map(f => {
          const info = CATEGORIES[f];
          const color = info?.color || '#3B82F6';
          return (
            <button key={f} onClick={() => setFiltreFlux(f)} style={{ fontSize: 11, fontWeight: 600, padding: '4px 12px', borderRadius: 100, border: '1px solid', cursor: 'pointer', transition: 'all 0.12s',
              background: filtreFlux === f ? `${color}20` : p.whiteFaint2,
              borderColor: filtreFlux === f ? `${color}50` : p.border,
              color: filtreFlux === f ? color : p.text3 }}>
              {info?.icon && <span style={{ marginRight: 4 }}>{info.icon}</span>}{f}
            </button>
          );
        })}
        <span className="text-slate-500 text-xs ml-auto">{relevesFiltres.length} relevé{relevesFiltres.length > 1 ? 's' : ''}</span>
      </div>

      {/* ── Registre ─────────────────────────────────────────────────────── */}
      <div className="glass-panel">
        <div className="flex justify-between items-center p-5 border-b border-white/8">
          <h3 className="text-white font-bold flex items-center gap-2"><Leaf size={17} className="text-emerald-400"/> Registre des flux</h3>
        </div>
        {loading ? (
          <div className="p-10 text-center"><RefreshCw size={28} className="animate-spin text-emerald-400 mx-auto mb-3"/></div>
        ) : relevesFiltres.length === 0 ? (
          <div className="p-10 text-center text-slate-400">Aucun relevé enregistré.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table-modern">
              <thead><tr>
                <th style={{width:130}}>Date</th>
                <th>Type de flux</th>
                <th style={{width:130}}>Quantité</th>
                <th style={{width:110}}>Unité</th>
                <th>Notes</th>
                <th style={{width:50}}></th>
              </tr></thead>
              <tbody>
                {relevesFiltres.map(row => {
                  const info = Object.entries(CATEGORIES).find(([k]) => row.type_flux?.includes(k.split(' ')[0]));
                  const color = info?.[1]?.color || '#64748B';
                  return (
                    <tr key={row.id}>
                      <td>
                        <input type="date" value={row.date_relevement || ''} onChange={e => updateRow(row.id, 'date_relevement', e.target.value)} onBlur={() => saveRow(releves.find(r => r.id === row.id))} className="input-modern" style={{ padding: '5px 8px', fontSize: 12 }}/>
                      </td>
                      <td>
                        <select value={row.type_flux || listeFlux[0]} onChange={e => updateRow(row.id, 'type_flux', e.target.value)} onBlur={() => saveRow(releves.find(r => r.id === row.id))}
                          style={{ background: `${color}15`, color, border: `1px solid ${color}40`, borderRadius: 8, padding: '5px 10px', fontSize: 12, fontWeight: 600, outline: 'none', cursor: 'pointer', width: '100%' }}>
                          {listeFlux.map(f => <option key={f} value={f} >{f}</option>)}
                        </select>
                      </td>
                      <td>
                        <input type="number" min="0" step="0.01" value={row.quantite || 0} onChange={e => updateRow(row.id, 'quantite', Number(e.target.value))} onBlur={() => saveRow(releves.find(r => r.id === row.id))} className="input-modern text-center" style={{ padding: '5px 8px', fontSize: 13, fontWeight: 700 }}/>
                      </td>
                      <td>
                        <select value={row.unite || listeUnites[0]} onChange={e => updateRow(row.id, 'unite', e.target.value)} onBlur={() => saveRow(releves.find(r => r.id === row.id))} className="input-modern" style={{ padding: '5px 8px', fontSize: 12 }}>
                          {listeUnites.map(u => <option key={u} value={u}>{u}</option>)}
                        </select>
                      </td>
                      <td>
                        <input type="text" value={row.notes || ''} onChange={e => updateRow(row.id, 'notes', e.target.value)} onBlur={() => saveRow(releves.find(r => r.id === row.id))} placeholder="Notes..." className="input-modern" style={{ padding: '5px 8px', fontSize: 12 }}/>
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
