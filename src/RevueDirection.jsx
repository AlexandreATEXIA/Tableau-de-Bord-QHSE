import { useTheme } from './ThemeContext';
import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from './supabaseClient';
import { useConfig } from './ConfigContext';
import { diffJours, safeMean, calcExpiration } from './utils/kpi';
import {
  FileText, RefreshCw, Download, CheckCircle, AlertTriangle,
  Clock, TrendingUp, TrendingDown, Shield, Users, Activity,
  Star, Target, Leaf, ChevronRight, Printer
} from 'lucide-react';

// ─── Helpers ──────────────────────────────────────────────────────────────────
// Les fonctions calcExp et diffJ locales ont été consolidées vers utils/kpi.js
// (`calcExpiration` + `diffJours`) pour éviter les implémentations divergentes.

function getStatutColor(val, seuil1, seuil2, inverse = false) {
  if (inverse) return val <= seuil1 ? '#10B981' : val <= seuil2 ? '#F59E0B' : '#EF4444';
  return val >= seuil1 ? '#10B981' : val >= seuil2 ? '#F59E0B' : '#EF4444';
}

export default function RevueDirection() {
  const { p } = useTheme();
  const { config } = useConfig();
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [annee, setAnnee]     = useState(new Date().getFullYear());
  const [generating, setGenerating] = useState(false);

  useEffect(() => { chargerDonnees(); }, []);

  const chargerDonnees = async () => {
    setLoading(true);
    const [r1, r2, r3, r4, r5, r6, r7, r8] = await Promise.all([
      supabase.from('securite_accidents').select('*').is('archived_at', null).order('date_evenement'),
      supabase.from('plan_actions').select('*').is('archived_at', null),
      supabase.from('habilitations').select('*').is('archived_at', null),
      supabase.from('registre_duerp').select('*').is('archived_at', null),
      supabase.from('qualite_nc').select('*').is('archived_at', null).order('date_nc'),
      supabase.from('qualite_audits').select('*'),
      supabase.from('qualite_satisfaction').select('*'),
      supabase.from('qualite_qvt').select('*'),
    ]);
    setData({
      accidents:    r1.data || [],
      actions:      r2.data || [],
      habilitations:r3.data || [],
      risques:      r4.data || [],
      ncs:          r5.data || [],
      audits:       r6.data || [],
      satisfaction: r7.data || [],
      qvt:          r8.data || [],
    });
    setLoading(false);
  };

  const stats = useMemo(() => {
    if (!data) return null;
    const { accidents, actions, habilitations, risques, ncs, audits, satisfaction, qvt } = data;

    const accArret  = accidents.filter(a => a.type_evenement === 'Accident avec arrêt');
    const joursPerdus = accidents.reduce((s, a) => s + (a.jours_perdus || 0), 0);
    const heures = (config.effectif || 50) * (config.h_an || 1607);
    const TF = accArret.length > 0 ? ((accArret.length * 1000000) / heures).toFixed(2) : '0.00';
    const TG = joursPerdus > 0   ? ((joursPerdus * 1000)        / heures).toFixed(2) : '0.00';

    const actTerminees  = actions.filter(a => a.statut?.includes('Terminé'));
    // actRetard : échéance VALIDE et passée. `diffJours` retourne null si la date est
    // mal-formée → garde `dj !== null` explicite (sinon `null < 0` vaut false par
    // coercion, ce qui marche fortuitement ici mais reste fragile à relire).
    const now = new Date();
    const actRetard     = actions.filter(a => {
      if (!a.echeance) return false;
      if (a.statut?.includes('Terminé') || a.statut?.includes('Annulé')) return false;
      const dj = diffJours(a.echeance, now);
      return dj !== null && dj < 0;
    });
    const tauxCloture   = actions.length > 0 ? Math.round((actTerminees.length / actions.length) * 100) : 0;

    // habsValides / habsPerimees : `calcExpiration` peut retourner null (obtention manquante
    // ou validiteAns non-numérique). Sans garde `e !== null`, la coercion `null <= new Date()`
    // vaut `true` et gonfle faussement le compteur périmées (bug 2C.2c L83 corrigé).
    const habsValides   = habilitations.filter(h => {
      const e = calcExpiration(h.obtention, h.validiteAns);
      return e !== null && e > now;
    });
    const habsPerimees  = habilitations.filter(h => {
      const e = calcExpiration(h.obtention, h.validiteAns);
      return e !== null && e <= now;
    });
    const tauxHabs      = habilitations.length > 0 ? Math.round((habsValides.length / habilitations.length) * 100) : 100;

    const risquesCritiques = risques.filter(r => (r.criticite || 1) >= 9);
    const tauxMaitrise     = risques.length > 0 ? Math.round((risques.filter(r => (r.criticite||1) < 4).length / risques.length) * 100) : 100;

    const ncOuvertes  = ncs.filter(n => n.statut_nc === 'Ouverte');
    const ncCloturees = ncs.filter(n => n.statut_nc === 'Clôturée');
    const tauxNC      = ncs.length > 0 ? Math.round((ncCloturees.length / ncs.length) * 100) : 100;

    // Moyennes défensives : `safeMean` ignore les valeurs non-finies (null/NaN)
    // → une seule note vide en base ne pollue plus toute la moyenne. Fallbacks
    // préservés (0 pour scoreAudit, '—' pour les notes) pour ne pas casser le
    // calcul de scoreGlobal en aval.
    const scoreAuditAgg = safeMean(audits.filter(a => a.score > 0), a => a.score);
    const scoreAudit    = scoreAuditAgg.hasData ? Math.round(scoreAuditAgg.value) : 0;

    const satAgg     = safeMean(satisfaction, a => a.note_globale);
    const moyenneSat = satAgg.hasData ? satAgg.value.toFixed(1) : '—';

    const qvtAgg     = safeMean(qvt, q => q.note_moyenne);
    const moyenneQvt = qvtAgg.hasData ? qvtAgg.value.toFixed(1) : '—';
    const tauxParticipationQvt = qvt.length > 0
      ? Math.round(qvt.reduce((s, q) => s + (q.reponses || 0), 0) / Math.max(qvt.reduce((s, q) => s + (q.effectif_total || 0), 0), 1) * 100) : 0;

    const scoreGlobal = Math.round((tauxCloture + tauxHabs + tauxMaitrise + tauxNC + Math.min(scoreAudit, 100) + Math.max(0, 100 - accArret.length * 15)) / 6);

    const pointsForts = [];
    const axesAmelioration = [];

    if (accArret.length === 0) pointsForts.push('Aucun accident avec arrêt enregistré');
    else axesAmelioration.push(`${accArret.length} accident(s) avec arrêt — TF : ${TF}`);

    if (tauxCloture >= 70) pointsForts.push(`Bon taux de clôture des actions : ${tauxCloture}%`);
    else axesAmelioration.push(`Taux de clôture PDCA insuffisant : ${tauxCloture}% (objectif 70%)`);

    if (habsPerimees.length === 0) pointsForts.push('Toutes les habilitations sont à jour');
    else axesAmelioration.push(`${habsPerimees.length} habilitation(s) périmée(s) à renouveler`);

    if (risquesCritiques.length === 0) pointsForts.push('Aucun risque critique dans le DUERP');
    else axesAmelioration.push(`${risquesCritiques.length} risque(s) critique(s) à traiter en priorité`);

    if (ncOuvertes.length === 0) pointsForts.push('Aucune non-conformité ouverte');
    else axesAmelioration.push(`${ncOuvertes.length} non-conformité(s) ouverte(s) sans action`);

    if (moyenneSat !== '—' && Number(moyenneSat) >= 7) pointsForts.push(`Satisfaction client satisfaisante : ${moyenneSat}/10`);
    else if (moyenneSat !== '—') axesAmelioration.push(`Satisfaction client à améliorer : ${moyenneSat}/10`);

    return {
      TF, TG, accArret, joursPerdus, tauxCloture, actRetard, actTerminees,
      habsValides, habsPerimees, tauxHabs, risquesCritiques, tauxMaitrise,
      ncOuvertes, ncCloturees, tauxNC, scoreAudit, moyenneSat, moyenneQvt,
      tauxParticipationQvt, scoreGlobal, pointsForts, axesAmelioration,
      totalActions: actions.length, totalRisques: risques.length,
      totalNCs: ncs.length, totalAudits: audits.length,
      totalHabs: habilitations.length, totalAccidents: accidents.length,
    };
  }, [data, config]);

  // ── Génération HTML rapport imprimable ────────────────────────────────────
  const genererRapport = () => {
    if (!stats) return;
    setGenerating(true);
    const date = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });

    const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8"/>
