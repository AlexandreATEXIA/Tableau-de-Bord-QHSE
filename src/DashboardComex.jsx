import React, { useState, useEffect, useMemo } from 'react';
import { useTheme } from './ThemeContext';
import { supabase } from './supabaseClient';
import {
  LayoutDashboard, RefreshCw, AlertTriangle, CheckCircle, Clock,
  ShieldAlert, Star, HeartPulse, GraduationCap, Target, Activity, Zap, Save
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, RadarChart, Radar, PolarGrid, PolarAngleAxis
} from 'recharts';
import { useConfig } from './ConfigContext';
import { Settings, X } from 'lucide-react';
import AgendaSemaine from './AgendaSemaine';

function calcExp(obt, val) {
  const d = new Date(obt); d.setFullYear(d.getFullYear() + Number(val)); return d;
}

export default function DashboardComex({ onNavigate }) {
  const { p, isDark } = useTheme();
  const { config, saveConfig } = useConfig();
  const EFFECTIF   = config.effectif;
  const EFFECTIF_H = config.h_an;
  const [data, setData]         = useState(null);
  const [loading, setLoading]   = useState(true);
  const [lastUpdate, setLU]     = useState(null);
  const [showConfig, setShowConfig] = useState(false);
  const [cfgEdit, setCfgEdit]   = useState({ effectif: config.effectif, h_an: config.h_an, nom: config.nom });

  useEffect(() => { charger(); }, []);

  const charger = async () => {
    setLoading(true);
    const [r1,r2,r3,r4,r5,r6,r7] = await Promise.all([
      supabase.from('securite_accidents').select('*').is('archived_at', null).order('date_evenement'),
      supabase.from('plan_actions').select('*').is('archived_at', null),
      supabase.from('habilitations').select('*').is('archived_at', null),
      supabase.from('registre_duerp').select('*').is('archived_at', null),
      supabase.from('qualite_nc').select('*').is('archived_at', null).order('date_nc'),
      supabase.from('qualite_satisfaction').select('*').order('date_enquete'),
      supabase.from('qualite_audits').select('*'),
    ]);
    setData({ accidents:r1.data||[], actions:r2.data||[], habs:r3.data||[], risques:r4.data||[], ncs:r5.data||[], sat:r6.data||[], audits:r7.data||[] });
    setLU(new Date());
    setLoading(false);
  };

  const kpis = useMemo(() => {
    if (!data) return null;
    const { accidents, actions, habs, risques, ncs, sat, audits } = data;

    const accArret    = accidents.filter(a => a.type_evenement === 'Accident avec arrêt');
    const jours       = accidents.reduce((s,a) => s+(a.jours_perdus||0), 0);
    const heures      = EFFECTIF * EFFECTIF_H;
    const TF          = accArret.length > 0 ? ((accArret.length*1000000)/heures).toFixed(2) : '0.00';
    const TG          = jours > 0 ? ((jours*1000)/heures).toFixed(2) : '0.00';

    const now = new Date();
    const actRetard   = actions.filter(a => a.echeance && !a.statut?.includes('Terminé') && !a.statut?.includes('Annulé') && Math.ceil((new Date(a.echeance)-now)/86400000)<0);
    const actTerminees= actions.filter(a => a.statut?.includes('Terminé'));
    const tauxPDCA    = actions.length>0 ? Math.round((actTerminees.length/actions.length)*100) : 0;

    const habsPerimees= habs.filter(h => h.obtention && calcExp(h.obtention,h.validiteAns)<=now);
    const habsBientot = habs.filter(h => { if(!h.obtention)return false; const j=Math.ceil((calcExp(h.obtention,h.validiteAns)-now)/86400000); return j>=0&&j<=30; });

    const risquesCrit = risques.filter(r=>(r.criticite||1)>=9);
    const ncOuvertes  = ncs.filter(n=>n.statut_nc==='Ouverte'||!n.statut_nc);
    const tauxNC      = ncs.length>0 ? Math.round((ncs.filter(n=>n.statut_nc==='Clôturée').length/ncs.length)*100) : 100;

    const moyenneSat  = sat.length>0 ? (sat.reduce((s,a)=>s+Number(a.note_globale),0)/sat.length).toFixed(1) : null;
    const scoreAudit  = audits.filter(a=>a.score>0).length>0 ? Math.round(audits.filter(a=>a.score>0).reduce((s,a)=>s+Number(a.score),0)/audits.filter(a=>a.score>0).length) : 50;
    const scoreSecurite = Math.max(0,100-accArret.length*15);
    const scoreHabs   = habs.length>0 ? Math.round(((habs.length-habsPerimees.length)/habs.length)*100) : 100;
    const scoreMaitrise= risques.length>0 ? Math.round((risques.filter(r=>(r.criticite||1)<4).length/risques.length)*100) : 100;
    const scoreSat    = moyenneSat ? Math.round(Number(moyenneSat)*10) : 50;
    const scoreGlobal = Math.round((scoreSecurite+scoreHabs+scoreMaitrise+tauxPDCA+scoreSat+scoreAudit)/6);

    // Graphiques
    const accMap={};
    accidents.forEach(a=>{ const m=a.date_evenement?.substring(0,7); if(!m)return; if(!accMap[m])accMap[m]={mois:m,arret:0,soins:0,presqu:0}; if(a.type_evenement==='Accident avec arrêt')accMap[m].arret++; if(a.type_evenement==='Soins (sans arrêt)')accMap[m].soins++; if(a.type_evenement==="Presqu'accident")accMap[m].presqu++; });
    const accChart=Object.values(accMap).sort((a,b)=>a.mois.localeCompare(b.mois)).slice(-12);

    const ncMap={};
    ncs.forEach(n=>{ const m=n.date_nc?.substring(0,7); if(!m)return; if(!ncMap[m])ncMap[m]={mois:m,ouvertes:0,cloturees:0}; if(n.statut_nc==='Clôturée')ncMap[m].cloturees++; else ncMap[m].ouvertes++; });
    const ncChart=Object.values(ncMap).sort((a,b)=>a.mois.localeCompare(b.mois)).slice(-12);

    const satChart=sat.slice(-12).map(s=>({ date:s.date_enquete?.substring(0,7)||s.client, note:Number(s.note_globale) }));

    const radarData=[
      {subject:'Sécurité', A:scoreSecurite},
      {subject:'PDCA',     A:tauxPDCA},
      {subject:'Habs.',    A:scoreHabs},
      {subject:'Risques',  A:scoreMaitrise},
      {subject:'NC',       A:tauxNC},
      {subject:'Qualité',  A:scoreAudit},
    ];

    const alertes=[];
    if(accArret.length>0)     alertes.push({level:'red',   msg:`${accArret.length} accident(s) avec arrêt — TF : ${TF}`,         tab:'accidents'});
    if(actRetard.length>0)    alertes.push({level:'red',   msg:`${actRetard.length} action(s) PDCA en retard`,                    tab:'pdca'});
    if(risquesCrit.length>0)  alertes.push({level:'red',   msg:`${risquesCrit.length} risque(s) critique(s) dans le DUERP`,       tab:'duerp'});
    if(ncOuvertes.length>0)   alertes.push({level:'amber', msg:`${ncOuvertes.length} non-conformité(s) ouverte(s) sans action`,   tab:'qualite'});
    if(habsPerimees.length>0) alertes.push({level:'amber', msg:`${habsPerimees.length} habilitation(s) périmée(s) à renouveler`,  tab:'rh'});
    if(habsBientot.length>0)  alertes.push({level:'amber', msg:`${habsBientot.length} habilitation(s) à renouveler dans 30 jours`,tab:'rh'});
    if(alertes.length===0)    alertes.push({level:'green', msg:'Tous les indicateurs sont au vert — Excellent !'});

    return { accArret:accArret.length, jours, TF, TG, actRetard:actRetard.length, actTerminees:actTerminees.length, tauxPDCA, totalActions:actions.length, habsPerimees:habsPerimees.length, habsBientot:habsBientot.length, risquesCrit:risquesCrit.length, totalRisques:risques.length, ncOuvertes:ncOuvertes.length, tauxNC, moyenneSat, scoreGlobal, scoreSecurite, scoreHabs, scoreMaitrise, tauxPDCA, scoreSat, scoreAudit, accChart, ncChart, satChart, radarData, alertes };
  }, [data]);

  if (loading||!kpis) return (
    <div className="flex items-center justify-center h-64">
      <div className="text-center"><RefreshCw size={32} className="animate-spin text-blue-400 mx-auto mb-3"/><p className="text-slate-400">Chargement du cockpit...</p></div>
    </div>
  );

  const sc = kpis.scoreGlobal>=80?'#10B981':kpis.scoreGlobal>=60?'#F59E0B':'#EF4444';
  const sl = kpis.scoreGlobal>=80?'Excellent':kpis.scoreGlobal>=60?'Satisfaisant':'À améliorer';

  const KPIS=[
    {label:'AT avec arrêt',      val:kpis.accArret,   color:kpis.accArret>0?'red':'green',    sub:`TF : ${kpis.TF}`,                   icon:<HeartPulse size={18}/>},
    {label:'Risques critiques',  val:kpis.risquesCrit,color:kpis.risquesCrit>0?'red':'green',  sub:`Sur ${kpis.totalRisques} évalués`,   icon:<ShieldAlert size={18}/>},
    {label:'Actions en retard',  val:kpis.actRetard,  color:kpis.actRetard>0?'amber':'green',  sub:`Clôture : ${kpis.tauxPDCA}%`,       icon:<Target size={18}/>},
    {label:'NC ouvertes',        val:kpis.ncOuvertes, color:kpis.ncOuvertes>0?'amber':'green', sub:`Taux clôture : ${kpis.tauxNC}%`,    icon:<Activity size={18}/>},
    {label:'Habs. périmées',     val:kpis.habsPerimees,color:kpis.habsPerimees>0?'red':'green',sub:`${kpis.habsBientot} bientôt`,       icon:<GraduationCap size={18}/>},
    {label:'Satisfaction client',val:kpis.moyenneSat?`${kpis.moyenneSat}/10`:'—', color:!kpis.moyenneSat||Number(kpis.moyenneSat)>=7?'green':'amber', sub:'Moyenne enquêtes', icon:<Star size={18}/>},
    {label:'Jours perdus',       val:kpis.jours,      color:kpis.jours>0?'amber':'green',      sub:`TG : ${kpis.TG}`,                   icon:<Clock size={18}/>},
    {label:'Actions terminées',  val:kpis.actTerminees,color:'blue',                            sub:`Sur ${kpis.totalActions} totales`,  icon:<CheckCircle size={18}/>},
  ];

  return (
    <div className="space-y-5 pb-10">

      <header className="page-header">
        <div>
          <h2 className="page-title flex items-center gap-3"><LayoutDashboard size={26} className="text-blue-400"/> Supervision Globale</h2>
          <p className="page-subtitle">
            Cockpit QHSE en temps réel
            {lastUpdate && <span className="ml-2 opacity-50">· {lastUpdate.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})}</span>}
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => { setCfgEdit({ effectif: config.effectif, h_an: config.h_an, nom: config.nom }); setShowConfig(v=>!v); }} className="btn-secondary" title="Paramètres entreprise"><Settings size={15}/></button>
          <button onClick={charger} className="btn-primary"><RefreshCw size={16} className={loading?'animate-spin':''}/> Mettre à jour</button>
        </div>
      </header>

      {/* ── Panneau config entreprise ───────────────────────────────────── */}
      {showConfig && (
        <div className="glass-panel p-5 border border-blue-500/20 animate-fade-up">
          <div className="flex justify-between items-center mb-4">
            <h3 style={{fontWeight:700,color:p.text1,display:'flex',alignItems:'center',gap:8}}><Settings size={16} style={{color:'var(--blue)'}}/> Paramètres de l'entreprise</h3>
            <button onClick={() => setShowConfig(false)} style={{background:'none',border:'none',cursor:'pointer',color:p.text3}}><X size={18}/></button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            {[
              { label:"Nom de l'entreprise", key:'nom',      type:'text',   unit:'' },
              { label:'Effectif total',       key:'effectif', type:'number', unit:'pers.' },
              { label:'Heures / an / pers.',  key:'h_an',     type:'number', unit:'h' },
            ].map(f => (
              <div key={f.key}>
                <label style={{fontSize:11,fontWeight:700,color:p.text3,textTransform:'uppercase',letterSpacing:'0.06em',display:'block',marginBottom:4}}>{f.label}</label>
                <div style={{display:'flex',alignItems:'center',gap:6,background:p.bgInput,border:'1px solid '+p.border,borderRadius:8,padding:'8px 12px'}}>
                  <input type={f.type} value={cfgEdit[f.key]} onChange={e => setCfgEdit(v=>({...v,[f.key]:f.type==='number'?Number(e.target.value):e.target.value}))}
                    style={{flex:1,background:'transparent',border:'none',outline:'none',color:p.text1,fontSize:14,fontWeight:700,fontFamily:'inherit'}}/>
                  {f.unit && <span style={{fontSize:11,color:p.text4}}>{f.unit}</span>}
                </div>
              </div>
            ))}
          </div>
          <div className="flex gap-3">
            <button onClick={() => setShowConfig(false)} className="btn-secondary">Annuler</button>
            <button onClick={async () => { await saveConfig(cfgEdit); setShowConfig(false); charger(); }} className="btn-primary"><Save size={15}/> Enregistrer</button>
          </div>
        </div>
      )}

      {/* Score + Alertes */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="glass-panel p-6 flex flex-col items-center justify-center text-center">
          <div style={{width:96,height:96,borderRadius:'50%',border:`4px solid ${sc}`,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',boxShadow:`0 0 28px ${sc}30`,marginBottom:12}}>
            <span style={{fontSize:30,fontWeight:900,color:sc,lineHeight:1}}>{kpis.scoreGlobal}</span>
            <span style={{fontSize:10,color:p.text3}}>/100</span>
          </div>
          <p style={{fontSize:15,fontWeight:800,color:sc}}>{sl}</p>
          <p style={{fontSize:11,color:p.text4,marginTop:3}}>Score SMI global</p>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:7,marginTop:14,width:'100%'}}>
            {[{l:'Sécurité',v:kpis.scoreSecurite},{l:'PDCA',v:kpis.tauxPDCA},{l:'Habs.',v:kpis.scoreHabs},{l:'Risques',v:kpis.scoreMaitrise}].map((s,i)=>{
              const c=s.v>=80?'#10B981':s.v>=60?'#F59E0B':'#EF4444';
              return <div key={i} style={{background:p.whiteFaint2,borderRadius:8,padding:'6px 10px'}}>
                <div style={{fontSize:10,color:p.text4,marginBottom:3}}>{s.l}</div>
                <div style={{height:3,background:p.whiteFaint,borderRadius:2}}><div style={{height:'100%',width:`${s.v}%`,background:c,borderRadius:2}}/></div>
                <div style={{fontSize:11,fontWeight:700,color:c,marginTop:2}}>{s.v}%</div>
              </div>;
            })}
          </div>
        </div>

        <div className="glass-panel p-5 lg:col-span-2">
          <h3 className="text-white font-bold mb-3 flex items-center gap-2">
            <AlertTriangle size={16} className="text-amber-400"/> Alertes consolidées
            <span style={{fontSize:10,background:'rgba(245,158,11,0.15)',color:'#FCD34D',border:'1px solid rgba(245,158,11,0.3)',padding:'2px 7px',borderRadius:100,marginLeft:4}}>
              {kpis.alertes.filter(a=>a.level!=='green').length} alerte{kpis.alertes.filter(a=>a.level!=='green').length>1?'s':''}
            </span>
          </h3>
          <div className="space-y-2">
            {kpis.alertes.map((a,i)=>(
              <div key={i}
                className={`alert-banner ${a.level==='red'?'alert-red':a.level==='amber'?'alert-amber':'alert-green'}`}
                style={{padding:'9px 14px', cursor: a.tab && onNavigate ? 'pointer' : 'default', transition:'opacity 0.15s'}}
                onClick={() => a.tab && onNavigate && onNavigate(a.tab)}
                title={a.tab && onNavigate ? `Aller vers ${a.tab}` : undefined}>
                {a.level==='green'?<CheckCircle size={14}/>:a.level==='red'?<AlertTriangle size={14}/>:<Clock size={14}/>}
                <p style={{fontSize:13,flex:1}}>{a.msg}</p>
                {a.tab && onNavigate && <span style={{fontSize:10,opacity:0.6,whiteSpace:'nowrap'}}>→ Voir</span>}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {KPIS.map((k,i)=>(
          <div key={i} className={`kpi-card ${k.color}`}>
            <div style={{display:'flex',alignItems:'center',gap:9,marginBottom:9}}>
              <div style={{width:32,height:32,borderRadius:8,background:p.whiteFaint,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>{k.icon}</div>
              <p className="text-slate-400 text-xs font-bold uppercase tracking-wider leading-tight">{k.label}</p>
            </div>
            <p className="text-3xl font-black text-white">{k.val}</p>
            <p className="text-xs text-slate-500 mt-2">{k.sub}</p>
          </div>
        ))}
      </div>

      {/* Agenda */}
      <AgendaSemaine onNavigate={onNavigate} />

      {/* Graphiques */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="glass-panel p-5">
          <h3 className="text-white font-bold mb-3 flex items-center gap-2"><HeartPulse size={15} className="text-red-400"/> Accidentologie — 12 mois</h3>
          {kpis.accChart.length===0 ? (
            <div className="h-44 flex items-center justify-center flex-col gap-2"><CheckCircle size={30} className="text-emerald-400"/><p className="text-emerald-400 font-bold text-sm">Zéro accident !</p></div>
          ) : (
            <div className="h-44"><ResponsiveContainer width="100%" height="100%">
              <BarChart data={kpis.accChart}><CartesianGrid strokeDasharray="3 3" stroke={p.chartGrid} vertical={false}/><XAxis dataKey="mois" stroke={p.chartAxis} tick={{fill:p.chartTick,fontSize:11}}/><YAxis stroke={p.chartAxis} tick={{fill:p.chartTick,fontSize:10}} allowDecimals={false}/><Tooltip contentStyle={{background:p.tooltipBg,border:`1px solid ${p.tooltipBorder}`,borderRadius:10,fontSize:11}}/>
              <Bar dataKey="arret" name="Avec arrêt" fill="#EF4444" radius={[4,4,0,0]} stackId="a"/><Bar dataKey="soins" name="Soins" fill="#F59E0B" radius={[4,4,0,0]} stackId="a"/><Bar dataKey="presqu" name="Presqu'acc." fill="#3B82F6" radius={[4,4,0,0]} stackId="a"/>
              </BarChart>
            </ResponsiveContainer></div>
          )}
        </div>

        <div className="glass-panel p-5">
          <h3 className="text-white font-bold mb-3 flex items-center gap-2"><Activity size={15} className="text-amber-400"/> Non-Conformités — 12 mois</h3>
          {kpis.ncChart.length===0 ? (
            <div className="h-44 flex items-center justify-center text-slate-500 text-sm">Aucune NC enregistrée.</div>
          ) : (
            <div className="h-44"><ResponsiveContainer width="100%" height="100%">
              <BarChart data={kpis.ncChart}><CartesianGrid strokeDasharray="3 3" stroke={p.chartGrid} vertical={false}/><XAxis dataKey="mois" stroke={p.chartAxis} tick={{fill:p.chartTick,fontSize:11}}/><YAxis stroke={p.chartAxis} tick={{fill:p.chartTick,fontSize:10}} allowDecimals={false}/><Tooltip contentStyle={{background:p.tooltipBg,border:`1px solid ${p.tooltipBorder}`,borderRadius:10,fontSize:11}}/>
              <Bar dataKey="ouvertes" name="Ouvertes" fill="#EF4444" radius={[4,4,0,0]} stackId="a"/><Bar dataKey="cloturees" name="Clôturées" fill="#10B981" radius={[4,4,0,0]} stackId="a"/>
              </BarChart>
            </ResponsiveContainer></div>
          )}
        </div>

        <div className="glass-panel p-5">
          <h3 className="text-white font-bold mb-3 flex items-center gap-2"><Star size={15} className="text-purple-400"/> Évolution satisfaction client</h3>
          {kpis.satChart.length===0 ? (
            <div className="h-44 flex items-center justify-center text-slate-500 text-sm">Aucune enquête enregistrée.</div>
          ) : (
            <div className="h-44"><ResponsiveContainer width="100%" height="100%">
              <AreaChart data={kpis.satChart}>
                <defs><linearGradient id="satG" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.3}/><stop offset="95%" stopColor="#8B5CF6" stopOpacity={0}/></linearGradient></defs>
                <CartesianGrid strokeDasharray="3 3" stroke={p.chartGrid} vertical={false}/><XAxis dataKey="date" stroke={p.chartAxis} tick={{fill:p.chartTick,fontSize:11}}/><YAxis domain={[0,10]} stroke={p.chartAxis} tick={{fill:p.chartTick,fontSize:10}}/><Tooltip contentStyle={{background:p.tooltipBg,border:`1px solid ${p.tooltipBorder}`,borderRadius:10,fontSize:11}}/>
                <Area type="monotone" dataKey="note" name="Note /10" stroke="#8B5CF6" fill="url(#satG)" strokeWidth={3} dot={{r:4,fill:'#8B5CF6'}}/>
              </AreaChart>
            </ResponsiveContainer></div>
          )}
        </div>

        <div className="glass-panel p-5">
          <h3 className="text-white font-bold mb-3 flex items-center gap-2"><Zap size={15} className="text-blue-400"/> Radar performance SMI</h3>
          <div className="h-44"><ResponsiveContainer width="100%" height="100%">
            <RadarChart data={kpis.radarData}>
              <PolarGrid stroke={p.chartGrid}/>
              <PolarAngleAxis dataKey="subject" tick={{fill:p.chartTick,fontSize:10,fontWeight:600}}/>
              <Radar name="Score" dataKey="A" stroke="#3B82F6" fill="#3B82F6" fillOpacity={0.15} strokeWidth={2}/>
              <Tooltip contentStyle={{background:p.tooltipBg,border:`1px solid ${p.tooltipBorder}`,borderRadius:10,fontSize:11}}/>
            </RadarChart>
          </ResponsiveContainer></div>
        </div>
      </div>
    </div>
  );
}
