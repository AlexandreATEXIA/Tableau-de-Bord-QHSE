import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from './supabaseClient';
import { useTheme } from './ThemeContext';
import {
  Target, Plus, Edit2, Trash2, Save, X, CheckCircle,
  AlertTriangle, TrendingUp, TrendingDown, ShieldAlert,
  HeartPulse, Leaf, Users, Award, RefreshCw, ChevronDown, ChevronUp
} from 'lucide-react';

const ANNEE = new Date().getFullYear();

const CATEGORIES = [
  { id:'securite',  label:'Sécurité',   color:'#EF4444', bg:'rgba(239,68,68,0.12)',  bgL:'#FEF2F2',  colorL:'#991B1B',  icon:HeartPulse },
  { id:'qualite',   label:'Qualité',    color:'#4F63E7', bg:'rgba(79,99,231,0.12)',  bgL:'#EEF2FF',  colorL:'#3730A3',  icon:ShieldAlert },
  { id:'environnement', label:'Environnement', color:'#10B981', bg:'rgba(16,185,129,0.12)', bgL:'#ECFDF5', colorL:'#065F46', icon:Leaf },
  { id:'rh',        label:'Social & RH', color:'#8B5CF6', bg:'rgba(139,92,246,0.12)', bgL:'#F5F3FF', colorL:'#5B21B6', icon:Users },
];

/* ─── Objectifs par défaut ─────────────────────────────────────────────── */
const OBJECTIFS_DEFAUT = [
  { categorie:'securite',      titre:'Accidents avec arrêt',       description:'Nombre d\'AT avec arrêt de travail',              valeur_cible:0,   unite:'AT',  sens:'min' },
  { categorie:'securite',      titre:'Taux de fréquence (TF)',     description:'TF = (AT×10⁶) / heures travaillées',              valeur_cible:0,   unite:'TF',  sens:'min' },
  { categorie:'securite',      titre:'Habilitations à jour',       description:'% d\'habilitations non expirées',                 valeur_cible:95,  unite:'%',   sens:'max' },
  { categorie:'qualite',       titre:'NC clôturées',               description:'% de non-conformités clôturées',                  valeur_cible:90,  unite:'%',   sens:'max' },
  { categorie:'qualite',       titre:'Score audit moyen',          description:'Score moyen des audits internes',                  valeur_cible:80,  unite:'%',   sens:'max' },
  { categorie:'qualite',       titre:'Actions PDCA terminées',     description:'% d\'actions du plan clôturées',                  valeur_cible:85,  unite:'%',   sens:'max' },
  { categorie:'environnement', titre:'Réduction déchets',          description:'Objectif de réduction vs année précédente',       valeur_cible:10,  unite:'%',   sens:'max' },
  { categorie:'rh',            titre:'Taux de formation',          description:'% d\'employés ayant suivi au moins 1 formation',  valeur_cible:80,  unite:'%',   sens:'max' },
  { categorie:'rh',            titre:'Absentéisme',                description:'Taux d\'absentéisme annuel',                      valeur_cible:3,   unite:'%',   sens:'min' },
];

/* ─── Jauge circulaire SVG ─────────────────────────────────────────────── */
function JaugeCirculaire({ pct, color, size = 90, statut }) {
  const r = (size - 12) / 2;
  const circ = 2 * Math.PI * r;
  const dash = Math.min(pct, 100) / 100 * circ;
  const statusColors = { atteint:'#10B981', 'en-cours':color, danger:'#F59E0B', 'non-demarre':'#64748B' };
  const c = statusColors[statut] || color;

  return (
    <svg width={size} height={size} style={{ transform:'rotate(-90deg)', flexShrink:0 }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--border)" strokeWidth={8}/>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={c} strokeWidth={8}
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
        style={{ transition:'stroke-dasharray 0.8s ease, stroke 0.3s' }}
      />
    </svg>
  );
}

/* ─── Barre de progression ─────────────────────────────────────────────── */
function Barre({ pct, color, statut }) {
  const statusColors = { atteint:'#10B981', 'en-cours':color, danger:'#F59E0B', 'non-demarre':'#64748B' };
  const c = statusColors[statut] || color;
  return (
    <div style={{ height:6, borderRadius:3, background:'var(--border)', overflow:'hidden' }}>
      <div style={{ height:'100%', width:`${Math.min(pct,100)}%`, background:c, borderRadius:3, transition:'width 0.8s ease' }}/>
    </div>
  );
}

