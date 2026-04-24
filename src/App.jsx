import React, { useState, useEffect } from 'react';
import { useTheme, ThemeToggleBtn } from './ThemeContext';
import {
  LayoutDashboard, ShieldAlert, CheckCircle, Leaf, Users,
  FileText, HeartPulse, FileDown, Mail, BarChart2,
  ChevronRight, Target, Calendar, FileSpreadsheet, BookOpen,
  PieChart, ClipboardList, Menu, X, LogOut, Archive,
  Truck, ScrollText, Settings, Search, CalendarCheck, ShieldCheck
} from 'lucide-react';
import { supabase } from './supabaseClient';
import LoginPage from './LoginPage';
import QuickActions from './QuickActions';
import { useAlerteCounts } from './useAlerteCounts';
import GestionUtilisateurs from './GestionUtilisateurs';
import { useUser } from './UserContext';

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
import ArchivesExport        from './ArchivesExport';
import FournisseursEval      from './FournisseursEval';
import JournalAudit          from './JournalAudit';
import Parametres            from './Parametres';
import RechercheGlobale      from './RechercheGlobale';
import ReunionsQHSE          from './ReunionsQHSE';
import RGPDModule            from './RGPDModule';

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
      { id:'reunions',    label:'Réunions QHSE',        icon:CalendarCheck },
      { id:'fournisseurs',label:'Fournisseurs',          icon:Truck },
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
      { id:'archives',      label:'Archives & Export',  icon:Archive,         badge:'XLS', badgeClass:'green' },
      { id:'journal',       label:"Journal d'audit",    icon:ScrollText },
      { id:'rgpd',          label:'Conformité RGPD',    icon:ShieldCheck,     badge:'NEW', badgeClass:'purple' },
      { id:'recherche',     label:'Recherche globale',  icon:Search },
      { id:'parametres',    label:'Paramètres',         icon:Settings },
      { id:'notifications', label:'Alertes Email',      icon:Mail },
    ]
  }
];

