import React, { useState, useEffect } from 'react';
import { useTheme, ThemeToggleBtn } from './ThemeContext';
import {
  LayoutDashboard, ShieldAlert, CheckCircle, Leaf, Users,
  FileText, HeartPulse, FileDown, Mail, BarChart2,
  ChevronRight, Target, Calendar, FileSpreadsheet, BookOpen,
  PieChart, ClipboardList, Menu, X, LogOut, Archive,
  Truck, ScrollText, Settings, Search, CalendarCheck, ShieldCheck,
  Lock, Eye, EyeOff, RefreshCw, KeyRound, UserPlus,
} from 'lucide-react';
import { supabase } from './supabaseClient';
import LoginPage from './LoginPage';
import QuickActions from './QuickActions';
import { useAlerteCounts } from './useAlerteCounts';
import GestionUtilisateurs from './GestionUtilisateurs';
import { useUser, ROLES } from './UserContext';
import { useConfig } from './ConfigContext';

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
import ParcoursAccueil       from './ParcoursAccueil';

function UpdatePasswordScreen({ onDone, onCancel }) {
  const [pwd, setPwd]         = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (pwd.length < 6) { setError('Le mot de passe doit contenir au moins 6 caractères.'); return; }
    if (pwd !== confirm) { setError('Les mots de passe ne correspondent pas.'); return; }
    setLoading(true);
    const { error: err } = await supabase.auth.updateUser({ password: pwd });
    setLoading(false);
    if (err) { setError(err.message); return; }
    setSuccess(true);
    setTimeout(onDone, 2000);
  };

  return (
    <div style={{ minHeight:'100dvh', display:'flex', alignItems:'center', justifyContent:'center', background:'linear-gradient(135deg,#050c18 0%,#0b1120 50%,#080f1e 100%)', padding:20 }}>
      <div style={{ width:'100%', maxWidth:400, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:20, padding:'40px 36px', backdropFilter:'blur(20px)', boxShadow:'0 32px 80px rgba(0,0,0,0.5)' }}>
        <div style={{ textAlign:'center', marginBottom:28 }}>
          <div style={{ width:60, height:60, background:'linear-gradient(135deg,rgba(79,99,231,0.3),rgba(16,185,129,0.2))', border:'1px solid rgba(79,99,231,0.4)', borderRadius:16, display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 14px' }}>
            <Lock size={26} color="#60A5FA"/>
          </div>
          <div style={{ fontSize:19, fontWeight:800, color:'#fff' }}>Nouveau mot de passe</div>
          <div style={{ fontSize:12, color:'#64748B', marginTop:4 }}>Saisissez et confirmez votre nouveau mot de passe</div>
        </div>

        {success ? (
          <div style={{ background:'rgba(16,185,129,0.1)', border:'1px solid rgba(16,185,129,0.3)', borderRadius:10, padding:18, textAlign:'center' }}>
            <div style={{ fontSize:28, marginBottom:8 }}>✅</div>
            <p style={{ fontSize:14, color:'#6EE7B7', fontWeight:700 }}>Mot de passe mis à jour !</p>
            <p style={{ fontSize:12, color:'#94A3B8', marginTop:4 }}>Redirection en cours…</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display:'flex', flexDirection:'column', gap:14 }}>
            {[
              { label:'Nouveau mot de passe', val:pwd, set:setPwd },
              { label:'Confirmer le mot de passe', val:confirm, set:setConfirm },
            ].map((f, i) => (
              <div key={i}>
                <label style={{ fontSize:11, fontWeight:700, color:'#94A3B8', textTransform:'uppercase', letterSpacing:'0.06em', display:'block', marginBottom:6 }}>{f.label}</label>
                <div style={{ position:'relative' }}>
                  <input
                    type={showPwd ? 'text' : 'password'} value={f.val}
                    onChange={e => f.set(e.target.value)} required minLength={6}
                    placeholder="••••••••"
                    style={{ width:'100%', padding:'11px 40px 11px 14px', borderRadius:10, background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', color:'#fff', fontSize:14, outline:'none', boxSizing:'border-box' }}
                    onFocus={e => e.target.style.borderColor='rgba(79,99,231,0.6)'}
                    onBlur={e => e.target.style.borderColor='rgba(255,255,255,0.1)'}
                  />
                  {i === 0 && (
                    <button type="button" onClick={() => setShowPwd(v => !v)}
                      style={{ position:'absolute', right:12, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:'#64748B', padding:0, display:'flex' }}>
                      {showPwd ? <EyeOff size={16}/> : <Eye size={16}/>}
                    </button>
                  )}
                </div>
              </div>
            ))}

            {error && <div style={{ background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.3)', borderRadius:8, padding:'9px 12px', fontSize:13, color:'#FCA5A5' }}>{error}</div>}

            <button type="submit" disabled={loading}
              style={{ width:'100%', padding:12, borderRadius:10, border:'none', background:loading?'rgba(79,99,231,0.4)':'linear-gradient(135deg,#4F63E7,#3B4FD4)', color:'#fff', fontSize:14, fontWeight:700, cursor:loading?'not-allowed':'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:8, marginTop:4 }}>
              {loading ? <RefreshCw size={16} style={{ animation:'spin 1s linear infinite' }}/> : <Lock size={16}/>}
              {loading ? 'Mise à jour...' : 'Enregistrer'}
            </button>

            <button type="button" onClick={onCancel}
              style={{ background:'none', border:'none', color:'#64748B', fontSize:13, cursor:'pointer', textAlign:'center' }}>
              Annuler — retour à la connexion
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

function ChangerMotDePasseModal({ onClose }) {
  const [pwd, setPwd]         = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (pwd.length < 8) { setError('Le mot de passe doit contenir au moins 8 caractères.'); return; }
    if (pwd !== confirm) { setError('Les mots de passe ne correspondent pas.'); return; }
    setLoading(true);
    const { error: err } = await supabase.auth.updateUser({ password: pwd });
    setLoading(false);
    if (err) { setError(err.message); return; }
    setSuccess(true);
    setTimeout(onClose, 2000);
  };

  const inp = { width:'100%', padding:'9px 38px 9px 12px', borderRadius:8, background:'var(--bg-input)', border:'1px solid var(--border)', color:'var(--text-1)', fontSize:13, outline:'none', boxSizing:'border-box', fontFamily:'inherit' };
  const lbl = { fontSize:11, fontWeight:700, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'0.06em', display:'block', marginBottom:5 };

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', zIndex:9999, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}
         onClick={onClose}>
      <div style={{ background:'var(--bg-sidebar)', border:'1px solid var(--border)', borderRadius:16, width:'100%', maxWidth:380, padding:'24px', boxShadow:'0 24px 60px rgba(0,0,0,0.5)' }}
           onClick={e => e.stopPropagation()}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <KeyRound size={18} style={{ color:'var(--blue)' }}/>
            <h3 style={{ fontWeight:800, fontSize:16, color:'var(--text-1)', margin:0 }}>Changer le mot de passe</h3>
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-3)' }}><X size={18}/></button>
        </div>

        {success ? (
          <div style={{ padding:'16px', borderRadius:10, background:'rgba(16,185,129,0.1)', border:'1px solid rgba(16,185,129,0.3)', textAlign:'center' }}>
            <p style={{ color:'#6EE7B7', fontWeight:700, fontSize:14 }}>✅ Mot de passe mis à jour !</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display:'flex', flexDirection:'column', gap:12 }}>
            {[
              { label:'Nouveau mot de passe', val:pwd, set:setPwd },
              { label:'Confirmer le mot de passe', val:confirm, set:setConfirm },
            ].map((f, i) => (
              <div key={i}>
                <label style={lbl}>{f.label}</label>
                <div style={{ position:'relative' }}>
                  <input type={showPwd ? 'text' : 'password'} value={f.val}
                    onChange={e => f.set(e.target.value)} required minLength={8}
                    placeholder="Minimum 8 caractères" style={inp}
                  />
                  {i === 0 && (
                    <button type="button" onClick={() => setShowPwd(v => !v)}
                      style={{ position:'absolute', right:10, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:'var(--text-4)', display:'flex' }}>
                      {showPwd ? <EyeOff size={15}/> : <Eye size={15}/>}
                    </button>
                  )}
                </div>
              </div>
            ))}
            {error && <div style={{ padding:'8px 12px', borderRadius:8, background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.3)', fontSize:12, color:'#FCA5A5' }}>{error}</div>}
            <button type="submit" disabled={loading}
              style={{ padding:'11px', borderRadius:9, border:'none', background:loading ? 'rgba(79,99,231,0.3)' : '#4F63E7', color:'#fff', fontWeight:700, cursor:'pointer', fontSize:14, display:'flex', alignItems:'center', justifyContent:'center', gap:8, marginTop:4 }}>
              <Lock size={15}/>
              {loading ? 'Mise à jour...' : 'Enregistrer'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

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
      { id:'parcours',    label:"Parcours d'accueil",   icon:UserPlus,      badge:'NEW', badgeClass:'amber' },
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
  const { role, canAccess, loading: userLoading, logout, displayName, initiale } = useUser();
  const { config } = useConfig();
  const [activeTab, setActiveTab]       = useState('comex');
  const [animKey, setAnimKey]           = useState(0);
  const [sidebarOpen, setSidebarOpen]   = useState(false);
  const [session, setSession]           = useState(undefined);
  const [showInvite, setShowInvite]       = useState(false);
  const [showChangePwd, setShowChangePwd] = useState(false);
  const [isPwdRecovery, setIsPwdRecovery] = useState(false);
  // Pré-remplissage Plan d'Actions depuis le DUERP
  const [prefillAction, setPrefillAction] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session);
      if (event === 'PASSWORD_RECOVERY') setIsPwdRecovery(true);
      else if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') setIsPwdRecovery(false);
    });
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

  if (session === undefined || (session && userLoading)) return (
    <div style={{ height:'100dvh', display:'flex', alignItems:'center', justifyContent:'center', background:'#0B1120' }}>
      <div style={{ width:40, height:40, border:'3px solid rgba(79,99,231,0.3)', borderTopColor:'#4F63E7', borderRadius:'50%', animation:'spin 0.8s linear infinite' }}/>
    </div>
  );
  if (!session) return <LoginPage />;

  // Lien de réinitialisation de mot de passe cliqué depuis l'email
  if (isPwdRecovery) return <UpdatePasswordScreen onDone={() => setIsPwdRecovery(false)} onCancel={() => { supabase.auth.signOut(); setIsPwdRecovery(false); }} />;

  // Compte authentifié mais sans rôle attribué dans user_roles : impossible de
  // savoir ce qu'il a le droit de faire — on bloque avec un message explicite
  // plutôt que de l'envoyer sur une sidebar vide. Cas typique : compte créé
  // dans Supabase Dashboard mais l'admin n'a pas encore inséré le rôle.
  if (!role) return (
    <div style={{ minHeight:'100dvh', display:'flex', alignItems:'center', justifyContent:'center', background:'linear-gradient(135deg,#050c18 0%,#0b1120 50%,#080f1e 100%)', padding:20 }}>
      <div style={{ width:'100%', maxWidth:420, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(245,158,11,0.25)', borderRadius:18, padding:'34px 32px', textAlign:'center', boxShadow:'0 32px 80px rgba(0,0,0,0.5)' }}>
        <div style={{ fontSize:38, marginBottom:14 }}>🔒</div>
        <h1 style={{ fontSize:18, fontWeight:800, color:'#FCD34D', marginBottom:8 }}>Compte non configuré</h1>
        <p style={{ fontSize:13, color:'#94A3B8', lineHeight:1.6, marginBottom:18 }}>
          Bonjour <strong style={{ color:'#E2E8F0' }}>{displayName}</strong>, votre compte est bien authentifié mais aucun rôle ne vous a encore été attribué. Contactez l'administrateur QHSE pour qu'il vous donne accès aux modules.
        </p>
        <p style={{ fontSize:11, color:'#475569', marginBottom:20, fontFamily:'monospace' }}>
          {session.user.email}
        </p>
        <button onClick={logout}
          style={{ padding:'10px 22px', borderRadius:10, border:'none', background:'rgba(239,68,68,0.15)', color:'#FCA5A5', fontSize:13, fontWeight:700, cursor:'pointer', display:'inline-flex', alignItems:'center', gap:6 }}>
          <LogOut size={14}/> Déconnexion
        </button>
      </div>
    </div>
  );

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
              <div style={{ fontSize:15, fontWeight:800, color:'var(--text-1)', letterSpacing:'-0.2px' }}>{config?.nom || 'SMI Dashboard'}</div>
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
            {initiale}
          </div>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:13, fontWeight:700, color:'var(--text-1)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
              {displayName}
            </div>
            <div style={{ fontSize:11, color: ROLES[role]?.color || 'var(--text-3)', fontWeight: 600 }}>
              {ROLES[role]?.label || 'Sans rôle'}
            </div>
          </div>
          <ThemeToggleBtn/>
          {estAdmin && (
            <button onClick={() => setShowInvite(true)} title="Ajouter un utilisateur"
              style={{ width:30, height:30, borderRadius:7, border:'1px solid var(--border)', background:'var(--bg-card-2)', color:'var(--text-3)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
              <Users size={14}/>
            </button>
          )}
          <button onClick={() => setShowChangePwd(true)} title="Changer le mot de passe"
            style={{ width:30, height:30, borderRadius:7, border:'1px solid var(--border)', background:'var(--bg-card-2)', color:'var(--text-3)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
            <KeyRound size={14}/>
          </button>
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
              <div style={{ width:26, height:26, background:'linear-gradient(135deg,#4F63E7,#06B6D4)', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:800, color:'white' }}>{initiale}</div>
              <span style={{ fontSize:12, fontWeight:500, color:'var(--text-2)' }} className="mobile-hidden">{displayName}</span>
            </div>
          </div>
        </div>

        {/* Content */}
        <main style={{ flex:1, overflowY:'auto', padding:'16px', paddingLeft:'max(16px, env(safe-area-inset-left))', paddingRight:'max(16px, env(safe-area-inset-right))', background:'var(--bg-page)', transition:'background 0.25s', paddingBottom:'max(80px, calc(env(safe-area-inset-bottom) + 80px))' }}>
          <div key={animKey} className="animate-fade-up">
            {activeTab === 'comex'         && <DashboardComex onNavigate={handleTab} />}
            {activeTab === 'duerp'         && <RegistreDUERP onNavigateToPdca={data => { setPrefillAction(data); handleTab('pdca'); }} />}
            {activeTab === 'accidents'     && <SecuriteAccidents onNavigateToPdca={data => { setPrefillAction(data); handleTab('pdca'); }} />}
            {activeTab === 'qualite'       && <QualiteAudits onNavigateToPdca={data => { setPrefillAction(data); handleTab('pdca'); }} />}
            {activeTab === 'env'           && <Environnement />}
            {activeTab === 'rh'            && <SocialRH />}
            {activeTab === 'parcours'      && <ParcoursAccueil />}
            {activeTab === 'pdca'          && <PlanActions prefill={prefillAction} onPrefillConsumed={() => setPrefillAction(null)} />}
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
      {showChangePwd && <ChangerMotDePasseModal onClose={() => setShowChangePwd(false)} />}
    </div>
  );
}
