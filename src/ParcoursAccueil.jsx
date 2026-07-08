import React, { useState, useEffect, useMemo } from 'react';
import { useTheme } from './ThemeContext';
import { useToast } from './ToastContext';
import { supabase } from './supabaseClient';
import { WriteOnly } from './WriteGuard';
import { UserPlus, Plus, Check, Ban, RotateCcw, X, Calendar, ChevronLeft, Pencil, Trash2, Save, SlidersHorizontal } from 'lucide-react';
import { computeEcheance, progression, parcoursEstTermine, prochainJalon } from './utils/parcours';
import ConfirmModal from './ConfirmModal';
import JalonsModeleEditor from './JalonsModeleEditor';

const TODAY = () => new Date().toISOString().slice(0, 10);

const STATUT_JALON_STYLE = {
  'Fait':           { color: '#10B981', badge: 'badge-green' },
  'Non applicable': { color: '#64748B', badge: 'badge-blue'  },
  'À faire':        { color: '#F59E0B', badge: 'badge-amber' },
};

export default function ParcoursAccueil() {
  const { p } = useTheme();
  const toast = useToast();

  const [parcours, setParcours]   = useState([]);
  const [jalons, setJalons]       = useState([]);   // tous les jalons des parcours chargés
  const [filtre, setFiltre]       = useState('En cours');
  const [selId, setSelId]         = useState(null);
  const [showStart, setShowStart] = useState(false);
  const [showModele, setShowModele] = useState(false);            // modale « Personnaliser les étapes type »
  const [confirm, setConfirm]     = useState(null);               // confirmation suppression d'étape
  const [editId, setEditId]       = useState(null);               // id du jalon en cours d'édition
  const [editDraft, setEditDraft] = useState({});                 // brouillon d'édition d'un jalon
  const [adding, setAdding]       = useState(false);              // formulaire d'ajout d'étape ouvert
  const [newJalon, setNewJalon]   = useState({ libelle: '', date_echeance: '', responsable: '' });

  const charger = async () => {
    const [rp, rj] = await Promise.all([
      supabase.from('parcours_accueil').select('*').is('archived_at', null).order('created_at', { ascending: false }),
      supabase.from('parcours_jalons').select('*').order('ordre'),
    ]);
    setParcours(rp.data || []);
    setJalons(rj.data || []);
  };

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session || cancelled) return;
      charger();
    };
    tick();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => { if (s && !cancelled) charger(); });
    return () => { cancelled = true; subscription.unsubscribe(); };
  }, []);

  const jalonsDe = (parcoursId) => jalons.filter(j => j.parcours_id === parcoursId);

  const parcoursFiltres = useMemo(() => {
    if (filtre === 'Tous') return parcours;
    return parcours.filter(pc => pc.statut === filtre);
  }, [parcours, filtre]);

  // ── Démarrer un parcours ────────────────────────────────────────────────
  const demarrer = async ({ employe_id, employe, date_debut }) => {
    const { data: pc, error } = await supabase
      .from('parcours_accueil')
      .insert({ employe_id, employe, date_debut, statut: 'En cours' })
      .select().single();
    if (error) { toast.error('Erreur création parcours'); return; }

    const { data: modele } = await supabase
      .from('parcours_modele_jalons').select('*').eq('actif', true).order('ordre');

    const rows = (modele || []).map(m => ({
      parcours_id: pc.id,
      libelle: m.libelle,
      date_echeance: computeEcheance(date_debut, m.delai_valeur, m.delai_unite),
      responsable: m.responsable,
      statut: 'À faire',
      ordre: m.ordre,
    }));
    if (rows.length) {
      const { error: e2 } = await supabase.from('parcours_jalons').insert(rows);
      if (e2) { toast.error('Erreur création des jalons'); return; }
    }
    toast.success('Parcours démarré');
    setShowStart(false);
    await charger();
    setSelId(pc.id);
  };

  // ── Mettre à jour un jalon + clôture auto ───────────────────────────────
  const majJalon = async (jalon, patch) => {
    const { error } = await supabase.from('parcours_jalons').update(patch).eq('id', jalon.id);
    if (error) { toast.error('Erreur mise à jour jalon'); return; }
    const apres = jalons.map(j => j.id === jalon.id ? { ...j, ...patch } : j);
    setJalons(apres);

    const jalonsParcours = apres.filter(j => j.parcours_id === jalon.parcours_id);
    const pc = parcours.find(x => x.id === jalon.parcours_id);
    if (pc && pc.statut === 'En cours' && parcoursEstTermine(jalonsParcours)) {
      await supabase.from('parcours_accueil').update({ statut: 'Terminé' }).eq('id', pc.id);
      setParcours(prev => prev.map(x => x.id === pc.id ? { ...x, statut: 'Terminé' } : x));
      toast.success('Parcours terminé — tous les jalons sont traités');
    }
  };

  const changerStatutParcours = async (pc, statut) => {
    const { error } = await supabase.from('parcours_accueil').update({ statut }).eq('id', pc.id);
    if (error) { toast.error('Erreur'); return; }
    setParcours(prev => prev.map(x => x.id === pc.id ? { ...x, statut } : x));
    toast.success(`Parcours : ${statut}`);
  };

  // ── Éditer les étapes d'un parcours en cours (sans toucher au modèle) ────
  const demarrerEdition = (j) => {
    setEditId(j.id);
    setEditDraft({ libelle: j.libelle, date_echeance: j.date_echeance, responsable: j.responsable || '' });
  };

  const enregistrerEdition = async (j) => {
    const patch = {
      libelle: (editDraft.libelle || '').trim() || j.libelle,
      date_echeance: editDraft.date_echeance || j.date_echeance,
      responsable: (editDraft.responsable || '').trim() || null,
    };
    const { error } = await supabase.from('parcours_jalons').update(patch).eq('id', j.id);
    if (error) { toast.error('Erreur mise à jour étape'); return; }
    setJalons(prev => prev.map(x => x.id === j.id ? { ...x, ...patch } : x));
    setEditId(null);
    toast.success('Étape modifiée');
  };

  const supprimerJalon = async (j) => {
    const { data, error } = await supabase.from('parcours_jalons').delete().eq('id', j.id).select();
    if (error) { toast.error('Erreur suppression étape'); return; }
    if (!data || data.length === 0) { toast.error('Suppression impossible — vérifiez les droits (RLS) sur la base'); return; }
    setJalons(prev => prev.filter(x => x.id !== j.id));
    toast.info('Étape supprimée');
  };

  const ajouterJalon = async (parcoursId) => {
    if (!newJalon.libelle.trim()) { toast.error('Renseignez la dénomination'); return; }
    if (!newJalon.date_echeance)  { toast.error("Renseignez l'échéance"); return; }
    const ordreMax = jalons.filter(x => x.parcours_id === parcoursId).reduce((m, x) => Math.max(m, x.ordre || 0), 0);
    const row = {
      parcours_id: parcoursId,
      libelle: newJalon.libelle.trim(),
      date_echeance: newJalon.date_echeance,
      responsable: newJalon.responsable.trim() || null,
      statut: 'À faire',
      ordre: ordreMax + 1,
    };
    const { data, error } = await supabase.from('parcours_jalons').insert(row).select().single();
    if (error) { toast.error('Erreur ajout étape'); return; }
    setJalons(prev => [...prev, data]);
    setNewJalon({ libelle: '', date_echeance: '', responsable: '' });
    setAdding(false);
    toast.success('Étape ajoutée');
  };

  // ── Rendu détail ────────────────────────────────────────────────────────
  const selected = parcours.find(pc => pc.id === selId);
  if (selected) {
    const js = jalonsDe(selected.id).sort((a, b) => a.ordre - b.ordre);
    const prog = progression(js);
    return (
      <div>
        <button onClick={() => { setSelId(null); setEditId(null); setAdding(false); }} className="btn-secondary" style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 6 }}>
          <ChevronLeft size={16} /> Retour à la liste
        </button>
        <div className="glass-panel p-6" style={{ marginBottom: 16 }}>
          <h2 className="page-title" style={{ marginBottom: 4 }}>{selected.employe || 'Salarié'}</h2>
          <div style={{ color: p.text2, fontSize: 13 }}>
            Début : {selected.date_debut} · Statut : {selected.statut} · {prog.traites}/{prog.total} jalons traités ({prog.pct}%)
          </div>
          <div style={{ height: 8, background: 'var(--border)', borderRadius: 4, marginTop: 10, overflow: 'hidden' }}>
            <div style={{ width: `${prog.pct}%`, height: '100%', background: p.blue }} />
          </div>
          <WriteOnly>
            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              {selected.statut !== 'Terminé'  && <button className="btn-secondary" onClick={() => changerStatutParcours(selected, 'Terminé')}>Terminer</button>}
              {selected.statut !== 'Abandonné' && <button className="btn-secondary" onClick={() => changerStatutParcours(selected, 'Abandonné')}>Abandonner</button>}
              {selected.statut !== 'En cours'  && <button className="btn-secondary" onClick={() => changerStatutParcours(selected, 'En cours')}>Rouvrir</button>}
            </div>
          </WriteOnly>
        </div>

        <div className="glass-panel p-6">
          {js.map(j => {
            const st = STATUT_JALON_STYLE[j.statut] || STATUT_JALON_STYLE['À faire'];
            const enRetard = j.statut === 'À faire' && j.date_echeance <= TODAY();
            const enEdition = editId === j.id;
            return (
              <div key={j.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
                <Calendar size={16} style={{ color: enRetard ? '#EF4444' : p.text2 }} />
                {enEdition ? (
                  <div style={{ flex: 1, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                    <input className="input-modern" style={{ flex: 2, minWidth: 160 }} value={editDraft.libelle} onChange={e => setEditDraft(d => ({ ...d, libelle: e.target.value }))} placeholder="Dénomination" />
                    <input type="date" className="input-modern" style={{ width: 150 }} value={editDraft.date_echeance} onChange={e => setEditDraft(d => ({ ...d, date_echeance: e.target.value }))} />
                    <input className="input-modern" style={{ width: 140 }} value={editDraft.responsable} onChange={e => setEditDraft(d => ({ ...d, responsable: e.target.value }))} placeholder="Responsable" />
                  </div>
                ) : (
                  <div style={{ flex: 1 }}>
                    <div style={{ color: p.text1, fontSize: 14, fontWeight: 600 }}>{j.libelle}</div>
                    <div style={{ color: enRetard ? '#EF4444' : p.text2, fontSize: 12 }}>
                      Échéance : {j.date_echeance}{j.responsable ? ` · ${j.responsable}` : ''}{j.date_realisation ? ` · fait le ${j.date_realisation}` : ''}
                    </div>
                  </div>
                )}
                {!enEdition && <span className={`badge ${st.badge}`}>{j.statut}</span>}
                <WriteOnly>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {enEdition ? (
                      <>
                        <button title="Enregistrer" className="btn-primary" onClick={() => enregistrerEdition(j)}><Save size={16} /></button>
                        <button title="Annuler" className="btn-secondary" onClick={() => setEditId(null)}><X size={16} /></button>
                      </>
                    ) : (
                      <>
                        {j.statut !== 'Fait' &&
                          <button title="Marquer fait" className="btn-secondary" onClick={() => majJalon(j, { statut: 'Fait', date_realisation: TODAY() })}><Check size={16} /></button>}
                        {j.statut !== 'Non applicable' &&
                          <button title="Non applicable" className="btn-secondary" onClick={() => majJalon(j, { statut: 'Non applicable', date_realisation: null })}><Ban size={16} /></button>}
                        {j.statut !== 'À faire' &&
                          <button title="Rouvrir" className="btn-secondary" onClick={() => majJalon(j, { statut: 'À faire', date_realisation: null })}><RotateCcw size={16} /></button>}
                        <button title="Modifier l'étape" className="btn-secondary" onClick={() => demarrerEdition(j)}><Pencil size={16} /></button>
                        <button title="Supprimer l'étape" className="btn-secondary" onClick={() => setConfirm({ message: `Supprimer l'étape « ${j.libelle} » de ce parcours ?`, onConfirm: () => supprimerJalon(j) })}><Trash2 size={16} /></button>
                      </>
                    )}
                  </div>
                </WriteOnly>
              </div>
            );
          })}
          {js.length === 0 && <div style={{ color: p.text2, marginBottom: 12 }}>Aucune étape pour ce parcours.</div>}

          <WriteOnly>
            {adding ? (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', paddingTop: 14 }}>
                <input className="input-modern" style={{ flex: 2, minWidth: 160 }} value={newJalon.libelle} onChange={e => setNewJalon(n => ({ ...n, libelle: e.target.value }))} placeholder="Dénomination" />
                <input type="date" className="input-modern" style={{ width: 150 }} value={newJalon.date_echeance} onChange={e => setNewJalon(n => ({ ...n, date_echeance: e.target.value }))} />
                <input className="input-modern" style={{ width: 140 }} value={newJalon.responsable} onChange={e => setNewJalon(n => ({ ...n, responsable: e.target.value }))} placeholder="Responsable" />
                <button className="btn-primary" onClick={() => ajouterJalon(selected.id)} style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Save size={16} /> Ajouter</button>
                <button className="btn-secondary" onClick={() => { setAdding(false); setNewJalon({ libelle: '', date_echeance: '', responsable: '' }); }}>Annuler</button>
              </div>
            ) : (
              <button className="btn-secondary" onClick={() => setAdding(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 14 }}><Plus size={16} /> Ajouter une étape</button>
            )}
          </WriteOnly>
        </div>

        <ConfirmModal config={confirm} onClose={() => setConfirm(null)} />
      </div>
    );
  }

  // ── Rendu liste ───────────────────────────────────────────────────────────
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 className="page-title flex items-center gap-3"><UserPlus size={22} /> Parcours d'accueil</h2>
        <WriteOnly>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn-secondary" onClick={() => setShowModele(true)} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <SlidersHorizontal size={16} /> Personnaliser les étapes type
            </button>
            <button className="btn-primary" onClick={() => setShowStart(true)} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Plus size={16} /> Démarrer un parcours
            </button>
          </div>
        </WriteOnly>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {['En cours', 'Terminé', 'Abandonné', 'Tous'].map(f => (
          <button key={f} className={filtre === f ? 'btn-primary' : 'btn-secondary'} onClick={() => setFiltre(f)}>{f}</button>
        ))}
      </div>

      <div className="glass-panel p-6">
        {parcoursFiltres.map(pc => {
          const js = jalonsDe(pc.id);
          const prog = progression(js);
          const next = prochainJalon(js);
          const nextRetard = next && next.date_echeance <= TODAY();
          return (
            <div key={pc.id} onClick={() => setSelId(pc.id)} style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 16, padding: '14px 0', borderBottom: '1px solid var(--border)' }}>
              <div style={{ flex: 1 }}>
                <div style={{ color: p.text1, fontSize: 15, fontWeight: 600 }}>{pc.employe || 'Salarié'}</div>
                <div style={{ color: p.text2, fontSize: 12 }}>Début {pc.date_debut} · {prog.traites}/{prog.total} jalons</div>
              </div>
              <div style={{ width: 120 }}>
                <div style={{ height: 6, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ width: `${prog.pct}%`, height: '100%', background: p.blue }} />
                </div>
              </div>
              <div style={{ width: 200, fontSize: 12, color: nextRetard ? '#EF4444' : p.text2 }}>
                {next ? `Prochain : ${next.libelle} (${next.date_echeance})` : pc.statut}
              </div>
            </div>
          );
        })}
        {parcoursFiltres.length === 0 && <div style={{ color: p.text2 }}>Aucun parcours dans ce filtre.</div>}
      </div>

      {showStart && <StartModal onClose={() => setShowStart(false)} onCreate={demarrer} p={p} toast={toast} />}
      {showModele && <ModeleModal onClose={() => setShowModele(false)} p={p} toast={toast} />}
    </div>
  );
}

