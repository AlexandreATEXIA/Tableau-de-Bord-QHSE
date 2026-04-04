import React, { useEffect, useRef } from 'react';
import { useTheme } from './ThemeContext';
import { AlertTriangle, Trash2, X } from 'lucide-react';

/**
 * ConfirmModal — Modale de confirmation générique
 * Usage :
 *   const [confirm, setConfirm] = useState(null);
 *   <ConfirmModal config={confirm} onClose={() => setConfirm(null)} />
 *   // Déclencher :
 *   setConfirm({ message: '…', onConfirm: () => deleteRow(id) });
 *   // Optionnel : title, confirmLabel, icon ('trash'|'warning')
 */
export default function ConfirmModal({ config, onClose }) {
  const { p } = useTheme();
  const btnRef = useRef(null);

  useEffect(() => {
    if (!config) return;
    setTimeout(() => btnRef.current?.focus(), 50);
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [config, onClose]);

  if (!config) return null;

  const {
    title       = 'Confirmer la suppression',
    message     = 'Cette action est irréversible.',
    confirmLabel = 'Supprimer',
    cancelLabel  = 'Annuler',
    icon        = 'trash',
    onConfirm,
  } = config;

  const handleConfirm = () => {
    onConfirm?.();
    onClose();
  };

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 999999,
        background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
      }}
    >
      <div style={{
        background: p.bgCard2,
        border: '1px solid rgba(239,68,68,0.3)',
        borderRadius: 16,
        width: '100%', maxWidth: 380,
        boxShadow: '0 24px 64px rgba(0,0,0,0.4)',
        overflow: 'hidden',
        animation: 'fadeInScale 0.15s ease-out',
      }}>
        {/* Header */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid ' + p.border,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: 'rgba(239,68,68,0.12)',
              border: '1px solid rgba(239,68,68,0.25)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {icon === 'trash'
                ? <Trash2 size={16} color="#EF4444"/>
                : <AlertTriangle size={16} color="#F59E0B"/>
              }
            </div>
            <span style={{ fontSize: 15, fontWeight: 800, color: p.text1 }}>{title}</span>
          </div>
          <button
            onClick={onClose}
            style={{ background: p.whiteFaint, border: '1px solid ' + p.border, borderRadius: 8, color: p.text3, cursor: 'pointer', padding: '5px 7px', display: 'flex' }}
          >
            <X size={14}/>
          </button>
        </div>

        {/* Corps */}
        <div style={{ padding: '20px 20px 16px' }}>
          <p style={{ fontSize: 13, color: p.text2, lineHeight: 1.6, margin: 0 }}>{message}</p>
        </div>

        {/* Footer */}
        <div style={{
          padding: '12px 20px',
          borderTop: '1px solid ' + p.border,
          display: 'flex', gap: 8, justifyContent: 'flex-end',
          background: p.whiteFaint2,
        }}>
          <button
            onClick={onClose}
            style={{
              padding: '8px 18px',
              background: p.whiteFaint, border: '1px solid ' + p.border,
              borderRadius: 8, color: p.text2, fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}
          >
            {cancelLabel}
          </button>
          <button
            ref={btnRef}
            onClick={handleConfirm}
            style={{
              padding: '8px 20px',
              background: '#EF4444', color: 'white',
              border: 'none', borderRadius: 8,
              fontSize: 13, fontWeight: 700, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            {icon === 'trash' ? <Trash2 size={13}/> : <AlertTriangle size={13}/>}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
