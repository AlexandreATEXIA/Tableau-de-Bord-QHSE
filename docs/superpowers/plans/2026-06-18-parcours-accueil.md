# Parcours d'accueil nouveau salarié — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter un module « Parcours d'accueil » qui suit chaque nouveau salarié sur 9 mois via des jalons datés configurables, avec un badge d'alerte in-app aux dates de jalon.

**Architecture:** 3 tables Supabase (modèle de jalons partagé + parcours par salarié + jalons instanciés en snapshot). Un module React dédié (`ParcoursAccueil.jsx`) branché dans la sidebar de `App.jsx`. Le modèle de jalons est édité dans une nouvelle section de `Parametres.jsx`. Le badge réutilise le compteur existant `useAlerteCounts`.

**Tech Stack:** React 19, Vite, Supabase JS (Postgres + RLS via `public.can_write()`), lucide-react, classes CSS maison (`glass-panel`, `input-modern`, `nav-badge`, `badge-*`).

> **Note outillage / TDD :** le projet n'a pas de framework de test. La vérification se fait via :
> contrôles SQL post-migration (dans Supabase SQL Editor), `npm run lint`, `npm run build`,
> contrôle de logique pure via `node -e`, et tests manuels dans l'app lancée (`npm run dev`).
> Chaque tâche se termine par un commit.

---

## File Structure

**Créés**
- `db/migrations/20260618000001_parcours_accueil.sql` — 3 tables + RLS + seed du modèle
- `src/utils/parcours.js` — logique pure : calcul d'échéance, progression, clôture, alerte
- `src/ParcoursAccueil.jsx` — module (liste + détail + démarrage)

**Modifiés**
- `src/useAlerteCounts.js` — ajout du compteur `parcours`
- `src/App.jsx` — import, entrée sidebar, route, mapping du compteur
- `src/Parametres.jsx` — section éditeur du modèle de jalons
- `docs/GUIDE_INSTALLATION_COLLEGUE.md` & `db/migrations/README.md` — ajout de la migration à appliquer

---

## Task 1 : Migration SQL (tables + RLS + seed)

**Files:**
- Create: `db/migrations/20260618000001_parcours_accueil.sql`

- [ ] **Step 1 : Écrire le fichier de migration**

Créer `db/migrations/20260618000001_parcours_accueil.sql` avec exactement :

