import { useState, useMemo } from 'react';
import React from 'react';

/**
 * Hook de tri pour les tableaux.
 * @param {Array} data - tableau de données
 * @param {string|null} defaultKey - colonne de tri par défaut
 * @param {'asc'|'desc'} defaultDir - direction par défaut
 * @returns {{ sorted, sortKey, sortDir, toggle }}
 */
export function useSortable(data, defaultKey = null, defaultDir = 'asc') {
  const [sortKey, setSortKey] = useState(defaultKey);
  const [sortDir, setSortDir] = useState(defaultDir);

  const toggle = (key) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const sorted = useMemo(() => {
    if (!sortKey || !data?.length) return data;
    return [...data].sort((a, b) => {
      let va = a[sortKey] ?? '';
      let vb = b[sortKey] ?? '';
      // Numerique
      if (typeof va === 'number' || typeof vb === 'number') {
        va = Number(va) || 0;
        vb = Number(vb) || 0;
        return sortDir === 'asc' ? va - vb : vb - va;
      }
      // Date (ISO string YYYY-MM-DD)
      if (/^\d{4}-\d{2}-\d{2}/.test(va) && /^\d{4}-\d{2}-\d{2}/.test(vb)) {
        return sortDir === 'asc'
          ? va.localeCompare(vb)
          : vb.localeCompare(va);
      }
      // Texte
      va = String(va).toLowerCase();
      vb = String(vb).toLowerCase();
      if (va < vb) return sortDir === 'asc' ? -1 : 1;
      if (va > vb) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [data, sortKey, sortDir]);

  return { sorted, sortKey, sortDir, toggle };
}

/**
 * Composant <th> cliquable pour le tri.
 * Usage : <SortTh col="echeance" {...sortProps}>Échéance</SortTh>
 */
export function SortTh({ col, sortKey, sortDir, toggle, children, style, className }) {
  const active = sortKey === col;
  return (
    <th
      onClick={() => toggle(col)}
      style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap', ...style }}
      className={className}
    >
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        {children}
        <span style={{
          fontSize: 9,
          opacity: active ? 1 : 0.25,
          transition: 'opacity 0.15s',
          color: active ? '#3B82F6' : 'inherit',
        }}>
          {active && sortDir === 'desc' ? '▼' : '▲'}
        </span>
      </span>
    </th>
  );
}
