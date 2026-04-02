import React, { useState } from 'react';
import { useTheme, ThemeToggleBtn } from './ThemeContext';
import {
  LayoutDashboard, ShieldAlert, CheckCircle, Leaf, Users,
  FileText, HeartPulse, FileDown, Mail, BarChart2,
  ChevronRight, Target, Calendar, FileSpreadsheet, BookOpen,
  PieChart, ClipboardList, HardHat, Menu, X
} from 'lucide-react';

import DashboardComex        from './DashboardComex';
import RegistreDUERP         from './RegistreDUERP';
import SecuriteAccidents     from './SecuriteAccidents';
import PlanActions           from './PlanActions';
import QualiteAudits         from './QualiteAudits';
import Environnement         from './Environnement';
import SocialRH              from './SocialRH';
import RapportPDF            from './RapportPDF';
import NotificationsEmail    from './NotificationsEmail';
import KPIsSecurite          from './KPIsSecurite';
import ImportExcel           from './ImportExcel';
import VeilleReglementaire   from './VeilleReglementaire';
import Statistiques          from './Statistiques';
import CalendrierQHSE        from './CalendrierQHSE';
import ObjectifsQHSE         from './ObjectifsQHSE';
import RevueDirection        from './RevueDirection';
import AnalyseRisqueChantier from './AnalyseRisqueChantier';

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
      { id:'analyse',     label:'Analyse Risque',       icon:HardHat,       badge:'NEW', badgeClass:'red' },
      { id:'calendrier',  label:'Calendrier QHSE',      icon:Calendar,      badge:'NEW', badgeClass:'blue' },
      { id:'veille',      label:'Veille Réglementaire', icon:BookOpen,      badge:'NEW', badgeClass:'green' },
    ]
  },
  {
    section: 'Analyses & Outils',
    items: [
      { id:'revue',         label:'Revue de Direction', icon:ClipboardList,   badge:'NEW', badgeClass:'purple' },
      { id:'stats',         label:'Statistiques',       icon:PieChart },
      { id:'objectifs',     label:'Objectifs annuels',  icon:Target,          badge:'NEW', badgeClass:'amber' },
      { id:'kpis',          label:'KPIs & Indicateurs', icon:BarChart2 },
      { id:'import',        label:'Import Excel',       icon:FileSpreadsheet, badge:'XLS', badgeClass:'green' },
      { id:'rapport',       label:'Export PDF',         icon:FileDown,        badge:'PDF', badgeClass:'blue' },
      { id:'notifications', label:'Alertes Email',      icon:Mail },
    ]
  }
];

