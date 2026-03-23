import { useTheme } from './ThemeContext';
import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Save, Trash2, ClipboardCheck, AlertTriangle, Star, RefreshCw, Smile, CheckCircle, Clock, XCircle, BarChart2, Settings } from 'lucide-react';
import { supabase } from './supabaseClient';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import GestionListes from './GestionListes';

/* ─── Listes par défaut ──────────────────────────────────────────────────── */
const DEF_PROCESSUS   = ['Direction','RH','QHSE','Achats','Commercial','Production','Maintenance','IT','Logistique'];
const DEF_TYPES_AUDIT = ['Audit interne','Audit externe','Audit fournisseur','Audit certification','Audit à blanc'];
const DEF_TYPES_NC    = ['Mineure','Majeure','Critique'];
const DEF_ORIGINES    = ['Interne','Client','Fournisseur','Audit','Réglementation'];
const STATUTS_AUDIT   = ['Planifié','En cours','Réalisé','Reporté'];
const STATUTS_NC      = ["Ouverte","En cours d'analyse","Action définie","Clôturée"];

const AUDIT_STATUT_STYLE = {
  'Planifié': { color:'#3B82F6', bg:'rgba(59,130,246,0.12)', border:'rgba(59,130,246,0.3)' },
  'En cours': { color:'#F59E0B', bg:'rgba(245,158,11,0.12)',  border:'rgba(245,158,11,0.3)' },
  'Réalisé':  { color:'#10B981', bg:'rgba(16,185,129,0.12)', border:'rgba(16,185,129,0.3)' },
  'Reporté':  { color:'#EF4444', bg:'rgba(239,68,68,0.12)',  border:'rgba(239,68,68,0.3)' },
};
const NC_STATUT_STYLE = {
  'Ouverte':             { badge:'badge-red' },
  "En cours d'analyse":  { badge:'badge-amber' },
  'Action définie':      { badge:'badge-blue' },
  'Clôturée':            { badge:'badge-green' },
};

/* ─── Jauge score (composant pur, sans dépendance à p) ───────────────────── */
function JaugeScore({ score }) {
  const color = score >= 80 ? '#10B981' : score >= 60 ? '#F59E0B' : '#EF4444';
  const label = score >= 80 ? 'Excellent' : score >= 60 ? 'Satisfaisant' : 'À améliorer';
  const arc = (score / 100) * 126;
  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:2 }}>
      <div style={{ position:'relative', width:56, height:30, overflow:'hidden' }}>
        <svg viewBox="0 0 100 55" style={{ width:'100%' }}>
          <path d="M5 50 A40 40 0 0 1 95 50" fill="none" stroke="rgba(100,116,139,0.3)" strokeWidth="10" strokeLinecap="round"/>
          <path d="M5 50 A40 40 0 0 1 95 50" fill="none" stroke={color} strokeWidth="10" strokeLinecap="round"
            strokeDasharray={`${arc} 126`}/>
          <text x="50" y="48" textAnchor="middle" fill={color} fontSize="18" fontWeight="900">{score}</text>
        </svg>
      </div>
      <span style={{ fontSize:10, color, fontWeight:700 }}>{label}</span>
    </div>
  );
}