```sql
-- =====================================================================
-- Migration : Parcours d'accueil nouveau salarié
-- Intention : suivi 9 mois à jalons configurables + alerte in-app.
-- 3 tables : modèle de jalons (partagé), parcours (par salarié),
--            jalons instanciés (snapshot du modèle au démarrage).
-- RLS alignée sur les tables métier : lecture authentifiés,
--      écriture conditionnée par public.can_write().
-- =====================================================================

-- 1. Modèle de jalons (configurable dans Paramètres)
CREATE TABLE IF NOT EXISTS public.parcours_modele_jalons (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  libelle       text NOT NULL,
  delai_valeur  integer NOT NULL DEFAULT 1,
  delai_unite   text NOT NULL DEFAULT 'mois',   -- 'jours' | 'mois'
  responsable   text,
  ordre         integer NOT NULL DEFAULT 0,
  actif         boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- 2. Parcours d'un salarié
CREATE TABLE IF NOT EXISTS public.parcours_accueil (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  employe_id   bigint,
  employe      text,
  date_debut   date NOT NULL,
  statut       text NOT NULL DEFAULT 'En cours',  -- 'En cours' | 'Terminé' | 'Abandonné'
  commentaire  text,
  archived_at  timestamptz,
  archived_by  text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  created_by   text
);

-- 3. Jalons instanciés d'un parcours
CREATE TABLE IF NOT EXISTS public.parcours_jalons (
  id               bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  parcours_id      bigint NOT NULL REFERENCES public.parcours_accueil(id) ON DELETE CASCADE,
  libelle          text NOT NULL,
  date_echeance    date NOT NULL,
  responsable      text,
  statut           text NOT NULL DEFAULT 'À faire',  -- 'À faire' | 'Fait' | 'Non applicable'
  date_realisation date,
  commentaire      text,
  ordre            integer NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_parcours_jalons_parcours ON public.parcours_jalons(parcours_id);

-- RLS
ALTER TABLE public.parcours_modele_jalons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parcours_accueil       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parcours_jalons        ENABLE ROW LEVEL SECURITY;

CREATE POLICY "modele_lecture"  ON public.parcours_modele_jalons FOR SELECT TO authenticated USING (true);
CREATE POLICY "modele_ecriture" ON public.parcours_modele_jalons FOR ALL    TO authenticated USING (public.can_write()) WITH CHECK (public.can_write());

CREATE POLICY "parcours_lecture"  ON public.parcours_accueil FOR SELECT TO authenticated USING (true);
CREATE POLICY "parcours_ecriture" ON public.parcours_accueil FOR ALL    TO authenticated USING (public.can_write()) WITH CHECK (public.can_write());

CREATE POLICY "jalons_lecture"  ON public.parcours_jalons FOR SELECT TO authenticated USING (true);
CREATE POLICY "jalons_ecriture" ON public.parcours_jalons FOR ALL    TO authenticated USING (public.can_write()) WITH CHECK (public.can_write());

-- Seed du modèle par défaut (modifiable ensuite dans Paramètres)
INSERT INTO public.parcours_modele_jalons (libelle, delai_valeur, delai_unite, responsable, ordre) VALUES
  ('Accueil, remise EPI & livret d''accueil', 1, 'jours', 'RH',      1),
  ('Point fin de 1re semaine',                7, 'jours', 'Manager', 2),
  ('Entretien de suivi 1 mois',               1, 'mois',  'Manager', 3),
  ('Bilan fin de période d''essai',           2, 'mois',  'RH',      4),
  ('Entretien 3 mois',                        3, 'mois',  'Manager', 5),
  ('Entretien 6 mois',                        6, 'mois',  'Manager', 6),
  ('Bilan final du parcours',                 9, 'mois',  'RH',      7);

-- =====================================================================
-- VALIDATION POST-MIGRATION (exécuter et vérifier les résultats)
-- =====================================================================
-- Doit retourner 3 :
SELECT count(*) AS tables_creees FROM information_schema.tables
  WHERE table_schema='public'
    AND table_name IN ('parcours_modele_jalons','parcours_accueil','parcours_jalons');
-- Doit retourner 7 :
SELECT count(*) AS jalons_seed FROM public.parcours_modele_jalons;
```

- [ ] **Step 2 : Appliquer la migration dans Supabase**

Dashboard Supabase → SQL Editor → coller le contenu du fichier → Run.
Expected : les 2 requêtes de validation finales retournent `tables_creees = 3` et `jalons_seed = 7`, sans erreur rouge.

- [ ] **Step 3 : Commit**

```bash
git add db/migrations/20260618000001_parcours_accueil.sql
git commit -m "feat(parcours): migration SQL tables + RLS + seed jalons"
```

---

## Task 2 : Logique pure (calcul d'échéance, progression, clôture, alerte)

**Files:**
- Create: `src/utils/parcours.js`

- [ ] **Step 1 : Écrire les helpers**

Créer `src/utils/parcours.js` avec exactement :

