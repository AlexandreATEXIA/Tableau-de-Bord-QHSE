import { useTheme } from './ThemeContext';
import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from './supabaseClient';
import {
  Users, GraduationCap, HeartPulse, Plus, Trash2, Save,
  RefreshCw, X, Filter, CheckCircle, AlertTriangle, TrendingUp
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from 'recharts';
import GestionListes from './GestionListes';
import Habilitations from './Habilitations';
import { useEmployes } from './EmployesContext';
import { Upload } from 'lucide-react';
import { useListe } from './utils/useListe';
import { WriteOnly } from './WriteGuard';

// Identifiants de persistance des listes éditables — alignés sur la convention
// utilisée par GestionListes (clé localStorage `gl_${STORAGE_KEY}`). L'export
// permet à ImportExcel de fusionner automatiquement les nouvelles valeurs
// rencontrées dans un fichier .xlsx sans casser le référentiel existant.
export const LISTES_SOCIAL_RH = {
  STORAGE_KEY: 'social_rh',
  POSTES: 'Postes',
  SERVICES: 'Services',
  CONTRATS: 'Contrats',
  TYPES_FORM: 'Types de formation',
  ORGANISMES: 'Organismes',
};

// ─── Listes par défaut ────────────────────────────────────────────────────────
const POSTES_DEFAULT    = ['Responsable QHSE','Opérateur','Technicien','Agent de maîtrise','Cadre','Administratif','Chargé d\'affaires','Manager','Direction'];
const SERVICES_DEFAULT  = ['QHSE','Production','Maintenance','Logistique','Commercial','RH','Direction','IT','Achats'];
const CONTRATS_DEFAULT  = ['CDI','CDD','Intérim','Apprentissage','Stage','Prestataire'];
const TYPES_FORM_DEFAULT = ['Sécurité','Qualité','Environnement','Management','Technique','Réglementaire','Soft skills','Informatique'];
const STATUTS_FORM      = ['Planifiée','En cours','Réalisée','Annulée'];
const ORGANISMES_DEFAULT = ['INRS','AFNOR','APAVE','OPPBTP','Organisme interne','Autre'];

const CONTRAT_COLORS = { 'CDI':'#10B981','CDD':'#3B82F6','Intérim':'#F59E0B','Apprentissage':'#8B5CF6','Stage':'#06B6D4','Prestataire':'#94A3B8' };

const EFFECTIF_AN = 1607; // heures/an/salarié

export default function SocialRH() {
  const { p } = useTheme();
  const [subTab, setSubTab]       = useState('effectifs');
  const [loading, setLoading]     = useState(false);

  // États données
  const [employes, setEmployes]   = useState([]);
  const [formations, setFormations] = useState([]);
  const [accidents, setAccidents]  = useState([]);

  // Listes personnalisables — branchées sur useListe (étape B) :
  // cache local instantané + refresh Supabase + écritures synchronisées.
  const [listePostes, setPostes]         = useListe(LISTES_SOCIAL_RH.STORAGE_KEY, LISTES_SOCIAL_RH.POSTES,     POSTES_DEFAULT);
  const [listeServices, setServices]     = useListe(LISTES_SOCIAL_RH.STORAGE_KEY, LISTES_SOCIAL_RH.SERVICES,   SERVICES_DEFAULT);
  const [listeContrats, setContrats]     = useListe(LISTES_SOCIAL_RH.STORAGE_KEY, LISTES_SOCIAL_RH.CONTRATS,   CONTRATS_DEFAULT);
  const [listeTypesForm, setTypesForm]   = useListe(LISTES_SOCIAL_RH.STORAGE_KEY, LISTES_SOCIAL_RH.TYPES_FORM, TYPES_FORM_DEFAULT);
  const [listeOrganismes, setOrganismes] = useListe(LISTES_SOCIAL_RH.STORAGE_KEY, LISTES_SOCIAL_RH.ORGANISMES, ORGANISMES_DEFAULT);

  const [saving, setSaving]       = useState(null);
  const [importLoading, setImportLoading] = useState(false);
  const { chargerEmployes } = useEmployes();

  // ── Import Excel employés ─────────────────────────────────────────────────
  const importerExcelEmployes = async (file) => {
    if (!file) return;
    setImportLoading(true);
    const XLSX = await new Promise(resolve => {
      if (window.XLSX) { resolve(window.XLSX); return; }
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
      s.onload = () => resolve(window.XLSX);
      document.head.appendChild(s);
    });
    const buf = await file.arrayBuffer();
    const wb  = XLSX.read(buf, { type: 'array' });
    const ws  = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
    const mapped = rows.filter(r => r['Nom'] || r['nom']).map(r => ({
      nom:         r['Nom']         || r['nom']         || '',
      prenom:      r['Prénom']      || r['prenom']      || '',
      poste:       r['Poste']       || r['poste']       || listePostes[0],
      service:     r['Service']     || r['service']     || listeServices[0],
      contrat:     r['Contrat']     || r['contrat']     || 'CDI',
      date_entree: r['Date entrée'] || r['date_entree'] || null,
      actif: true,
    }));
    if (mapped.length > 0) {
      const { data } = await supabase.from('rh_employes').insert(mapped).select();
      if (data) { setEmployes(prev => [...prev, ...data].sort((a,b) => a.nom.localeCompare(b.nom))); chargerEmployes(); }
    }
    setImportLoading(false);
    alert(`✅ ${mapped.length} employé(s) importé(s) !`);
  };
  const [showFormEmp, setShowFormEmp] = useState(false);
  const [showFormForm, setShowFormForm] = useState(false);
  const [newEmp, setNewEmp]       = useState({ nom: '', prenom: '', poste: POSTES_DEFAULT[0], service: SERVICES_DEFAULT[0], contrat: CONTRATS_DEFAULT[0], date_entree: '', actif: true });
  const [newForm, setNewForm]     = useState({ titre: '', type_formation: TYPES_FORM_DEFAULT[0], organisme: ORGANISMES_DEFAULT[0], date_debut: new Date().toISOString().split('T')[0], date_fin: '', duree_heures: 7, participants: '', cout: '', statut: 'Planifiée', notes: '' });

  useEffect(() => { chargerTout(); }, []);

  const chargerTout = async () => {
    setLoading(true);
    const [r1, r2, r3] = await Promise.all([
      supabase.from('rh_employes').select('*').order('nom'),
      supabase.from('rh_formations').select('*').order('date_debut', { ascending: false }),
      supabase.from('securite_accidents').select('*').order('date_evenement', { ascending: false }),
    ]);
    if (r1.data) setEmployes(r1.data);
    if (r2.data) setFormations(r2.data);
    if (r3.data) setAccidents(r3.data);
    setLoading(false);
  };

  // ── Employés ──────────────────────────────────────────────────────────────
  const ajouterEmploye = async () => {
    if (!newEmp.nom.trim()) return;
    const { data } = await supabase.from('rh_employes').insert([newEmp]).select();
    if (data) { setEmployes(prev => [...prev, data[0]].sort((a,b) => a.nom.localeCompare(b.nom))); setShowFormEmp(false); }
  };

  const updateEmp = (id, field, value) => setEmployes(prev => prev.map(e => e.id === id ? {...e, [field]: value} : e));
  const saveEmp   = async (row) => { setSaving(row.id); await supabase.from('rh_employes').update(row).eq('id', row.id); setSaving(null); };
  const deleteEmp = async (id) => { await supabase.from('rh_employes').delete().eq('id', id); setEmployes(prev => prev.filter(e => e.id !== id)); };

  // ── Formations ────────────────────────────────────────────────────────────
  const ajouterFormation = async () => {
    if (!newForm.titre.trim()) return;
    const { data } = await supabase.from('rh_formations').insert([newForm]).select();
    if (data) { setFormations(prev => [data[0], ...prev]); setShowFormForm(false); }
  };

  const updateForm = (id, field, value) => setFormations(prev => prev.map(f => f.id === id ? {...f, [field]: value} : f));
  const saveForm   = async (row) => { setSaving(row.id); await supabase.from('rh_formations').update(row).eq('id', row.id); setSaving(null); };
  const deleteForm = async (id) => { await supabase.from('rh_formations').delete().eq('id', id); setFormations(prev => prev.filter(f => f.id !== id)); };

  // ── KPIs Effectifs ────────────────────────────────────────────────────────
  const kpiEff = useMemo(() => {
    const actifs = employes.filter(e => e.actif !== false);
    const parService = {};
    actifs.forEach(e => { parService[e.service] = (parService[e.service] || 0) + 1; });
    const parContrat = {};
    actifs.forEach(e => { parContrat[e.contrat] = (parContrat[e.contrat] || 0) + 1; });
    return {
      total: actifs.length, cdi: actifs.filter(e => e.contrat === 'CDI').length,
      parService: Object.entries(parService).map(([s, n]) => ({ service: s, count: n })).sort((a,b) => b.count - a.count),
      parContrat: Object.entries(parContrat).map(([c, n]) => ({ contrat: c, count: n, color: CONTRAT_COLORS[c] || '#64748B' })),
    };
  }, [employes]);

  // ── KPIs Formations ───────────────────────────────────────────────────────
  const kpiForm = useMemo(() => {
    const realisees = formations.filter(f => f.statut === 'Réalisée');
    const planifiees = formations.filter(f => f.statut === 'Planifiée');
    const totalH = realisees.reduce((s, f) => s + Number(f.duree_heures || 0), 0);
    const totalCout = formations.reduce((s, f) => s + Number(f.cout || 0), 0);
    const parType = {};
    formations.forEach(f => { parType[f.type_formation] = (parType[f.type_formation] || 0) + 1; });
    return {
      total: formations.length, realisees: realisees.length, planifiees: planifiees.length,
      totalH, totalCout, tauxRealisation: formations.length > 0 ? Math.round((realisees.length / formations.length) * 100) : 0,
      parType: Object.entries(parType).map(([t, n], i) => ({ type: t, count: n, color: ['#3B82F6','#10B981','#F59E0B','#8B5CF6','#EF4444','#06B6D4'][i%6] })),
    };
  }, [formations]);

  // ── KPIs AT/MP ────────────────────────────────────────────────────────────
  const kpiAT = useMemo(() => {
    const nbSal  = employes.filter(e => e.actif !== false).length || 50;
    const heures = nbSal * EFFECTIF_AN;
    const accArret = accidents.filter(a => a.type_evenement === 'Accident avec arrêt');
    const jours  = accidents.reduce((s, a) => s + Number(a.jours_perdus || 0), 0);
    const TF = accArret.length > 0 ? ((accArret.length * 1000000) / heures).toFixed(2) : '0.00';
    const TG = jours > 0 ? ((jours * 1000) / heures).toFixed(2) : '0.00';
    const parType = {};
    accidents.forEach(a => { parType[a.type_evenement] = (parType[a.type_evenement] || 0) + 1; });
    return {
      total: accidents.length, accArret: accArret.length, jours, TF, TG, nbSal,
      parType: Object.entries(parType).map(([t, n], i) => ({ type: t.substring(0,20), count: n, color: ['#EF4444','#F59E0B','#3B82F6','#8B5CF6'][i%4] })),
    };
  }, [accidents, employes]);

  const TABS = [
    { id: 'effectifs', label: 'Effectifs',           icon: <Users size={15}/>,         color: '#3B82F6', count: kpiEff.total },
    { id: 'formations',label: 'Plan de Formation',   icon: <GraduationCap size={15}/>,  color: '#8B5CF6', count: formations.length },
    { id: 'atmp',      label: 'Bilan AT/MP',         icon: <HeartPulse size={15}/>,     color: '#EF4444', count: accidents.length },
    { id: 'habilitations', label: 'Habilitations',      icon: <GraduationCap size={15}/>,  color: '#10B981', count: 0 },
  ];

  const STATUT_FORM_STYLE = {
    'Planifiée': { color:'#3B82F6', bg:'rgba(59,130,246,0.12)', border:'rgba(59,130,246,0.3)' },
    'En cours':  { color:'#F59E0B', bg:'rgba(245,158,11,0.12)', border:'rgba(245,158,11,0.3)' },
    'Réalisée':  { color:'#10B981', bg:'rgba(16,185,129,0.12)', border:'rgba(16,185,129,0.3)' },
    'Annulée':   { color:p.text3, bg:'rgba(100,116,139,0.12)',border:'rgba(100,116,139,0.3)' },
  };

  return (
    <div className="space-y-5 pb-10">

      {/* ── En-tête ──────────────────────────────────────────────────────── */}
      <header className="page-header">
        <div>
          <h2 className="page-title flex items-center gap-3"><Users size={26} className="text-blue-400"/> Social & RH</h2>
          <p className="page-subtitle">Effectifs, plan de formation et bilan sécurité</p>
        </div>
        <div className="flex gap-3">
          <GestionListes
            listes={{ 'Postes': listePostes, 'Services': listeServices, 'Contrats': listeContrats, 'Types de formation': listeTypesForm, 'Organismes': listeOrganismes }}
            onSave={(key, list) => {
              if (key === 'Postes') setPostes(list);
              if (key === 'Services') setServices(list);
              if (key === 'Contrats') setContrats(list);
              if (key === 'Types de formation') setTypesForm(list);
              if (key === 'Organismes') setOrganismes(list);
            }}
            storageKey="social_rh"
          />
          <button onClick={chargerTout} className="btn-secondary">
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''}/> Actualiser
          </button>
          {subTab === 'effectifs' && (
            <>
              <label className="btn-secondary" style={{cursor:'pointer', display:'inline-flex', alignItems:'center', gap:6, fontSize:13, padding:'8px 14px'}}>
                <Upload size={15}/>
                {importLoading ? 'Import...' : 'Importer Excel'}
                <input type="file" accept=".xlsx,.xls" style={{display:'none'}} onChange={e => { if(e.target.files[0]) importerExcelEmployes(e.target.files[0]); e.target.value=''; }}/>
              </label>
              <WriteOnly><button onClick={() => setShowFormEmp(true)} className="btn-primary"><Plus size={16}/> Ajouter un employé</button></WriteOnly>
            </>
          )}
          {subTab === 'formations' && <WriteOnly><button onClick={() => setShowFormForm(true)} className="btn-primary" style={{ background:'#8B5CF6', boxShadow:'0 0 16px rgba(139,92,246,0.3)' }}><Plus size={16}/> Ajouter une formation</button></WriteOnly>}
        </div>
      </header>

      {/* ── Onglets ───────────────────────────────────────────────────────── */}
      <div className="flex gap-2 border-b border-white/10 pb-0">
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => setSubTab(tab.id)}
            className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-t-xl transition-all border-b-2"
            style={subTab === tab.id ? { borderColor: tab.color, color: tab.color } : { borderColor: 'transparent', color: '#64748B' }}>
            {tab.icon}{tab.label}
            <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 100, background: subTab === tab.id ? `${tab.color}25` : p.whiteFaint3, color: subTab === tab.id ? tab.color : p.text3 }}>{tab.count}</span>
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* EFFECTIFS                                                         */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {subTab === 'effectifs' && (
        <div className="space-y-5 animate-fade-up">
          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Effectif total',  val: kpiEff.total,  color: 'blue',  sub: 'Salariés actifs' },
              { label: 'CDI',             val: kpiEff.cdi,    color: 'green', sub: 'Contrats permanents' },
              { label: 'Autres contrats', val: kpiEff.total - kpiEff.cdi, color: 'amber', sub: 'CDD, intérim, stages' },
              { label: 'Services',        val: kpiEff.parService.length, color: 'purple', sub: 'Entités distinctes' },
            ].map((k, i) => (
              <div key={i} className={`kpi-card ${k.color}`}>
                <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">{k.label}</p>
                <p className="text-3xl font-black text-white">{k.val}</p>
                <p className="text-xs text-slate-500 mt-2">{k.sub}</p>
              </div>
            ))}
          </div>

          {/* Graphique répartition */}
          {kpiEff.parService.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <div className="glass-panel p-5">
                <h3 className="text-white font-bold mb-4 text-sm">Répartition par service</h3>
                <div className="h-44">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={kpiEff.parService} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke={p.chartGrid} horizontal={false}/>
                      <XAxis type="number" stroke={p.chartAxis} tick={{fill:'#64748B', fontSize:11}} allowDecimals={false}/>
                      <YAxis type="category" dataKey="service" stroke={p.chartAxis} tick={{fill:'#64748B', fontSize:11}} width={90}/>
                      <Tooltip contentStyle={{background:p.tooltipBg, border:`1px solid ${p.tooltipBorder}`, borderRadius:10, fontSize:11}}/>
                      <Bar dataKey="count" name="Effectif" fill="#3B82F6" radius={[0,6,6,0]}/>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div className="glass-panel p-5">
                <h3 className="text-white font-bold mb-4 text-sm">Répartition par type de contrat</h3>
                <div className="space-y-3">
                  {kpiEff.parContrat.map((c, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <div style={{ width: 10, height: 10, borderRadius: 2, background: c.color, flexShrink: 0 }}/>
                      <span className="text-slate-400 text-sm flex-1">{c.contrat}</span>
                      <div style={{ flex: 2, height: 6, background: p.whiteFaint3, borderRadius: 3 }}>
                        <div style={{ height: '100%', width: `${(c.count / kpiEff.total) * 100}%`, background: c.color, borderRadius: 3, transition: 'width 0.8s ease' }}/>
                      </div>
                      <span className="text-white font-bold text-sm w-6 text-right">{c.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Formulaire ajout employé */}
          {showFormEmp && (
            <div className="glass-panel p-5 border border-blue-500/20 animate-fade-up">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-white font-bold">Nouvel employé</h3>
                <button onClick={() => setShowFormEmp(false)} className="text-slate-500 hover:text-white p-1"><X size={16}/></button>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {[
                  { label: 'Nom *',      key: 'nom',         type: 'text', placeholder: 'Dupont' },
                  { label: 'Prénom',     key: 'prenom',      type: 'text', placeholder: 'Jean' },
                  { label: 'Poste',      key: 'poste',       type: 'select', options: listePostes },
                  { label: 'Service',    key: 'service',     type: 'select', options: listeServices },
                  { label: 'Contrat',    key: 'contrat',     type: 'select', options: listeContrats },
                  { label: 'Date entrée',key: 'date_entree', type: 'date' },
                ].map(f => (
                  <div key={f.key}>
                    <label className="text-slate-400 text-xs font-bold uppercase tracking-wider block mb-1">{f.label}</label>
                    {f.type === 'select'
                      ? <select value={newEmp[f.key]} onChange={e => setNewEmp({...newEmp, [f.key]: e.target.value})} className="input-modern">{f.options.map(o => <option key={o}>{o}</option>)}</select>
                      : <input type={f.type} value={newEmp[f.key]} onChange={e => setNewEmp({...newEmp, [f.key]: e.target.value})} placeholder={f.placeholder} className="input-modern"/>}
                  </div>
                ))}
              </div>
              <div className="flex gap-3 mt-4">
                <button onClick={() => setShowFormEmp(false)} className="btn-secondary">Annuler</button>
                <button onClick={ajouterEmploye} disabled={!newEmp.nom.trim()} className="btn-primary"><Save size={14}/> Enregistrer</button>
              </div>
            </div>
          )}

          {/* Tableau employés */}
          <div className="glass-panel">
            <div className="flex justify-between items-center p-4 border-b border-white/8">
              <h3 className="text-white font-bold text-sm">Registre du personnel — {kpiEff.total} actif{kpiEff.total > 1 ? 's' : ''}</h3>
            </div>
            {employes.length === 0 ? (
              <div className="p-10 text-center text-slate-400">Aucun employé. Cliquez sur "Ajouter un employé".</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="table-modern">
                  <thead><tr><th>Nom</th><th>Prénom</th><th>Poste</th><th>Service</th><th style={{width:120}}>Contrat</th><th style={{width:120}}>Date entrée</th><th style={{width:50}}></th></tr></thead>
                  <tbody>
                    {employes.map(row => {
                      const cc = CONTRAT_COLORS[row.contrat] || '#64748B';
                      return (
                        <tr key={row.id}>
                          <td><input type="text" value={row.nom||''} onChange={e => updateEmp(row.id,'nom',e.target.value)} onBlur={() => saveEmp(employes.find(e=>e.id===row.id))} className="input-modern" style={{padding:'5px 8px',fontSize:13}}/></td>
                          <td><input type="text" value={row.prenom||''} onChange={e => updateEmp(row.id,'prenom',e.target.value)} onBlur={() => saveEmp(employes.find(e=>e.id===row.id))} className="input-modern" style={{padding:'5px 8px',fontSize:13}}/></td>
                          <td><select value={row.poste||listePostes[0]} onChange={e => updateEmp(row.id,'poste',e.target.value)} onBlur={() => saveEmp(employes.find(e=>e.id===row.id))} className="input-modern" style={{padding:'5px 8px',fontSize:12}}>{listePostes.map(p => <option key={p}>{p}</option>)}</select></td>
                          <td><select value={row.service||listeServices[0]} onChange={e => updateEmp(row.id,'service',e.target.value)} onBlur={() => saveEmp(employes.find(e=>e.id===row.id))} className="input-modern" style={{padding:'5px 8px',fontSize:12}}>{listeServices.map(s => <option key={s}>{s}</option>)}</select></td>
                          <td>
                            <select value={row.contrat||listeContrats[0]} onChange={e => updateEmp(row.id,'contrat',e.target.value)} onBlur={() => saveEmp(employes.find(e=>e.id===row.id))}
                              style={{background:`${cc}15`,color:cc,border:`1px solid ${cc}40`,borderRadius:8,padding:'5px 8px',fontSize:12,fontWeight:700,outline:'none',cursor:'pointer',width:'100%'}}>
                              {listeContrats.map(c => <option key={c} style={{background:'#0B1120',color:p.text1}}>{c}</option>)}
                            </select>
                          </td>
                          <td><input type="date" value={row.date_entree||''} onChange={e => updateEmp(row.id,'date_entree',e.target.value)} onBlur={() => saveEmp(employes.find(e=>e.id===row.id))} className="input-modern" style={{padding:'5px 8px',fontSize:12}}/></td>
                          <td className="text-center">{saving===row.id ? <RefreshCw size={13} className="animate-spin text-blue-400 mx-auto"/> : <WriteOnly><button onClick={() => deleteEmp(row.id)} className="text-slate-600 hover:text-red-400 p-1.5 rounded"><Trash2 size={14}/></button></WriteOnly>}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* FORMATIONS                                                        */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {subTab === 'formations' && (
        <div className="space-y-5 animate-fade-up">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Total formations', val: kpiForm.total,           color: 'purple', sub: 'Plan annuel' },
              { label: 'Réalisées',        val: kpiForm.realisees,       color: 'green',  sub: `Taux : ${kpiForm.tauxRealisation}%` },
              { label: 'Planifiées',       val: kpiForm.planifiees,      color: 'blue',   sub: 'À venir' },
              { label: 'Heures total',     val: `${kpiForm.totalH}h`,    color: 'amber',  sub: `Coût : ${kpiForm.totalCout > 0 ? kpiForm.totalCout.toLocaleString() + '€' : '—'}` },
            ].map((k, i) => (
              <div key={i} className={`kpi-card ${k.color}`}>
                <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">{k.label}</p>
                <p className="text-3xl font-black text-white">{k.val}</p>
                <p className="text-xs text-slate-500 mt-2">{k.sub}</p>
              </div>
            ))}
          </div>

          {kpiForm.parType.length > 0 && (
            <div className="glass-panel p-5">
              <h3 className="text-white font-bold mb-4 text-sm">Formations par domaine</h3>
              <div className="h-40">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={kpiForm.parType}>
                    <CartesianGrid strokeDasharray="3 3" stroke={p.chartGrid} vertical={false}/>
                    <XAxis dataKey="type" stroke={p.chartAxis} tick={{fill:'#64748B', fontSize:11}}/>
                    <YAxis stroke={p.chartAxis} tick={{fill:'#64748B', fontSize:10}} allowDecimals={false}/>
                    <Tooltip contentStyle={{background:p.tooltipBg, border:`1px solid ${p.tooltipBorder}`, borderRadius:10, fontSize:11}}/>
                    <Bar dataKey="count" name="Formations" radius={[6,6,0,0]}>
                      {kpiForm.parType.map((t, i) => <Cell key={i} fill={t.color}/>)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {showFormForm && (
            <div className="glass-panel p-5 border border-purple-500/20 animate-fade-up">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-white font-bold">Nouvelle formation</h3>
                <button onClick={() => setShowFormForm(false)} className="text-slate-500 hover:text-white p-1"><X size={16}/></button>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="col-span-2 md:col-span-3">
                  <label className="text-slate-400 text-xs font-bold uppercase tracking-wider block mb-1">Titre *</label>
                  <input type="text" value={newForm.titre} onChange={e => setNewForm({...newForm, titre: e.target.value})} placeholder="Intitulé de la formation..." className="input-modern"/>
                </div>
                {[
                  { label: 'Type',       key: 'type_formation',  type: 'select', options: listeTypesForm },
                  { label: 'Organisme',  key: 'organisme',       type: 'select', options: listeOrganismes },
                  { label: 'Statut',     key: 'statut',          type: 'select', options: STATUTS_FORM },
                  { label: 'Date début', key: 'date_debut',      type: 'date' },
                  { label: 'Date fin',   key: 'date_fin',        type: 'date' },
                  { label: 'Durée (h)',  key: 'duree_heures',    type: 'number' },
                  { label: 'Participants', key: 'participants',  type: 'text', placeholder: 'Noms ou nombre...' },
                  { label: 'Coût (€)',   key: 'cout',            type: 'number' },
                  { label: 'Notes',      key: 'notes',           type: 'text', placeholder: 'Commentaire...' },
                ].map(f => (
                  <div key={f.key} className={f.key === 'notes' ? 'col-span-2 md:col-span-3' : ''}>
                    <label className="text-slate-400 text-xs font-bold uppercase tracking-wider block mb-1">{f.label}</label>
                    {f.type === 'select'
                      ? <select value={newForm[f.key]} onChange={e => setNewForm({...newForm, [f.key]: e.target.value})} className="input-modern">{f.options.map(o => <option key={o}>{o}</option>)}</select>
                      : <input type={f.type} value={newForm[f.key]} onChange={e => setNewForm({...newForm, [f.key]: e.target.value})} placeholder={f.placeholder} className="input-modern"/>}
                  </div>
                ))}
              </div>
              <div className="flex gap-3 mt-4">
                <button onClick={() => setShowFormForm(false)} className="btn-secondary">Annuler</button>
                <button onClick={ajouterFormation} disabled={!newForm.titre.trim()} className="btn-primary" style={{background:'#8B5CF6',boxShadow:'0 0 12px rgba(139,92,246,0.3)'}}><Save size={14}/> Enregistrer</button>
              </div>
            </div>
          )}

          <div className="glass-panel">
            <div className="p-4 border-b border-white/8">
              <h3 className="text-white font-bold text-sm">Plan de formation — {formations.length} formation{formations.length > 1 ? 's' : ''}</h3>
            </div>
            {formations.length === 0 ? (
              <div className="p-10 text-center text-slate-400">Aucune formation. Cliquez sur "Ajouter une formation".</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="table-modern">
                  <thead><tr><th>Titre</th><th style={{width:120}}>Type</th><th style={{width:120}}>Organisme</th><th style={{width:110}}>Date</th><th style={{width:70, textAlign:'center'}}>Durée</th><th style={{width:130}}>Statut</th><th style={{width:50}}></th></tr></thead>
                  <tbody>
                    {formations.map(row => {
                      const st = STATUT_FORM_STYLE[row.statut] || STATUT_FORM_STYLE['Planifiée'];
                      return (
                        <tr key={row.id}>
                          <td><input type="text" value={row.titre||''} onChange={e => updateForm(row.id,'titre',e.target.value)} onBlur={() => saveForm(formations.find(f=>f.id===row.id))} className="input-modern" style={{padding:'5px 8px',fontSize:13}}/></td>
                          <td><select value={row.type_formation||listeTypesForm[0]} onChange={e => updateForm(row.id,'type_formation',e.target.value)} onBlur={() => saveForm(formations.find(f=>f.id===row.id))} className="input-modern" style={{padding:'5px 8px',fontSize:12}}>{listeTypesForm.map(t => <option key={t}>{t}</option>)}</select></td>
                          <td><select value={row.organisme||listeOrganismes[0]} onChange={e => updateForm(row.id,'organisme',e.target.value)} onBlur={() => saveForm(formations.find(f=>f.id===row.id))} className="input-modern" style={{padding:'5px 8px',fontSize:12}}>{listeOrganismes.map(o => <option key={o}>{o}</option>)}</select></td>
                          <td><input type="date" value={row.date_debut||''} onChange={e => updateForm(row.id,'date_debut',e.target.value)} onBlur={() => saveForm(formations.find(f=>f.id===row.id))} className="input-modern" style={{padding:'5px 8px',fontSize:12}}/></td>
                          <td className="text-center"><input type="number" min="0" value={row.duree_heures||0} onChange={e => updateForm(row.id,'duree_heures',Number(e.target.value))} onBlur={() => saveForm(formations.find(f=>f.id===row.id))} className="input-modern text-center" style={{padding:'5px 4px',fontSize:13,fontWeight:700,width:60}}/></td>
                          <td>
                            <select value={row.statut||'Planifiée'} onChange={e => { updateForm(row.id,'statut',e.target.value); setTimeout(() => saveForm({...row, statut: e.target.value}), 0); }}
                              style={{background:st.bg,color:st.color,border:`1px solid ${st.border}`,borderRadius:8,padding:'5px 8px',fontSize:12,fontWeight:600,outline:'none',cursor:'pointer',width:'100%'}}>
                              {STATUTS_FORM.map(s => <option key={s} style={{background:'#0B1120',color:p.text1,fontWeight:400}}>{s}</option>)}
                            </select>
                          </td>
                          <td className="text-center">{saving===row.id ? <RefreshCw size={13} className="animate-spin text-blue-400 mx-auto"/> : <WriteOnly><button onClick={() => deleteForm(row.id)} className="text-slate-600 hover:text-red-400 p-1.5 rounded"><Trash2 size={14}/></button></WriteOnly>}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* BILAN AT/MP                                                       */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {subTab === 'atmp' && (
        <div className="space-y-5 animate-fade-up">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Événements total', val: kpiAT.total,           color: 'blue',  sub: 'Tous types' },
              { label: 'AT avec arrêt',    val: kpiAT.accArret,        color: kpiAT.accArret > 0 ? 'red' : 'green', sub: 'Accidents graves' },
              { label: 'Jours perdus',     val: kpiAT.jours,           color: kpiAT.jours > 0 ? 'amber' : 'green',  sub: 'Coût social' },
              { label: 'Taux de Fréquence',val: kpiAT.TF,              color: Number(kpiAT.TF) === 0 ? 'green' : 'red', sub: 'Base 1M heures' },
            ].map((k, i) => (
              <div key={i} className={`kpi-card ${k.color}`}>
                <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">{k.label}</p>
                <p className="text-3xl font-black text-white">{k.val}</p>
                <p className="text-xs text-slate-500 mt-2">{k.sub}</p>
              </div>
            ))}
          </div>

          {kpiAT.accArret === 0 && (
            <div className="alert-banner alert-green">
              <CheckCircle size={18} className="shrink-0"/>
              <p className="font-bold">Aucun accident avec arrêt — Objectif zéro AT maintenu ! TF = {kpiAT.TF} · TG = {kpiAT.TG}</p>
            </div>
          )}

          {kpiAT.parType.length > 0 && (
            <div className="glass-panel p-5">
              <h3 className="text-white font-bold mb-4 text-sm">Répartition par type d'événement</h3>
              <div className="h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={kpiAT.parType}>
                    <CartesianGrid strokeDasharray="3 3" stroke={p.chartGrid} vertical={false}/>
                    <XAxis dataKey="type" stroke={p.chartAxis} tick={{fill:'#64748B', fontSize:11}}/>
                    <YAxis stroke={p.chartAxis} tick={{fill:'#64748B', fontSize:10}} allowDecimals={false}/>
                    <Tooltip contentStyle={{background:p.tooltipBg, border:`1px solid ${p.tooltipBorder}`, borderRadius:10, fontSize:11}}/>
                    <Bar dataKey="count" name="Événements" radius={[6,6,0,0]}>
                      {kpiAT.parType.map((t, i) => <Cell key={i} fill={t.color}/>)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          <div className="glass-panel p-5">
            <h3 className="text-white font-bold mb-4 text-sm flex items-center gap-2"><TrendingUp size={16} className="text-blue-400"/> Indicateurs calculés</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { label: 'Taux de Fréquence (TF)', val: kpiAT.TF,  desc: 'Nb AT×1 000 000 / heures travaillées', ok: Number(kpiAT.TF) === 0 },
                { label: 'Taux de Gravité (TG)',    val: kpiAT.TG,  desc: 'Jours perdus×1 000 / heures travaillées', ok: Number(kpiAT.TG) === 0 },
                { label: 'Effectif de référence',   val: `${kpiAT.nbSal} sal.`, desc: `Base : ${kpiAT.nbSal} × ${EFFECTIF_AN}h = ${(kpiAT.nbSal * EFFECTIF_AN).toLocaleString()}h`, ok: true },
              ].map((k, i) => (
                <div key={i} className="glass-panel p-4" style={{ borderLeft: `3px solid ${k.ok ? '#10B981' : '#EF4444'}` }}>
                  <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">{k.label}</p>
                  <p style={{ fontSize: 28, fontWeight: 900, color: k.ok ? '#10B981' : '#EF4444' }}>{k.val}</p>
                  <p className="text-slate-500 text-xs mt-1">{k.desc}</p>
                </div>
              ))}
            </div>
            <p className="text-slate-500 text-xs mt-4">💡 Pour modifier l'effectif de référence, allez dans l'onglet <strong className="text-slate-400">Effectifs</strong> et ajoutez vos salariés.</p>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* HABILITATIONS                                                     */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {subTab === 'habilitations' && (
        <div className="animate-fade-up">
          <Habilitations />
        </div>
      )}

    </div>
  );
}
