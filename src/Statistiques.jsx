import { useTheme } from './ThemeContext';
import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from './supabaseClient';
import { safeNumber, toPercent, diffJours, safeMean, calcExpiration } from './utils/kpi';
import { BarChart2, RefreshCw, TrendingUp, TrendingDown, Activity, Shield, Target, Users } from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  RadarChart, Radar, PolarGrid, PolarAngleAxis,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend
} from 'recharts';

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#06B6D4', '#F97316'];

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 10, padding: '10px 14px', fontSize: 12 }}>
      {label && <p style={{ color: '#94A3B8', marginBottom: 6, fontWeight: 600 }}>{label}</p>}
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color, margin: '2px 0' }}>
          {p.name} : <strong>{p.value}</strong>
        </p>
      ))}
    </div>
  );
};

export default function Statistiques() {
  const { p } = useTheme();
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [periode, setPeriode] = useState('annee'); // mois | trimestre | annee

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
      accidents:    r1.data || [],
      actions:      r2.data || [],
      habilitations:r3.data || [],
      risques:      r4.data || [],
      ncs:          r5.data || [],
      audits:       r6.data || [],
      satisfaction: r7.data || [],
    });
    setLoading(false);
  };

  const stats = useMemo(() => {
    if (!data) return null;
    const { accidents, actions, habilitations, risques, ncs, audits, satisfaction } = data;

    // ── Accidentologie par mois ─────────────────────────────────────────
    const accParMois = {};
    accidents.forEach(a => {
      const mois = a.date_evenement?.substring(0, 7) || 'Inconnu';
      if (!accParMois[mois]) accParMois[mois] = { mois, accidents: 0, jours_perdus: 0, presquAccidents: 0 };
      if (a.type_evenement === 'Accident avec arrêt') accParMois[mois].accidents++;
      if (a.type_evenement === "Presqu'accident") accParMois[mois].presquAccidents++;
      accParMois[mois].jours_perdus += a.jours_perdus || 0;
    });
    const accidentsMois = Object.values(accParMois).sort((a, b) => a.mois.localeCompare(b.mois)).slice(-12);

    // ── Actions par domaine ─────────────────────────────────────────────
    const domainesCount = {};
    actions.forEach(a => {
      const d = a.domaine || 'Autre';
      if (!domainesCount[d]) domainesCount[d] = { domaine: d, total: 0, terminees: 0, retard: 0 };
      domainesCount[d].total++;
      if (a.statut?.includes('Terminé')) domainesCount[d].terminees++;
      if (a.echeance && !a.statut?.includes('Terminé') && !a.statut?.includes('Annulé')) {
        // diffJours retourne null si échéance mal-formée → null<0 === false (pas compté en retard)
        const dj = diffJours(a.echeance);
        if (dj !== null && dj < 0) domainesCount[d].retard++;
      }
    });
    const actionsParDomaine = Object.values(domainesCount).map(d => ({
      ...d, taux: d.total > 0 ? Math.round((d.terminees / d.total) * 100) : 0,
    }));

    // ── Répartition statuts actions ─────────────────────────────────────
    const statutsActions = [
      { name: 'Terminées',  value: actions.filter(a => a.statut?.includes('Terminé')).length,   fill: '#10B981' },
      { name: 'En cours',   value: actions.filter(a => a.statut?.includes('En cours')).length,  fill: '#F59E0B' },
      { name: 'À faire',    value: actions.filter(a => a.statut?.includes('À faire')).length,   fill: '#EF4444' },
      { name: 'En attente', value: actions.filter(a => a.statut?.includes('En attente')).length,fill: '#8B5CF6' },
      { name: 'Annulées',   value: actions.filter(a => a.statut?.includes('Annulé')).length,    fill: '#475569' },
    ].filter(s => s.value > 0);

    // ── Risques DUERP par criticité ─────────────────────────────────────
    const risquesParNiveau = [
      { niveau: 'Acceptables (<4)',  count: risques.filter(r => (r.criticite||1) < 4).length,  fill: '#10B981' },
      { niveau: 'Modérés (4-8)',     count: risques.filter(r => (r.criticite||1) >= 4 && (r.criticite||1) < 9).length, fill: '#F59E0B' },
      { niveau: 'Critiques (≥9)',    count: risques.filter(r => (r.criticite||1) >= 9).length, fill: '#EF4444' },
    ];

    // ── Habilitations par statut ────────────────────────────────────────
    // `calcExpiration` (utils/kpi) : source unique partagée avec les autres modules.
    // Retourne null si obtention invalide ou validité non-numérique → garde `e !== null`
    // OBLIGATOIRE avant toute comparaison de Date (la coercion `null <= new Date()` vaut
    // `true` et gonflerait faussement le compteur `habsPerimees`).
    const now = new Date();
    const habsValides   = habilitations.filter(h => {
      const e = calcExpiration(h.obtention, h.validiteAns);
      return e !== null && e > now;
    }).length;
    const habsPerimees  = habilitations.filter(h => {
      const e = calcExpiration(h.obtention, h.validiteAns);
      return e !== null && e <= now;
    }).length;
    const habsBientot   = habilitations.filter(h => {
      const e = calcExpiration(h.obtention, h.validiteAns);
      if (e === null) return false;
      const dj = diffJours(e, now);
      return dj !== null && dj >= 0 && dj <= 30;
    }).length;
    const habsParStatut = [
      { name: 'Valides',       value: habsValides - habsBientot, fill: '#10B981' },
      { name: '< 30 jours',   value: habsBientot,               fill: '#F59E0B' },
      { name: 'Périmées',     value: habsPerimees,              fill: '#EF4444' },
    ].filter(h => h.value > 0);

    // ── NC par origine ──────────────────────────────────────────────────
    const ncParOrigine = {};
    ncs.forEach(n => {
      const o = n.origine || 'Autre';
      ncParOrigine[o] = (ncParOrigine[o] || 0) + 1;
    });
    const ncOrigineData = Object.entries(ncParOrigine).map(([name, value], i) => ({ name, value, fill: COLORS[i % COLORS.length] }));

    // ── NC par mois ─────────────────────────────────────────────────────
    const ncParMois = {};
    ncs.forEach(n => {
      const mois = n.date_nc?.substring(0, 7) || 'Inconnu';
      if (!ncParMois[mois]) ncParMois[mois] = { mois, ouvertes: 0, cloturees: 0 };
      if (n.statut_nc === 'Clôturée') ncParMois[mois].cloturees++;
      else ncParMois[mois].ouvertes++;
    });
    const ncMois = Object.values(ncParMois).sort((a, b) => a.mois.localeCompare(b.mois)).slice(-12);

    // ── Satisfaction évolution ──────────────────────────────────────────
    const satEvol = satisfaction.slice(-12).map(s => ({
      client: s.client?.substring(0, 12) || s.date_enquete,
      note: safeNumber(s.note_globale, 0),
      date: s.date_enquete,
    }));

    // ── Radar performance globale ───────────────────────────────────────
    // Convention auditeur : chaque taux vaut `null` quand le module n'a pas
    // de données (vs. 0 ou 100 auparavant, qui induisait en erreur).
    // Le score global est calculé uniquement sur les composantes disponibles.
    const tauxCloturePct  = toPercent(actions.filter(a => a.statut?.includes('Terminé')).length, actions.length);
    const tauxHabsPct     = toPercent(habsValides, habilitations.length);
    const tauxMaitrisePct = toPercent(risques.filter(r => (r.criticite || 1) < 4).length, risques.length);

    // Moyenne satisfaction : normalisée sur 100 (notes sur 10 × 10).
    // safeMean ignore les notes null/vides et refuse les tableaux vides.
    const satMean = safeMean(satisfaction, (s) => s.note_globale);
    const moyenneSat = satMean.hasData
      ? Math.round(Math.min(100, satMean.value * 10))
      : null;

    // Score sécurité : seul KPI qui reste calculable sans données (pas d'accident = 100).
    const scoreSecurite = Math.max(0, 100 - (accidents.filter(a => a.type_evenement === 'Accident avec arrêt').length * 15));

    // Score audit : moyenne des scores > 0 (exclut les audits non notés).
    const auditsNotes = audits.filter(a => safeNumber(a.score, 0) > 0);
    const scoreAuditMean = safeMean(auditsNotes, (a) => a.score);
    const scoreAudit = scoreAuditMean.hasData ? Math.round(scoreAuditMean.value) : null;

    // Extraction des valeurs pour le radar (null → non affiché pour cet axe)
    const tauxCloture  = tauxCloturePct.value;
    const tauxHabs     = tauxHabsPct.value;
    const tauxMaitrise = tauxMaitrisePct.value;

    // Radar : on ne trace que les axes qui ont des données (évite un point "0" trompeur)
    const radarData = [
      { subject: 'Actions PDCA',    A: tauxCloture,  fullMark: 100 },
      { subject: 'Habilitations',   A: tauxHabs,     fullMark: 100 },
      { subject: 'Maîtrise risques',A: tauxMaitrise, fullMark: 100 },
      { subject: 'Satisfaction',    A: moyenneSat,   fullMark: 100 },
      { subject: 'Sécurité',        A: scoreSecurite,fullMark: 100 },
      { subject: 'Qualité audits',  A: scoreAudit,   fullMark: 100 },
    ].filter(d => d.A !== null);

    // Score global : moyenne des composantes réellement disponibles
    // (évite "0%" factice si un module n'est pas encore alimenté).
    const composantes = [tauxCloture, tauxHabs, tauxMaitrise, moyenneSat, scoreSecurite, scoreAudit]
      .filter(v => v !== null);
    const scoreGlobal = composantes.length > 0
      ? Math.round(composantes.reduce((s, v) => s + v, 0) / composantes.length)
      : null;

    return { accidentsMois, actionsParDomaine, statutsActions, risquesParNiveau, habsParStatut, ncOrigineData, ncMois, satEvol, radarData, scoreGlobal, tauxCloture, tauxHabs, tauxMaitrise, moyenneSat, scoreSecurite, scoreAudit };
  }, [data]);

  if (loading || !stats) return (
    <div className="flex items-center justify-center h-64">
      <div className="text-center"><RefreshCw size={32} className="animate-spin text-blue-400 mx-auto mb-3" /><p className="text-slate-400">Chargement des analyses...</p></div>
    </div>
  );

  // ScoreCard gère explicitement le cas "pas de données" → affiche "N/A"
  // plutôt qu'un 0 % ou 100 % trompeur pour le décideur.
  const ScoreCard = ({ label, val, color, icon }) => {
    const hasData = val !== null && val !== undefined;
    const displayVal = hasData ? `${val}%` : 'N/A';
    const barWidth   = hasData ? val : 0;
    return (
      <div className="glass-panel p-5 text-center">
        <div style={{ width: 48, height: 48, borderRadius: 12, background: `${color}20`, border: `1px solid ${color}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px', color }}>
          {icon}
        </div>
        <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">{label}</p>
        <p className="text-3xl font-black" style={{ color: hasData ? color : '#64748B' }}>{displayVal}</p>
        <div style={{ height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2, marginTop: 10 }}>
          <div style={{ height: '100%', width: `${barWidth}%`, background: color, borderRadius: 2, transition: 'width 1s ease' }} />
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 pb-10">

      {/* ── En-tête ─────────────────────────────────────────────────────── */}
      <header className="page-header">
        <div>
          <h2 className="page-title flex items-center gap-3">
            <BarChart2 size={26} className="text-purple-400" />
            Statistiques & Analyses
          </h2>
          <p className="page-subtitle">Vue globale de la performance QHSE — données en temps réel</p>
        </div>
        <button onClick={chargerDonnees} className="btn-secondary">
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} /> Actualiser
        </button>
      </header>

      {/* ── Score global + radar ─────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Radar */}
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

        {/* Scores détaillés */}
        <div className="grid grid-cols-2 gap-3 content-start">
          <ScoreCard label="Actions PDCA"    val={stats.tauxCloture}   color="#3B82F6" icon={<Target size={20}/>} />
          <ScoreCard label="Habilitations"   val={stats.tauxHabs}      color="#10B981" icon={<Users size={20}/>} />
          <ScoreCard label="Maîtrise risques"val={stats.tauxMaitrise}  color="#F59E0B" icon={<Shield size={20}/>} />
          <ScoreCard label="Sécurité"        val={stats.scoreSecurite} color="#EF4444" icon={<Activity size={20}/>} />
        </div>
      </div>

      {/* ── Accidentologie ───────────────────────────────────────────────── */}
      <div className="glass-panel p-6">
        <h3 className="text-white font-bold mb-5 flex items-center gap-2"><Activity size={18} className="text-red-400"/>Accidentologie — 12 derniers mois</h3>
        {stats.accidentsMois.length === 0 ? (
          <div className="h-52 flex items-center justify-center text-slate-500">Aucun événement enregistré — Parfait !</div>
        ) : (
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.accidentsMois}>
                <CartesianGrid strokeDasharray="3 3" stroke={p.chartGrid} vertical={false}/>
                <XAxis dataKey="mois" stroke={p.chartAxis} tick={{fill:'#64748B', fontSize:11}}/>
                <YAxis stroke={p.chartAxis} tick={{fill:'#64748B', fontSize:11}}/>
                <Tooltip content={<CustomTooltip />} cursor={{fill:'rgba(255,255,255,0.03)'}}/>
                <Legend wrapperStyle={{fontSize:12, color:p.text2}}/>
                <Bar dataKey="accidents"     name="Acc. avec arrêt"  fill="#EF4444" radius={[4,4,0,0]} />
                <Bar dataKey="presquAccidents" name="Presqu'accidents" fill="#F59E0B" radius={[4,4,0,0]} />
                <Bar dataKey="jours_perdus"  name="Jours perdus"     fill="#F97316" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* ── Actions + NC ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Actions par domaine */}
        <div className="glass-panel p-6">
          <h3 className="text-white font-bold mb-5 flex items-center gap-2"><Target size={18} className="text-blue-400"/>Clôture actions par domaine</h3>
          {stats.actionsParDomaine.length === 0 ? (
            <div className="h-52 flex items-center justify-center text-slate-500">Aucune action enregistrée.</div>
          ) : (
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stats.actionsParDomaine} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke={p.chartGrid} horizontal={false}/>
                  <XAxis type="number" domain={[0,100]} stroke={p.chartAxis} tick={{fill:'#64748B', fontSize:11}} tickFormatter={v => `${v}%`}/>
                  <YAxis type="category" dataKey="domaine" stroke={p.chartAxis} tick={{fill:'#64748B', fontSize:11}} width={80}/>
                  <Tooltip content={<CustomTooltip />} cursor={{fill:'rgba(255,255,255,0.03)'}}/>
                  <Bar dataKey="taux" name="Taux clôture %" radius={[0,4,4,0]}>
                    {stats.actionsParDomaine.map((d, i) => (
                      <Cell key={i} fill={d.taux >= 70 ? '#10B981' : d.taux >= 40 ? '#F59E0B' : '#EF4444'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Répartition statuts actions */}
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
                    <div className="flex items-center gap-2">
                      <div style={{ width: 10, height: 10, borderRadius: 2, background: s.fill, flexShrink: 0 }}/>
                      <span className="text-slate-400 text-sm">{s.name}</span>
                    </div>
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

        {/* Risques par niveau */}
        <div className="glass-panel p-6">
          <h3 className="text-white font-bold mb-5 flex items-center gap-2"><Shield size={18} className="text-amber-400"/>Niveaux de risques DUERP</h3>
          <div className="space-y-4">
            {stats.risquesParNiveau.map((r, i) => {
              const total = stats.risquesParNiveau.reduce((s, a) => s + a.count, 0);
              const pct   = total > 0 ? Math.round((r.count / total) * 100) : 0;
              return (
                <div key={i}>
                  <div className="flex justify-between mb-1.5">
                    <span className="text-sm font-medium" style={{ color: r.fill }}>{r.niveau}</span>
                    <span className="text-white font-bold">{r.count} <span className="text-slate-500 font-normal text-xs">({pct}%)</span></span>
                  </div>
                  <div style={{ height: 8, background: 'rgba(255,255,255,0.06)', borderRadius: 4 }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: r.fill, borderRadius: 4, transition: 'width 0.8s ease' }} />
                  </div>
                </div>
              );
            })}
            {stats.risquesParNiveau.every(r => r.count === 0) && (
              <p className="text-slate-500 text-center py-6">Aucun risque évalué dans le DUERP.</p>
            )}
          </div>
        </div>

        {/* Habilitations */}
        <div className="glass-panel p-6">
          <h3 className="text-white font-bold mb-5 flex items-center gap-2"><Users size={18} className="text-blue-400"/>État des habilitations</h3>
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
                    <div className="flex items-center gap-2">
                      <div style={{ width: 10, height: 10, borderRadius: 2, background: h.fill }} />
                      <span className="text-slate-400 text-sm">{h.name}</span>
                    </div>
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

        {/* NC par origine */}
        <div className="glass-panel p-6">
          <h3 className="text-white font-bold mb-5 flex items-center gap-2"><Activity size={18} className="text-amber-400"/>Non-conformités par origine</h3>
          {stats.ncOrigineData.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-slate-500">Aucune NC enregistrée.</div>
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

        {/* Satisfaction évolution */}
        <div className="glass-panel p-6">
          <h3 className="text-white font-bold mb-5 flex items-center gap-2"><TrendingUp size={18} className="text-emerald-400"/>Évolution satisfaction client</h3>
          {stats.satEvol.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-slate-500">Aucune enquête enregistrée.</div>
          ) : (
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={stats.satEvol}>
                  <defs>
                    <linearGradient id="satGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#10B981" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#10B981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
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
  );
}
