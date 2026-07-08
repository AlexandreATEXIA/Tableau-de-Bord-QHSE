import React, { useState } from 'react';
import { supabase } from './supabaseClient';
import { Sparkles, Loader, CheckCircle, AlertTriangle, FileText } from 'lucide-react';
import { safeMean, safeNumber, calcExpiration, diffJours } from './utils/kpi';

// Réutilise la même logique de statut que le module Rapport PDF.
const statHab = (h) => {
  if (!h.obtention) return 'nd';
  const exp = calcExpiration(h.obtention, h.validiteAns);
  if (exp === null) return 'nd';
  const j = diffJours(exp);
  if (j === null) return 'nd';
  return j < 0 ? 'perime' : j <= 30 ? 'bientot' : 'valide';
};
const enRetard = (a) => {
  if (!a.echeance || a.statut?.includes('Terminé') || a.statut?.includes('Annulé')) return false;
  const j = diffJours(a.echeance);
  return j !== null && j < 0;
};

// Calcule une synthèse chiffrée à partir des données du tableau de bord.
function computeSynthese(d, cfg) {
  const { accidents, actions, habs, risques, ncs, sat, qvt, veille, objectifs, audits } = d;

  const accArret = accidents.filter(a => a.type_evenement === 'Accident avec arrêt');
  const jours = accidents.reduce((s, a) => s + (a.jours_perdus || 0), 0);
  const heures = (cfg.effectif || 50) * (cfg.h_an || 1607);
  const TF = accArret.length > 0 ? Number(((accArret.length * 1e6) / heures).toFixed(2)) : 0;
  const TG = jours > 0 ? Number(((jours * 1000) / heures).toFixed(2)) : 0;

  const actTerm = actions.filter(a => a.statut?.includes('Terminé'));
  const actRet = actions.filter(enRetard);
  const urgentes = actions.filter(a => a.priorite?.includes('Urgente') && !a.statut?.includes('Terminé') && !a.statut?.includes('Annulé'));
  const budget = actions.reduce((s, a) => s + (Number(a.cout_estime) || 0), 0);

  const habPer = habs.filter(h => statHab(h) === 'perime');
  const habVal = habs.filter(h => statHab(h) === 'valide');

  const risqCrit = risques.filter(r => (r.criticite || 1) >= 9);
  const risqMod = risques.filter(r => (r.criticite || 1) >= 4 && (r.criticite || 1) < 9);
  const risqSansAction = risques.filter(r => !r.action_preventive);

  const ncOuv = ncs.filter(n => n.statut_nc === 'Ouverte' || !n.statut_nc);
  const ncClot = ncs.filter(n => n.statut_nc === 'Clôturée');

  const veilleConf = veille.filter(v => v.statut === 'Conforme');
  const veilleAMettre = veille.filter(v => v.statut === 'À mettre en œuvre');
  const veilleAAnalyser = veille.filter(v => v.statut === 'À analyser');

  const satAgg = safeMean(sat, a => a.note_globale);
  const qvtAgg = safeMean(qvt, q => q.note_moyenne);
  const auditsReal = audits.filter(a => a.statut?.includes('Réalis'));
  const scoreAudit = safeMean(auditsReal, a => a.score);

  return {
    effectif: cfg.effectif || 50,
    securite: {
      evenements_total: accidents.length,
      accidents_avec_arret: accArret.length,
      jours_perdus: jours,
      TF_taux_frequence: TF,
      TG_taux_gravite: TG,
    },
    plan_actions: {
      total: actions.length,
      terminees: actTerm.length,
      en_retard: actRet.length,
      urgentes_ouvertes: urgentes.length,
      taux_cloture_pct: actions.length ? Math.round((actTerm.length / actions.length) * 100) : 0,
      budget_engage_eur: Math.round(budget),
    },
    habilitations: {
      total: habs.length,
      valides: habVal.length,
      perimees: habPer.length,
      taux_validite_pct: habs.length ? Math.round((habVal.length / habs.length) * 100) : 100,
    },
    duerp: {
      risques_total: risques.length,
      critiques: risqCrit.length,
      moderes: risqMod.length,
      sans_action_preventive: risqSansAction.length,
    },
    non_conformites: {
      total: ncs.length,
      ouvertes: ncOuv.length,
      taux_cloture_pct: ncs.length ? Math.round((ncClot.length / ncs.length) * 100) : 100,
    },
    veille_reglementaire: {
      total: veille.length,
      a_analyser: veilleAAnalyser.length,
      a_mettre_en_oeuvre: veilleAMettre.length,
      taux_conformite_pct: veille.length ? Math.round((veilleConf.length / veille.length) * 100) : 0,
    },
    satisfaction_client_sur10: satAgg.hasData ? Number(satAgg.value.toFixed(1)) : null,
    qvt_sur10: qvtAgg.hasData ? Number(qvtAgg.value.toFixed(1)) : null,
    audits: {
      realises: auditsReal.length,
      score_moyen: scoreAudit.hasData ? Number(scoreAudit.value.toFixed(1)) : null,
    },
    objectifs: objectifs.map(o => ({
      titre: o.titre,
      cible: safeNumber(o.valeur_cible, null),
      reel: safeNumber(o.valeur_reelle, null),
      unite: o.unite || '',
    })),
  };
}