```javascript
// Logique pure du module Parcours d'accueil — testable sans Supabase ni React.

// Calcule la date d'échéance (YYYY-MM-DD) d'un jalon à partir d'une date
// de début et d'un délai. 'mois' = mois calendaire ; 'jours' = jours.
export function computeEcheance(dateDebut, delaiValeur, delaiUnite) {
  const d = new Date(`${dateDebut}T00:00:00`);
  const n = Number(delaiValeur) || 0;
  if (delaiUnite === 'mois') d.setMonth(d.getMonth() + n);
  else d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

// Progression d'un parcours : un jalon est "traité" s'il est Fait ou Non applicable.
export function progression(jalons) {
  const total = jalons.length;
  const traites = jalons.filter(j => j.statut === 'Fait' || j.statut === 'Non applicable').length;
  const pct = total === 0 ? 0 : Math.round((traites / total) * 100);
  return { traites, total, pct };
}

// Un parcours est terminé quand il a au moins un jalon et plus aucun "À faire".
export function parcoursEstTermine(jalons) {
  return jalons.length > 0 && jalons.every(j => j.statut !== 'À faire');
}

// Un jalon est en alerte s'il est encore À faire et que son échéance est atteinte/dépassée.
export function jalonEnAlerte(jalon, todayISO) {
  return jalon.statut === 'À faire' && jalon.date_echeance <= todayISO;
}

// Prochain jalon À faire (le plus proche dans le temps), ou null.
export function prochainJalon(jalons) {
  const aFaire = jalons
    .filter(j => j.statut === 'À faire')
    .sort((a, b) => a.date_echeance.localeCompare(b.date_echeance));
  return aFaire[0] || null;
}
```

- [ ] **Step 2 : Vérifier la logique pure via Node**

Run :
```bash
node --input-type=module -e "
import { computeEcheance, progression, parcoursEstTermine, jalonEnAlerte } from './src/utils/parcours.js';
console.assert(computeEcheance('2026-01-31',1,'mois')==='2026-03-03' || computeEcheance('2026-01-31',1,'mois')==='2026-03-02', 'mois calendaire');
console.assert(computeEcheance('2026-01-01',7,'jours')==='2026-01-08', 'jours');
console.assert(computeEcheance('2026-01-01',9,'mois')==='2026-10-01', '9 mois');
console.assert(progression([{statut:'Fait'},{statut:'À faire'}]).pct===50, 'progression 50%');
console.assert(parcoursEstTermine([{statut:'Fait'},{statut:'Non applicable'}])===true, 'termine');
console.assert(parcoursEstTermine([{statut:'Fait'},{statut:'À faire'}])===false, 'pas termine');
console.assert(jalonEnAlerte({statut:'À faire',date_echeance:'2020-01-01'},'2026-06-18')===true, 'alerte');
console.assert(jalonEnAlerte({statut:'Fait',date_echeance:'2020-01-01'},'2026-06-18')===false, 'pas alerte si fait');
console.log('OK helpers parcours');
"
```
Expected : affiche `OK helpers parcours` sans message d'assertion échouée.

- [ ] **Step 3 : Lint**

Run : `npm run lint`
Expected : pas d'erreur sur `src/utils/parcours.js`.

- [ ] **Step 4 : Commit**

```bash
git add src/utils/parcours.js
git commit -m "feat(parcours): helpers purs (échéance, progression, clôture, alerte)"
```

---

## Task 3 : Module ParcoursAccueil.jsx

**Files:**
- Create: `src/ParcoursAccueil.jsx`

- [ ] **Step 1 : Écrire le composant**

Créer `src/ParcoursAccueil.jsx` avec exactement :

