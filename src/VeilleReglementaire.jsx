import { useTheme } from './ThemeContext';
import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { WriteOnly } from './WriteGuard';
import {
  BookOpen, RefreshCw, ExternalLink, CheckCircle, AlertTriangle,
  Clock, Filter, Plus, Save, Trash2, Archive, Eye, EyeOff, Zap
} from 'lucide-react';

const DOMAINES = ['Tous', 'Sécurité', 'Environnement', 'Qualité', 'RH / Social', 'Énergie', 'Santé au travail'];
const STATUTS  = ['À analyser', 'Conforme', 'À mettre en œuvre', 'Non applicable', 'En cours'];
const SOURCES  = ['Journal Officiel', 'INRS', 'DREAL', 'Ministère Travail', 'ISO/AFNOR', 'Autre'];

const STATUT_STYLE = {
  'À analyser':         { badge: 'badge-amber',  icon: <Clock size={12}/> },
  'Conforme':           { badge: 'badge-green',  icon: <CheckCircle size={12}/> },
  'À mettre en œuvre':  { badge: 'badge-red',    icon: <AlertTriangle size={12}/> },
  'Non applicable':     { badge: 'badge-blue',   icon: <CheckCircle size={12}/> },
  'En cours':           { badge: 'badge-purple', icon: <Clock size={12}/> },
};

const DOMAINE_COLORS = {
  'Sécurité':           '#EF4444',
  'Environnement':      '#10B981',
  'Qualité':            '#3B82F6',
  'RH / Social':        '#8B5CF6',
  'Énergie':            '#F59E0B',
  'Santé au travail':   '#EC4899',
};

const TEXTES_REF = [
  { titre: 'Code du travail - Art. L4121-1 : Obligation générale de sécurité', domaine: 'Sécurité', source: 'Ministère Travail', date_parution: '2023-01-01', resume: "L'employeur prend les mesures nécessaires pour assurer la sécurité et protéger la santé physique et mentale des travailleurs.", url: 'https://www.legifrance.gouv.fr', statut: 'Conforme', impact: 'Élevé', notes: 'DUERP à jour', archive: false },
  { titre: 'Décret n°2022-1765 - Évaluation des risques professionnels', domaine: 'Sécurité', source: 'Journal Officiel', date_parution: '2022-12-30', resume: "Renforcement des obligations de mise à jour du DUERP et de consultation du CSE.", url: 'https://www.legifrance.gouv.fr', statut: 'Conforme', impact: 'Élevé', notes: 'DUERP mis à jour', archive: false },
  { titre: 'Loi Climat et Résilience - Obligations environnementales', domaine: 'Environnement', source: 'Journal Officiel', date_parution: '2021-08-22', resume: "Renforcement des obligations de reporting environnemental et réduction des émissions de GES.", url: 'https://www.legifrance.gouv.fr', statut: 'En cours', impact: 'Élevé', notes: 'Bilan carbone en cours', archive: false },
  { titre: 'ISO 14001:2015 - Systèmes de management environnemental', domaine: 'Environnement', source: 'ISO/AFNOR', date_parution: '2015-09-15', resume: "Norme internationale pour la mise en place d'un SME efficace.", url: 'https://www.iso.org', statut: 'Conforme', impact: 'Élevé', notes: 'Certification à renouveler en 2025', archive: false },
  { titre: 'ISO 9001:2015 - Systèmes de management de la qualité', domaine: 'Qualité', source: 'ISO/AFNOR', date_parution: '2015-09-15', resume: "Exigences pour un système de management de la qualité orienté satisfaction client.", url: 'https://www.iso.org', statut: 'Conforme', impact: 'Élevé', notes: 'Audit de surveillance planifié', archive: false },
  { titre: 'Arrêté du 12/01/2024 - Formation SST obligatoire', domaine: 'Santé au travail', source: 'Ministère Travail', date_parution: '2024-01-12', resume: "Nouvelles modalités de formation et recyclage SST. Recyclage tous les 24 mois.", url: 'https://www.legifrance.gouv.fr', statut: 'À mettre en œuvre', impact: 'Moyen', notes: '', archive: false },
  { titre: 'Décret DUERP - Mise à jour annuelle obligatoire', domaine: 'Sécurité', source: 'Journal Officiel', date_parution: '2022-03-31', resume: "Le DUERP doit être mis à jour au moins chaque année dans les entreprises de 11 salariés et plus.", url: 'https://www.legifrance.gouv.fr', statut: 'À analyser', impact: 'Élevé', notes: '', archive: false },
  { titre: 'Loi Travail 2024 - Temps de travail et télétravail', domaine: 'RH / Social', source: 'Journal Officiel', date_parution: '2024-02-15', resume: "Nouvelles dispositions sur l'organisation du temps de travail et encadrement du télétravail.", url: 'https://www.legifrance.gouv.fr', statut: 'À analyser', impact: 'Moyen', notes: '', archive: false },
  { titre: 'Décret ICPE - Installations classées mise à jour', domaine: 'Environnement', source: 'DREAL', date_parution: '2024-01-01', resume: "Mise à jour des seuils et procédures pour les installations classées pour la protection de l'environnement.", url: 'https://www.legifrance.gouv.fr', statut: 'À analyser', impact: 'Élevé', notes: '', archive: false },
  { titre: 'ISO 45001:2018 - Santé et sécurité au travail', domaine: 'Santé au travail', source: 'ISO/AFNOR', date_parution: '2018-03-12', resume: "Norme internationale de référence pour les systèmes de management de la santé et sécurité au travail.", url: 'https://www.iso.org', statut: 'Conforme', impact: 'Élevé', notes: 'Intégré au SMI', archive: false },
];

