import { useTheme } from './ThemeContext';
import { useToast } from './ToastContext';
import { useSortable, SortTh } from './useSortable';
import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Trash2, Star, RefreshCw, Save, X, ShoppingCart, CheckCircle, AlertTriangle, TrendingUp, Filter } from 'lucide-react';
import { supabase } from './supabaseClient';
import ConfirmModal from './ConfirmModal';
import { WriteOnly } from './WriteGuard';

/* ─── Référentiels ──────────────────────────────────────────────────────────── */
const SECTEURS = ['Matières premières', 'Équipements', 'Sous-traitance', 'Services', 'Logistique', 'IT / Numérique', 'Maintenance', 'Autre'];
const STATUTS  = ['Approuvé', 'Sous surveillance', 'Disqualifié', 'En évaluation'];
const CRITERES = [
  { key: 'note_qualite',     label: 'Qualité produit / service', poids: 30 },
  { key: 'note_delai',       label: 'Respect des délais',        poids: 25 },
  { key: 'note_prix',        label: 'Compétitivité prix',        poids: 20 },
  { key: 'note_service',     label: 'Réactivité / SAV',          poids: 15 },
  { key: 'note_conformite',  label: 'Conformité réglementaire',  poids: 10 },
];

const STATUT_STYLE = {
  'Approuvé':          { color: '#10B981', bg: 'rgba(16,185,129,0.12)',  border: 'rgba(16,185,129,0.3)',  badge: 'badge-green' },
  'Sous surveillance': { color: '#F59E0B', bg: 'rgba(245,158,11,0.12)',  border: 'rgba(245,158,11,0.3)',  badge: 'badge-amber' },
  'Disqualifié':       { color: '#EF4444', bg: 'rgba(239,68,68,0.12)',   border: 'rgba(239,68,68,0.3)',   badge: 'badge-red'   },
  'En évaluation':     { color: '#3B82F6', bg: 'rgba(59,130,246,0.12)',  border: 'rgba(59,130,246,0.3)',  badge: 'badge-blue'  },
};

function calcScore(row) {
  let total = 0, poids = 0;
  CRITERES.forEach(c => {
    const v = Number(row[c.key] || 0);
    if (v > 0) { total += v * c.poids; poids += c.poids; }
  });
  return poids > 0 ? Math.round((total / poids) * 20) : 0; // ramène sur 100
}

function EtoileNote({ val, onChange, size = 16 }) {
  const [hover, setHover] = useState(0);
  return (
    <div style={{ display: 'flex', gap: 2 }}>
      {[1,2,3,4,5].map(i => (
        <Star
          key={i}
          size={size}
          fill={(hover||val) >= i ? '#F59E0B' : 'none'}
          color={(hover||val) >= i ? '#F59E0B' : '#94A3B8'}
          style={{ cursor: onChange ? 'pointer' : 'default', transition: 'color 0.1s' }}
          onMouseEnter={() => onChange && setHover(i)}
          onMouseLeave={() => onChange && setHover(0)}
          onClick={() => onChange && onChange(i)}
        />
      ))}
    </div>
  );
}

