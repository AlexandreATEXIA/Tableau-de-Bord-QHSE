import { useTheme } from './ThemeContext';
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { supabase } from './supabaseClient';
import { safeNumber, toPercent, diffJours, safeMean, calcExpiration } from './utils/kpi';
import { BarChart2, RefreshCw, TrendingUp, Activity, Shield, Target, Users, SlidersHorizontal, FileDown } from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  RadarChart, Radar, PolarGrid, PolarAngleAxis,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend
} from 'recharts';

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#F97316'];
const DOMAINES = ['Tous', 'Qualité', 'Sécurité', 'Environnement', 'Énergie', 'RH / Social', 'RSE / Transverse'];

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 10, padding: '10px 14px', fontSize: 12 }}>
      {label && <p style={{ color: '#94A3B8', marginBottom: 6, fontWeight: 600 }}>{label}</p>}
      {payload.map((pp, i) => (
        <p key={i} style={{ color: pp.color, margin: '2px 0' }}>{pp.name} : <strong>{pp.value}</strong></p>
      ))}
    </div>
  );
};

// ─── Fenêtres temporelles (période courante + période précédente comparable) ──
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

function windowFor(periode, dd, df) {
  const now = new Date();
  const Y = now.getFullYear();
  if (periode === 'annee_courante')
    return { from: `${Y}-01-01`, to: `${Y}-12-31`, prev: { from: `${Y - 1}-01-01`, to: `${Y - 1}-12-31` }, label: `Année ${Y}` };
  if (periode === 'annee_precedente')
    return { from: `${Y - 1}-01-01`, to: `${Y - 1}-12-31`, prev: { from: `${Y - 2}-01-01`, to: `${Y - 2}-12-31` }, label: `Année ${Y - 1}` };
  if (periode === '12mois') {
    const f = new Date(now); f.setMonth(f.getMonth() - 12);
    const pf = new Date(f); pf.setMonth(pf.getMonth() - 12);
    return { from: iso(f), to: iso(now), prev: { from: iso(pf), to: iso(f) }, label: '12 derniers mois' };
  }
  // personnalisé
  const from = dd || '2000-01-01';
  const to = df || iso(now);
  let prev = null;
  if (dd && df) {
    const d1 = new Date(dd), d2 = new Date(df);
    const len = d2.getTime() - d1.getTime();
    const p2 = new Date(d1.getTime() - 86400000);
    const p1 = new Date(p2.getTime() - len);
    prev = { from: iso(p1), to: iso(p2) };
  }
  return { from, to, prev, label: `${from} → ${to}` };
}

const inWin = (ds, w) => { if (!ds || !w) return false; const d = String(ds).slice(0, 10); return d >= w.from && d <= w.to; };

// Filtre les données par fenêtre temporelle + domaine (le domaine s'applique au plan d'actions).
function filterData(data, win, domaine) {
  const dom = (a) => domaine === 'Tous' || (a.domaine || '') === domaine;
  return {
    accidents:     data.accidents.filter(a => inWin(a.date_evenement, win)),
    actions:       data.actions.filter(a => (a.created_at ? inWin(a.created_at, win) : true) && dom(a)),
    ncs:           data.ncs.filter(n => inWin(n.date_nc, win)),
    satisfaction:  data.satisfaction.filter(s => inWin(s.date_enquete, win)),
    audits:        data.audits.filter(a => inWin(a.date || a.date_prevue, win)),
    habilitations: data.habilitations, // état actuel — non filtré par date
    risques:       data.risques,       // état actuel — non filtré par date
  };
}

