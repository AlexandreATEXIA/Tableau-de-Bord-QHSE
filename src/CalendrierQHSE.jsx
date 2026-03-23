import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from './supabaseClient';
import { useTheme } from './ThemeContext';
import {
  ChevronLeft, ChevronRight, Calendar, Target, GraduationCap,
  ClipboardList, ShieldAlert, BookOpen, X, AlertTriangle,
  CheckCircle, Clock, Filter
} from 'lucide-react';

/* ─── Config types d'événements ──────────────────────────────────────────── */
const TYPES = {
  action:       { label: 'Action PDCA',       color: '#4F63E7', bg: 'rgba(79,99,231,0.15)',   bgLight: '#EEF2FF', colorLight: '#3730A3', icon: Target },
  habilitation: { label: 'Habilitation',      color: '#F59E0B', bg: 'rgba(245,158,11,0.15)', bgLight: '#FFFBEB', colorLight: '#92400E', icon: GraduationCap },
  formation:    { label: 'Formation',         color: '#10B981', bg: 'rgba(16,185,129,0.15)', bgLight: '#ECFDF5', colorLight: '#065F46', icon: BookOpen },
  audit:        { label: 'Audit / NC',        color: '#8B5CF6', bg: 'rgba(139,92,246,0.15)', bgLight: '#F5F3FF', colorLight: '#5B21B6', icon: ClipboardList },
  risque:       { label: 'Risque DUERP',      color: '#EF4444', bg: 'rgba(239,68,68,0.15)',  bgLight: '#FEF2F2', colorLight: '#991B1B', icon: ShieldAlert },
};

const JOURS = ['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'];
const MOIS  = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];

function toYMD(d) {
  if (!d) return null;
  return d.slice(0, 10);
}

function addYears(dateStr, years) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  d.setFullYear(d.getFullYear() + Number(years || 1));
  return d.toISOString().slice(0, 10);
}

function urgence(dateStr) {
  if (!dateStr) return 'normal';
  const diff = (new Date(dateStr) - new Date()) / 86400000;
  if (diff < 0)  return 'retard';
  if (diff <= 7) return 'urgent';
  if (diff <= 30) return 'proche';
  return 'normal';
}

function UrgenceDot({ date }) {
  const u = urgence(date);
  const colors = { retard: '#EF4444', urgent: '#F59E0B', proche: '#3B82F6', normal: '#10B981' };
  return <span style={{ width:7, height:7, borderRadius:'50%', background: colors[u], display:'inline-block', flexShrink:0 }}/>;
}

