/* eslint-disable react-refresh/only-export-components --
   * Cette règle ne tolère que des exports de composants dans un .jsx, mais
   * ce fichier exporte aussi des constantes, hooks ou contextes utilisés
   * ailleurs dans l'app. Splitter en fichier .js séparé n'apporterait pas
   * de bénéfice pratique (HMR fonctionne, la valeur est statique). */
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

  // Étape E (post-RLS) : on attend la session Supabase avant le fetch
  // pour ne pas se prendre un 401 au démarrage avant le login.
  useEffect(() => {
    let cancelled = false;

    const tick = async () => {
      if (cancelled) return;
      const { data: { session } } = await supabase.auth.getSession();
      if (!session || cancelled) return;
      chargerEmployes();
    };

    tick();

    // Recharge dès qu'un utilisateur se connecte (utile sur first login)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session && !cancelled) chargerEmployes();
    });

    return () => { cancelled = true; subscription.unsubscribe(); };
  }, []);

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