// ─── Calcul des statistiques (pur, réutilisable pour période courante et N-1) ─
function computeStats(data) {
  const { accidents, actions, habilitations, risques, ncs, audits, satisfaction } = data;

  const accParMois = {};
  accidents.forEach(a => {
    const mois = a.date_evenement?.substring(0, 7) || 'Inconnu';
    if (!accParMois[mois]) accParMois[mois] = { mois, accidents: 0, jours_perdus: 0, presquAccidents: 0 };
    if (a.type_evenement === 'Accident avec arrêt') accParMois[mois].accidents++;
    if (a.type_evenement === "Presqu'accident") accParMois[mois].presquAccidents++;
    accParMois[mois].jours_perdus += a.jours_perdus || 0;
  });
  const accidentsMois = Object.values(accParMois).sort((a, b) => a.mois.localeCompare(b.mois)).slice(-12);

  const domainesCount = {};
  actions.forEach(a => {
    const d = a.domaine || 'Autre';
    if (!domainesCount[d]) domainesCount[d] = { domaine: d, total: 0, terminees: 0, retard: 0 };
    domainesCount[d].total++;
    if (a.statut?.includes('Terminé')) domainesCount[d].terminees++;
    if (a.echeance && !a.statut?.includes('Terminé') && !a.statut?.includes('Annulé')) {
      const dj = diffJours(a.echeance);
      if (dj !== null && dj < 0) domainesCount[d].retard++;
    }
  });
  const actionsParDomaine = Object.values(domainesCount).map(d => ({ ...d, taux: d.total > 0 ? Math.round((d.terminees / d.total) * 100) : 0 }));

  const statutsActions = [
    { name: 'Terminées',  value: actions.filter(a => a.statut?.includes('Terminé')).length,   fill: '#10B981' },
    { name: 'En cours',   value: actions.filter(a => a.statut?.includes('En cours')).length,  fill: '#F59E0B' },
    { name: 'À faire',    value: actions.filter(a => a.statut?.includes('À faire')).length,   fill: '#EF4444' },
    { name: 'En attente', value: actions.filter(a => a.statut?.includes('En attente')).length,fill: '#8B5CF6' },
    { name: 'Annulées',   value: actions.filter(a => a.statut?.includes('Annulé')).length,    fill: '#475569' },
  ].filter(s => s.value > 0);

  const risquesParNiveau = [
    { niveau: 'Acceptables (<4)', count: risques.filter(r => (r.criticite || 1) < 4).length, fill: '#10B981' },
    { niveau: 'Modérés (4-8)',    count: risques.filter(r => (r.criticite || 1) >= 4 && (r.criticite || 1) < 9).length, fill: '#F59E0B' },
    { niveau: 'Critiques (≥9)',   count: risques.filter(r => (r.criticite || 1) >= 9).length, fill: '#EF4444' },
  ];

  const now = new Date();
  const habsValides = habilitations.filter(h => { const e = calcExpiration(h.obtention, h.validiteAns); return e !== null && e > now; }).length;
  const habsPerimees = habilitations.filter(h => { const e = calcExpiration(h.obtention, h.validiteAns); return e !== null && e <= now; }).length;
  const habsBientot = habilitations.filter(h => { const e = calcExpiration(h.obtention, h.validiteAns); if (e === null) return false; const dj = diffJours(e, now); return dj !== null && dj >= 0 && dj <= 30; }).length;
  const habsParStatut = [
    { name: 'Valides',    value: habsValides - habsBientot, fill: '#10B981' },
    { name: '< 30 jours', value: habsBientot,               fill: '#F59E0B' },
    { name: 'Périmées',   value: habsPerimees,              fill: '#EF4444' },
  ].filter(h => h.value > 0);

  const ncParOrigine = {};
  ncs.forEach(n => { const o = n.origine || 'Autre'; ncParOrigine[o] = (ncParOrigine[o] || 0) + 1; });
  const ncOrigineData = Object.entries(ncParOrigine).map(([name, value], i) => ({ name, value, fill: COLORS[i % COLORS.length] }));

  const satEvol = satisfaction.slice(-12).map(s => ({ client: s.client?.substring(0, 12) || s.date_enquete, note: safeNumber(s.note_globale, 0), date: s.date_enquete }));

  const tauxCloturePct  = toPercent(actions.filter(a => a.statut?.includes('Terminé')).length, actions.length);
  const tauxHabsPct     = toPercent(habsValides, habilitations.length);
  const tauxMaitrisePct = toPercent(risques.filter(r => (r.criticite || 1) < 4).length, risques.length);

  const satMean = safeMean(satisfaction, (s) => s.note_globale);
  const moyenneSat = satMean.hasData ? Math.round(Math.min(100, satMean.value * 10)) : null;
  const jours = accidents.reduce((s, a) => s + (a.jours_perdus || 0), 0);
  const accArret = accidents.filter(a => a.type_evenement === 'Accident avec arrêt').length;
  const scoreSecurite = Math.max(0, 100 - (accArret * 15));

  const auditsNotes = audits.filter(a => safeNumber(a.score, 0) > 0);
  const scoreAuditMean = safeMean(auditsNotes, (a) => a.score);
  const scoreAudit = scoreAuditMean.hasData ? Math.round(scoreAuditMean.value) : null;
  const auditsRealises = audits.filter(a => a.statut?.includes('Réalis')).length;

  const tauxCloture = tauxCloturePct.value, tauxHabs = tauxHabsPct.value, tauxMaitrise = tauxMaitrisePct.value;
  const radarData = [
    { subject: 'Actions PDCA',     A: tauxCloture,   fullMark: 100 },
    { subject: 'Habilitations',    A: tauxHabs,      fullMark: 100 },
    { subject: 'Maîtrise risques', A: tauxMaitrise,  fullMark: 100 },
    { subject: 'Satisfaction',     A: moyenneSat,    fullMark: 100 },
    { subject: 'Sécurité',         A: scoreSecurite, fullMark: 100 },
    { subject: 'Qualité audits',   A: scoreAudit,    fullMark: 100 },
  ].filter(d => d.A !== null);
  const composantes = [tauxCloture, tauxHabs, tauxMaitrise, moyenneSat, scoreSecurite, scoreAudit].filter(v => v !== null);
  const scoreGlobal = composantes.length > 0 ? Math.round(composantes.reduce((s, v) => s + v, 0) / composantes.length) : null;

  return {
    accidentsMois, actionsParDomaine, statutsActions, risquesParNiveau, habsParStatut, ncOrigineData, satEvol,
    radarData, scoreGlobal, tauxCloture, tauxHabs, tauxMaitrise, moyenneSat, scoreSecurite, scoreAudit,
    // Indicateurs pour la comparaison temporelle (basés sur des événements datés)
    cmp: { accArret, jours, ncTotal: ncs.length, satMoy: satMean.hasData ? Number(satMean.value.toFixed(1)) : null, auditsRealises },
  };
}