/* ─── Badge statut ─────────────────────────────────────────────────────── */
function BadgeStatut({ statut }) {
  const cfg = {
    'atteint':      { label:'✅ Atteint',       bg:'rgba(16,185,129,0.12)',  color:'#10B981', bgL:'#ECFDF5', cL:'#065F46' },
    'en-cours':     { label:'🔵 En cours',      bg:'rgba(59,130,246,0.12)',  color:'#3B82F6', bgL:'#EFF6FF', cL:'#1D4ED8' },
    'danger':       { label:'⚠️ En danger',    bg:'rgba(245,158,11,0.12)', color:'#F59E0B', bgL:'#FFFBEB', cL:'#B45309' },
    'non-demarre':  { label:'⏸ Non démarré',   bg:'rgba(100,116,139,0.12)', color:'#64748B', bgL:'#F8FAFC', cL:'#475569' },
  };
  const s = cfg[statut] || cfg['non-demarre'];
  return (
    <span style={{ fontSize:11, fontWeight:700, padding:'3px 9px', borderRadius:100,
      background:s.bg, color:s.color, whiteSpace:'nowrap' }}>
      {s.label}
    </span>
  );
}

/* ─── Formulaire ajout/édition ─────────────────────────────────────────── */
function FormulaireObjectif({ initial, onSave, onCancel, p }) {
  const [form, setForm] = useState(initial || {
    categorie:'securite', titre:'', description:'', valeur_cible:'', unite:'%', sens:'max', annee: ANNEE
  });
  const set = (k,v) => setForm(f => ({ ...f, [k]:v }));

  return (
    <div style={{ background:p.bgCard2, border:`1px solid var(--border)`, borderRadius:14, padding:20, display:'flex', flexDirection:'column', gap:14 }}>
      <div style={{ fontSize:14, fontWeight:700, color:p.text1 }}>{initial?.id ? 'Modifier l\'objectif' : 'Nouvel objectif'}</div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
        <div>
          <label style={{ fontSize:11, fontWeight:700, color:p.text3, textTransform:'uppercase', letterSpacing:'0.06em' }}>Catégorie</label>
          <select value={form.categorie} onChange={e=>set('categorie',e.target.value)} className="input-modern" style={{ marginTop:5 }}>
            {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
        </div>
        <div>
          <label style={{ fontSize:11, fontWeight:700, color:p.text3, textTransform:'uppercase', letterSpacing:'0.06em' }}>Année</label>
          <input type="number" value={form.annee} onChange={e=>set('annee',e.target.value)} className="input-modern" style={{ marginTop:5 }} min={2020} max={2030}/>
        </div>
      </div>
      <div>
        <label style={{ fontSize:11, fontWeight:700, color:p.text3, textTransform:'uppercase', letterSpacing:'0.06em' }}>Titre de l'objectif *</label>
        <input value={form.titre} onChange={e=>set('titre',e.target.value)} className="input-modern" style={{ marginTop:5 }} placeholder="ex: Zéro accident avec arrêt"/>
      </div>
      <div>
        <label style={{ fontSize:11, fontWeight:700, color:p.text3, textTransform:'uppercase', letterSpacing:'0.06em' }}>Description</label>
        <input value={form.description} onChange={e=>set('description',e.target.value)} className="input-modern" style={{ marginTop:5 }} placeholder="Explication de l'objectif"/>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12 }}>
        <div>
          <label style={{ fontSize:11, fontWeight:700, color:p.text3, textTransform:'uppercase', letterSpacing:'0.06em' }}>Cible *</label>
          <input type="number" value={form.valeur_cible} onChange={e=>set('valeur_cible',e.target.value)} className="input-modern" style={{ marginTop:5 }} placeholder="90"/>
        </div>
        <div>
          <label style={{ fontSize:11, fontWeight:700, color:p.text3, textTransform:'uppercase', letterSpacing:'0.06em' }}>Unité</label>
          <input value={form.unite} onChange={e=>set('unite',e.target.value)} className="input-modern" style={{ marginTop:5 }} placeholder="%, AT, jours..."/>
        </div>
        <div>
          <label style={{ fontSize:11, fontWeight:700, color:p.text3, textTransform:'uppercase', letterSpacing:'0.06em' }}>Sens</label>
          <select value={form.sens} onChange={e=>set('sens',e.target.value)} className="input-modern" style={{ marginTop:5 }}>
            <option value="max">↑ Plus c'est haut mieux c'est</option>
            <option value="min">↓ Plus c'est bas mieux c'est</option>
          </select>
        </div>
      </div>
      <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
        <button onClick={onCancel} className="btn-secondary"><X size={14}/> Annuler</button>
        <button onClick={() => onSave(form)} className="btn-primary" disabled={!form.titre || form.valeur_cible===''}>
          <Save size={14}/> Enregistrer
        </button>
      </div>
    </div>
  );
}

