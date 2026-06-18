# Spécification — Module « Parcours d'accueil nouveau salarié »

> Date : 2026-06-18
> Statut : validé (design approuvé), prêt pour plan d'implémentation
> Stack concernée : React 19 · Vite · Supabase (Postgres + Auth + RLS)

## 1. Objectif

Permettre le suivi du **parcours d'accueil d'un nouveau salarié sur 9 mois**, structuré en
**jalons de contrôle** datés. Chaque jalon doit déclencher une **alerte (badge dans l'app)**
lorsque sa date d'échéance est atteinte et qu'il n'a pas encore été validé.

## 2. Décisions validées (brainstorming)

| Sujet | Décision |
|---|---|
| Structure des jalons | **Modèle unique**, paramétrable, appliqué à chaque nouvelle arrivée |
| Paramétrage | **Flexible, dans la page Paramètres** (ajout / modif / suppression / réordonnancement) |
| Point de départ du décompte | **Date d'entrée** du salarié (`rh_employes.date_entree`), pré-remplie, modifiable |
| Type d'alerte | **Badge dans l'app uniquement** (pas d'email) |
| Architecture | **Module dédié** (nouvel onglet sidebar) — Approche A |
| Fin de parcours | **Passage automatique en « Terminé »** quand tous les jalons actifs sont faits |

## 3. Modèle de données (3 tables Supabase)

### 3.1 `parcours_modele_jalons` — le modèle configurable (partagé)
Édité depuis les Paramètres. Sert de gabarit au démarrage d'un parcours.

| Colonne | Type | Notes |
|---|---|---|
| id | bigint identity PK | |
| libelle | text | nom du jalon |
| delai_valeur | integer | quantité de délai depuis la date de début |
| delai_unite | text | `'jours'` ou `'mois'` (mois = mois calendaire) |
| responsable | text | rôle/personne par défaut, optionnel |
| ordre | integer | tri d'affichage |
| actif | boolean default true | un jalon inactif n'est pas instancié |
| created_at | timestamptz default now() | |

### 3.2 `parcours_accueil` — un parcours par salarié

| Colonne | Type | Notes |
|---|---|---|
| id | bigint identity PK | |
| employe_id | bigint | référence logique `rh_employes(id)` (pour récupérer la date d'entrée) |
| employe | text | nom complet dénormalisé (affichage robuste même si RGPD anonymise) |
| date_debut | date | défaut = `date_entree`, modifiable |
| statut | text default `'En cours'` | `'En cours'` \| `'Terminé'` \| `'Abandonné'` |
| commentaire | text | optionnel |
| archived_at | timestamptz | cohérent avec les autres tables métier |
| archived_by | text | |
| created_at | timestamptz default now() | |
| created_by | text | |

### 3.3 `parcours_jalons` — jalons instanciés d'un parcours (cochables)

| Colonne | Type | Notes |
|---|---|---|
| id | bigint identity PK | |
| parcours_id | bigint | FK `parcours_accueil(id)` ON DELETE CASCADE |
| libelle | text | copié depuis le modèle (snapshot) |
| date_echeance | date | calculée = `date_debut` + délai, figée à la création |
| responsable | text | copié depuis le modèle |
| statut | text default `'À faire'` | `'À faire'` \| `'Fait'` \| `'Non applicable'` |
| date_realisation | date | renseignée au passage en « Fait » |
| commentaire | text | |
| ordre | integer | |

**Principe snapshot** : au démarrage d'un parcours, les jalons `actif=true` du modèle sont
**copiés** dans `parcours_jalons`. Modifier le modèle ensuite n'affecte **pas** les parcours
déjà lancés.

### 3.4 Calcul de `date_echeance`
- `delai_unite = 'jours'` → `date_debut + delai_valeur jours`
- `delai_unite = 'mois'` → `date_debut + delai_valeur mois` (mois calendaire)

### 3.5 Seed (modèle par défaut, modifiable)
| ordre | libelle | delai_valeur | delai_unite | responsable |
|---|---|---|---|---|
| 1 | Accueil, remise EPI & livret d'accueil | 1 | jours | RH |
| 2 | Point fin de 1ʳᵉ semaine | 7 | jours | Manager |
| 3 | Entretien de suivi 1 mois | 1 | mois | Manager |
| 4 | Bilan fin de période d'essai | 2 | mois | RH |
| 5 | Entretien 3 mois | 3 | mois | Manager |
| 6 | Entretien 6 mois | 6 | mois | Manager |
| 7 | Bilan final du parcours | 9 | mois | RH |

> Le seed est indicatif : l'utilisateur le remplace par sa propre liste dans les Paramètres.

## 4. Sécurité (RLS)
Aligner les politiques sur les tables métier existantes :
- Lecture : tout utilisateur authentifié.
- Écriture (INSERT/UPDATE/DELETE) : conditionnée par `public.can_write()` (rôles non-lecteur),
  comme dans `db/migrations/20260425000003_etape_e7_rls_tables_metier.sql`.

## 5. Interface

### 5.1 Nouvel onglet sidebar
Entrée `{ id:'parcours', label:'Parcours d'accueil', icon:UserPlus, badge:'NEW' }` dans `App.jsx`,
route vers `<ParcoursAccueil/>`. Badge d'urgence = nb de jalons échus non faits (voir §6).

### 5.2 Écran principal `ParcoursAccueil.jsx`
- **Liste des parcours** (filtre : En cours / Terminés / Tous) : par ligne → nom du salarié,
  date de début, **progression** (`X/Y jalons faits` + barre), **prochain jalon** + date
  (rouge si dépassée).
- **Détail d'un parcours** : frise des jalons (libellé, date d'échéance, responsable, statut).
  Actions par jalon : **Marquer fait** (statut→`Fait`, `date_realisation`=aujourd'hui),
  **Non applicable**, commentaire. Actions parcours : **Terminer**, **Abandonner**.
- **Démarrer un parcours** (modale) : sélection d'un salarié actif (depuis `EmployesContext`),
  `date_debut` pré-remplie depuis `date_entree` (modifiable) → crée le parcours + instancie
  les jalons actifs du modèle.
- **Lecture seule** : composant `<WriteOnly>` masque les actions d'écriture pour le rôle `lecteur`.

### 5.3 Paramètres — section « Parcours d'accueil — Jalons »
Nouvelle `<Section>` dans `Parametres.jsx` : tableau éditable du modèle
(`libelle`, `delai_valeur`, `delai_unite`, `responsable`, `ordre`, `actif`), boutons
**Ajouter un jalon**, supprimer, et **Restaurer le modèle par défaut**. Lecture/écriture
directes sur `parcours_modele_jalons`. Avertissement affiché : « Modifier le modèle n'affecte
pas les parcours déjà démarrés. »

## 6. Alertes (badge in-app)
Un jalon est **en alerte** si :
`parcours.statut='En cours'` ET `parcours.archived_at IS NULL` ET `jalon.statut='À faire'`
ET `jalon.date_echeance <= aujourd'hui`.

Intégration dans `useAlerteCounts.js` (compteur sidebar par module) — ajout d'une clé
`parcours`. Rafraîchissement toutes les 5 min, après session Supabase établie (même schéma
anti-401 que les autres compteurs).

## 7. Clôture automatique
À chaque mise à jour d'un jalon : si tous les jalons d'un parcours `En cours` sont en statut
`Fait` ou `Non applicable` (aucun `À faire`), passer `parcours.statut` à `Terminé`. Réversible
manuellement (rouvrir = repasser en `En cours`).

## 8. Fichiers impactés
**Nouveaux**
- `src/ParcoursAccueil.jsx` — module
- `db/migrations/20260618000001_parcours_accueil.sql` — 3 tables + RLS + seed

**Modifiés**
- `src/App.jsx` — import, entrée sidebar, route, câblage badge
- `src/Parametres.jsx` — nouvelle section éditeur de modèle
- `src/useAlerteCounts.js` — compteur `parcours` (+ `AlertesContext.jsx` si badge global voulu)
- `docs/GUIDE_INSTALLATION_COLLEGUE.md` & `db/migrations/README.md` — ajouter la nouvelle
  migration à la liste à appliquer

## 9. Hors périmètre (v1)
- Pas d'alerte email (décision explicite).
- Pas d'export Excel des parcours dans l'archive round-trip (peut être ajouté plus tard).
- Pas de rappel « X jours avant » : l'alerte se déclenche à la date d'échéance.

## 10. Critères d'acceptation
- [ ] La migration crée les 3 tables avec RLS et le seed par défaut.
- [ ] Un onglet « Parcours d'accueil » apparaît dans la sidebar.
- [ ] Démarrer un parcours pour un salarié actif pré-remplit la date depuis sa date d'entrée
      et génère les jalons du modèle aux bonnes dates.
- [ ] Cocher / marquer « Non applicable » un jalon met à jour son statut et la progression.
- [ ] Quand tous les jalons sont faits/NA, le parcours passe automatiquement en « Terminé ».
- [ ] Le badge de la sidebar compte les jalons échus non faits des parcours en cours.
- [ ] Le rôle `lecteur` peut consulter mais pas modifier.
- [ ] Le modèle de jalons est entièrement éditable depuis les Paramètres.