export default function App() {
  const { theme } = useTheme();
  const [activeTab, setActiveTab]   = useState('comex');
  const [animKey, setAnimKey]       = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleTab = (id) => {
    if (id === activeTab) return;
    setActiveTab(id);
    setAnimKey(k => k + 1);
    setSidebarOpen(false); // ferme la sidebar sur mobile après sélection
  };

  const activeLabel = MENU.flatMap(s => s.items).find(i => i.id === activeTab)?.label || '';
  const isDark = theme === 'dark';

  return (
    <div style={{ display:'flex', height:'100dvh', background:'var(--bg-page)', overflow:'hidden', transition:'background 0.25s' }}>

      {/* ── Overlay mobile ──────────────────────────────────────────────── */}
      <div
        className={`sidebar-overlay${sidebarOpen ? ' open' : ''}`}
        onClick={() => setSidebarOpen(false)}
      />

      {/* ── Sidebar ─────────────────────────────────────────────────────── */}
      <aside style={{
        width: 240, flexShrink: 0, display: 'flex', flexDirection: 'column',
        background: 'var(--bg-sidebar)', borderRight: '1px solid var(--border)',
        zIndex: 50,
        boxShadow: isDark ? 'none' : '2px 0 16px rgba(0,0,0,0.06)',
        transition: 'background 0.25s, border-color 0.25s, transform 0.3s ease',
        // Sur mobile : positionnée en overlay, slide depuis la gauche
        position: 'var(--sidebar-pos, relative)',
        transform: 'var(--sidebar-transform, none)',
      }}
        // Trick CSS-in-JS pour responsive
        ref={el => {
          if (!el) return;
          const mobile = window.innerWidth <= 768;
          el.style.position = mobile ? 'fixed' : 'relative';
          el.style.top = mobile ? '0' : 'auto';
          el.style.left = mobile ? '0' : 'auto';
          el.style.height = mobile ? '100dvh' : 'auto';
          el.style.transform = mobile && !sidebarOpen ? 'translateX(-100%)' : 'translateX(0)';
        }}
      >
        {/* Logo */}
        <div style={{ padding:'20px 18px 16px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            <div style={{ width:42, height:42, background:'linear-gradient(135deg,rgba(79,99,231,0.3),rgba(16,185,129,0.2))', border:'1px solid rgba(79,99,231,0.4)', borderRadius:13, display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, flexShrink:0 }}>🛡️</div>
            <div>
              <div style={{ fontSize:15, fontWeight:800, color:'var(--text-1)', letterSpacing:'-0.2px' }}>DEF Réunion</div>
              <div style={{ fontSize:10, fontWeight:700, color:'var(--blue)', letterSpacing:'0.06em', marginTop:2, textTransform:'uppercase' }}>SMI Dashboard Pro</div>
            </div>
          </div>
          {/* Bouton fermer sur mobile */}
          <button onClick={() => setSidebarOpen(false)} style={{
            display: 'none', width:32, height:32, borderRadius:8, border:'1px solid var(--border)',
            background:'var(--bg-card-2)', color:'var(--text-3)', cursor:'pointer',
            alignItems:'center', justifyContent:'center',
            // affiché via CSS media query dans une autre approche; ici on gère via JS
          }} id="sidebar-close-btn">
            <X size={16}/>
          </button>
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
                  <button key={item.id} onClick={() => handleTab(item.id)}
                    className={`nav-item ${isActive ? 'active' : ''}`}
                    style={{ marginBottom:3 }}>
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
        <div style={{ padding:'12px 14px', borderBottom: 'env(safe-area-inset-bottom) solid transparent', paddingBottom:'max(12px, calc(env(safe-area-inset-bottom) + 12px))', borderTop:'1px solid var(--border)', display:'flex', alignItems:'center', gap:10 }}>
          <div style={{ width:36, height:36, borderRadius:'50%', background:'linear-gradient(135deg,#4F63E7,#06B6D4)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:800, color:'white', flexShrink:0 }}>Y</div>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:13, fontWeight:700, color:'var(--text-1)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>Yoann</div>
            <div style={{ fontSize:11, color:'var(--text-3)' }}>Responsable QHSE</div>
          </div>
          <ThemeToggleBtn/>
        </div>
      </aside>

      {/* ── Main ────────────────────────────────────────────────────────── */}
      <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden', minWidth:0 }}>

        {/* Topbar */}
        <div style={{ height:54, background:'var(--bg-sidebar)', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', padding:'0 16px', gap:10, flexShrink:0, paddingLeft:'max(16px, env(safe-area-inset-left))', paddingRight:'max(16px, env(safe-area-inset-right))', transition:'background 0.25s, border-color 0.25s' }}>

          {/* Hamburger mobile */}
          <button onClick={() => setSidebarOpen(true)} style={{
            width:36, height:36, borderRadius:9, border:'1px solid var(--border)',
            background:'var(--bg-card-2)', color:'var(--text-2)', cursor:'pointer',
            display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0,
          }} className="hamburger-btn">
            <Menu size={18}/>
          </button>

          <div style={{ display:'flex', alignItems:'center', gap:7 }}>
            <span style={{ fontSize:12, color:'var(--text-3)' }} className="mobile-hidden">SMI Dashboard</span>
            <ChevronRight size={13} style={{ color:'var(--text-4)' }} className="mobile-hidden"/>
            <span style={{ fontSize:13, color:'var(--text-2)', fontWeight:700 }}>{activeLabel}</span>
          </div>

          <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:8 }}>
            <div style={{ fontSize:12, color:'var(--text-3)', background:'var(--bg-card-2)', border:'1px solid var(--border)', borderRadius:8, padding:'5px 12px' }} className="mobile-hidden">
              {new Date().toLocaleDateString('fr-FR', { day:'2-digit', month:'short', year:'numeric' })}
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:7, background:'var(--bg-card-2)', border:'1px solid var(--border)', borderRadius:100, padding:'4px 12px 4px 4px' }}>
              <div style={{ width:26, height:26, background:'linear-gradient(135deg,#4F63E7,#06B6D4)', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:800, color:'white' }}>Y</div>
              <span style={{ fontSize:12, fontWeight:500, color:'var(--text-2)' }} className="mobile-hidden">Yoann</span>
            </div>
          </div>
        </div>

        {/* Content */}
        <main style={{ flex:1, overflowY:'auto', padding:'16px', paddingLeft:'max(16px, env(safe-area-inset-left))', paddingRight:'max(16px, env(safe-area-inset-right))', background:'var(--bg-page)', transition:'background 0.25s' }}>
          <div key={animKey} className="animate-fade-up">
            {activeTab === 'comex'         && <DashboardComex />}
            {activeTab === 'duerp'         && <RegistreDUERP />}
            {activeTab === 'accidents'     && <SecuriteAccidents />}
            {activeTab === 'qualite'       && <QualiteAudits />}
            {activeTab === 'env'           && <Environnement />}
            {activeTab === 'rh'            && <SocialRH />}
            {activeTab === 'pdca'          && <PlanActions />}
            {activeTab === 'analyse'       && <AnalyseRisqueChantier />}
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