export default function QualiteAudits() {
  const { p, isDark } = useTheme();
  const [subTab, setSubTab]   = useState('audits');
  const [loading, setLoading] = useState(false);
  const [audits, setAudits]   = useState([]);
  const [ncs, setNcs]         = useState([]);
  const [satisfaction, setSatisfaction] = useState([]);
  const [qvt, setQvt]         = useState([]);

  /* Listes personnalisables */
  const [listeProcessus, setListeProcessus] = useState(DEF_PROCESSUS);
  const [listeTypesAudit, setListeTypesAudit] = useState(DEF_TYPES_AUDIT);
  const [listeTypesNC, setListeTypesNC]     = useState(DEF_TYPES_NC);
  const [listeOrigines, setListeOrigines]   = useState(DEF_ORIGINES);

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    setLoading(true);
    const [rA,rN,rS,rQ] = await Promise.all([
      supabase.from('qualite_audits').select('*').order('id'),
      supabase.from('qualite_nc').select('*').order('id'),
      supabase.from('qualite_satisfaction').select('*').order('id'),
      supabase.from('qualite_qvt').select('*').order('id'),
    ]);
    if (rA.data) setAudits(rA.data);
    if (rN.data) setNcs(rN.data);
    if (rS.data) setSatisfaction(rS.data);
    if (rQ.data) setQvt(rQ.data);
    setLoading(false);
  };

  /* ── Sauvegarde auto ligne ── */
  const saveAudit = async (row) => {
    const { id, ...data } = row;
    if (id) await supabase.from('qualite_audits').update(data).eq('id', id);
  };
  const saveNC = async (row) => {
    const { id, ...data } = row;
    if (id) await supabase.from('qualite_nc').update(data).eq('id', id);
  };
  const saveSat = async (row) => {
    const { id, ...data } = row;
    if (id) await supabase.from('qualite_satisfaction').update(data).eq('id', id);
  };
  const saveQvt = async (row) => {
    const { id, ...data } = row;
    if (id) await supabase.from('qualite_qvt').update(data).eq('id', id);
  };

  /* ── Mise à jour locale + save ── */
  const upAudit = (id, key, val) => setAudits(prev => prev.map(a => a.id===id ? {...a,[key]:val} : a));
  const upNC    = (id, key, val) => setNcs(prev => prev.map(n => n.id===id ? {...n,[key]:val} : n));
  const upSat   = (id, key, val) => setSatisfaction(prev => prev.map(s => s.id===id ? {...s,[key]:val} : s));
  const upQvt   = (id, key, val) => setQvt(prev => prev.map(q => q.id===id ? {...q,[key]:val} : q));

  /* ── Ajout ligne ── */
  const addAudit = async () => {
    const { data } = await supabase.from('qualite_audits').insert([{
      titre:'Nouvel audit', type_audit: listeTypesAudit[0], processus: listeProcessus[0],
      auditeur:'', date: new Date().toISOString().slice(0,10), statut:'Planifié', score:0
    }]).select();
    if (data) loadAll();
  };
  const addNC = async () => {
    const { data } = await supabase.from('qualite_nc').insert([{
      date_nc: new Date().toISOString().slice(0,10), processus: listeProcessus[0],
      origine: listeOrigines[0], type_nc: listeTypesNC[0],
      description:'', statut_nc:'Ouverte', action_corrective:''
    }]).select();
    if (data) loadAll();
  };
  const addSat = async () => {
    const { data } = await supabase.from('qualite_satisfaction').insert([{
      date_enquete: new Date().toISOString().slice(0,10), client:'', projet:'', note_globale:8, commentaire:''
    }]).select();
    if (data) loadAll();
  };
  const addQvt = async () => {
    const { data } = await supabase.from('qualite_qvt').insert([{
      date_campagne: new Date().toISOString().slice(0,10), nom_campagne:'Sondage QVT',
      effectif_total:10, reponses:0, note_moyenne:5
    }]).select();
    if (data) loadAll();
  };

  const deleteRow = async (table, id) => {
    if (!confirm('Supprimer cette ligne ?')) return;
    await supabase.from(table).delete().eq('id', id);
    loadAll();
  };

  /* ── KPIs ── */
  const kpiAudits = useMemo(() => ({
    total:      audits.length,
    realises:   audits.filter(a => a.statut === 'Réalisé').length,
    enCours:    audits.filter(a => a.statut === 'En cours').length,
    planifies:  audits.filter(a => a.statut === 'Planifié').length,
    scoreMoyen: audits.filter(a => a.score > 0).length > 0
      ? Math.round(audits.filter(a=>a.score>0).reduce((s,a)=>s+Number(a.score),0) / audits.filter(a=>a.score>0).length) : 0,
  }), [audits]);

  const kpiNCs = useMemo(() => ({
    total:     ncs.length,
    ouvertes:  ncs.filter(n => n.statut_nc === 'Ouverte').length,
    enCours:   ncs.filter(n => n.statut_nc !== 'Clôturée' && n.statut_nc !== 'Ouverte').length,
    cloturees: ncs.filter(n => n.statut_nc === 'Clôturée').length,
    critiques: ncs.filter(n => n.type_nc === 'Critique').length,
  }), [ncs]);

  const tauxCloture = kpiNCs.total > 0 ? Math.round(kpiNCs.cloturees / kpiNCs.total * 100) : 0;

  /* ── Style commun select ── */
  const selStyle = { padding:'5px 8px', fontSize:12 };
  const inputStyle = { padding:'5px 8px', fontSize:12 };

  /* ── Onglets ── */
  const TABS = [
    { id:'audits', label:'📋 Audits', count: kpiAudits.total },
    { id:'nc',     label:'⚠️ Non-Conformités', count: kpiNCs.ouvertes },
    { id:'sat',    label:'⭐ Satisfaction client', count: satisfaction.length },
    { id:'qvt',    label:'😊 QVT', count: qvt.length },
  ];

  /* ── Listes pour GestionListes ── */
  const LISTES_GL = [
    { id:'processus',    label:'Processus / Services', items:listeProcessus,   setItems:setListeProcessus },
    { id:'types_audit',  label:'Types d\'audit',       items:listeTypesAudit,  setItems:setListeTypesAudit },
    { id:'types_nc',     label:'Types de NC',          items:listeTypesNC,     setItems:setListeTypesNC },
    { id:'origines',     label:'Origines NC',          items:listeOrigines,    setItems:setListeOrigines },
  ];

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:18 }}>

      {/* Header */}
      <div className="page-header animate-fade-up">
        <div>
          <div className="page-title">✅ Qualité & Audits</div>
          <div className="page-subtitle">Suivi audits, non-conformités, satisfaction client et QVT</div>
        </div>
        <div style={{ display:'flex', gap:8 }}>