```jsx
import React, { useState, useEffect, useMemo } from 'react';
import { useTheme } from './ThemeContext';
import { useToast } from './ToastContext';
import { supabase } from './supabaseClient';
import { WriteOnly } from './WriteGuard';
import { UserPlus, Plus, Check, Ban, RotateCcw, X, Calendar, ChevronLeft } from 'lucide-react';
import { computeEcheance, progression, parcoursEstTermine, prochainJalon } from './utils/parcours';

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
      setParcours(parcours.map(x => x.id === pc.id ? { ...x, statut: 'Terminé' } : x));
      toast.success('Parcours terminé — tous les jalons sont traités');
    }
  };

  const changerStatutParcours = async (pc, statut) => {
    const { error } = await supabase.from('parcours_accueil').update({ statut }).eq('id', pc.id);
    if (error) { toast.error('Erreur'); return; }
    setParcours(parcours.map(x => x.id === pc.id ? { ...x, statut } : x));
    toast.success(`Parcours : ${statut}`);
  };

  // ── Rendu détail ────────────────────────────────────────────────────────
  const selected = parcours.find(pc => pc.id === selId);
  if (selected) {
    const js = jalonsDe(selected.id).sort((a, b) => a.ordre - b.ordre);
    const prog = progression(js);
    return (
      <div>
        <button onClick={() => setSelId(null)} className="btn-ghost" style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 6 }}>
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
            return (
              <div key={j.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
                <Calendar size={16} style={{ color: enRetard ? '#EF4444' : p.text2 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ color: p.text1, fontSize: 14, fontWeight: 600 }}>{j.libelle}</div>
                  <div style={{ color: enRetard ? '#EF4444' : p.text2, fontSize: 12 }}>
                    Échéance : {j.date_echeance}{j.responsable ? ` · ${j.responsable}` : ''}{j.date_realisation ? ` · fait le ${j.date_realisation}` : ''}
                  </div>
                </div>
                <span className={`badge ${st.badge}`}>{j.statut}</span>
                <WriteOnly>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {j.statut !== 'Fait' &&
                      <button title="Marquer fait" className="btn-icon" onClick={() => majJalon(j, { statut: 'Fait', date_realisation: TODAY() })}><Check size={16} /></button>}
                    {j.statut !== 'Non applicable' &&
                      <button title="Non applicable" className="btn-icon" onClick={() => majJalon(j, { statut: 'Non applicable', date_realisation: null })}><Ban size={16} /></button>}
                    {j.statut !== 'À faire' &&
                      <button title="Rouvrir" className="btn-icon" onClick={() => majJalon(j, { statut: 'À faire', date_realisation: null })}><RotateCcw size={16} /></button>}
                  </div>
                </WriteOnly>
              </div>
            );
          })}
          {js.length === 0 && <div style={{ color: p.text2 }}>Aucun jalon (le modèle était vide au démarrage).</div>}
        </div>
      </div>
    );
  }

  // ── Rendu liste ───────────────────────────────────────────────────────────
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 className="page-title flex items-center gap-3"><UserPlus size={22} /> Parcours d'accueil</h2>
        <WriteOnly>
          <button className="btn-primary" onClick={() => setShowStart(true)} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Plus size={16} /> Démarrer un parcours
          </button>
        </WriteOnly>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        {['En cours', 'Terminé', 'Abandonné', 'Tous'].map(f => (
          <button key={f} className={filtre === f ? 'btn-secondary' : 'btn-ghost'} onClick={() => setFiltre(f)}>{f}</button>
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
          <button className="btn-icon" onClick={onClose}><X size={18} /></button>
        </div>
        <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: p.text2, display: 'block', marginBottom: 4 }}>Salarié</label>
        <select className="input-modern" value={empId} onChange={e => onPick(e.target.value)} style={{ width: '100%', marginBottom: 14 }}>
          <option value="">— choisir —</option>
          {employes.map(e => <option key={e.id} value={e.id}>{e.nom} {e.prenom || ''}</option>)}
        </select>
        <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', color: p.text2, display: 'block', marginBottom: 4 }}>Date de début (date d'entrée pré-remplie)</label>
        <input type="date" className="input-modern" value={dateDebut} onChange={e => setDateDebut(e.target.value)} style={{ width: '100%', marginBottom: 18 }} />
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button className="btn-ghost" onClick={onClose}>Annuler</button>
          <button className="btn-primary" onClick={valider}>Démarrer</button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2 : Lint**

Run : `npm run lint`
Expected : pas d'erreur sur `src/ParcoursAccueil.jsx`. (Si une classe `btn-*` ou `badge` n'existe pas, le lint ne le signale pas — c'est validé visuellement à l'étape suivante via les autres modules qui utilisent les mêmes classes.)

- [ ] **Step 3 : Build**

Run : `npm run build`
Expected : build réussi sans erreur de compilation/import.

- [ ] **Step 4 : Commit**

```bash
git add src/ParcoursAccueil.jsx
git commit -m "feat(parcours): module liste + détail + démarrage de parcours"
```

---

## Task 4 : Brancher le module dans la sidebar (App.jsx)

**Files:**
- Modify: `src/App.jsx` (imports ~ligne 41 ; sidebar ~ligne 217 ; route ~ligne 488)

- [ ] **Step 1 : Importer le module**

Après la ligne `import RGPDModule            from './RGPDModule';` (ligne 41), ajouter :

```jsx
import ParcoursAccueil       from './ParcoursAccueil';
```

- [ ] **Step 2 : Ajouter l'icône lucide**

Dans le bloc d'import `lucide-react` de `App.jsx` (qui se termine ligne 10 par `} from 'lucide-react';`), ajouter `UserPlus` à la liste des icônes importées (ex. ajouter `UserPlus,` parmi les autres noms).

- [ ] **Step 3 : Ajouter l'entrée de sidebar**

Dans le groupe `section: 'Modules QHSE'`, juste après la ligne `{ id:'rh',          label:'Social & RH',          icon:Users },` (ligne 212), ajouter :

```jsx
      { id:'parcours',    label:"Parcours d'accueil",   icon:UserPlus,      badge:'NEW', badgeClass:'amber' },
