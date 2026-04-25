import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from './supabaseClient';

const DEFAULTS = { nom: 'DEF Réunion', effectif: 50, h_an: 1607 };

const ConfigCtx = createContext({ config: DEFAULTS, saveConfig: async () => {}, loading: false });

export function ConfigProvider({ children }) {
  const [config, setConfig]   = useState(DEFAULTS);
  const [loading, setLoading] = useState(true);

  // Étape E (post-RLS) : on attend la session Supabase avant de charger
  // la config. Sans JWT, RLS bloque en 401. Si pas de session, on garde
  // les DEFAULTS et on marque loading=false pour ne pas bloquer l'UI.
  useEffect(() => {
    let cancelled = false;

    const charger = async () => {
      if (cancelled) return;
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        if (!cancelled) setLoading(false);
        return;
      }
      const { data } = await supabase.from('config_entreprise').select('*').eq('id', 1).single();
      if (cancelled) return;
      if (data) setConfig({ nom: data.nom || DEFAULTS.nom, effectif: data.effectif || DEFAULTS.effectif, h_an: data.h_an || DEFAULTS.h_an });
      setLoading(false);
    };

    charger();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session && !cancelled) charger();
    });

    return () => { cancelled = true; subscription.unsubscribe(); };
  }, []);

  const saveConfig = useCallback(async (updates) => {
    const next = { ...config, ...updates };
    setConfig(next);
    await supabase.from('config_entreprise').update({ ...next, updated_at: new Date().toISOString() }).eq('id', 1);
  }, [config]);

  return <ConfigCtx.Provider value={{ config, saveConfig, loading }}>{children}</ConfigCtx.Provider>;
}

export function useConfig() { return useContext(ConfigCtx); }