/* ─── Modal détail jour ──────────────────────────────────────────────────── */
function ModalJour({ date, events, onClose, p, isDark }) {
  if (!date || !events.length) return null;
  const d = new Date(date + 'T12:00:00');
  const label = `${d.getDate()} ${MOIS[d.getMonth()]} ${d.getFullYear()}`;

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.55)', zIndex:9999, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}
         onClick={onClose}>
      <div style={{ background:p.bgSidebar, border:`1px solid ${p.border2}`, borderRadius:16, width:'100%', maxWidth:520, maxHeight:'80vh', display:'flex', flexDirection:'column', boxShadow:'0 24px 60px rgba(0,0,0,0.3)' }}
           onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div style={{ padding:'18px 20px', borderBottom:`1px solid ${p.border}`, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <div style={{ width:38, height:38, borderRadius:10, background:'var(--blue-l)', display:'flex', alignItems:'center', justifyContent:'center' }}>
              <Calendar size={18} style={{ color:'var(--blue)' }}/>
            </div>
            <div>
              <div style={{ fontSize:15, fontWeight:800, color:p.text1 }}>{label}</div>
              <div style={{ fontSize:12, color:p.text3 }}>{events.length} événement{events.length>1?'s':''}</div>
            </div>
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color:p.text3, padding:4 }}>
            <X size={18}/>
          </button>
        </div>
        {/* Liste */}
        <div style={{ overflowY:'auto', padding:'14px 20px', display:'flex', flexDirection:'column', gap:10 }}>
          {events.map((ev, i) => {
            const t = TYPES[ev.type] || TYPES.action;
            const Icon = t.icon;
            const u = urgence(ev.date);
            const urgColors = { retard:['#FEF2F2','#991B1B','#FECACA'], urgent:['#FFFBEB','#92400E','#FDE68A'], proche:['#EFF6FF','#1D4ED8','#BFDBFE'], normal:[isDark?'rgba(16,185,129,0.08)':'#ECFDF5', isDark?'#6EE7B7':'#065F46', isDark?'rgba(16,185,129,0.3)':'#A7F3D0'] };
            const [ubg, utxt, ubrd] = urgColors[u];
            return (
              <div key={i} style={{ background:isDark?p.bgCard2:p.bgCard2, border:`1px solid ${p.border}`, borderRadius:12, padding:'14px 16px', display:'flex', gap:12 }}>
                <div style={{ width:34, height:34, borderRadius:9, background:isDark?t.bg:t.bgLight, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                  <Icon size={16} style={{ color:isDark?t.color:t.colorLight }}/>
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:13, fontWeight:700, color:p.text1, marginBottom:3 }}>{ev.titre}</div>
                  {ev.sous && <div style={{ fontSize:12, color:p.text3, marginBottom:5 }}>{ev.sous}</div>}
                  <div style={{ display:'flex', gap:6, alignItems:'center', flexWrap:'wrap' }}>
                    <span style={{ fontSize:11, fontWeight:700, padding:'2px 8px', borderRadius:100, background:isDark?t.bg:t.bgLight, color:isDark?t.color:t.colorLight }}>
                      {t.label}
                    </span>
                    <span style={{ fontSize:11, fontWeight:700, padding:'2px 8px', borderRadius:100, background:ubg, color:utxt, border:`1px solid ${ubrd}` }}>
                      {u==='retard'?'En retard':u==='urgent'?'Cette semaine':u==='proche'?'Ce mois':' À venir'}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ─── Composant principal ────────────────────────────────────────────────── */
export default function CalendrierQHSE() {
  const { p, isDark } = useTheme();
  const [loading, setLoading]       = useState(true);
  const [events, setEvents]         = useState([]);
  const [today]                     = useState(() => new Date());
  const [current, setCurrent]       = useState({ year: today.getFullYear(), month: today.getMonth() });
  const [selectedDay, setSelectedDay] = useState(null);
  const [activeTypes, setActiveTypes] = useState(new Set(Object.keys(TYPES)));

  /* ── Chargement Supabase ── */
  useEffect(() => {
    async function load() {
      setLoading(true);
      const all = [];

      try {
        // Actions PDCA
        const { data: actions } = await supabase.from('plan_actions').select('titre,echeance,statut,priorite').not('echeance','is',null);
        (actions||[]).forEach(a => {
          if (a.echeance && a.statut !== 'Terminé') all.push({ type:'action', titre:a.titre||'Action sans titre', sous:`Priorité: ${a.priorite||'—'} • Statut: ${a.statut||'—'}`, date:toYMD(a.echeance) });
        });

        // Habilitations → date d'expiration
        const { data: habs } = await supabase.from('habilitations').select('employe,domaine,obtention,validiteAns');
        (habs||[]).forEach(h => {
          const exp = addYears(h.obtention, h.validiteAns || 2);
          if (exp) all.push({ type:'habilitation', titre:`Exp. habilitation — ${h.domaine||'Domaine'}`, sous:`Employé : ${h.employe||'—'}`, date:exp });
        });

        // Formations
        const { data: formations } = await supabase.from('rh_formations').select('titre,date_debut,date_fin,statut,organisme').not('date_debut','is',null);
        (formations||[]).forEach(f => {
          if (f.statut !== 'Annulée') {
            all.push({ type:'formation', titre:f.titre||'Formation', sous:`${f.organisme||'Organisme'} • ${f.statut||'—'}`, date:toYMD(f.date_debut) });
            if (f.date_fin && f.date_fin !== f.date_debut)
              all.push({ type:'formation', titre:`Fin — ${f.titre||'Formation'}`, sous:`${f.organisme||'Organisme'}`, date:toYMD(f.date_fin) });
          }
        });

        // Audits / NC
        const { data: audits } = await supabase.from('qualite_audits').select('titre,date,statut,type_audit');
        (audits||[]).forEach(a => {
          if (a.date) all.push({ type:'audit', titre:a.titre||'Audit', sous:`Type: ${a.type_audit||'—'} • ${a.statut||'—'}`, date:toYMD(a.date) });
        });

        // Risques DUERP avec échéance
        const { data: risques } = await supabase.from('registre_duerp').select('domaine,pilote,echeance').not('echeance','is',null);
        (risques||[]).forEach(r => {
          all.push({ type:'risque', titre:`Échéance risque — ${r.domaine||'Domaine'}`, sous:`Pilote: ${r.pilote||'—'}`, date:toYMD(r.echeance) });
        });

      } catch(e) { console.warn('Erreur chargement calendrier:', e); }

      setEvents(all.filter(e => e.date));
      setLoading(false);
    }
    load();
  }, []);

  /* ── Événements filtrés par type ── */
  const filteredEvents = useMemo(() =>
    events.filter(e => activeTypes.has(e.type)),
    [events, activeTypes]
  );

  /* ── Index date → événements ── */
  const eventsByDate = useMemo(() => {
    const map = {};
    filteredEvents.forEach(ev => {
      if (!map[ev.date]) map[ev.date] = [];
      map[ev.date].push(ev);
    });
    return map;
  }, [filteredEvents]);

  /* ── Construction du calendrier ── */
  const calDays = useMemo(() => {
    const { year, month } = current;
    const firstDay = new Date(year, month, 1);
    const lastDay  = new Date(year, month + 1, 0);
    // Lundi = 0
    let startDow = (firstDay.getDay() + 6) % 7;
    const days = [];
    // Jours avant
    for (let i = startDow - 1; i >= 0; i--) {
      const d = new Date(year, month, -i);
      days.push({ date: d.toISOString().slice(0,10), current: false });
    }
    // Jours du mois
    for (let d = 1; d <= lastDay.getDate(); d++) {
      const dt = new Date(year, month, d);
      days.push({ date: dt.toISOString().slice(0,10), current: true });
    }
    // Jours après (compléter 6 semaines = 42 jours)
    const remaining = 42 - days.length;
    for (let d = 1; d <= remaining; d++) {
      const dt = new Date(year, month + 1, d);
      days.push({ date: dt.toISOString().slice(0,10), current: false });
    }
    return days;
  }, [current]);

  /* ── Stats du mois ── */
  const statsMonth = useMemo(() => {
    const { year, month } = current;
    const prefix = `${year}-${String(month+1).padStart(2,'0')}`;
    const monthEvs = filteredEvents.filter(e => e.date.startsWith(prefix));
    const retard = filteredEvents.filter(e => urgence(e.date) === 'retard').length;
    const urgent = filteredEvents.filter(e => urgence(e.date) === 'urgent').length;
    return { total: monthEvs.length, retard, urgent };
  }, [filteredEvents, current]);

  const todayStr = today.toISOString().slice(0,10);

  function prevMonth() {
    setCurrent(c => {
      if (c.month === 0) return { year: c.year-1, month: 11 };
      return { ...c, month: c.month-1 };
    });
  }
  function nextMonth() {
    setCurrent(c => {
      if (c.month === 11) return { year: c.year+1, month: 0 };
      return { ...c, month: c.month+1 };
    });
  }
  function goToday() { setCurrent({ year: today.getFullYear(), month: today.getMonth() }); }

  function toggleType(type) {
    setActiveTypes(prev => {
      const next = new Set(prev);
      next.has(type) ? next.delete(type) : next.add(type);
      return next;
    });
  }

  const dayEventsSelected = selectedDay ? (eventsByDate[selectedDay] || []) : [];

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:18 }}>

      {/* ── Header ── */}
      <div className="page-header animate-fade-up">
        <div>
          <div className="page-title">📅 Calendrier QHSE</div>
          <div className="page-subtitle">Toutes vos échéances centralisées — actions, habilitations, formations, audits</div>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          {statsMonth.retard > 0 && (
            <div style={{ display:'flex', alignItems:'center', gap:6, background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.3)', borderRadius:10, padding:'8px 14px' }}>
              <AlertTriangle size={14} style={{ color:'#EF4444' }}/>
              <span style={{ fontSize:13, fontWeight:700, color:'#EF4444' }}>{statsMonth.retard} en retard</span>
            </div>
          )}
          {statsMonth.urgent > 0 && (
            <div style={{ display:'flex', alignItems:'center', gap:6, background:'rgba(245,158,11,0.1)', border:'1px solid rgba(245,158,11,0.3)', borderRadius:10, padding:'8px 14px' }}>
              <Clock size={14} style={{ color:'#F59E0B' }}/>
              <span style={{ fontSize:13, fontWeight:700, color:'#F59E0B' }}>{statsMonth.urgent} cette semaine</span>
            </div>
          )}
          {statsMonth.retard === 0 && statsMonth.urgent === 0 && (
            <div style={{ display:'flex', alignItems:'center', gap:6, background:'rgba(16,185,129,0.1)', border:'1px solid rgba(16,185,129,0.3)', borderRadius:10, padding:'8px 14px' }}>
              <CheckCircle size={14} style={{ color:'#10B981' }}/>
              <span style={{ fontSize:13, fontWeight:700, color:'#10B981' }}>Tout est à jour</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Filtres types ── */}
      <div className="glass-panel animate-fade-up-1" style={{ padding:'14px 18px', display:'flex', alignItems:'center', gap:10, flexWrap:'wrap' }}>
        <div style={{ display:'flex', alignItems:'center', gap:6, marginRight:6 }}>
          <Filter size={14} style={{ color:p.text3 }}/>
          <span style={{ fontSize:12, fontWeight:700, color:p.text3, textTransform:'uppercase', letterSpacing:'0.06em' }}>Filtres</span>
        </div>
        {Object.entries(TYPES).map(([key, t]) => {
          const active = activeTypes.has(key);
          const Icon = t.icon;
          const count = filteredEvents.filter(e => e.type === key).length;
          return (
            <button key={key} onClick={() => toggleType(key)} style={{
              display:'flex', alignItems:'center', gap:6, padding:'6px 12px',
              borderRadius:100, border:`1.5px solid ${active ? (isDark?t.color:t.colorLight) : p.border}`,
              background: active ? (isDark?t.bg:t.bgLight) : 'transparent',
              cursor:'pointer', transition:'all 0.15s', color: active ? (isDark?t.color:t.colorLight) : p.text3,
              fontSize:12, fontWeight:600,
            }}>
              <Icon size={12}/>
              {t.label}
              {count > 0 && <span style={{ background: active?(isDark?t.color:t.colorLight):'transparent', color: active?'white':(isDark?t.color:t.colorLight), borderRadius:100, padding:'0 5px', fontSize:10, fontWeight:800, minWidth:16, textAlign:'center', border: active?'none':`1px solid ${isDark?t.color:t.colorLight}` }}>{count}</span>}
            </button>
          );
        })}
        <button onClick={() => setActiveTypes(new Set(Object.keys(TYPES)))} style={{ marginLeft:'auto', fontSize:11, color:p.text3, background:'none', border:'none', cursor:'pointer', fontFamily:'var(--font)', textDecoration:'underline' }}>
          Tout afficher
        </button>
      </div>

      {/* ── Calendrier + Légende ── */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 280px', gap:18, alignItems:'start' }}>

        {/* Calendrier */}
        <div className="glass-panel animate-fade-up-2" style={{ overflow:'hidden' }}>

          {/* Navigation mois */}
          <div style={{ padding:'16px 20px', borderBottom:`1px solid ${p.border}`, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <button onClick={prevMonth} style={{ width:34, height:34, borderRadius:9, border:`1px solid ${p.border}`, background:p.bgCard2, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:p.text2 }}>
              <ChevronLeft size={16}/>
            </button>
            <div style={{ textAlign:'center' }}>
              <div style={{ fontSize:18, fontWeight:800, color:p.text1 }}>{MOIS[current.month]} {current.year}</div>
              <div style={{ fontSize:12, color:p.text3 }}>{statsMonth.total} événement{statsMonth.total!==1?'s':''} ce mois</div>
            </div>
            <div style={{ display:'flex', gap:6 }}>
              <button onClick={goToday} style={{ height:34, padding:'0 12px', borderRadius:9, border:`1px solid ${p.border}`, background:p.bgCard2, cursor:'pointer', fontSize:12, fontWeight:600, color:p.text2, fontFamily:'var(--font)' }}>
                Aujourd'hui
              </button>
              <button onClick={nextMonth} style={{ width:34, height:34, borderRadius:9, border:`1px solid ${p.border}`, background:p.bgCard2, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:p.text2 }}>
                <ChevronRight size={16}/>
              </button>
            </div>
          </div>

          {/* En-têtes jours */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(7, 1fr)', borderBottom:`1px solid ${p.border}` }}>
            {JOURS.map(j => (
              <div key={j} style={{ padding:'10px 4px', textAlign:'center', fontSize:11, fontWeight:700, color:p.text3, textTransform:'uppercase', letterSpacing:'0.08em' }}>{j}</div>
            ))}
          </div>

          {/* Grille jours */}
          {loading ? (
            <div style={{ padding:60, textAlign:'center', color:p.text3 }}>Chargement…</div>
          ) : (
            <div style={{ display:'grid', gridTemplateColumns:'repeat(7, 1fr)' }}>
              {calDays.map((day, idx) => {
                const evs = eventsByDate[day.date] || [];
                const isToday = day.date === todayStr;
                const isSelected = day.date === selectedDay;
                const hasRetard = evs.some(e => urgence(e.date) === 'retard');
                const hasUrgent = evs.some(e => urgence(e.date) === 'urgent');
                const dayNum = parseInt(day.date.split('-')[2]);
                const isWeekend = idx % 7 >= 5;

                return (
                  <div key={day.date}
                    onClick={() => evs.length ? setSelectedDay(day.date === selectedDay ? null : day.date) : null}
                    style={{
                      minHeight: 82,
                      padding: '8px 6px',
                      borderRight: `1px solid ${p.border}`,
                      borderBottom: `1px solid ${p.border}`,
                      background: isSelected
                        ? (isDark?'rgba(79,99,231,0.12)':'#EEF2FF')
                        : isToday
                          ? (isDark?'rgba(79,99,231,0.06)':'#F5F7FF')
                          : isWeekend
                            ? (isDark?'rgba(0,0,0,0.15)':'#F8FAFC')
                            : 'transparent',
                      cursor: evs.length ? 'pointer' : 'default',
                      transition: 'background 0.1s',
                      position: 'relative',
                    }}
                  >
                    {/* Numéro du jour */}
                    <div style={{
                      width: 26, height: 26, borderRadius: '50%', display: 'flex',
                      alignItems: 'center', justifyContent: 'center', marginBottom: 4,
                      background: isToday ? 'var(--blue)' : 'transparent',
                      fontSize: 13, fontWeight: isToday ? 800 : day.current ? 600 : 400,
                      color: isToday ? 'white' : day.current ? p.text1 : p.text4,
                    }}>
                      {dayNum}
                    </div>

                    {/* Points d'événements */}
                    {evs.length > 0 && (
                      <div style={{ display:'flex', flexDirection:'column', gap:2, marginTop:2 }}>
                        {evs.slice(0, 3).map((ev, i) => {
                          const t = TYPES[ev.type] || TYPES.action;
                          const u = urgence(ev.date);
                          const dotColor = u==='retard'?'#EF4444':u==='urgent'?'#F59E0B':isDark?t.color:t.colorLight;
                          return (
                            <div key={i} style={{
                              display:'flex', alignItems:'center', gap:4,
                              background: isDark ? `${t.bg}` : t.bgLight,
                              borderRadius:4, padding:'2px 5px',
                              border: u==='retard'?'1px solid rgba(239,68,68,0.4)': u==='urgent'?'1px solid rgba(245,158,11,0.3)':'1px solid transparent',
                            }}>
                              <span style={{ width:5, height:5, borderRadius:'50%', background:dotColor, flexShrink:0 }}/>
                              <span style={{ fontSize:10, fontWeight:600, color:isDark?t.color:t.colorLight, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:60 }}>
                                {ev.titre.split('—')[0].trim().substring(0,18)}
                              </span>
                            </div>
                          );
                        })}
                        {evs.length > 3 && (
                          <div style={{ fontSize:10, color:p.text3, fontWeight:600, paddingLeft:4 }}>+{evs.length-3} autre{evs.length-3>1?'s':''}</div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Panneau latéral */}
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>

          {/* Prochaines échéances */}
          <div className="glass-panel animate-fade-up-3" style={{ padding:'16px 18px' }}>
            <div style={{ fontSize:13, fontWeight:700, color:p.text1, marginBottom:12, display:'flex', alignItems:'center', gap:7 }}>
              <Clock size={14} style={{ color:'var(--amber)' }}/>
              Prochaines échéances
            </div>
            {loading ? (
              <div style={{ color:p.text3, fontSize:12 }}>Chargement…</div>
            ) : (() => {
              const upcoming = filteredEvents
                .filter(e => {
                  const diff = (new Date(e.date) - new Date()) / 86400000;
                  return diff >= -1 && diff <= 60;
                })
                .sort((a,b) => a.date.localeCompare(b.date))
                .slice(0, 8);
              if (!upcoming.length) return <div style={{ fontSize:12, color:p.text3, textAlign:'center', padding:'12px 0' }}>Aucune échéance dans les 60 jours</div>;
              return upcoming.map((ev, i) => {
                const t = TYPES[ev.type] || TYPES.action;
                const Icon = t.icon;
                const u = urgence(ev.date);
                const diff = Math.ceil((new Date(ev.date) - new Date()) / 86400000);
                const diffLabel = diff < 0 ? `${-diff}j de retard` : diff === 0 ? "Aujourd'hui" : `Dans ${diff}j`;
                const diffColor = u==='retard'?'#EF4444':u==='urgent'?'#F59E0B':u==='proche'?'var(--blue)':p.text3;
                return (
                  <div key={i} onClick={() => setCurrent({ year: parseInt(ev.date.slice(0,4)), month: parseInt(ev.date.slice(5,7))-1 })} style={{
                    display:'flex', gap:10, alignItems:'flex-start', padding:'10px 0',
                    borderBottom: i < upcoming.length-1 ? `1px solid ${p.border}` : 'none',
                    cursor:'pointer',
                  }}>
                    <div style={{ width:28, height:28, borderRadius:8, background:isDark?t.bg:t.bgLight, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, marginTop:1 }}>
                      <Icon size={13} style={{ color:isDark?t.color:t.colorLight }}/>
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:12, fontWeight:600, color:p.text1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{ev.titre}</div>
                      <div style={{ fontSize:11, fontWeight:700, color:diffColor, marginTop:2 }}>{diffLabel}</div>
                    </div>
                  </div>
                );
              });
            })()}
          </div>

          {/* Légende */}
          <div className="glass-panel animate-fade-up-4" style={{ padding:'16px 18px' }}>
            <div style={{ fontSize:13, fontWeight:700, color:p.text1, marginBottom:12 }}>Légende</div>
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {[
                { color:'#EF4444', label:'En retard', dot:true },
                { color:'#F59E0B', label:'Cette semaine (≤7j)', dot:true },
                { color:'#3B82F6', label:'Ce mois (≤30j)', dot:true },
                { color:'#10B981', label:'À venir', dot:true },
              ].map((item, i) => (
                <div key={i} style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <span style={{ width:10, height:10, borderRadius:'50%', background:item.color, flexShrink:0 }}/>
                  <span style={{ fontSize:12, color:p.text2 }}>{item.label}</span>
                </div>
              ))}
            </div>
            <div style={{ borderTop:`1px solid ${p.border}`, marginTop:12, paddingTop:12 }}>
              <div style={{ fontSize:11, color:p.text3, lineHeight:1.5 }}>
                Cliquez sur un jour pour voir le détail des événements.
              </div>
            </div>
          </div>

          {/* Résumé stats */}
          <div className="glass-panel animate-fade-up-5" style={{ padding:'16px 18px' }}>
            <div style={{ fontSize:13, fontWeight:700, color:p.text1, marginBottom:12 }}>Total événements</div>
            <div style={{ display:'flex', flexDirection:'column', gap:7 }}>
              {Object.entries(TYPES).map(([key, t]) => {
                const count = events.filter(e => e.type === key).length;
                const Icon = t.icon;
                return (
                  <div key={key} style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <Icon size={13} style={{ color:isDark?t.color:t.colorLight, flexShrink:0 }}/>
                    <span style={{ fontSize:12, color:p.text2, flex:1 }}>{t.label}</span>
                    <span style={{ fontSize:12, fontWeight:800, color:isDark?t.color:t.colorLight }}>{count}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Modal détail */}
      {selectedDay && dayEventsSelected.length > 0 && (
        <ModalJour
          date={selectedDay}
          events={dayEventsSelected}
          onClose={() => setSelectedDay(null)}
          p={p}
          isDark={isDark}
        />
      )}
    </div>
  );
}