export default function App() {
  const { theme } = useTheme();
  const { role, canAccess } = useUser();
  const [activeTab, setActiveTab]     = useState('comex');
  const [animKey, setAnimKey]         = useState(0);
  const [sidebarOpen, setSidebarOpen]   = useState(false);
  const [session, setSession]           = useState(undefined);
  const [showInvite, setShowInvite]     = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => setSession(session));
    return () => subscription.unsubscribe();
  }, []);

  // Si le rôle courant n'a pas accès à l'onglet actif (ex : changement de rôle,
  // rechargement sur une URL interne), on retombe sur la Supervision.
  useEffect(() => {
    if (!canAccess(activeTab)) {
      setActiveTab('comex');
      setAnimKey(k => k + 1);
    }
  }, [activeTab, role]); // role change = re-check

  // ⚠️ Les hooks DOIVENT être appelés avant tout early return
  const { counts } = useAlerteCounts();

  if (session === undefined) return (
    <div style={{ height:'100dvh', display:'flex', alignItems:'center', justifyContent:'center', background:'#0B1120' }}>
      <div style={{ width:40, height:40, border:'3px solid rgba(79,99,231,0.3)', borderTopColor:'#4F63E7', borderRadius:'50%', animation:'spin 0.8s linear infinite' }}/>
    </div>
  );
  if (!session) return <LoginPage />;

  const handleTab = (id) => {
    if (id === activeTab) return;
    setActiveTab(id);
    setAnimKey(k => k + 1);
    setSidebarOpen(false); // ferme la sidebar sur mobile après sélection
  };
  const activeLabel = MENU.flatMap(s => s.items).find(i => i.id === activeTab)?.label || '';
  const isDark = theme === 'dark';

  // RBAC — on filtre le MENU selon le rôle. Les sections vides sont masquées.
  // Les rôles "admin" et "responsable_qhse" (menuAccess: null) voient tout.
  const menuVisible = MENU
    .map(section => ({ ...section, items: section.items.filter(item => canAccess(item.id)) }))
    .filter(section => section.items.length > 0);

  const estAdmin = role === 'admin';

  // Mapping module → count d'urgences
  const ALERT_COUNTS = {
    accidents: counts.accidents,
    pdca:      counts.pdca,
    duerp:     counts.duerp,
    qualite:   counts.qualite,
    rh:        counts.rh,
  };
  const ALERT_CRITICAL = { accidents: true, duerp: true, rh: counts.rhCritical > 0 };

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
          {menuVisible.map(section => (
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
                    {ALERT_COUNTS[item.id] > 0 && (
                      <span style={{
                        fontSize: 10, fontWeight: 800, minWidth: 18, height: 18, borderRadius: 100,
                        background: ALERT_CRITICAL[item.id] ? 'rgba(239,68,68,0.2)' : 'rgba(245,158,11,0.2)',
                        color: ALERT_CRITICAL[item.id] ? '#EF4444' : '#F59E0B',
                        border: `1px solid ${ALERT_CRITICAL[item.id] ? 'rgba(239,68,68,0.4)' : 'rgba(245,158,11,0.4)'}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px',
                      }}>{ALERT_COUNTS[item.id]}</span>
                    )}
                    {!ALERT_COUNTS[item.id] && item.badge && <span className={`nav-badge ${item.badgeClass||'blue'}`}>{item.badge}</span>}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        {/* User + theme toggle */}
        <div style={{ padding:'12px 14px', borderBottom: 'env(safe-area-inset-bottom) solid transparent', paddingBottom:'max(12px, calc(env(safe-area-inset-bottom) + 12px))', borderTop:'1px solid var(--border)', display:'flex', alignItems:'center', gap:10 }}>
          <div style={{ width:36, height:36, borderRadius:'50%', background:'linear-gradient(135deg,#4F63E7,#06B6D4)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:800, color:'white', flexShrink:0 }}>
            {session?.user?.email?.[0]?.toUpperCase() || 'Y'}
          </div>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:13, fontWeight:700, color:'var(--text-1)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
              {session?.user?.email?.split('@')[0] || 'Yoann'}
            </div>
            <div style={{ fontSize:11, color:'var(--text-3)' }}>Responsable QHSE</div>
          </div>
          <ThemeToggleBtn/>
          {estAdmin && (
            <button onClick={() => setShowInvite(true)} title="Ajouter un utilisateur"
              style={{ width:30, height:30, borderRadius:7, border:'1px solid var(--border)', background:'var(--bg-card-2)', color:'var(--text-3)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
              <Users size={14}/>
            </button>
          )}
          <button onClick={() => supabase.auth.signOut()} title="Se déconnecter"
            style={{ width:30, height:30, borderRadius:7, border:'1px solid var(--border)', background:'var(--bg-card-2)', color:'var(--text-3)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
            <LogOut size={14}/>
          </button>
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
        <main style={{ flex:1, overflowY:'auto', padding:'16px', paddingLeft:'max(16px, env(safe-area-inset-left))', paddingRight:'max(16px, env(safe-area-inset-right))', background:'var(--bg-page)', transition:'background 0.25s', paddingBottom:'max(80px, calc(env(safe-area-inset-bottom) + 80px))' }}>
          <div key={animKey} className="animate-fade-up">
            {activeTab === 'comex'         && <DashboardComex onNavigate={handleTab} />}
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
            {activeTab === 'archives'      && <ArchivesExport />}
            {activeTab === 'fournisseurs'  && <FournisseursEval />}
            {activeTab === 'journal'       && <JournalAudit />}
            {activeTab === 'parametres'    && <Parametres />}
            {activeTab === 'recherche'     && <RechercheGlobale />}
            {activeTab === 'reunions'      && <ReunionsQHSE />}
            {activeTab === 'rgpd'          && <RGPDModule />}
            {activeTab === 'notifications' && <NotificationsEmail />}
          </div>
        </main>
      </div>

      {/* Bouton actions rapides flottant */}
      <QuickActions onNavigate={handleTab} />

      {/* Modal invitation utilisateur (admin uniquement) */}
      {showInvite && estAdmin && <GestionUtilisateurs onClose={() => setShowInvite(false)} />}
    </div>
  );
}