// ─── Export PDF (sérialise les graphiques Recharts dans une fenêtre imprimable) ─
function exporterPDF(root, meta) {
  if (!root) return;
  const panels = root.querySelectorAll('.glass-panel');
  let blocs = '';
  panels.forEach(panel => {
    const svg = panel.querySelector('.recharts-surface');
    if (!svg) return;
    const titre = panel.querySelector('h3')?.innerText || '';
    blocs += `<div class="bloc"><h2>${titre}</h2><div class="chart">${svg.outerHTML}</div></div>`;
  });
  if (!blocs) { blocs = '<p>Aucun graphique à exporter pour ces filtres.</p>'; }

  const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"/>
<title>Statistiques QHSE — ${meta.label}</title>
<style>
  @page { margin: 1.6cm; size: A4; }
  * { box-sizing: border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #1e293b; }
  h1 { color: #1E3A5F; font-size: 22px; margin: 0 0 2px; }
  .sub { color: #64748B; font-size: 12px; margin-bottom: 18px; }
  .bloc { break-inside: avoid; margin-bottom: 22px; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px 14px; }
  h2 { color: #1E3A5F; font-size: 14px; margin: 0 0 8px; }
  .chart { width: 100%; overflow: hidden; }
  .chart svg { max-width: 100%; height: auto; }
  /* Lisibilité des graphes sur fond blanc */
  text { fill: #334155 !important; }
  .recharts-cartesian-grid line, .recharts-polar-grid line, .recharts-cartesian-axis line, .recharts-cartesian-axis-tick-line { stroke: #cbd5e1 !important; }
</style></head><body>
<h1>Statistiques QHSE — ${meta.entreprise}</h1>
<div class="sub">Période : ${meta.label}${meta.domaine !== 'Tous' ? ' · Domaine : ' + meta.domaine : ''} · Généré le ${meta.date}</div>
${blocs}
</body></html>`;

  const w = window.open('', '_blank');
  if (!w) return;
  w.document.write(html);
  w.document.close();
  setTimeout(() => w.print(), 500);
}

export default function Statistiques() {
  const { p } = useTheme();
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [periode, setPeriode] = useState('annee_courante');
  const [dateDebut, setDateDebut] = useState('');
  const [dateFin, setDateFin]     = useState('');
  const [domaine, setDomaine]     = useState('Tous');
  const [compare, setCompare]     = useState(false);
  const rootRef = useRef(null);

  useEffect(() => { chargerDonnees(); }, []);

  const chargerDonnees = async () => {
    setLoading(true);
    const [r1, r2, r3, r4, r5, r6, r7] = await Promise.all([
      supabase.from('securite_accidents').select('*').order('date_evenement'),
      supabase.from('plan_actions').select('*'),
      supabase.from('habilitations').select('*'),
      supabase.from('registre_duerp').select('*'),
      supabase.from('qualite_nc').select('*').order('date_nc'),
      supabase.from('qualite_audits').select('*'),
      supabase.from('qualite_satisfaction').select('*').order('date_enquete'),
    ]);
    setData({
      accidents: r1.data || [], actions: r2.data || [], habilitations: r3.data || [],
      risques: r4.data || [], ncs: r5.data || [], audits: r6.data || [], satisfaction: r7.data || [],
    });
    setLoading(false);
  };

  const win = useMemo(() => windowFor(periode, dateDebut, dateFin), [periode, dateDebut, dateFin]);
  const stats = useMemo(() => (data ? computeStats(filterData(data, win, domaine)) : null), [data, win, domaine]);
  const statsPrev = useMemo(
    () => (compare && data && win.prev ? computeStats(filterData(data, win.prev, domaine)) : null),
    [compare, data, win, domaine],
  );

  if (loading || !stats) return (
    <div className="flex items-center justify-center h-64">
      <div className="text-center"><RefreshCw size={32} className="animate-spin text-blue-400 mx-auto mb-3" /><p className="text-slate-400">Chargement des analyses...</p></div>
    </div>
  );

  const cfgEnt = (() => { try { return (JSON.parse(localStorage.getItem('rapport_config') || 'null') || {}).entreprise || 'DEF Réunion'; } catch { return 'DEF Réunion'; } })();

  const ScoreCard = ({ label, val, color, icon }) => {
    const hasData = val !== null && val !== undefined;
    const displayVal = hasData ? `${val}%` : 'N/A';
    const barWidth = hasData ? val : 0;
    return (
      <div className="glass-panel p-5 text-center">
        <div style={{ width: 48, height: 48, borderRadius: 12, background: `${color}20`, border: `1px solid ${color}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px', color }}>{icon}</div>
        <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">{label}</p>
        <p className="text-3xl font-black" style={{ color: hasData ? color : '#64748B' }}>{displayVal}</p>
        <div style={{ height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2, marginTop: 10 }}>
          <div style={{ height: '100%', width: `${barWidth}%`, background: color, borderRadius: 2, transition: 'width 1s ease' }} />
        </div>
      </div>
    );
  };

  // Carte de comparaison : valeur courante + variation vs période précédente.
  const CompareCard = ({ label, cur, prev, betterWhenHigher, suffix = '' }) => {
    let delta = null;
    if (cur !== null && cur !== undefined && prev !== null && prev !== undefined) {
      const diff = Math.round((cur - prev) * 10) / 10;
      if (diff === 0) delta = <span style={{ color: '#94A3B8', fontSize: 12, fontWeight: 700 }}>= stable</span>;
      else {
        const up = diff > 0;
        const good = betterWhenHigher ? up : !up;
        delta = <span style={{ color: good ? '#10B981' : '#EF4444', fontSize: 12, fontWeight: 700 }}>{up ? '▲' : '▼'} {Math.abs(diff)}{suffix} vs N-1</span>;
      }
    }
    return (
      <div className="glass-panel p-4">
        <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">{label}</p>
        <p className="text-2xl font-black text-white">{cur ?? '—'}{suffix}</p>
        <div style={{ marginTop: 4 }}>{delta || <span style={{ color: '#64748B', fontSize: 12 }}>—</span>}</div>
      </div>
    );
  };

  const selStyle = { background: p.bgInput, border: '1px solid ' + p.borderInput, borderRadius: 8, color: p.text1, padding: '7px 10px', fontSize: 13, outline: 'none' };

  return (
    <div className="space-y-6 pb-10">

      {/* ── En-tête ─────────────────────────────────────────────────────── */}
      <header className="page-header">
        <div>
          <h2 className="page-title flex items-center gap-3"><BarChart2 size={26} className="text-purple-400" />Statistiques & Analyses</h2>
          <p className="page-subtitle">Vue consolidée · {win.label}{domaine !== 'Tous' ? ` · ${domaine}` : ''}</p>
        </div>
        <div className="flex gap-3">
          <button onClick={() => exporterPDF(rootRef.current, { label: win.label, domaine, entreprise: cfgEnt, date: new Date().toLocaleDateString('fr-FR') })} className="btn-secondary"><FileDown size={16} /> Export PDF</button>
          <button onClick={chargerDonnees} className="btn-secondary"><RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> Actualiser</button>
        </div>
      </header>

      {/* ── Barre de filtres multi-critères ─────────────────────────────── */}
      <div className="glass-panel p-4" style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
        <SlidersHorizontal size={16} style={{ color: p.text4 }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <label style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: p.text4 }}>Période</label>
          <select value={periode} onChange={e => setPeriode(e.target.value)} style={selStyle}>
            <option value="annee_courante">Année en cours</option>
            <option value="annee_precedente">Année précédente</option>
            <option value="12mois">12 derniers mois</option>
            <option value="perso">Personnalisée…</option>
          </select>
        </div>
        {periode === 'perso' && (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <label style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: p.text4 }}>Du</label>
              <input type="date" value={dateDebut} onChange={e => setDateDebut(e.target.value)} style={selStyle} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <label style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: p.text4 }}>Au</label>
              <input type="date" value={dateFin} onChange={e => setDateFin(e.target.value)} style={selStyle} />
            </div>
          </>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <label style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: p.text4 }}>Domaine (plan d'actions)</label>
          <select value={domaine} onChange={e => setDomaine(e.target.value)} style={selStyle}>
            {DOMAINES.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto', cursor: 'pointer', color: p.text2, fontSize: 13 }}>
          <input type="checkbox" checked={compare} onChange={e => setCompare(e.target.checked)} />
          Comparer avec la période précédente
        </label>
      </div>

      {/* ── Comparaison temporelle ──────────────────────────────────────── */}
      {compare && (
        statsPrev ? (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <CompareCard label="Acc. avec arrêt" cur={stats.cmp.accArret}     prev={statsPrev.cmp.accArret}     betterWhenHigher={false} />
            <CompareCard label="Jours perdus"    cur={stats.cmp.jours}        prev={statsPrev.cmp.jours}        betterWhenHigher={false} />
            <CompareCard label="NC enregistrées" cur={stats.cmp.ncTotal}      prev={statsPrev.cmp.ncTotal}      betterWhenHigher={false} />
            <CompareCard label="Satisfaction"    cur={stats.cmp.satMoy}       prev={statsPrev.cmp.satMoy}       betterWhenHigher={true} suffix="/10" />
            <CompareCard label="Audits réalisés" cur={stats.cmp.auditsRealises} prev={statsPrev.cmp.auditsRealises} betterWhenHigher={true} />
          </div>
        ) : (
          <div className="glass-panel p-4" style={{ color: p.text3, fontSize: 13 }}>Comparaison indisponible pour cette période (choisissez des dates de début et de fin en mode personnalisé).</div>
        )
      )}

      <div ref={rootRef} className="space-y-6">

      {/* ── Score global + radar ─────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass-panel p-6">
          <h3 className="text-white font-bold mb-1 flex items-center gap-2"><Target size={18} className="text-purple-400"/>Performance globale SMI</h3>
          <p className="text-slate-400 text-xs mb-4">Score global : <strong className="text-white text-lg">{stats.scoreGlobal !== null ? `${stats.scoreGlobal}/100` : 'N/A — aucun module alimenté'}</strong></p>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={stats.radarData}>
                <PolarGrid stroke={p.chartGrid} />
                <PolarAngleAxis dataKey="subject" tick={{ fill: '#64748B', fontSize: 11, fontWeight: 600 }} />
                <Radar name="Score" dataKey="A" stroke="#8B5CF6" fill="#8B5CF6" fillOpacity={0.2} strokeWidth={2} />
                <Tooltip content={<CustomTooltip />} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 content-start">
          <ScoreCard label="Actions PDCA"     val={stats.tauxCloture}   color="#3B82F6" icon={<Target size={20}/>} />
          <ScoreCard label="Habilitations"    val={stats.tauxHabs}      color="#10B981" icon={<Users size={20}/>} />
          <ScoreCard label="Maîtrise risques" val={stats.tauxMaitrise}  color="#F59E0B" icon={<Shield size={20}/>} />
          <ScoreCard label="Sécurité"         val={stats.scoreSecurite} color="#EF4444" icon={<Activity size={20}/>} />
        </div>
      </div>

      {/* ── Accidentologie ───────────────────────────────────────────────── */}
      <div className="glass-panel p-6">
        <h3 className="text-white font-bold mb-5 flex items-center gap-2"><Activity size={18} className="text-red-400"/>Accidentologie — {win.label}</h3>
        {stats.accidentsMois.length === 0 ? (
          <div className="h-52 flex items-center justify-center text-slate-500">Aucun événement sur la période — Parfait !</div>
        ) : (
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.accidentsMois}>
                <CartesianGrid strokeDasharray="3 3" stroke={p.chartGrid} vertical={false}/>
                <XAxis dataKey="mois" stroke={p.chartAxis} tick={{fill:'#64748B', fontSize:11}}/>
                <YAxis stroke={p.chartAxis} tick={{fill:'#64748B', fontSize:11}}/>
                <Tooltip content={<CustomTooltip />} cursor={{fill:'rgba(255,255,255,0.03)'}}/>
                <Legend wrapperStyle={{fontSize:12, color:p.text2}}/>
                <Bar dataKey="accidents"       name="Acc. avec arrêt"  fill="#EF4444" radius={[4,4,0,0]} />
                <Bar dataKey="presquAccidents" name="Presqu'accidents" fill="#F59E0B" radius={[4,4,0,0]} />
                <Bar dataKey="jours_perdus"    name="Jours perdus"     fill="#F97316" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* ── Actions + statuts ────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass-panel p-6">
          <h3 className="text-white font-bold mb-5 flex items-center gap-2"><Target size={18} className="text-blue-400"/>Clôture actions par domaine</h3>
          {stats.actionsParDomaine.length === 0 ? (
            <div className="h-52 flex items-center justify-center text-slate-500">Aucune action sur la période.</div>
          ) : (
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.actionsParDomaine} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke={p.chartGrid} horizontal={false}/>
                  <XAxis type="number" domain={[0,100]} stroke={p.chartAxis} tick={{fill:'#64748B', fontSize:11}} tickFormatter={v => `${v}%`}/>
                  <YAxis type="category" dataKey="domaine" stroke={p.chartAxis} tick={{fill:'#64748B', fontSize:11}} width={80}/>
                  <Tooltip content={<CustomTooltip />} cursor={{fill:'rgba(255,255,255,0.03)'}}/>
                  <Bar dataKey="taux" name="Taux clôture %" radius={[0,4,4,0]}>
                    {stats.actionsParDomaine.map((d, i) => <Cell key={i} fill={d.taux >= 70 ? '#10B981' : d.taux >= 40 ? '#F59E0B' : '#EF4444'} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="glass-panel p-6">
          <h3 className="text-white font-bold mb-5 flex items-center gap-2"><BarChart2 size={18} className="text-emerald-400"/>Statuts du plan d'actions</h3>
          {stats.statutsActions.length === 0 ? (
            <div className="h-52 flex items-center justify-center text-slate-500">Aucune action.</div>
          ) : (
            <div className="h-52 flex items-center gap-6">
              <div style={{ flex: '0 0 180px' }}>
                <ResponsiveContainer width={180} height={180}>
                  <PieChart>
                    <Pie data={stats.statutsActions} dataKey="value" cx="50%" cy="50%" innerRadius={45} outerRadius={80} paddingAngle={3}>
                      {stats.statutsActions.map((s, i) => <Cell key={i} fill={s.fill} />)}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex-1 space-y-2">
                {stats.statutsActions.map((s, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="flex items-center gap-2"><div style={{ width: 10, height: 10, borderRadius: 2, background: s.fill, flexShrink: 0 }}/><span className="text-slate-400 text-sm">{s.name}</span></div>
                    <span className="text-white font-bold text-sm">{s.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── DUERP + Habilitations ─────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass-panel p-6">
          <h3 className="text-white font-bold mb-5 flex items-center gap-2"><Shield size={18} className="text-amber-400"/>Niveaux de risques DUERP <span style={{fontSize:11,color:p.text4,fontWeight:400}}>(état actuel)</span></h3>
          <div className="space-y-4">
            {stats.risquesParNiveau.map((r, i) => {
              const total = stats.risquesParNiveau.reduce((s, a) => s + a.count, 0);
              const pct = total > 0 ? Math.round((r.count / total) * 100) : 0;
              return (
                <div key={i}>
                  <div className="flex justify-between mb-1.5"><span className="text-sm font-medium" style={{ color: r.fill }}>{r.niveau}</span><span className="text-white font-bold">{r.count} <span className="text-slate-500 font-normal text-xs">({pct}%)</span></span></div>
                  <div style={{ height: 8, background: 'rgba(255,255,255,0.06)', borderRadius: 4 }}><div style={{ height: '100%', width: `${pct}%`, background: r.fill, borderRadius: 4, transition: 'width 0.8s ease' }} /></div>
                </div>
              );
            })}
            {stats.risquesParNiveau.every(r => r.count === 0) && <p className="text-slate-500 text-center py-6">Aucun risque évalué dans le DUERP.</p>}
          </div>
        </div>

        <div className="glass-panel p-6">
          <h3 className="text-white font-bold mb-5 flex items-center gap-2"><Users size={18} className="text-blue-400"/>État des habilitations <span style={{fontSize:11,color:p.text4,fontWeight:400}}>(état actuel)</span></h3>
          {stats.habsParStatut.length === 0 ? (
            <div className="h-52 flex items-center justify-center text-slate-500">Aucune habilitation enregistrée.</div>
          ) : (
            <div className="h-52 flex items-center gap-6">
              <div style={{ flex: '0 0 180px' }}>
                <ResponsiveContainer width={180} height={180}>
                  <PieChart>
                    <Pie data={stats.habsParStatut} dataKey="value" cx="50%" cy="50%" innerRadius={45} outerRadius={80} paddingAngle={3}>
                      {stats.habsParStatut.map((h, i) => <Cell key={i} fill={h.fill} />)}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex-1 space-y-3">
                {stats.habsParStatut.map((h, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="flex items-center gap-2"><div style={{ width: 10, height: 10, borderRadius: 2, background: h.fill }} /><span className="text-slate-400 text-sm">{h.name}</span></div>
                    <span className="text-white font-bold">{h.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── NC + Satisfaction ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass-panel p-6">
          <h3 className="text-white font-bold mb-5 flex items-center gap-2"><Activity size={18} className="text-amber-400"/>Non-conformités par origine</h3>
          {stats.ncOrigineData.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-slate-500">Aucune NC sur la période.</div>
          ) : (
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.ncOrigineData}>
                  <CartesianGrid strokeDasharray="3 3" stroke={p.chartGrid} vertical={false}/>
                  <XAxis dataKey="name" stroke={p.chartAxis} tick={{fill:'#64748B', fontSize:12}}/>
                  <YAxis stroke={p.chartAxis} tick={{fill:'#64748B', fontSize:11}}/>
                  <Tooltip content={<CustomTooltip />} cursor={{fill:'rgba(255,255,255,0.03)'}}/>
                  <Bar dataKey="value" name="NC" radius={[6,6,0,0]}>
                    {stats.ncOrigineData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="glass-panel p-6">
          <h3 className="text-white font-bold mb-5 flex items-center gap-2"><TrendingUp size={18} className="text-emerald-400"/>Évolution satisfaction client</h3>
          {stats.satEvol.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-slate-500">Aucune enquête sur la période.</div>
          ) : (
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={stats.satEvol}>
                  <defs><linearGradient id="satGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#10B981" stopOpacity={0.3}/><stop offset="95%" stopColor="#10B981" stopOpacity={0}/></linearGradient></defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={p.chartGrid} vertical={false}/>
                  <XAxis dataKey="client" stroke={p.chartAxis} tick={{fill:'#64748B', fontSize:11}}/>
                  <YAxis domain={[0,10]} stroke={p.chartAxis} tick={{fill:'#64748B', fontSize:11}}/>
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="note" name="Note /10" stroke="#10B981" fill="url(#satGrad)" strokeWidth={3} dot={{r:4, fill:'#10B981'}}/>
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      </div>
    </div>
  );
}