function JaugeScore({ score }) {
  const color = score >= 80 ? '#10B981' : score >= 60 ? '#F59E0B' : '#EF4444';
  const label = score >= 80 ? 'Excellent' : score >= 60 ? 'Satisfaisant' : 'À améliorer';
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 22, fontWeight: 900, color, lineHeight: 1 }}>{score}</div>
      <div style={{ fontSize: 10, color, fontWeight: 700 }}>/100 · {label}</div>
      <div style={{ height: 4, background: 'rgba(100,116,139,0.2)', borderRadius: 2, marginTop: 5, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${score}%`, background: color, borderRadius: 2, transition: 'width 0.4s' }}/>
      </div>
    </div>
  );
}

const FORM_INIT = {
  nom: '', contact: '', secteur: SECTEURS[0], statut: 'En évaluation',
  note_qualite: 0, note_delai: 0, note_prix: 0, note_service: 0, note_conformite: 0,
  commentaire: '', date_eval: new Date().toISOString().split('T')[0],
};

export default function FournisseursEval() {
  const { p, isDark } = useTheme();
  const toast = useToast();

  const [fournisseurs, setFournisseurs] = useState([]);
  const [loading, setLoading]           = useState(true);
  const [saving, setSaving]             = useState(null);
  const [showForm, setShowForm]         = useState(false);
  const [form, setForm]                 = useState({ ...FORM_INIT });
  const [filtreStatut, setFS]           = useState('Tous');
  const [filtreSecteur, setFSect]       = useState('Tous');
  const [confirm, setConfirm]           = useState(null);
  const [expanded, setExpanded]         = useState(null);

  const { sorted, sortKey, sortDir, toggle } = useSortable(fournisseurs, 'nom', 'asc');

  useEffect(() => { fetchFournisseurs(); }, []);

  async function fetchFournisseurs() {
    setLoading(true);
    const { data, error } = await supabase.from('fournisseurs_eval').select('*').order('nom');
    if (error) {
      // Table might not exist yet — show empty state gracefully
      if (error.code === '42P01') { setFournisseurs([]); setLoading(false); return; }
      toast.error('Erreur chargement : ' + error.message);
    }
    if (data) setFournisseurs(data.map(f => ({ ...f, _score: calcScore(f) })));
    setLoading(false);
  };

  const updateRow = (id, field, value) =>
    setFournisseurs(prev => prev.map(r => r.id === id ? { ...r, [field]: value, _score: calcScore({ ...r, [field]: value }) } : r));

  const saveRow = async (row) => {
    setSaving(row.id);
    const { id, _score, ...data } = row;
    const { error } = await supabase.from('fournisseurs_eval').update(data).eq('id', id);
    if (error) toast.error('Erreur sauvegarde : ' + error.message);
    else toast.success('Fournisseur enregistré');
    setSaving(null);
  };

  const ajouterFournisseur = async () => {
    if (!form.nom.trim()) { toast.error('Le nom est obligatoire'); return; }
    const { data, error } = await supabase.from('fournisseurs_eval').insert([form]).select();
    if (error) { toast.error('Erreur : ' + error.message); return; }
    if (data) {
      setFournisseurs(prev => [...prev, { ...data[0], _score: calcScore(data[0]) }]);
      setShowForm(false);
      setForm({ ...FORM_INIT });
      toast.success('Fournisseur ajouté');
    }
  };

  const deleteRow = async (id) => {
    const { error } = await supabase.from('fournisseurs_eval').delete().eq('id', id);
    if (error) { toast.error('Erreur suppression : ' + error.message); return; }
    setFournisseurs(prev => prev.filter(r => r.id !== id));
    toast.success('Fournisseur supprimé');
  };

  const kpis = useMemo(() => {
    const scores = fournisseurs.map(f => f._score || calcScore(f)).filter(s => s > 0);
    return {
      total:          fournisseurs.length,
      approuves:      fournisseurs.filter(f => f.statut === 'Approuvé').length,
      surveillance:   fournisseurs.filter(f => f.statut === 'Sous surveillance').length,
      disqualifies:   fournisseurs.filter(f => f.statut === 'Disqualifié').length,
      scoreMoyen:     scores.length > 0 ? Math.round(scores.reduce((s,v)=>s+v,0)/scores.length) : 0,
    };
  }, [fournisseurs]);

  const filtres = useMemo(() => fournisseurs.filter(f => {
    if (filtreStatut !== 'Tous' && f.statut !== filtreStatut) return false;
    if (filtreSecteur !== 'Tous' && f.secteur !== filtreSecteur) return false;
    return true;
  }), [fournisseurs, filtreStatut, filtreSecteur]);

  const secteurs = useMemo(() => ['Tous', ...[...new Set(fournisseurs.map(f => f.secteur).filter(Boolean))].sort()], [fournisseurs]);

  const inp = { padding: '6px 10px', fontSize: 12, background: p.bgInput, border: '1px solid ' + p.borderInput, borderRadius: 6, color: p.text1, fontFamily: 'inherit', outline: 'none', width: '100%' };
  const lbl = { fontSize: 10, fontWeight: 700, color: p.text4, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 4 };

  return (
    <div className="space-y-5 pb-10">

      {/* ── En-tête ─────────────────────────────────────────────────────────── */}
      <header className="page-header">
        <div>
          <h2 className="page-title flex items-center gap-3"><ShoppingCart size={26} className="text-blue-400"/> Évaluation Fournisseurs</h2>
          <p className="page-subtitle">Qualification et suivi des fournisseurs — ISO 9001 §8.4</p>
        </div>
        <div className="flex gap-3">
          <button onClick={fetchFournisseurs} className="btn-secondary"><RefreshCw size={16} className={loading ? 'animate-spin' : ''}/> Actualiser</button>
          <WriteOnly><button onClick={() => setShowForm(true)} className="btn-primary"><Plus size={16}/> Nouveau fournisseur</button></WriteOnly>
        </div>
      </header>

      {/* ── KPIs ─────────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: 'Fournisseurs',      val: kpis.total,        color: 'blue',  sub: 'Panel total' },
          { label: 'Approuvés',         val: kpis.approuves,    color: 'green', sub: 'Qualifiés' },
          { label: 'Sous surveillance', val: kpis.surveillance, color: 'amber', sub: 'À surveiller' },
          { label: 'Disqualifiés',      val: kpis.disqualifies, color: 'red',   sub: 'Exclus du panel' },
          { label: 'Score moyen',       val: `${kpis.scoreMoyen}/100`, color: kpis.scoreMoyen>=80?'green':kpis.scoreMoyen>=60?'amber':'red', sub: 'Performance globale' },
        ].map((k, i) => (
          <div key={i} className={`kpi-card ${k.color}`}>
            <p className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: p.text3 }}>{k.label}</p>
            <p className="text-3xl font-black" style={{ color: p.text1 }}>{k.val}</p>
            <p className="text-xs mt-1" style={{ color: p.text4 }}>{k.sub}</p>
          </div>
        ))}
      </div>

      {/* ── Filtres ──────────────────────────────────────────────────────────── */}
      <div className="glass-panel p-4 flex flex-wrap gap-3 items-center">
        <Filter size={14} style={{ color: p.text4 }}/>
        <select value={filtreStatut} onChange={e => setFS(e.target.value)} style={{ ...inp, width: 160 }}>
          {['Tous', ...STATUTS].map(s => <option key={s}>{s}</option>)}
        </select>
        <select value={filtreSecteur} onChange={e => setFSect(e.target.value)} style={{ ...inp, width: 180 }}>
          {secteurs.map(s => <option key={s}>{s}</option>)}
        </select>
        <span style={{ fontSize: 11, color: p.text4, marginLeft: 'auto' }}>{filtres.length} fournisseur{filtres.length > 1 ? 's' : ''}</span>
      </div>

      {/* ── Table ────────────────────────────────────────────────────────────── */}
      <div className="glass-panel overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-32"><RefreshCw size={24} className="animate-spin" style={{ color: p.blue }}/></div>
        ) : filtres.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 gap-3">
            <ShoppingCart size={36} style={{ color: p.text4 }}/>
            <p style={{ color: p.text3, fontSize: 13 }}>Aucun fournisseur enregistré</p>
            <WriteOnly><button onClick={() => setShowForm(true)} className="btn-primary text-sm"><Plus size={14}/> Ajouter</button></WriteOnly>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: p.bgCard2, borderBottom: '1px solid ' + p.border }}>
                <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: p.text4, textTransform: 'uppercase', letterSpacing: '0.06em', width: 30 }}></th>
                <SortTh col="nom"     sortKey={sortKey} sortDir={sortDir} toggle={toggle} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: p.text4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Fournisseur</SortTh>
                <SortTh col="secteur" sortKey={sortKey} sortDir={sortDir} toggle={toggle} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: p.text4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Secteur</SortTh>
                <SortTh col="statut"  sortKey={sortKey} sortDir={sortDir} toggle={toggle} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: p.text4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Statut</SortTh>
                <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: p.text4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Qualité</th>
                <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: p.text4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Délai</th>
                <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: p.text4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Prix</th>
                <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: p.text4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Service</th>
                <SortTh col="_score"  sortKey={sortKey} sortDir={sortDir} toggle={toggle} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: p.text4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Score</SortTh>
                <th style={{ padding: '10px 14px', width: 80 }}></th>
              </tr>
            </thead>
            <tbody>
              {sorted.filter(f => filtres.some(ff => ff.id === f.id)).map((row, idx) => {
                const st = STATUT_STYLE[row.statut] || STATUT_STYLE['En évaluation'];
                const score = row._score || calcScore(row);
                const isOpen = expanded === row.id;
                return (
                  <React.Fragment key={row.id}>
                    <tr style={{ borderBottom: '1px solid ' + p.border, background: idx % 2 === 0 ? 'transparent' : p.whiteFaint2 }}>
                      <td style={{ padding: '8px 14px' }}>
                        <button
                          onClick={() => setExpanded(isOpen ? null : row.id)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: p.text4, fontSize: 16, display: 'flex', padding: 0 }}
                          title="Détails / Modifier"
                        >
                          {isOpen ? '▾' : '▸'}
                        </button>
                      </td>
                      <td style={{ padding: '8px 14px' }}>
                        <input
                          value={row.nom || ''}
                          onChange={e => updateRow(row.id, 'nom', e.target.value)}
                          onBlur={() => saveRow(row)}
                          style={{ ...inp, fontWeight: 700 }}
                        />
                        {row.contact && <div style={{ fontSize: 11, color: p.text4, marginTop: 2 }}>{row.contact}</div>}
                      </td>
                      <td style={{ padding: '8px 14px' }}>
                        <select value={row.secteur || ''} onChange={e => { updateRow(row.id, 'secteur', e.target.value); setTimeout(() => saveRow({ ...row, secteur: e.target.value }), 100); }} style={inp}>
                          {SECTEURS.map(s => <option key={s}>{s}</option>)}
                        </select>
                      </td>
                      <td style={{ padding: '8px 14px' }}>
                        <select value={row.statut || ''} onChange={e => { updateRow(row.id, 'statut', e.target.value); setTimeout(() => saveRow({ ...row, statut: e.target.value }), 100); }} style={{ ...inp, color: st.color, fontWeight: 700, background: st.bg, borderColor: st.border }}>
                          {STATUTS.map(s => <option key={s}>{s}</option>)}
                        </select>
                      </td>
                      <td style={{ padding: '8px 14px' }}>
                        <EtoileNote val={Number(row.note_qualite || 0)} onChange={v => { updateRow(row.id, 'note_qualite', v); setTimeout(() => saveRow({ ...row, note_qualite: v }), 100); }} size={14}/>
                      </td>
                      <td style={{ padding: '8px 14px' }}>
                        <EtoileNote val={Number(row.note_delai || 0)} onChange={v => { updateRow(row.id, 'note_delai', v); setTimeout(() => saveRow({ ...row, note_delai: v }), 100); }} size={14}/>
                      </td>
                      <td style={{ padding: '8px 14px' }}>
                        <EtoileNote val={Number(row.note_prix || 0)} onChange={v => { updateRow(row.id, 'note_prix', v); setTimeout(() => saveRow({ ...row, note_prix: v }), 100); }} size={14}/>
                      </td>
                      <td style={{ padding: '8px 14px' }}>
                        <EtoileNote val={Number(row.note_service || 0)} onChange={v => { updateRow(row.id, 'note_service', v); setTimeout(() => saveRow({ ...row, note_service: v }), 100); }} size={14}/>
                      </td>
                      <td style={{ padding: '8px 14px' }}>
                        <JaugeScore score={score}/>
                      </td>
                      <td style={{ padding: '8px 14px' }}>
                        <div style={{ display: 'flex', gap: 5, justifyContent: 'flex-end' }}>
                          <WriteOnly>
                            <button onClick={() => saveRow(row)} title="Sauvegarder" style={{ padding: '5px 8px', background: p.bgCard2, border: '1px solid ' + p.border, borderRadius: 6, cursor: 'pointer', color: p.blue, display: 'flex' }}>
                              {saving === row.id ? <RefreshCw size={14} className="animate-spin"/> : <Save size={14}/>}
                            </button>
                            <button onClick={() => setConfirm({ message: `Supprimer "${row.nom}" du panel fournisseurs ?`, onConfirm: () => deleteRow(row.id) })} style={{ padding: '5px 8px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 6, cursor: 'pointer', color: '#EF4444', display: 'flex' }}>
                              <Trash2 size={14}/>
                            </button>
                          </WriteOnly>
                        </div>
                      </td>
                    </tr>

                    {/* Ligne détail */}
                    {isOpen && (
                      <tr style={{ borderBottom: '1px solid ' + p.border }}>
                        <td colSpan={10} style={{ padding: '14px 20px', background: isDark ? 'rgba(79,99,231,0.05)' : 'rgba(79,99,231,0.03)' }}>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
                            <div>
                              <label style={lbl}>Contact</label>
                              <input value={row.contact || ''} onChange={e => updateRow(row.id, 'contact', e.target.value)} onBlur={() => saveRow(row)} style={inp} placeholder="Nom / Email / Tél"/>
                            </div>
                            <div>
                              <label style={lbl}>Date d'évaluation</label>
                              <input type="date" value={row.date_eval || ''} onChange={e => updateRow(row.id, 'date_eval', e.target.value)} onBlur={() => saveRow(row)} style={inp}/>
                            </div>
                            <div>
                              <label style={lbl}>Note conformité réglementaire</label>
                              <EtoileNote val={Number(row.note_conformite || 0)} onChange={v => { updateRow(row.id, 'note_conformite', v); setTimeout(() => saveRow({ ...row, note_conformite: v }), 100); }} size={18}/>
                            </div>
                            <div style={{ gridColumn: '1 / -1' }}>
                              <label style={lbl}>Commentaire / Observations</label>
                              <textarea value={row.commentaire || ''} onChange={e => updateRow(row.id, 'commentaire', e.target.value)} onBlur={() => saveRow(row)} style={{ ...inp, minHeight: 60, resize: 'vertical' }} placeholder="Points forts, axes d'amélioration, actions en cours…"/>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Formulaire ajout ─────────────────────────────────────────────────── */}
      {showForm && (
        <div
          onClick={e => { if (e.target === e.currentTarget) setShowForm(false); }}
          style={{ position: 'fixed', inset: 0, zIndex: 99999, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
        >
          <div style={{ background: p.bgCard2, border: '1px solid ' + p.border2, borderRadius: 16, width: '100%', maxWidth: 600, boxShadow: '0 32px 80px rgba(0,0,0,0.4)', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid ' + p.border, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: p.text1, display: 'flex', alignItems: 'center', gap: 8 }}>
                <ShoppingCart size={16} color={p.blue}/> Nouveau fournisseur
              </div>
              <button onClick={() => setShowForm(false)} style={{ background: p.whiteFaint, border: '1px solid ' + p.border, borderRadius: 8, color: p.text3, cursor: 'pointer', padding: '5px 7px', display: 'flex' }}>
                <X size={14}/>
              </button>
            </div>
            <div style={{ padding: 20, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={lbl}>Nom du fournisseur *</label>
                <input value={form.nom} onChange={e => setForm(f => ({ ...f, nom: e.target.value }))} style={inp} placeholder="Ex : Société XYZ"/>
              </div>
              <div>
                <label style={lbl}>Contact</label>
                <input value={form.contact} onChange={e => setForm(f => ({ ...f, contact: e.target.value }))} style={inp} placeholder="Nom / email"/>
              </div>
              <div>
                <label style={lbl}>Secteur</label>
                <select value={form.secteur} onChange={e => setForm(f => ({ ...f, secteur: e.target.value }))} style={inp}>
                  {SECTEURS.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>Statut initial</label>
                <select value={form.statut} onChange={e => setForm(f => ({ ...f, statut: e.target.value }))} style={inp}>
                  {STATUTS.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>Date d'évaluation</label>
                <input type="date" value={form.date_eval} onChange={e => setForm(f => ({ ...f, date_eval: e.target.value }))} style={inp}/>
              </div>

              <div style={{ gridColumn: '1 / -1' }}>
                <label style={lbl}>Notes initiales (optionnel)</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10 }}>
                  {CRITERES.map(c => (
                    <div key={c.key} style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 10, color: p.text4, marginBottom: 5, lineHeight: 1.3 }}>{c.label}</div>
                      <EtoileNote val={form[c.key]} onChange={v => setForm(f => ({ ...f, [c.key]: v }))} size={16}/>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ gridColumn: '1 / -1' }}>
                <label style={lbl}>Commentaire</label>
                <textarea value={form.commentaire} onChange={e => setForm(f => ({ ...f, commentaire: e.target.value }))} style={{ ...inp, minHeight: 60, resize: 'vertical' }} placeholder="Observations, conditions d'approbation…"/>
              </div>
            </div>
            <div style={{ padding: '12px 20px', borderTop: '1px solid ' + p.border, display: 'flex', gap: 8, justifyContent: 'flex-end', background: p.whiteFaint2 }}>
              <button onClick={() => setShowForm(false)} style={{ padding: '8px 18px', background: p.whiteFaint, border: '1px solid ' + p.border, borderRadius: 8, color: p.text2, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                Annuler
              </button>
              <button onClick={ajouterFournisseur} style={{ padding: '8px 20px', background: p.blue, color: 'white', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Plus size={14}/> Ajouter
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal config={confirm} onClose={() => setConfirm(null)}/>
    </div>
  );
}
