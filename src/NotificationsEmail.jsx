import { useTheme } from './ThemeContext';
import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import {
  Mail, Send, CheckCircle, AlertTriangle, Clock, Bell,
  Loader, Plus, Trash2, Settings, Eye, History, X
} from 'lucide-react';

import { calcExpiration } from './utils/kpi';

const FREQUENCES = ['Manuel uniquement', 'Hebdomadaire (lundi 8h)', 'Mensuel (1er du mois)'];

const diffJ = ds => Math.ceil((new Date(ds) - new Date()) / 86400000);

function loadConfig() {
  try {
    return JSON.parse(localStorage.getItem('alertes_config') || 'null') || {
      destinataires: [], frequence: 'Manuel uniquement',
      seuils: { actionsRetard:1, habsPerimees:1, risquesCritiques:1, ncOuvertes:3, accidentArret:1 },
      modules: { actions:true, habilitations:true, risques:true, ncs:true, accidents:true },
    };
  } catch { return { destinataires:[], frequence:'Manuel uniquement', seuils:{actionsRetard:1,habsPerimees:1,risquesCritiques:1,ncOuvertes:3,accidentArret:1}, modules:{actions:true,habilitations:true,risques:true,ncs:true,accidents:true} }; }
}

export default function NotificationsEmail() {
  const { p, isDark } = useTheme();
  const [config, setConfig]     = useState(loadConfig);
  const [newEmail, setNewEmail] = useState('');
  const [loading, setLoading]   = useState(false);
  const [loadChk, setLoadChk]   = useState(false);
  const [resultat, setResultat] = useState(null);
  const [alertes, setAlertes]   = useState(null);
  const [historique, setHist]   = useState(() => { try { return JSON.parse(localStorage.getItem('alertes_hist')||'[]'); } catch { return []; } });
  const [onglet, setOnglet]     = useState('config');
  const [showSeuils, setShowS]  = useState(false);

  const save = (c) => { setConfig(c); localStorage.setItem('alertes_config', JSON.stringify(c)); };

  const ajouterEmail = () => {
    const e = newEmail.trim().toLowerCase();
    if (!e || !e.includes('@') || config.destinataires.includes(e)) return;
    save({ ...config, destinataires: [...config.destinataires, e] });
    setNewEmail('');
  };

  const suppEmail = (e) => save({ ...config, destinataires: config.destinataires.filter(d => d !== e) });

  const verifier = async () => {
    setLoadChk(true);
    const [r1,r2,r3,r4,r5] = await Promise.all([
      supabase.from('plan_actions').select('id,action,pilote,echeance,statut,priorite'),
      supabase.from('habilitations').select('id,employe,domaine,obtention,validiteAns'),
      supabase.from('registre_duerp').select('id,danger,criticite,unite_travail'),
      supabase.from('qualite_nc').select('id,description,statut_nc,date_nc'),
      supabase.from('securite_accidents').select('id,type_evenement,date_evenement,description,lieu'),
    ]);
    const actions=r1.data||[], habs=r2.data||[], risques=r3.data||[], ncs=r4.data||[], acc=r5.data||[];
    const actRetard  = actions.filter(a => !a.statut?.includes('Terminé')&&!a.statut?.includes('Annulé')&&a.echeance&&diffJ(a.echeance)<0);
    const actImm     = actions.filter(a => !a.statut?.includes('Terminé')&&!a.statut?.includes('Annulé')&&a.echeance&&diffJ(a.echeance)>=0&&diffJ(a.echeance)<=7);
    // calcExpiration retourne null si saisie incomplète → on early-return pour
    // éviter `diffJ(null)` qui retomberait sur `new Date(null) = 1970` et
    // enverrait des alertes "périmée" fantômes à des habilitations en réalité mal saisies.
    const habPer     = habs.filter(h => {
      const exp = calcExpiration(h.obtention, h.validiteAns);
      return exp !== null && diffJ(exp) < 0;
    });
    const habBient   = habs.filter(h => {
      const exp = calcExpiration(h.obtention, h.validiteAns);
      if (exp === null) return false;
      const j = diffJ(exp);
      return j >= 0 && j <= 30;
    });
    const risqCrit   = risques.filter(r=>(r.criticite||1)>=9);
    const ncOuv      = ncs.filter(n=>n.statut_nc==='Ouverte'||!n.statut_nc);
    const accArret   = acc.filter(a=>a.type_evenement==='Accident avec arrêt');
    setAlertes({ actRetard, actImm, habPer, habBient, risqCrit, ncOuv, accArret });
    setLoadChk(false);
  };

  const envoyer = async () => {
    if (config.destinataires.length===0) { alert('Ajoute au moins un destinataire.'); return; }
    setLoading(true); setResultat(null);
    try {
      const { data, error } = await supabase.functions.invoke('send-alertes', {
        body: { emails_dest: config.destinataires, config: config.modules },
      });
      if (error) throw error;
      setResultat({ success:true, ...data });
      const e = { date:new Date().toISOString(), dest:config.destinataires, ok:true, nb:alertes?Object.values(alertes).reduce((s,a)=>s+a.length,0):'—' };
      const h = [e,...historique].slice(0,20); setHist(h); localStorage.setItem('alertes_hist',JSON.stringify(h));
    } catch(err) {
      setResultat({ success:false, message:String(err) });
      const e = { date:new Date().toISOString(), dest:config.destinataires, ok:false, nb:'—' };
      const h = [e,...historique].slice(0,20); setHist(h); localStorage.setItem('alertes_hist',JSON.stringify(h));
    }
    setLoading(false);
  };

  const total = alertes ? Object.values(alertes).reduce((s,a)=>s+a.length,0) : null;

  const TABS = [
    {id:'config',label:'Configuration',icon:<Settings size={14}/>},
    {id:'apercu',label:'Aperçu alertes',icon:<Eye size={14}/>},
    {id:'hist',  label:`Historique (${historique.length})`,icon:<History size={14}/>},
  ];

  return (
    <div className="space-y-5 pb-10">
      <header className="page-header">
        <div>
          <h2 className="page-title flex items-center gap-3"><Mail size={26} className="text-blue-400"/> Alertes Email</h2>
          <p className="page-subtitle">Rapport d'alertes QHSE par email à ta direction</p>
        </div>
        <div className="flex gap-3">
          <button onClick={verifier} disabled={loadChk} className="btn-secondary">
            {loadChk ? <Loader size={14} className="animate-spin"/> : <Bell size={14}/>} Vérifier les alertes
          </button>
          <button onClick={envoyer} disabled={loading||config.destinataires.length===0} className="btn-primary" style={{background:'#10B981',boxShadow:'0 0 16px rgba(16,185,129,0.3)'}}>
            {loading ? <Loader size={14} className="animate-spin"/> : <Send size={14}/>} Envoyer maintenant
          </button>
        </div>
      </header>

      {resultat && (
        <div className={`alert-banner ${resultat.success?'alert-green':'alert-red'}`}>
          {resultat.success ? <CheckCircle size={16} className="shrink-0"/> : <AlertTriangle size={16} className="shrink-0"/>}
          <div className="flex-1">
            <p className="font-bold">{resultat.success ? `Email envoyé à : ${config.destinataires.join(', ')}` : 'Erreur lors de l\'envoi'}</p>
            {resultat.message && <p className="text-xs mt-0.5 opacity-80">{resultat.message}</p>}
          </div>
          <button onClick={()=>setResultat(null)} className="shrink-0 p-1 opacity-60 hover:opacity-100"><X size={13}/></button>
        </div>
      )}

      <div className="flex gap-2 border-b border-white/10">
        {TABS.map(t => (
          <button key={t.id} onClick={()=>setOnglet(t.id)}
            className="flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-t-xl transition-all border-b-2"
            style={onglet===t.id?{borderColor:'#3B82F6',color:'#60A5FA'}:{borderColor:'transparent',color:p.text3}}>
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      {/* ── CONFIGURATION ─────────────────────────────────────────────────── */}
      {onglet==='config' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 animate-fade-up">
          <div className="glass-panel p-5">
            <h3 className="font-bold mb-4 flex items-center gap-2"><Mail size={16} className="text-blue-400"/> Destinataires</h3>
            <div className="flex gap-2 mb-4">
              <input type="email" value={newEmail} onChange={e=>setNewEmail(e.target.value)} onKeyDown={e=>e.key==='Enter'&&ajouterEmail()} placeholder="email@entreprise.com" className="input-modern flex-1" style={{padding:'8px 12px',fontSize:13}}/>
              <button onClick={ajouterEmail} className="btn-primary" style={{padding:'8px 14px',fontSize:13}}><Plus size={14}/> Ajouter</button>
            </div>
            {config.destinataires.length===0 ? (
              <p className="text-slate-500 text-sm italic text-center py-4">Aucun destinataire</p>
            ) : config.destinataires.map((e,i) => (
              <div key={i} style={{display:'flex',alignItems:'center',justifyContent:'space-between',background:p.whiteFaint2,border:'1px solid '+p.border,borderRadius:8,padding:'8px 12px',marginBottom:6}}>
                <div className="flex items-center gap-2">
                  <div style={{width:26,height:26,background:'linear-gradient(135deg,#3B82F6,#06B6D4)',borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,fontWeight:800,color:'white'}}>{e.charAt(0).toUpperCase()}</div>
                  <span style={{fontSize:13,color:p.text2}}>{e}</span>
                </div>
                <button onClick={()=>suppEmail(e)} className="text-slate-600 hover:text-red-400 p-1 transition-colors"><Trash2 size={13}/></button>
              </div>
            ))}
          </div>

          <div className="space-y-4">
            <div className="glass-panel p-5">
              <h3 className="font-bold mb-3 flex items-center gap-2"><Clock size={16} className="text-amber-400"/> Fréquence</h3>
              {FREQUENCES.map(f => (
                <button key={f} onClick={()=>save({...config,frequence:f})}
                  style={{width:'100%',display:'flex',alignItems:'center',gap:10,padding:'9px 12px',borderRadius:8,border:'1px solid',cursor:'pointer',transition:'all 0.15s',marginBottom:6,
                    background:config.frequence===f?'rgba(59,130,246,0.12)':p.whiteFaint2,
                    borderColor:config.frequence===f?'rgba(59,130,246,0.35)':p.border}}>
                  <div style={{width:14,height:14,borderRadius:'50%',border:`2px solid ${config.frequence===f?'#3B82F6':'#334155'}`,background:config.frequence===f?'#3B82F6':'transparent'}}/>
                  <span style={{fontSize:13,color:config.frequence===f?'#60A5FA':'#94A3B8',fontWeight:config.frequence===f?600:400}}>{f}</span>
                </button>
              ))}
            </div>

            <div className="glass-panel p-5">
              <h3 className="font-bold mb-3 flex items-center gap-2"><Bell size={16} className="text-purple-400"/> Modules inclus</h3>
              {[
                {key:'actions',      label:'Plan d\'actions'},
                {key:'habilitations',label:'Habilitations'},
                {key:'risques',      label:'Risques critiques'},
                {key:'ncs',          label:'Non-conformités'},
                {key:'accidents',    label:'Accidents AT'},
              ].map(m => (
                <div key={m.key} style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'6px 0',borderBottom:'1px solid rgba(255,255,255,0.04)'}}>
                  <span style={{fontSize:13,color:p.text2}}>{m.label}</span>
                  <button onClick={()=>{const c={...config,modules:{...config.modules,[m.key]:!config.modules[m.key]}};save(c);}}
                    style={{width:40,height:22,borderRadius:100,border:'none',cursor:'pointer',transition:'all 0.2s',background:config.modules[m.key]?'#3B82F6':p.whiteFaint3,position:'relative'}}>
                    <div style={{width:16,height:16,borderRadius:'50%',background:'white',position:'absolute',top:3,left:config.modules[m.key]?21:3,transition:'left 0.2s'}}/>
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="glass-panel p-5 lg:col-span-2">
            <button onClick={()=>setShowS(!showSeuils)} className="w-full flex items-center justify-between">
              <h3 className="font-bold flex items-center gap-2"><Settings size={15} className="text-slate-400"/> Seuils de déclenchement</h3>
              <span style={{fontSize:11,color:p.text4}}>{showSeuils?'▲':'▼'}</span>
            </button>
            {showSeuils && (
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-4">
                {[
                  {key:'actionsRetard',    label:'Actions retard ≥'},
                  {key:'habsPerimees',     label:'Habs périmées ≥'},
                  {key:'risquesCritiques', label:'Risques critiques ≥'},
                  {key:'ncOuvertes',       label:'NC ouvertes ≥'},
                  {key:'accidentArret',    label:'AT avec arrêt ≥'},
                ].map(s => (
                  <div key={s.key}>
                    <label className="text-slate-400 text-xs font-bold uppercase tracking-wider block mb-1">{s.label}</label>
                    <input type="number" min="0" value={config.seuils[s.key]} onChange={e=>{const c={...config,seuils:{...config.seuils,[s.key]:Number(e.target.value)}};save(c);}} className="input-modern text-center" style={{padding:'7px',fontSize:16,fontWeight:800}}/>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── APERÇU ────────────────────────────────────────────────────────── */}
      {onglet==='apercu' && (
        <div className="space-y-3 animate-fade-up">
          {alertes===null ? (
            <div className="glass-panel p-10 text-center"><Bell size={32} className="text-blue-400 mx-auto mb-3"/><p className="font-bold mb-2">Cliquez sur "Vérifier les alertes"</p><p className="text-slate-400 text-sm">pour voir ce qui sera inclus dans le prochain email</p><button onClick={verifier} disabled={loadChk} className="btn-primary mt-4">{loadChk?<Loader size={14} className="animate-spin"/>:<Bell size={14}/>} Vérifier</button></div>
          ) : total===0 ? (
            <div className="glass-panel p-10 text-center"><CheckCircle size={32} className="text-emerald-400 mx-auto mb-3"/><p className="text-emerald-400 font-bold text-lg">Aucune alerte active !</p><p className="text-slate-400 text-sm mt-1">Tous les indicateurs sont au vert</p></div>
          ) : (
            <>
              <div className="glass-panel p-4 flex items-center gap-3 border border-amber-500/20">
                <AlertTriangle size={16} className="text-amber-400 shrink-0"/>
                <p className="font-bold">{total} alerte{total>1?'s':''} détectée{total>1?'s':''} — seront incluses dans l'email</p>
              </div>
              {[
                {list:alertes.actRetard,  label:'Actions PDCA en retard',       level:'red',   fields:['action','pilote']},
                {list:alertes.actImm,     label:'Actions sous 7 jours',         level:'amber', fields:['action','pilote']},
                {list:alertes.habPer,     label:'Habilitations périmées',        level:'red',   fields:['employe','domaine']},
                {list:alertes.habBient,   label:'Habilitations sous 30 jours',   level:'amber', fields:['employe','domaine']},
                {list:alertes.risqCrit,   label:'Risques critiques DUERP',       level:'red',   fields:['danger','unite_travail']},
                {list:alertes.ncOuv,      label:'Non-conformités ouvertes',      level:'amber', fields:['description']},
                {list:alertes.accArret,   label:'Accidents avec arrêt',          level:'red',   fields:['description','lieu']},
              ].filter(g=>g.list.length>0).map((g,i)=>(
                <div key={i} className={`alert-banner ${g.level==='red'?'alert-red':'alert-amber'} flex-col items-start gap-2`} style={{padding:'12px 16px'}}>
                  <div className="flex items-center gap-2 w-full">
                    <AlertTriangle size={14} className="shrink-0"/><p className="font-bold flex-1">{g.label} — {g.list.length}</p>
                  </div>
                  <div className="w-full space-y-0.5 pl-4">
                    {g.list.slice(0,3).map((item,j)=>(
                      <p key={j} style={{fontSize:12,opacity:0.8}}>· {g.fields.map(f=>item[f]).filter(Boolean).join(' — ')}</p>
                    ))}
                    {g.list.length>3 && <p style={{fontSize:11,opacity:0.55}}>... et {g.list.length-3} de plus</p>}
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      )}

      {/* ── HISTORIQUE ────────────────────────────────────────────────────── */}
      {onglet==='hist' && (
        <div className="animate-fade-up">
          {historique.length===0 ? (
            <div className="glass-panel p-10 text-center text-slate-400">Aucun email envoyé pour l'instant.</div>
          ) : (
            <div className="glass-panel overflow-hidden">
              <div className="p-4 border-b border-white/8"><h3 className="font-bold text-sm">Historique des envois</h3></div>
              <table className="table-modern">
                <thead><tr><th>Date et heure</th><th>Destinataires</th><th style={{textAlign:'center'}}>Alertes</th><th style={{textAlign:'center'}}>Statut</th></tr></thead>
                <tbody>
                  {historique.map((h,i)=>(
                    <tr key={i}>
                      <td style={{fontSize:12}}>{new Date(h.date).toLocaleString('fr-FR')}</td>
                      <td style={{fontSize:12}}>{h.dest?.join(', ')}</td>
                      <td style={{textAlign:'center',fontWeight:700,color:'#F59E0B'}}>{h.nb}</td>
                      <td style={{textAlign:'center'}}>{h.ok?<span className="badge badge-green">✓ Envoyé</span>:<span className="badge badge-red">✗ Échec</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <div className="glass-panel p-4 border border-blue-500/15">
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2"><Settings size={13}/> Prérequis Supabase</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {[
            {n:'1',t:'Edge Function',d:'Déployer "send-alertes" (déjà fait ✓)'},
            {n:'2',t:'RESEND_API_KEY',d:'Supabase → Edge Functions → Secrets'},
            {n:'3',t:'EMAIL_DESTINATAIRE',d:'Adresse d\'expéditeur (optionnel)'},
          ].map(s=>(
            <div key={s.n} style={{background:p.bgCard2,borderRadius:10,padding:'10px 12px',display:'flex',gap:8}}>
              <div style={{width:22,height:22,background:'rgba(59,130,246,0.2)',border:'1px solid rgba(59,130,246,0.3)',borderRadius:'50%',display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,fontWeight:800,color:'#60A5FA',flexShrink:0}}>{s.n}</div>
              <div><p style={{fontSize:12,fontWeight:700,color:p.text1,marginBottom:2}}>{s.t}</p><p style={{fontSize:11,color:p.text4}}>{s.d}</p></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
