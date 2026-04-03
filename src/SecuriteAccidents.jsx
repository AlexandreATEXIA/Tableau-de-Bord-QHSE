import { useTheme } from './ThemeContext';
import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Trash2, HeartPulse, RefreshCw, AlertTriangle, CheckCircle, Clock, X, Save, ChevronDown, ChevronUp, Activity, Calendar, Archive, RotateCcw, History } from 'lucide-react';
import { supabase } from './supabaseClient';
import GestionListes from './GestionListes';
import { useToast } from './Toast';
import { useConfig } from './ConfigContext';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from 'recharts';

const TYPES_EVT_DEFAULT = ["Presqu'accident", "Soins (sans arrêt)", "Accident avec arrêt", "Maladie Professionnelle", "Incident matériel"];
const STATUTS   = ["À lancer", "En cours d'analyse", "Actions définies", "Clôturée"];
const LIEUX_DEFAULT     = ["Atelier", "Magasin", "Bureaux", "Chantier", "Parking", "Vestiaires", "Autre"];
const CAUSES    = ["Chute de plain-pied", "Chute de hauteur", "Manutention manuelle", "Utilisation d'outillage", "Projection", "Contact avec machine", "Brûlure", "TMS", "Autre"];

const TYPE_STYLE = {
  "Presqu'accident":        { color: '#3B82F6', badge: 'badge-blue',   label: "Presqu'acc." },
  "Soins (sans arrêt)":    { color: '#F59E0B', badge: 'badge-amber',  label: 'Soins' },
  "Accident avec arrêt":   { color: '#EF4444', badge: 'badge-red',    label: 'Avec arrêt' },
  "Maladie Professionnelle":{ color: '#8B5CF6', badge: 'badge-purple', label: 'MP' },
  "Incident matériel":     { color: '#06B6D4', badge: 'badge-blue',   label: 'Matériel' },
};

const STATUT_STYLE = {
  "À lancer":           { color: '#EF4444', badge: 'badge-red' },
  "En cours d'analyse": { color: '#F59E0B', badge: 'badge-amber' },
  "Actions définies":   { color: '#3B82F6', badge: 'badge-blue' },
  "Clôturée":           { color: '#10B981', badge: 'badge-green' },
};

