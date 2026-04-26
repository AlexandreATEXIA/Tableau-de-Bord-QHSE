/* eslint-disable react-refresh/only-export-components --
   * Cette règle ne tolère que des exports de composants dans un .jsx, mais
   * ce fichier exporte aussi des constantes, hooks ou contextes utilisés
   * ailleurs dans l'app. Splitter en fichier .js séparé n'apporterait pas
   * de bénéfice pratique (HMR fonctionne, la valeur est statique). */
import { useTheme } from './ThemeContext';
import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Trash2, GraduationCap, AlertTriangle, UserCheck, RefreshCw, Filter, X, Save, Users, Clock } from 'lucide-react';
import { supabase } from './supabaseClient';
import { InputEmploye } from './EmployesContext';
import GestionListes from './GestionListes';
import { calcExpiration, diffJours } from './utils/kpi';
import { logAction } from './auditLog';
import { useListe } from './utils/useListe';
import { WriteOnly } from './WriteGuard';

// Identifiants de persistance des listes éditables — alignés sur la convention
// utilisée par GestionListes (clé localStorage `gl_${STORAGE_KEY}`). L'export
// permettra à ImportExcel de fusionner automatiquement les nouvelles valeurs
// rencontrées dans un fichier .xlsx sans casser le référentiel existant.
export const LISTES_HABILITATIONS = {
  STORAGE_KEY: 'habilitations',
  HABILITATIONS: 'Habilitations',
};

const LISTE_HABILITATIONS_DEFAULT = [
  'SST (Sauveteur Secouriste du Travail)', 'ATEX - NV0', 'ATEX - NV1', 'ATEX - NV2',
  'CACES R486 (PEMP / Nacelles)', 'CACES R489 (Chariots de manutention)',
  'CACES R482 (Engins de chantier)', 'Électrique - B0/H0 (Non électricien)',
  'Électrique - BS/BE/Manœuvre', 'Électrique - B1V/B2V/BR/BC (BT)',
  'Travail en hauteur / Harnais', 'Espaces Confinés (CATEC)',
  'AIPR (Proximité réseaux)', 'Incendie - EPI / ESI',
  'Risque Chimique N1', 'Risque Chimique N2', 'Risque Amiante SS4',
  'Gestes et Postures / PRAP', 'Habilitation routière (permis B)', 'Autre'
];

const VALIDITES = [1, 2, 3, 4, 5, 10];

// Les fonctions locales calcExp et diffJours ont été remplacées par `calcExpiration`
// et `diffJours` importées depuis utils/kpi.js (source unique, gestion null cohérente).

function getStatut(obtention, validiteAns) {
  if (!obtention) return { label: 'À définir', color: '#64748B', badge: 'badge-blue', j: null };
  const exp = calcExpiration(obtention, validiteAns);
  // exp === null : validiteAns manquante/invalide — on NE DOIT PAS tomber dans les
  // branches `j <= 30` ou `j <= 90` car `null <= N` coerce à `0 <= N === true` et
  // classerait à tort l'habilitation comme "< 30 jours" (alerte ambre faussée).
  if (exp === null) return { label: 'À définir', color: '#64748B', badge: 'badge-blue', j: null };
  const j = diffJours(exp);
  if (j === null)   return { label: 'À définir', color: '#64748B', badge: 'badge-blue', j: null };
  if (j < 0)   return { label: 'Périmée',    color: '#EF4444', badge: 'badge-red',   j };
  if (j <= 30) return { label: '< 30 jours', color: '#F59E0B', badge: 'badge-amber', j };
  if (j <= 90) return { label: '< 90 jours', color: '#3B82F6', badge: 'badge-blue',  j };
  return          { label: 'Valide',         color: '#10B981', badge: 'badge-green', j };
}

