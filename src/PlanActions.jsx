import { useTheme } from './ThemeContext';
import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Plus, Trash2, RefreshCw, Filter, CheckCircle, AlertTriangle,
  Clock, Target, Save, X, TrendingUp, Euro
} from 'lucide-react';
import { supabase } from './supabaseClient';
import GestionListes from './GestionListes';
import { useToast } from './Toast';

/* ─── Référentiels ──────────────────────────────────────────────────────────── */
const ORIGINES = [
  'DUERP', 'Audit interne', 'Audit de certification', 'Accident du travail',
  "Presqu'accident / Incident", 'Non-conformité', 'Réclamation client',
  'Revue de Direction', 'Veille réglementaire', 'Indicateur hors objectif',
  'Suggestion terrain', 'Exercice urgence', 'Autre',
];

const DOMAINES_DEFAULT = ['Qualité', 'Sécurité', 'Environnement', 'Énergie', 'RH / Social', 'RSE / Transverse'];

const TYPES_ACTION = ['Corrective', 'Préventive', 'Amélioration', 'Réglementaire'];

const PRIORITES = ['🔴 Urgente', '🟠 Haute', '🟡 Normale', '🟢 Basse'];

const STATUTS = ['À lancer', 'En cours', 'En attente', 'Terminé', 'Annulé'];

const RESULTATS_EFFICACITE = ['Non évalué', 'Efficace', 'Partiellement efficace', 'Non efficace'];

/* ─── Couleurs ──────────────────────────────────────────────────────────────── */
const DOMAINE_COLOR = {
  'Qualité':          '#3B82F6',
  'Sécurité':         '#EF4444',
  'Environnement':    '#10B981',
  'Énergie':          '#F59E0B',
  'RH / Social':      '#8B5CF6',
  'RSE / Transverse': '#06B6D4',
};

const TYPE_COLOR = {
  'Corrective':    { color: '#EF4444', bg: 'rgba(239,68,68,0.12)',   border: 'rgba(239,68,68,0.3)'   },
  'Préventive':    { color: '#3B82F6', bg: 'rgba(59,130,246,0.12)',  border: 'rgba(59,130,246,0.3)'  },
  'Amélioration':  { color: '#10B981', bg: 'rgba(16,185,129,0.12)',  border: 'rgba(16,185,129,0.3)'  },
  'Réglementaire': { color: '#8B5CF6', bg: 'rgba(139,92,246,0.12)', border: 'rgba(139,92,246,0.3)'  },
};

const TYPE_COLOR_LIGHT = {
  'Corrective':    { color: '#991B1B', bg: '#FEF2F2', border: '#FECACA' },
  'Préventive':    { color: '#1D4ED8', bg: '#EFF6FF', border: '#BFDBFE' },
  'Amélioration':  { color: '#047857', bg: '#ECFDF5', border: '#A7F3D0' },
  'Réglementaire': { color: '#6D28D9', bg: '#F5F3FF', border: '#DDD6FE' },
};

function getStatutStyle(statut, isDark) {
  const map = {
    'À lancer':    { color: isDark ? '#EF4444' : '#B91C1C', bg: isDark ? 'rgba(239,68,68,0.12)'   : '#FEF2F2', border: isDark ? 'rgba(239,68,68,0.3)'   : '#FECACA' },
    'En cours':    { color: isDark ? '#F97316' : '#9A3412', bg: isDark ? 'rgba(249,115,22,0.12)'  : '#FFEDD5', border: isDark ? 'rgba(249,115,22,0.3)'  : '#FB923C' },
    'En attente':  { color: isDark ? '#A78BFA' : '#6D28D9', bg: isDark ? 'rgba(139,92,246,0.12)'  : '#F5F3FF', border: isDark ? 'rgba(139,92,246,0.3)'  : '#DDD6FE' },
    'Terminé':     { color: isDark ? '#34D399' : '#047857', bg: isDark ? 'rgba(16,185,129,0.12)'  : '#ECFDF5', border: isDark ? 'rgba(16,185,129,0.3)'  : '#A7F3D0' },
    'Annulé':      { color: isDark ? '#94A3B8' : '#475569', bg: isDark ? 'rgba(100,116,139,0.12)' : '#F1F5F9', border: isDark ? 'rgba(100,116,139,0.3)' : '#CBD5E1' },
  };
  return map[statut] || map['À lancer'];
}

function getPrioriteColor(priorite) {
  if (priorite?.includes('Urgente')) return '#EF4444';
  if (priorite?.includes('Haute'))   return '#F97316';
  if (priorite?.includes('Normale')) return '#F59E0B';
  return '#10B981';
}

