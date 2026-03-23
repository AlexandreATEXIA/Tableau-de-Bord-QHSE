import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from './supabaseClient';

const EmployesContext = createContext([]);

export function EmployesProvider({ children }) {
  const [employes, setEmployes] = useState([]);

  const chargerEmployes = async () => {
    const { data } = await supabase
      .from('rh_employes')
      .select('id, nom, prenom, poste, service')
      .eq('actif', true)
      .order('nom');
    if (data) setEmployes(data);
  };

  useEffect(() => { chargerEmployes(); }, []);

  // Noms complets pour les menus déroulants
  const nomsComplets = employes.map(e => `${e.nom}${e.prenom ? ' ' + e.prenom : ''}`).filter(Boolean);

  return (
    <EmployesContext.Provider value={{ employes, nomsComplets, chargerEmployes }}>
      {children}
    </EmployesContext.Provider>
  );
}

export function useEmployes() {
  return useContext(EmployesContext);
}

// Composant input avec datalist auto-complété depuis les employés
export function InputEmploye({ value, onChange, onBlur, placeholder = 'Nom de l\'employé...', style = {} }) {
  const { nomsComplets } = useEmployes();
  return (
    <>
      <input
        type="text"
        value={value || ''}
        onChange={onChange}
        onBlur={onBlur}
        placeholder={placeholder}
        list="employes-global-list"
        className="input-modern"
        style={style}
      />
      <datalist id="employes-global-list">
        {nomsComplets.map(n => <option key={n} value={n}/>)}
      </datalist>
    </>
  );
}
