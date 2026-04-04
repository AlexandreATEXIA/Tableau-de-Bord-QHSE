/**
 * Exporte un tableau de données en fichier CSV (UTF-8 BOM pour Excel français)
 * @param {Array}  rows     - Tableau d'objets à exporter
 * @param {string} filename - Nom du fichier sans extension
 * @param {Array}  [fields] - Colonnes à inclure (par défaut toutes sauf _*)
 */
export function exportCSV(rows, filename, fields) {
  if (!rows || rows.length === 0) return;
  const cols = fields || Object.keys(rows[0]).filter(k => !k.startsWith('_'));
  const escape = (v) => {
    const s = String(v ?? '').replace(/"/g, '""');
    return /[;\n"]/.test(s) ? `"${s}"` : s;
  };
  const csv = [cols.join(';'), ...rows.map(r => cols.map(c => escape(r[c])).join(';'))].join('\r\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = Object.assign(document.createElement('a'), { href: url, download: filename + '.csv' });
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
