// =====================================================================
// src/WriteGuard.jsx — Helpers React pour le mode lecture seule
// =====================================================================
// Étape E (auth + RGPD) : permet de griser ou de cacher les éléments
// d'interface qui modifient des données, en fonction du rôle de
// l'utilisateur (lecteur = pas d'écriture).
//
// La VRAIE protection des données est côté Supabase (RLS — étape E7).
// Ces composants servent UNIQUEMENT à offrir une UX cohérente : un
// utilisateur en lecture seule ne voit pas de boutons inertes.
//
// Trois patterns disponibles :
//
//   <WriteOnly>...</WriteOnly>
//     Cache les enfants si l'utilisateur ne peut pas écrire.
//     Pratique pour des boutons "Ajouter", "Importer", etc.
//
//   <WriteGate fallback={<MessageReadOnly/>}>...</WriteGate>
//     Idem, mais affiche un fallback au lieu de rien.
//     Utile pour remplacer un formulaire complet par un message.
//
//   useCanWrite()
//     Hook qui retourne le booléen, pour les cas où on veut désactiver
//     un input plutôt que le cacher (préserver la mise en page).
// =====================================================================

import React from 'react';
import { useUser } from './UserContext';

/**
 * Cache complètement les enfants si l'utilisateur n'a pas le droit d'écrire.
 * Préserver la sémantique "ces actions n'existent pas pour vous".
 */
export function WriteOnly({ children }) {
  const { canWrite } = useUser();
  return canWrite ? <>{children}</> : null;
}

/**
 * Affiche les enfants si canWrite, sinon le fallback (texte ou autre).
 */
export function WriteGate({ children, fallback = null }) {
  const { canWrite } = useUser();
  return canWrite ? <>{children}</> : fallback;
}

/**
 * Hook simple — utile pour `disabled={!canWrite}` ou pour conditionner
 * un onClick. Préfère cependant WriteOnly/WriteGate pour le rendu JSX,
 * c'est plus lisible.
 */
export function useCanWrite() {
  const { canWrite } = useUser();
  return canWrite;
}

/**
 * Bandeau de mode lecture seule, à afficher en haut des modules
 * sensibles pour rappeler le contexte au lecteur. Optionnel.
 */
export function ReadOnlyBanner() {
  const { isReadOnly } = useUser();
  if (!isReadOnly) return null;
  return (
    <div style={{
      display:'flex', alignItems:'center', gap:8,
      padding:'8px 14px', borderRadius:9,
      background:'rgba(6,182,212,0.1)', border:'1px solid rgba(6,182,212,0.3)',
      color:'#67E8F9', fontSize:12, fontWeight:600,
    }}>
      <span>👁️</span>
      <span>Mode consultation — vous ne pouvez pas modifier les données</span>
    </div>
  );
}