/* ─── Utilitaires date ──────────────────────────────────────────────────────── */
function diffJours(date) {
  if (!date) return null;
  return Math.ceil((new Date(date) - new Date()) / 86400000);
}

function BadgeEcheance({ echeance, statut }) {
  if (!echeance || statut === 'Terminé' || statut === 'Annulé') return null;
  const j = diffJours(echeance);
  if (j === null) return null;
  let color, label;
  if (j < 0)       { color = '#EF4444'; label = `${Math.abs(j)}j retard`; }
  else if (j <= 7) { color = '#F59E0B'; label = `${j}j restants`; }
  else if (j <= 30){ color = '#3B82F6'; label = `${j}j`; }
  else return <span style={{ fontSize: 10, color: '#94A3B8' }}>{echeance}</span>;
  return (
    <span style={{ fontSize: 10, fontWeight: 700, color, background: `${color}15`, border: `1px solid ${color}40`, padding: '2px 7px', borderRadius: 100, display: 'inline-block', marginTop: 3 }}>
      {label}
    </span>
  );
}

/* ─── Barre de progression ──────────────────────────────────────────────────── */
function ProgressBar({ pct, statut, isDark }) {
  const val = Number(pct || 0);
  const color = statut === 'Terminé' ? '#10B981' : statut === 'Annulé' ? '#64748B' : val >= 75 ? '#10B981' : val >= 40 ? '#3B82F6' : '#F59E0B';
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color }}>{val}%</span>
      </div>
      <div style={{ height: 5, background: isDark ? 'rgba(255,255,255,0.08)' : '#E2E8F0', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${val}%`, background: color, borderRadius: 3, transition: 'width 0.3s' }}/>
      </div>
    </div>
  );
}

/* ─── Formulaire par défaut ─────────────────────────────────────────────────── */
const mkForm = (domaines, origines) => ({
  origine:     origines[0],
  reference_source: '',
  domaine:     domaines[0],
  type_action: 'Corrective',
  action:      '',
  cause_racine:'',
  pilote:      '',
  echeance:    new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
  date_cible_revisee: '',
  priorite:    PRIORITES[2],
  statut:      'À lancer',
  avancement_pct: 0,
  cout_estime: '',
  cout_reel:   '',
  date_verification_efficacite: '',
  resultat_efficacite: 'Non évalué',
  commentaire: '',
});

/* ══════════════════════════════════════════════════════════════════════════════ */
export default function PlanActions() {
  const { p, isDark } = useTheme();
  const { toast } = useToast();
  const [actions, setActions]       = useState([]);
  const [listeDomaines, setDomaines]= useState(DOMAINES_DEFAULT);
  const [loading, setLoading]       = useState(true);
  const [saving, setSaving]         = useState(null);
  const [showForm, setShowForm]     = useState(false);
  const [filtreDomaine, setFD]      = useState('Tous');
  const [filtreStatut, setFS]       = useState('Tous');
  const [filtreType, setFT]         = useState('Tous');
  const [filtreRetard, setFR]       = useState(false);
  const [form, setForm]             = useState(() => mkForm(DOMAINES_DEFAULT, ORIGINES));
  const [saveError, setSaveError]   = useState('');
  const actionsRef                  = useRef(actions);
  useEffect(() => { actionsRef.current = actions; }, [actions]);

  useEffect(() => { fetchActions(); }, []);

  /* ── Fetch ──────────────────────────────────────────────────────────────── */
  const fetchActions = async () => {
    setLoading(true);
    const { data } = await supabase.from('plan_actions').select('*').order('id', { ascending: true });
    if (data) setActions(data);
    setLoading(false);
  };

  /* ── Update local ───────────────────────────────────────────────────────── */
  const updateRow = (id, field, value) =>
    setActions(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));

  /* ── Save Supabase ──────────────────────────────────────────────────────── */
  const saveRowDirect = async (row) => {
    if (!row) return;
    setSaving(row.id);
    await supabase.from('plan_actions').update({
      origine: row.origine, reference_source: row.reference_source,
      domaine: row.domaine, type_action: row.type_action,
      action: row.action, cause_racine: row.cause_racine,
      pilote: row.pilote, echeance: row.echeance || null,
      date_cible_revisee: row.date_cible_revisee || null,
      priorite: row.priorite, statut: row.statut,
      avancement_pct: Number(row.avancement_pct || 0),
      cout_estime: row.cout_estime || null,
      cout_reel: row.cout_reel || null,
      date_verification_efficacite: row.date_verification_efficacite || null,
      resultat_efficacite: row.resultat_efficacite,
      commentaire: row.commentaire,
    }).eq('id', row.id);
    setSaving(null);
  };

  const saveRowById = (id) => {
    const row = actionsRef.current.find(r => r.id === id);
    if (row) saveRowDirect(row);
  };

  /* ── Ajout ──────────────────────────────────────────────────────────────── */
  const ajouterAction = async () => {
    if (!form.action.trim()) return;
    setSaveError('');
    // Seuls les champs garantis en base (colonnes originales + nouvelles si migration faite)
    const toInsert = {
      origine: form.origine,
      domaine: form.domaine,
      action: form.action,
      pilote: form.pilote,
      echeance: form.echeance || null,
      priorite: form.priorite,
      statut: form.statut,
      commentaire: form.commentaire,
    };
    // Champs issus de la migration — ajoutés si disponibles
    const extraFields = {
      reference_source: form.reference_source || null,
      type_action: form.type_action || null,
      cause_racine: form.cause_racine || null,
      date_cible_revisee: form.date_cible_revisee || null,
      avancement_pct: Number(form.avancement_pct || 0),
      cout_estime: form.cout_estime || null,
      cout_reel: form.cout_reel || null,
      date_verification_efficacite: form.date_verification_efficacite || null,
      resultat_efficacite: form.resultat_efficacite || null,
    };
    const { data, error } = await supabase.from('plan_actions').insert([{ ...toInsert, ...extraFields }]).select();
    if (error) {
      setSaveError(`Erreur : ${error.message}`);
      toast({ message: `Erreur : ${error.message}`, type: 'error' });
      return;
    }
    if (data?.[0]) {
      setActions(prev => [...prev, data[0]]);
      setShowForm(false);
      setForm(mkForm(listeDomaines, ORIGINES));
      toast({ message: 'Action ajoutée au plan', type: 'success' });
    }
  };

  /* ── Suppression ────────────────────────────────────────────────────────── */
  const deleteRow = async (id) => {
    if (!window.confirm('Supprimer cette action ?')) return;
    await supabase.from('plan_actions').delete().eq('id', id);
    setActions(prev => prev.filter(r => r.id !== id));
    toast({ message: 'Action supprimée', type: 'info' });
  };

  /* ── KPIs ───────────────────────────────────────────────────────────────── */
  const kpis = useMemo(() => {
    const actives   = actions.filter(a => a.statut !== 'Annulé');
    const terminees = actions.filter(a => a.statut === 'Terminé');
    const retard    = actives.filter(a => a.statut !== 'Terminé' && diffJours(a.echeance) < 0);
    const urgentes  = actives.filter(a => a.priorite?.includes('Urgente') && a.statut !== 'Terminé');
    const budgetE   = actions.reduce((s, a) => s + (Number(a.cout_estime) || 0), 0);
    const budgetR   = actions.reduce((s, a) => s + (Number(a.cout_reel)   || 0), 0);
    const taux      = actives.length > 0 ? Math.round((terminees.length / actives.length) * 100) : 0;
    return { total: actions.length, terminees: terminees.length, retard: retard.length, urgentes: urgentes.length, taux, budgetE, budgetR };
  }, [actions]);

  /* ── Filtres ────────────────────────────────────────────────────────────── */
  const actionsFiltrees = useMemo(() => actions.filter(a => {
    if (filtreDomaine !== 'Tous' && a.domaine      !== filtreDomaine) return false;
    if (filtreStatut  !== 'Tous' && a.statut       !== filtreStatut)  return false;
    if (filtreType    !== 'Tous' && a.type_action  !== filtreType)    return false;
    if (filtreRetard  && !(diffJours(a.echeance) < 0 && a.statut !== 'Terminé' && a.statut !== 'Annulé')) return false;
    return true;
  }), [actions, filtreDomaine, filtreStatut, filtreType, filtreRetard]);

  /* ── Styles helpers ─────────────────────────────────────────────────────── */
  const inp = { padding: '5px 8px', fontSize: 12, background: p.bgInput, border: '1px solid ' + p.borderInput, borderRadius: 6, color: p.text1, fontFamily: 'inherit', outline: 'none', width: '100%' };
  const lbl = { fontSize: 10, fontWeight: 700, color: p.text4, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 4 };

  /* ══════════════════════════════════════════════════════════════════════════ */
  return (
    <div className="space-y-5 pb-10">

      {/* ── En-tête ─────────────────────────────────────────────────────────── */}
      <header className="page-header">
        <div>
          <h2 className="page-title flex items-center gap-3"><Target size={26} className="text-blue-400"/> Plan d'Actions Global</h2>
          <p className="page-subtitle">Actions correctives, préventives et d'amélioration — PDCA</p>
        </div>
        <div className="flex gap-3">
          <GestionListes
            listes={{ 'Domaines': listeDomaines }}
            onSave={(key, list) => { if (key === 'Domaines') setDomaines(list); }}
            storageKey="plan_actions"
          />
          <button onClick={fetchActions} className="btn-secondary"><RefreshCw size={16} className={loading ? 'animate-spin' : ''}/> Actualiser</button>
          <button onClick={() => setShowForm(true)} className="btn-primary"><Plus size={16}/> Nouvelle action</button>
        </div>
      </header>

      {/* ── KPIs ────────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: 'Total actions',     val: kpis.total,     color: 'blue',  sub: 'Plan complet' },
          { label: 'Terminées',         val: kpis.terminees, color: 'green', sub: `Taux : ${kpis.taux}%` },
          { label: 'En retard',         val: kpis.retard,    color: kpis.retard   > 0 ? 'red'   : 'green', sub: 'Échéances dépassées' },
          { label: 'Urgentes ouvertes', val: kpis.urgentes,  color: kpis.urgentes > 0 ? 'amber' : 'green', sub: 'Priorité 1' },
          { label: 'Budget engagé',     val: kpis.budgetE > 0 ? `${kpis.budgetE.toLocaleString('fr-FR')} €` : '—', color: 'purple', sub: kpis.budgetR > 0 ? `Réel : ${kpis.budgetR.toLocaleString('fr-FR')} €` : 'Aucun budget saisi' },
        ].map((k, i) => (
          <div key={i} className={`kpi-card ${k.color}`}>
            <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: p.text3 }}>{k.label}</p>
            <p className="font-black" style={{ fontSize: typeof k.val === 'string' ? 15 : 34, color: p.text1, lineHeight: 1.1 }}>{k.val}</p>
            {i === 1 && (
              <div style={{ height: 3, background: isDark ? 'rgba(255,255,255,0.08)' : '#E2E8F0', borderRadius: 2, margin: '8px 0 4px' }}>
                <div style={{ height: '100%', width: `${kpis.taux}%`, background: '#10B981', borderRadius: 2 }}/>
              </div>
            )}
            <p className="text-xs mt-2" style={{ color: p.text4 }}>{k.sub}</p>
          </div>
        ))}
      </div>

      {/* ── Alertes ─────────────────────────────────────────────────────────── */}
      {kpis.retard > 0 && (
        <div className="alert-banner alert-red">
          <AlertTriangle size={18} className="shrink-0"/>
          <div>
            <p className="font-bold">{kpis.retard} action{kpis.retard > 1 ? 's' : ''} en retard — Traitement prioritaire requis</p>
            <button onClick={() => setFR(true)} style={{ fontSize: 11, background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline', opacity: 0.8, color: 'inherit', fontFamily: 'inherit', padding: 0, marginTop: 2 }}>
              Afficher uniquement les actions en retard
            </button>
          </div>
        </div>
      )}
      {kpis.urgentes > 0 && (
        <div className="alert-banner alert-amber">
          <Clock size={18} className="shrink-0"/>
          <p className="font-bold">{kpis.urgentes} action{kpis.urgentes > 1 ? 's' : ''} urgente{kpis.urgentes > 1 ? 's' : ''} en cours sans clôture</p>
        </div>
      )}

      {/* ── Formulaire d'ajout ──────────────────────────────────────────────── */}
      {showForm && (
        <div className="glass-panel p-6 animate-fade-up" style={{ border: '1px solid rgba(59,130,246,0.3)' }}>
          <div className="flex justify-between items-center mb-5">
            <h3 className="font-bold text-lg flex items-center gap-2" style={{ color: p.text1 }}>
              <Plus size={18} style={{ color: p.blue }}/> Nouvelle action
            </h3>
            <button onClick={() => setShowForm(false)} style={{ color: p.text4, background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}><X size={18}/></button>
          </div>

          {/* ① Identification */}
          <div style={{ background: p.whiteFaint2, border: '1px solid ' + p.border, borderRadius: 10, padding: '14px 16px', marginBottom: 14 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: p.blue, marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.06em' }}>① Identification & Origine</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label style={lbl}>Source de l'action</label>
                <select value={form.origine} onChange={e => setForm({ ...form, origine: e.target.value })} className="input-modern">
                  {ORIGINES.map(o => <option key={o}>{o}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>Référence source</label>
                <input type="text" value={form.reference_source} onChange={e => setForm({ ...form, reference_source: e.target.value })} placeholder="Ex: DUERP-2025-PROD-0012, NC-007..." className="input-modern"/>
              </div>
              <div>
                <label style={lbl}>Domaine QHSE</label>
                <select value={form.domaine} onChange={e => setForm({ ...form, domaine: e.target.value })} className="input-modern">
                  {listeDomaines.map(d => <option key={d}>{d}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>Type d'action</label>
                <div style={{ display: 'flex', gap: 6 }}>
                  {TYPES_ACTION.map(t => {
                    const tc = isDark ? TYPE_COLOR[t] : TYPE_COLOR_LIGHT[t];
                    const sel = form.type_action === t;
                    return (
                      <button key={t} onClick={() => setForm({ ...form, type_action: t })}
                        style={{ flex: 1, padding: '6px 4px', borderRadius: 6, border: `1.5px solid ${sel ? tc.border : p.border}`, background: sel ? tc.bg : p.bgInput, color: sel ? tc.color : p.text3, fontSize: 10, fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s', textAlign: 'center' }}>
                        {t}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* ② Description & Déploiement */}
          <div style={{ background: p.whiteFaint2, border: '1px solid ' + p.border, borderRadius: 10, padding: '14px 16px', marginBottom: 14 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: p.amber, marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.06em' }}>② Description & Déploiement</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label style={lbl}>Description de l'action *</label>
                <input type="text" value={form.action} onChange={e => setForm({ ...form, action: e.target.value })} placeholder="Décrivez précisément l'action à mener..." className="input-modern"/>
              </div>
              <div>
                <label style={lbl}>Cause racine identifiée</label>
                <input type="text" value={form.cause_racine} onChange={e => setForm({ ...form, cause_racine: e.target.value })} placeholder="Résultat 5 Pourquoi, Ishikawa..." className="input-modern"/>
              </div>
              <div>
                <label style={lbl}>Pilote</label>
                <input type="text" value={form.pilote} onChange={e => setForm({ ...form, pilote: e.target.value })} placeholder="Responsable de l'action..." className="input-modern"/>
              </div>
              <div className="md:col-span-2">
                <label style={lbl}>Commentaire / Contexte</label>
                <input type="text" value={form.commentaire} onChange={e => setForm({ ...form, commentaire: e.target.value })} placeholder="Informations complémentaires..." className="input-modern"/>
              </div>
            </div>
          </div>

          {/* ③ Suivi temporel */}
          <div style={{ background: p.whiteFaint2, border: '1px solid ' + p.border, borderRadius: 10, padding: '14px 16px', marginBottom: 14 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: p.purple, marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.06em' }}>③ Suivi temporel & Statut</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label style={lbl}>Échéance initiale</label>
                <input type="date" value={form.echeance} onChange={e => setForm({ ...form, echeance: e.target.value })} className="input-modern"/>
              </div>
              <div>
                <label style={lbl}>Priorité</label>
                <select value={form.priorite} onChange={e => setForm({ ...form, priorite: e.target.value })} className="input-modern">
                  {PRIORITES.map(pr => <option key={pr}>{pr}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>Statut initial</label>
                <select value={form.statut} onChange={e => setForm({ ...form, statut: e.target.value })} className="input-modern">
                  {STATUTS.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>Avancement (%)</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <input type="range" min="0" max="100" step="5" value={form.avancement_pct}
                    onChange={e => setForm({ ...form, avancement_pct: Number(e.target.value) })}
                    style={{ flex: 1 }}/>
                  <span style={{ fontSize: 14, fontWeight: 800, color: p.text1, minWidth: 36 }}>{form.avancement_pct}%</span>
                </div>
              </div>
            </div>
          </div>

          {/* ④ Budget (optionnel) */}
          <div style={{ background: p.whiteFaint2, border: '1px solid ' + p.border, borderRadius: 10, padding: '14px 16px', marginBottom: 14 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: p.green, marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.06em' }}>④ Budget (optionnel)</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label style={lbl}>Coût estimé (€)</label>
                <input type="number" min="0" value={form.cout_estime} onChange={e => setForm({ ...form, cout_estime: e.target.value })} placeholder="0,00" className="input-modern"/>
              </div>
              <div>
                <label style={lbl}>Coût réel (€)</label>
                <input type="number" min="0" value={form.cout_reel} onChange={e => setForm({ ...form, cout_reel: e.target.value })} placeholder="À renseigner à la clôture" className="input-modern"/>
              </div>
              <div>
                <label style={lbl}>Vérification efficacité</label>
                <input type="date" value={form.date_verification_efficacite} onChange={e => setForm({ ...form, date_verification_efficacite: e.target.value })} className="input-modern"/>
              </div>
            </div>
          </div>

          {saveError && (
            <div className="alert-banner alert-red mb-3">
              <AlertTriangle size={15} className="shrink-0"/>
              <p style={{ fontSize: 13 }}>{saveError}</p>
            </div>
          )}
          <div className="flex gap-3">
            <button onClick={() => { setShowForm(false); setSaveError(''); }} className="btn-secondary">Annuler</button>
            <button onClick={ajouterAction} disabled={!form.action.trim()} className="btn-primary">
              <Save size={16}/> Enregistrer l'action
            </button>
          </div>
        </div>
      )}

      {/* ── Filtres ─────────────────────────────────────────────────────────── */}
      <div className="glass-panel p-4 flex flex-wrap gap-2 items-center">
        <Filter size={15} style={{ color: p.text4 }} className="shrink-0"/>

        {/* Filtre domaine */}
        {['Tous', ...listeDomaines].map(d => {
          const col = DOMAINE_COLOR[d] || p.blue;
          return (
            <button key={d} onClick={() => setFD(d)} style={{ fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 100, border: '1px solid', cursor: 'pointer', transition: 'all 0.12s',
              background:  filtreDomaine === d ? `${col}20` : p.whiteFaint2,
              borderColor: filtreDomaine === d ? `${col}50` : p.border,
              color:       filtreDomaine === d ? col : p.text3 }}>{d}</button>
          );
        })}

        <div style={{ width: 1, height: 16, background: p.border }}/>

        {/* Filtre type */}
        {['Tous', ...TYPES_ACTION].map(t => {
          const tc = isDark ? (TYPE_COLOR[t] || { color: p.blue, bg: p.whiteFaint2, border: p.border }) : (TYPE_COLOR_LIGHT[t] || { color: p.blue, bg: p.whiteFaint2, border: p.border });
          return (
            <button key={t} onClick={() => setFT(t)} style={{ fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 100, border: '1px solid', cursor: 'pointer', transition: 'all 0.12s',
              background:  filtreType === t ? tc.bg     : p.whiteFaint2,
              borderColor: filtreType === t ? tc.border : p.border,
              color:       filtreType === t ? tc.color  : p.text3 }}>{t}</button>
          );
        })}

        <div style={{ width: 1, height: 16, background: p.border }}/>

        {/* Filtre statut */}
        {['Tous', ...STATUTS].map(s => {
          const st = getStatutStyle(s, isDark);
          return (
            <button key={s} onClick={() => setFS(s)} style={{ fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 100, border: '1px solid', cursor: 'pointer', transition: 'all 0.12s',
              background:  filtreStatut === s ? st.bg     : p.whiteFaint2,
              borderColor: filtreStatut === s ? st.border : p.border,
              color:       filtreStatut === s ? st.color  : p.text3 }}>
              {s === 'Tous' ? 'Tous statuts' : s}
            </button>
          );
        })}

        {/* Filtre retard */}
        <button onClick={() => setFR(!filtreRetard)} style={{ fontSize: 11, fontWeight: 700, padding: '4px 12px', borderRadius: 100, border: '1px solid', cursor: 'pointer',
          background:  filtreRetard ? 'rgba(239,68,68,0.15)' : p.whiteFaint2,
          borderColor: filtreRetard ? 'rgba(239,68,68,0.4)'  : p.border,
          color:       filtreRetard ? '#EF4444' : p.text3 }}>⏰ En retard</button>

        {(filtreDomaine !== 'Tous' || filtreStatut !== 'Tous' || filtreType !== 'Tous' || filtreRetard) && (
          <button onClick={() => { setFD('Tous'); setFS('Tous'); setFT('Tous'); setFR(false); }}
            style={{ color: p.text4, background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, display: 'flex', alignItems: 'center', gap: 4, marginLeft: 'auto', fontFamily: 'inherit' }}>
            <X size={12}/> Reset
          </button>
        )}
        <span style={{ color: p.text4, fontSize: 11, marginLeft: 'auto' }}>{actionsFiltrees.length} action{actionsFiltrees.length > 1 ? 's' : ''}</span>
      </div>

      {/* ── Tableau ─────────────────────────────────────────────────────────── */}
      <div className="glass-panel">
        {loading ? (
          <div className="p-10 text-center"><RefreshCw size={28} className="animate-spin text-blue-400 mx-auto mb-3"/><p style={{ color: p.text3 }}>Chargement...</p></div>
        ) : actionsFiltrees.length === 0 ? (
          <div className="p-10 text-center">
            <CheckCircle size={36} className="text-emerald-400 mx-auto mb-3"/>
            <p className="font-bold" style={{ color: p.text1 }}>{actions.length === 0 ? 'Aucune action. Cliquez sur "Nouvelle action".' : 'Aucune action pour ces filtres.'}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table-modern" style={{ minWidth: 980 }}>
              <thead>
                <tr>
                  <th style={{ width: 110 }}>Domaine / Type</th>
                  <th style={{ minWidth: 200 }}>Description</th>
                  <th style={{ width: 110 }}>Pilote</th>
                  <th style={{ width: 120 }}>Échéance</th>
                  <th style={{ width: 120 }}>Avancement</th>
                  <th style={{ width: 120 }}>Priorité</th>
                  <th style={{ width: 130 }}>Statut</th>
                  <th style={{ width: 40 }}/>
                </tr>
              </thead>
              <tbody>
                {actionsFiltrees.map(row => {
                  const st     = getStatutStyle(row.statut, isDark);
                  const tc     = isDark ? (TYPE_COLOR[row.type_action] || TYPE_COLOR['Corrective']) : (TYPE_COLOR_LIGHT[row.type_action] || TYPE_COLOR_LIGHT['Corrective']);
                  const dColor = DOMAINE_COLOR[row.domaine] || p.blue;
                  const j      = diffJours(row.echeance);
                  const isRet  = j !== null && j < 0 && row.statut !== 'Terminé' && row.statut !== 'Annulé';
                  const pColor = getPrioriteColor(row.priorite);

                  return (
                    <tr key={row.id} style={{ borderLeft: `3px solid ${isRet ? '#EF4444' : st.color}` }}>

                      {/* Domaine / Type */}
                      <td>
                        <select value={row.domaine || listeDomaines[0]}
                          onChange={e => {
                            const v = e.target.value;
                            updateRow(row.id, 'domaine', v);
                            saveRowDirect({ ...actionsRef.current.find(r => r.id === row.id), domaine: v });
                          }}
                          style={{ background: `${dColor}18`, color: dColor, border: `1px solid ${dColor}40`, borderRadius: 6, padding: '4px 6px', fontSize: 11, fontWeight: 700, outline: 'none', cursor: 'pointer', width: '100%', marginBottom: 4 }}>
                          {listeDomaines.map(d => <option key={d}>{d}</option>)}
                        </select>
                        {row.type_action && (
                          <span style={{ fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 4, background: tc.bg, color: tc.color, border: `1px solid ${tc.border}` }}>
                            {row.type_action}
                          </span>
                        )}
                      </td>

                      {/* Description */}
                      <td>
                        <input type="text" value={row.action || ''}
                          onChange={e => updateRow(row.id, 'action', e.target.value)}
                          onBlur={() => saveRowById(row.id)}
                          style={{ ...inp, fontSize: 13, fontWeight: 500, marginBottom: 2 }}/>
                        {row.cause_racine && (
                          <p style={{ fontSize: 10, color: p.text4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontStyle: 'italic' }}>
                            Cause : {row.cause_racine}
                          </p>
                        )}
                        {row.reference_source && (
                          <p style={{ fontSize: 9, color: p.blue, fontWeight: 600 }}>{row.reference_source}</p>
                        )}
                      </td>

                      {/* Pilote */}
                      <td>
                        <input type="text" value={row.pilote || ''}
                          onChange={e => updateRow(row.id, 'pilote', e.target.value)}
                          onBlur={() => saveRowById(row.id)}
                          placeholder="Pilote..." style={{ ...inp, fontSize: 12 }}/>
                      </td>

                      {/* Échéance */}
                      <td>
                        <input type="date" value={row.echeance || ''}
                          onChange={e => updateRow(row.id, 'echeance', e.target.value)}
                          onBlur={() => saveRowById(row.id)}
                          style={{ ...inp, fontSize: 11 }}/>
                        <BadgeEcheance echeance={row.echeance} statut={row.statut}/>
                      </td>

                      {/* Avancement */}
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                          <input type="number" min="0" max="100" value={row.avancement_pct ?? 0}
                            onChange={e => updateRow(row.id, 'avancement_pct', Math.min(100, Math.max(0, Number(e.target.value))))}
                            onBlur={() => saveRowById(row.id)}
                            style={{ ...inp, width: 44, padding: '3px 4px', fontSize: 11, fontWeight: 700, textAlign: 'center' }}/>
                          <span style={{ fontSize: 10, color: p.text4 }}>%</span>
                        </div>
                        <ProgressBar pct={row.avancement_pct} statut={row.statut} isDark={isDark}/>
                      </td>

                      {/* Priorité */}
                      <td>
                        <select value={row.priorite || PRIORITES[2]}
                          onChange={e => {
                            const v = e.target.value;
                            updateRow(row.id, 'priorite', v);
                            saveRowDirect({ ...actionsRef.current.find(r => r.id === row.id), priorite: v });
                          }}
                          style={{ background: `${pColor}18`, color: pColor, border: `1px solid ${pColor}40`, borderRadius: 8, padding: '5px 6px', fontSize: 11, fontWeight: 700, outline: 'none', cursor: 'pointer', width: '100%' }}>
                          {PRIORITES.map(pr => <option key={pr}>{pr}</option>)}
                        </select>
                      </td>

                      {/* Statut */}
                      <td>
                        <select value={row.statut || 'À lancer'}
                          onChange={e => {
                            const v = e.target.value;
                            const autoPct = v === 'Terminé' ? 100 : v === 'Annulé' ? row.avancement_pct : row.avancement_pct;
                            updateRow(row.id, 'statut', v);
                            if (v === 'Terminé') updateRow(row.id, 'avancement_pct', 100);
                            saveRowDirect({ ...actionsRef.current.find(r => r.id === row.id), statut: v, avancement_pct: autoPct });
                          }}
                          style={{ background: st.bg, color: st.color, border: `1px solid ${st.border}`, borderRadius: 8, padding: '5px 6px', fontSize: 11, fontWeight: 600, outline: 'none', cursor: 'pointer', width: '100%' }}>
                          {STATUTS.map(s => <option key={s}>{s}</option>)}
                        </select>
                        {/* Budget résumé si renseigné */}
                        {(row.cout_estime || row.cout_reel) && (
                          <div style={{ fontSize: 9, color: p.text4, marginTop: 3, display: 'flex', gap: 6 }}>
                            {row.cout_estime && <span>Est.: {Number(row.cout_estime).toLocaleString('fr-FR')} €</span>}
                            {row.cout_reel   && <span style={{ color: Number(row.cout_reel) > Number(row.cout_estime) ? '#EF4444' : '#10B981' }}>Réel: {Number(row.cout_reel).toLocaleString('fr-FR')} €</span>}
                          </div>
                        )}
                      </td>

                      {/* Supprimer */}
                      <td className="text-center">
                        {saving === row.id
                          ? <RefreshCw size={13} className="animate-spin text-blue-400 mx-auto"/>
                          : <button onClick={() => deleteRow(row.id)} style={{ color: p.text4, background: 'none', border: 'none', cursor: 'pointer', padding: 6 }} className="hover:text-red-400"><Trash2 size={14}/></button>
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

      {/* ── Migration SQL ────────────────────────────────────────────────────── */}
      <div className="glass-panel p-4" style={{ border: '1px solid rgba(59,130,246,0.2)' }}>
        <p style={{ fontSize: 11, color: p.text3, fontWeight: 600, marginBottom: 8 }}>
          ⚙️ <span style={{ color: p.blue }}>Migration requise</span> — Exécutez dans <strong>Supabase → SQL Editor</strong> :
        </p>
        <pre style={{ fontSize: 10, color: p.text3, background: p.bgCard2, borderRadius: 6, padding: '8px 12px', overflowX: 'auto', border: '1px solid ' + p.border, lineHeight: 1.6 }}>{`ALTER TABLE plan_actions
  ADD COLUMN IF NOT EXISTS type_action                  TEXT DEFAULT 'Corrective',
  ADD COLUMN IF NOT EXISTS cause_racine                 TEXT,
  ADD COLUMN IF NOT EXISTS reference_source             TEXT,
  ADD COLUMN IF NOT EXISTS date_cible_revisee           DATE,
  ADD COLUMN IF NOT EXISTS nombre_reports               INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cout_estime                  NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS cout_reel                    NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS avancement_pct               INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS date_verification_efficacite DATE,
  ADD COLUMN IF NOT EXISTS resultat_efficacite          TEXT DEFAULT 'Non évalué';`}</pre>
      </div>

    </div>
  );
}
