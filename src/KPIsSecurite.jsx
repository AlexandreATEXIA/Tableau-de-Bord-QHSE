import { useTheme } from './ThemeContext';
import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from './supabaseClient';
import {
  RefreshCw, TrendingDown, TrendingUp, Target, Shield, Activity,
  AlertTriangle, CheckCircle, Info, Settings, Save, BarChart2
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, BarChart, Bar, ReferenceLine, LineChart, Line, Cell
} from 'recharts';
import { useConfig } from './ConfigContext';
import { safeDate, diffJours } from './utils/kpi';

const OBJ_DEFAULTS = { TF:10, TG:1, tauxCloture:70, tauxHabs:90, tauxMaitrise:70, accArret:0, actionsRetard:0, satisfaction:7 };

// calcExp : expiration d'une habilitation (obtention + N années).
// Retourne null si obtention invalide ou validiteAns non numérique —
// évite 1970-01-01 fantôme qui rendait toutes les habilitations "périmées".
function calcExp(obt, val) {
  const d = safeDate(obt);
  if (d === null) return null;
  const annees = Number(val);
  if (!Number.isFinite(annees)) return null;
  d.setFullYear(d.getFullYear() + annees);
  return d;
}

export default function KPIsSecurite() {
  const { p, isDark } = useTheme();
  const { config, saveConfig } = useConfig();
  const [data, setData]           = useState(null);
  const [loading, setLoading]     = useState(true);
  const [objectifs, setObjectifs] = useState(OBJ_DEFAULTS);
  const [showObj, setShowObj]     = useState(false);
  const [objEdit, setObjEdit]     = useState(OBJ_DEFAULTS);

  const effectif = config.effectif;
  const H_AN     = config.h_an;

  useEffect(() => { charger(); }, []);

  const charger = async () => {
    setLoading(true);
    const [r1,r2,r3,r4,r5,r6,r7] = await Promise.all([
      supabase.from('securite_accidents').select('*').order('date_evenement'),
      supabase.from('plan_actions').select('id,statut,echeance,domaine'),
      supabase.from('habilitations').select('id,obtention,validiteAns'),
      supabase.from('registre_duerp').select('id,criticite'),
      supabase.from('qualite_satisfaction').select('note_globale,date_enquete'),
      supabase.from('qualite_nc').select('id,statut_nc,date_nc'),
      supabase.from('kpi_objectifs').select('*').eq('id', 1).single(),
    ]);
    setData({ accidents:r1.data||[], actions:r2.data||[], habs:r3.data||[], risques:r4.data||[], sat:r5.data||[], ncs:r6.data||[] });
    if (r7.data) {
      const obj = {
        TF: r7.data.tf ?? OBJ_DEFAULTS.TF, TG: r7.data.tg ?? OBJ_DEFAULTS.TG,
        tauxCloture: r7.data.taux_cloture ?? OBJ_DEFAULTS.tauxCloture,
        tauxHabs: r7.data.taux_habs ?? OBJ_DEFAULTS.tauxHabs,
        tauxMaitrise: r7.data.taux_maitrise ?? OBJ_DEFAULTS.tauxMaitrise,
        accArret: r7.data.acc_arret ?? OBJ_DEFAULTS.accArret,
        actionsRetard: r7.data.actions_retard ?? OBJ_DEFAULTS.actionsRetard,
        satisfaction: r7.data.satisfaction ?? OBJ_DEFAULTS.satisfaction,
      };
      setObjectifs(obj); setObjEdit(obj);
    }
    setLoading(false);
  };

  const sauvegarderObjectifs = async () => {
    setObjectifs(objEdit);
    await supabase.from('kpi_objectifs').update({
      tf: objEdit.TF, tg: objEdit.TG, taux_cloture: objEdit.tauxCloture,
      taux_habs: objEdit.tauxHabs, taux_maitrise: objEdit.tauxMaitrise,
      acc_arret: objEdit.accArret, actions_retard: objEdit.actionsRetard,
      satisfaction: objEdit.satisfaction, updated_at: new Date().toISOString(),
    }).eq('id', 1);
    setShowObj(false);
  };

  const c = useMemo(() => {
    if (!data) return null;
    const { accidents, actions, habs, risques, sat, ncs } = data;
    const heures = effectif * H_AN;
    const now    = new Date();
    const anneeN = now.getFullYear();

    // Sécurité
    const accArret   = accidents.filter(a => a.type_evenement === 'Accident avec arrêt');
    const jours      = accidents.reduce((s,a) => s+(a.jours_perdus||0), 0);
    const TF = heures>0 ? +((accArret.length*1000000)/heures).toFixed(2) : 0;
    const TG = heures>0 ? +((jours*1000)/heures).toFixed(2) : 0;

    // Actions
    const actTerminees = actions.filter(a => a.statut?.includes('Terminé'));
    // Une action est "en retard" si elle a une échéance VALIDE passée. Une date
    // absente ou mal-formée n'est plus comptée comme retard (diffJours → null,
    // et null < 0 === false).
    const actRetard    = actions.filter(a => {
      if (!a.echeance) return false;
      if (a.statut?.includes('Terminé') || a.statut?.includes('Annulé')) return false;
      const dj = diffJours(a.echeance, now);
      return dj !== null && dj < 0;
    });
    const tauxCloture  = actions.length>0 ? Math.round((actTerminees.length/actions.length)*100) : 0;
    const parDomaine   = ['Qualité','Sécurité','Environnement','Énergie','RSE / Transverse'].map(d => {
      const total = actions.filter(a=>a.domaine===d).length;
      const done  = actions.filter(a=>a.domaine===d&&a.statut?.includes('Terminé')).length;
      return { domaine:d.split(' /')[0], total, done, taux: total>0?Math.round((done/total)*100):0 };
    }).filter(d=>d.total>0);

    // Habilitations
    const habValides   = habs.filter(h => h.obtention && calcExp(h.obtention,h.validiteAns)>now);
    const tauxHabs     = habs.length>0 ? Math.round((habValides.length/habs.length)*100) : 100;

    // DUERP
    const risqCrit = risques.filter(r=>(r.criticite||1)>=9);
    const risqMod  = risques.filter(r=>(r.criticite||1)>=4&&(r.criticite||1)<9);
    const risqAcc  = risques.filter(r=>(r.criticite||1)<4);
    const tauxMaitrise = risques.length>0 ? Math.round((risqAcc.length/risques.length)*100) : 100;

    // Satisfaction
    const moyenneSat = sat.length>0 ? +(sat.reduce((s,a)=>s+Number(a.note_globale),0)/sat.length).toFixed(1) : null;

    // NC
    const tauxNC = ncs.length>0 ? Math.round((ncs.filter(n=>n.statut_nc==='Clôturée').length/ncs.length)*100) : 100;

    // Score global
    const scoreSecurite = Math.max(0, 100 - TF*5 - accidents.filter(a=>a.type_evenement==='Soins (sans arrêt)').length*2);
    const scoreGlobal   = Math.round((scoreSecurite + tauxCloture + tauxHabs + tauxMaitrise) / 4);

    // Graphique évolution accidentologie par mois
    const accMap={};
    accidents.forEach(a => {
      const m = a.date_evenement?.substring(0,7); if(!m)return;
      if(!accMap[m]) accMap[m]={mois:m,TF:0,jours:0};
      if(a.type_evenement==='Accident avec arrêt') accMap[m].TF++;
      accMap[m].jours += a.jours_perdus||0;
    });
    const accChart = Object.values(accMap).sort((a,b)=>a.mois.localeCompare(b.mois)).slice(-12).map(m => ({
      mois: m.mois, TF: heures>0?(+(m.TF*1000000/heures).toFixed(2)):0, jours: m.jours,
    }));

    // Graphique évolution satisfaction
    const satChart = sat.slice(-12).map(s => ({ date: s.date_enquete?.substring(0,7), note: Number(s.note_globale) }));

    // Graphique NC par mois
    const ncMap={};
    ncs.forEach(n => { const m=n.date_nc?.substring(0,7); if(!m)return; if(!ncMap[m])ncMap[m]={mois:m,total:0,cloturees:0}; ncMap[m].total++; if(n.statut_nc==='Clôturée')ncMap[m].cloturees++; });
    const ncChart = Object.values(ncMap).sort((a,b)=>a.mois.localeCompare(b.mois)).slice(-12);

    return {
      heures:Math.round(heures), TF, TG, accArret:accArret.length,
      accSansArret:accidents.filter(a=>a.type_evenement==='Soins (sans arrêt)').length,
      presquAcc:accidents.filter(a=>a.type_evenement==="Presqu'accident").length,
      jours, tauxCloture, actRetard:actRetard.length, actTerminees:actTerminees.length,
      totalActions:actions.length, parDomaine,
      tauxHabs, habValides:habValides.length, totalHabs:habs.length,
      risqCrit:risqCrit.length, risqMod:risqMod.length, risqAcc:risqAcc.length, tauxMaitrise,
      moyenneSat, tauxNC, scoreGlobal,
      accChart, satChart, ncChart,
    };
  }, [data, effectif]);

  // ── Composant KPI Card ────────────────────────────────────────────────────
  const KpiCard = ({ titre, valeur, unite='', icone, couleur, sous_titre, objKey, inverse=false }) => {
    const obj = objKey ? objectifs[objKey] : undefined;
    const ok  = obj!==undefined ? (inverse ? valeur<=obj : valeur>=obj) : null;
    const pct = obj!==undefined && obj>0 ? Math.min(100, Math.round((inverse ? Math.max(0,obj-valeur)/obj : valeur/obj)*100)) : null;
    const COLORS = {
      red:    {border:'border-red-500',    bg:'bg-red-500/10',    text:'text-red-400'},
      amber:  {border:'border-amber-500',  bg:'bg-amber-500/10',  text:'text-amber-400'},
      green:  {border:'border-emerald-500',bg:'bg-emerald-500/10',text:'text-emerald-400'},
      blue:   {border:'border-blue-500',   bg:'bg-blue-500/10',   text:'text-blue-400'},
      purple: {border:'border-purple-500', bg:'bg-purple-500/10', text:'text-purple-400'},
    };
    const cc = COLORS[couleur] || COLORS.blue;
    return (
      <div className={`glass-panel p-5 border-l-4 ${cc.border}`}>
        <div className="flex justify-between items-start mb-3">
          <p className="text-slate-400 text-xs font-bold uppercase tracking-wider leading-tight flex-1">{titre}</p>
          <div className={`p-2.5 rounded-xl ${cc.bg} ${cc.text} shrink-0 ml-2`}>{icone}</div>
        </div>
        <div className="flex items-baseline gap-2">
          <h4 className="text-4xl font-black text-white">{valeur}</h4>
          {unite && <span className="text-slate-400 text-sm">{unite}</span>}
        </div>
        {sous_titre && <p className="text-xs text-slate-500 mt-1">{sous_titre}</p>}
        {obj!==undefined && (
          <div className="mt-3">
            <div className="flex items-center justify-between mb-1">
              <span className={`text-xs font-bold ${ok?'text-emerald-400':'text-amber-400'}`}>
                {ok ? '✓ Objectif atteint' : '⚠ Objectif manqué'} ({inverse?'≤':'≥'}{obj}{unite})
              </span>
              {pct!==null && <span className="text-xs text-slate-500">{pct}%</span>}
            </div>
            {pct!==null && (
              <div style={{height:4,background:p.whiteFaint,borderRadius:2}}>
                <div style={{height:'100%',width:`${pct}%`,background:ok?'#10B981':'#F59E0B',borderRadius:2,transition:'width 0.8s'}}/>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  if (loading||!c) return (
    <div className="flex items-center justify-center h-64">
      <div className="text-center"><RefreshCw size={32} className="animate-spin text-blue-400 mx-auto mb-3"/><p className="text-slate-400">Calcul des KPIs...</p></div>
    </div>
  );

  const scoreColor = c.scoreGlobal>=80?'#10B981':c.scoreGlobal>=60?'#F59E0B':'#EF4444';

  // Atteinte objectifs
  const objectifsCheck = [
    {label:'Taux de Fréquence',   val:c.TF,         obj:objectifs.TF,           inverse:true,  ok:c.TF<=objectifs.TF},
    {label:'Taux de Gravité',     val:c.TG,         obj:objectifs.TG,           inverse:true,  ok:c.TG<=objectifs.TG},
    {label:'Clôture PDCA',        val:`${c.tauxCloture}%`, obj:`≥${objectifs.tauxCloture}%`,inverse:false, ok:c.tauxCloture>=objectifs.tauxCloture},
    {label:'Habilitations valides',val:`${c.tauxHabs}%`,   obj:`≥${objectifs.tauxHabs}%`,  inverse:false, ok:c.tauxHabs>=objectifs.tauxHabs},
    {label:'Maîtrise risques',    val:`${c.tauxMaitrise}%`,obj:`≥${objectifs.tauxMaitrise}%`,inverse:false,ok:c.tauxMaitrise>=objectifs.tauxMaitrise},
    {label:'AT avec arrêt',       val:c.accArret,   obj:`≤${objectifs.accArret}`, inverse:true,  ok:c.accArret<=objectifs.accArret},
    {label:'Actions en retard',   val:c.actRetard,  obj:`≤${objectifs.actionsRetard}`,inverse:true,ok:c.actRetard<=objectifs.actionsRetard},
    {label:'Satisfaction client', val:c.moyenneSat||'—', obj:`≥${objectifs.satisfaction}/10`,inverse:false,ok:c.moyenneSat>=objectifs.satisfaction},
  ];
  const nbAtteints = objectifsCheck.filter(o=>o.ok).length;

  return (
    <div className="space-y-5 pb-10">

      {/* ── En-tête ──────────────────────────────────────────────────────── */}
      <header className="page-header">
        <div>
          <h2 className="page-title flex items-center gap-3"><BarChart2 size={26} className="text-blue-400"/> KPIs & Indicateurs</h2>
          <p className="page-subtitle">Taux de Fréquence, Taux de Gravité et conformité — calculés en temps réel</p>
        </div>
        <div className="flex items-center gap-3">
          <div style={{display:'flex',alignItems:'center',gap:8,background:p.whiteFaint2,border:'1px solid '+p.border,borderRadius:10,padding:'7px 14px'}}>
            <label style={{fontSize:12,color:p.text2,fontWeight:600}}>Effectif :</label>
            <input type="number" min="1" value={effectif}
              onChange={e => saveConfig({ effectif: Number(e.target.value) })}
              style={{width:52,background:'transparent',color:p.text1,fontSize:14,fontWeight:800,outline:'none',textAlign:'center',border:'none',fontFamily:'inherit'}}/>
            <span style={{fontSize:11,color:p.text4}}>pers.</span>
          </div>
          <button onClick={() => { setObjEdit(objectifs); setShowObj(true); }} className="btn-secondary"><Settings size={15}/> Objectifs</button>
          <button onClick={charger} className="btn-primary"><RefreshCw size={15} className={loading?'animate-spin':''}/> Recalculer</button>
        </div>
      </header>

      {/* ── Panneau objectifs ─────────────────────────────────────────────── */}
      {showObj && (
        <div className="glass-panel p-5 border border-blue-500/20 animate-fade-up">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-white font-bold flex items-center gap-2"><Target size={16} className="text-blue-400"/> Définir les objectifs annuels</h3>
            <button onClick={()=>setShowObj(false)} className="text-slate-500 hover:text-white p-1">✕</button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              {label:'TF objectif (≤)',   key:'TF',            unite:'',    type:'number',step:0.1},
              {label:'TG objectif (≤)',   key:'TG',            unite:'',    type:'number',step:0.1},
              {label:'Clôture PDCA (≥%)', key:'tauxCloture',   unite:'%',   type:'number'},
              {label:'Habilitations (≥%)',key:'tauxHabs',      unite:'%',   type:'number'},
              {label:'Maîtrise risques (≥%)',key:'tauxMaitrise',unite:'%',  type:'number'},
              {label:'AT avec arrêt (≤)', key:'accArret',      unite:'',    type:'number'},
              {label:'Actions retard (≤)',key:'actionsRetard', unite:'',    type:'number'},
              {label:'Satisfaction (≥)',  key:'satisfaction',  unite:'/10', type:'number',step:0.5},
            ].map(f => (
              <div key={f.key}>
                <label className="text-slate-400 text-xs font-bold uppercase tracking-wider block mb-1">{f.label}</label>
                <div style={{display:'flex',alignItems:'center',gap:4}}>
                  <input type={f.type} step={f.step||1} value={objEdit[f.key]}
                    onChange={e=>setObjEdit(p=>({...p,[f.key]:Number(e.target.value)}))}
                    className="input-modern" style={{padding:'7px 10px',fontSize:14,fontWeight:700}}/>
                  {f.unite && <span style={{fontSize:12,color:p.text3,flexShrink:0}}>{f.unite}</span>}
                </div>
              </div>
            ))}
          </div>
          <div className="flex gap-3 mt-4">
            <button onClick={()=>setShowObj(false)} className="btn-secondary">Annuler</button>
            <button onClick={sauvegarderObjectifs} className="btn-primary"><Save size={14}/> Sauvegarder les objectifs</button>
          </div>
        </div>
      )}

      {/* ── Score global + atteinte objectifs ────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="glass-panel p-6 text-center flex flex-col items-center justify-center">
          <div style={{width:96,height:96,borderRadius:'50%',border:`4px solid ${scoreColor}`,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',boxShadow:`0 0 28px ${scoreColor}25`,marginBottom:10}}>
            <span style={{fontSize:30,fontWeight:900,color:scoreColor,lineHeight:1}}>{c.scoreGlobal}</span>
            <span style={{fontSize:10,color:p.text3}}>/100</span>
          </div>
          <p style={{fontSize:15,fontWeight:800,color:scoreColor}}>{c.scoreGlobal>=80?'Excellent':c.scoreGlobal>=60?'Satisfaisant':'À améliorer'}</p>
          <p style={{fontSize:11,color:p.text4,marginTop:2}}>Score global SMI</p>
          <p style={{fontSize:12,marginTop:12,color:nbAtteints>=objectifsCheck.length?'#10B981':'#F59E0B',fontWeight:700}}>
            {nbAtteints}/{objectifsCheck.length} objectifs atteints
          </p>
          <p style={{fontSize:11,color:p.text4}}>Base : {c.heures.toLocaleString('fr-FR')} h</p>
        </div>

        <div className="glass-panel p-5 lg:col-span-2">
          <h3 className="text-white font-bold mb-3 flex items-center gap-2"><Target size={16} className="text-blue-400"/> Atteinte des objectifs</h3>
          <div className="grid grid-cols-2 gap-2">
            {objectifsCheck.map((o,i) => (
              <div key={i} style={{display:'flex',alignItems:'center',gap:8,padding:'7px 10px',background:p.whiteFaint2,borderRadius:8,border:`1px solid ${o.ok?'rgba(16,185,129,0.2)':'rgba(245,158,11,0.2)'}`}}>
                <div style={{width:8,height:8,borderRadius:'50%',background:o.ok?'#10B981':'#F59E0B',flexShrink:0}}/>
                <span style={{flex:1,fontSize:12,color:p.text2}}>{o.label}</span>
                <span style={{fontSize:12,fontWeight:700,color:o.ok?'#10B981':'#F59E0B'}}>{o.val}</span>
                <span style={{fontSize:10,color:p.text4}}>obj:{o.obj}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── KPIs Sécurité ─────────────────────────────────────────────────── */}
      <div>
        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2"><Shield size={14} className="text-red-400"/> Indicateurs Sécurité</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard titre="Taux de Fréquence (TF)" valeur={c.TF} icone={<Activity size={22}/>} couleur={c.TF===0?'green':c.TF<=objectifs.TF?'amber':'red'} sous_titre="Acc.×10⁶ / h travaillées" objKey="TF" inverse/>
          <KpiCard titre="Taux de Gravité (TG)" valeur={c.TG} icone={<TrendingDown size={22}/>} couleur={c.TG===0?'green':c.TG<=objectifs.TG?'amber':'red'} sous_titre={`${c.jours} jours perdus`} objKey="TG" inverse/>
          <KpiCard titre="Accidents avec arrêt" valeur={c.accArret} icone={<AlertTriangle size={22}/>} couleur={c.accArret===0?'green':'red'} sous_titre={`+ ${c.accSansArret} soins sans arrêt`} objKey="accArret" inverse/>
          <KpiCard titre="Presqu'accidents" valeur={c.presquAcc} icone={<Shield size={22}/>} couleur="blue" sous_titre="Événements précurseurs"/>
        </div>
      </div>

      {/* ── KPIs Conformité ───────────────────────────────────────────────── */}
      <div>
        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2"><Target size={14} className="text-blue-400"/> Taux de Conformité</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KpiCard titre="Clôture Plan d'Actions" valeur={c.tauxCloture} unite="%" icone={<CheckCircle size={22}/>} couleur={c.tauxCloture>=objectifs.tauxCloture?'green':c.tauxCloture>=50?'amber':'red'} sous_titre={`${c.actTerminees}/${c.totalActions} terminées`} objKey="tauxCloture"/>
          <KpiCard titre="Actions en retard" valeur={c.actRetard} icone={<AlertTriangle size={22}/>} couleur={c.actRetard===0?'green':'red'} sous_titre="Échéances dépassées" objKey="actionsRetard" inverse/>
          <KpiCard titre="Habilitations valides" valeur={c.tauxHabs} unite="%" icone={<CheckCircle size={22}/>} couleur={c.tauxHabs>=objectifs.tauxHabs?'green':c.tauxHabs>=70?'amber':'red'} sous_titre={`${c.habValides}/${c.totalHabs} habilitations`} objKey="tauxHabs"/>
          <KpiCard titre="Maîtrise des risques" valeur={c.tauxMaitrise} unite="%" icone={<Shield size={22}/>} couleur={c.tauxMaitrise>=objectifs.tauxMaitrise?'green':'amber'} sous_titre={`${c.risqAcc} acceptables / ${c.risqCrit} critiques`} objKey="tauxMaitrise"/>
        </div>
      </div>

      {/* ── Graphiques ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* TF évolution */}
        <div className="glass-panel p-5">
          <h3 className="text-white font-bold mb-3 text-sm flex items-center gap-2"><Activity size={15} className="text-red-400"/> Évolution TF — 12 mois</h3>
          {c.accChart.length===0 ? (
            <div className="h-44 flex items-center justify-center flex-col gap-2"><CheckCircle size={28} className="text-emerald-400"/><p className="text-emerald-400 font-bold text-sm">TF = 0 sur toute la période</p></div>
          ) : (
            <div className="h-44"><ResponsiveContainer width="100%" height="100%">
              <AreaChart data={c.accChart}>
                <defs><linearGradient id="tfGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#EF4444" stopOpacity={0.3}/><stop offset="95%" stopColor="#EF4444" stopOpacity={0}/></linearGradient></defs>
                <CartesianGrid strokeDasharray="3 3" stroke={p.chartGrid} vertical={false}/>
                <XAxis dataKey="mois" stroke={p.chartAxis} tick={{fill:'#64748B',fontSize:11}}/><YAxis stroke={p.chartAxis} tick={{fill:'#64748B',fontSize:10}}/>
                <Tooltip contentStyle={{background:p.tooltipBg,border:`1px solid ${p.tooltipBorder}`,borderRadius:10,fontSize:11}}/>
                <ReferenceLine y={objectifs.TF} stroke="#F59E0B" strokeDasharray="4 4" label={{value:`Obj.${objectifs.TF}`,fill:'#F59E0B',fontSize:10}}/>
                <Area type="monotone" dataKey="TF" name="TF" stroke="#EF4444" fill="url(#tfGrad)" strokeWidth={2} dot={{r:3,fill:'#EF4444'}}/>
              </AreaChart>
            </ResponsiveContainer></div>
          )}
        </div>

        {/* Clôture par domaine */}
        {c.parDomaine.length>0 && (
          <div className="glass-panel p-5">
            <h3 className="text-white font-bold mb-3 text-sm flex items-center gap-2"><Target size={15} className="text-blue-400"/> Clôture actions par domaine</h3>
            <div className="h-44"><ResponsiveContainer width="100%" height="100%">
              <BarChart data={c.parDomaine} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke={p.chartGrid} horizontal={false}/>
                <XAxis type="number" domain={[0,100]} stroke={p.chartAxis} tick={{fill:'#64748B',fontSize:10}} tickFormatter={v=>`${v}%`}/>
                <YAxis type="category" dataKey="domaine" stroke={p.chartAxis} tick={{fill:'#64748B',fontSize:11}} width={75}/>
                <Tooltip contentStyle={{background:p.tooltipBg,border:`1px solid ${p.tooltipBorder}`,borderRadius:10,fontSize:11}} formatter={v=>[`${v}%`,'Taux']}/>
                <ReferenceLine x={objectifs.tauxCloture} stroke="#F59E0B" strokeDasharray="4 4"/>
                <Bar dataKey="taux" name="Taux clôture" radius={[0,6,6,0]}>
                  {c.parDomaine.map((d,i)=><Cell key={i} fill={d.taux>=objectifs.tauxCloture?'#10B981':d.taux>=50?'#F59E0B':'#EF4444'}/>)}
                </Bar>
              </BarChart>
            </ResponsiveContainer></div>
          </div>
        )}

        {/* Satisfaction */}
        <div className="glass-panel p-5">
          <h3 className="text-white font-bold mb-3 text-sm flex items-center gap-2"><CheckCircle size={15} className="text-purple-400"/> Évolution satisfaction client</h3>
          {c.satChart.length===0 ? (
            <div className="h-44 flex items-center justify-center text-slate-500 text-sm">Aucune enquête.</div>
          ) : (
            <div className="h-44"><ResponsiveContainer width="100%" height="100%">
              <LineChart data={c.satChart}>
                <CartesianGrid strokeDasharray="3 3" stroke={p.chartGrid} vertical={false}/>
                <XAxis dataKey="date" stroke={p.chartAxis} tick={{fill:'#64748B',fontSize:11}}/><YAxis domain={[0,10]} stroke={p.chartAxis} tick={{fill:'#64748B',fontSize:10}}/>
                <Tooltip contentStyle={{background:p.tooltipBg,border:`1px solid ${p.tooltipBorder}`,borderRadius:10,fontSize:11}}/>
                <ReferenceLine y={objectifs.satisfaction} stroke="#F59E0B" strokeDasharray="4 4" label={{value:`Obj.${objectifs.satisfaction}`,fill:'#F59E0B',fontSize:10}}/>
                <Line type="monotone" dataKey="note" name="Note /10" stroke="#8B5CF6" strokeWidth={3} dot={{r:4,fill:'#8B5CF6'}}/>
              </LineChart>
            </ResponsiveContainer></div>
          )}
        </div>

        {/* NC évolution */}
        <div className="glass-panel p-5">
          <h3 className="text-white font-bold mb-3 text-sm flex items-center gap-2"><Activity size={15} className="text-amber-400"/> Non-Conformités — 12 mois</h3>
          {c.ncChart.length===0 ? (
            <div className="h-44 flex items-center justify-center text-slate-500 text-sm">Aucune NC enregistrée.</div>
          ) : (
            <div className="h-44"><ResponsiveContainer width="100%" height="100%">
              <BarChart data={c.ncChart}>
                <CartesianGrid strokeDasharray="3 3" stroke={p.chartGrid} vertical={false}/>
                <XAxis dataKey="mois" stroke={p.chartAxis} tick={{fill:'#64748B',fontSize:11}}/><YAxis stroke={p.chartAxis} tick={{fill:'#64748B',fontSize:10}} allowDecimals={false}/>
                <Tooltip contentStyle={{background:p.tooltipBg,border:`1px solid ${p.tooltipBorder}`,borderRadius:10,fontSize:11}}/>
                <Bar dataKey="total" name="Total NC" fill="#F59E0B" radius={[4,4,0,0]}/>
                <Bar dataKey="cloturees" name="Clôturées" fill="#10B981" radius={[4,4,0,0]}/>
              </BarChart>
            </ResponsiveContainer></div>
          )}
        </div>
      </div>

      {/* ── Formules ─────────────────────────────────────────────────────── */}
      <div className="glass-panel p-5 border border-blue-500/15">
        <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2"><Info size={14}/> Formules réglementaires</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[
            {titre:'Taux de Fréquence (TF)',formule:'TF = (Acc. avec arrêt × 1 000 000) / H travaillées',detail:`${effectif} pers. × ${H_AN}h/an = ${c.heures.toLocaleString('fr-FR')}h`},
            {titre:'Taux de Gravité (TG)',formule:'TG = (Jours perdus × 1 000) / H travaillées',detail:`Jours perdus cumulés : ${c.jours} jour${c.jours>1?'s':''}`},
          ].map((f,i)=>(
            <div key={i} style={{background:p.bgCard2,borderRadius:10,padding:'12px 14px'}}>
              <p className="text-white font-bold text-sm mb-1">{f.titre}</p>
              <p style={{fontFamily:'monospace',fontSize:12,color:'#60A5FA'}}>{f.formule}</p>
              <p className="text-slate-500 text-xs mt-1">{f.detail}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
