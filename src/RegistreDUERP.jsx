import { useTheme } from './ThemeContext';
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Plus, Trash2, AlertOctagon, RefreshCw, Shield, Filter, X, Save, Grid, Archive, RotateCcw, History } from 'lucide-react';
import { supabase } from './supabaseClient';
import GestionListes from './GestionListes';
import { useToast } from './Toast';
import { logAction } from './auditLog';

/* ─── Référentiels ──────────────────────────────────────────────────────────── */
const FAMILLES_RISQUES = [
  'Chutes de plain-pied', 'Chutes de hauteur', 'Manutention manuelle',
  'Risques mécaniques (écrasement, coupure)', 'Risques électriques',
  'Risques chimiques', 'Risques biologiques',
  'Ambiances physiques (bruit, vibrations, éclairage)',
  'Incendie / Explosion / ATEX', 'Risques ergonomiques (TMS)',
  'Risques psychosociaux (RPS)', 'Ambiances thermiques',
  'Circulation / Déplacements', 'Co-activité / Sous-traitance', 'Autre',
];

const LISTE_UT_DEFAULT = [
  'Atelier Production', 'Magasin / Logistique', 'Bureaux Administratifs',
  'Maintenance', 'Chantier / Déplacement', 'Accueil / Réception', 'Direction',
];

const PERSONNES_EXPOSEES_LIST = [
  'Tous les salariés', 'Opérateurs production', 'Techniciens maintenance',
  'Personnel administratif', 'Personnel logistique', 'Encadrement',
  'Intervenants extérieurs', 'Prestataires / Sous-traitants',
];

/* ─── Calcul pondération ─────────────────────────────────────────────────────
   Coefficient réducteur selon les mesures de maîtrise en place.
   EPC (Protection Collective) > ORG (Organisation) > EPI (Protection Individuelle)
   ──────────────────────────────────────────────────────────────────────────── */
function getCoefficient(epc, orga, epi) {
  if (epc && orga && epi) return 0.30;  // Triple protection — défense en profondeur
  if (epc && orga)        return 0.40;  // Technique + organisation
  if (epc && epi)         return 0.45;  // Technique + individuel
  if (orga && epi)        return 0.60;  // Organisation + individuel
  if (epc)                return 0.50;  // EPC seule (indépendant du comportement)
  if (orga)               return 0.70;  // Procédure / formation seule
  if (epi)                return 0.80;  // EPI seul (dépend du comportement)
  return 1.00;                          // Aucune mesure — risque brut
}

function calcCR(g, p, epc, orga, epi) {
  return Math.max(1, Math.round(Number(g || 1) * Number(p || 1) * getCoefficient(epc, orga, epi)));
}

/* ─── Niveaux de criticité (4 niveaux selon ISO 45001) ──────────────────────
   1-4  : Acceptable      (Vert)
   5-8  : À surveiller    (Jaune)
   9-12 : Action requise  (Orange)
   13-16: Inacceptable    (Rouge)
   ──────────────────────────────────────────────────────────────────────────── */
function getCInfo(score, isDark) {
  if (score >= 13) return {
    label: 'Inacceptable',
    color:  isDark ? '#EF4444' : '#7F1D1D',
    bg:     isDark ? 'rgba(239,68,68,0.15)'  : '#FEE2E2',
    border: isDark ? 'rgba(239,68,68,0.4)'   : '#FECACA',
  };
  if (score >= 9) return {
    label: 'Action requise',
    color:  isDark ? '#F97316' : '#7C2D12',
    bg:     isDark ? 'rgba(249,115,22,0.15)' : '#FFEDD5',
    border: isDark ? 'rgba(249,115,22,0.4)'  : '#FB923C',
  };
  if (score >= 5) return {
    label: 'À surveiller',
    color:  isDark ? '#F59E0B' : '#713F12',
    bg:     isDark ? 'rgba(245,158,11,0.15)' : '#FEF9C3',
    border: isDark ? 'rgba(245,158,11,0.4)'  : '#FDE047',
  };
  return {
    label: 'Acceptable',
    color:  isDark ? '#10B981' : '#14532D',
    bg:     isDark ? 'rgba(16,185,129,0.15)' : '#DCFCE7',
    border: isDark ? 'rgba(16,185,129,0.4)'  : '#86EFAC',
  };
}

const FORM_INIT = {
  date_maj: new Date().toISOString().split('T')[0],
  unite_travail: LISTE_UT_DEFAULT[0],
  famille_risque: '',
  danger: '',
  evenement_declencheur: '',
  dommage_potentiel: '',
  personnes_exposees: [],
  gravite: 2,
  probabilite: 2,
  a_mesure_epc: false, mesures_epc: '',
  a_mesure_orga: false, mesures_orga: '',
  a_mesure_epi: false,  mesures_epi: '',
  action_preventive: '',
  pilote: '',
  echeance: '',
};

