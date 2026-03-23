import { useTheme } from './ThemeContext';
import React, { useState } from 'react';
import { supabase } from './supabaseClient';
import { FileText, Download, Loader, CheckCircle, Settings, Building2, Calendar, FileDown } from 'lucide-react';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const diffJ    = (ds) => Math.ceil((new Date(ds) - new Date()) / 86400000);
const calcExp  = (obt, val) => { const d = new Date(obt); d.setFullYear(d.getFullYear() + Number(val)); return d; };
const statHab  = (h) => { if (!h.obtention) return 'nd'; const j = diffJ(calcExp(h.obtention, h.validiteAns)); return j < 0 ? 'perime' : j <= 30 ? 'bientot' : 'valide'; };
const statAct  = (a) => { if (!a.echeance || a.statut?.includes('Terminé') || a.statut?.includes('Annulé')) return 'ok'; const j = diffJ(a.echeance); return j < 0 ? 'retard' : j <= 7 ? 'imminent' : 'ok'; };

// ─── Générateur HTML ──────────────────────────────────────────────────────────
function buildHTML(data, opts, cfg) {
  const { accidents, actions, habs, risques, ncs, sat, qvt } = data;
  const date   = new Date().toLocaleDateString('fr-FR', { day:'2-digit', month:'long', year:'numeric' });

  const accArret   = accidents.filter(a => a.type_evenement === 'Accident avec arrêt');
  const jours      = accidents.reduce((s, a) => s + (a.jours_perdus || 0), 0);
  const heures     = (cfg.effectif || 50) * 1607;
  const TF         = accArret.length > 0 ? ((accArret.length * 1000000) / heures).toFixed(2) : '0.00';
  const TG         = jours > 0 ? ((jours * 1000) / heures).toFixed(2) : '0.00';

  const actTerminees = actions.filter(a => a.statut?.includes('Terminé'));
  const actRetard    = actions.filter(a => statAct(a) === 'retard');
  const tauxPDCA     = actions.length > 0 ? Math.round((actTerminees.length / actions.length) * 100) : 0;

  const habPerimees  = habs.filter(h => statHab(h) === 'perime');
  const habBientot   = habs.filter(h => statHab(h) === 'bientot');
  const habValides   = habs.filter(h => statHab(h) === 'valide');
  const tauxHabs     = habs.length > 0 ? Math.round((habValides.length / habs.length) * 100) : 100;

  const risqCrit     = risques.filter(r => (r.criticite || 1) >= 9);
  const risqMod      = risques.filter(r => (r.criticite || 1) >= 4 && (r.criticite || 1) < 9);
  const risqAcc      = risques.filter(r => (r.criticite || 1) < 4);

  const ncOuv        = ncs.filter(n => n.statut_nc === 'Ouverte' || !n.statut_nc);
  const tauxNC       = ncs.length > 0 ? Math.round((ncs.filter(n => n.statut_nc === 'Clôturée').length / ncs.length) * 100) : 100;

  const moyenneSat   = sat.length > 0 ? (sat.reduce((s, a) => s + Number(a.note_globale), 0) / sat.length).toFixed(1) : '—';
  const moyenneQvt   = qvt.length > 0 ? (qvt.reduce((s, q) => s + Number(q.note_moyenne), 0) / qvt.length).toFixed(1) : '—';

  const scoreGlobal  = Math.round((Math.max(0, 100 - Number(TF)*5) + tauxPDCA + tauxHabs + (risques.length > 0 ? Math.round((risqAcc.length/risques.length)*100) : 100)) / 4);
  const scoreColor   = scoreGlobal >= 80 ? '#10B981' : scoreGlobal >= 60 ? '#F59E0B' : '#EF4444';
  const scoreLabel   = scoreGlobal >= 80 ? 'Excellent' : scoreGlobal >= 60 ? 'Satisfaisant' : 'À améliorer';

  const periodLabel  = opts.periode === 'mensuel' ? `Mois de ${new Date().toLocaleDateString('fr-FR', { month:'long', year:'numeric' })}` :
                       opts.periode === 'trimestriel' ? `T${Math.ceil((new Date().getMonth()+1)/3)} ${new Date().getFullYear()}` :
                       opts.periode === 'annuel' ? `Année ${new Date().getFullYear()}` :
                       `${opts.dateDebut || '—'} au ${opts.dateFin || '—'}`;

  const kpiBox = (label, val, color) =>
    `<div style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:10px;padding:14px 10px;text-align:center;border-top:3px solid ${color}">
      <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#94A3B8;margin-bottom:6px">${label}</div>
      <div style="font-size:24px;font-weight:900;color:#0F172A">${val}</div>
    </div>`;

  const badge = (txt, color, bg) =>
    `<span style="display:inline-block;padding:2px 9px;border-radius:100px;font-size:10px;font-weight:700;background:${bg};color:${color};border:1px solid ${color}40">${txt}</span>`;

  const sectionTitle = (icon, title, color) =>
    `<h2 style="font-size:15px;font-weight:800;color:#1E3A5F;border-left:4px solid ${color};padding-left:12px;margin:28px 0 14px">${icon} ${title}</h2>`;

  let html = `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"/>
<title>Rapport QHSE — ${cfg.entreprise || 'DEF Réunion'} — ${date}</title>
<style>
  @page { margin: 1.8cm; size: A4; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Segoe UI', Arial, sans-serif; color: #1e293b; font-size: 12px; line-height: 1.6; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
  th { background: #1E3A5F; color: white; padding: 8px 12px; text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; }
  td { padding: 7px 12px; border-bottom: 1px solid #E2E8F0; font-size: 11px; color: #334155; }
  tr:nth-child(even) td { background: #F8FAFC; }
  .grid4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 14px; }
  .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 14px; }
  .card { background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 10px; padding: 14px; }
  .alert-r { background: #FEF2F2; border: 1px solid #FECACA; border-radius: 8px; padding: 10px 14px; margin-bottom: 8px; color: #991B1B; font-size: 12px; }
  .alert-a { background: #FFFBEB; border: 1px solid #FDE68A; border-radius: 8px; padding: 10px 14px; margin-bottom: 8px; color: #78350F; font-size: 12px; }
  .alert-g { background: #F0FDF4; border: 1px solid #BBF7D0; border-radius: 8px; padding: 10px 14px; margin-bottom: 8px; color: #166534; font-size: 12px; }
  .pb { page-break-before: always; }
  .footer { margin-top: 40px; padding-top: 12px; border-top: 1px solid #E2E8F0; display: flex; justify-content: space-between; color: #94A3B8; font-size: 10px; }
</style></head><body>

<!-- COUVERTURE -->
<div style="min-height:240px;background:linear-gradient(135deg,#0B1120,#1E3A5F);color:white;padding:40px;border-radius:12px;margin-bottom:24px;display:flex;flex-direction:column;justify-content:space-between">
  <div>
    <div style="font-size:11px;opacity:0.5;letter-spacing:0.15em;text-transform:uppercase;margin-bottom:10px">Système de Management Intégré</div>
    <h1 style="font-size:28px;font-weight:900;margin-bottom:6px">${cfg.entreprise || 'DEF Réunion'}</h1>
    <h2 style="font-size:18px;font-weight:400;opacity:0.7">Rapport QHSE — ${cfg.typeLabel || 'Rapport mensuel'}</h2>
  </div>
  <div style="display:flex;justify-content:space-between;align-items:flex-end;margin-top:24px">
    <div>
      <div style="font-size:12px;opacity:0.6">Période</div>
      <div style="font-size:14px;font-weight:700">${periodLabel}</div>
      <div style="font-size:11px;opacity:0.5;margin-top:4px">Généré le ${date}</div>
    </div>
    <div style="text-align:center;width:100px;height:100px;border-radius:50%;border:3px solid ${scoreColor};display:flex;flex-direction:column;align-items:center;justify-content:center">
      <div style="font-size:28px;font-weight:900;color:${scoreColor};line-height:1">${scoreGlobal}</div>
      <div style="font-size:9px;color:${scoreColor};opacity:0.8">Score SMI</div>
    </div>
  </div>
</div>

<!-- KPIs SYNTHÈSE -->
<div class="grid4">
  ${kpiBox('AT avec arrêt', accArret.length, accArret.length > 0 ? '#EF4444' : '#10B981')}
  ${kpiBox('Actions en retard', actRetard.length, actRetard.length > 0 ? '#F59E0B' : '#10B981')}
  ${kpiBox('Habs. périmées', habPerimees.length, habPerimees.length > 0 ? '#EF4444' : '#10B981')}
  ${kpiBox('Risques critiques', risqCrit.length, risqCrit.length > 0 ? '#EF4444' : '#10B981')}
</div>

<!-- ALERTES SYNTHÈSE -->
${accArret.length > 0 ? `<div class="alert-r">⚠ ${accArret.length} accident(s) avec arrêt — TF : ${TF} · TG : ${TG} · Jours perdus : ${jours}</div>` : '<div class="alert-g">✓ Aucun accident avec arrêt — Objectif zéro AT atteint !</div>'}
${actRetard.length > 0 ? `<div class="alert-a">⏰ ${actRetard.length} action(s) PDCA en retard — Taux de clôture : ${tauxPDCA}%</div>` : ''}
${habPerimees.length > 0 ? `<div class="alert-r">📋 ${habPerimees.length} habilitation(s) périmée(s) : ${habPerimees.map(h => h.employe).join(', ')}</div>` : ''}
${ncOuv.length > 0 ? `<div class="alert-a">📌 ${ncOuv.length} non-conformité(s) ouverte(s) sans action corrective</div>` : ''}`;

  // ── Section Sécurité ──────────────────────────────────────────────────────
  if (opts.securite) {
    html += `${sectionTitle('🛡️', 'Sécurité & Accidentologie', '#EF4444')}
<div class="grid4">
  ${kpiBox('TF (Taux de Fréquence)', TF, Number(TF) === 0 ? '#10B981' : '#EF4444')}
  ${kpiBox('TG (Taux de Gravité)', TG, Number(TG) === 0 ? '#10B981' : '#F59E0B')}
  ${kpiBox('Jours perdus', jours, jours > 0 ? '#F59E0B' : '#10B981')}
  ${kpiBox('Total événements', accidents.length, '#3B82F6')}
</div>`;
    if (accidents.length > 0) {
      html += `<table><thead><tr><th>Date</th><th>Type</th><th>Lieu</th><th>Description</th><th>Jours perdus</th><th>Enquête</th></tr></thead><tbody>
${accidents.map(a => `<tr><td>${a.date_evenement || ''}</td><td>${a.type_evenement || ''}</td><td>${a.lieu || ''}</td><td>${(a.description || '').substring(0, 60)}</td><td style="text-align:center;font-weight:${a.jours_perdus > 0 ? '700' : '400'};color:${a.jours_perdus > 0 ? '#EF4444' : '#94A3B8'}">${a.jours_perdus || 0}</td><td>${a.statut_enquete || ''}</td></tr>`).join('')}
</tbody></table>`;
    } else {
      html += `<div class="alert-g">✓ Aucun événement enregistré sur la période.</div>`;
    }
  }

  // ── Section PDCA ──────────────────────────────────────────────────────────
  if (opts.pdca) {
    html += `${sectionTitle('🎯', "Plan d'Actions (PDCA)", '#3B82F6')}
<div class="grid4">
  ${kpiBox('Total actions', actions.length, '#3B82F6')}
  ${kpiBox('Terminées', actTerminees.length, '#10B981')}
  ${kpiBox('En retard', actRetard.length, actRetard.length > 0 ? '#EF4444' : '#10B981')}
  ${kpiBox('Taux clôture', `${tauxPDCA}%`, tauxPDCA >= 70 ? '#10B981' : '#F59E0B')}
</div>`;
    const actAff = opts.toutesActions ? actions : [...actRetard, ...actions.filter(a => statAct(a) === 'imminent'), ...actions.filter(a => !a.statut?.includes('Terminé') && !a.statut?.includes('Annulé') && statAct(a) === 'ok')].slice(0, 20);
    if (actAff.length > 0) {
      html += `<table><thead><tr><th>Domaine</th><th>Action</th><th>Pilote</th><th>Échéance</th><th>Priorité</th><th>Statut</th></tr></thead><tbody>
${actAff.map(a => { const st = statAct(a); return `<tr><td>${a.domaine || ''}</td><td>${(a.action || '').substring(0, 55)}</td><td>${a.pilote || ''}</td><td style="color:${st === 'retard' ? '#EF4444' : st === 'imminent' ? '#F59E0B' : '#334155'};font-weight:${st !== 'ok' ? '700' : '400'}">${a.echeance || ''}</td><td>${a.priorite?.replace(/[🔴🟠🟡🟢]/g, '').trim() || ''}</td><td>${a.statut?.replace(/[🔴🟠🟣🟢⚪]/g, '').trim() || ''}</td></tr>`; }).join('')}
</tbody></table>`;
    }
  }

  // ── Section Habilitations ──────────────────────────────────────────────────
  if (opts.habilitations) {
    html += `${sectionTitle('🎓', 'Habilitations & Compétences', '#8B5CF6')}
<div class="grid4">
  ${kpiBox('Total', habs.length, '#3B82F6')}
  ${kpiBox('Valides', habValides.length, '#10B981')}
  ${kpiBox('Périmées', habPerimees.length, habPerimees.length > 0 ? '#EF4444' : '#10B981')}
  ${kpiBox('Taux validité', `${tauxHabs}%`, tauxHabs >= 90 ? '#10B981' : '#F59E0B')}
</div>`;
    const habAff = opts.toutesHabs ? habs : [...habPerimees, ...habBientot];
    if (habAff.length > 0) {
      html += `<table><thead><tr><th>Employé</th><th>Habilitation</th><th>Date obtention</th><th>Expiration</th><th>Statut</th></tr></thead><tbody>
${habAff.map(h => { const st = statHab(h); const exp = h.obtention ? calcExp(h.obtention, h.validiteAns).toLocaleDateString('fr-FR') : '—'; return `<tr><td>${h.employe || ''}</td><td>${h.domaine || ''}</td><td>${h.obtention || ''}</td><td style="color:${st === 'perime' ? '#EF4444' : st === 'bientot' ? '#F59E0B' : '#334155'};font-weight:${st !== 'valide' ? '700' : '400'}">${exp}</td><td>${st === 'perime' ? '🔴 PÉRIMÉE' : st === 'bientot' ? '🟠 Bientôt' : '🟢 Valide'}</td></tr>`; }).join('')}
</tbody></table>`;
    } else {
      html += `<div class="alert-g">✓ Toutes les habilitations sont à jour.</div>`;
    }
  }

  // ── Section DUERP ─────────────────────────────────────────────────────────
  if (opts.duerp) {
    html += `${sectionTitle('⚠️', 'DUERP — Évaluation des Risques', '#F59E0B')}
<div class="grid4">
  ${kpiBox('Total évalués', risques.length, '#3B82F6')}
  ${kpiBox('Critiques (≥9)', risqCrit.length, risqCrit.length > 0 ? '#EF4444' : '#10B981')}
  ${kpiBox('Modérés (4-8)', risqMod.length, '#F59E0B')}
  ${kpiBox('Acceptables (<4)', risqAcc.length, '#10B981')}
</div>`;
    if (risqCrit.length > 0) {
      html += `<table><thead><tr><th>Unité</th><th>Danger</th><th>Risque</th><th>Gravité</th><th>Probabilité</th><th>Criticité</th><th>Action préventive</th></tr></thead><tbody>
${risqCrit.map(r => `<tr><td>${r.unite_travail || ''}</td><td>${r.danger || ''}</td><td>${r.risque || ''}</td><td style="text-align:center">${r.gravite || ''}</td><td style="text-align:center">${r.probabilite || ''}</td><td style="text-align:center;font-weight:900;color:#EF4444">${r.criticite || ''}</td><td>${r.action_preventive || ''}</td></tr>`).join('')}
</tbody></table>`;
    }
  }

  // ── Section NC ────────────────────────────────────────────────────────────
  if (opts.ncs && ncs.length > 0) {
    html += `${sectionTitle('📌', 'Non-Conformités', '#F97316')}
<div class="grid4">
  ${kpiBox('Total NC', ncs.length, '#3B82F6')}
  ${kpiBox('Ouvertes', ncOuv.length, ncOuv.length > 0 ? '#EF4444' : '#10B981')}
  ${kpiBox('Taux clôture', `${tauxNC}%`, tauxNC >= 70 ? '#10B981' : '#F59E0B')}
  ${kpiBox('Clôturées', ncs.filter(n => n.statut_nc === 'Clôturée').length, '#10B981')}
</div>
<table><thead><tr><th>Date</th><th>Processus</th><th>Type</th><th>Description</th><th>Action corrective</th><th>Statut</th></tr></thead><tbody>
${ncs.map(n => `<tr><td>${n.date_nc || ''}</td><td>${n.processus || ''}</td><td>${n.type_nc || ''}</td><td>${(n.description || '').substring(0, 50)}</td><td>${(n.action_corrective || '').substring(0, 40)}</td><td>${n.statut_nc || 'Ouverte'}</td></tr>`).join('')}
</tbody></table>`;
  }

  // ── Section Satisfaction ──────────────────────────────────────────────────
  if (opts.satisfaction && (sat.length > 0 || qvt.length > 0)) {
    html += `${sectionTitle('⭐', 'Satisfaction Client & QVT', '#8B5CF6')}
<div class="grid2">
  <div class="card">
    <div style="font-size:12px;font-weight:700;color:#334155;margin-bottom:8px">Satisfaction Client</div>
    <div style="font-size:32px;font-weight:900;color:${Number(moyenneSat) >= 7 ? '#10B981' : '#F59E0B'}">${moyenneSat}<span style="font-size:14px;color:#94A3B8;font-weight:400"> / 10</span></div>
    <div style="font-size:11px;color:#94A3B8;margin-top:4px">Moyenne sur ${sat.length} enquête(s)</div>
  </div>
  <div class="card">
    <div style="font-size:12px;font-weight:700;color:#334155;margin-bottom:8px">QVT — Qualité de Vie au Travail</div>
    <div style="font-size:32px;font-weight:900;color:${Number(moyenneQvt) >= 7 ? '#10B981' : '#F59E0B'}">${moyenneQvt}<span style="font-size:14px;color:#94A3B8;font-weight:400"> / 10</span></div>
    <div style="font-size:11px;color:#94A3B8;margin-top:4px">Moyenne sur ${qvt.length} campagne(s)</div>
  </div>
</div>`;
  }

  html += `<div class="footer"><span>${cfg.entreprise || 'DEF Réunion'} — Rapport QHSE ${periodLabel}</span><span>Généré le ${date} par SMI Dashboard Pro — CONFIDENTIEL</span></div></body></html>`;
  return html;
}