<button onClick={loadAll} className="btn-secondary"><RefreshCw size={14}/> Actualiser</button>
        </div>
      </div>

      {/* GestionListes */}
      <GestionListes
        listes={{
          'Processus / Services': listeProcessus,
          "Types d'audit": listeTypesAudit,
          'Types de NC': listeTypesNC,
          'Origines NC': listeOrigines,
        }}
        onSave={(key, list) => {
          if (key === 'Processus / Services') setListeProcessus(list);
          if (key === "Types d'audit") setListeTypesAudit(list);
          if (key === 'Types de NC') setListeTypesNC(list);
          if (key === 'Origines NC') setListeOrigines(list);
        }}
        storageKey="qualite_audits"
      />

      {/* KPIs */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:14 }} className="animate-fade-up-1">
        {[
          { label:'Audits réalisés',  val:`${kpiAudits.realises}/${kpiAudits.total}`, color:'green',  sub:`Score moy. : ${kpiAudits.scoreMoyen}%` },
          { label:'Audits en cours',  val:kpiAudits.enCours,   color:'blue',   sub:`${kpiAudits.planifies} planifiés` },
          { label:'NC ouvertes',      val:kpiNCs.ouvertes,     color:kpiNCs.ouvertes>0?'amber':'green', sub:`${kpiNCs.critiques} critique(s)` },
          { label:'Taux clôture NC',  val:`${tauxCloture}%`,   color:tauxCloture>=80?'green':'amber',   sub:`${kpiNCs.cloturees}/${kpiNCs.total} NC` },
          { label:'Satisfaction moy.',val: satisfaction.length ? `${(satisfaction.reduce((s,x)=>s+Number(x.note_globale||0),0)/satisfaction.length).toFixed(1)}/10` : '—', color:'purple', sub:`${satisfaction.length} enquêtes` },
        ].map((k,i) => (
          <div key={i} className={`kpi-card ${k.color}`}>
            <div style={{ fontSize:11, fontWeight:700, color:p.text3, textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:8 }}>{k.label}</div>
            <div style={{ fontSize:26, fontWeight:900, color:p.text1 }}>{k.val}</div>
            <div style={{ fontSize:11, color:p.text4, marginTop:6 }}>{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Onglets */}
      <div style={{ display:'flex', gap:6, background:p.bgCard2, borderRadius:12, padding:5 }} className="animate-fade-up-2">
        {TABS.map(t => (
          <button key={t.id} onClick={()=>setSubTab(t.id)} style={{
            flex:1, padding:'9px 12px', borderRadius:9, border:'none', cursor:'pointer',
            background: subTab===t.id ? 'var(--blue)' : 'transparent',
            color: subTab===t.id ? 'white' : p.text3,
            fontSize:13, fontWeight:600, fontFamily:'var(--font)',
            transition:'all 0.15s', display:'flex', alignItems:'center', justifyContent:'center', gap:6,
          }}>
            {t.label}
            {t.count > 0 && <span style={{ background:subTab===t.id?'rgba(255,255,255,0.25)':p.border, borderRadius:100, padding:'1px 7px', fontSize:11, fontWeight:800 }}>{t.count}</span>}
          </button>
        ))}
      </div>

      {/* ── Onglet Audits ── */}
      {subTab === 'audits' && (
        <div className="glass-panel animate-fade-up-3" style={{ overflow:'hidden' }}>
          <div style={{ padding:'14px 18px', borderBottom:`1px solid ${p.border}`, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <div style={{ fontSize:14, fontWeight:700, color:p.text1 }}>📋 Liste des audits</div>
            <button onClick={addAudit} className="btn-primary"><Plus size={14}/> Ajouter</button>
          </div>
          <div style={{ overflowX:'auto' }}>
            <table className="table-modern">
              <thead>
                <tr>
                  {['Titre','Type','Processus','Auditeur','Date','Statut','Score',''].map(h => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {audits.map(row => {
                  const st = AUDIT_STATUT_STYLE[row.statut] || AUDIT_STATUT_STYLE['Planifié'];
                  return (
                    <tr key={row.id}>
                      <td><input type="text" value={row.titre||''} onChange={e=>upAudit(row.id,'titre',e.target.value)} onBlur={()=>saveAudit(audits.find(a=>a.id===row.id))} className="input-modern" style={{...inputStyle, width:150}}/></td>
                      <td>
                        <select value={row.type_audit||listeTypesAudit[0]} onChange={e=>{upAudit(row.id,'type_audit',e.target.value); setTimeout(()=>saveAudit({...row,type_audit:e.target.value}),0);}} className="input-modern" style={selStyle}>
                          {listeTypesAudit.map(t=><option key={t}>{t}</option>)}
                        </select>
                      </td>
                      <td>
                        <select value={row.processus||listeProcessus[0]} onChange={e=>{upAudit(row.id,'processus',e.target.value); setTimeout(()=>saveAudit({...row,processus:e.target.value}),0);}} className="input-modern" style={selStyle}>
                          {listeProcessus.map(p2=><option key={p2}>{p2}</option>)}
                        </select>
                      </td>
                      <td><input type="text" value={row.auditeur||''} onChange={e=>upAudit(row.id,'auditeur',e.target.value)} onBlur={()=>saveAudit(audits.find(a=>a.id===row.id))} className="input-modern" style={{...inputStyle, width:120}} placeholder="Auditeur..."/></td>
                      <td><input type="date" value={row.date||row.date_prevue||''} onChange={e=>{upAudit(row.id,'date',e.target.value); setTimeout(()=>saveAudit({...row,date:e.target.value}),0);}} className="input-modern" style={inputStyle}/></td>
                      <td>
                        <select value={row.statut||'Planifié'} onChange={e=>{upAudit(row.id,'statut',e.target.value); setTimeout(()=>saveAudit({...row,statut:e.target.value}),0);}} className="input-modern" style={{...selStyle, color:st.color, fontWeight:700}}>
                          {STATUTS_AUDIT.map(s=><option key={s}>{s}</option>)}
                        </select>
                      </td>
                      <td style={{ minWidth:80 }}>
                        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                          <input type="number" min="0" max="100" value={row.score||0} onChange={e=>upAudit(row.id,'score',Number(e.target.value))} onBlur={()=>saveAudit(audits.find(a=>a.id===row.id))} className="input-modern" style={{...inputStyle, width:55}}/>
                          {row.score > 0 && <JaugeScore score={Number(row.score)}/>}
                        </div>
                      </td>
                      <td><button onClick={()=>deleteRow('qualite_audits',row.id)} style={{ background:'none', border:'none', cursor:'pointer', color:'#EF4444', padding:4 }}><Trash2 size={14}/></button></td>
                    </tr>
                  );
                })}
                {!audits.length && <tr><td colSpan={8} style={{ textAlign:'center', color:p.text3, padding:24 }}>Aucun audit — cliquez sur Ajouter</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Onglet NC ── */}
      {subTab === 'nc' && (
        <div className="glass-panel animate-fade-up-3" style={{ overflow:'hidden' }}>
          <div style={{ padding:'14px 18px', borderBottom:`1px solid ${p.border}`, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <div style={{ fontSize:14, fontWeight:700, color:p.text1 }}>⚠️ Non-Conformités</div>
            <button onClick={addNC} className="btn-primary"><Plus size={14}/> Ajouter</button>
          </div>
          <div style={{ overflowX:'auto' }}>
            <table className="table-modern">
              <thead>
                <tr>{['Date','Processus','Origine','Type','Description','Action corrective','Statut',''].map(h=><th key={h}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {ncs.map(row => (
                  <tr key={row.id}>
                    <td><input type="date" value={row.date_nc||''} onChange={e=>{upNC(row.id,'date_nc',e.target.value); setTimeout(()=>saveNC({...row,date_nc:e.target.value}),0);}} className="input-modern" style={inputStyle}/></td>
                    <td><select value={row.processus||listeProcessus[0]} onChange={e=>{upNC(row.id,'processus',e.target.value); setTimeout(()=>saveNC({...row,processus:e.target.value}),0);}} className="input-modern" style={selStyle}>{listeProcessus.map(p2=><option key={p2}>{p2}</option>)}</select></td>
                    <td><select value={row.origine||listeOrigines[0]} onChange={e=>{upNC(row.id,'origine',e.target.value); setTimeout(()=>saveNC({...row,origine:e.target.value}),0);}} className="input-modern" style={selStyle}>{listeOrigines.map(o=><option key={o}>{o}</option>)}</select></td>
                    <td>
                      <select value={row.type_nc||'Mineure'} onChange={e=>{upNC(row.id,'type_nc',e.target.value); setTimeout(()=>saveNC({...row,type_nc:e.target.value}),0);}} className="input-modern" style={{ ...selStyle, fontWeight:700, color: row.type_nc==='Critique'?'#EF4444':row.type_nc==='Majeure'?'#F59E0B':'#10B981' }}>
                        {listeTypesNC.map(t=><option key={t}>{t}</option>)}
                      </select>
                    </td>
                    <td><input type="text" value={row.description||''} onChange={e=>upNC(row.id,'description',e.target.value)} onBlur={()=>saveNC(ncs.find(n=>n.id===row.id))} className="input-modern" style={{...inputStyle, width:160}} placeholder="Description..."/></td>
                    <td><input type="text" value={row.action_corrective||''} onChange={e=>upNC(row.id,'action_corrective',e.target.value)} onBlur={()=>saveNC(ncs.find(n=>n.id===row.id))} className="input-modern" style={{...inputStyle, width:160}} placeholder="Action..."/></td>
                    <td>
                      <select value={row.statut_nc||'Ouverte'} onChange={e=>{upNC(row.id,'statut_nc',e.target.value); setTimeout(()=>saveNC({...row,statut_nc:e.target.value}),0);}} className="input-modern" style={{ ...selStyle, fontWeight:700 }}>
                        {STATUTS_NC.map(s=><option key={s}>{s}</option>)}
                      </select>
                    </td>
                    <td><button onClick={()=>deleteRow('qualite_nc',row.id)} style={{ background:'none', border:'none', cursor:'pointer', color:'#EF4444', padding:4 }}><Trash2 size={14}/></button></td>
                  </tr>
                ))}
                {!ncs.length && <tr><td colSpan={8} style={{ textAlign:'center', color:p.text3, padding:24 }}>Aucune NC — cliquez sur Ajouter</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Onglet Satisfaction ── */}
      {subTab === 'sat' && (
        <div className="glass-panel animate-fade-up-3" style={{ overflow:'hidden' }}>
          <div style={{ padding:'14px 18px', borderBottom:`1px solid ${p.border}`, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <div style={{ fontSize:14, fontWeight:700, color:p.text1 }}>⭐ Satisfaction client</div>
            <button onClick={addSat} className="btn-primary"><Plus size={14}/> Ajouter</button>
          </div>
          <div style={{ overflowX:'auto' }}>
            <table className="table-modern">
              <thead><tr>{['Date','Client','Projet','Note /10','Commentaire',''].map(h=><th key={h}>{h}</th>)}</tr></thead>
              <tbody>
                {satisfaction.map(row => (
                  <tr key={row.id}>
                    <td><input type="date" value={row.date_enquete||''} onChange={e=>{upSat(row.id,'date_enquete',e.target.value); setTimeout(()=>saveSat({...row,date_enquete:e.target.value}),0);}} className="input-modern" style={inputStyle}/></td>
                    <td><input type="text" value={row.client||''} onChange={e=>upSat(row.id,'client',e.target.value)} onBlur={()=>saveSat(satisfaction.find(s=>s.id===row.id))} className="input-modern" style={{...inputStyle,width:120}} placeholder="Client..."/></td>
                    <td><input type="text" value={row.projet||''} onChange={e=>upSat(row.id,'projet',e.target.value)} onBlur={()=>saveSat(satisfaction.find(s=>s.id===row.id))} className="input-modern" style={{...inputStyle,width:120}} placeholder="Projet..."/></td>
                    <td>
                      <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                        <input type="number" min="0" max="10" step="0.5" value={row.note_globale||0} onChange={e=>upSat(row.id,'note_globale',Number(e.target.value))} onBlur={()=>saveSat(satisfaction.find(s=>s.id===row.id))} className="input-modern" style={{...inputStyle,width:60}}/>
                        <span style={{ fontSize:13, fontWeight:800, color: Number(row.note_globale)>=7?'#10B981':Number(row.note_globale)>=5?'#F59E0B':'#EF4444' }}>{row.note_globale}/10</span>
                      </div>
                    </td>
                    <td><input type="text" value={row.commentaire||''} onChange={e=>upSat(row.id,'commentaire',e.target.value)} onBlur={()=>saveSat(satisfaction.find(s=>s.id===row.id))} className="input-modern" style={{...inputStyle,width:200}} placeholder="Commentaire..."/></td>
                    <td><button onClick={()=>deleteRow('qualite_satisfaction',row.id)} style={{ background:'none', border:'none', cursor:'pointer', color:'#EF4444', padding:4 }}><Trash2 size={14}/></button></td>
                  </tr>
                ))}
                {!satisfaction.length && <tr><td colSpan={6} style={{ textAlign:'center', color:p.text3, padding:24 }}>Aucune enquête</td></tr>}
              </tbody>
            </table>
          </div>
          {satisfaction.length > 1 && (
            <div style={{ padding:'16px 18px', borderTop:`1px solid ${p.border}` }}>
              <div style={{ fontSize:13, fontWeight:700, color:p.text1, marginBottom:12 }}>Évolution satisfaction</div>
              <ResponsiveContainer width="100%" height={160}>
                <LineChart data={satisfaction.slice(-12).map(s=>({ date:s.date_enquete?.slice(0,7)||'', note:Number(s.note_globale||0) }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke={p.chartGrid} vertical={false}/>
                  <XAxis dataKey="date" tick={{fill:p.chartTick,fontSize:11}} stroke={p.chartAxis}/>
                  <YAxis domain={[0,10]} tick={{fill:p.chartTick,fontSize:11}} stroke={p.chartAxis}/>
                  <Tooltip contentStyle={{ background:p.tooltipBg, border:`1px solid ${p.tooltipBorder}`, borderRadius:8, fontSize:11 }}/>
                  <Line type="monotone" dataKey="note" stroke="#F59E0B" strokeWidth={2} dot={{ fill:'#F59E0B', r:3 }}/>
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* ── Onglet QVT ── */}
      {subTab === 'qvt' && (
        <div className="glass-panel animate-fade-up-3" style={{ overflow:'hidden' }}>
          <div style={{ padding:'14px 18px', borderBottom:`1px solid ${p.border}`, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <div style={{ fontSize:14, fontWeight:700, color:p.text1 }}>😊 Qualité de Vie au Travail</div>
            <button onClick={addQvt} className="btn-primary"><Plus size={14}/> Ajouter</button>
          </div>
          <div style={{ overflowX:'auto' }}>
            <table className="table-modern">
              <thead><tr>{['Date','Campagne','Effectif total','Réponses','Taux part.','Note moy.',''].map(h=><th key={h}>{h}</th>)}</tr></thead>
              <tbody>
                {qvt.map(row => {
                  const taux = row.effectif_total > 0 ? Math.round((row.reponses||0)/row.effectif_total*100) : 0;
                  return (
                    <tr key={row.id}>
                      <td><input type="date" value={row.date_campagne||''} onChange={e=>{upQvt(row.id,'date_campagne',e.target.value); setTimeout(()=>saveQvt({...row,date_campagne:e.target.value}),0);}} className="input-modern" style={inputStyle}/></td>
                      <td><input type="text" value={row.nom_campagne||''} onChange={e=>upQvt(row.id,'nom_campagne',e.target.value)} onBlur={()=>saveQvt(qvt.find(q=>q.id===row.id))} className="input-modern" style={{...inputStyle,width:140}}/></td>
                      <td><input type="number" value={row.effectif_total||0} onChange={e=>upQvt(row.id,'effectif_total',Number(e.target.value))} onBlur={()=>saveQvt(qvt.find(q=>q.id===row.id))} className="input-modern" style={{...inputStyle,width:70}}/></td>
                      <td><input type="number" value={row.reponses||0} onChange={e=>upQvt(row.id,'reponses',Number(e.target.value))} onBlur={()=>saveQvt(qvt.find(q=>q.id===row.id))} className="input-modern" style={{...inputStyle,width:70}}/></td>
                      <td><span style={{ fontSize:13, fontWeight:800, color:taux>=70?'#10B981':taux>=40?'#F59E0B':'#EF4444' }}>{taux}%</span></td>
                      <td>
                        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                          <input type="number" min="0" max="10" step="0.1" value={row.note_moyenne||0} onChange={e=>upQvt(row.id,'note_moyenne',Number(e.target.value))} onBlur={()=>saveQvt(qvt.find(q=>q.id===row.id))} className="input-modern" style={{...inputStyle,width:60}}/>
                          <span style={{ fontWeight:800, color:Number(row.note_moyenne)>=7?'#10B981':Number(row.note_moyenne)>=5?'#F59E0B':'#EF4444' }}>{row.note_moyenne}/10</span>
                        </div>
                      </td>
                      <td><button onClick={()=>deleteRow('qualite_qvt',row.id)} style={{ background:'none', border:'none', cursor:'pointer', color:'#EF4444', padding:4 }}><Trash2 size={14}/></button></td>
                    </tr>
                  );
                })}
                {!qvt.length && <tr><td colSpan={7} style={{ textAlign:'center', color:p.text3, padding:24 }}>Aucune campagne QVT</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SQL reminder */}
      <div className="glass-panel" style={{ padding:'12px 16px', borderLeft:'3px solid var(--amber)' }}>
        <div style={{ fontSize:11, fontWeight:700, color:p.text2, marginBottom:4 }}>⚠️ Si les champs "titre" et "type_audit" ne sauvegardent pas — exécuter dans Supabase :</div>
        <code style={{ fontSize:10, color:'var(--amber)', background:p.bgCard2, padding:'6px 10px', borderRadius:6, display:'block' }}>
          alter table qualite_audits add column if not exists titre text default 'Audit'; alter table qualite_audits add column if not exists type_audit text; alter table qualite_audits add column if not exists date date;
        </code>
      </div>
    </div>
  );
}