```

- [ ] **Step 4 : Ajouter la route de rendu**

Juste après la ligne `{activeTab === 'rh'            && <SocialRH />}` (ligne 488), ajouter :

```jsx
            {activeTab === 'parcours'      && <ParcoursAccueil />}
```

- [ ] **Step 5 : Build**

Run : `npm run build`
Expected : build réussi.

- [ ] **Step 6 : Test manuel**

Run : `npm run dev`, se connecter, cliquer l'onglet « Parcours d'accueil ».
Expected : la page liste s'affiche (vide), bouton « Démarrer un parcours » visible. Démarrer un parcours pour un salarié actif → ses jalons apparaissent aux bonnes dates calculées depuis la date d'entrée.

- [ ] **Step 7 : Commit**

```bash
git add src/App.jsx
git commit -m "feat(parcours): onglet sidebar + route du module"
```

---

## Task 5 : Compteur d'alerte (badge in-app)

**Files:**
- Modify: `src/useAlerteCounts.js`
- Modify: `src/App.jsx:326-332` (objet `ALERT_COUNTS`)

- [ ] **Step 1 : Ajouter la requête de comptage dans useAlerteCounts.js**

Dans `src/useAlerteCounts.js`, le `Promise.all` charge actuellement 5 requêtes `[r1, r2, r3, r4, r5]`. Remplacer la déstructuration et ajouter une 6e requête. Modifier la ligne :

```javascript
    const [r1, r2, r3, r4, r5] = await Promise.all([
```
en :
```javascript
    const [r1, r2, r3, r4, r5, r6] = await Promise.all([
```

Puis, juste avant la fermeture `]);` du `Promise.all` (après la requête `habilitations`), ajouter cette 6e requête :

```javascript
      // jalons de parcours en cours, échus et non faits
      supabase.from('parcours_jalons')
        .select('id, date_echeance, statut, parcours_accueil!inner(statut, archived_at)')
        .eq('statut', 'À faire')
        .lte('date_echeance', now)
        .eq('parcours_accueil.statut', 'En cours')
        .is('parcours_accueil.archived_at', null),
```

Puis dans l'objet `setCounts({ ... })`, ajouter la clé :

```javascript
      parcours:  r6.count ?? (r6.data ? r6.data.length : 0),
```

> Note : la jointure `parcours_accueil!inner(...)` requiert que PostgREST détecte la clé
> étrangère `parcours_jalons.parcours_id → parcours_accueil.id` (créée en Task 1). Le comptage
> exact via `count` n'est pas garanti avec un filtre sur table jointe ; on récupère donc les
> lignes et on prend `.length`. Pour cela, retirer `head: true` n'est pas nécessaire ici car on
> ne l'utilise pas sur r6. La requête ci-dessus renvoie `data` → on compte `data.length`.

- [ ] **Step 2 : Mapper le compteur dans App.jsx**

Dans `src/App.jsx`, objet `ALERT_COUNTS` (lignes 326-332), ajouter la ligne :

```jsx
    parcours:  counts.parcours,
```

- [ ] **Step 3 : Test manuel**

Run : `npm run dev`. Créer un parcours avec une date de début ancienne (ex. il y a 1 an) de sorte que des jalons soient échus et non faits.
Expected : un badge numérique rouge apparaît sur l'onglet « Parcours d'accueil » égal au nombre de jalons échus non faits. Marquer ces jalons « Fait » → le badge diminue (au plus tard au rafraîchissement, max 5 min ; recharger la page pour voir immédiatement).

- [ ] **Step 4 : Commit**

```bash
git add src/useAlerteCounts.js src/App.jsx
git commit -m "feat(parcours): badge d'alerte des jalons échus non faits"
```

---

## Task 6 : Éditeur du modèle de jalons (Parametres.jsx)

**Files:**
- Modify: `src/Parametres.jsx` (ajout import supabase + nouvelle Section + sous-composant)

- [ ] **Step 1 : Importer supabase et les icônes**

En haut de `src/Parametres.jsx`, après les imports existants, ajouter :

```jsx
import { supabase } from './supabaseClient';
```

Puis compléter la ligne d'import lucide-react existante (qui contient déjà
`Settings, Save, RotateCcw, Users, Bell, Factory, AlertTriangle, TrendingDown, User, Palette`)
en y ajoutant les 3 icônes nécessaires : `Plus, Trash2, UserPlus`.

- [ ] **Step 2 : Écrire le sous-composant éditeur**

Dans `src/Parametres.jsx`, avant `export default function Parametres()`, ajouter ce composant :

```jsx
const JALONS_DEFAUT = [
  { libelle: "Accueil, remise EPI & livret d'accueil", delai_valeur: 1, delai_unite: 'jours', responsable: 'RH',      ordre: 1, actif: true },
  { libelle: 'Point fin de 1re semaine',                delai_valeur: 7, delai_unite: 'jours', responsable: 'Manager', ordre: 2, actif: true },
  { libelle: 'Entretien de suivi 1 mois',               delai_valeur: 1, delai_unite: 'mois',  responsable: 'Manager', ordre: 3, actif: true },
  { libelle: "Bilan fin de période d'essai",            delai_valeur: 2, delai_unite: 'mois',  responsable: 'RH',      ordre: 4, actif: true },
  { libelle: 'Entretien 3 mois',                        delai_valeur: 3, delai_unite: 'mois',  responsable: 'Manager', ordre: 5, actif: true },
  { libelle: 'Entretien 6 mois',                        delai_valeur: 6, delai_unite: 'mois',  responsable: 'Manager', ordre: 6, actif: true },
  { libelle: 'Bilan final du parcours',                 delai_valeur: 9, delai_unite: 'mois',  responsable: 'RH',      ordre: 7, actif: true },
];

function JalonsModeleEditor({ p, toast }) {
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
            <button className="btn-icon" onClick={() => supprimer(i)} title="Supprimer"><Trash2 size={16} /></button>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
        <button className="btn-secondary" onClick={ajouter} style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Plus size={16} /> Ajouter un jalon</button>
        <button className="btn-primary" onClick={enregistrer}>Enregistrer</button>
        <button className="btn-ghost" onClick={restaurer}>Restaurer le modèle par défaut</button>
      </div>
    </div>
  );
}
```

> Si `useState`/`useEffect` ne sont pas déjà importés depuis React dans `Parametres.jsx`,
> compléter l'import existant `import React, { useState } from 'react';` en
> `import React, { useState, useEffect } from 'react';`.

- [ ] **Step 3 : Rendre la section dans la page Paramètres**

Dans le JSX de `Parametres()`, juste après la fermeture de la « Section 5 — Apparence & Profil » (la balise `</Section>` à la ligne ~409), ajouter :

```jsx
        {/* Section 6 — Parcours d'accueil */}
        <Section icon={<UserPlus size={15}/>} title="Parcours d'accueil — Jalons" p={p}>
          <JalonsModeleEditor p={p} toast={toast} />
        </Section>
```

> `UserPlus` a déjà été ajouté à l'import lucide-react au Step 1.

- [ ] **Step 4 : Build**

Run : `npm run build`
Expected : build réussi.

- [ ] **Step 5 : Test manuel**

Run : `npm run dev` → Paramètres → section « Parcours d'accueil — Jalons ».
Expected : les 7 jalons par défaut s'affichent, éditables. Ajouter un jalon, Enregistrer, recharger → la modification persiste. Démarrer un nouveau parcours → il reflète le modèle modifié. Un parcours déjà existant n'est pas modifié.

- [ ] **Step 6 : Commit**

```bash
git add src/Parametres.jsx
git commit -m "feat(parcours): éditeur du modèle de jalons dans Paramètres"
```

---

## Task 7 : Documentation (guide d'installation + README migrations)

**Files:**
- Modify: `docs/GUIDE_INSTALLATION_COLLEGUE.md` (liste des migrations, §2.3)
- Modify: `db/migrations/README.md` (ordre d'exécution)

- [ ] **Step 1 : Mettre à jour le guide collègue**

Dans `docs/GUIDE_INSTALLATION_COLLEGUE.md`, §2.3, la liste numérotée des fichiers à appliquer
se termine par `20260425000003_etape_e7_rls_tables_metier.sql`. Ajouter un 5e élément :

```
5. `20260618000001_parcours_accueil.sql`  ← module Parcours d'accueil (3 tables + jalons par défaut)
```

Et dans la phrase « Vous appliquerez UNIQUEMENT ces 4 fichiers », remplacer « 4 » par « 5 ».

- [ ] **Step 2 : Mettre à jour le README des migrations**

Dans `db/migrations/README.md`, section « Ordre d'exécution », ajouter en fin de liste :

```
3. `20260618000001_parcours_accueil.sql` — module Parcours d'accueil (tables + RLS + seed)
```

- [ ] **Step 3 : Commit**

```bash
git add docs/GUIDE_INSTALLATION_COLLEGUE.md db/migrations/README.md
git commit -m "docs(parcours): ajout de la migration au guide d'installation"
```

---

## Vérification finale (après toutes les tâches)

- [ ] `npm run lint` — aucune nouvelle erreur
- [ ] `npm run build` — succès
- [ ] Test manuel complet contre les critères d'acceptation de la spec :
  - [ ] Onglet « Parcours d'accueil » présent dans la sidebar
  - [ ] Démarrer un parcours pré-remplit la date depuis la date d'entrée et génère les jalons
  - [ ] Cocher / « Non applicable » met à jour statut + progression
  - [ ] Tous jalons traités → parcours passe auto en « Terminé »
  - [ ] Badge sidebar = nb de jalons échus non faits des parcours en cours
  - [ ] Rôle `lecteur` : consultation seule, aucune action d'écriture
  - [ ] Modèle de jalons éditable dans Paramètres, persistant, sans impact sur les parcours existants
```