/* ═══════════════════════════════════════════════════════════════════════════ */
export default function RegistreDUERP() {
  const { p, isDark } = useTheme();
  const { toast } = useToast();
  const [risques, setRisques]         = useState([]);
  const [loading, setLoading]         = useState(true);
  const [saving, setSaving]           = useState(null);
  const [showForm, setShowForm]       = useState(false);
  const [showMatrice, setShowMatrice] = useState(false);
  const [filtreUT, setFiltreUT]       = useState('Tous');
  const [filtreNiveau, setFiltreNiveau] = useState('Tous');
  const [listeUT, setListeUT]         = useState(LISTE_UT_DEFAULT);
  const [form, setForm]               = useState({ ...FORM_INIT });
  const [saveError, setSaveError]     = useState('');
  const [showArchive, setShowArchive] = useState(false);
  const risquesRef                    = useRef(risques);
  useEffect(() => { risquesRef.current = risques; }, [risques]);

  useEffect(() => { fetchRisques(); }, []);

  /* ── Fetch ──────────────────────────────────────────────────────────────── */
  const fetchRisques = async () => {
    setLoading(true);
    const { data } = await supabase.from('registre_duerp').select('*').order('criticite', { ascending: false });
    if (data) setRisques(data);
    setLoading(false);
  };

  /* ── Archivage ──────────────────────────────────────────────────────────── */
  const archiveRow = async (id) => {
    const now = new Date().toISOString();
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from('registre_duerp').update({ archived_at: now, archived_by: user?.email || null }).eq('id', id);
    try { await logAction('registre_duerp', id, 'ARCHIVE', { archived_by: user?.email || null }, user?.email || ''); } catch {}
    setRisques(prev => prev.map(r => r.id === id ? { ...r, archived_at: now } : r));
    toast({ message: 'Risque archivé dans l\'historique', type: 'info' });
  };
  const restoreRow = async (id) => {
    await supabase.from('registre_duerp').update({ archived_at: null, archived_by: null }).eq('id', id);
    try { await logAction('registre_duerp', id, 'RESTORE', {}); } catch {}
    setRisques(prev => prev.map(r => r.id === id ? { ...r, archived_at: null } : r));
    toast({ message: 'Risque restauré', type: 'success' });
  };

  /* ── Mise à jour locale (état React) ────────────────────────────────────── */
  const updateRow = (id, updates) => {
    setRisques(prev => prev.map(row => {
      if (row.id !== id) return row;
      const u = { ...row, ...updates };
      u.criticite           = Number(u.gravite || 1) * Number(u.probabilite || 1);
      u.criticite_resid     = calcCR(u.gravite, u.probabilite, u.a_mesure_epc, u.a_mesure_orga, u.a_mesure_epi);
      u.coefficient_reducteur = getCoefficient(u.a_mesure_epc, u.a_mesure_orga, u.a_mesure_epi);
      return u;
    }));
  };

  /* ── Sauvegarde Supabase ─────────────────────────────────────────────────── */
  const saveRowDirect = async (rowData) => {
    if (!rowData) return;
    setSaving(rowData.id);
    const { error } = await supabase.from('registre_duerp').update({
      unite_travail: rowData.unite_travail,
      famille_risque: rowData.famille_risque,
      danger: rowData.danger,
      evenement_declencheur: rowData.evenement_declencheur,
      dommage_potentiel: rowData.dommage_potentiel,
      personnes_exposees: rowData.personnes_exposees,
      gravite: rowData.gravite,
      probabilite: rowData.probabilite,
      criticite: rowData.criticite,
      a_mesure_epc: rowData.a_mesure_epc,
      mesures_epc: rowData.mesures_epc,
      a_mesure_orga: rowData.a_mesure_orga,
      mesures_orga: rowData.mesures_orga,
      a_mesure_epi: rowData.a_mesure_epi,
      mesures_epi: rowData.mesures_epi,
      criticite_resid: rowData.criticite_resid,
      coefficient_reducteur: rowData.coefficient_reducteur,
      action_preventive: rowData.action_preventive,
      pilote: rowData.pilote,
      echeance: rowData.echeance,
      date_maj: rowData.date_maj,
    }).eq('id', rowData.id);
    setSaving(null);
    if (error) toast({ message: `Erreur sauvegarde : ${error.message}`, type: 'error' });
    else {
      try { await logAction('registre_duerp', rowData.id, 'UPDATE', { unite: rowData.unite_travail, criticite_resid: rowData.criticite_resid }); } catch {}
      toast({ message: 'Risque sauvegardé', type: 'success' });
    }
  };

  // Appelé par onBlur des champs texte (lit le state le plus récent via ref)
  const saveRowById = (id) => {
    const row = risquesRef.current.find(r => r.id === id);
    if (row) saveRowDirect(row);
  };

  /* ── Ajout d'un risque ──────────────────────────────────────────────────── */
  const ajouterRisque = async () => {
    if (!form.danger.trim()) return;
    setSaveError('');
    const ci    = Number(form.gravite) * Number(form.probabilite);
    const cr    = calcCR(form.gravite, form.probabilite, form.a_mesure_epc, form.a_mesure_orga, form.a_mesure_epi);
    const coeff = getCoefficient(form.a_mesure_epc, form.a_mesure_orga, form.a_mesure_epi);

    // Champs de base (colonnes originales)
    const baseFields = {
      unite_travail: form.unite_travail,
      danger: form.danger,
      risque: form.risque,
      gravite: form.gravite,
      probabilite: form.probabilite,
      criticite: ci,
      action_preventive: form.action_preventive,
      pilote: form.pilote,
      date_maj: form.date_maj || null,
    };
    // Champs issus de la migration
    const extraFields = {
      famille_risque: form.famille_risque || null,
      evenement_declencheur: form.evenement_declencheur || null,
      dommage_potentiel: form.dommage_potentiel || null,
      personnes_exposees: Array.isArray(form.personnes_exposees) ? (form.personnes_exposees.join(' / ') || null) : (form.personnes_exposees || null),
      a_mesure_epc: form.a_mesure_epc,
      mesures_epc: form.mesures_epc || null,
      a_mesure_orga: form.a_mesure_orga,
      mesures_orga: form.mesures_orga || null,
      a_mesure_epi: form.a_mesure_epi,
      mesures_epi: form.mesures_epi || null,
      criticite_resid: cr,
      coefficient_reducteur: coeff,
    };

    const { data, error } = await supabase.from('registre_duerp')
      .insert([{ ...baseFields, ...extraFields }]).select();

    if (error) {
      setSaveError(`Erreur : ${error.message}`);
      toast({ message: `Erreur : ${error.message}`, type: 'error' });
      return;
    }
    if (data?.[0]) {
      try { await logAction('registre_duerp', data[0].id, 'CREATE', { unite: form.unite_travail, famille: form.famille_risque, danger: form.danger, criticite_resid: cr }); } catch {}
      setRisques(prev => [...prev, data[0]].sort((a, b) => (b.criticite_resid || b.criticite || 1) - (a.criticite_resid || a.criticite || 1)));
      setShowForm(false);
      setForm({ ...FORM_INIT, unite_travail: listeUT[0] });
      toast({ message: 'Risque ajouté au DUERP', type: 'success' });
    }
  };

  /* ── Suppression ────────────────────────────────────────────────────────── */
  const deleteRow = async (id) => {
    if (!window.confirm('Supprimer ce risque définitivement ?')) return;
    await supabase.from('registre_duerp').delete().eq('id', id);
    try { await logAction('registre_duerp', id, 'DELETE', {}); } catch {}
    setRisques(prev => prev.filter(r => r.id !== id));
    toast({ message: 'Risque supprimé', type: 'info' });
  };

  /* ── KPIs (sur les risques actifs uniquement) ───────────────────────────── */
  const kpis = useMemo(() => {
    const actifs = risques.filter(r => !r.archived_at);
    const score = r => r.criticite_resid || r.criticite || 1;
    return {
      total:         actifs.length,
      inacceptable:  actifs.filter(r => score(r) >= 13).length,
      actionRequise: actifs.filter(r => score(r) >= 9  && score(r) < 13).length,
      surveillance:  actifs.filter(r => score(r) >= 5  && score(r) < 9).length,
      acceptables:   actifs.filter(r => score(r) < 5).length,
      sansAction:    actifs.filter(r => score(r) >= 9  && !String(r.action_preventive || '').trim()).length,
    };
  }, [risques]);

  /* ── Filtres ────────────────────────────────────────────────────────────── */
  const risquesFiltres = useMemo(() => risques.filter(r => {
    if (showArchive ? !r.archived_at : r.archived_at) return false;
    const s = r.criticite_resid || r.criticite || 1;
    if (filtreUT !== 'Tous' && r.unite_travail !== filtreUT) return false;
    if (filtreNiveau === 'Inacceptable'   && s < 13) return false;
    if (filtreNiveau === 'Action requise' && (s < 9  || s >= 13)) return false;
    if (filtreNiveau === 'À surveiller'   && (s < 5  || s >= 9))  return false;
    if (filtreNiveau === 'Acceptable'     && s >= 5) return false;
    return true;
  }), [risques, filtreUT, filtreNiveau, showArchive]);

  /* ── Styles helpers ─────────────────────────────────────────────────────── */
  const inp = { padding: '5px 8px', fontSize: 12, background: p.bgInput, border: '1px solid ' + p.borderInput, borderRadius: 6, color: p.text1, fontFamily: 'inherit', outline: 'none', width: '100%' };
  const lbl = { fontSize: 10, fontWeight: 700, color: p.text4, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 4 };

  /* ── Matrice 4×4 ────────────────────────────────────────────────────────── */
  const MatriceRisques = () => (
    <div className="glass-panel p-5 animate-fade-up">
      <div className="flex justify-between items-center mb-4">
        <h3 className="font-bold flex items-center gap-2" style={{ color: p.text1 }}>
          <Grid size={18} style={{ color: p.purple }}/> Matrice de criticité — 4 niveaux
        </h3>
        <button onClick={() => setShowMatrice(false)} style={{ color: p.text4, background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}><X size={16}/></button>
      </div>
      <div className="flex gap-6 items-start flex-wrap">
        {/* Grille */}
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: '36px repeat(4, 54px)', gap: 4 }}>
            <div/>
            {[1,2,3,4].map(f => <div key={f} style={{ textAlign: 'center', fontSize: 11, color: p.text3, fontWeight: 700, paddingBottom: 4 }}>F={f}</div>)}
            {[4,3,2,1].map(g => (
              <React.Fragment key={g}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: p.text3, fontWeight: 700 }}>G={g}</div>
                {[1,2,3,4].map(f => {
                  const sc   = g * f;
                  const info = getCInfo(sc, isDark);
                  const cnt  = risques.filter(r => Number(r.gravite) === g && Number(r.probabilite) === f).length;
                  return (
                    <div key={f} style={{ width: 54, height: 54, background: info.bg, border: `1.5px solid ${info.border}`, borderRadius: 8, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ color: info.color, fontSize: 17, fontWeight: 900 }}>{sc}</span>
                      {cnt > 0 && <span style={{ background: info.color, color: 'white', borderRadius: 100, padding: '0 5px', fontSize: 9, marginTop: 2, fontWeight: 700 }}>{cnt}</span>}
                    </div>
                  );
                })}
              </React.Fragment>
            ))}
          </div>
          <div style={{ marginTop: 12, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {[{s:1,l:'1-4 Acceptable'},{s:6,l:'5-8 À surveiller'},{s:10,l:'9-12 Action requise'},{s:14,l:'13-16 Inacceptable'}].map(({ s, l }) => {
              const info = getCInfo(s, isDark);
              return (
                <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11 }}>
                  <div style={{ width: 10, height: 10, background: info.color, borderRadius: 2 }}/>
                  <span style={{ color: p.text3 }}>{l}</span>
                </div>
              );
            })}
          </div>
        </div>
        {/* Liste risques critiques */}
        <div style={{ flex: 1, minWidth: 200 }}>
          <p style={{ fontSize: 10, fontWeight: 700, color: p.text4, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Risques nécessitant une action</p>
          {risques.filter(r => (r.criticite_resid || r.criticite || 1) >= 9).length === 0
            ? <p style={{ color: isDark ? '#10B981' : '#047857', fontSize: 13 }}>✓ Aucun risque critique !</p>
            : risques.filter(r => (r.criticite_resid || r.criticite || 1) >= 9).map(r => {
                const sc   = r.criticite_resid || r.criticite || 1;
                const info = getCInfo(sc, isDark);
                return (
                  <div key={r.id} style={{ background: info.bg, border: `1px solid ${info.border}`, borderRadius: 8, padding: '8px 12px', marginBottom: 6 }}>
                    <p style={{ color: p.text1, fontSize: 13, fontWeight: 600 }}>{r.danger}</p>
                    <div style={{ display: 'flex', gap: 8, marginTop: 3, alignItems: 'center' }}>
                      <span style={{ color: p.text3, fontSize: 11 }}>{r.unite_travail}</span>
                      <span style={{ background: info.bg, color: info.color, border: `1px solid ${info.border}`, borderRadius: 4, padding: '1px 6px', fontSize: 10, fontWeight: 700 }}>CR={sc}</span>
                    </div>
                  </div>
                );
              })
          }
        </div>
      </div>
    </div>
  );

  /* ══════════════════════════════════════════════════════════════════════════ */
  return (
    <div className="space-y-5 pb-10">

      {/* ── En-tête ─────────────────────────────────────────────────────────── */}
      <header className="page-header">
        <div>
          <h2 className="page-title flex items-center gap-3"><Shield size={26} className="text-amber-400"/> Registre DUERP</h2>
          <p className="page-subtitle">Évaluation et maîtrise des risques — Pondération EPC / Organisation / EPI</p>
          <div style={{ display:'flex', gap:6, marginTop:8 }}>
            <button onClick={() => setShowArchive(false)} style={{ fontSize:12, fontWeight:700, padding:'3px 14px', borderRadius:100, border:'1px solid', cursor:'pointer', background:!showArchive?'rgba(245,158,11,0.18)':'transparent', borderColor:!showArchive?'rgba(245,158,11,0.5)':'rgba(255,255,255,0.1)', color:!showArchive?'#F59E0B':'var(--text-4)' }}>
              Actifs ({risques.filter(r=>!r.archived_at).length})
            </button>
            <button onClick={() => setShowArchive(true)} style={{ fontSize:12, fontWeight:700, padding:'3px 14px', borderRadius:100, border:'1px solid', cursor:'pointer', background:showArchive?'rgba(100,116,139,0.18)':'transparent', borderColor:showArchive?'rgba(100,116,139,0.5)':'rgba(255,255,255,0.1)', color:showArchive?'#94A3B8':'var(--text-4)' }}>
              <History size={11} style={{display:'inline',marginRight:4}}/>Historique ({risques.filter(r=>r.archived_at).length})
            </button>
          </div>
        </div>
        <div className="flex gap-3 flex-wrap">
          <GestionListes
            listes={{ 'Unités de travail': listeUT }}
            onSave={(key, list) => { if (key === 'Unités de travail') setListeUT(list); }}
            storageKey="duerp"
          />
          <button onClick={() => setShowMatrice(v => !v)} className="btn-secondary"><Grid size={16}/> Matrice</button>
          <button onClick={fetchRisques} className="btn-secondary"><RefreshCw size={16} className={loading ? 'animate-spin' : ''}/> Actualiser</button>
          {!showArchive && <button onClick={() => setShowForm(true)} className="btn-primary" style={{ background: '#F59E0B', boxShadow: '0 0 20px rgba(245,158,11,0.3)' }}>
            <Plus size={16}/> Identifier un risque
          </button>}
        </div>
      </header>

      {/* ── KPIs ────────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: 'Total risques',        val: kpis.total,         color: 'blue',                                               sub: 'Évalués' },
          { label: 'Inacceptables (≥13)',  val: kpis.inacceptable,  color: kpis.inacceptable  > 0 ? 'red'    : 'green',         sub: 'Traitement urgent' },
          { label: 'Action requise (9-12)',val: kpis.actionRequise, color: kpis.actionRequise > 0 ? 'orange' : 'green',         sub: "Plan d'action requis" },
          { label: 'À surveiller (5-8)',   val: kpis.surveillance,  color: 'amber',                                             sub: 'Contrôle périodique' },
          { label: 'Acceptables (1-4)',    val: kpis.acceptables,   color: 'green',                                             sub: 'Maîtrisés' },
        ].map((k, i) => (
          <div key={i} className={`kpi-card ${k.color}`}>
            <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: p.text3 }}>{k.label}</p>
            <p className="text-3xl font-black" style={{ color: p.text1 }}>{k.val}</p>
            <p className="text-xs mt-2" style={{ color: p.text4 }}>{k.sub}</p>
          </div>
        ))}
      </div>

      {/* ── Alertes ─────────────────────────────────────────────────────────── */}
      {(kpis.inacceptable > 0 || kpis.actionRequise > 0) && (
        <div className="alert-banner alert-red">
          <AlertOctagon size={18} className="shrink-0"/>
          <div>
            <p className="font-bold">
              {kpis.inacceptable > 0 && `${kpis.inacceptable} risque${kpis.inacceptable > 1 ? 's' : ''} inacceptable${kpis.inacceptable > 1 ? 's' : ''}`}
              {kpis.inacceptable > 0 && kpis.actionRequise > 0 && ' · '}
              {kpis.actionRequise > 0 && `${kpis.actionRequise} nécessitant une action immédiate`}
            </p>
            <p className="text-xs mt-0.5 opacity-80">
              {risques.filter(r => (r.criticite_resid || r.criticite || 1) >= 9).slice(0, 3).map(r => r.danger?.substring(0, 40)).join(' · ')}
            </p>
          </div>
        </div>
      )}
      {kpis.sansAction > 0 && (
        <div className="alert-banner alert-amber">
          <AlertOctagon size={18} className="shrink-0"/>
          <p className="font-bold">{kpis.sansAction} risque{kpis.sansAction > 1 ? 's' : ''} critique{kpis.sansAction > 1 ? 's' : ''} sans action préventive définie</p>
        </div>
      )}

      {/* ── Matrice ─────────────────────────────────────────────────────────── */}
      {showMatrice && <MatriceRisques />}

      {/* ── Formulaire d'ajout ──────────────────────────────────────────────── */}
      {showForm && (
        <div className="glass-panel p-6 animate-fade-up" style={{ border: '1px solid rgba(245,158,11,0.3)' }}>
          <div className="flex justify-between items-center mb-5">
            <h3 className="font-bold text-lg flex items-center gap-2" style={{ color: p.text1 }}>
              <Plus size={18} style={{ color: '#F59E0B' }}/> Identifier un risque
            </h3>
            <button onClick={() => setShowForm(false)} style={{ color: p.text4, background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}><X size={18}/></button>
          </div>

          {/* ① Organisation */}
          <div style={{ background: p.whiteFaint2, border: '1px solid ' + p.border, borderRadius: 10, padding: '14px 16px', marginBottom: 14 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: p.blue, marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.06em' }}>① Organisation</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label style={lbl}>Unité de travail *</label>
                <select value={form.unite_travail} onChange={e => setForm({ ...form, unite_travail: e.target.value })} className="input-modern">
                  {listeUT.map(ut => <option key={ut}>{ut}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>Famille de risque</label>
                <select value={form.famille_risque} onChange={e => setForm({ ...form, famille_risque: e.target.value })} className="input-modern">
                  <option value="">— Sélectionner —</option>
                  {FAMILLES_RISQUES.map(f => <option key={f}>{f}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* ② Identification */}
          <div style={{ background: p.whiteFaint2, border: '1px solid ' + p.border, borderRadius: 10, padding: '14px 16px', marginBottom: 14 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: p.amber, marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.06em' }}>② Identification du risque</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label style={lbl}>Danger précis *</label>
                <input type="text" value={form.danger} onChange={e => setForm({ ...form, danger: e.target.value })} placeholder="Ex: Sol glissant en zone de production humide..." className="input-modern"/>
              </div>
              <div>
                <label style={lbl}>Événement déclencheur</label>
                <input type="text" value={form.evenement_declencheur} onChange={e => setForm({ ...form, evenement_declencheur: e.target.value })} placeholder="Ex: Déversement de liquide..." className="input-modern"/>
              </div>
              <div>
                <label style={lbl}>Dommage potentiel</label>
                <input type="text" value={form.dommage_potentiel} onChange={e => setForm({ ...form, dommage_potentiel: e.target.value })} placeholder="Ex: Fracture, entorse, brûlure..." className="input-modern"/>
              </div>
              <div className="md:col-span-2">
                <label style={lbl}>Personnes exposées</label>
                {/* Tags multi-sélection */}
                <div style={{ border: '1px solid var(--border)', borderRadius: 9, background: 'var(--bg-input)', padding: '6px 8px', minHeight: 42, display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                  {(form.personnes_exposees || []).map(pe => (
                    <span key={pe} style={{ display:'inline-flex', alignItems:'center', gap:4, background:'rgba(79,99,231,0.15)', border:'1px solid rgba(79,99,231,0.35)', color:'var(--blue)', borderRadius:6, padding:'2px 8px', fontSize:12, fontWeight:600 }}>
                      {pe}
                      <button onClick={() => setForm({ ...form, personnes_exposees: form.personnes_exposees.filter(x => x !== pe) })}
                        style={{ background:'none', border:'none', cursor:'pointer', color:'var(--blue)', padding:'0 2px', lineHeight:1, fontSize:14 }}>×</button>
                    </span>
                  ))}
                  <select
                    value=""
                    onChange={e => {
                      const v = e.target.value;
                      if (v && !(form.personnes_exposees || []).includes(v))
                        setForm({ ...form, personnes_exposees: [...(form.personnes_exposees || []), v] });
                    }}
                    style={{ border:'none', background:'transparent', color:'var(--text-3)', fontSize:13, cursor:'pointer', outline:'none', flex:1, minWidth:120 }}>
                    <option value="">+ Ajouter...</option>
                    {PERSONNES_EXPOSEES_LIST.filter(pe => !(form.personnes_exposees || []).includes(pe)).map(pe => <option key={pe} value={pe}>{pe}</option>)}
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* ③ Cotation initiale */}
          <div style={{ background: p.whiteFaint2, border: '1px solid ' + p.border, borderRadius: 10, padding: '14px 16px', marginBottom: 14 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: p.purple, marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.06em' }}>③ Cotation initiale (G × F)</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
              {[
                { label: 'Gravité (1=légère → 4=mortelle)', key: 'gravite',     tips: ['Premiers soins', 'Arrêt <10j', 'Arrêt >10j / IPP', 'Décès / IPT'] },
                { label: 'Fréquence (1=rare → 4=permanent)', key: 'probabilite', tips: ['< 1×/an', 'Quelques fois/an', 'Hebdomadaire', 'Quotidien'] },
              ].map(f => (
                <div key={f.key}>
                  <label style={lbl}>{f.label}</label>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {[1, 2, 3, 4].map(v => {
                      const sel   = Number(form[f.key]) === v;
                      const color = v >= 4 ? '#EF4444' : v >= 3 ? '#F97316' : v >= 2 ? '#F59E0B' : '#10B981';
                      return (
                        <button key={v} title={f.tips[v - 1]}
                          onClick={() => setForm({ ...form, [f.key]: v })}
                          style={{ flex: 1, height: 44, borderRadius: 8, border: `2px solid ${sel ? color : p.border}`, background: sel ? `${color}20` : p.bgInput, color: sel ? color : p.text3, fontWeight: 800, fontSize: 17, cursor: 'pointer', transition: 'all 0.15s' }}>
                          {v}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
              {/* Badge criticité initiale */}
              <div>
                <label style={lbl}>Criticité initiale</label>
                {(() => {
                  const ci   = form.gravite * form.probabilite;
                  const info = getCInfo(ci, isDark);
                  return (
                    <div style={{ background: info.bg, border: `1.5px solid ${info.border}`, borderRadius: 8, padding: '10px 14px', textAlign: 'center' }}>
                      <div style={{ fontSize: 28, fontWeight: 900, color: info.color }}>{ci}</div>
                      <div style={{ fontSize: 10, fontWeight: 700, color: info.color, marginTop: 2 }}>{info.label}</div>
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>

          {/* ④ Mesures de maîtrise */}
          <div style={{ background: p.whiteFaint2, border: '1px solid ' + p.border, borderRadius: 10, padding: '14px 16px', marginBottom: 14 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: '#3B82F6', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.06em' }}>④ Mesures de maîtrise existantes</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { key: 'a_mesure_epc',  descKey: 'mesures_epc',  label: 'EPC — Protection Collective',     color: '#3B82F6', coeff: '×0.50', ph: 'Garde-corps, aspiration, écran, détecteur...' },
                { key: 'a_mesure_orga', descKey: 'mesures_orga', label: 'ORG — Organisationnelle',         color: '#8B5CF6', coeff: '×0.70', ph: 'Procédure, permis, habilitation, formation...' },
                { key: 'a_mesure_epi',  descKey: 'mesures_epi',  label: 'EPI — Protection Individuelle',   color: '#F59E0B', coeff: '×0.80', ph: 'Casque, harnais, lunettes, gants...' },
              ].map(m => (
                <div key={m.key}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <button
                      onClick={() => setForm({ ...form, [m.key]: !form[m.key] })}
                      style={{ width: 22, height: 22, borderRadius: 5, border: `2px solid ${form[m.key] ? m.color : p.border}`, background: form[m.key] ? m.color : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
                      {form[m.key] && <span style={{ color: 'white', fontSize: 14, lineHeight: 1 }}>✓</span>}
                    </button>
                    <span
                      onClick={() => setForm({ ...form, [m.key]: !form[m.key] })}
                      style={{ fontSize: 10, fontWeight: 700, color: form[m.key] ? m.color : p.text3, textTransform: 'uppercase', letterSpacing: '0.06em', cursor: 'pointer' }}>
                      {m.label} <span style={{ opacity: 0.6 }}>({m.coeff})</span>
                    </span>
                  </div>
                  <input type="text" disabled={!form[m.key]} value={form[m.descKey]}
                    onChange={e => setForm({ ...form, [m.descKey]: e.target.value })}
                    placeholder={m.ph} className="input-modern"
                    style={{ fontSize: 11, opacity: form[m.key] ? 1 : 0.4 }}/>
                </div>
              ))}
            </div>
            {/* Résultat pondération */}
            {(() => {
              const coeff = getCoefficient(form.a_mesure_epc, form.a_mesure_orga, form.a_mesure_epi);
              const ci    = form.gravite * form.probabilite;
              const cr    = calcCR(form.gravite, form.probabilite, form.a_mesure_epc, form.a_mesure_orga, form.a_mesure_epi);
              const info  = getCInfo(cr, isDark);
              return (
                <div style={{ marginTop: 14, background: info.bg, border: `1.5px solid ${info.border}`, borderRadius: 8, padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 12, color: p.text3 }}>CI={ci} × Cr=<strong style={{ color: p.text1 }}>{coeff}</strong> =</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 30, fontWeight: 900, color: info.color }}>{cr}</span>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: info.color }}>{info.label}</div>
                      <div style={{ fontSize: 10, color: p.text4 }}>Criticité résiduelle</div>
                    </div>
                  </div>
                  {coeff < 1 && <span style={{ fontSize: 11, color: isDark ? '#6EE7B7' : '#047857', fontWeight: 600 }}>↓ {Math.round((1 - coeff) * 100)}% de réduction</span>}
                </div>
              );
            })()}
          </div>

          {/* ⑤ Action planifiée */}
          <div style={{ background: p.whiteFaint2, border: '1px solid ' + p.border, borderRadius: 10, padding: '14px 16px', marginBottom: 14 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: p.green, marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.06em' }}>⑤ Action planifiée (si criticité résiduelle ≥ 5)</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-3">
                <label style={lbl}>Description de l'action</label>
                <input type="text" value={form.action_preventive} onChange={e => setForm({ ...form, action_preventive: e.target.value })} placeholder="Ex: Installer un revêtement antidérapant + douche oculaire..." className="input-modern"/>
              </div>
              <div>
                <label style={lbl}>Pilote</label>
                <input type="text" value={form.pilote || ''} onChange={e => setForm({ ...form, pilote: e.target.value })} placeholder="Responsable de l'action..." className="input-modern"/>
              </div>
              <div>
                <label style={lbl}>Échéance</label>
                <input type="date" value={form.echeance || ''} onChange={e => setForm({ ...form, echeance: e.target.value })} className="input-modern"/>
              </div>
              <div>
                <label style={lbl}>Date M.A.J.</label>
                <input type="date" value={form.date_maj} onChange={e => setForm({ ...form, date_maj: e.target.value })} className="input-modern"/>
              </div>
            </div>
          </div>

          {saveError && (
            <div className="alert-banner alert-red mb-3">
              <AlertOctagon size={15} className="shrink-0"/>
              <p style={{ fontSize: 13 }}>{saveError}</p>
            </div>
          )}
          <div className="flex gap-3">
            <button onClick={() => { setShowForm(false); setSaveError(''); }} className="btn-secondary">Annuler</button>
            <button onClick={ajouterRisque} disabled={!form.danger.trim()} className="btn-primary" style={{ background: '#F59E0B', boxShadow: '0 0 16px rgba(245,158,11,0.3)' }}>
              <Save size={16}/> Enregistrer le risque
            </button>
          </div>
        </div>
      )}

      {/* ── Filtres ─────────────────────────────────────────────────────────── */}
      <div className="glass-panel p-4 flex flex-wrap gap-3 items-center">
        <Filter size={15} style={{ color: p.text4 }} className="shrink-0"/>
        <div className="flex gap-2 flex-wrap">
          {['Tous', ...listeUT].map(ut => (
            <button key={ut} onClick={() => setFiltreUT(ut)} style={{ fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 100, border: '1px solid', cursor: 'pointer', transition: 'all 0.12s',
              background:   filtreUT === ut ? 'rgba(245,158,11,0.2)' : p.whiteFaint2,
              borderColor:  filtreUT === ut ? 'rgba(245,158,11,0.4)' : p.border,
              color:        filtreUT === ut ? (isDark ? '#FCD34D' : '#713F12') : p.text3 }}>{ut}</button>
          ))}
        </div>
        <div style={{ width: 1, height: 16, background: p.border }}/>
        {['Tous', 'Inacceptable', 'Action requise', 'À surveiller', 'Acceptable'].map(n => {
          const color = n === 'Inacceptable' ? '#EF4444' : n === 'Action requise' ? '#F97316' : n === 'À surveiller' ? '#F59E0B' : n === 'Acceptable' ? '#10B981' : '#3B82F6';
          return (
            <button key={n} onClick={() => setFiltreNiveau(n)} style={{ fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 100, border: '1px solid', cursor: 'pointer', transition: 'all 0.12s',
              background:  filtreNiveau === n ? `${color}20` : p.whiteFaint2,
              borderColor: filtreNiveau === n ? `${color}50` : p.border,
              color:       filtreNiveau === n ? color : p.text3 }}>{n}</button>
          );
        })}
        {(filtreUT !== 'Tous' || filtreNiveau !== 'Tous') && (
          <button onClick={() => { setFiltreUT('Tous'); setFiltreNiveau('Tous'); }}
            style={{ color: p.text4, background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, display: 'flex', alignItems: 'center', gap: 4, marginLeft: 'auto', fontFamily: 'inherit' }}>
            <X size={12}/> Reset
          </button>
        )}
        <span style={{ color: p.text4, fontSize: 11, marginLeft: 'auto' }}>{risquesFiltres.length} risque{risquesFiltres.length > 1 ? 's' : ''}</span>
      </div>

      {/* ── Tableau ─────────────────────────────────────────────────────────── */}
      <div className="glass-panel">
        {loading ? (
          <div className="p-10 text-center">
            <RefreshCw size={28} className="animate-spin text-blue-400 mx-auto mb-3"/>
            <p style={{ color: p.text3 }}>Chargement...</p>
          </div>
        ) : risquesFiltres.length === 0 ? (
          <div className="p-10 text-center">
            <Shield size={36} className="text-emerald-400 mx-auto mb-3"/>
            <p className="font-bold" style={{ color: p.text1 }}>{risques.length === 0 ? 'Aucun risque identifié.' : 'Aucun risque pour ces filtres.'}</p>
            {risques.length === 0 && <p style={{ color: p.text3, fontSize: 13, marginTop: 6 }}>Cliquez sur "Identifier un risque" pour commencer votre évaluation.</p>}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table-modern" style={{ minWidth: 1060 }}>
              <thead>
                <tr>
                  <th style={{ width: 130 }}>Unité de travail</th>
                  <th style={{ minWidth: 170 }}>Famille · Danger</th>
                  <th style={{ minWidth: 140 }}>Dommage / Exposés</th>
                  <th style={{ width: 56, textAlign: 'center' }}>G</th>
                  <th style={{ width: 56, textAlign: 'center' }}>F</th>
                  <th style={{ width: 72, textAlign: 'center' }}>CI</th>
                  <th style={{ width: 96, textAlign: 'center' }}>Mesures</th>
                  <th style={{ width: 84, textAlign: 'center' }}>CR</th>
                  <th style={{ minWidth: 170 }}>Action préventive</th>
                  <th style={{ width: 100 }}>Pilote</th>
                  <th style={{ width: 40 }}/>
                </tr>
              </thead>
              <tbody>
                {risquesFiltres.map(row => {
                  const ci       = Number(row.gravite || 1) * Number(row.probabilite || 1);
                  const cr       = row.criticite_resid ?? calcCR(row.gravite, row.probabilite, row.a_mesure_epc, row.a_mesure_orga, row.a_mesure_epi);
                  const ciInfo   = getCInfo(ci, isDark);
                  const crInfo   = getCInfo(cr, isDark);
                  const leftBorder = cr >= 13 ? '#EF4444' : cr >= 9 ? '#F97316' : cr >= 5 ? '#F59E0B' : '#10B981';

                  return (
                    <tr key={row.id} style={{ borderLeft: `3px solid ${leftBorder}` }}>

                      {/* Unité de travail */}
                      <td>
                        <select value={row.unite_travail || listeUT[0]}
                          onChange={e => {
                            const v = e.target.value;
                            updateRow(row.id, { unite_travail: v });
                            saveRowDirect({ ...row, ...risquesRef.current.find(r => r.id === row.id), unite_travail: v });
                          }}
                          style={{ ...inp, cursor: 'pointer' }}>
                          {listeUT.map(ut => <option key={ut}>{ut}</option>)}
                        </select>
                      </td>

                      {/* Famille · Danger */}
                      <td>
                        {row.famille_risque && (
                          <div style={{ fontSize: 10, color: p.blue, fontWeight: 700, marginBottom: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.famille_risque}</div>
                        )}
                        <input type="text" value={row.danger || ''}
                          onChange={e => updateRow(row.id, { danger: e.target.value })}
                          onBlur={() => saveRowById(row.id)}
                          placeholder="Danger..." style={{ ...inp, fontWeight: 600 }}/>
                      </td>

                      {/* Dommage / Exposés */}
                      <td>
                        <div style={{ fontSize: 11, color: p.text2, marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {row.dommage_potentiel || <span style={{ color: p.text4 }}>—</span>}
                        </div>
                        <div style={{ fontSize: 10, color: p.text4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.personnes_exposees || ''}</div>
                      </td>

                      {/* G */}
                      <td className="text-center">
                        <select value={row.gravite || 1}
                          onChange={e => {
                            const g = Number(e.target.value);
                            const cur = risquesRef.current.find(r => r.id === row.id) || row;
                            const upd = { ...cur, gravite: g, criticite: g * Number(cur.probabilite || 1), criticite_resid: calcCR(g, cur.probabilite, cur.a_mesure_epc, cur.a_mesure_orga, cur.a_mesure_epi), coefficient_reducteur: getCoefficient(cur.a_mesure_epc, cur.a_mesure_orga, cur.a_mesure_epi) };
                            updateRow(row.id, { gravite: g });
                            saveRowDirect(upd);
                          }}
                          style={{ ...inp, color: Number(row.gravite) >= 3 ? '#EF4444' : '#F59E0B', fontWeight: 800, fontSize: 14, padding: '5px 2px', textAlign: 'center', cursor: 'pointer' }}>
                          {[1, 2, 3, 4].map(v => <option key={v} value={v}>{v}</option>)}
                        </select>
                      </td>

                      {/* F */}
                      <td className="text-center">
                        <select value={row.probabilite || 1}
                          onChange={e => {
                            const f = Number(e.target.value);
                            const cur = risquesRef.current.find(r => r.id === row.id) || row;
                            const upd = { ...cur, probabilite: f, criticite: Number(cur.gravite || 1) * f, criticite_resid: calcCR(cur.gravite, f, cur.a_mesure_epc, cur.a_mesure_orga, cur.a_mesure_epi), coefficient_reducteur: getCoefficient(cur.a_mesure_epc, cur.a_mesure_orga, cur.a_mesure_epi) };
                            updateRow(row.id, { probabilite: f });
                            saveRowDirect(upd);
                          }}
                          style={{ ...inp, color: Number(row.probabilite) >= 3 ? '#EF4444' : '#F59E0B', fontWeight: 800, fontSize: 14, padding: '5px 2px', textAlign: 'center', cursor: 'pointer' }}>
                          {[1, 2, 3, 4].map(v => <option key={v} value={v}>{v}</option>)}
                        </select>
                      </td>

                      {/* CI — Criticité Initiale */}
                      <td className="text-center">
                        <div style={{ background: ciInfo.bg, border: `1px solid ${ciInfo.border}`, borderRadius: 6, padding: '4px 2px', fontWeight: 900, fontSize: 16, color: ciInfo.color, textAlign: 'center' }}>{ci}</div>
                      </td>

                      {/* Mesures — 3 boutons toggle EPC / ORG / EPI */}
                      <td className="text-center">
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, alignItems: 'center' }}>
                          {[
                            { key: 'a_mesure_epc',  label: 'EPC', color: '#3B82F6' },
                            { key: 'a_mesure_orga', label: 'ORG', color: '#8B5CF6' },
                            { key: 'a_mesure_epi',  label: 'EPI', color: '#F59E0B' },
                          ].map(m => (
                            <button key={m.key}
                              onClick={() => {
                                const cur = risquesRef.current.find(r => r.id === row.id) || row;
                                const val = !cur[m.key];
                                const epc  = m.key === 'a_mesure_epc'  ? val : cur.a_mesure_epc;
                                const orga = m.key === 'a_mesure_orga' ? val : cur.a_mesure_orga;
                                const epi  = m.key === 'a_mesure_epi'  ? val : cur.a_mesure_epi;
                                const upd  = { ...cur, [m.key]: val, criticite_resid: calcCR(cur.gravite, cur.probabilite, epc, orga, epi), coefficient_reducteur: getCoefficient(epc, orga, epi) };
                                updateRow(row.id, { [m.key]: val });
                                saveRowDirect(upd);
                              }}
                              style={{ fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 4, border: `1px solid ${row[m.key] ? m.color + '60' : p.border}`, background: row[m.key] ? `${m.color}20` : p.whiteFaint2, color: row[m.key] ? m.color : p.text4, cursor: 'pointer', width: 36, transition: 'all 0.15s' }}>
                              {m.label}
                            </button>
                          ))}
                        </div>
                      </td>

                      {/* CR — Criticité Résiduelle */}
                      <td className="text-center">
                        <div style={{ background: crInfo.bg, border: `1.5px solid ${crInfo.border}`, borderRadius: 8, padding: '6px 4px', fontWeight: 900, fontSize: 18, color: crInfo.color, textAlign: 'center' }}>{cr}</div>
                        <div style={{ fontSize: 9, color: crInfo.color, fontWeight: 700, marginTop: 2, textAlign: 'center', lineHeight: 1.2 }}>{crInfo.label}</div>
                      </td>

                      {/* Action préventive */}
                      <td>
                        <input type="text" value={row.action_preventive || ''}
                          onChange={e => updateRow(row.id, { action_preventive: e.target.value })}
                          onBlur={() => saveRowById(row.id)}
                          placeholder="Mesure préventive..." style={{ ...inp, fontSize: 11 }}/>
                      </td>

                      {/* Pilote */}
                      <td>
                        <input type="text" value={row.pilote || ''}
                          onChange={e => updateRow(row.id, { pilote: e.target.value })}
                          onBlur={() => saveRowById(row.id)}
                          placeholder="Pilote..." style={{ ...inp, fontSize: 11 }}/>
                      </td>

                      {/* Archive / Restaurer */}
                      <td className="text-center">
                        {saving === row.id
                          ? <RefreshCw size={13} className="animate-spin text-blue-400 mx-auto"/>
                          : showArchive
                            ? <div style={{ display:'flex', gap:2, justifyContent:'center' }}>
                                <button onClick={() => restoreRow(row.id)} title="Restaurer" style={{ color:'#10B981', background:'none', border:'none', cursor:'pointer', padding:5 }}><RotateCcw size={13}/></button>
                                <button onClick={() => deleteRow(row.id)} title="Supprimer définitivement" style={{ color:'#EF4444', background:'none', border:'none', cursor:'pointer', padding:5 }}><Trash2 size={13}/></button>
                              </div>
                            : <button onClick={() => archiveRow(row.id)} title="Archiver" style={{ color: p.text4, background: 'none', border: 'none', cursor: 'pointer', padding: 6 }} className="hover:text-amber-400"><Archive size={14}/></button>
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