export default function Habilitations() {
  const { p } = useTheme();
  const [habs, setHabs]         = useState([]);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [filtreStatut, setFS]   = useState('Tous');
  const [filtreEmploye, setFE]  = useState('Tous');
  const [vueEmploye, setVE]     = useState(false);
  const [listeHabs, setListeHabs] = useListe(
    LISTES_HABILITATIONS.STORAGE_KEY, LISTES_HABILITATIONS.HABILITATIONS, LISTE_HABILITATIONS_DEFAULT
  );
  const [form, setForm]         = useState({
    employe: '', domaine: listeHabs[0],
    obtention: new Date().toISOString().split('T')[0], validiteAns: 2,
  });

  useEffect(() => { fetchHabs(); }, []);

  async function fetchHabs() {
    setLoading(true);
    const { data } = await supabase.from('habilitations').select('*').order('employe');
    if (data) setHabs(data);
    setLoading(false);
  };

  const updateRow = (id, field, value) =>
    setHabs(prev => prev.map(r => r.id === id ? {...r, [field]: value} : r));

  const saveRow = async (row) => {
    if (!row) return;
    setSaving(row.id);
    await supabase.from('habilitations').update(row).eq('id', row.id);
    try { await logAction('habilitations', row.id, 'UPDATE', { employe: row.employe, domaine: row.domaine }); } catch { /* silencieux : non bloquant */ }
    setSaving(null);
  };

  const ajouterHab = async () => {
    if (!form.employe.trim()) return;
    const { data } = await supabase.from('habilitations').insert([form]).select();
    if (data) {
      try { await logAction('habilitations', data[0]?.id, 'CREATE', { employe: form.employe, domaine: form.domaine }); } catch { /* silencieux : non bloquant */ }
      setHabs(prev => [...prev, data[0]].sort((a,b) => (a.employe||'').localeCompare(b.employe||'')));
      setShowForm(false);
    }
  };

  const deleteRow = async (id) => {
    await supabase.from('habilitations').delete().eq('id', id);
    try { await logAction('habilitations', id, 'DELETE', {}); } catch { /* silencieux : non bloquant */ }
    setHabs(prev => prev.filter(r => r.id !== id));
  };

  const kpis = useMemo(() => {
    // Chaque filtre tolère les habilitations mal-saisies (validité nulle/invalide,
    // date absente) en les excluant de tous les compteurs plutôt que de les
    // compter faussement comme "périmées" ou "< 30j".
    const perimees  = habs.filter(h => {
      const e = calcExpiration(h.obtention, h.validiteAns);
      if (e === null) return false;
      const j = diffJours(e);
      return j !== null && j < 0;
    });
    const bientot30 = habs.filter(h => {
      const e = calcExpiration(h.obtention, h.validiteAns);
      if (e === null) return false;
      const j = diffJours(e);
      return j !== null && j >= 0 && j <= 30;
    });
    const bientot90 = habs.filter(h => {
      const e = calcExpiration(h.obtention, h.validiteAns);
      if (e === null) return false;
      const j = diffJours(e);
      return j !== null && j > 30 && j <= 90;
    });
    const valides   = habs.filter(h => {
      const e = calcExpiration(h.obtention, h.validiteAns);
      if (e === null) return false;
      const j = diffJours(e);
      return j !== null && j > 90;
    });
    const employes  = [...new Set(habs.map(h => h.employe).filter(Boolean))];
    return { total: habs.length, perimees: perimees.length, bientot30: bientot30.length, bientot90: bientot90.length, valides: valides.length, employes: employes.length, taux: habs.length > 0 ? Math.round((valides.length / habs.length) * 100) : 100 };
  }, [habs]);

  const employes = useMemo(() => ['Tous', ...[...new Set(habs.map(h => h.employe).filter(Boolean))].sort()], [habs]);

  const habsFiltrees = useMemo(() => habs.filter(h => {
    if (filtreEmploye !== 'Tous' && h.employe !== filtreEmploye) return false;
    if (filtreStatut !== 'Tous') {
      const st = getStatut(h.obtention, h.validiteAns);
      if (filtreStatut === 'Périmées'   && st.label !== 'Périmée')     return false;
      if (filtreStatut === '< 30 jours' && st.label !== '< 30 jours')  return false;
      if (filtreStatut === 'Valides'    && !['Valide','< 90 jours'].includes(st.label)) return false;
    }
    return true;
  }), [habs, filtreEmploye, filtreStatut]);

  const habsParEmploye = useMemo(() => {
    const map = {};
    habsFiltrees.forEach(h => { if (!map[h.employe]) map[h.employe] = []; map[h.employe].push(h); });
    return map;
  }, [habsFiltrees]);

  return (
    <div className="space-y-5 pb-10">

      <header className="page-header">
        <div>
          <h2 className="page-title flex items-center gap-3"><GraduationCap size={26} className="text-blue-400"/> Habilitations & Compétences</h2>
          <p className="page-subtitle">Matrice de polyvalence — suivi des renouvellements en temps réel</p>
        </div>
        <div className="flex gap-3">
          <button onClick={() => setVE(!vueEmploye)} className="btn-secondary" style={vueEmploye ? { borderColor: 'rgba(59,130,246,0.4)', color: '#60A5FA' } : {}}>
            <Users size={16}/> {vueEmploye ? 'Vue liste' : 'Vue par employé'}
          </button>
          <GestionListes
            listes={{ 'Habilitations': listeHabs }}
            onSave={(key, list) => setListeHabs(list)}
            storageKey="habilitations"
          />
          <button onClick={fetchHabs} className="btn-secondary"><RefreshCw size={16} className={loading ? 'animate-spin' : ''}/> Actualiser</button>
          <WriteOnly><button onClick={() => setShowForm(true)} className="btn-primary"><Plus size={16}/> Délivrer une habilitation</button></WriteOnly>
        </div>
      </header>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: 'Total',      val: kpis.total,     color: 'blue',  sub: `${kpis.employes} employés` },
          { label: 'Valides',    val: kpis.valides,   color: 'green', sub: `Taux : ${kpis.taux}%` },
          { label: 'Périmées',   val: kpis.perimees,  color: kpis.perimees > 0 ? 'red' : 'green',   sub: 'Urgent' },
          { label: '< 30 jours', val: kpis.bientot30, color: kpis.bientot30 > 0 ? 'amber' : 'green', sub: 'À planifier' },
          { label: '< 90 jours', val: kpis.bientot90, color: 'blue',  sub: 'À anticiper' },
        ].map((k, i) => (
          <div key={i} className={`kpi-card ${k.color}`}>
            <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-2">{k.label}</p>
            <p className="text-3xl font-black text-white">{k.val}</p>
            {k.label === 'Valides' && <div style={{ height:3, background:p.whiteFaint, borderRadius:2, margin:'8px 0 4px' }}><div style={{ height:'100%', width:`${kpis.taux}%`, background:'#10B981', borderRadius:2 }}/></div>}
            <p className="text-xs text-slate-500 mt-2">{k.sub}</p>
          </div>
        ))}
      </div>

      {/* Alertes */}
      {kpis.perimees > 0 && (
        <div className="alert-banner alert-red">
          <AlertTriangle size={18} className="shrink-0"/>
          <div>
            <p className="font-bold">{kpis.perimees} habilitation{kpis.perimees > 1 ? 's' : ''} périmée{kpis.perimees > 1 ? 's' : ''} — Renouvellement obligatoire</p>
            <p className="text-xs mt-0.5 opacity-80">{habs.filter(h => {
              const e = calcExpiration(h.obtention, h.validiteAns);
              if (e === null) return false;
              const j = diffJours(e);
              return j !== null && j < 0;
            }).map(h => `${h.employe} (${h.domaine?.substring(0,20)})`).join(' · ')}</p>
          </div>
        </div>
      )}
      {kpis.bientot30 > 0 && (
        <div className="alert-banner alert-amber">
          <Clock size={18} className="shrink-0"/>
          <p className="font-bold">{kpis.bientot30} habilitation{kpis.bientot30 > 1 ? 's' : ''} à renouveler dans moins de 30 jours</p>
        </div>
      )}

      {/* Formulaire */}
      {showForm && (
        <div className="glass-panel p-6 border border-blue-500/20 animate-fade-up">
          <div className="flex justify-between items-center mb-5">
            <h3 className="text-white font-bold text-lg">Nouvelle habilitation</h3>
            <button onClick={() => setShowForm(false)} className="text-slate-500 hover:text-white p-1"><X size={18}/></button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-slate-400 text-xs font-bold uppercase tracking-wider block mb-1">Employé *</label>
              <InputEmploye value={form.employe} onChange={e => setForm({...form, employe: e.target.value})} placeholder="Nom et Prénom..."/>
            </div>
            <div>
              <label className="text-slate-400 text-xs font-bold uppercase tracking-wider block mb-1">Domaine *</label>
              <select value={form.domaine} onChange={e => setForm({...form, domaine: e.target.value})} className="input-modern">
                {listeHabs.map(h => <option key={h} value={h}>{h}</option>)}
              </select>
            </div>
            <div>
              <label className="text-slate-400 text-xs font-bold uppercase tracking-wider block mb-1">Date d'obtention</label>
              <input type="date" value={form.obtention} onChange={e => setForm({...form, obtention: e.target.value})} className="input-modern"/>
            </div>
            <div>
              <label className="text-slate-400 text-xs font-bold uppercase tracking-wider block mb-1">Validité</label>
              <div className="flex gap-2">
                {VALIDITES.map(v => (
                  <button key={v} onClick={() => setForm({...form, validiteAns: v})}
                    style={{ flex:1, padding:'8px 4px', borderRadius:8, border:'1px solid', cursor:'pointer', fontSize:12, fontWeight:700, transition:'all 0.15s',
                      background: form.validiteAns === v ? 'rgba(59,130,246,0.2)' : p.whiteFaint2,
                      borderColor: form.validiteAns === v ? 'rgba(59,130,246,0.4)' : p.border,
                      color: form.validiteAns === v ? '#60A5FA' : p.text3 }}>
                    {v}an{v > 1 ? 's' : ''}
                  </button>
                ))}
              </div>
            </div>
          </div>
          {form.obtention && (
            <div style={{ marginTop:12, padding:'10px 14px', background:p.whiteFaint2, borderRadius:8, fontSize:13 }}>
              <span className="text-slate-400">Expiration : </span>
              <strong style={{ color: getStatut(form.obtention, form.validiteAns).color }}>{calcExpiration(form.obtention, form.validiteAns)?.toLocaleDateString('fr-FR') || '—'}</strong>
              <span className={`badge ${getStatut(form.obtention, form.validiteAns).badge} ml-3`}>{getStatut(form.obtention, form.validiteAns).label}</span>
            </div>
          )}
          <div className="flex gap-3 mt-5">
            <button onClick={() => setShowForm(false)} className="btn-secondary">Annuler</button>
            <button onClick={ajouterHab} disabled={!form.employe.trim()} className="btn-primary"><Save size={16}/> Enregistrer</button>
          </div>
        </div>
      )}

      {/* Filtres */}
      <div className="glass-panel p-4 flex flex-wrap gap-3 items-center">
        <Filter size={15} className="text-slate-400 shrink-0"/>
        <select value={filtreEmploye} onChange={e => setFE(e.target.value)} className="input-modern" style={{ width:'auto', padding:'5px 12px', fontSize:12 }}>
          {employes.map(e => <option key={e} value={e}>{e}</option>)}
        </select>
        <div className="w-px h-4 bg-white/10"/>
        {['Tous','Périmées','< 30 jours','Valides'].map(s => {
          const c = s === 'Périmées' ? '#EF4444' : s === '< 30 jours' ? '#F59E0B' : s === 'Valides' ? '#10B981' : '#3B82F6';
          return <button key={s} onClick={() => setFS(s)} style={{ fontSize:11, fontWeight:600, padding:'4px 12px', borderRadius:100, border:'1px solid', cursor:'pointer', transition:'all 0.12s',
            background: filtreStatut === s ? `${c}20` : p.whiteFaint2,
            borderColor: filtreStatut === s ? `${c}50` : p.border,
            color: filtreStatut === s ? c : p.text3 }}>{s}</button>;
        })}
        {(filtreEmploye !== 'Tous' || filtreStatut !== 'Tous') && (
          <button onClick={() => { setFE('Tous'); setFS('Tous'); }} className="text-slate-500 hover:text-white text-xs flex items-center gap-1 ml-auto"><X size={12}/> Reset</button>
        )}
        <span className="text-slate-500 text-xs ml-auto">{habsFiltrees.length} ligne{habsFiltrees.length > 1 ? 's' : ''}</span>
      </div>

      {/* Vue par employé */}
      {vueEmploye ? (
        <div className="space-y-4">
          {Object.keys(habsParEmploye).sort().map(emp => {
            const liste = habsParEmploye[emp];
            const np = liste.filter(h => getStatut(h.obtention, h.validiteAns).label === 'Périmée').length;
            const n30 = liste.filter(h => getStatut(h.obtention, h.validiteAns).label === '< 30 jours').length;
            return (
              <div key={emp} className="glass-panel" style={np > 0 ? { borderLeft:'3px solid #EF4444' } : n30 > 0 ? { borderLeft:'3px solid #F59E0B' } : { borderLeft:'3px solid #10B981' }}>
                <div className="flex items-center justify-between p-4 border-b border-white/8">
                  <div className="flex items-center gap-3">
                    <div style={{ width:38, height:38, background:'linear-gradient(135deg,#3B82F6,#06B6D4)', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, fontWeight:800, color:'white' }}>{emp.charAt(0).toUpperCase()}</div>
                    <div><p className="text-white font-bold">{emp}</p><p className="text-slate-400 text-xs">{liste.length} habilitation{liste.length > 1 ? 's' : ''}</p></div>
                  </div>
                  <div className="flex gap-2">
                    {np > 0 && <span className="badge badge-red">{np} périmée{np > 1 ? 's' : ''}</span>}
                    {n30 > 0 && <span className="badge badge-amber">{n30} bientôt</span>}
                  </div>
                </div>
                {liste.map(h => {
                  const st = getStatut(h.obtention, h.validiteAns);
                  const exp = calcExpiration(h.obtention, h.validiteAns);
                  return (
                    <div key={h.id} className="flex items-center justify-between px-4 py-3 border-b border-white/4 last:border-0 hover:bg-white/2">
                      <div>
                        <p className="text-white text-sm font-medium">{h.domaine}</p>
                        <p className="text-slate-500 text-xs mt-0.5">Obtenu le {h.obtention || '—'} · {h.validiteAns}an{h.validiteAns > 1 ? 's' : ''} · Expire le {exp?.toLocaleDateString('fr-FR') || '—'}</p>
                      </div>
                      <span className={`badge ${st.badge}`}>{st.label}{st.j !== null && st.j >= 0 ? ` · ${st.j}j` : ''}</span>
                    </div>
                  );
                })}
              </div>
            );
          })}
          {Object.keys(habsParEmploye).length === 0 && <div className="glass-panel p-10 text-center text-slate-400">Aucune habilitation pour ces filtres.</div>}
        </div>
      ) : (
        /* Vue liste */
        <div className="glass-panel">
          {loading ? (
            <div className="p-10 text-center"><RefreshCw size={28} className="animate-spin text-blue-400 mx-auto mb-3"/><p className="text-slate-400">Chargement...</p></div>
          ) : habsFiltrees.length === 0 ? (
            <div className="p-10 text-center"><UserCheck size={36} className="text-emerald-400 mx-auto mb-3"/><p className="text-white font-bold">{habs.length === 0 ? 'Aucune habilitation. Cliquez sur "Délivrer une habilitation".' : 'Aucun résultat pour ces filtres.'}</p></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="table-modern">
                <thead><tr><th>Employé</th><th>Domaine</th><th style={{width:120,textAlign:'center'}}>Obtention</th><th style={{width:160,textAlign:'center'}}>Validité</th><th style={{width:120,textAlign:'center'}}>Expiration</th><th style={{width:140,textAlign:'center'}}>Statut</th><th style={{width:50}}></th></tr></thead>
                <tbody>
                  {habsFiltrees.map(row => {
                    const st = getStatut(row.obtention, row.validiteAns);
                    const exp = calcExpiration(row.obtention, row.validiteAns);
                    return (
                      <tr key={row.id} style={st.label === 'Périmée' ? { borderLeft:'3px solid #EF4444' } : st.label === '< 30 jours' ? { borderLeft:'3px solid #F59E0B' } : {}}>
                        <td><InputEmploye value={row.employe||''} onChange={e => updateRow(row.id,'employe',e.target.value)} onBlur={() => saveRow(habs.find(h => h.id===row.id))} style={{padding:'5px 8px',fontSize:13}}/></td>
                        <td><select value={row.domaine||listeHabs[0]} onChange={e => updateRow(row.id,'domaine',e.target.value)} onBlur={() => saveRow(habs.find(h => h.id===row.id))} className="input-modern" style={{padding:'5px 8px',fontSize:12}}>{listeHabs.map(h => <option key={h} value={h}>{h}</option>)}</select></td>
                        <td><input type="date" value={row.obtention||''} onChange={e => updateRow(row.id,'obtention',e.target.value)} onBlur={() => saveRow(habs.find(h => h.id===row.id))} className="input-modern" style={{padding:'5px 8px',fontSize:12}}/></td>
                        <td>
                          <div className="flex justify-center gap-1">
                            {VALIDITES.map(v => (
                              <button key={v} onClick={() => { updateRow(row.id,'validiteAns',v); setTimeout(() => saveRow({...row, validiteAns:v}), 0); }}
                                style={{ width:28, height:28, borderRadius:6, border:'1px solid', cursor:'pointer', fontSize:10, fontWeight:700, transition:'all 0.12s',
                                  background: Number(row.validiteAns)===v ? 'rgba(59,130,246,0.2)' : p.whiteFaint2,
                                  borderColor: Number(row.validiteAns)===v ? 'rgba(59,130,246,0.4)' : p.border,
                                  color: Number(row.validiteAns)===v ? '#60A5FA' : p.text3 }}>{v}</button>
                            ))}
                          </div>
                        </td>
                        <td className="text-center"><span style={{fontSize:12,fontWeight:600,color:st.color}}>{exp?.toLocaleDateString('fr-FR')||'—'}</span></td>
                        <td className="text-center"><span className={`badge ${st.badge}`}>{st.label}{st.j!==null&&st.j>=0?` · ${st.j}j`:''}</span></td>
                        <td className="text-center">{saving===row.id ? <RefreshCw size={13} className="animate-spin text-blue-400 mx-auto"/> : <WriteOnly><button onClick={() => deleteRow(row.id)} className="text-slate-600 hover:text-red-400 p-1.5 rounded"><Trash2 size={14}/></button></WriteOnly>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}