<title>Revue de Direction ${annee} — DEF Réunion</title>
<style>
  @page { margin: 2cm; size: A4; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #1e293b; font-size: 12px; line-height: 1.6; }
  .cover { height: 100vh; display: flex; flex-direction: column; justify-content: center; align-items: center; background: linear-gradient(135deg, #0B1120, #1E3A5F); color: white; text-align: center; page-break-after: always; }
  .cover h1 { font-size: 32px; font-weight: 900; margin-bottom: 12px; }
  .cover h2 { font-size: 18px; font-weight: 400; opacity: 0.7; margin-bottom: 8px; }
  .cover .date { font-size: 13px; opacity: 0.5; margin-top: 20px; }
  .cover .score-badge { margin: 30px auto; width: 120px; height: 120px; border-radius: 50%; border: 4px solid ${stats.scoreGlobal >= 70 ? '#10B981' : '#F59E0B'}; display: flex; flex-direction: column; align-items: center; justify-content: center; }
  .cover .score-val { font-size: 36px; font-weight: 900; color: ${stats.scoreGlobal >= 70 ? '#10B981' : '#F59E0B'}; }
  .cover .score-label { font-size: 11px; color: #94A3B8; }
  h2.section { font-size: 16px; font-weight: 800; color: #1E3A5F; border-left: 4px solid #3B82F6; padding-left: 12px; margin: 24px 0 14px; }
  h3.sub { font-size: 13px; font-weight: 700; color: #334155; margin: 16px 0 8px; }
  .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 16px; }
  .kpi { background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 10px; padding: 14px; text-align: center; }
  .kpi-val { font-size: 26px; font-weight: 900; }
  .kpi-label { font-size: 10px; color: #64748B; text-transform: uppercase; letter-spacing: 0.06em; margin-top: 4px; }
  .kpi-sub { font-size: 10px; color: #94A3B8; margin-top: 2px; }
  .alert { display: flex; gap: 8px; padding: 10px 14px; border-radius: 8px; margin-bottom: 8px; font-size: 12px; }
  .alert-r { background: #FEF2F2; border: 1px solid #FECACA; color: #991B1B; }
  .alert-a { background: #FFFBEB; border: 1px solid #FDE68A; color: #78350F; }
  .alert-g { background: #F0FDF4; border: 1px solid #BBF7D0; color: #166534; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 14px; }
  th { background: #1E3A5F; color: white; padding: 8px 12px; text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; }
  td { padding: 8px 12px; border-bottom: 1px solid #E2E8F0; font-size: 12px; color: #334155; }
  tr:nth-child(even) td { background: #F8FAFC; }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 100px; font-size: 10px; font-weight: 700; }
  .badge-r { background: #FEE2E2; color: #B91C1C; }
  .badge-g { background: #DCFCE7; color: #15803D; }
  .badge-a { background: #FEF9C3; color: #A16207; }
  .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
  .card { background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 10px; padding: 16px; }
  .card h4 { font-size: 12px; font-weight: 700; color: #334155; margin-bottom: 10px; }
  ul.list { padding-left: 16px; }
  ul.list li { font-size: 12px; color: #475569; margin-bottom: 4px; }
  .footer { margin-top: 40px; padding-top: 14px; border-top: 1px solid #E2E8F0; display: flex; justify-content: space-between; color: #94A3B8; font-size: 10px; }
  .page-break { page-break-before: always; }
  .statut-dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; margin-right: 6px; }
</style>
</head>
<body>

<!-- COUVERTURE -->
<div class="cover">
  <div style="font-size:13px;opacity:0.5;letter-spacing:0.12em;text-transform:uppercase;margin-bottom:16px;">DEF Réunion — SMI Dashboard Pro</div>
  <h1>Revue de Direction</h1>
  <h2>Rapport annuel ${annee}</h2>
  <div class="score-badge">
    <div class="score-val">${stats.scoreGlobal}</div>
    <div class="score-label">Score SMI</div>
  </div>
  <div style="font-size:16px;font-weight:600;color:${stats.scoreGlobal >= 70 ? '#10B981' : '#F59E0B'};">${stats.scoreGlobal >= 80 ? 'Excellent' : stats.scoreGlobal >= 60 ? 'Satisfaisant' : 'À améliorer'}</div>
  <div class="date">Document généré le ${date}</div>
</div>

<!-- SOMMAIRE -->
<div style="padding: 20px 0;">
  <h2 class="section">Sommaire</h2>
  <ol style="padding-left: 20px; line-height: 2.2; font-size: 13px; color: #334155;">
    <li>Contexte et périmètre du SMI</li>
    <li>Bilan Sécurité & Accidentologie</li>
    <li>Plan d'Actions (PDCA)</li>
    <li>Habilitations & Compétences</li>
    <li>Évaluation des Risques (DUERP)</li>
    <li>Non-Conformités & Audits</li>
    <li>Satisfaction Client & QVT</li>
    <li>Points forts & Axes d'amélioration</li>
    <li>Objectifs ${annee + 1}</li>
  </ol>
</div>

<div class="page-break"></div>

<!-- 1. CONTEXTE -->
<h2 class="section">1. Contexte et périmètre du SMI</h2>
<p style="color:#475569;margin-bottom:12px;">La présente revue de direction porte sur la période de l'année ${annee}. Elle synthétise l'ensemble des indicateurs du Système de Management Intégré (SMI) couvrant les domaines Qualité, Hygiène, Sécurité et Environnement.</p>
<div class="kpi-grid">
  <div class="kpi"><div class="kpi-val" style="color:#3B82F6;">${stats.totalActions}</div><div class="kpi-label">Actions PDCA</div></div>
  <div class="kpi"><div class="kpi-val" style="color:#10B981;">${stats.totalHabs}</div><div class="kpi-label">Habilitations</div></div>
  <div class="kpi"><div class="kpi-val" style="color:#F59E0B;">${stats.totalRisques}</div><div class="kpi-label">Risques évalués</div></div>
  <div class="kpi"><div class="kpi-val" style="color:#8B5CF6;">${stats.totalNCs}</div><div class="kpi-label">Non-conformités</div></div>
</div>

<!-- 2. SÉCURITÉ -->
<h2 class="section">2. Bilan Sécurité & Accidentologie</h2>
<div class="kpi-grid">
  <div class="kpi"><div class="kpi-val" style="color:${stats.accArret.length === 0 ? '#10B981' : '#EF4444'};">${stats.accArret.length}</div><div class="kpi-label">Accidents avec arrêt</div><div class="kpi-sub">Objectif : 0</div></div>
  <div class="kpi"><div class="kpi-val" style="color:${stats.joursPerdus === 0 ? '#10B981' : '#EF4444'};">${stats.joursPerdus}</div><div class="kpi-label">Jours perdus</div></div>
  <div class="kpi"><div class="kpi-val" style="color:${Number(stats.TF) === 0 ? '#10B981' : '#EF4444'};">${stats.TF}</div><div class="kpi-label">Taux de Fréquence</div><div class="kpi-sub">Objectif ≤ 10</div></div>
  <div class="kpi"><div class="kpi-val" style="color:${Number(stats.TG) === 0 ? '#10B981' : '#F59E0B'};">${stats.TG}</div><div class="kpi-label">Taux de Gravité</div><div class="kpi-sub">Objectif ≤ 1</div></div>
</div>
${stats.accArret.length === 0
  ? '<div class="alert alert-g">✓ Aucun accident avec arrêt enregistré sur la période — Objectif de zéro accident atteint.</div>'
  : `<div class="alert alert-r">⚠ ${stats.accArret.length} accident(s) avec arrêt enregistré(s) — Actions correctives à renforcer.</div>`}

<!-- 3. PDCA -->
<h2 class="section">3. Plan d'Actions (PDCA)</h2>
<div class="kpi-grid">
  <div class="kpi"><div class="kpi-val" style="color:#3B82F6;">${stats.totalActions}</div><div class="kpi-label">Total actions</div></div>
  <div class="kpi"><div class="kpi-val" style="color:#10B981;">${stats.actTerminees.length}</div><div class="kpi-label">Terminées</div></div>
  <div class="kpi"><div class="kpi-val" style="color:${stats.actRetard.length === 0 ? '#10B981' : '#EF4444'};">${stats.actRetard.length}</div><div class="kpi-label">En retard</div></div>
  <div class="kpi"><div class="kpi-val" style="color:${stats.tauxCloture >= 70 ? '#10B981' : '#F59E0B'};">${stats.tauxCloture}%</div><div class="kpi-label">Taux de clôture</div><div class="kpi-sub">Objectif ≥ 70%</div></div>
</div>
${stats.actRetard.length > 0 ? `<div class="alert alert-a">⏰ ${stats.actRetard.length} action(s) en retard nécessitent un suivi prioritaire.</div>` : '<div class="alert alert-g">✓ Aucune action en retard.</div>'}

<!-- 4. HABILITATIONS -->
<h2 class="section">4. Habilitations & Compétences</h2>
<div class="kpi-grid">
  <div class="kpi"><div class="kpi-val" style="color:#3B82F6;">${stats.totalHabs}</div><div class="kpi-label">Total habilitations</div></div>
  <div class="kpi"><div class="kpi-val" style="color:#10B981;">${stats.habsValides.length}</div><div class="kpi-label">Valides</div></div>
  <div class="kpi"><div class="kpi-val" style="color:${stats.habsPerimees.length === 0 ? '#10B981' : '#EF4444'};">${stats.habsPerimees.length}</div><div class="kpi-label">Périmées</div></div>
  <div class="kpi"><div class="kpi-val" style="color:${stats.tauxHabs >= 90 ? '#10B981' : '#F59E0B'};">${stats.tauxHabs}%</div><div class="kpi-label">Taux validité</div><div class="kpi-sub">Objectif ≥ 90%</div></div>
</div>
${stats.habsPerimees.length === 0 ? '<div class="alert alert-g">✓ Toutes les habilitations sont à jour.</div>' : `<div class="alert alert-r">⚠ ${stats.habsPerimees.length} habilitation(s) périmée(s) — Renouvellement obligatoire.</div>`}

<!-- 5. DUERP -->
<div class="page-break"></div>
<h2 class="section">5. Évaluation des Risques — DUERP</h2>
<div class="kpi-grid">
  <div class="kpi"><div class="kpi-val" style="color:#3B82F6;">${stats.totalRisques}</div><div class="kpi-label">Risques évalués</div></div>
  <div class="kpi"><div class="kpi-val" style="color:#10B981;">${data?.risques.filter(r => (r.criticite||1) < 4).length || 0}</div><div class="kpi-label">Acceptables</div></div>
  <div class="kpi"><div class="kpi-val" style="color:#F59E0B;">${data?.risques.filter(r => (r.criticite||1) >= 4 && (r.criticite||1) < 9).length || 0}</div><div class="kpi-label">Modérés</div></div>
  <div class="kpi"><div class="kpi-val" style="color:${stats.risquesCritiques.length === 0 ? '#10B981' : '#EF4444'};">${stats.risquesCritiques.length}</div><div class="kpi-label">Critiques (≥9)</div></div>
</div>
${stats.risquesCritiques.length === 0 ? '<div class="alert alert-g">✓ Aucun risque critique identifié dans le DUERP.</div>' : `<div class="alert alert-r">⚠ ${stats.risquesCritiques.length} risque(s) critique(s) à traiter en priorité absolue.</div>`}

<!-- 6. NC & AUDITS -->
<h2 class="section">6. Non-Conformités & Audits</h2>
<div class="two-col">
  <div>
    <h3 class="sub">Non-Conformités</h3>
    <div class="kpi-grid" style="grid-template-columns: repeat(2, 1fr);">
      <div class="kpi"><div class="kpi-val" style="color:#3B82F6;">${stats.totalNCs}</div><div class="kpi-label">Total NC</div></div>
      <div class="kpi"><div class="kpi-val" style="color:${stats.tauxNC >= 70 ? '#10B981' : '#F59E0B'};">${stats.tauxNC}%</div><div class="kpi-label">Taux clôture</div></div>
    </div>
    ${stats.ncOuvertes.length === 0 ? '<div class="alert alert-g" style="font-size:11px;">✓ Aucune NC ouverte.</div>' : `<div class="alert alert-r" style="font-size:11px;">⚠ ${stats.ncOuvertes.length} NC ouverte(s).</div>`}
  </div>
  <div>
    <h3 class="sub">Programme d'Audits</h3>
    <div class="kpi-grid" style="grid-template-columns: repeat(2, 1fr);">
      <div class="kpi"><div class="kpi-val" style="color:#3B82F6;">${stats.totalAudits}</div><div class="kpi-label">Total audits</div></div>
      <div class="kpi"><div class="kpi-val" style="color:${stats.scoreAudit >= 70 ? '#10B981' : '#F59E0B'};">${stats.scoreAudit > 0 ? stats.scoreAudit + '%' : '—'}</div><div class="kpi-label">Score moyen</div></div>
    </div>
  </div>
</div>

<!-- 7. SATISFACTION & QVT -->
<h2 class="section">7. Satisfaction Client & Qualité de Vie au Travail</h2>
<div class="two-col">
  <div class="card">
    <h4>Satisfaction Client</h4>
    <div style="font-size:32px;font-weight:900;color:${Number(stats.moyenneSat) >= 7 ? '#10B981' : '#F59E0B'};">${stats.moyenneSat}<span style="font-size:14px;color:#64748B;"> / 10</span></div>
    <div style="font-size:11px;color:#64748B;margin-top:4px;">Moyenne sur ${data?.satisfaction.length || 0} enquête(s)</div>
  </div>
  <div class="card">
    <h4>Qualité de Vie au Travail (QVT)</h4>
    <div style="font-size:32px;font-weight:900;color:${Number(stats.moyenneQvt) >= 7 ? '#10B981' : '#F59E0B'};">${stats.moyenneQvt}<span style="font-size:14px;color:#64748B;"> / 10</span></div>
    <div style="font-size:11px;color:#64748B;margin-top:4px;">Taux de participation : ${stats.tauxParticipationQvt}%</div>
  </div>
</div>

<!-- 8. BILAN -->
<div class="page-break"></div>
<h2 class="section">8. Points forts & Axes d'amélioration</h2>
<div class="two-col">
  <div class="card" style="border-left:4px solid #10B981;">
    <h4 style="color:#166534;">✓ Points forts ${annee}</h4>
    <ul class="list">
      ${stats.pointsForts.map(p => `<li>${p}</li>`).join('')}
      ${stats.pointsForts.length === 0 ? '<li style="color:#94A3B8;">À compléter lors de la revue</li>' : ''}
    </ul>
  </div>
  <div class="card" style="border-left:4px solid #EF4444;">
    <h4 style="color:#991B1B;">⚠ Axes d'amélioration</h4>
    <ul class="list">
      ${stats.axesAmelioration.map(a => `<li>${a}</li>`).join('')}
      ${stats.axesAmelioration.length === 0 ? '<li style="color:#94A3B8;">Aucun axe majeur identifié</li>' : ''}
    </ul>
  </div>
</div>

<!-- 9. OBJECTIFS -->
<h2 class="section">9. Objectifs ${annee + 1}</h2>
<table>
  <thead><tr><th>Objectif</th><th>Indicateur</th><th>Cible ${annee + 1}</th><th>Responsable</th></tr></thead>
  <tbody>
    <tr><td>Zéro accident avec arrêt</td><td>Nombre d'AT avec arrêt</td><td><span class="badge badge-g">0</span></td><td>Responsable QHSE</td></tr>
    <tr><td>Améliorer le taux de clôture PDCA</td><td>Taux de clôture actions</td><td><span class="badge badge-a">≥ 80%</span></td><td>Pilotes d'actions</td></tr>
    <tr><td>Maintenir les habilitations à jour</td><td>Taux habilitations valides</td><td><span class="badge badge-g">100%</span></td><td>RH / QHSE</td></tr>
    <tr><td>Réduire les risques critiques</td><td>Nb risques criticité ≥ 9</td><td><span class="badge badge-g">0</span></td><td>Responsable QHSE</td></tr>
    <tr><td>Améliorer la satisfaction client</td><td>Note enquête satisfaction</td><td><span class="badge badge-a">≥ 8/10</span></td><td>Direction</td></tr>
    <tr><td>Augmenter participation QVT</td><td>Taux de participation</td><td><span class="badge badge-a">≥ 80%</span></td><td>RH</td></tr>
  </tbody>
</table>

<div class="footer">
  <span>DEF Réunion — SMI Dashboard Pro — Revue de Direction ${annee}</span>
  <span>Document généré automatiquement le ${date} — CONFIDENTIEL</span>
</div>

</body>
</html>`;

    const w = window.open('', '_blank');
    w.document.write(html);
    w.document.close();
    setTimeout(() => { w.print(); setGenerating(false); }, 800);
  };

  if (loading || !stats) return (
    <div className="flex items-center justify-center h-64">
      <div className="text-center"><RefreshCw size={32} className="animate-spin text-blue-400 mx-auto mb-3"/><p className="text-slate-400">Chargement des données...</p></div>
    </div>
  );

  const scoreColor = stats.scoreGlobal >= 80 ? '#10B981' : stats.scoreGlobal >= 60 ? '#F59E0B' : '#EF4444';
  const scoreLabel = stats.scoreGlobal >= 80 ? 'Excellent' : stats.scoreGlobal >= 60 ? 'Satisfaisant' : 'À améliorer';

  return (
    <div className="space-y-6 pb-10">

      {/* ── En-tête ─────────────────────────────────────────────────────── */}
      <header className="page-header">
        <div>
          <h2 className="page-title flex items-center gap-3">
            <FileText size={26} className="text-blue-400"/> Revue de Direction
          </h2>
          <p className="page-subtitle">Synthèse automatique de la performance SMI — prête à présenter</p>
        </div>
        <div className="flex gap-3 items-center">
          <div className="flex items-center gap-2 btn-secondary" style={{ padding: '8px 14px' }}>
            <span className="text-slate-400 text-sm">Année :</span>
            <input type="number" value={annee} onChange={e => setAnnee(Number(e.target.value))}
              className="bg-transparent text-white font-bold text-sm outline-none w-16 text-center" />
          </div>
          <button onClick={chargerDonnees} className="btn-secondary"><RefreshCw size={16}/> Actualiser</button>
          <button onClick={genererRapport} disabled={generating} className="btn-primary" style={{ background: 'linear-gradient(135deg,#4F63E7,#06B6D4)', boxShadow: '0 0 20px rgba(79,99,231,0.4)' }}>
            <Printer size={16}/> {generating ? 'Génération...' : 'Générer le rapport PDF'}
          </button>
        </div>
      </header>

      {/* ── Score global ─────────────────────────────────────────────────── */}
      <div className="glass-panel p-6 flex items-center gap-8">
        <div style={{ textAlign: 'center', flexShrink: 0 }}>
          <div style={{ width: 100, height: 100, borderRadius: '50%', border: `4px solid ${scoreColor}`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', boxShadow: `0 0 30px ${scoreColor}40` }}>
            <span style={{ fontSize: 32, fontWeight: 900, color: scoreColor }}>{stats.scoreGlobal}</span>
            <span style={{ fontSize: 10, color: '#64748B' }}>/ 100</span>
          </div>
          <p style={{ fontSize: 13, fontWeight: 700, color: scoreColor, marginTop: 8 }}>{scoreLabel}</p>
          <p style={{ fontSize: 11, color: '#475569' }}>Score SMI global</p>
        </div>
        <div className="flex-1 grid grid-cols-3 gap-4">
          {[
            { label: 'Sécurité',      val: `TF ${stats.TF}`,       ok: Number(stats.TF) === 0,         icon: <Shield size={16}/> },
            { label: 'Actions PDCA',  val: `${stats.tauxCloture}%`, ok: stats.tauxCloture >= 70,        icon: <Target size={16}/> },
            { label: 'Habilitations', val: `${stats.tauxHabs}%`,    ok: stats.tauxHabs >= 90,           icon: <Users size={16}/> },
            { label: 'Risques',       val: `${stats.risquesCritiques.length} critiques`, ok: stats.risquesCritiques.length === 0, icon: <AlertTriangle size={16}/> },
            { label: 'NC ouvertes',   val: stats.ncOuvertes.length, ok: stats.ncOuvertes.length === 0,  icon: <Activity size={16}/> },
            { label: 'Satisfaction',  val: `${stats.moyenneSat}/10`, ok: Number(stats.moyenneSat) >= 7, icon: <Star size={16}/> },
          ].map((item, i) => (
            <div key={i} className="glass-panel p-3 flex items-center gap-3">
              <div style={{ color: item.ok ? '#10B981' : '#EF4444' }}>{item.icon}</div>
              <div>
                <p className="text-slate-400 text-xs">{item.label}</p>
                <p className="text-white font-bold text-sm">{item.val}</p>
              </div>
              {item.ok
                ? <CheckCircle size={14} className="text-emerald-400 ml-auto shrink-0"/>
                : <AlertTriangle size={14} className="text-red-400 ml-auto shrink-0"/>}
            </div>
          ))}
        </div>
      </div>

      {/* ── Points forts & axes ───────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass-panel p-5" style={{ borderLeft: '3px solid #10B981' }}>
          <h3 className="text-white font-bold mb-4 flex items-center gap-2">
            <TrendingUp size={18} className="text-emerald-400"/> Points forts {annee}
          </h3>
          <div className="space-y-2">
            {stats.pointsForts.length === 0
              ? <p className="text-slate-500 text-sm italic">À compléter lors de la revue</p>
              : stats.pointsForts.map((p, i) => (
                <div key={i} className="flex items-start gap-2">
                  <CheckCircle size={14} className="text-emerald-400 shrink-0 mt-0.5"/>
                  <span className="text-slate-300 text-sm">{p}</span>
                </div>
              ))}
          </div>
        </div>
        <div className="glass-panel p-5" style={{ borderLeft: '3px solid #EF4444' }}>
          <h3 className="text-white font-bold mb-4 flex items-center gap-2">
            <TrendingDown size={18} className="text-red-400"/> Axes d'amélioration
          </h3>
          <div className="space-y-2">
            {stats.axesAmelioration.length === 0
              ? <p className="text-emerald-400 text-sm">✓ Aucun axe majeur identifié — Excellent !</p>
              : stats.axesAmelioration.map((a, i) => (
                <div key={i} className="flex items-start gap-2">
                  <AlertTriangle size={14} className="text-amber-400 shrink-0 mt-0.5"/>
                  <span className="text-slate-300 text-sm">{a}</span>
                </div>
              ))}
          </div>
        </div>
      </div>

      {/* ── Objectifs N+1 ─────────────────────────────────────────────────── */}
      <div className="glass-panel p-5">
        <h3 className="text-white font-bold mb-4 flex items-center gap-2">
          <Target size={18} className="text-blue-400"/> Objectifs {annee + 1}
        </h3>
        <div className="overflow-x-auto">
          <table className="table-modern">
            <thead><tr><th>Objectif</th><th>Indicateur</th><th>Cible</th><th>Responsable</th></tr></thead>
            <tbody>
              {[
                { obj: 'Zéro accident avec arrêt',         ind: 'Nb AT avec arrêt',          cible: '0',     color: '#10B981', resp: 'Responsable QHSE' },
                { obj: 'Améliorer le taux de clôture PDCA',ind: 'Taux de clôture actions',   cible: '≥ 80%', color: '#F59E0B', resp: 'Pilotes d\'actions' },
                { obj: 'Maintenir habilitations à jour',   ind: 'Taux habilitations valides', cible: '100%',  color: '#10B981', resp: 'RH / QHSE' },
                { obj: 'Réduire les risques critiques',    ind: 'Nb risques criticité ≥ 9',  cible: '0',     color: '#10B981', resp: 'Responsable QHSE' },
                { obj: 'Améliorer satisfaction client',    ind: 'Note enquête satisfaction',  cible: '≥ 8/10',color: '#F59E0B', resp: 'Direction' },
                { obj: 'Augmenter participation QVT',      ind: 'Taux de participation',      cible: '≥ 80%', color: '#F59E0B', resp: 'RH' },
              ].map((row, i) => (
                <tr key={i}>
                  <td className="font-medium text-white">{row.obj}</td>
                  <td>{row.ind}</td>
                  <td><span style={{ background: `${row.color}20`, color: row.color, border: `1px solid ${row.color}40`, padding: '2px 10px', borderRadius: 100, fontSize: 12, fontWeight: 700 }}>{row.cible}</span></td>
                  <td>{row.resp}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Call to action ────────────────────────────────────────────────── */}
      <div className="glass-panel p-5 border border-blue-500/20 flex items-center gap-4">
        <div style={{ width: 44, height: 44, background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.3)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Printer size={20} className="text-blue-400"/>
        </div>
        <div className="flex-1">
          <p className="text-white font-semibold">Rapport complet prêt à imprimer</p>
          <p className="text-slate-400 text-sm mt-0.5">Clique sur "Générer le rapport PDF" — le document s'ouvre avec toutes les données, graphiques et objectifs. Utilise Ctrl+P pour sauvegarder en PDF.</p>
        </div>
        <button onClick={genererRapport} disabled={generating} className="btn-primary shrink-0" style={{ background: 'linear-gradient(135deg,#4F63E7,#06B6D4)' }}>
          <Printer size={16}/> Générer
        </button>
      </div>
    </div>
  );
}