// ─── Composant ────────────────────────────────────────────────────────────────
const TYPES_RAPPORT = [
  { id: 'mensuel',      label: 'Rapport mensuel',      icon: '📅', desc: 'Données du mois en cours' },
  { id: 'trimestriel',  label: 'Rapport trimestriel',   icon: '📊', desc: 'Données du trimestre en cours' },
  { id: 'annuel',       label: 'Rapport annuel',         icon: '📈', desc: `Bilan complet ${new Date().getFullYear()}` },
  { id: 'personnalise', label: 'Période personnalisée',  icon: '⚙️', desc: 'Choisir les dates manuellement' },
];

const SECTIONS = [
  { key: 'securite',     label: 'Sécurité & Accidentologie', desc: 'AT/MP, TF, TG, jours perdus' },
  { key: 'pdca',         label: "Plan d'Actions (PDCA)",      desc: 'Actions, retards, taux clôture' },
  { key: 'habilitations',label: 'Habilitations',              desc: 'Périmées et à renouveler' },
  { key: 'duerp',        label: 'DUERP — Risques',            desc: 'Risques critiques et modérés' },
  { key: 'ncs',          label: 'Non-Conformités',            desc: 'Toutes les NC avec statut' },
  { key: 'satisfaction', label: 'Satisfaction & QVT',         desc: 'Enquêtes clients et QVT' },
];

