import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Settings, Plus, Trash2, X, ChevronDown, ChevronUp } from 'lucide-react';
import { useUser } from './UserContext';

export default function GestionListes({ listes, onSave, storageKey: _storageKey }) {
  // ⚠️ Tous les hooks doivent être appelés AVANT tout early return — ne pas
  // déplacer le `if (!canWrite) return null` plus haut, ça casserait les
  // Rules of Hooks de React au prochain re-render.
  const { canWrite } = useUser();
  const [open, setOpen]         = useState(false);
  const [expanded, setExpanded] = useState(null);
  const [newValues, setNew]     = useState({});
  const [local, setLocal]       = useState(listes);

  // Étape B : la persistance (Supabase + cache local) est entièrement
  // gérée par le hook useListe côté parent. Ce composant ne doit donc
  // plus lire ni écrire localStorage directement — il deviendrait une
  // source de vérité concurrente, écraserait les valeurs Supabase au
  // mount, et provoquerait des aller-retours visibles à l'écran.
  // L'ancienne hydratation localStorage a été retirée.

  // Synchronise l'état local avec le prop `listes` quand il change.
  // Critique en étape B : useListe livre une valeur initiale depuis le
  // cache puis met à jour le state parent une fois Supabase répondu —
  // sans ce sync, la modale afficherait éternellement les valeurs cache.
  useEffect(() => {
    setLocal(listes);
  }, [listes]);

  useEffect(() => {
    if (open) setExpanded(Object.keys(local)[0] || null);
  }, [open]);

  // Bloquer le scroll du body quand la modale est ouverte
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  const save = (key, list) => {
    const u = { ...local, [key]: list };
    setLocal(u);                 // optimistic UI
    onSave(key, list);           // propage vers le parent → Supabase + cache (via useListe)
    // Pas d'écriture localStorage ici : sauverListe (appelé en cascade
    // par useListe.updateList) maintient le cache local automatiquement.
  };

  const add = (key) => {
    const v = (newValues[key] || '').trim();
    if (!v || (local[key] || []).includes(v)) return;
    save(key, [...(local[key] || []), v]);
    setNew(p => ({ ...p, [key]: '' }));
  };

  const remove = (key, val) => save(key, (local[key] || []).filter(v => v !== val));

  const move = (key, idx, dir) => {
    const list = [...(local[key] || [])];
    const to = idx + dir;
    if (to < 0 || to >= list.length) return;
    [list[idx], list[to]] = [list[to], list[idx]];
    save(key, list);
  };

  // Étape E — masquage complet pour les rôles en lecture seule.
  // Placé ICI (après tous les hooks) pour respecter les Rules of Hooks.
  if (!canWrite) return null;

  const modal = open ? createPortal(
    <div
      onClick={e => { if (e.target === e.currentTarget) setOpen(false); }}
      style={{
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        zIndex: 999999,
        background: 'rgba(0,0,0,0.8)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20,
      }}
    >
      <div style={{
        background: '#0F1729',
        border: '1px solid rgba(255,255,255,0.14)',
        borderRadius: 16,
        width: '100%', maxWidth: 540,
        maxHeight: '80vh',
        display: 'flex', flexDirection: 'column',
        boxShadow: '0 40px 100px rgba(0,0,0,0.9)',
      }}>

        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#F1F5F9', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Settings size={17} color="#3B82F6"/> Gérer les listes
            </div>
            <p style={{ fontSize: 11, color: '#475569', marginTop: 2 }}>Ajoutez ou supprimez des options dans les menus</p>
          </div>
          <button onClick={() => setOpen(false)} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#94A3B8', cursor: 'pointer', padding: '6px 8px', display: 'flex' }}>
            <X size={16}/>
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px' }}>
          {Object.entries(local).map(([key, list]) => (
            <div key={key} style={{ marginBottom: 8 }}>

              {/* Accordéon titre */}
              <button
                onClick={() => setExpanded(expanded === key ? null : key)}
                style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px',
                  background: expanded === key ? 'rgba(59,130,246,0.12)' : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${expanded === key ? 'rgba(59,130,246,0.35)' : 'rgba(255,255,255,0.08)'}`,
                  borderRadius: expanded === key ? '9px 9px 0 0' : 9, cursor: 'pointer' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: expanded === key ? '#60A5FA' : '#E2E8F0' }}>{key}</span>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 100, background: 'rgba(59,130,246,0.15)', color: '#60A5FA' }}>
                    {list.length}
                  </span>
                </div>
                {expanded === key ? <ChevronUp size={14} color="#60A5FA"/> : <ChevronDown size={14} color="#475569"/>}
              </button>

              {/* Accordéon body */}
              {expanded === key && (
                <div style={{ background: 'rgba(4,8,20,0.7)', border: '1px solid rgba(59,130,246,0.2)', borderTop: 'none', borderRadius: '0 0 9px 9px', padding: '12px' }}>

                  {/* Champ ajout */}
                  <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                    <input
                      type="text"
                      value={newValues[key] || ''}
                      onChange={e => setNew(p => ({ ...p, [key]: e.target.value }))}
                      onKeyDown={e => e.key === 'Enter' && add(key)}
                      placeholder="Nouvelle option..."
                      autoFocus
                      style={{ flex: 1, background: 'rgba(255,255,255,0.07)', border: '1.5px solid rgba(59,130,246,0.5)', borderRadius: 8, color: '#F1F5F9', fontSize: 13, padding: '9px 12px', outline: 'none', fontFamily: 'inherit' }}
                    />
                    <button
                      onClick={() => add(key)}
                      style={{ padding: '9px 16px', background: '#3B82F6', color: 'white', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}
                    >
                      <Plus size={14}/> Ajouter
                    </button>
                  </div>

                  {/* Options existantes */}
                  <div style={{ maxHeight: 190, overflowY: 'auto' }}>
                    {list.length === 0
                      ? <p style={{ fontSize: 12, color: '#334155', textAlign: 'center', padding: '10px 0', fontStyle: 'italic' }}>Aucune option</p>
                      : list.map((val, idx) => (
                        <div key={`${val}-${idx}`} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 2px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 0, flexShrink: 0 }}>
                            <button onClick={() => move(key, idx, -1)} disabled={idx === 0}
                              style={{ background: 'none', border: 'none', cursor: idx === 0 ? 'default' : 'pointer', color: idx === 0 ? '#1e293b' : '#475569', padding: '0 3px', fontSize: 8, lineHeight: 1.4 }}>▲</button>
                            <button onClick={() => move(key, idx, 1)} disabled={idx === list.length - 1}
                              style={{ background: 'none', border: 'none', cursor: idx === list.length - 1 ? 'default' : 'pointer', color: idx === list.length - 1 ? '#1e293b' : '#475569', padding: '0 3px', fontSize: 8, lineHeight: 1.4 }}>▼</button>
                          </div>
                          <span style={{ flex: 1, fontSize: 13, color: '#94A3B8' }}>{val}</span>
                          <button onClick={() => remove(key, val)}
                            style={{ background: 'none', border: '1px solid transparent', borderRadius: 6, cursor: 'pointer', padding: '3px 5px', color: '#334155', display: 'flex', transition: 'all 0.12s' }}
                            onMouseEnter={e => { e.currentTarget.style.color = '#EF4444'; e.currentTarget.style.borderColor = 'rgba(239,68,68,0.3)'; e.currentTarget.style.background = 'rgba(239,68,68,0.08)'; }}
                            onMouseLeave={e => { e.currentTarget.style.color = '#334155'; e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.background = 'none'; }}
                          >
                            <Trash2 size={13}/>
                          </button>
                        </div>
                      ))
                    }
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{ padding: '12px 20px', borderTop: '1px solid rgba(255,255,255,0.07)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0, background: 'rgba(0,0,0,0.2)' }}>
          <span style={{ fontSize: 11, color: '#334155' }}>✓ Sauvegardé automatiquement</span>
          <button onClick={() => setOpen(false)} style={{ padding: '8px 22px', background: '#3B82F6', color: 'white', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
            Fermer
          </button>
        </div>
      </div>
    </div>,
    document.body
  ) : null;

  return (
    <>
      <button onClick={() => setOpen(true)} className="btn-secondary" style={{ fontSize: 13, padding: '8px 14px' }}>
        <Settings size={15}/> Gérer les listes
      </button>
      {modal}
    </>
  );
}
