import React, { useState, useEffect, useMemo } from 'react';
import { useTheme } from './ThemeContext';
import { useToast } from './ToastContext';
import { supabase } from './supabaseClient';
import ConfirmModal from './ConfirmModal';
import {
  Plus, Trash2, RefreshCw, Save, X, MessageSquare, Users, Calendar,
  FileText, ChevronDown, ChevronRight, CheckCircle, AlertTriangle,
  Send, Printer, Clock, MapPin, User
} from 'lucide-react';

/* ─── Référentiels ──────────────────────────────────────────────────────────── */
const TYPES_REUNION = [
  'Réunion Sécurité', 'Comité QSE', 'Revue de Direction', 'CSSCT / CSE',
  'Réunion Qualité', 'Réunion Environnement', 'Réunion Mensuelle QHSE', 'Autre',
];
const STATUTS = ['Planifiée', 'Terminée', 'Annulée'];
const STATUT_STYLE = {
  'Planifiée': { color: '#3B82F6', bg: 'rgba(59,130,246,0.1)',  border: 'rgba(59,130,246,0.3)'  },
  'Terminée':  { color: '#10B981', bg: 'rgba(16,185,129,0.1)',  border: 'rgba(16,185,129,0.3)'  },
  'Annulée':   { color: '#94A3B8', bg: 'rgba(100,116,139,0.1)', border: 'rgba(100,116,139,0.3)' },
};

const FORM_INIT = {
  date: new Date().toISOString().split('T')[0],
  type: TYPES_REUNION[0],
  lieu: '',
  animateur: '',
  participants: '',
  ordre_du_jour: '',
  decisions: '',
  statut: 'Planifiée',
};

const ACTION_INIT = { description: '', responsable: '', echeance: '', statut: 'À lancer' };

