# Guide de transfert — SMI Dashboard QHSE

Document destiné à la **personne qui reprend la gestion de l'application** (Responsable QHSE successeur, ou administrateur principal).

> Si vous êtes un **simple utilisateur** (Direction, lecteur), ce n'est pas le bon document — voir `USER_GUIDE.md`.

---

## 1. Vue d'ensemble

L'application est une plateforme web QHSE qui gère :

- **Registre DUERP** — évaluation des risques professionnels
- **Plan d'actions** — suivi des actions correctives/préventives
- **Habilitations** — délivrance et expiration des habilitations
- **Sécurité / Accidents** — déclaration et enquête
- **Environnement** — flux énergie, eau, déchets + bilan carbone
- **Qualité & Audits** — audits, NC, satisfaction, QVT
- **Social & RH** — effectifs, formations
- **Imports / Exports Excel** — bidirectionnel
- **Conformité RGPD** — registre des traitements, droit d'accès et d'effacement

L'app fonctionne avec deux profils principaux :

| Rôle | Usage type | Permissions |
|---|---|---|
| `admin` | Responsable QHSE qui pilote l'app au quotidien | Accès complet + gestion des utilisateurs |
| `lecteur` | Direction (DG) qui consulte le dashboard de temps en temps | Voit tout, ne peut rien modifier |

Trois autres rôles existent (`responsable_qhse`, `direction`, `operateur`) mais ne sont pas utilisés activement à ce jour. Voir `src/UserContext.jsx`.

---

## 2. Stack technique

