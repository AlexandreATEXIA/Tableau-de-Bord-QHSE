# SMI Dashboard QHSE

Plateforme web de pilotage du Système de Management Intégré (Qualité, Hygiène, Sécurité, Environnement) pour PME/ETI.

> Stack : React 19 · Vite · Supabase (Postgres + Auth + Realtime) · Vercel
> Conformité : RGPD Art. 5/6/15/17/30/32 · ISO 9001/14001/45001 (cadre)

---

## 📚 Documentation par profil

Selon votre rôle, lisez le bon document :

| Vous êtes… | Lisez… |
|---|---|
| **Utilisateur final** (Direction, Responsable QHSE, Lecteur) | [`docs/USER_GUIDE.md`](docs/USER_GUIDE.md) |
| **Admin successeur** qui reprend la gestion | [`docs/HANDOVER.md`](docs/HANDOVER.md) |
| **Développeur** qui veut installer une nouvelle instance | [`docs/INSTALL.md`](docs/INSTALL.md) |
| **DPO / responsable RGPD** | [`docs/RGPD_REGISTRE_TRAITEMENTS.md`](docs/RGPD_REGISTRE_TRAITEMENTS.md) |

---

## 🚀 Démarrage rapide (développeur)

```bash
# 1. Cloner
git clone <URL_DU_REPO>
cd qhse-dashboard2

# 2. Variables d'environnement
cp .env.example .env
# → éditer .env avec vos clés Supabase (Settings > API du projet)

# 3. Dépendances
npm install

# 4. Lancer en local
npm run dev
# → http://localhost:5173
```

Pour partager le serveur de dev sur le LAN du bureau (DG sur un autre poste) :

```bash
npm run dev -- --host
# → http://192.168.x.x:5173 (votre IP locale)
```

---

## 📦 Structure du projet

```
qhse-dashboard2/
├── src/
│   ├── App.jsx                    # Routing + sidebar + auth wrapper
│   ├── UserContext.jsx            # Auth + rôles + permissions
│   ├── WriteGuard.jsx             # Composants <WriteOnly> (mode lecture seule)
│   ├── supabaseClient.js          # Client Supabase configuré
│   ├── LoginPage.jsx              # Écran de connexion
│   ├── GestionUtilisateurs.jsx    # Modale admin pour créer des comptes
│   │
│   ├── RegistreDUERP.jsx          # Module Évaluation des Risques
│   ├── PlanActions.jsx            # Module PDCA
│   ├── Habilitations.jsx          # Module Habilitations
│   ├── SecuriteAccidents.jsx      # Module Accidents/Incidents
│   ├── Environnement.jsx          # Module Bilan environnemental
│   ├── QualiteAudits.jsx          # Module Qualité (Audits, NC, Sat, QVT)
│   ├── SocialRH.jsx               # Module Effectifs + Formations
│   ├── ImportExcel.jsx            # Import + Export d'archive
│   ├── DashboardComex.jsx         # Vue de Direction
│   ├── ...                        # Et autres modules d'analyse
│   │
│   └── utils/
│       ├── kpi.js                 # Calculs réglementaires (TF, TG, ...)
│       ├── listes.js              # Référentiels Supabase + cache localStorage
│       ├── useListe.js            # Hook React pour les listes
│       └── exportXlsx.js          # Génération de l'archive Excel
│
├── db/
│   └── migrations/                # Migrations SQL datées (chronologiques)
│
├── docs/
│   ├── HANDOVER.md                # Guide de transfert (admin)
│   ├── USER_GUIDE.md              # Guide utilisateur (Direction, Lecteur)
│   ├── INSTALL.md                 # Installation depuis zéro
│   └── RGPD_REGISTRE_TRAITEMENTS.md
│
├── .env.example                   # Template variables d'environnement
├── package.json
└── vercel.json                    # Configuration de déploiement
```

---

## 🔐 Sécurité & RGPD

L'app est conforme RGPD Art. 32 (sécurité du traitement) :

- **Authentification obligatoire** (Supabase Auth, JWT)
- **Row Level Security** activée sur 28 tables Postgres
- **5 rôles métier** : `admin`, `responsable_qhse`, `direction`, `lecteur`, `operateur`
- **Journal d'audit** nominatif (qui, quoi, quand)
- **Données EU** : région Supabase eu-north-1 (Suède)
- **Backups** : automatiques côté Supabase + export Excel mensuel manuel recommandé

Voir [`docs/HANDOVER.md`](docs/HANDOVER.md) §7 pour la check-list de conformité.

---

## 🛠️ Commandes utiles

```bash
npm run dev          # serveur de développement (HMR)
npm run build        # build production dans dist/
npm run preview      # preview du build production
npm run lint         # linter ESLint
```

Déploiement Vercel : automatique à chaque `git push origin main`.

---

## 🧱 Patterns architecturaux clés

### Listes éditables centralisées (étape B)

Les "menus déroulants" personnalisables (familles de risques, postes, etc.) sont stockés dans la table Postgres `listes_referentiel` avec :
- Cache localStorage pour l'affichage instantané
- Synchronisation Realtime entre utilisateurs
- Auto-enrichissement à l'import Excel

Voir `src/utils/listes.js` et `src/utils/useListe.js`.

### Mode lecture seule (étape E)

Le rôle `lecteur` voit tout mais ne peut rien modifier. Implémentation :
- Côté UI : composant `<WriteOnly>` masque les boutons d'écriture
- Côté DB : RLS bloque les INSERT/UPDATE/DELETE via la fonction `public.can_write()`

Voir `src/WriteGuard.jsx` et `db/migrations/20260425000003_etape_e7_rls_tables_metier.sql`.

### Round-trip Import/Export Excel (étape C)

Une archive Excel exportée est **réimportable** à l'identique : les libellés des colonnes Excel correspondent aux templates d'import. Permet de reconstituer une instance à partir d'un seul fichier.

Voir `src/utils/exportXlsx.js` et `src/ImportExcel.jsx`.

---

## 📜 Historique des évolutions

Les évolutions majeures sont tracées par lots :

- **Lot 1** — RBAC + externalisation des secrets Supabase (`.env`)
- **Lot 5** — Quick wins fiabilité (validation des dates à l'import, etc.)
- **Lot 6 Phase 1** — Fondations RGPD (modules registre, demandes, anonymisation)
- **Étape A** — Listes éditables localStorage avec auto-enrichissement à l'import
- **Étape B** — Centralisation Supabase des listes + cache + Realtime
- **Étape C** — Exports Excel d'archive (sauvegarde + redondance locale)
- **Étape E** — Authentification + RLS sur 28 tables (RGPD Art. 32)

Chaque lot a sa migration SQL correspondante dans `db/migrations/` avec un commentaire d'en-tête expliquant l'intention.

---

## ⚠️ Limites connues

- **Pas de mode hors-ligne complet** : la consultation est possible via le cache local, mais les modifications nécessitent une connexion Internet (Supabase est cloud).
- **Pas de MFA applicatif** : possible côté Supabase Dashboard pour le compte propriétaire, pas pour les comptes utilisateurs (pour l'instant).
- **Pas d'Edge Function `invite-user`** : la création d'utilisateurs depuis l'app utilise `signUp` direct → désactiver "Confirm email" dans Supabase pour éviter la confirmation par mail.

---

## 📞 Pour aller plus loin

- Maintenance & opérations courantes : `docs/HANDOVER.md`
- Procédures RGPD : `docs/RGPD_REGISTRE_TRAITEMENTS.md`
- Migrations SQL : `db/migrations/README.md`
