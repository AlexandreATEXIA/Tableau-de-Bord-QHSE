// Ré-export adapté : les composants importent useToast depuis ToastContext
// mais le vrai provider est dans Toast.jsx (monté dans main.jsx).
// On adapte l'API pour exposer { success, error, warning, info }.

import { useToast as useToastRaw } from './Toast';

export function useToast() {
  const { toast } = useToastRaw();
  return {
    success: (msg, dur) => toast({ message: msg, type: 'success', duration: dur }),
    error:   (msg, dur) => toast({ message: msg, type: 'error',   duration: dur || 5000 }),
    warning: (msg, dur) => toast({ message: msg, type: 'warning', duration: dur }),
    info:    (msg, dur) => toast({ message: msg, type: 'info',    duration: dur }),
  };
}