/* ─── Composant principal ───────────────────────────────────────────────────── */
export default function ReunionsQHSE() {
  const { p, isDark } = useTheme();
  const toast = useToast();

  const [reunions, setReunions]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [saving, setSaving]       = useState(null);
  const [showForm, setShowForm]   = useState(false);
  const [expanded, setExpanded]   = useState(null);
  const [confirm, setConfirm]     = useState(null);
  const [filtreStatut, setFS]     = useState('Tous');
  const [filtreType, setFT]       = useState('Tous');
  const [form, setForm]           = useState({ ...FORM_INIT });
  // Actions de réunion (JSON local avant push PDCA)
  const [actionsReu, setActionsReu] = useState({});   // { [reunion_id]: [{...}] }
  const [newAction, setNewAction]   = useState({});   // { [reunion_id]: ACTION_INIT }

  useEffect(() => { fetchReunions(); }, []);

  const fetchReunions = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('reunions_qhse')
      .select('*')
      .order('date', { ascending: false });
    if (error && error.code !== '42P01') toast.error('Erreur : ' + error.message);
    if (data) {
      setReunions(data);
      // Charger les actions stockées en JSON (colonne actions_json)
      const map = {};
      data.forEach(r => { map[r.id] = r.actions_json ? JSON.parse(r.actions_json) : []; });
      setActionsReu(map);
    }
    setLoading(false);
  };

  /* ── Ajout ──────────────────────────────────────────────────────────────────── */
  const ajouterReunion = async () => {
    if (!form.date) { toast.error('La date est obligatoire'); return; }
    const { data, error } = await supabase
      .from('reunions_qhse')
      .insert([{ ...form, actions_json: '[]' }])
      .select();
    if (error) { toast.error('Erreur : ' + error.message); return; }
    if (data) {
      setReunions(prev => [data[0], ...prev]);
      setActionsReu(prev => ({ ...prev, [data[0].id]: [] }));
      setShowForm(false);
      setForm({ ...FORM_INIT });
      toast.success('Réunion créée');
    }
  };

  /* ── Sauvegarde inline ──────────────────────────────────────────────────────── */
  const saveRow = async (row) => {
    setSaving(row.id);
    const { id, ...data } = row;
    const { error } = await supabase.from('reunions_qhse').update(data).eq('id', id);
    if (error) toast.error('Erreur sauvegarde : ' + error.message);
    else toast.success('Réunion enregistrée');
    setSaving(null);
  };

  const updateRow = (id, field, value) =>
    setReunions(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));

  /* ── Suppression ─────────────────────────────────────────────────────────────  */
  const deleteRow = async (id, label) => {
    setConfirm({
      title: 'Supprimer la réunion',
      message: `Supprimer "${label}" ? Les actions associées ne seront pas supprimées du Plan d'Actions.`,
      confirmLabel: 'Supprimer', icon: '🗑️',
      onConfirm: async () => {
        const { error } = await supabase.from('reunions_qhse').delete().eq('id', id);
        if (error) { toast.error('Erreur : ' + error.message); return; }
        setReunions(prev => prev.filter(r => r.id !== id));
        toast.success('Réunion supprimée');
      },
    });
  };

  /* ── Gestion actions de réunion ─────────────────────────────────────────────── */
  const saveActions = async (reunionId, newList) => {
    const { error } = await supabase
      .from('reunions_qhse')
      .update({ actions_json: JSON.stringify(newList) })
      .eq('id', reunionId);
    if (error) toast.error('Erreur sauvegarde actions : ' + error.message);
    else setActionsReu(prev => ({ ...prev, [reunionId]: newList }));
  };

  const addAction = async (reunionId) => {
    const a = newAction[reunionId] || { ...ACTION_INIT };
    if (!a.description.trim()) { toast.error('Description obligatoire'); return; }
    const list = [...(actionsReu[reunionId] || []), { ...a, id: Date.now() }];
    await saveActions(reunionId, list);
    setNewAction(prev => ({ ...prev, [reunionId]: { ...ACTION_INIT } }));
    toast.success('Action ajoutée');
  };

  const removeAction = async (reunionId, actionId) => {
    const list = (actionsReu[reunionId] || []).filter(a => a.id !== actionId);
    await saveActions(reunionId, list);
  };

  /* ── Envoyer actions vers Plan d'Actions PDCA ───────────────────────────────── */
  const envoyerAuPDCA = async (reunionId) => {
    const reunion = reunions.find(r => r.id === reunionId);
    const actions = (actionsReu[reunionId] || []).filter(a => a.description.trim());
    if (actions.length === 0) { toast.error('Aucune action à envoyer'); return; }

    const toInsert = actions.map(a => ({
      origine: 'Revue de Direction',
      reference_source: `Réunion ${reunion.type} du ${reunion.date}`,
      domaine: 'Qualité',
      type_action: 'Corrective',
      action: a.description,
      pilote: a.responsable || '',
      echeance: a.echeance || new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0],
      statut: 'À lancer',
      avancement_pct: 0,
      priorite: '🟡 Normale',
      resultat_efficacite: 'Non évalué',
      commentaire: `Générée depuis la réunion "${reunion.type}" du ${reunion.date}`,
    }));

    const { error } = await supabase.from('plan_actions').insert(toInsert);
    if (error) { toast.error('Erreur envoi PDCA : ' + error.message); return; }
    toast.success(`${actions.length} action(s) envoyée(s) au Plan d'Actions`);
  };

  /* ── Impression PV PDF ───────────────────────────────────────────────────────── */
  const imprimerPV = (r) => {
    const actions = actionsReu[r.id] || [];
    const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"/>
<title>PV Réunion - ${r.type} - ${r.date}</title>
<style>
  body { font-family: Arial, sans-serif; margin: 40px; color: #1e293b; line-height: 1.5; }
  h1 { font-size: 20px; border-bottom: 3px solid #3B82F6; padding-bottom: 8px; }
  h2 { font-size: 14px; color: #3B82F6; margin-top: 24px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; }
  .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin: 16px 0; padding: 16px; background: #f8fafc; border-radius: 8px; }
  .meta div { font-size: 12px; } .meta strong { color: #64748b; display: block; font-size: 10px; text-transform: uppercase; }
  pre { white-space: pre-wrap; font-family: Arial; font-size: 13px; margin: 0; }
  table { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 12px; }
  th { background: #3B82F6; color: white; padding: 8px 10px; text-align: left; font-size: 11px; }
  td { padding: 7px 10px; border-bottom: 1px solid #e2e8f0; }
  tr:nth-child(even) td { background: #f8fafc; }
  .footer { margin-top: 40px; display: flex; justify-content: space-between; font-size: 11px; color: #94a3b8; }
  .sig { margin-top: 60px; font-size: 12px; }
  @media print { body { margin: 20px; } }
</style></head><body>
<h1>Procès-Verbal de Réunion</h1>
<div class="meta">
  <div><strong>Type</strong>${r.type}</div>
  <div><strong>Date</strong>${new Date(r.date).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</div>
  <div><strong>Lieu</strong>${r.lieu || '—'}</div>
  <div><strong>Animateur</strong>${r.animateur || '—'}</div>
  <div><strong>Statut</strong>${r.statut}</div>
  <div><strong>Participants</strong>${r.participants || '—'}</div>
</div>

<h2>Ordre du jour</h2>
<pre>${r.ordre_du_jour || 'Non renseigné'}</pre>

<h2>Décisions & Compte-rendu</h2>
<pre>${r.decisions || 'Non renseigné'}</pre>

${actions.length > 0 ? `
<h2>Actions générées (${actions.length})</h2>
<table>
  <thead><tr><th>#</th><th>Description</th><th>Responsable</th><th>Échéance</th><th>Statut</th></tr></thead>
  <tbody>
    ${actions.map((a, i) => `<tr><td>${i+1}</td><td>${a.description}</td><td>${a.responsable || '—'}</td><td>${a.echeance || '—'}</td><td>${a.statut}</td></tr>`).join('')}
  </tbody>
</table>` : ''}

<div class="footer">
  <span>Document généré le ${new Date().toLocaleDateString('fr-FR')} — SMI Dashboard Pro</span>
  <span>Réunion : ${r.type} — ${r.date}</span>
</div>

<div class="sig">
  <p>Signature de l'animateur : ___________________________</p>
  <p>Date de validation : ___________________________</p>
</div>
</body></html>`;

    const w = window.open('', '_blank', 'width=900,height=700');
    if (!w) { toast.error('Popup bloquée. Autorisez les popups pour imprimer.'); return; }
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 600);
  };

  /* ── Filtrage ────────────────────────────────────────────────────────────────── */
  const filtrees = useMemo(() => reunions.filter(r => {
    if (filtreStatut !== 'Tous' && r.statut !== filtreStatut) return false;
    if (filtreType   !== 'Tous' && r.type   !== filtreType)   return false;
    return true;
  }), [reunions, filtreStatut, filtreType]);

  /* ── Styles ────────────────────────────────────────────────────────────────────  */
  const inp = { padding: '7px 10px', fontSize: 12, background: p.bgInput, border: '1px solid ' + p.borderInput, borderRadius: 6, color: p.text1, fontFamily: 'inherit', outline: 'none', width: '100%', boxSizing: 'border-box' };
  const lbl = { fontSize: 10, fontWeight: 700, color: p.text4, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 4 };
  const types = useMemo(() => ['Tous', ...[...new Set(reunions.map(r => r.type).filter(Boolean))].sort()], [reunions]);

  /* ── KPIs ───────────────────────────────────────────────────────────────────────  */
  const kpis = useMemo(() => ({
    total:     reunions.length,
    terminees: reunions.filter(r => r.statut === 'Terminée').length,
    planifiees:reunions.filter(r => r.statut === 'Planifiée').length,
    actions:   Object.values(actionsReu).reduce((s, a) => s + a.length, 0),
  }), [reunions, actionsReu]);

  /* ════════════════════════════════════════════════════════════════════════════════ */
  return (
    <div className="space-y-5 pb-10">

      {/* ── En-tête ──────────────────────────────────────────────────────────── */}
      <header className="page-header">
        <div>
          <h2 className="page-title flex items-center gap-3"><MessageSquare size={26} className="text-blue-400"/> Réunions QHSE</h2>
          <p className="page-subtitle">Suivi des réunions, décisions et actions — Génération PV PDF</p>
        </div>
        <div className="flex gap-3">
          <button onClick={fetchReunions} className="btn-secondary"><RefreshCw size={16} className={loading ? 'animate-spin' : ''}/> Actualiser</button>
          <button onClick={() => setShowForm(true)} className="btn-primary"><Plus size={16}/> Nouvelle réunion</button>
        </div>
      </header>

      {/* ── KPIs ──────────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Réunions',    val: kpis.total,     color: 'blue',  sub: 'Total enregistrées' },
          { label: 'Terminées',   val: kpis.terminees, color: 'green', sub: 'Avec PV' },
          { label: 'Planifiées',  val: kpis.planifiees,color: 'amber', sub: 'À venir' },
          { label: 'Actions PDCA',val: kpis.actions,   color: 'blue',  sub: 'Générées en réunion' },
        ].map((k, i) => (
          <div key={i} className={`kpi-card ${k.color}`}>
            <p className="text-xs font-bold uppercase tracking-wider mb-1" style={{ color: p.text3 }}>{k.label}</p>
            <p className="text-3xl font-black" style={{ color: p.text1 }}>{k.val}</p>
            <p className="text-xs mt-1" style={{ color: p.text4 }}>{k.sub}</p>
          </div>
        ))}
      </div>

      {/* ── Filtres ───────────────────────────────────────────────────────────── */}
      <div className="glass-panel p-4 flex flex-wrap gap-3 items-center">
        <select value={filtreStatut} onChange={e => setFS(e.target.value)} style={{ ...inp, width: 150 }}>
          {['Tous', ...STATUTS].map(s => <option key={s}>{s}</option>)}
        </select>
        <select value={filtreType} onChange={e => setFT(e.target.value)} style={{ ...inp, width: 200 }}>
          {types.map(t => <option key={t}>{t}</option>)}
        </select>
        <span style={{ fontSize: 11, color: p.text4, marginLeft: 'auto' }}>{filtrees.length} réunion{filtrees.length > 1 ? 's' : ''}</span>
      </div>

      {/* ── Liste des réunions ────────────────────────────────────────────────── */}
      {loading ? (
        <div className="glass-panel flex items-center justify-center h-32">
          <RefreshCw size={24} className="animate-spin" style={{ color: p.blue }}/>
        </div>
      ) : filtrees.length === 0 ? (
        <div className="glass-panel flex flex-col items-center justify-center h-40 gap-3">
          <MessageSquare size={36} style={{ color: p.text4 }}/>
          <p style={{ color: p.text3, fontSize: 13 }}>Aucune réunion enregistrée</p>
          <button onClick={() => setShowForm(true)} className="btn-primary text-sm"><Plus size={14}/> Créer la première</button>
        </div>
      ) : (
        <div className="space-y-3">
          {filtrees.map(r => {
            const st = STATUT_STYLE[r.statut] || STATUT_STYLE['Planifiée'];
            const isOpen = expanded === r.id;
            const aList = actionsReu[r.id] || [];
            const nAct = newAction[r.id] || { ...ACTION_INIT };

            return (
              <div key={r.id} className="glass-panel overflow-hidden">
                {/* ── Ligne principale ────────────────────────────────────── */}
                <div
                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', cursor: 'pointer' }}
                  onClick={() => setExpanded(isOpen ? null : r.id)}
                >
                  {/* Chevron */}
                  {isOpen ? <ChevronDown size={16} style={{ color: p.text4, flexShrink: 0 }}/> : <ChevronRight size={16} style={{ color: p.text4, flexShrink: 0 }}/>}

                  {/* Date */}
                  <div style={{ textAlign: 'center', background: p.whiteFaint, border: '1px solid ' + p.border, borderRadius: 8, padding: '6px 10px', flexShrink: 0, minWidth: 52 }}>
                    <div style={{ fontSize: 16, fontWeight: 900, color: p.text1, lineHeight: 1 }}>
                      {new Date(r.date + 'T00:00:00').getDate().toString().padStart(2, '0')}
                    </div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: p.text4, textTransform: 'uppercase' }}>
                      {new Date(r.date + 'T00:00:00').toLocaleDateString('fr-FR', { month: 'short' })}
                    </div>
                  </div>

                  {/* Infos */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: p.text1 }}>{r.type}</span>
                      <span style={{ fontSize: 11, color: st.color, background: st.bg, border: '1px solid ' + st.border, borderRadius: 100, padding: '1px 8px', fontWeight: 700 }}>
                        {r.statut}
                      </span>
                      {aList.length > 0 && (
                        <span style={{ fontSize: 11, color: p.blue, background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.3)', borderRadius: 100, padding: '1px 8px', fontWeight: 700 }}>
                          {aList.length} action{aList.length > 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: 12, marginTop: 4, flexWrap: 'wrap' }}>
                      {r.lieu && <span style={{ fontSize: 11, color: p.text4, display: 'flex', alignItems: 'center', gap: 3 }}><MapPin size={10}/>{r.lieu}</span>}
                      {r.animateur && <span style={{ fontSize: 11, color: p.text4, display: 'flex', alignItems: 'center', gap: 3 }}><User size={10}/>{r.animateur}</span>}
                      {r.participants && <span style={{ fontSize: 11, color: p.text4, display: 'flex', alignItems: 'center', gap: 3 }}><Users size={10}/>{r.participants.split(/[,;]+/).length} participant{r.participants.split(/[,;]+/).length > 1 ? 's' : ''}</span>}
                    </div>
                  </div>

                  {/* Actions rapides */}
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                    <button onClick={() => imprimerPV(r)} title="Imprimer PV PDF" style={{ padding: '5px 8px', background: p.bgCard2, border: '1px solid ' + p.border, borderRadius: 6, cursor: 'pointer', color: p.text3, display: 'flex' }}>
                      <Printer size={14}/>
                    </button>
                    <button onClick={() => saveRow(r)} title="Enregistrer" style={{ padding: '5px 8px', background: p.bgCard2, border: '1px solid ' + p.border, borderRadius: 6, cursor: 'pointer', color: p.blue, display: 'flex' }}>
                      {saving === r.id ? <RefreshCw size={14} className="animate-spin"/> : <Save size={14}/>}
                    </button>
                    <button onClick={() => deleteRow(r.id, `${r.type} du ${r.date}`)} title="Supprimer" style={{ padding: '5px 8px', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 6, cursor: 'pointer', color: '#EF4444', display: 'flex' }}>
                      <Trash2 size={14}/>
                    </button>
                  </div>
                </div>

                {/* ── Détail (expanded) ────────────────────────────────────── */}
                {isOpen && (
                  <div style={{ borderTop: '1px solid ' + p.border }}>
                    {/* Champs édition */}
                    <div style={{ padding: '16px 20px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
                      <div>
                        <label style={lbl}>Date</label>
                        <input type="date" value={r.date || ''} onChange={e => updateRow(r.id, 'date', e.target.value)} onBlur={() => saveRow(r)} style={inp}/>
                      </div>
                      <div>
                        <label style={lbl}>Type</label>
                        <select value={r.type || ''} onChange={e => { updateRow(r.id, 'type', e.target.value); }} onBlur={() => saveRow(r)} style={inp}>
                          {TYPES_REUNION.map(t => <option key={t}>{t}</option>)}
                        </select>
                      </div>
                      <div>
                        <label style={lbl}>Statut</label>
                        <select value={r.statut || 'Planifiée'} onChange={e => { updateRow(r.id, 'statut', e.target.value); setTimeout(() => saveRow({ ...r, statut: e.target.value }), 100); }} style={{ ...inp, color: st.color, fontWeight: 700, background: st.bg, borderColor: st.border }}>
                          {STATUTS.map(s => <option key={s}>{s}</option>)}
                        </select>
                      </div>
                      <div>
                        <label style={lbl}>Lieu</label>
                        <input value={r.lieu || ''} onChange={e => updateRow(r.id, 'lieu', e.target.value)} onBlur={() => saveRow(r)} style={inp} placeholder="Salle de réunion, Site..."/>
                      </div>
                      <div>
                        <label style={lbl}>Animateur / Responsable</label>
                        <input value={r.animateur || ''} onChange={e => updateRow(r.id, 'animateur', e.target.value)} onBlur={() => saveRow(r)} style={inp} placeholder="Nom du responsable"/>
                      </div>
                      <div>
                        <label style={lbl}>Participants</label>
                        <input value={r.participants || ''} onChange={e => updateRow(r.id, 'participants', e.target.value)} onBlur={() => saveRow(r)} style={inp} placeholder="Noms séparés par des virgules"/>
                      </div>
                      <div style={{ gridColumn: '1 / -1' }}>
                        <label style={lbl}>Ordre du jour</label>
                        <textarea value={r.ordre_du_jour || ''} onChange={e => updateRow(r.id, 'ordre_du_jour', e.target.value)} onBlur={() => saveRow(r)} style={{ ...inp, minHeight: 70, resize: 'vertical' }} placeholder="Points abordés lors de la réunion..."/>
                      </div>
                      <div style={{ gridColumn: '1 / -1' }}>
                        <label style={lbl}>Décisions & Compte-rendu</label>
                        <textarea value={r.decisions || ''} onChange={e => updateRow(r.id, 'decisions', e.target.value)} onBlur={() => saveRow(r)} style={{ ...inp, minHeight: 90, resize: 'vertical' }} placeholder="Décisions prises, points notables..."/>
                      </div>
                    </div>

                    {/* ── Actions de la réunion ─────────────────────────────── */}
                    <div style={{ padding: '0 20px 20px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                        <span style={{ fontSize: 12, fontWeight: 800, color: p.text2, display: 'flex', alignItems: 'center', gap: 6 }}>
                          <CheckCircle size={14} style={{ color: p.blue }}/> Actions générées ({aList.length})
                        </span>
                        {aList.length > 0 && (
                          <button
                            onClick={() => envoyerAuPDCA(r.id)}
                            style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', background: '#10B981', color: 'white', border: 'none', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
                          >
                            <Send size={12}/> Envoyer au Plan d'Actions
                          </button>
                        )}
                      </div>

                      {/* Liste des actions existantes */}
                      {aList.length > 0 && (
                        <div style={{ marginBottom: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {aList.map(a => (
                            <div key={a.id} style={{ display: 'grid', gridTemplateColumns: '1fr 130px 110px 80px auto', gap: 8, alignItems: 'center', padding: '8px 10px', background: p.whiteFaint, border: '1px solid ' + p.border, borderRadius: 8 }}>
                              <span style={{ fontSize: 12, color: p.text1 }}>{a.description}</span>
                              <span style={{ fontSize: 11, color: p.text4 }}>{a.responsable || '—'}</span>
                              <span style={{ fontSize: 11, color: p.text4 }}>{a.echeance || '—'}</span>
                              <span style={{ fontSize: 10, color: '#3B82F6', fontWeight: 700 }}>{a.statut}</span>
                              <button onClick={() => removeAction(r.id, a.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#EF4444', padding: 2, display: 'flex' }}>
                                <X size={12}/>
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Formulaire nouvelle action */}
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px 120px 80px auto', gap: 8, alignItems: 'end' }}>
                        <div>
                          <label style={lbl}>Nouvelle action</label>
                          <input
                            value={nAct.description}
                            onChange={e => setNewAction(prev => ({ ...prev, [r.id]: { ...(prev[r.id] || ACTION_INIT), description: e.target.value } }))}
                            placeholder="Description de l'action..."
                            style={inp}
                          />
                        </div>
                        <div>
                          <label style={lbl}>Responsable</label>
                          <input
                            value={nAct.responsable}
                            onChange={e => setNewAction(prev => ({ ...prev, [r.id]: { ...(prev[r.id] || ACTION_INIT), responsable: e.target.value } }))}
                            placeholder="Nom"
                            style={inp}
                          />
                        </div>
                        <div>
                          <label style={lbl}>Échéance</label>
                          <input
                            type="date"
                            value={nAct.echeance}
                            onChange={e => setNewAction(prev => ({ ...prev, [r.id]: { ...(prev[r.id] || ACTION_INIT), echeance: e.target.value } }))}
                            style={inp}
                          />
                        </div>
                        <div style={{ paddingBottom: 1 }}>
                          <label style={lbl}>Statut</label>
                          <select
                            value={nAct.statut}
                            onChange={e => setNewAction(prev => ({ ...prev, [r.id]: { ...(prev[r.id] || ACTION_INIT), statut: e.target.value } }))}
                            style={inp}
                          >
                            {['À lancer', 'En cours', 'Terminé'].map(s => <option key={s}>{s}</option>)}
                          </select>
                        </div>
                        <button
                          onClick={() => addAction(r.id)}
                          style={{ height: 34, padding: '0 12px', background: p.blue, color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 700, flexShrink: 0 }}
                        >
                          <Plus size={13}/> Ajouter
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Formulaire création ───────────────────────────────────────────────── */}
      {showForm && (
        <div
          onClick={e => { if (e.target === e.currentTarget) setShowForm(false); }}
          style={{ position: 'fixed', inset: 0, zIndex: 99999, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
        >
          <div style={{ background: p.bgCard2, border: '1px solid ' + p.border2, borderRadius: 16, width: '100%', maxWidth: 620, boxShadow: '0 32px 80px rgba(0,0,0,0.4)', overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid ' + p.border, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 15, fontWeight: 800, color: p.text1, display: 'flex', alignItems: 'center', gap: 8 }}>
                <MessageSquare size={16} style={{ color: p.blue }}/> Nouvelle réunion QHSE
              </span>
              <button onClick={() => setShowForm(false)} style={{ background: p.whiteFaint, border: '1px solid ' + p.border, borderRadius: 8, color: p.text3, cursor: 'pointer', padding: '5px 7px', display: 'flex' }}>
                <X size={14}/>
              </button>
            </div>
            <div style={{ padding: 20, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div>
                <label style={lbl}>Date *</label>
                <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} style={inp}/>
              </div>
              <div>
                <label style={lbl}>Type</label>
                <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} style={inp}>
                  {TYPES_REUNION.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>Lieu</label>
                <input value={form.lieu} onChange={e => setForm(f => ({ ...f, lieu: e.target.value }))} placeholder="Salle, site..." style={inp}/>
              </div>
              <div>
                <label style={lbl}>Animateur</label>
                <input value={form.animateur} onChange={e => setForm(f => ({ ...f, animateur: e.target.value }))} placeholder="Responsable" style={inp}/>
              </div>
              <div>
                <label style={lbl}>Statut</label>
                <select value={form.statut} onChange={e => setForm(f => ({ ...f, statut: e.target.value }))} style={inp}>
                  {STATUTS.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>Participants</label>
                <input value={form.participants} onChange={e => setForm(f => ({ ...f, participants: e.target.value }))} placeholder="Noms séparés par des virgules" style={inp}/>
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={lbl}>Ordre du jour</label>
                <textarea value={form.ordre_du_jour} onChange={e => setForm(f => ({ ...f, ordre_du_jour: e.target.value }))} style={{ ...inp, minHeight: 60, resize: 'vertical' }} placeholder="Points à aborder..."/>
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={lbl}>Décisions (optionnel)</label>
                <textarea value={form.decisions} onChange={e => setForm(f => ({ ...f, decisions: e.target.value }))} style={{ ...inp, minHeight: 60, resize: 'vertical' }} placeholder="Décisions prises..."/>
              </div>
            </div>
            <div style={{ padding: '12px 20px', borderTop: '1px solid ' + p.border, display: 'flex', gap: 8, justifyContent: 'flex-end', background: p.whiteFaint2 }}>
              <button onClick={() => setShowForm(false)} style={{ padding: '8px 18px', background: p.whiteFaint, border: '1px solid ' + p.border, borderRadius: 8, color: p.text2, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                Annuler
              </button>
              <button onClick={ajouterReunion} style={{ padding: '8px 20px', background: p.blue, color: 'white', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Plus size={14}/> Créer la réunion
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal config={confirm} onClose={() => setConfirm(null)}/>
    </div>
  );
}
