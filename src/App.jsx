import React, { useState } from 'react';
import { useTheme, ThemeToggleBtn } from './ThemeContext';
import {
  LayoutDashboard, ShieldAlert, CheckCircle, Leaf, Users,
  FileText, HeartPulse, FileDown, Mail, BarChart2,
  ChevronRight, Target, Calendar, Settings, FileSpreadsheet, BookOpen,
  PieChart, ClipboardList
} from 'lucide-react';

import DashboardComex       from './DashboardComex';
import RegistreDUERP        from './RegistreDUERP';
import SecuriteAccidents    from './SecuriteAccidents';
import PlanActions          from './PlanActions';
import QualiteAudits        from './QualiteAudits';
import Environnement        from './Environnement';
import SocialRH             from './SocialRH';
import RapportPDF           from './RapportPDF';
import NotificationsEmail   from './NotificationsEmail';
import KPIsSecurite         from './KPIsSecurite';
import ImportExcel          from './ImportExcel';
import VeilleReglementaire  from './VeilleReglementaire';
import Statistiques         from './Statistiques';
import CalendrierQHSE       from './CalendrierQHSE';
import ObjectifsQHSE from './ObjectifsQHSE';
import RevueDirection       from './RevueDirection';

const MENU = [
  {
    section: 'Modules QHSE',
    items: [
      { id:'comex',       label:'Supervision',          icon:LayoutDashboard },
      { id:'duerp',       label:'Registre DUERP',       icon:ShieldAlert },
      { id:'accidents',   label:'Accidents & Inc.',     icon:HeartPulse },
      { id:'qualite',     label:'Qualité & Audits',     icon:CheckCircle },
      { id:'env',         label:'Environnement',        icon:Leaf },
      { id:'rh',          label:'Social & RH',          icon:Users },
      { id:'pdca',        label:"Plan d'Actions",       icon:FileText },
      { id:'calendrier',  label:'Calendrier QHSE',      icon:Calendar,      badge:'NEW', badgeClass:'blue' },
      { id:'veille',      label:'Veille Réglementaire', icon:BookOpen,      badge:'NEW', badgeClass:'green' },
    ]
  },
  {
    section: 'Analyses & Outils',
    items: [
      { id:'revue',         label:'Revue de Direction', icon:ClipboardList,   badge:'NEW', badgeClass:'purple' },
      { id:'stats',         label:'Statistiques',       icon:PieChart },
      { id:'objectifs',     label:'Objectifs annuels',  icon:Target,       badge:'NEW', badgeClass:'amber' },
      { id:'kpis',          label:'KPIs & Indicateurs', icon:BarChart2 },
      { id:'import',        label:'Import Excel',       icon:FileSpreadsheet, badge:'XLS', badgeClass:'green' },
      { id:'rapport',       label:'Export PDF',         icon:FileDown,        badge:'PDF', badgeClass:'blue' },
      { id:'notifications', label:'Alertes Email',      icon:Mail },
    ]
  }
];

