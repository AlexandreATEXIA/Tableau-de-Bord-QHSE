import React, { useState, useEffect, useRef } from 'react';
import { useTheme } from './ThemeContext';
import { supabase } from './supabaseClient';
import { Search, X, ChevronRight, RefreshCw } from 'lucide-react';

const MODULES = {
  action:      { label: "Plan d'Actions", tab: 'pdca',      icon: '📋', color: '#3B82F6' },
  accident:    { label: 'Accidents',      tab: 'accidents',  icon: '🚨', color: '#EF4444' },
  nc:          { label: 'NC Qualité',     tab: 'qualite',    icon: '⚠️', color: '#F59E0B' },
  risque:      { label: 'Risque DUERP',   tab: 'duerp',      icon: '🔴', color: '#EF4444' },
  habilitation:{ label: 'Habilitations',  tab: 'rh',         icon: '🎓', color: '#8B5CF6' },
  fournisseur: { label: 'Fournisseurs',   tab: 'fournisseurs',icon: '🏢', color: '#10B981' },
};

export default function RechercheGlobale({ open, onClose, onNavigate }) {
  const isTab = open === undefined;
  const { p } = useTheme();
  const [query, setQuery]       = useState('');
  const [results, setResults]   = useState([]);
  const [searching, setSearch]  = useState(false);
  const [selected, setSelected] = useState(0);
  const inputRef = useRef(null);
  const listRef  = useRef(null);

  useEffect(() => {
    if (open || isTab) { setQuery(''); setResults([]); setSelected(0); setTimeout(() => inputRef.current?.focus(), 60); }
  }, [open]);

  useEffect(() => {
    if (!query.trim() || query.length < 2) { setResults([]); return; }
    const t = setTimeout(() => doSearch(query.trim()), 280);
    return () => clearTimeout(t);
  }, [query]);

  const doSearch = async (q) => {
    setSearch(true);
    const like = `%${q}%`;
    const [rA, rAcc, rNC, rR, rH, rF] = await Promise.all([
      supabase.from('plan_actions').select('id,action,pilote,statut,echeance').or(`action.ilike.${like},pilote.ilike.${like},cause_racine.ilike.${like}`).limit(6),
      supabase.from('securite_accidents').select('id,type_evenement,lieu,date_evenement,victime,description').or(`description.ilike.${like},lieu.ilike.${like},victime.ilike.${like}`).limit(4),
      supabase.from('qualite_nc').select('id,description,processus,statut_nc,date_nc').or(`description.ilike.${like},processus.ilike.${like},action_corrective.ilike.${like}`).limit(4),
      supabase.from('registre_duerp').select('id,danger,unite_travail,famille_risque,criticite').or(`danger.ilike.${like},unite_travail.ilike.${like},dommage_potentiel.ilike.${like}`).limit(4),
      supabase.from('habilitations').select('id,employe,domaine,obtention').or(`employe.ilike.${like},domaine.ilike.${like}`).limit(4),
      supabase.from('fournisseurs_eval').select('id,nom,secteur,statut').or(`nom.ilike.${like},secteur.ilike.${like},contact.ilike.${like}`).limit(4),
    ]);
    const flat = [
      ...(rA.data||[]).map(r  => ({ _t:'action',       _id:r.id, _label:r.action||'Action',           _sub:`${r.pilote||'—'} · ${r.echeance||''} · ${r.statut||''}`, ...r })),
      ...(rAcc.data||[]).map(r => ({ _t:'accident',     _id:r.id, _label:r.type_evenement||'Accident',  _sub:`${r.lieu||''} · ${r.date_evenement||''}`, ...r })),
      ...(rNC.data||[]).map(r  => ({ _t:'nc',           _id:r.id, _label:r.description||'NC',           _sub:`${r.processus||''} · ${r.statut_nc||''}`, ...r })),
      ...(rR.data||[]).map(r   => ({ _t:'risque',       _id:r.id, _label:r.danger||'Risque',            _sub:`${r.unite_travail||''} · criticité ${r.criticite||'?'}`, ...r })),
      ...(rH.data||[]).map(r   => ({ _t:'habilitation', _id:r.id, _label:r.employe||'—',               _sub:r.domaine||'—', ...r })),
      ...(rF.data||[]).map(r   => ({ _t:'fournisseur',  _id:r.id, _label:r.nom||'Fournisseur',          _sub:`${r.secteur||''} · ${r.statut||''}`, ...r })),
    ];
    setResults(flat);
    setSelected(0);
    setSearch(false);
  };

  const go = (r) => { if (onNavigate) onNavigate(MODULES[r._t].tab); if (onClose) onClose(); };

  const onKey = (e) => {
    if (e.key === 'Escape') { if (onClose) onClose(); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelected(s => Math.min(s + 1, results.length - 1)); }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setSelected(s => Math.max(s - 1, 0)); }
    if (e.key === 'Enter' && results[selected]) go(results[selected]);
  };

  useEffect(() => {
    const el = listRef.current?.children[selected];
    el?.scrollIntoView({ block: 'nearest' });
  }, [selected]);

  if (!open && !isTab) return null;

  const searchContent = (
    <>
      {/* Barre de recherche */}
      <div style={{ display:'flex', alignItems:'center', gap:10, padding:'14px 18px', borderBottom:'1px solid '+p.border }}>
        <Search size={18} style={{ color:p.blue, flexShrink:0 }}/>
        <input
          ref={inputRef}
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={onKey}
          placeholder="Rechercher une action, un accident, une NC, un risque, une habilitation..."
          style={{ flex:1, background:'none', border:'none', outline:'none', fontSize:14, color:p.text1, fontFamily:'inherit', caretColor:p.blue }}
        />
        {searching
          ? <RefreshCw size={14} className="animate-spin" style={{ color:p.text4 }}/>
          : query && <button onClick={() => setQuery('')} style={{ background:'none', border:'none', cursor:'pointer', color:p.text4, display:'flex', padding:2 }}><X size={14}/></button>
        }
        {!isTab && <kbd style={{ fontSize:10, color:p.text4, background:p.whiteFaint, border:'1px solid '+p.border, borderRadius:5, padding:'2px 7px', flexShrink:0, fontFamily:'monospace' }}>Esc</kbd>}
      </div>

      {/* Résultats */}
      <div ref={listRef} style={{ maxHeight: isTab ? 600 : 420, overflowY:'auto' }}>
        {query.length < 2 && (
          <div style={{ padding:'16px 18px' }}>
            <p style={{ fontSize:11, color:p.text4, marginBottom:10 }}>Modules indexés :</p>
            <div style={{ display:'flex', flexWrap:'wrap', gap:7 }}>
              {Object.entries(MODULES).map(([k, m]) => (
                <span key={k} style={{ fontSize:11, background:p.whiteFaint, border:'1px solid '+p.border, borderRadius:7, padding:'4px 10px', color:p.text3 }}>
                  {m.icon} {m.label}
                </span>
              ))}
            </div>
            <p style={{ fontSize:10, color:p.text4, marginTop:12, opacity:0.7 }}>Tapez au moins 2 caractères pour rechercher</p>
          </div>
        )}

        {query.length >= 2 && !searching && results.length === 0 && (
          <div style={{ padding:'32px 18px', textAlign:'center', color:p.text4, fontSize:13 }}>
            Aucun résultat pour « {query} »
          </div>
        )}

        {results.map((r, i) => {
          const m = MODULES[r._t];
          return (
            <div
              key={`${r._t}-${r._id}`}
              onClick={() => go(r)}
              style={{
                padding:'11px 18px', display:'flex', gap:11, alignItems:'center', cursor:'pointer',
                background: i === selected ? (p.whiteFaint2) : 'transparent',
                borderBottom: '1px solid '+p.border, transition:'background 0.08s',
              }}
              onMouseEnter={() => setSelected(i)}
            >
              <span style={{ fontSize:17, flexShrink:0 }}>{m.icon}</span>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:13, fontWeight:600, color:p.text1, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{r._label}</div>
                <div style={{ fontSize:11, color:p.text4, marginTop:2, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{r._sub}</div>
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:6, flexShrink:0 }}>
                <span style={{ fontSize:10, color:m.color, background:m.color+'18', border:`1px solid ${m.color}30`, borderRadius:6, padding:'2px 8px', fontWeight:700 }}>
                  {m.label}
                </span>
                <ChevronRight size={12} style={{ color:p.text4 }}/>
              </div>
            </div>
          );
        })}
      </div>

      {results.length > 0 && (
        <div style={{ padding:'7px 18px', borderTop:'1px solid '+p.border, fontSize:10, color:p.text4, display:'flex', justifyContent:'space-between' }}>
          <span>{results.length} résultat{results.length>1?'s':''}</span>
          <span>Cliquez pour ouvrir</span>
        </div>
      )}
    </>
  );

  // Mode onglet
  if (isTab) {
    return (
      <div className="space-y-5 pb-10">
        <header className="page-header">
          <div>
            <h2 className="page-title flex items-center gap-3"><Search size={26} className="text-blue-400"/> Recherche globale</h2>
            <p className="page-subtitle">Recherche dans tous les modules QHSE</p>
          </div>
        </header>
        <div style={{ width:'100%', maxWidth:700, margin:'0 auto' }}>
          <div style={{ background:p.bgCard2, border:'1px solid '+p.border2, borderRadius:16, overflow:'hidden' }}>
            {searchContent}
          </div>
        </div>
      </div>
    );
  }

  // Mode modal
  return (
    <div
      style={{ position:'fixed', inset:0, zIndex:100000, background:'rgba(0,0,0,0.65)', backdropFilter:'blur(6px)', display:'flex', alignItems:'flex-start', justifyContent:'center', padding:'72px 20px 20px' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ width:'100%', maxWidth:620, background:p.bgCard2, border:'1px solid '+p.border2, borderRadius:16, overflow:'hidden', boxShadow:'0 32px 80px rgba(0,0,0,0.45)', animation:'fadeInScale 0.18s ease' }}>
        {searchContent}
      </div>
    </div>
  );
}
