import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { Plus, Trash2 } from 'lucide-react';

// Modèle de jalons par défaut appliqué aux nouveaux parcours d'accueil.
const JALONS_DEFAUT = [
  { libelle: "Accueil, remise EPI & livret d'accueil", delai_valeur: 1, delai_unite: 'jours', responsable: 'RH',      ordre: 1, actif: true },
  { libelle: 'Point fin de 1re semaine',                delai_valeur: 7, delai_unite: 'jours', responsable: 'Manager', ordre: 2, actif: true },
  { libelle: 'Entretien de suivi 1 mois',               delai_valeur: 1, delai_unite: 'mois',  responsable: 'Manager', ordre: 3, actif: true },
  { libelle: "Bilan fin de période d'essai",            delai_valeur: 2, delai_unite: 'mois',  responsable: 'RH',      ordre: 4, actif: true },
  { libelle: 'Entretien 3 mois',                        delai_valeur: 3, delai_unite: 'mois',  responsable: 'Manager', ordre: 5, actif: true },
  { libelle: 'Entretien 6 mois',                        delai_valeur: 6, delai_unite: 'mois',  responsable: 'Manager', ordre: 6, actif: true },
  { libelle: 'Bilan final du parcours',                 delai_valeur: 9, delai_unite: 'mois',  responsable: 'RH',      ordre: 7, actif: true },
];

// Éditeur du modèle type d'étapes (parcours_modele_jalons).
// Réutilisé dans Paramètres et dans la modale « Personnaliser les étapes type »
// de la page Parcours d'accueil. Modifier le modèle n'impacte que les nouveaux
// parcours, jamais ceux déjà démarrés.
export default function JalonsModeleEditor({ p, toast }) {
  const [rows, setRows] = useState([]);
  const [loaded, setLoaded] = useState(false);

  const charger = async () => {
    const { data } = await supabase.from('parcours_modele_jalons').select('*').order('ordre');
    setRows(data || []);
    setLoaded(true);
  };
  useEffect(() => { charger(); }, []);

  const setRow = (i, key, val) => setRows(rs => rs.map((r, idx) => idx === i ? { ...r, [key]: val } : r));

  const ajouter = () => setRows(rs => [...rs, { libelle: 'Nouveau jalon', delai_valeur: 1, delai_unite: 'mois', responsable: '', ordre: rs.length + 1, actif: true, _new: true }]);

  const supprimer = async (i) => {
    const r = rows[i];
    if (r.id) await supabase.from('parcours_modele_jalons').delete().eq('id', r.id);
    setRows(rs => rs.filter((_, idx) => idx !== i));
    toast.info('Jalon supprimé');
  };

  const enregistrer = async () => {
    for (const r of rows) {
      const payload = { libelle: r.libelle, delai_valeur: Number(r.delai_valeur) || 0, delai_unite: r.delai_unite, responsable: r.responsable, ordre: Number(r.ordre) || 0, actif: !!r.actif };
      if (r.id) await supabase.from('parcours_modele_jalons').update(payload).eq('id', r.id);
      else await supabase.from('parcours_modele_jalons').insert(payload);
    }
    toast.success('Modèle de jalons enregistré');
    charger();
  };

  const restaurer = async () => {
    await supabase.from('parcours_modele_jalons').delete().neq('id', 0);
    await supabase.from('parcours_modele_jalons').insert(JALONS_DEFAUT);
    toast.info('Modèle par défaut restauré');
    charger();
  };

  if (!loaded) return <div style={{ color: p.text2 }}>Chargement…</div>;

  return (
    <div>
      <p style={{ fontSize: 12, color: p.text2, marginBottom: 12 }}>
        Modifier le modèle n'affecte pas les parcours déjà démarrés. Délai compté depuis la date d'entrée.
      </p>
      <div style={{ display: 'grid', gap: 8 }}>
        {rows.map((r, i) => (
          <div key={r.id || `new-${i}`} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input className="input-modern" style={{ flex: 2 }} value={r.libelle} onChange={e => setRow(i, 'libelle', e.target.value)} placeholder="Libellé" />
            <input className="input-modern" type="number" style={{ width: 70 }} value={r.delai_valeur} onChange={e => setRow(i, 'delai_valeur', e.target.value)} />
            <select className="input-modern" style={{ width: 90 }} value={r.delai_unite} onChange={e => setRow(i, 'delai_unite', e.target.value)}>
              <option value="jours">jours</option>
              <option value="mois">mois</option>
            </select>
            <input className="input-modern" style={{ width: 110 }} value={r.responsable || ''} onChange={e => setRow(i, 'responsable', e.target.value)} placeholder="Responsable" />
            <input className="input-modern" type="number" style={{ width: 60 }} value={r.ordre} onChange={e => setRow(i, 'ordre', e.target.value)} title="Ordre" />
            <label style={{ fontSize: 12, color: p.text2, display: 'flex', alignItems: 'center', gap: 4 }}>
              <input type="checkbox" checked={!!r.actif} onChange={e => setRow(i, 'actif', e.target.checked)} /> actif
            </label>
            <button className="btn-secondary" onClick={() => supprimer(i)} title="Supprimer"><Trash2 size={16} /></button>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
        <button className="btn-secondary" onClick={ajouter} style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Plus size={16} /> Ajouter un jalon</button>
        <button className="btn-primary" onClick={enregistrer}>Enregistrer</button>
        <button className="btn-secondary" onClick={restaurer}>Restaurer le modèle par défaut</button>
      </div>
    </div>
  );
}