/* ─── Composant principal ─────────────────────────────────────────────── */

/* ─── Ligne objectif (composant isolé pour respecter les règles des hooks) ── */
function ObjectifRow({ obj, cat, isDark, p, onEdit, onDelete, onSaveVal, getPct, getStatut, getValeurReelle }) {
  const [editVal, setEditVal]     = useState(String(obj.valeur_reelle ?? ''));
  const [editingVal, setEditingVal] = useState(false);

  const pct      = getPct(obj);
  const statut   = getStatut(pct, obj);
  const reelAuto = getValeurReelle(obj);
  const reelAffiche = reelAuto !== null ? reelAuto : (obj.valeur_reelle ?? null);
  const isAuto   = reelAuto !== null;

  return (
    <div style={{ background:p.bgCard2, border:`1px solid ${p.border}`, borderRadius:14, padding:'16px 18px' }}>
      <div style={{ display:'flex', gap:16, alignItems:'center' }}>
        {/* Jauge */}
        <div style={{ position:'relative', width:90, height:90, flexShrink:0 }}>
          <JaugeCirculaire pct={pct} color={isDark?cat.color:cat.colorL} size={90} statut={statut}/>
          <div style={{ position:'absolute', inset:0, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center' }}>
            <span style={{ fontSize:17, fontWeight:900, color:p.text1, lineHeight:1 }}>{pct}%</span>
          </div>
        </div>

        {/* Infos */}
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:6, gap:8 }}>
            <div>
              <div style={{ fontSize:14, fontWeight:700, color:p.text1 }}>{obj.titre}</div>
              {obj.description && <div style={{ fontSize:12, color:p.text3, marginTop:2 }}>{obj.description}</div>}
            </div>
            <div style={{ display:'flex', gap:6, alignItems:'center', flexShrink:0 }}>
              <BadgeStatut statut={statut}/>
              <button onClick={()=>onEdit(obj)} style={{ background:'none', border:'none', cursor:'pointer', color:p.text3, padding:4 }}><Edit2 size={13}/></button>
              <button onClick={()=>onDelete(obj.id)} style={{ background:'none', border:'none', cursor:'pointer', color:'#EF4444', padding:4 }}><Trash2 size={13}/></button>
            </div>
          </div>

          {/* Barre */}
          <div style={{ marginBottom:10 }}>
            <Barre pct={pct} color={isDark?cat.color:cat.colorL} statut={statut}/>
          </div>

          {/* Valeurs */}
          <div style={{ display:'flex', alignItems:'center', gap:16, flexWrap:'wrap' }}>
            <div style={{ display:'flex', gap:4, alignItems:'center' }}>
              <span style={{ fontSize:11, color:p.text3 }}>Cible :</span>
              <span style={{ fontSize:13, fontWeight:800, color:p.text1 }}>{obj.valeur_cible} {obj.unite}</span>
              <span style={{ fontSize:10, color:p.text4, marginLeft:2 }}>{obj.sens==='min'?'↓ min':'↑ max'}</span>
            </div>
            <div style={{ display:'flex', gap:4, alignItems:'center' }}>
              <span style={{ fontSize:11, color:p.text3 }}>Réel :</span>
              {isAuto ? (
                <span style={{ fontSize:13, fontWeight:800, color:isDark?cat.color:cat.colorL }}>
                  {reelAffiche} {obj.unite}
                  <span style={{ fontSize:10, color:p.text4, marginLeft:4, fontWeight:500 }}>auto</span>
                </span>
              ) : editingVal ? (
                <div style={{ display:'flex', gap:4 }}>
                  <input type="number" value={editVal} onChange={e=>setEditVal(e.target.value)}
                    className="input-modern" style={{ width:80, padding:'3px 8px', fontSize:12 }}/>
                  <span style={{ fontSize:12, color:p.text3, alignSelf:'center' }}>{obj.unite}</span>
                  <button onClick={async()=>{ await onSaveVal(obj.id, editVal); setEditingVal(false); }}
                    style={{ background:'var(--blue)', border:'none', borderRadius:6, padding:'3px 8px', cursor:'pointer', color:'white', fontSize:11 }}>OK</button>
                  <button onClick={()=>setEditingVal(false)}
                    style={{ background:'none', border:'none', cursor:'pointer', color:p.text3 }}><X size={12}/></button>
                </div>
              ) : (
                <span onClick={()=>setEditingVal(true)} style={{ fontSize:13, fontWeight:800, color:reelAffiche!==null?(isDark?cat.color:cat.colorL):p.text4, cursor:'pointer', textDecoration:'underline dotted' }}>
                  {reelAffiche !== null ? `${reelAffiche} ${obj.unite}` : '— saisir'}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ObjectifsQHSE() {
  const { p, isDark } = useTheme();
  const [objectifs, setObjectifs]   = useState([]);
  const [reelData, setReelData]     = useState({});
  const [loading, setLoading]       = useState(true);
  const [showForm, setShowForm]     = useState(false);
  const [editing, setEditing]       = useState(null);
  const [annee, setAnnee]           = useState(ANNEE);
  const [catFilter, setCatFilter]   = useState('tous');
  const [expandedCat, setExpandedCat] = useState(new Set(['securite','qualite','environnement','rh']));

  /* ── Charger objectifs depuis Supabase ── */
  async function chargerObjectifs() {
    const { data } = await supabase.from('objectifs_qhse').select('*').eq('actif', true).eq('annee', annee).order('categorie');
    setObjectifs(data || []);
  }

  /* ── Charger données réelles depuis toutes les tables ── */
  async function chargerDonneesReelles() {
    const real = {};
    try {
      // Accidents
      const { data: acc } = await supabase.from('securite_accidents').select('type_evenement, nb_jours_arret');
      const atArret = (acc||[]).filter(a => a.type_evenement === 'Accident avec arrêt').length;
      const totalH = 50 * 1607;
      real.accidents_arret = atArret;
      real.tf = totalH > 0 ? Math.round(atArret * 1e6 / totalH * 10) / 10 : 0;

      // Habilitations
      const { data: habs } = await supabase.from('habilitations').select('obtention, validiteAns');
      const now = new Date();
      const habsTotal = (habs||[]).length;
      const habsOk = (habs||[]).filter(h => {
        if (!h.obtention) return false;
        const exp = new Date(h.obtention);
        exp.setFullYear(exp.getFullYear() + Number(h.validiteAns||2));
        return exp > now;
      }).length;
      real.habilitations_pct = habsTotal > 0 ? Math.round(habsOk / habsTotal * 100) : 0;

      // NC qualité
      const { data: ncs } = await supabase.from('qualite_nc').select('statut_nc');
      const ncTotal = (ncs||[]).length;
      const ncClos = (ncs||[]).filter(n => n.statut_nc === 'Clôturée').length;
      real.nc_cloturees_pct = ncTotal > 0 ? Math.round(ncClos / ncTotal * 100) : 0;

      // Audits
      const { data: audits } = await supabase.from('qualite_audits').select('score');
      const scores = (audits||[]).filter(a => a.score != null).map(a => Number(a.score));
      real.score_audit = scores.length > 0 ? Math.round(scores.reduce((s,v)=>s+v,0)/scores.length) : 0;

      // Plan actions
      const { data: actions } = await supabase.from('plan_actions').select('statut');
      const actTotal = (actions||[]).length;
      const actClos = (actions||[]).filter(a => a.statut === 'Terminé').length;
      real.actions_terminees_pct = actTotal > 0 ? Math.round(actClos / actTotal * 100) : 0;

      // Formations
      const { data: employes } = await supabase.from('rh_employes').select('id').eq('actif', true);
      const { data: formations } = await supabase.from('rh_formations').select('participants, statut');
      const empTotal = (employes||[]).length;
      // Compter les participants uniques formés
      const formsTerminees = (formations||[]).filter(f => f.statut === 'Terminée');
      const participants = new Set();
      formsTerminees.forEach(f => (f.participants||'').split(',').map(s=>s.trim()).filter(Boolean).forEach(p2=>participants.add(p2)));
      real.formation_pct = empTotal > 0 ? Math.round(Math.min(participants.size / empTotal * 100, 100)) : 0;

    } catch(e) { console.warn('Erreur données réelles:', e); }
    setReelData(real);
  }

  useEffect(() => {
    async function init() {
      setLoading(true);
      // Vérifier si la table existe, sinon insérer les défauts
      const { data: existing, error } = await supabase.from('objectifs_qhse').select('id').eq('annee', annee).limit(1);
      if (!error && (!existing || existing.length === 0)) {
        // Insérer les objectifs par défaut
        await supabase.from('objectifs_qhse').insert(
          OBJECTIFS_DEFAUT.map(o => ({ ...o, annee }))
        );
      }
      await Promise.all([chargerObjectifs(), chargerDonneesReelles()]);
      setLoading(false);
    }
    init();
  }, [annee]);

  /* ── Mapper les valeurs réelles sur les objectifs ── */
  const keyMap = {
    'Accidents avec arrêt':     'accidents_arret',
    'Taux de fréquence (TF)':   'tf',
    'Habilitations à jour':     'habilitations_pct',
    'NC clôturées':             'nc_cloturees_pct',
    'Score audit moyen':        'score_audit',
    'Actions PDCA terminées':   'actions_terminees_pct',
    'Taux de formation':        'formation_pct',
  };

  function getValeurReelle(obj) {
    const key = keyMap[obj.titre];
    if (key !== undefined && reelData[key] !== undefined) return reelData[key];
    return null; // pas de données auto → saisie manuelle
  }

  function getPct(obj) {
    const reel = getValeurReelle(obj) ?? obj.valeur_reelle ?? 0;
    const cible = Number(obj.valeur_cible) || 1;
    if (obj.sens === 'min') {
      if (reel === 0 && cible === 0) return 100;
      return reel <= cible ? 100 : Math.max(0, Math.round((1 - (reel - cible) / cible) * 100));
    }
    return Math.min(100, Math.round(reel / cible * 100));
  }

  function getStatut(pct, obj) {
    const reel = getValeurReelle(obj) ?? obj.valeur_reelle;
    if (reel === null || reel === undefined) return 'non-demarre';
    if (pct >= 100) return 'atteint';
    if (pct >= 70)  return 'en-cours';
    return 'danger';
  }

  /* ── Stats synthèse ── */
  const stats = useMemo(() => {
    const all = objectifs.map(o => {
      const pct = getPct(o);
      return getStatut(pct, o);
    });
    return {
      atteint:     all.filter(s=>s==='atteint').length,
      enCours:     all.filter(s=>s==='en-cours').length,
      danger:      all.filter(s=>s==='danger').length,
      nonDemarre:  all.filter(s=>s==='non-demarre').length,
      total:       all.length,
      scoreMoyen:  all.length ? Math.round(objectifs.reduce((s,o)=>s+getPct(o),0)/objectifs.length) : 0,
    };
  }, [objectifs, reelData]);

  /* ── CRUD ── */
  async function sauvegarder(form) {
    if (form.id) {
      await supabase.from('objectifs_qhse').update({ ...form, valeur_cible:Number(form.valeur_cible) }).eq('id', form.id);
    } else {
      await supabase.from('objectifs_qhse').insert({ ...form, valeur_cible:Number(form.valeur_cible), annee });
    }
    setShowForm(false); setEditing(null);
    await chargerObjectifs();
  }

  async function supprimer(id) {
    if (!confirm('Supprimer cet objectif ?')) return;
    await supabase.from('objectifs_qhse').update({ actif:false }).eq('id', id);
    await chargerObjectifs();
  }

  async function mettreAJourManuel(id, valeur) {
    await supabase.from('objectifs_qhse').update({ valeur_reelle: Number(valeur) }).eq('id', id);
    await chargerObjectifs();
  }

  const objFiltres = catFilter === 'tous' ? objectifs : objectifs.filter(o=>o.categorie===catFilter);

  const toggleCat = (id) => setExpandedCat(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:18 }}>

      {/* ── Header ── */}
      <div className="page-header animate-fade-up">
        <div>
          <div className="page-title">🎯 Objectifs annuels QHSE</div>
          <div className="page-subtitle">Suivez vos engagements {annee} — progression calculée en temps réel</div>
        </div>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          <select value={annee} onChange={e=>setAnnee(Number(e.target.value))} className="input-modern" style={{ width:100 }}>
            {[2024,2025,2026,2027].map(y=><option key={y} value={y}>{y}</option>)}
          </select>
          <button onClick={() => { chargerObjectifs(); chargerDonneesReelles(); }} className="btn-secondary">
            <RefreshCw size={14}/> Actualiser
          </button>
          <button onClick={() => { setEditing(null); setShowForm(true); }} className="btn-primary">
            <Plus size={14}/> Nouvel objectif
          </button>
        </div>
      </div>

      {/* ── Formulaire ── */}
      {(showForm || editing) && (
        <div className="animate-fade-up">
          <FormulaireObjectif
            initial={editing}
            onSave={sauvegarder}
            onCancel={() => { setShowForm(false); setEditing(null); }}
            p={p}
          />
        </div>
      )}

      {/* ── KPI Synthèse ── */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:14 }} className="animate-fade-up-1">
        {[
          { label:'Score global', val:`${stats.scoreMoyen}%`, color:'blue',   sub:`${stats.total} objectifs` },
          { label:'Atteints',     val:stats.atteint,          color:'green',  sub:'Objectif ≥ 100%' },
          { label:'En cours',     val:stats.enCours,          color:'blue',   sub:'Progression ≥ 70%' },
          { label:'En danger',    val:stats.danger,           color:'amber',  sub:'Progression < 70%' },
          { label:'Non démarrés', val:stats.nonDemarre,       color:'purple', sub:'Aucune donnée' },
        ].map((k,i) => (
          <div key={i} className={`kpi-card ${k.color}`}>
            <div style={{ fontSize:11, fontWeight:700, color:p.text3, textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:8 }}>{k.label}</div>
            <div style={{ fontSize:28, fontWeight:900, color:p.text1, lineHeight:1 }}>{k.val}</div>
            <div style={{ fontSize:11, color:p.text4, marginTop:6 }}>{k.sub}</div>
          </div>
        ))}
      </div>

      {/* ── Filtres catégories ── */}
      <div className="glass-panel animate-fade-up-2" style={{ padding:'12px 16px', display:'flex', gap:8, flexWrap:'wrap' }}>
        <button onClick={()=>setCatFilter('tous')} style={{
          padding:'6px 14px', borderRadius:100, border:`1.5px solid ${catFilter==='tous'?'var(--blue)':'var(--border)'}`,
          background:catFilter==='tous'?'var(--blue-l)':'transparent', color:catFilter==='tous'?'var(--blue)':p.text3,
          cursor:'pointer', fontSize:12, fontWeight:600, fontFamily:'var(--font)',
        }}>Tous ({objectifs.length})</button>
        {CATEGORIES.map(cat => {
          const count = objectifs.filter(o=>o.categorie===cat.id).length;
          const active = catFilter === cat.id;
          const Icon = cat.icon;
          return (
            <button key={cat.id} onClick={()=>setCatFilter(cat.id)} style={{
              display:'flex', alignItems:'center', gap:6, padding:'6px 14px', borderRadius:100,
              border:`1.5px solid ${active?(isDark?cat.color:cat.colorL):'var(--border)'}`,
              background:active?(isDark?cat.bg:cat.bgL):'transparent',
              color:active?(isDark?cat.color:cat.colorL):p.text3,
              cursor:'pointer', fontSize:12, fontWeight:600, fontFamily:'var(--font)',
            }}>
              <Icon size={12}/>{cat.label} ({count})
            </button>
          );
        })}
      </div>

      {/* ── Objectifs par catégorie ── */}
      {loading ? (
        <div className="glass-panel" style={{ padding:40, textAlign:'center', color:p.text3 }}>
          <RefreshCw size={24} style={{ animation:'spin 1s linear infinite', marginBottom:12 }}/>
          <div>Chargement des données…</div>
        </div>
      ) : (
        CATEGORIES
          .filter(cat => catFilter === 'tous' || catFilter === cat.id)
          .map(cat => {
            const items = objFiltres.filter(o => o.categorie === cat.id);
            if (!items.length) return null;
            const expanded = expandedCat.has(cat.id);
            const Icon = cat.icon;
            const catScore = items.length ? Math.round(items.reduce((s,o)=>s+getPct(o),0)/items.length) : 0;

            return (
              <div key={cat.id} className="glass-panel animate-fade-up-3" style={{ overflow:'hidden' }}>
                {/* En-tête catégorie */}
                <div onClick={() => toggleCat(cat.id)} style={{ padding:'16px 20px', display:'flex', alignItems:'center', gap:12, cursor:'pointer', borderBottom: expanded?`1px solid ${p.border}`:'none', transition:'border 0.2s' }}>
                  <div style={{ width:36, height:36, borderRadius:10, background:isDark?cat.bg:cat.bgL, display:'flex', alignItems:'center', justifyContent:'center' }}>
                    <Icon size={17} style={{ color:isDark?cat.color:cat.colorL }}/>
                  </div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:15, fontWeight:800, color:p.text1 }}>{cat.label}</div>
                    <div style={{ fontSize:12, color:p.text3 }}>{items.length} objectif{items.length>1?'s':''} · Score moyen : {catScore}%</div>
                  </div>
                  {/* Mini barre score */}
                  <div style={{ width:120 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                      <span style={{ fontSize:11, color:p.text3 }}>Avancement</span>
                      <span style={{ fontSize:11, fontWeight:800, color:isDark?cat.color:cat.colorL }}>{catScore}%</span>
                    </div>
                    <div style={{ height:6, borderRadius:3, background:'var(--border)' }}>
                      <div style={{ height:'100%', width:`${catScore}%`, background:isDark?cat.color:cat.colorL, borderRadius:3, transition:'width 0.8s ease' }}/>
                    </div>
                  </div>
                  {expanded ? <ChevronUp size={16} style={{ color:p.text3 }}/> : <ChevronDown size={16} style={{ color:p.text3 }}/>}
                </div>

                {/* Liste objectifs */}
                {expanded && (
                  <div style={{ padding:'14px 20px', display:'flex', flexDirection:'column', gap:14 }}>
                    {items.map((obj) => (
                      <ObjectifRow
                        key={obj.id}
                        obj={obj}
                        cat={cat}
                        isDark={isDark}
                        p={p}
                        onEdit={setEditing}
                        onDelete={supprimer}
                        onSaveVal={mettreAJourManuel}
                        getPct={getPct}
                        getStatut={getStatut}
                        getValeurReelle={getValeurReelle}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })
      )}

      {/* SQL reminder */}
      <div className="glass-panel animate-fade-up-5" style={{ padding:'14px 18px', borderLeft:`3px solid var(--amber)` }}>
        <div style={{ fontSize:12, fontWeight:700, color:p.text2, marginBottom:6 }}>⚠️ Si les objectifs ne se chargent pas — exécuter dans Supabase :</div>
        <code style={{ fontSize:11, color:'var(--amber)', background:p.bgCard2, padding:'8px 12px', borderRadius:8, display:'block', lineHeight:1.7 }}>
          create table if not exists objectifs_qhse (id bigint generated always as identity primary key, annee integer default extract(year from now())::integer, categorie text, titre text, description text, valeur_cible numeric, valeur_reelle numeric, unite text default '%', sens text default 'max', actif boolean default true);
        </code>
      </div>
    </div>
  );
}
