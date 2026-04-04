import React, { createContext, useContext, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';

const ToastContext = createContext(null);

let toastId = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const add = useCallback((message, type = 'success', duration = 3500) => {
    const id = ++toastId;
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), duration);
    return id;
  }, []);

  const remove = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const toast = {
    success: (msg, dur)  => add(msg, 'success', dur),
    error:   (msg, dur)  => add(msg, 'error',   dur || 5000),
    warning: (msg, dur)  => add(msg, 'warning', dur),
    info:    (msg, dur)  => add(msg, 'info',    dur),
  };

  const CONFIG = {
    success: { bg: '#10B981', border: '#059669', icon: CheckCircle,    label: 'Succès' },
    error:   { bg: '#EF4444', border: '#DC2626', icon: XCircle,        label: 'Erreur' },
    warning: { bg: '#F59E0B', border: '#D97706', icon: AlertTriangle,  label: 'Attention' },
    info:    { bg: '#3B82F6', border: '#2563EB', icon: Info,           label: 'Info' },
  };

  return (
    <ToastContext.Provider value={toast}>
      {children}
      {createPortal(
        <div style={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          zIndex: 9999999,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          pointerEvents: 'none',
        }}>
          {toasts.map(t => {
            const cfg = CONFIG[t.type] || CONFIG.info;
            const Icon = cfg.icon;
            return (
              <div
                key={t.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  background: 'rgba(15,23,42,0.97)',
                  border: `1px solid ${cfg.border}40`,
                  borderLeft: `3px solid ${cfg.bg}`,
                  borderRadius: 10,
                  padding: '11px 14px',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
                  minWidth: 260,
                  maxWidth: 380,
                  pointerEvents: 'all',
                  animation: 'toastIn 0.25s ease',
                }}
              >
                <Icon size={18} style={{ color: cfg.bg, flexShrink: 0 }} />
                <span style={{ flex: 1, fontSize: 13.5, fontWeight: 500, color: '#F1F5F9', lineHeight: 1.4 }}>
                  {t.message}
                </span>
                <button
                  onClick={() => remove(t.id)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748B', padding: 2, display: 'flex', flexShrink: 0 }}
                >
                  <X size={14} />
                </button>
              </div>
            );
          })}
        </div>,
        document.body
      )}
      <style>{`
        @keyframes toastIn {
          from { opacity: 0; transform: translateX(24px); }
          to   { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast doit être utilisé dans <ToastProvider>');
  return ctx;
}