// ── Modale « Personnaliser les étapes type » (modèle appliqué aux nouveaux parcours) ──
function ModeleModal({ onClose, p, toast }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', zIndex: 1000, padding: 24, overflowY: 'auto' }}>
      <div className="glass-panel p-6" style={{ width: 860, maxWidth: '95vw', marginTop: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ color: p.text1, fontWeight: 700 }}>Personnaliser les étapes type</h3>
          <button className="btn-secondary" onClick={onClose}><X size={18} /></button>
        </div>
        <JalonsModeleEditor p={p} toast={toast} />
      </div>
    </div>
  );
}

// ── Modale de démarrage ─────────────────────────────────────────────────────
function StartModal({ onClose, onCreate, p, toast }) {
  const [employes, setEmployes] = useState([]);
  const [empId, setEmpId]       = useState('');
  const [dateDebut, setDateDebut] = useState('');

  useEffect(() => {
    supabase.from('rh_employes').select('id, nom, prenom, date_entree').eq('actif', true).order('nom')
      .then(({ data }) => setEmployes(data || []));
  }, []);

  const onPick = (id) => {
    setEmpId(id);
    const e = employes.find(x => String(x.id) === String(id));
    if (e && e.date_entree) setDateDebut(e.date_entree);
  };

  const valider = () => {
    const e = employes.find(x => String(x.id) === String(empId));
    if (!e) { toast.error('Choisissez un salarié'); return; }
    if (!dateDebut) { toast.error('Renseignez la date de début'); return; }
    onCreate({ employe_id: e.id, employe: `${e.nom}${e.prenom ? ' ' + e.prenom : ''}`, date_debut: dateDebut });
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div className="glass-panel p-6" style={{ width: 420, maxWidth: '90vw' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ color: p.text1, fontWeight: 700 }}>Démarrer un parcours</h3>
          <button className="btn-secondary" onClick={onClose}><X size={18} /></button>
        </div>
        <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: p.text2, display: 'block', marginBottom: 4 }}>Salarié</label>
        <select className="input-modern" value={empId} onChange={e => onPick(e.target.value)} style={{ width: '100%', marginBottom: 14 }}>
          <option value="">— choisir —</option>
          {employes.map(e => <option key={e.id} value={e.id}>{e.nom} {e.prenom || ''}</option>)}
        </select>
        <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: p.text2, display: 'block', marginBottom: 4 }}>Date de début (date d'entrée pré-remplie)</label>
        <input type="date" className="input-modern" value={dateDebut} onChange={e => setDateDebut(e.target.value)} style={{ width: '100%', marginBottom: 18 }} />
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button className="btn-secondary" onClick={onClose}>Annuler</button>
          <button className="btn-primary" onClick={valider}>Démarrer</button>
        </div>
      </div>
    </div>
  );
}
