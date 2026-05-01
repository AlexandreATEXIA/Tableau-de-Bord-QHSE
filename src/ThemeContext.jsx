/* eslint-disable react-refresh/only-export-components --
   * Cette règle ne tolère que des exports de composants dans un .jsx, mais
   * ce fichier exporte aussi des constantes, hooks ou contextes utilisés
   * ailleurs dans l'app. Splitter en fichier .js séparé n'apporterait pas
   * de bénéfice pratique (HMR fonctionne, la valeur est statique). */
import React, { createContext, useContext, useEffect, useState } from 'react';

/* ─── Palettes complètes ──────────────────────────────────────────────────── */
export const DARK = {
  // Textes
  text1: '#F1F5F9',
  text2: '#94A3B8',
  text3: '#64748B',
  text4: '#475569',
  // Fonds
  bgPage:    '#0B1120',
  bgSidebar: 'rgba(6,11,24,0.95)',
  bgCard:    'rgba(30,41,59,0.5)',
  bgCard2:   'rgba(15,23,42,0.8)',
  bgInput:   'rgba(6,11,24,0.6)',
  // Bordures
  border:    'rgba(255,255,255,0.08)',
  border2:   'rgba(255,255,255,0.14)',
  borderInput: 'rgba(255,255,255,0.10)',
  // Accents fonds semi-transparents
  whiteFaint:  'rgba(255,255,255,0.06)',
  whiteFaint2: 'rgba(255,255,255,0.04)',
  whiteFaint3: 'rgba(255,255,255,0.10)',
  // Graphiques
  chartGrid:  'rgba(255,255,255,0.05)',
  chartAxis:  '#475569',
  chartTick:  '#64748B',
  tooltipBg:  '#0f172a',
  tooltipBorder: '#1e293b',
  // Hover rows
  rowHover: 'rgba(255,255,255,0.03)',
  // Couleurs fonctionnelles
  blue:   '#3B82F6',
  blueL:  'rgba(59,130,246,0.15)',
  green:  '#10B981',
  amber:  '#F59E0B',
  red:    '#EF4444',
  purple: '#8B5CF6',
};

export const LIGHT = {
  // Textes
  text1: '#0F172A',
  text2: '#334155',
  text3: '#64748B',
  text4: '#94A3B8',
  // Fonds
  bgPage:    '#F0F4FA',
  bgSidebar: '#FFFFFF',
  bgCard:    '#FFFFFF',
  bgCard2:   '#F8FAFC',
  bgInput:   '#FFFFFF',
  // Bordures
  border:    '#E2E8F0',
  border2:   '#CBD5E1',
  borderInput: '#D1D5DB',
  // Accents fonds
  whiteFaint:  '#F1F5F9',
  whiteFaint2: '#F8FAFC',
  whiteFaint3: '#EEF2FF',
  // Graphiques
  chartGrid:   '#E2E8F0',
  chartAxis:   '#94A3B8',
  chartTick:   '#64748B',
  tooltipBg:   '#FFFFFF',
  tooltipBorder: '#E2E8F0',
  // Hover rows
  rowHover: '#F8FAFC',
  // Couleurs fonctionnelles
  blue:   '#4F63E7',
  blueL:  '#EEF2FF',
  green:  '#059669',
  amber:  '#D97706',
  red:    '#DC2626',
  purple: '#7C3AED',
};

/* ─── Valeurs par défaut des color pickers (hex solide, sans alpha) ─────────
   Utilisées uniquement pour initialiser <input type="color"> quand aucun
   override n'est enregistré. Ne remplacent pas les CSS vars du thème. */
export const THEME_COLOR_DEFAULTS = {
  dark:  { sidebar: '#060B18', page: '#0B1120' },
  light: { sidebar: '#FFFFFF', page: '#F0F4FA' },
};

/* ─── Helpers localStorage ───────────────────────────────────────────────── */
const COLORS_KEY = 'smi_colors';

function getStoredColors() {
  try { return JSON.parse(localStorage.getItem(COLORS_KEY) || '{}'); } catch { return {}; }
}

function persistColors(obj) {
  try { localStorage.setItem(COLORS_KEY, JSON.stringify(obj)); } catch { /* ignore */ }
}

/* mapping clé logique → CSS custom property */
const CSS_VAR_MAP = {
  sidebar: '--bg-sidebar',
  page:    '--bg-page',
};

/* ─── Contexte ────────────────────────────────────────────────────────────── */
const ThemeContext = createContext({ theme: 'dark', isDark: true, p: DARK, toggle: () => {} });

export function ThemeProvider({ children }) {
  const [theme, setTheme]               = useState(() => localStorage.getItem('smi_theme') || 'dark');
  const [colorOverrides, setColorOverrides] = useState(() => getStoredColors());

  /* Applique data-theme ET les overrides de couleur en inline style */
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('smi_theme', theme);

    Object.entries(CSS_VAR_MAP).forEach(([key, cssVar]) => {
      if (colorOverrides[key]) {
        document.documentElement.style.setProperty(cssVar, colorOverrides[key]);
      } else {
        document.documentElement.style.removeProperty(cssVar);
      }
    });
  }, [theme, colorOverrides]);

  const toggle = () => setTheme(t => t === 'dark' ? 'light' : 'dark');
  const isDark = theme === 'dark';
  const p = isDark ? DARK : LIGHT;

  const setColorOverride = (key, value) => {
    setColorOverrides(prev => {
      const next = { ...prev, [key]: value };
      persistColors(next);
      return next;
    });
  };

  const clearColorOverride = (key) => {
    setColorOverrides(prev => {
      const next = { ...prev };
      delete next[key];
      persistColors(next);
      return next;
    });
  };

  const clearAllColorOverrides = () => {
    setColorOverrides({});
    persistColors({});
  };

  return (
    <ThemeContext.Provider value={{
      theme, isDark, p, toggle, setTheme,
      colorOverrides, setColorOverride, clearColorOverride, clearAllColorOverrides,
    }}>
      {children}
    </ThemeContext.Provider>
  );
}

/* ─── Hook ────────────────────────────────────────────────────────────────── */
export function useTheme() {
  return useContext(ThemeContext);
}

/* ─── Composant bouton toggle ─────────────────────────────────────────────── */
import { Sun, Moon } from 'lucide-react';

export function ThemeToggleBtn() {
  const { isDark, toggle, p } = useTheme();
  return (
    <button
      onClick={toggle}
      title={isDark ? 'Mode clair' : 'Mode sombre'}
      style={{
        width: 34, height: 34, borderRadius: 9,
        border: `1px solid ${p.border2}`,
        background: p.whiteFaint,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer', transition: 'all 0.2s',
        color: isDark ? '#F59E0B' : '#6B7280', flexShrink: 0,
      }}
    >
      {isDark ? <Sun size={15}/> : <Moon size={15}/>}
    </button>
  );
}
