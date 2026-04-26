/* eslint-disable react-refresh/only-export-components --
   * Cette règle ne tolère que des exports de composants dans un .jsx, mais
   * ce fichier exporte aussi des constantes, hooks ou contextes utilisés
   * ailleurs dans l'app. Splitter en fichier .js séparé n'apporterait pas
   * de bénéfice pratique (HMR fonctionne, la valeur est statique). */
import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle, AlertTriangle, Info, X } from 'lucide-react';

const ToastCtx = createContext({ toast: () => {} });

const STYLES = {
  success: { bg: 'rgba(16,185,129,0.18)',  border: 'rgba(16,185,129,0.45)', color: '#34D399', Icon: CheckCircle },
  error:   { bg: 'rgba(239,68,68,0.18)',   border: 'rgba(239,68,68,0.45)',  color: '#F87171', Icon: AlertTriangle },
  warning: { bg: 'rgba(245,158,11,0.18)',  border: 'rgba(245,158,11,0.45)', color: '#FBBF24', Icon: AlertTriangle },
  info:    { bg: 'rgba(59,130,246,0.18)',  border: 'rgba(59,130,246,0.45)', color: '#60A5FA', Icon: Info },
};

function ToastItem({ t, onClose }) {
  const s = STYLES[t.type] || STYLES.success;
  const { Icon } = s;
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '11px 14px', borderRadius: 12,
      background: '#1A2540', border: `1px solid ${s.border}`,
      boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
      minWidth: 240, maxWidth: 360,
      animation: 'toastIn 0.22s cubic-bezier(0.4,0,0.2,1) both',
    }}>
      <Icon size={17} style={{ color: s.color, flexShrink: 0 }} />
      <span style={{ fontSize: 13, color: '#E2E8F0', flex: 1, lineHeight: 1.4 }}>{t.message}</span>
      <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748B', display: 'flex', padding: 2, flexShrink: 0 }}>
        <X size={14} />
      </button>
    </div>
  );
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const toast = useCallback(({ message, type = 'success', duration = 3000 }) => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), duration);
  }, []);

  const remove = (id) => setToasts(prev => prev.filter(t => t.id !== id));

  return (
    <ToastCtx.Provider value={{ toast }}>
      {children}
      <div style={{ position: 'fixed', top: 20, right: 20, zIndex: 9999, display: 'flex', flexDirection: 'column', gap: 8, pointerEvents: 'none' }}>
        {toasts.map(t => (
          <div key={t.id} style={{ pointerEvents: 'all' }}>
            <ToastItem t={t} onClose={() => remove(t.id)} />
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export function useToast() { return useContext(ToastCtx); }