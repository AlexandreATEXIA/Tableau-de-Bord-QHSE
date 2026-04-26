/* eslint-disable react-refresh/only-export-components --
   * Cette règle ne tolère que des exports de composants dans un .jsx, mais
   * ce fichier exporte aussi des constantes, hooks ou contextes utilisés
   * ailleurs dans l'app. Splitter en fichier .js séparé n'apporterait pas
   * de bénéfice pratique (HMR fonctionne, la valeur est statique). */
import React, { createContext, useContext, useState, useMemo } from 'react';

const AnneeContext = createContext(null);

const ANNEE_COURANTE = new Date().getFullYear();

export function getAnneesDispo() {
  const annees = [];
  for (let a = ANNEE_COURANTE - 3; a <= ANNEE_COURANTE + 1; a++) annees.push(a);
  return annees;
}

// Helper : plage ISO pour une année (+ filtre trimestre optionnel)
export function plageAnnee(annee, trimestre = null) {
  if (trimestre !== null) {
    const m0 = (trimestre - 1) * 3;              // 0, 3, 6, 9
    const debut = `${annee}-${String(m0 + 1).padStart(2, '0')}-01`;
    const finM  = m0 + 3;
    const fin   = finM >= 12
      ? `${annee + 1}-01-01`
      : `${annee}-${String(finM + 1).padStart(2, '0')}-01`;
    return { debut, fin };
  }
  return { debut: `${annee}-01-01`, fin: `${annee + 1}-01-01` };
}

export function AnneeProvider({ children }) {
  const [anneeActive, setAnneeActive] = useState(() => {
    try {
      const s = localStorage.getItem('smi_annee');
      return s ? Number(s) : ANNEE_COURANTE;
    } catch { return ANNEE_COURANTE; }
  });

  const [trimestre, setTrimestreState] = useState(null); // null = toute l'année

  const setAnnee = (a) => {
    setAnneeActive(a);
    localStorage.setItem('smi_annee', String(a));
  };

  const setTrimestre = (t) => setTrimestreState(t);

  // Plage pré-calculée = anneeActive + trimestre courant
  const plageActive = useMemo(() => plageAnnee(anneeActive, trimestre), [anneeActive, trimestre]);

  return (
    <AnneeContext.Provider value={{
      anneeActive, setAnnee, anneesDispo: getAnneesDispo(),
      trimestre, setTrimestre, plageActive,
    }}>
      {children}
    </AnneeContext.Provider>
  );
}

export function useAnnee() {
  const ctx = useContext(AnneeContext);
  if (!ctx) throw new Error('useAnnee doit être utilisé dans AnneeProvider');
  return ctx;
}