export default function App() {
  const { theme } = useTheme();
  const [activeTab, setActiveTab] = useState('comex');
  const [animKey, setAnimKey]     = useState(0);

  const handleTab = (id) => {
    if (id === activeTab) return;
    setActiveTab(id);
    setAnimKey(k => k + 1);
  };

  const activeLabel = MENU.flatMap(s => s.items).find(i => i.id === activeTab)?.label || '';
  const isDark = theme === 'dark';

  return (
    <div style={{ display:'flex', height:'100vh', background:'var(--bg-page)', overflow:'hidden', transition:'background 0.25s' }}>

      {/* ── Sidebar ─────────────────────────────────────────────────────── */}
      <aside style={{ width:240, flexShrink:0, display:'flex', flexDirection:'column', background:'var(--bg-sidebar)', borderRight:'1px solid var(--border)', zIndex:10, boxShadow: isDark?'none':'2px 0 16px rgba(0,0,0,0.06)', transition:'background 0.25s, border-color 0.25s' }}>

        {/* Logo */}
        <div style={{ padding:'20px 18px 16px', borderBottom:'1px solid var(--border)' }}>
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            <div style={{ width:42, height:42, background:'linear-gradient(135deg,rgba(79,99,231,0.3),rgba(16,185,129,0.2))', border:'1px solid rgba(79,99,231,0.4)', borderRadius:13, display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, flexShrink:0 }}>🛡️</div>
            <div>
              <div style={{ fontSize:15, fontWeight:800, color:'var(--text-1)', letterSpacing:'-0.2px' }}>DEF Réunion</div>
              <div style={{ fontSize:10, fontWeight:700, color:'var(--blue)', letterSpacing:'0.06em', marginTop:2, textTransform:'uppercase' }}>SMI Dashboard Pro</div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex:1, padding:'10px', overflowY:'auto' }}>
          {MENU.map(section => (
            <div key={section.section}>
              <div className="nav-section">{section.section}</div>
              {section.items.map(item => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button key={item.id} onClick={() => handleTab(item.id)} className={`nav-item ${isActive?'active':''}`} style={{ marginBottom:3 }}>
                    <div className="nav-icon"><Icon size={16}/></div>
                    <span style={{ flex:1, fontSize:13.5 }}>{item.label}</span>
                    {item.badge && <span className={`nav-badge ${item.badgeClass||'blue'}`}>{item.badge}</span>}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        {/* User + theme toggle */}
        <div style={{ padding:'12px 14px', borderTop:'1px solid var(--border)', display:'flex', alignItems:'center', gap:10 }}>
          <div style={{ width:36, height:36, borderRadius:'50%', background:'linear-gradient(135deg,#4F63E7,#06B6D4)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:800, color:'white', flexShrink:0 }}>Y</div>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:13, fontWeight:700, color:'var(--text-1)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>Yoann</div>
            <div style={{ fontSize:11, color:'var(--text-3)' }}>Responsable QHSE</div>
          </div>
          <ThemeToggleBtn/>
        </div>
      </aside>

      {/* ── Main ────────────────────────────────────────────────────────── */}
      <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>

        {/* Topbar */}
        <div style={{ height:54, background:'var(--bg-sidebar)', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', padding:'0 22px', gap:10, flexShrink:0, transition:'background 0.25s, border-color 0.25s' }}>
          <div style={{ display:'flex', alignItems:'center', gap:7 }}>
            <span style={{ fontSize:12, color:'var(--text-3)' }}>SMI Dashboard</span>
            <ChevronRight size={13} style={{ color:'var(--text-4)' }}/>
            <span style={{ fontSize:13, color:'var(--text-2)', fontWeight:600 }}>{activeLabel}</span>
          </div>
          <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:8 }}>
            <div style={{ fontSize:12, color:'var(--text-3)', background:'var(--bg-card-2)', border:'1px solid var(--border)', borderRadius:8, padding:'5px 12px', transition:'background 0.25s' }}>
              {new Date().toLocaleDateString('fr-FR', { day:'2-digit', month:'short', year:'numeric' })}
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:7, background:'var(--bg-card-2)', border:'1px solid var(--border)', borderRadius:100, padding:'4px 12px 4px 4px', transition:'background 0.25s' }}>
              <div style={{ width:26, height:26, background:'linear-gradient(135deg,#4F63E7,#06B6D4)', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:800, color:'white' }}>Y</div>
              <span style={{ fontSize:12, fontWeight:500, color:'var(--text-2)' }}>Yoann</span>
            </div>
          </div>
        </div>

        {/* Content */}
        <main style={{ flex:1, overflowY:'auto', padding:'20px 22px', background:'var(--bg-page)', transition:'background 0.25s' }}>
          <div key={animKey} className="animate-fade-up">
            {activeTab === 'comex'         && <DashboardComex />}
            {activeTab === 'duerp'         && <RegistreDUERP />}
            {activeTab === 'accidents'     && <SecuriteAccidents />}
            {activeTab === 'qualite'       && <QualiteAudits />}
            {activeTab === 'env'           && <Environnement />}
            {activeTab === 'rh'            && <SocialRH />}
            {activeTab === 'pdca'          && <PlanActions />}
            {activeTab === 'calendrier'    && <CalendrierQHSE />}
            {activeTab === 'veille'        && <VeilleReglementaire />}
            {activeTab === 'revue'         && <RevueDirection />}
            {activeTab === 'stats'         && <Statistiques />}
            {activeTab === 'objectifs'     && <ObjectifsQHSE />}
            {activeTab === 'kpis'          && <KPIsSecurite />}
            {activeTab === 'import'        && <ImportExcel />}
            {activeTab === 'rapport'       && <RapportPDF />}
            {activeTab === 'notifications' && <NotificationsEmail />}
          </div>
        </main>
      </div>
    </div>
  );
}