export default function SecuriteAccidents() {
  const { p, isDark } = useTheme();
  const { toast } = useToast();
  const { config } = useConfig();
  const [accidents, setAccidents]   = useState([]);
  const [listeTypes, setListeTypes] = useState(TYPES_EVT_DEFAULT);
  const [listeLieux, setListeLieux] = useState(LIEUX_DEFAULT);
  const [loading, setLoading]       = useState(false);
  const [saving, setSaving]         = useState(null);
  const [showForm, setShowForm]     = useState(false);
  const [expanded, setExpanded]     = useState(null);
  const [showArchive, setShowArchive] = useState(false);
  const [form, setForm]             = useState({
    date_evenement: new Date().toISOString().split('T')[0],
    type_evenement: "Presqu'accident",
    lieu: 'Atelier',
    description: '',
    cause_immediate: [],
    victime: '',
    temoin: '',
    jours_perdus: 0,
    statut_enquete: 'À lancer',
    mesures_immediates: '',
    actions_correctives: '',
  });

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    const { data } = await supabase.from('securite_accidents').select('*').order('date_evenement', { ascending: false });
    if (data) setAccidents(data);
    setLoading(false);
  };

  const sauvegarderLigne = async (row) => {
    setSaving(row.id);
    await supabase.from('securite_accidents').update(row).eq('id', row.id);
    setSaving(null);
  };

  const updateField = (id, field, value) => {
    setAccidents(prev => prev.map(a => a.id === id ? { ...a, [field]: value } : a));
  };

  const declarerEvenement = async () => {
    const payload = { ...form, cause_immediate: Array.isArray(form.cause_immediate) ? form.cause_immediate.join(' / ') : form.cause_immediate };
    const { data, error } = await supabase.from('securite_accidents').insert([payload]).select();
    if (error) {
      toast({ message: `Erreur : ${error.message}`, type: 'error' });
      return;
    }
    if (data) {
      setAccidents([data[0], ...accidents]);
      setShowForm(false);
      setForm({ date_evenement: new Date().toISOString().split('T')[0], type_evenement: "Presqu'accident", lieu: 'Atelier', description: '', cause_immediate: [], victime: '', temoin: '', jours_perdus: 0, statut_enquete: 'À lancer', mesures_immediates: '', actions_correctives: '' });
      toast({ message: 'Événement déclaré', type: 'success' });
    }
  };

  const deleteRow = async (id) => {
    await supabase.from('securite_accidents').delete().eq('id', id);
    setAccidents(accidents.filter(a => a.id !== id));
    toast({ message: 'Événement supprimé définitivement', type: 'info' });
  };

  const archiveRow = async (id) => {
    const now = new Date().toISOString();
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from('securite_accidents').update({ archived_at: now, archived_by: user?.email || null }).eq('id', id);
    setAccidents(prev => prev.map(a => a.id === id ? { ...a, archived_at: now } : a));
    toast({ message: 'Événement archivé', type: 'info' });
  };
  const restoreRow = async (id) => {
    await supabase.from('securite_accidents').update({ archived_at: null, archived_by: null }).eq('id', id);
    setAccidents(prev => prev.map(a => a.id === id ? { ...a, archived_at: null } : a));
    toast({ message: 'Événement restauré', type: 'success' });
  };

  // ── KPIs (actifs uniquement) ─────────────────────────────────────────────
  const kpis = useMemo(() => {
    const actifs      = accidents.filter(a => !a.archived_at);
    const accArret    = actifs.filter(a => a.type_evenement === 'Accident avec arrêt');
    const jours       = actifs.reduce((s, a) => s + (a.jours_perdus || 0), 0);
    const heures      = (config.effectif || 50) * (config.h_an || 1607);
    const TF          = accArret.length > 0 ? ((accArret.length * 1000000) / heures).toFixed(2) : '0.00';
    const TG          = jours > 0 ? ((jours * 1000) / heures).toFixed(2) : '0.00';
    const nonClotures = actifs.filter(a => a.statut_enquete !== 'Clôturée' && a.type_evenement !== "Presqu'accident");
    return { total: actifs.length, accArret: accArret.length, jours, TF, TG, nonClotures: nonClotures.length, presquAcc: actifs.filter(a => a.type_evenement === "Presqu'accident").length };
  }, [accidents, config]);

  // ── Graphique par mois ────────────────────────────────────────────────────
  const chartData = useMemo(() => {
    const moisMap = {};
    accidents.forEach(a => {
      const mois = a.date_evenement?.substring(0, 7);
      if (!mois) return;
      if (!moisMap[mois]) moisMap[mois] = { mois, arret: 0, soins: 0, presqu: 0 };
      if (a.type_evenement === 'Accident avec arrêt')   moisMap[mois].arret++;
      if (a.type_evenement === 'Soins (sans arrêt)')    moisMap[mois].soins++;
      if (a.type_evenement === "Presqu'accident")        moisMap[mois].presqu++;
    });
    return Object.values(moisMap).sort((a, b) => a.mois.localeCompare(b.mois)).slice(-12);
  }, [accidents]);

  return (
    <div className="space-y-6 pb-10">

      {/* ── En-tête ──────────────────────────────────────────────────────── */}
      <header className="page-header">
        <div>
          <h2 className="page-title flex items-center gap-3">
            <HeartPulse size={26} className="text-red-400"/> Sécurité & Accidents
          </h2>
          <p className="page-subtitle">Registre des événements — Déclaration, enquête et suivi</p>
          <div style={{ display:'flex', gap:6, marginTop:8 }}>
            <button onClick={() => setShowArchive(false)} style={{ fontSize:12, fontWeight:700, padding:'3px 14px', borderRadius:100, border:'1px solid', cursor:'pointer', background:!showArchive?'rgba(239,68,68,0.18)':'transparent', borderColor:!showArchive?'rgba(239,68,68,0.5)':'rgba(255,255,255,0.1)', color:!showArchive?'#F87171':'var(--text-4)' }}>
              Actifs ({accidents.filter(a=>!a.archived_at).length})
            </button>
            <button onClick={() => setShowArchive(true)} style={{ fontSize:12, fontWeight:700, padding:'3px 14px', borderRadius:100, border:'1px solid', cursor:'pointer', background:showArchive?'rgba(100,116,139,0.18)':'transparent', borderColor:showArchive?'rgba(100,116,139,0.5)':'rgba(255,255,255,0.1)', color:showArchive?'#94A3B8':'var(--text-4)' }}>
              <History size={11} style={{display:'inline',marginRight:4}}/>Historique ({accidents.filter(a=>a.archived_at).length})
            </button>
          </div>
        </div>
        <div className="flex gap-3">
          <GestionListes
            listes={{ "Types d'événements": listeTypes, 'Lieux': listeLieux }}
            onSave={(key, list) => {
              if (key === "Types d'événements") setListeTypes(list);
              if (key === 'Lieux') setListeLieux(list);
            }}
            storageKey="accidents"
          />
          <button onClick={loadData} className="btn-secondary">
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''}/> Actualiser
          </button>
          <button onClick={() => setShowForm(true)} className="btn-primary" style={{ background: '#EF4444', boxShadow: '0 0 20px rgba(239,68,68,0.3)' }}>
            <Plus size={16}/> Déclarer un événement
          </button>
        </div>
      </header>

      {/* ── KPIs ────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 animate-fade-up-1">
        {[
          { label: 'Événements total',    val: kpis.total,       color: 'blue',  sub: 'Tous types confondus' },
          { label: 'Acc. avec arrêt',     val: kpis.accArret,    color: kpis.accArret > 0 ? 'red' : 'green', sub: `TF : ${kpis.TF}` },
          { label: 'Jours perdus',        val: kpis.jours,       color: kpis.jours > 0 ? 'amber' : 'green',  sub: `TG : ${kpis.TG}` },
          { label: 'Enquêtes ouvertes',   val: kpis.nonClotures, color: kpis.nonClotures > 0 ? 'amber' : 'green', sub: 'À clôturer' },
        ].map((k, i) => (
          <div key={i} className={`kpi-card ${k.color}`}>
            <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">{k.label}</p>
            <p className="text-4xl font-black text-white">{k.val}</p>
            <p className="text-xs text-slate-500 mt-2">{k.sub}</p>
          </div>
        ))}
      </div>

      {/* ── Alertes ─────────────────────────────────────────────────────── */}
      {kpis.accArret > 0 && (
        <div className="alert-banner alert-red animate-fade-up-2">
          <AlertTriangle size={18} className="shrink-0 mt-0.5"/>
          <div>
            <p className="font-bold">{kpis.accArret} accident{kpis.accArret > 1 ? 's' : ''} avec arrêt — Taux de Fréquence : {kpis.TF}</p>
            <p className="text-xs mt-1 opacity-80">Vérifier la conformité de la déclaration CPAM et les mesures correctives</p>
          </div>
        </div>
      )}
      {kpis.nonClotures > 0 && (
        <div className="alert-banner alert-amber animate-fade-up-2">
          <Clock size={18} className="shrink-0"/>
          <p className="font-bold">{kpis.nonClotures} enquête{kpis.nonClotures > 1 ? 's' : ''} en attente de clôture</p>
        </div>
      )}
      {kpis.accArret === 0 && accidents.length > 0 && (
        <div className="alert-banner alert-green animate-fade-up-2">
          <CheckCircle size={18} className="shrink-0"/>
          <p className="font-bold">Aucun accident avec arrêt enregistré — Objectif de zéro AT atteint !</p>
        </div>
      )}

      {/* ── Formulaire de déclaration ────────────────────────────────────── */}
      {showForm && (
        <div className="glass-panel p-6 border border-red-500/30 animate-fade-up">
          <div className="flex justify-between items-center mb-5">
            <h3 className="text-white font-bold text-lg flex items-center gap-2">
              <AlertTriangle size={18} className="text-red-400"/> Déclarer un événement
            </h3>
            <button onClick={() => setShowForm(false)} className="text-slate-500 hover:text-white p-1"><X size={18}/></button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-slate-400 text-xs font-bold uppercase tracking-wider block mb-1">Date *</label>
              <input type="date" value={form.date_evenement} onChange={e => setForm({...form, date_evenement: e.target.value})} className="input-modern"/>
            </div>
            <div>
              <label className="text-slate-400 text-xs font-bold uppercase tracking-wider block mb-1">Type d'événement *</label>
              <select value={form.type_evenement} onChange={e => setForm({...form, type_evenement: e.target.value})} className="input-modern">
                {listeTypes.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="text-slate-400 text-xs font-bold uppercase tracking-wider block mb-1">Lieu</label>
              <select value={form.lieu} onChange={e => setForm({...form, lieu: e.target.value})} className="input-modern">
                {listeLieux.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
            <div>
              <label className="text-slate-400 text-xs font-bold uppercase tracking-wider block mb-1">Victime / Personne concernée</label>
              <input type="text" value={form.victime} onChange={e => setForm({...form, victime: e.target.value})} placeholder="Nom, prénom, poste..." className="input-modern"/>
            </div>
            <div>
              <label className="text-slate-400 text-xs font-bold uppercase tracking-wider block mb-1">Témoin(s)</label>
              <input type="text" value={form.temoin} onChange={e => setForm({...form, temoin: e.target.value})} placeholder="Nom des témoins..." className="input-modern"/>
            </div>
            <div>
              <label className="text-slate-400 text-xs font-bold uppercase tracking-wider block mb-1">Jours perdus</label>
              <input type="number" min="0" value={form.jours_perdus} onChange={e => setForm({...form, jours_perdus: parseInt(e.target.value) || 0})} className="input-modern" disabled={form.type_evenement !== 'Accident avec arrêt'}/>
            </div>
            <div>
              <label className="text-slate-400 text-xs font-bold uppercase tracking-wider block mb-1">Cause(s) immédiate(s)</label>
              <div style={{ border:'1px solid var(--border)', borderRadius:9, background:'var(--bg-input)', padding:'6px 8px', minHeight:42, display:'flex', flexWrap:'wrap', gap:5 }}>
                {(form.cause_immediate || []).map(c => (
                  <span key={c} style={{ display:'inline-flex', alignItems:'center', gap:4, background:'rgba(239,68,68,0.12)', border:'1px solid rgba(239,68,68,0.3)', color:'#EF4444', borderRadius:6, padding:'2px 8px', fontSize:12, fontWeight:600 }}>
                    {c}
                    <button onClick={() => setForm({...form, cause_immediate: form.cause_immediate.filter(x => x !== c)})}
                      style={{ background:'none', border:'none', cursor:'pointer', color:'#EF4444', padding:'0 2px', lineHeight:1, fontSize:14 }}>×</button>
                  </span>
                ))}
                <select value="" onChange={e => { const v = e.target.value; if (v && !(form.cause_immediate||[]).includes(v)) setForm({...form, cause_immediate:[...(form.cause_immediate||[]), v]}); }}
                  style={{ border:'none', background:'transparent', color:'var(--text-3)', fontSize:13, cursor:'pointer', outline:'none', flex:1, minWidth:120 }}>
                  <option value="">+ Ajouter...</option>
                  {CAUSES.filter(c => !(form.cause_immediate||[]).includes(c)).map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="text-slate-400 text-xs font-bold uppercase tracking-wider block mb-1">Statut enquête</label>
              <select value={form.statut_enquete} onChange={e => setForm({...form, statut_enquete: e.target.value})} className="input-modern">
                {STATUTS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className="md:col-span-3">
              <label className="text-slate-400 text-xs font-bold uppercase tracking-wider block mb-1">Description des faits *</label>
              <textarea rows={2} value={form.description} onChange={e => setForm({...form, description: e.target.value})} placeholder="Décrivez précisément les circonstances de l'événement..." className="input-modern resize-none"/>
            </div>
            <div className="md:col-span-3">
              <label className="text-slate-400 text-xs font-bold uppercase tracking-wider block mb-1">Mesures immédiates prises</label>
              <textarea rows={2} value={form.mesures_immediates} onChange={e => setForm({...form, mesures_immediates: e.target.value})} placeholder="Soins prodigués, zone sécurisée, équipement consigné..." className="input-modern resize-none"/>
            </div>
            <div className="md:col-span-3">
              <label className="text-slate-400 text-xs font-bold uppercase tracking-wider block mb-1">Actions correctives prévues</label>
              <textarea rows={2} value={form.actions_correctives} onChange={e => setForm({...form, actions_correctives: e.target.value})} placeholder="Actions à mettre en place pour éviter la récurrence..." className="input-modern resize-none"/>
            </div>
          </div>
          <div className="flex gap-3 mt-5">
            <button onClick={() => setShowForm(false)} className="btn-secondary">Annuler</button>
            <button onClick={declarerEvenement} disabled={!form.description} className="btn-primary" style={{ background: '#EF4444', boxShadow: '0 0 16px rgba(239,68,68,0.3)' }}>
              <Save size={16}/> Enregistrer la déclaration
            </button>
          </div>
        </div>
      )}

      {/* ── Graphique ───────────────────────────────────────────────────── */}
      {chartData.length > 0 && (
        <div className="glass-panel p-5 animate-fade-up-3">
          <h3 className="text-white font-bold mb-4 flex items-center gap-2">
            <Activity size={16} className="text-red-400"/> Accidentologie — 12 derniers mois
          </h3>
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke={p.chartGrid} vertical={false}/>
                <XAxis dataKey="mois" stroke={p.chartAxis} tick={{fill:'#64748B', fontSize:11}}/>
                <YAxis stroke={p.chartAxis} tick={{fill:'#64748B', fontSize:11}} allowDecimals={false}/>
                <Tooltip contentStyle={{background:p.tooltipBg, border:`1px solid ${p.tooltipBorder}`, borderRadius:10, fontSize:12}}/>
                <Bar dataKey="arret"  name="Acc. avec arrêt"  fill="#EF4444" radius={[4,4,0,0]} stackId="a"/>
                <Bar dataKey="soins"  name="Soins sans arrêt" fill="#F59E0B" radius={[4,4,0,0]} stackId="a"/>
                <Bar dataKey="presqu" name="Presqu'accidents"  fill="#3B82F6" radius={[4,4,0,0]} stackId="a"/>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ── Registre ────────────────────────────────────────────────────── */}
      <div className="glass-panel animate-fade-up-4">
        <div className="flex justify-between items-center p-5 border-b border-white/8">
          <h3 className="text-white font-bold flex items-center gap-2">
            <Calendar size={18} className="text-red-400"/> Registre des événements
          </h3>
          <span className="text-slate-400 text-sm">{accidents.length} événement{accidents.length > 1 ? 's' : ''}</span>
        </div>

        {accidents.length === 0 ? (
          <div className="p-12 text-center">
            <CheckCircle size={40} className="text-emerald-400 mx-auto mb-3"/>
            <p className="text-white font-bold text-lg">Aucun événement enregistré</p>
            <p className="text-slate-400 text-sm mt-1">Parfait ! Objectif zéro accident maintenu.</p>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {accidents.filter(a => showArchive ? !!a.archived_at : !a.archived_at).map((row) => {
              const typeStyle   = TYPE_STYLE[row.type_evenement]   || TYPE_STYLE["Presqu'accident"];
              const statutStyle = STATUT_STYLE[row.statut_enquete] || STATUT_STYLE['À lancer'];
              const isExpanded  = expanded === row.id;

              return (
                <div key={row.id} style={{ borderLeft: `3px solid ${typeStyle.color}` }}>
                  {/* Ligne principale */}
                  <div className="flex items-center gap-4 p-4 hover:bg-white/2 transition-colors">
                    <div className="text-slate-400 text-sm font-mono shrink-0 w-24">{row.date_evenement}</div>
                    <span className={`badge ${typeStyle.badge} shrink-0`}>{typeStyle.label}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-medium text-sm truncate">{row.description || '(sans description)'}</p>
                      <p className="text-slate-500 text-xs mt-0.5">{row.lieu}{row.victime ? ` · ${row.victime}` : ''}</p>
                    </div>
                    {row.jours_perdus > 0 && (
                      <div className="text-center shrink-0">
                        <p className="text-red-400 font-bold text-sm">{row.jours_perdus}j</p>
                        <p className="text-slate-500 text-xs">perdus</p>
                      </div>
                    )}
                    <span className={`badge ${statutStyle.badge} shrink-0`}>{row.statut_enquete}</span>
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={() => setExpanded(isExpanded ? null : row.id)} className="text-slate-500 hover:text-white transition-colors p-1.5 rounded hover:bg-white/5">
                        {isExpanded ? <ChevronUp size={16}/> : <ChevronDown size={16}/>}
                      </button>
                      {showArchive ? (
                        <>
                          <button onClick={() => restoreRow(row.id)} title="Restaurer" className="text-green-500 hover:text-green-400 transition-colors p-1.5 rounded hover:bg-white/5"><RotateCcw size={15}/></button>
                          <button onClick={() => deleteRow(row.id)} title="Supprimer définitivement" className="text-slate-600 hover:text-red-400 transition-colors p-1.5 rounded hover:bg-white/5"><Trash2 size={15}/></button>
                        </>
                      ) : (
                        <button onClick={() => archiveRow(row.id)} title="Archiver" className="text-slate-600 hover:text-amber-400 transition-colors p-1.5 rounded hover:bg-white/5"><Archive size={15}/></button>
                      )}
                    </div>
                  </div>

                  {/* Détail expandé */}
                  {isExpanded && (
                    <div className="px-5 pb-5 pt-2 bg-black/10 grid grid-cols-1 md:grid-cols-2 gap-4">
                      {[
                        { label: 'Type événement', key: 'type_evenement', type: 'select', options: listeTypes },
                        { label: 'Date',            key: 'date_evenement', type: 'date' },
                        { label: 'Lieu',            key: 'lieu',           type: 'select', options: listeLieux },
                        { label: 'Cause(s) immédiate(s)', key: 'cause_immediate', type: 'text', placeholder: 'Cause 1 / Cause 2...' },
                        { label: 'Victime',         key: 'victime',        type: 'text', placeholder: 'Nom, poste...' },
                        { label: 'Témoin(s)',        key: 'temoin',         type: 'text', placeholder: 'Noms...' },
                        { label: 'Jours perdus',    key: 'jours_perdus',   type: 'number' },
                        { label: 'Statut enquête',  key: 'statut_enquete', type: 'select', options: STATUTS },
                      ].map(f => (
                        <div key={f.key}>
                          <label className="text-slate-500 text-xs font-bold uppercase tracking-wider block mb-1">{f.label}</label>
                          {f.type === 'select' ? (
                            <select value={row[f.key] || ''} onChange={e => updateField(row.id, f.key, e.target.value)} className="input-modern" style={{ fontSize: 13, padding: '7px 12px' }}>
                              {f.options.map(o => <option key={o} value={o}>{o || 'Non renseigné'}</option>)}
                            </select>
                          ) : (
                            <input type={f.type} value={row[f.key] || ''} onChange={e => updateField(row.id, f.key, f.type === 'number' ? parseInt(e.target.value) || 0 : e.target.value)} placeholder={f.placeholder} className="input-modern" style={{ fontSize: 13, padding: '7px 12px' }}/>
                          )}
                        </div>
                      ))}
                      <div className="md:col-span-2">
                        <label className="text-slate-500 text-xs font-bold uppercase tracking-wider block mb-1">Description des faits</label>
                        <textarea rows={2} value={row.description || ''} onChange={e => updateField(row.id, 'description', e.target.value)} className="input-modern resize-none" style={{ fontSize: 13 }}/>
                      </div>
                      <div className="md:col-span-2">
                        <label className="text-slate-500 text-xs font-bold uppercase tracking-wider block mb-1">Mesures immédiates</label>
                        <textarea rows={2} value={row.mesures_immediates || ''} onChange={e => updateField(row.id, 'mesures_immediates', e.target.value)} className="input-modern resize-none" style={{ fontSize: 13 }} placeholder="Soins prodigués, zone sécurisée..."/>
                      </div>
                      <div className="md:col-span-2">
                        <label className="text-slate-500 text-xs font-bold uppercase tracking-wider block mb-1">Actions correctives</label>
                        <textarea rows={2} value={row.actions_correctives || ''} onChange={e => updateField(row.id, 'actions_correctives', e.target.value)} className="input-modern resize-none" style={{ fontSize: 13 }} placeholder="Actions pour éviter la récurrence..."/>
                      </div>
                      <div className="md:col-span-2 flex justify-end">
                        <button onClick={() => sauvegarderLigne(accidents.find(a => a.id === row.id))} disabled={saving === row.id} className="btn-primary" style={{ fontSize: 13, padding: '8px 16px' }}>
                          {saving === row.id ? <RefreshCw size={14} className="animate-spin"/> : <Save size={14}/>}
                          {saving === row.id ? 'Sauvegarde...' : 'Sauvegarder'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