// ─── Document Word (HTML compatible Word, sans dépendance) ──────────────────
function esc(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function buildWord(syn, analyse, entreprise, annee) {
  const date = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });
  const li = (arr) => (arr && arr.length ? `<ul>${arr.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : '<p><i>Aucun élément.</i></p>');
  const row = (l, v) => `<tr><td>${esc(l)}</td><td style="text-align:right;font-weight:bold">${esc(v)}</td></tr>`;

  const kpiRows = [
    row('Taux de fréquence (TF)', syn.securite.TF_taux_frequence),
    row('Taux de gravité (TG)', syn.securite.TG_taux_gravite),
    row('Accidents avec arrêt', syn.securite.accidents_avec_arret),
    row('Jours perdus', syn.securite.jours_perdus),
    row("Plan d'actions — total", syn.plan_actions.total),
    row("Actions en retard", syn.plan_actions.en_retard),
    row("Taux de clôture des actions", syn.plan_actions.taux_cloture_pct + ' %'),
    row("Budget engagé", syn.plan_actions.budget_engage_eur.toLocaleString('fr-FR') + ' €'),
    row('Habilitations périmées', syn.habilitations.perimees),
    row('Taux de validité habilitations', syn.habilitations.taux_validite_pct + ' %'),
    row('Risques critiques (DUERP)', syn.duerp.critiques),
    row('Risques sans action préventive', syn.duerp.sans_action_preventive),
    row('Non-conformités ouvertes', syn.non_conformites.ouvertes),
    row('Veille — taux de conformité', syn.veille_reglementaire.taux_conformite_pct + ' %'),
    row('Satisfaction client (/10)', syn.satisfaction_client_sur10 ?? '—'),
    row('QVT (/10)', syn.qvt_sur10 ?? '—'),
  ].join('');

  const objRows = (syn.objectifs || []).length
    ? `<h2>Objectifs QHSE ${esc(annee)}</h2><table><tr><th>Objectif</th><th>Cible</th><th>Réel</th></tr>${
        syn.objectifs.map(o => `<tr><td>${esc(o.titre)}</td><td style="text-align:right">${o.cible ?? '—'} ${esc(o.unite)}</td><td style="text-align:right">${o.reel ?? '—'} ${esc(o.unite)}</td></tr>`).join('')
      }</table>`
    : '';

  return `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
<head><meta charset='utf-8'><title>Analyse QHSE ${esc(annee)}</title>
<style>
  body { font-family: Calibri, Arial, sans-serif; color: #1e293b; font-size: 11pt; line-height: 1.5; }
  h1 { color: #1E3A5F; font-size: 22pt; margin-bottom: 2px; }
  h2 { color: #1E3A5F; font-size: 14pt; border-bottom: 2px solid #1E3A5F; padding-bottom: 3px; margin-top: 22px; }
  .lead { color: #475569; font-size: 10pt; }
  table { border-collapse: collapse; width: 100%; margin-top: 8px; }
  th { background: #1E3A5F; color: #fff; text-align: left; padding: 6px 10px; font-size: 10pt; }
  td { border: 1px solid #cbd5e1; padding: 5px 10px; font-size: 10pt; }
  ul { margin-top: 6px; }
  li { margin-bottom: 4px; }
  .note { margin-top: 26px; color: #94a3b8; font-size: 8.5pt; }
</style></head><body>
<h1>Analyse QHSE — ${esc(entreprise)}</h1>
<p class="lead">Année ${esc(annee)} · Rapport généré le ${esc(date)} · Analyse assistée par intelligence artificielle</p>

<h2>Synthèse générale</h2>
<p>${esc(analyse.synthese_generale) || '<i>Non disponible.</i>'}</p>

<h2>Indicateurs clés (KPI)</h2>
<table><tr><th>Indicateur</th><th style="text-align:right">Valeur</th></tr>${kpiRows}</table>
${objRows}

<h2>Ce qui va bien</h2>
${li(analyse.points_forts)}

<h2>Points de vigilance</h2>
${li(analyse.points_vigilance)}

<h2>Recommandations prioritaires</h2>
${li(analyse.recommandations)}

<p class="note">Document généré automatiquement à partir des données du tableau de bord QHSE. L'analyse est produite par une IA et doit être relue et validée par le responsable QHSE.</p>
</body></html>`;
}

function telechargerWord(html, entreprise, annee) {
  const blob = new Blob(['﻿', html], { type: 'application/msword' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const nom = String(entreprise).replace(/[^a-zA-Z0-9_-]+/g, '_').slice(0, 40) || 'entreprise';
  a.href = url;
  a.download = `Analyse_QHSE_${nom}_${annee}.doc`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ─── Composant ──────────────────────────────────────────────────────────────
export default function RapportAnalyseIA() {
  const [loading, setLoading] = useState(false);
  const [statut, setStatut] = useState(null); // { type:'ok'|'err', msg }

  const cfg = (() => {
    try { return JSON.parse(localStorage.getItem('rapport_config') || 'null') || {}; }
    catch { return {}; }
  })();
  const entreprise = cfg.entreprise || 'DEF Réunion';
  const annee = new Date().getFullYear();

  const generer = async () => {
    setLoading(true); setStatut(null);
    try {
      const [r1, r2, r3, r4, r5, r6, r7, r8, r9, r10] = await Promise.all([
        supabase.from('securite_accidents').select('*').is('archived_at', null),
        supabase.from('plan_actions').select('*').is('archived_at', null),
        supabase.from('habilitations').select('*').is('archived_at', null),
        supabase.from('registre_duerp').select('*').is('archived_at', null),
        supabase.from('qualite_nc').select('*').is('archived_at', null),
        supabase.from('qualite_satisfaction').select('*'),
        supabase.from('qualite_qvt').select('*'),
        supabase.from('veille_reglementaire').select('*'),
        supabase.from('objectifs_qhse').select('*').eq('annee', annee).eq('actif', true),
        supabase.from('qualite_audits').select('*'),
      ]);

      const synthese = computeSynthese({
        accidents: r1.data || [], actions: r2.data || [], habs: r3.data || [],
        risques: r4.data || [], ncs: r5.data || [], sat: r6.data || [], qvt: r7.data || [],
        veille: r8.data || [], objectifs: r9.data || [], audits: r10.data || [],
      }, cfg);

      const { data, error } = await supabase.functions.invoke('analyse-qhse', {
        body: { synthese, entreprise, annee },
      });
      if (error) throw new Error("Impossible de contacter la fonction d'analyse (analyse-qhse déployée ?).");
      if (!data || data.success === false) throw new Error(data?.message || 'Erreur inconnue.');

      const html = buildWord(synthese, data.analyse, entreprise, annee);
      telechargerWord(html, entreprise, annee);
      setStatut({ type: 'ok', msg: 'Document Word généré et téléchargé.' });
    } catch (e) {
      setStatut({ type: 'err', msg: String(e?.message || e) });
    }
    setLoading(false);
    setTimeout(() => setStatut(null), 8000);
  };

  return (
    <div className="glass-panel p-5 border border-purple-500/20">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Sparkles size={20} style={{ color: '#A78BFA' }} />
          </div>
          <div>
            <h3 className="text-white font-bold flex items-center gap-2"><FileText size={15} /> Analyse QHSE par IA (Word)</h3>
            <p style={{ fontSize: 12, color: '#94A3B8', marginTop: 2 }}>
              Génère un document Word : KPI de l'année {annee}, points forts, points de vigilance et recommandations, analysés par l'IA.
            </p>
          </div>
        </div>
        <button onClick={generer} disabled={loading} className="btn-primary"
          style={{ background: 'linear-gradient(135deg,#8B5CF6,#6366F1)', boxShadow: '0 0 20px rgba(139,92,246,0.35)' }}>
          {loading ? <Loader size={15} className="animate-spin" /> : <Sparkles size={15} />}
          {loading ? 'Analyse en cours…' : 'Générer le rapport IA'}
        </button>
      </div>

      {statut && (
        <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, padding: '10px 14px', borderRadius: 8,
          background: statut.type === 'ok' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
          border: `1px solid ${statut.type === 'ok' ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
          color: statut.type === 'ok' ? '#34D399' : '#F87171' }}>
          {statut.type === 'ok' ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
          {statut.msg}
        </div>
      )}
    </div>
  );
}