export default function VeilleReglementaire() {
  const { p: _p } = useTheme();
  const [textes, setTextes]               = useState([]);
  const [loading, setLoading]             = useState(true);
  const [veilleLoading, setVeilleLoading] = useState(false);
  const [veilleResultat, setVeilleResultat] = useState(null);
  const [filtreDomaine, setFiltreDomaine] = useState('Tous');
  const [filtreStatut, setFiltreStatut]   = useState('Tous');
  const [showArchives, setShowArchives]   = useState(false);
  const [showForm, setShowForm]           = useState(false);
  const [saving, setSaving]               = useState(false);
  const [nouveauTexte, setNouveauTexte]   = useState({
    titre: '', domaine: 'Sécurité', source: 'Journal Officiel',
    date_parution: new Date().toISOString().split('T')[0],
    resume: '', url: '', statut: 'À analyser', impact: 'Moyen', notes: '', archive: false,
  });

  useEffect(() => { chargerTextes(); }, []);

  const chargerTextes = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('veille_reglementaire').select('*').order('date_parution', { ascending: false });

    if (!error && data && data.length > 0) {
      setTextes(data);
    } else {
      const { data: inserted } = await supabase
        .from('veille_reglementaire').insert(TEXTES_REF).select();
      setTextes(inserted || TEXTES_REF.map((t, i) => ({ ...t, id: i + 1 })));
    }
    setLoading(false);
  };

  // ── Lancer la veille automatique ──────────────────────────────────────────
  const lancerVeilleAuto = async () => {
    setVeilleLoading(true);
    setVeilleResultat(null);
    try {
      const { data, error } = await supabase.functions.invoke('veille-auto');
      if (error) throw error;
      setVeilleResultat(data);
      if (data?.nouveaux > 0) await chargerTextes();
    } catch (err) {
      setVeilleResultat({ success: false, message: String(err) });
    }
    setVeilleLoading(false);
  };

  const updateStatut = async (id, statut, notes) => {
    setTextes(textes.map(t => t.id === id ? { ...t, statut, notes } : t));
    await supabase.from('veille_reglementaire').update({ statut, notes }).eq('id', id);
  };

  const archiverTexte = async (id, archive) => {
    setTextes(textes.map(t => t.id === id ? { ...t, archive } : t));
    await supabase.from('veille_reglementaire').update({ archive }).eq('id', id);
  };

  const supprimerTexte = async (id) => {
    await supabase.from('veille_reglementaire').delete().eq('id', id);
    setTextes(textes.filter(t => t.id !== id));
  };

  const ajouterTexte = async () => {
    setSaving(true);
    const { data, error } = await supabase.from('veille_reglementaire').insert([nouveauTexte]).select();
    if (!error && data) {
      setTextes([data[0], ...textes]);
      setShowForm(false);
      setNouveauTexte({ titre: '', domaine: 'Sécurité', source: 'Journal Officiel', date_parution: new Date().toISOString().split('T')[0], resume: '', url: '', statut: 'À analyser', impact: 'Moyen', notes: '', archive: false });
    }
    setSaving(false);
  };

  const textesFiltres = textes.filter(t => {
    if (!showArchives && t.archive) return false;
    if (showArchives && !t.archive) return false;
    const okD = filtreDomaine === 'Tous' || t.domaine === filtreDomaine;
    const okS = filtreStatut  === 'Tous' || t.statut  === filtreStatut;
    return okD && okS;
  });

  const textesActifs  = textes.filter(t => !t.archive);
  const nbAAnalyser   = textesActifs.filter(t => t.statut === 'À analyser').length;
  const nbAMettre     = textesActifs.filter(t => t.statut === 'À mettre en œuvre').length;
  const nbConformes   = textesActifs.filter(t => t.statut === 'Conforme').length;
  const nbArchives    = textes.filter(t => t.archive).length;
  const tauxConformite = textesActifs.length > 0 ? Math.round((nbConformes / textesActifs.length) * 100) : 0;

  return (
    <div className="space-y-6 pb-10">

      {/* ── En-tête ─────────────────────────────────────────────────────── */}
      <header className="page-header">
        <div>
          <h2 className="page-title flex items-center gap-3">
            <BookOpen size={26} className="text-blue-400" />
            Veille Réglementaire
          </h2>
          <p className="page-subtitle">Suivi automatique des textes réglementaires QHSE</p>
        </div>
        <div className="flex gap-3">
          <button onClick={chargerTextes} className="btn-secondary">
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            Actualiser
          </button>
          <button
            onClick={lancerVeilleAuto}
            disabled={veilleLoading}
            className="btn-secondary"
            style={{ borderColor: 'rgba(16,185,129,0.4)', color: '#34D399' }}
          >
            <Zap size={16} className={veilleLoading ? 'animate-pulse' : ''} />
            {veilleLoading ? 'Recherche en cours...' : 'Lancer la veille auto'}
          </button>
          <WriteOnly><button onClick={() => setShowForm(!showForm)} className="btn-primary">
            <Plus size={16} /> Ajouter un texte
          </button></WriteOnly>
        </div>
      </header>

      {/* ── Résultat veille auto ─────────────────────────────────────────── */}
      {veilleResultat && (
        <div className={`alert-banner ${veilleResultat.success !== false ? 'alert-green' : 'alert-red'}`}>
          <Zap size={18} className="shrink-0" />
          {veilleResultat.success !== false ? (
            <div>
              <p className="font-bold">Veille automatique terminée</p>
              <p className="text-xs mt-1 opacity-80">
                {veilleResultat.nouveaux} nouveau{veilleResultat.nouveaux > 1 ? 'x' : ''} texte{veilleResultat.nouveaux > 1 ? 's' : ''} détecté{veilleResultat.nouveaux > 1 ? 's' : ''} · {veilleResultat.doublons} doublons ignorés · {veilleResultat.sources} sources consultées
              </p>
            </div>
          ) : (
            <div>
              <p className="font-bold">Erreur lors de la veille automatique</p>
              <p className="text-xs mt-1 opacity-80">{veilleResultat?.message || 'Erreur inconnue'}</p>
            </div>
          )}
        </div>
      )}

      {/* ── Info déploiement ─────────────────────────────────────────────── */}
      {!veilleResultat && (
        <div className="glass-panel p-4 border border-emerald-500/20">
          <div className="flex items-start gap-3">
            <Zap size={18} className="text-emerald-400 shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="text-emerald-300 font-bold mb-1">Veille automatique disponible</p>
              <p className="text-slate-400">Pour activer la recherche automatique hebdomadaire, déploie la Edge Function <code className="bg-slate-900 px-1.5 py-0.5 rounded text-emerald-400 text-xs">veille-auto</code> sur Supabase (comme tu l'as fait pour <code className="bg-slate-900 px-1.5 py-0.5 rounded text-blue-400 text-xs">send-alertes</code>), puis clique <strong className="text-white">"Lancer la veille auto"</strong> pour tester.</p>
              <p className="text-slate-500 text-xs mt-1">Pour automatiser : Supabase Dashboard → Edge Functions → veille-auto → Schedule → Every Monday 8:00 AM</p>
            </div>
          </div>
        </div>
      )}

      {/* ── KPIs ────────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: 'Textes actifs',       val: textesActifs.length,  color: 'blue',  desc: 'Référentiel' },
          { label: 'À analyser',          val: nbAAnalyser,          color: 'amber', desc: 'En attente' },
          { label: 'À mettre en œuvre',   val: nbAMettre,            color: 'red',   desc: 'Urgents' },
          { label: 'Taux conformité',     val: `${tauxConformite}%`, color: tauxConformite >= 70 ? 'green' : 'amber', desc: `${nbConformes} conformes` },
          { label: 'Archivés',            val: nbArchives,           color: 'purple', desc: 'Non applicables' },
        ].map((k, i) => (
          <div key={i} className={`kpi-card ${k.color}`}>
            <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">{k.label}</p>
            <p className="text-3xl font-black text-white">{k.val}</p>
            <p className="text-xs text-slate-500 mt-1">{k.desc}</p>
          </div>
        ))}
      </div>

      {/* ── Alertes ─────────────────────────────────────────────────────── */}
      {(nbAAnalyser > 0 || nbAMettre > 0) && !showArchives && (
        <div className="space-y-2">
          {nbAMettre > 0 && (
            <div className="alert-banner alert-red">
              <AlertTriangle size={18} className="shrink-0" />
              <div>
                <p className="font-bold">{nbAMettre} texte{nbAMettre > 1 ? 's' : ''} nécessitent une mise en conformité urgente</p>
                <p className="text-xs mt-1 opacity-80">{textesActifs.filter(t => t.statut === 'À mettre en œuvre').map(t => t.titre.substring(0, 50)).join(' · ')}</p>
              </div>
            </div>
          )}
          {nbAAnalyser > 0 && (
            <div className="alert-banner alert-amber">
              <Clock size={18} className="shrink-0" />
              <p className="font-bold">{nbAAnalyser} texte{nbAAnalyser > 1 ? 's' : ''} en attente d'analyse</p>
            </div>
          )}
        </div>
      )}

      {/* ── Formulaire ajout ─────────────────────────────────────────────── */}
      {showForm && (
        <div className="glass-panel p-6 border border-blue-500/20">
          <h3 className="text-white font-bold text-lg mb-4">Nouveau texte réglementaire</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="text-slate-400 text-xs font-bold uppercase tracking-wider block mb-1">Titre *</label>
              <input type="text" value={nouveauTexte.titre} onChange={e => setNouveauTexte({...nouveauTexte, titre: e.target.value})} placeholder="Ex: Décret n°2024-XXX..." className="input-modern" />
            </div>
            {[
              { label: 'Domaine', key: 'domaine', options: DOMAINES.filter(d => d !== 'Tous') },
              { label: 'Source', key: 'source', options: SOURCES },
              { label: 'Impact', key: 'impact', options: ['Élevé', 'Moyen', 'Faible'] },
              { label: 'Statut', key: 'statut', options: STATUTS },
            ].map(f => (
              <div key={f.key}>
                <label className="text-slate-400 text-xs font-bold uppercase tracking-wider block mb-1">{f.label}</label>
                <select value={nouveauTexte[f.key]} onChange={e => setNouveauTexte({...nouveauTexte, [f.key]: e.target.value})} className="input-modern">
                  {f.options.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
            ))}
            <div>
              <label className="text-slate-400 text-xs font-bold uppercase tracking-wider block mb-1">Date de parution</label>
              <input type="date" value={nouveauTexte.date_parution} onChange={e => setNouveauTexte({...nouveauTexte, date_parution: e.target.value})} className="input-modern" />
            </div>
            <div>
              <label className="text-slate-400 text-xs font-bold uppercase tracking-wider block mb-1">URL</label>
              <input type="url" value={nouveauTexte.url} onChange={e => setNouveauTexte({...nouveauTexte, url: e.target.value})} placeholder="https://..." className="input-modern" />
            </div>
            <div className="md:col-span-2">
              <label className="text-slate-400 text-xs font-bold uppercase tracking-wider block mb-1">Résumé</label>
              <textarea rows={2} value={nouveauTexte.resume} onChange={e => setNouveauTexte({...nouveauTexte, resume: e.target.value})} placeholder="Description de l'obligation..." className="input-modern resize-none" />
            </div>
            <div className="md:col-span-2">
              <label className="text-slate-400 text-xs font-bold uppercase tracking-wider block mb-1">Notes internes</label>
              <input type="text" value={nouveauTexte.notes} onChange={e => setNouveauTexte({...nouveauTexte, notes: e.target.value})} placeholder="Actions prises..." className="input-modern" />
            </div>
          </div>
          <div className="flex gap-3 mt-5">
            <button onClick={() => setShowForm(false)} className="btn-secondary">Annuler</button>
            <button onClick={ajouterTexte} disabled={!nouveauTexte.titre || saving} className="btn-primary">
              {saving ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16} />} Enregistrer
            </button>
          </div>
        </div>
      )}

      {/* ── Filtres + toggle archives ─────────────────────────────────────── */}
      <div className="flex flex-wrap gap-3 items-center">
        <Filter size={15} className="text-slate-400" />
        <div className="flex gap-2 flex-wrap">
          {DOMAINES.map(d => (
            <button key={d} onClick={() => setFiltreDomaine(d)} style={{ background: filtreDomaine === d ? (DOMAINE_COLORS[d] || 'rgba(59,130,246,0.3)') + '30' : 'rgba(255,255,255,0.05)', borderColor: filtreDomaine === d ? (DOMAINE_COLORS[d] || '#3B82F6') + '60' : 'rgba(255,255,255,0.08)', color: filtreDomaine === d ? (DOMAINE_COLORS[d] || '#60A5FA') : '#64748B', fontSize: 12, fontWeight: 600, padding: '5px 12px', borderRadius: 100, border: '1px solid', cursor: 'pointer', transition: 'all 0.15s' }}>
              {d}
            </button>
          ))}
        </div>
        <div className="flex gap-2 flex-wrap border-l border-white/10 pl-3">
          {['Tous', ...STATUTS].map(s => (
            <button key={s} onClick={() => setFiltreStatut(s)} style={{ background: filtreStatut === s ? 'rgba(59,130,246,0.2)' : 'rgba(255,255,255,0.04)', borderColor: filtreStatut === s ? 'rgba(59,130,246,0.4)' : 'rgba(255,255,255,0.08)', color: filtreStatut === s ? '#60A5FA' : '#64748B', fontSize: 12, fontWeight: 600, padding: '5px 12px', borderRadius: 100, border: '1px solid', cursor: 'pointer', transition: 'all 0.15s' }}>
              {s}
            </button>
          ))}
        </div>
        <button
          onClick={() => setShowArchives(!showArchives)}
          className="btn-secondary ml-auto flex items-center gap-2"
          style={{ fontSize: 12, padding: '6px 14px', color: showArchives ? '#A78BFA' : '#64748B', borderColor: showArchives ? 'rgba(139,92,246,0.4)' : undefined }}
        >
          {showArchives ? <Eye size={14} /> : <EyeOff size={14} />}
          {showArchives ? `Actifs` : `Archives (${nbArchives})`}
        </button>
        <span className="text-slate-500 text-sm">{textesFiltres.length} texte{textesFiltres.length > 1 ? 's' : ''}</span>
      </div>

      {/* ── Liste ────────────────────────────────────────────────────────── */}
      {loading ? (
        <div className="glass-panel p-10 text-center"><RefreshCw size={28} className="animate-spin mx-auto mb-3 text-blue-400" /><p className="text-slate-400">Chargement...</p></div>
      ) : textesFiltres.length === 0 ? (
        <div className="glass-panel p-10 text-center text-slate-400">Aucun texte pour ces critères.</div>
      ) : (
        <div className="space-y-3">
          {textesFiltres.map((texte) => {
            const statutStyle  = STATUT_STYLE[texte.statut] || STATUT_STYLE['À analyser'];
            const domaineColor = DOMAINE_COLORS[texte.domaine] || '#3B82F6';
            const impactColor  = texte.impact === 'Élevé' ? '#EF4444' : texte.impact === 'Moyen' ? '#F59E0B' : '#10B981';

            return (
              <div key={texte.id} className="glass-panel p-5 transition-all" style={{ borderLeft: `3px solid ${domaineColor}`, opacity: texte.archive ? 0.6 : 1 }}>
                <div className="flex items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start gap-3 mb-2 flex-wrap">
                      <h3 className="text-white font-semibold text-base flex-1">{texte.titre}</h3>
                      <div className="flex gap-2 shrink-0 flex-wrap">
                        <span className={`badge ${statutStyle.badge} flex items-center gap-1`}>{statutStyle.icon}{texte.statut}</span>
                        <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 100, background: `${impactColor}20`, color: impactColor, border: `1px solid ${impactColor}40` }}>Impact {texte.impact}</span>
                        {texte.date_detection && <span style={{ fontSize: 10, color: '#64748B', padding: '3px 8px', borderRadius: 100, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>Détecté le {texte.date_detection}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-slate-400 mb-3 flex-wrap">
                      <span style={{ background: `${domaineColor}20`, color: domaineColor, padding: '2px 8px', borderRadius: 100, fontWeight: 700, fontSize: 11 }}>{texte.domaine}</span>
                      <span>{texte.source}</span>
                      <span>{texte.date_parution}</span>
                      {texte.url && <a href={texte.url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-blue-400 hover:text-blue-300 transition-colors"><ExternalLink size={11} /> Consulter</a>}
                    </div>
                    {texte.resume && <p className="text-slate-400 text-sm mb-3 leading-relaxed">{texte.resume}</p>}
                    <div className="flex items-center gap-3 flex-wrap">
                      <select value={texte.statut} onChange={e => updateStatut(texte.id, e.target.value, texte.notes)} className="input-modern" style={{ width: 'auto', padding: '5px 30px 5px 10px', fontSize: 12 }}>
                        {STATUTS.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                      <input type="text" value={texte.notes || ''} onChange={e => updateStatut(texte.id, texte.statut, e.target.value)} placeholder="Notes internes..." className="input-modern flex-1" style={{ padding: '5px 12px', fontSize: 12 }} />
                      <WriteOnly>
                        <button
                          onClick={() => archiverTexte(texte.id, !texte.archive)}
                          title={texte.archive ? 'Désarchiver' : 'Archiver'}
                          className="text-slate-500 hover:text-purple-400 transition-colors p-1.5 rounded-lg hover:bg-white/5"
                        >
                          <Archive size={16} />
                        </button>
                        <button onClick={() => supprimerTexte(texte.id)} className="text-slate-600 hover:text-red-400 transition-colors p-1.5 rounded-lg hover:bg-white/5">
                          <Trash2 size={16} />
                        </button>
                      </WriteOnly>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