export default function RapportPDF() {
  const { p, isDark } = useTheme();
  const [loading, setLoading]   = useState(false);
  const [success, setSuccess]   = useState(false);
  const [typeRapport, setType]  = useState('mensuel');
  const [sections, setSections] = useState({ securite:true, pdca:true, habilitations:true, duerp:true, ncs:true, satisfaction:true });
  const [options, setOptions]   = useState({ toutesActions:false, toutesHabs:false });
  const [cfg, setCfg]           = useState(() => {
    try { return JSON.parse(localStorage.getItem('rapport_config') || 'null') || { entreprise:'DEF Réunion', effectif:50, dateDebut:'', dateFin:'' }; }
    catch { return { entreprise:'DEF Réunion', effectif:50, dateDebut:'', dateFin:'' }; }
  });
  const [showCfg, setShowCfg]   = useState(false);

  const saveCfg = (c) => { setCfg(c); localStorage.setItem('rapport_config', JSON.stringify(c)); };

  const generer = async () => {
    setLoading(true); setSuccess(false);
    const [r1,r2,r3,r4,r5,r6,r7] = await Promise.all([
      supabase.from('securite_accidents').select('*').order('date_evenement',{ascending:false}),
      supabase.from('plan_actions').select('*'),
      supabase.from('habilitations').select('*').order('employe'),
      supabase.from('registre_duerp').select('*').order('criticite',{ascending:false}),
      supabase.from('qualite_nc').select('*').order('date_nc',{ascending:false}),
      supabase.from('qualite_satisfaction').select('*').order('date_enquete'),
      supabase.from('qualite_qvt').select('*'),
    ]);
    const type = TYPES_RAPPORT.find(t => t.id === typeRapport);
    const html = buildHTML(
      { accidents:r1.data||[], actions:r2.data||[], habs:r3.data||[], risques:r4.data||[], ncs:r5.data||[], sat:r6.data||[], qvt:r7.data||[] },
      { ...sections, ...options, periode:typeRapport, typeLabel:type?.label },
      cfg
    );
    const w = window.open('', '_blank');
    w.document.write(html);
    w.document.close();
    setTimeout(() => w.print(), 700);
    setLoading(false); setSuccess(true);
    setTimeout(() => setSuccess(false), 4000);
  };

  return (
    <div className="space-y-5 pb-10">
      <header className="page-header">
        <div>
          <h2 className="page-title flex items-center gap-3"><FileText size={26} className="text-blue-400"/> Export Rapport PDF</h2>
          <p className="page-subtitle">Génère un rapport QHSE complet et imprimable</p>
        </div>
        <div className="flex gap-3">
          <button onClick={() => setShowCfg(!showCfg)} className="btn-secondary"><Settings size={15}/> Paramètres</button>
          <button onClick={generer} disabled={loading} className="btn-primary" style={{background:'linear-gradient(135deg,#4F63E7,#06B6D4)',boxShadow:'0 0 20px rgba(79,99,231,0.4)'}}>
            {loading ? <Loader size={15} className="animate-spin"/> : success ? <CheckCircle size={15}/> : <FileDown size={15}/>}
            {loading ? 'Génération...' : success ? 'Rapport ouvert !' : 'Générer le PDF'}
          </button>
        </div>
      </header>

      {/* Paramètres entreprise */}
      {showCfg && (
        <div className="glass-panel p-5 border border-blue-500/20 animate-fade-up">
          <h3 className="text-white font-bold mb-4 flex items-center gap-2"><Building2 size={16} className="text-blue-400"/> Paramètres du rapport</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="md:col-span-2">
              <label className="text-slate-400 text-xs font-bold uppercase tracking-wider block mb-1">Nom de l'entreprise</label>
              <input type="text" value={cfg.entreprise} onChange={e=>saveCfg({...cfg,entreprise:e.target.value})} placeholder="DEF Réunion" className="input-modern"/>
            </div>
            <div>
              <label className="text-slate-400 text-xs font-bold uppercase tracking-wider block mb-1">Effectif de référence</label>
              <input type="number" min="1" value={cfg.effectif} onChange={e=>saveCfg({...cfg,effectif:Number(e.target.value)})} className="input-modern"/>
            </div>
            <div/>
            {typeRapport === 'personnalise' && <>
              <div><label className="text-slate-400 text-xs font-bold uppercase tracking-wider block mb-1">Date début</label><input type="date" value={cfg.dateDebut} onChange={e=>saveCfg({...cfg,dateDebut:e.target.value})} className="input-modern"/></div>
              <div><label className="text-slate-400 text-xs font-bold uppercase tracking-wider block mb-1">Date fin</label><input type="date" value={cfg.dateFin} onChange={e=>saveCfg({...cfg,dateFin:e.target.value})} className="input-modern"/></div>
            </>}
          </div>
          <button onClick={()=>setShowCfg(false)} className="btn-secondary mt-4 text-sm">Fermer</button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Type de rapport */}
        <div className="glass-panel p-5">
          <h3 className="text-white font-bold mb-4 flex items-center gap-2"><Calendar size={16} className="text-amber-400"/> Type de rapport</h3>
          <div className="space-y-2">
            {TYPES_RAPPORT.map(t => (
              <button key={t.id} onClick={()=>setType(t.id)}
                style={{width:'100%',display:'flex',alignItems:'center',gap:12,padding:'11px 14px',borderRadius:10,border:'1px solid',cursor:'pointer',transition:'all 0.15s',textAlign:'left',
                  background:typeRapport===t.id?'rgba(59,130,246,0.12)':'rgba(255,255,255,0.03)',
                  borderColor:typeRapport===t.id?'rgba(59,130,246,0.35)':'rgba(255,255,255,0.07)'}}>
                <span style={{fontSize:20}}>{t.icon}</span>
                <div>
                  <p style={{fontSize:13,fontWeight:700,color:typeRapport===t.id?'#60A5FA':'#E2E8F0'}}>{t.label}</p>
                  <p style={{fontSize:11,color:p.text4}}>{t.desc}</p>
                </div>
                {typeRapport===t.id && <div style={{marginLeft:'auto',width:8,height:8,background:'#3B82F6',borderRadius:'50%'}}/>}
              </button>
            ))}
          </div>
        </div>

        {/* Sections à inclure */}
        <div className="glass-panel p-5">
          <h3 className="text-white font-bold mb-4 flex items-center gap-2"><FileText size={16} className="text-blue-400"/> Sections à inclure</h3>
          <div className="space-y-2">
            {SECTIONS.map(s => (
              <div key={s.key} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'8px 12px',background:'rgba(255,255,255,0.03)',borderRadius:8,border:`1px solid ${sections[s.key]?'rgba(59,130,246,0.25)':'rgba(255,255,255,0.06)'}`}}>
                <div>
                  <p style={{fontSize:13,color:sections[s.key]?'#E2E8F0':'#64748B',fontWeight:sections[s.key]?500:400}}>{s.label}</p>
                  <p style={{fontSize:11,color:p.text4}}>{s.desc}</p>
                </div>
                <button onClick={()=>setSections(p=>({...p,[s.key]:!p[s.key]}))}
                  style={{width:40,height:22,borderRadius:100,border:'none',cursor:'pointer',transition:'all 0.2s',background:sections[s.key]?'#3B82F6':'rgba(255,255,255,0.1)',position:'relative',flexShrink:0}}>
                  <div style={{width:16,height:16,borderRadius:'50%',background:'white',position:'absolute',top:3,left:sections[s.key]?21:3,transition:'left 0.2s'}}/>
                </button>
              </div>
            ))}
          </div>
          <div className="flex gap-3 mt-4">
            {[
              {key:'toutesActions',  label:'Toutes les actions'},
              {key:'toutesHabs',     label:'Toutes les habilitations'},
            ].map(o => (
              <button key={o.key} onClick={()=>setOptions(p=>({...p,[o.key]:!p[o.key]}))}
                style={{fontSize:11,fontWeight:600,padding:'4px 12px',borderRadius:100,border:'1px solid',cursor:'pointer',transition:'all 0.15s',
                  background:options[o.key]?'rgba(16,185,129,0.15)':'rgba(255,255,255,0.04)',
                  borderColor:options[o.key]?'rgba(16,185,129,0.4)':'rgba(255,255,255,0.08)',
                  color:options[o.key]?'#6EE7B7':'#64748B'}}>
                {options[o.key]?'✓ ':''}{o.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Aperçu */}
      <div className="glass-panel p-5 border border-blue-500/15">
        <h3 className="text-white font-bold mb-3 flex items-center gap-2"><FileDown size={16} className="text-blue-400"/> Ce que contiendra le rapport</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {SECTIONS.filter(s => sections[s.key]).map(s => (
            <div key={s.key} style={{display:'flex',alignItems:'center',gap:8,padding:'7px 10px',background:'rgba(16,185,129,0.07)',border:'1px solid rgba(16,185,129,0.2)',borderRadius:8}}>
              <CheckCircle size={13} style={{color:'#10B981',flexShrink:0}}/>
              <span style={{fontSize:12,color:'#6EE7B7',fontWeight:500}}>{s.label}</span>
            </div>
          ))}
          {SECTIONS.filter(s => !sections[s.key]).map(s => (
            <div key={s.key} style={{display:'flex',alignItems:'center',gap:8,padding:'7px 10px',background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.06)',borderRadius:8}}>
              <div style={{width:13,height:13,border:'1px solid #334155',borderRadius:'50%',flexShrink:0}}/>
              <span style={{fontSize:12,color:p.text4}}>{s.label}</span>
            </div>
          ))}
        </div>
        <p style={{fontSize:11,color:p.text4,marginTop:12}}>💡 Le rapport s'ouvre dans un nouvel onglet. Utilisez <strong style={{color:p.text2}}>Ctrl+P</strong> (ou Cmd+P sur Mac) pour sauvegarder en PDF.</p>
      </div>
    </div>
  );
}