| Couche | Outil | Lien d'admin |
|---|---|---|
| Front-end | React 19 + Vite | — |
| Hébergement web | Vercel | [vercel.com](https://vercel.com) → projet `qhse-dashboard2` |
| Base de données | Supabase (PostgreSQL EU, région eu-north-1) | [supabase.com/dashboard](https://supabase.com/dashboard) → projet `SMI-dashboard` |
| Authentification | Supabase Auth (email + mot de passe pour QHSE, magic link pour DG) | Idem Supabase |
| Code source | GitHub | repo `qhse-dashboard2` |

Coût récurrent : **0 €** tant que vous restez dans les paliers gratuits de Supabase et Vercel (largement suffisants pour 2-5 utilisateurs).

---

## 3. Accès à transférer

### 3.1 — Ce que vous devez recevoir du prédécesseur

- [ ] **Compte Supabase** : email + mot de passe (ou ajout en tant qu'organisation member)
- [ ] **Compte Vercel** : idem
- [ ] **Compte GitHub** : ajout en tant que collaborateur du repo `qhse-dashboard2`
- [ ] **Mot de passe initial de votre compte applicatif** (`responsable@votre-domaine.fr` ou similaire)
- [ ] **URL de l'app en production** (généralement `https://qhse-dashboard2.vercel.app`)
- [ ] **Le présent document** + `USER_GUIDE.md`

### 3.2 — Premières actions à votre prise de fonction

1. **Connectez-vous à l'app** avec votre compte. Cliquez "Mot de passe oublié" pour le réinitialiser à votre convenance.
2. **Connectez-vous à Supabase Dashboard** → Authentication → Users : vérifiez que vous voyez votre compte et celui du DG (s'il est créé).
3. **Vérifiez votre rôle en base** :
   ```sql
   SELECT user_id, role, email FROM public.user_roles;
   ```
   Vous devez avoir `role = 'admin'` sur la ligne associée à votre email. Sinon, demandez au prédécesseur ou voir §6.
4. **Activez 2FA sur votre compte Supabase et Vercel** (recommandation forte de sécurité).
5. **Régénérez la clé API anon Supabase** si vous ne faites pas confiance au prédécesseur (Settings → API → Reset). Ensuite mettez à jour la variable `VITE_SUPABASE_ANON_KEY` dans Vercel → Settings → Environment Variables, puis redéployez.

---

## 4. Opérations courantes

### 4.1 — Créer un utilisateur supplémentaire

**Méthode rapide via l'app** (préalable : avoir désactivé "Confirm email" dans Supabase Dashboard → Authentication → Providers → Email) :

1. Connectez-vous comme admin
2. En bas à gauche de la sidebar, icône **"Ajouter un utilisateur"** (à côté de la déconnexion)
3. Saisir email, mot de passe temporaire, choisir le rôle (`lecteur` pour un DG par exemple)
4. **Créer l'accès** → l'utilisateur peut se connecter immédiatement

**Méthode via Supabase Dashboard** (si vous ne voulez pas désactiver la confirmation email) :

1. Supabase → Authentication → Users → **Add user**
2. Cocher "Auto Confirm User" + saisir email + password
3. **Create user** → noter le `user_id` créé
4. Aller dans Table Editor → `user_roles` → **Insert** :
   ```sql
   INSERT INTO public.user_roles (user_id, role, email, nom)
   VALUES ('<user_id>', 'lecteur', '<email>', '<nom complet>');
   ```

### 4.2 — Supprimer un utilisateur

1. Supabase Dashboard → Authentication → Users → cliquez l'utilisateur → **Delete user**
2. La ligne dans `public.user_roles` est supprimée automatiquement (FK CASCADE).

### 4.3 — Changer le rôle d'un utilisateur

```sql
UPDATE public.user_roles
SET role = 'admin'  -- ou 'lecteur', 'direction', 'operateur', 'responsable_qhse'
WHERE email = 'cible@exemple.fr';
```

Le changement est pris en compte immédiatement (au prochain refresh de la page).

### 4.4 — Sauvegarde de sécurité

L'app dispose d'un export complet en Excel :

1. Menu **Import Excel** → bouton violet **"Exporter l'archive"**
2. Cocher les options souhaitées (RGPD, archivés, etc.)
3. **Télécharger l'archive** → fichier `.xlsx` avec un onglet par module + métadonnées + schéma

**Recommandation** : faire un export **mensuel** et le stocker hors ligne (NAS, disque chiffré, OneDrive). Supabase fait des backups quotidiens automatiques côté serveur, mais une copie de votre côté = double sécurité.

### 4.5 — Restaurer des données depuis une archive

Une archive Excel exportée est **réimportable** via le même menu Import Excel (les libellés des colonnes sont identiques aux templates d'import). Procédure :

1. Mettre l'app en mode **"Mise à jour (upsert)"** pour ne pas créer de doublons
2. Glisser le fichier `.xlsx`
3. Vérifier l'aperçu
4. **Importer**

---

## 5. Maintenance technique

### 5.1 — Déploiement après modification du code

Tout commit poussé sur la branche `main` du repo GitHub déclenche automatiquement un déploiement Vercel (~2-3 minutes). Aucune intervention manuelle.

```bash
git add .
git commit -m "votre message"
git push origin main
```

Vérifier le statut sur Vercel → Deployments. En cas d'échec, cliquer sur le déploiement rouge → onglet "Build Logs" pour identifier l'erreur.

### 5.2 — Mise à jour des dépendances

```bash
npm outdated         # voir ce qui est obsolète
npm update           # mises à jour mineures sans risque
npm audit fix        # corrige les failles connues
```

À faire **tous les 6 mois** environ, dans un branch de test avant push sur main.

### 5.3 — Logs et debug

- **Logs front** : DevTools du navigateur (F12) → Console
- **Logs back** : Supabase Dashboard → Logs → Realtime
- **Logs déploiement** : Vercel → Deployments → cliquer un déploiement → Build Logs / Runtime Logs
- **Journal d'audit applicatif** : menu **Journal d'audit** dans l'app (filtre par utilisateur, action, table)

### 5.4 — Bases de données — accéder en SQL direct

Supabase Dashboard → **SQL Editor** → vous avez un éditeur Postgres complet. Toutes les requêtes que vous exécutez ici contournent la RLS (vous êtes en `service_role`).

⚠️ **Attention** : c'est puissant. Une mauvaise commande UPDATE/DELETE sans WHERE et vous perdez des données. Toujours faire un SELECT avant pour vérifier la portée.

---

## 6. Cas d'urgence

### 6.1 — "Je suis bloqué dehors de l'app"

Si vous avez perdu l'accès admin et qu'aucun autre admin n'existe :

1. Connectez-vous à Supabase Dashboard avec le compte admin de l'organisation
2. SQL Editor →
   ```sql
   -- Trouvez votre user_id
   SELECT id, email FROM auth.users WHERE email = 'votre@email.fr';

   -- Insérez ou updatez votre rôle
   INSERT INTO public.user_roles (user_id, role, email, nom)
   VALUES ('<user_id_trouvé>', 'admin', 'votre@email.fr', 'Votre Nom')
   ON CONFLICT (user_id) DO UPDATE SET role = 'admin';
   ```

### 6.2 — "L'app charge un spinner sans fin"

Probable cache navigateur servant un ancien bundle JS.

1. **Ctrl + Shift + R** (hard refresh)
2. Si insuffisant : DevTools → Application → Storage → **Clear site data** → F5

### 6.3 — "Toutes les requêtes Supabase reviennent 401"

Probablement une session expirée ou un fix RLS qui bloque. Solutions :

1. Déconnexion → reconnexion (renouvelle le JWT)
2. Vérifier les policies RLS dans Supabase → Authentication → Policies
3. Si urgence et que vous bloquez la production : désactiver temporairement RLS sur la table fautive :
   ```sql
   ALTER TABLE public.<nom_table> DISABLE ROW LEVEL SECURITY;
   ```
   Puis réactivez avec une policy correcte une fois calme.

### 6.4 — "Vercel deployment failed"

1. Vercel → Deployments → cliquer le rouge → Build Logs
2. Erreurs typiques :
   - `Module not found` : un fichier renommé pas committé → `git status` + commit
   - `Out of memory` : très rare, contacter support Vercel
3. Solution rapide : Vercel → Deployments → un déploiement vert précédent → ⋯ → **Promote to Production** (rollback)

---

## 7. Conformité RGPD — ce qu'il faut savoir

L'app stocke des **données personnelles** (employés, formations, accidents, habilitations). Vous êtes désormais responsable de :

- **Article 5** — limitation de la conservation : configurez les durées de rétention dans le module **Conformité RGPD**
- **Article 15** — droit d'accès : un employé peut demander toutes ses données → utiliser le module **Conformité RGPD** → Demandes
- **Article 17** — droit à l'effacement : anonymisation via le même module (`rgpd_anonymise_le` est rempli, les données nominatives sont effacées)
- **Article 30** — registre des traitements : voir `docs/RGPD_REGISTRE_TRAITEMENTS.md`
- **Article 32** — sécurité du traitement : géré par RLS Supabase + auth obligatoire (déjà en place)

Vérifications annuelles à faire :
- [ ] Réviser le registre des traitements (qui accède à quoi)
- [ ] Tester une procédure de demande RGPD complète
- [ ] Sauvegarder une archive Excel et la stocker hors ligne
- [ ] Vérifier que le DPO de l'entreprise a connaissance de l'existence de l'app

---

## 8. Documents annexes

- `USER_GUIDE.md` — guide utilisateur quotidien (à donner à votre DG)
- `INSTALL.md` — installer une nouvelle instance sur une infra vierge (cas rare)
- `RGPD_REGISTRE_TRAITEMENTS.md` — registre formel des traitements
- `db/migrations/` — historique du schéma SQL avec migrations datées
- `.env.example` — variables d'environnement requises

---

## 9. Contact

Pour toute question sur le code source ou la base de données, le code est entièrement documenté avec des commentaires en français au début de chaque fichier critique. Commencez par lire :

- `src/App.jsx` — point d'entrée et routage
- `src/UserContext.jsx` — gestion de l'auth et des rôles
- `src/utils/listes.js` — pattern de listes éditables
- `db/migrations/README.md` — convention SQL
