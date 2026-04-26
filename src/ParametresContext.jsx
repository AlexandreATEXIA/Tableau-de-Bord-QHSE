/* eslint-disable react-refresh/only-export-components --
   * Cette règle ne tolère que des exports de composants dans un .jsx, mais
   * ce fichier exporte aussi des constantes, hooks ou contextes utilisés
   * ailleurs dans l'app. Splitter en fichier .js séparé n'apporterait pas
   * de bénéfice pratique (HMR fonctionne, la valeur est statique). */
import React, { createContext, useContext, useState, useCallback } from 'react';

const STORAGE_KEY = 'smi_parametres';

export const PARAMS_DEFAULT = {
  // Calculs TF/TG
  effectif:          50,
  heuresAnnuelles:   1607,
  // Alertes habilitations
  seuilAlertRouge:   30,   // jours avant expiry → alerte rouge
  seuilAlertOrange:  90,   // jours avant expiry → alerte orange
  // Affichage
  devise:            '€',
  annee:             new Date().getFullYear(),
  // Entreprise
  secteur:           'Industrie',
  // Coûts accidents
  coutJournalierAT:  300, // € par jour de travail perdu
};

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return PARAMS_DEFAULT;
    return { ...PARAMS_DEFAULT, ...JSON.parse(raw) };
  } catch {
    return PARAMS_DEFAULT;
  }
}

const ParametresContext = createContext(null);

export function ParametresProvider({ children }) {
  const [params, setParams] = useState(load);

  const saveParams = useCallback((newParams) => {
    const merged = { ...params, ...newParams };
    setParams(merged);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
  }, [params]);

  return (
    <ParametresContext.Provider value={{ params, saveParams }}>
      {children}
    </ParametresContext.Provider>
  );
}

export function useParametres() {
  const ctx = useContext(ParametresContext);
  if (!ctx) throw new Error('useParametres doit être utilisé dans ParametresProvider');
  return ctx;
}