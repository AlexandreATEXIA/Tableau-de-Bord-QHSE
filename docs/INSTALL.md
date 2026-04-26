# Installation depuis zéro — SMI Dashboard QHSE

Guide pour installer une **nouvelle instance complète** sur une infrastructure neuve (Supabase + Vercel + GitHub) — typiquement quand on veut isoler les données d'une autre entreprise ou monter un environnement de test.

> Si vous reprenez simplement la gestion d'une instance existante, voir `HANDOVER.md` à la place. Cette procédure n'est nécessaire qu'à la création d'une nouvelle organisation.

Durée estimée : **45 minutes - 1 heure**.

---

## Pré-requis

- Compte Supabase ([supabase.com](https://supabase.com)) — free tier suffit
- Compte Vercel ([vercel.com](https://vercel.com)) — free tier suffit
- Compte GitHub ([github.com](https://github.com)) — free tier suffit
- Node.js ≥ 18 installé localement
- Git installé localement
- Un éditeur de code (VS Code recommandé)

---

## Étape 1 — Création du projet Supabase

1. [supabase.com/dashboard](https://supabase.com/dashboard) → **New Project**
2. Choisir une **organisation** (créer si nécessaire)
3. **Name** : `smi-dashboard-<entreprise>`
4. **Database Password** : générer un mot de passe fort, **noter immédiatement** dans un gestionnaire de mots de passe — vous en aurez besoin plus tard
5. **Region** : choisir une région **EU** pour la conformité RGPD (ex. `Europe (Frankfurt)` ou `Europe (Stockholm) eu-north-1`)
6. **Plan** : Free tier (suffisant pour 2-10 utilisateurs)
7. Attendre la création (~2 min)

Une fois le projet créé, allez dans **Settings → API** et notez :

- `Project URL` (format `https://xxxxxxxxxxxxxxxx.supabase.co`)
- `anon / public` key (commence par `eyJ...`)
- `service_role` key (commence par `eyJ...` — **NE JAMAIS exposer publiquement**, usage admin SQL uniquement)

---

## Étape 2 — Application des migrations SQL

Le schéma de la base est intégralement dans `db/migrations/`, à appliquer **dans l'ordre chronologique** (préfixe horodaté).

### 2.1 — Helper SQL préalable (fonction `update_updated_at_column`)

Cette fonction est utilisée par les triggers de plusieurs migrations. Elle n'est pas dans une migration dédiée car typiquement présente sur tous les projets Supabase, mais si elle n'existe pas il faut la créer.

Dans **Supabase Dashboard → SQL Editor**, exécutez :

```sql
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
```

### 2.2 — Migrations principales

Toujours dans le SQL Editor, copier-coller le contenu de chaque fichier dans cet ordre :

```
db/migrations/
├── 20260424000001_lot5_phase1_quickwins.sql
├── 20260424000002_lot6_phase1_rgpd_fondations.sql
├── 20260425000001_etape_b1_listes_referentiel.sql
├── 20260425000002_etape_e1_user_roles_auth.sql
└── 20260425000003_etape_e7_rls_tables_metier.sql
```

⚠️ Si l'une des migrations échoue avec "table does not exist", c'est qu'une table métier (DUERP, plan_actions, etc.) n'a pas été créée par les premières migrations. Dans ce cas, vous devez créer ces tables via les **migrations originales** (récupérables auprès du fournisseur du code source) avant les fichiers ci-dessus.

### 2.3 — Vérification

Exécutez :

```sql
-- Doit retourner 28 (toutes les tables)
SELECT COUNT(*) FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname='public' AND c.relkind='r';

-- Toutes les tables doivent avoir RLS=true
SELECT relname, relrowsecurity FROM pg_class
WHERE relnamespace = (SELECT oid FROM pg_namespace WHERE nspname='public')
  AND relkind = 'r' AND relrowsecurity = false;
-- → ne doit retourner AUCUNE ligne (toutes ont RLS active)
```

### 2.4 — Configuration Realtime

```sql
-- Listes (sync entre utilisateurs)
ALTER PUBLICATION supabase_realtime ADD TABLE public.listes_referentiel;
```

---

## Étape 3 — Création du compte admin initial

L'app ne permet pas de créer un user via l'écran de login (pas d'inscription publique). On crée donc le **premier admin** manuellement.

### 3.1 — Désactiver la confirmation email (optionnel mais conseillé)

Supabase Dashboard → **Authentication → Providers → Email** → décocher **"Confirm email"** → **Save**.

Sinon, l'utilisateur devra cliquer sur un lien email avant d'accéder à l'app.

### 3.2 — Créer l'utilisateur

Supabase Dashboard → **Authentication → Users → Add user** :

- Email : email professionnel de l'admin
- Password : mot de passe initial (à changer dès la 1re connexion)
- Cocher "Auto Confirm User" (si vous n'avez pas désactivé la confirmation)
- **Create user**

### 3.3 — Attribuer le rôle admin

SQL Editor :

```sql
INSERT INTO public.user_roles (user_id, role, email, nom)
SELECT id, 'admin', email, '<Nom Prénom>'
FROM auth.users
WHERE email = '<email_admin>';
```

---

## Étape 4 — Cloner et configurer le code

```bash
# 1. Cloner le repo
git clone <URL_REPO_GIT> qhse-dashboard-<entreprise>
cd qhse-dashboard-<entreprise>

# 2. Configurer .env
cp .env.example .env
```

Éditez `.env` avec un éditeur :

```
VITE_SUPABASE_URL=https://xxxxxxxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...   # la clé anon, PAS service_role
```

```bash
# 3. Installer les dépendances
npm install

# 4. Tester en local
npm run dev
# → http://localhost:5173 → LoginPage doit s'afficher
# → connexion avec le compte admin créé en étape 3 → dashboard charge
```

Si tout fonctionne en local, passez à l'étape 5. Sinon, vérifiez :

- Les variables `.env` sont correctes (URL et clé)
- La table `user_roles` contient bien votre admin (cf. étape 3.3)
- Aucune erreur RLS dans la console (DevTools → Console)

---

## Étape 5 — Déploiement Vercel

### 5.1 — Push du code sur GitHub

Si pas déjà fait :

```bash
# Créer un nouveau repo privé sur github.com (interface web)

git remote remove origin 2>/dev/null  # si origin existait
git remote add origin <URL_NOUVEAU_REPO>
git branch -M main
git push -u origin main
```

### 5.2 — Connecter Vercel à GitHub

1. [vercel.com/new](https://vercel.com/new)
2. **Import Git Repository** → sélectionner le repo créé
3. **Configure Project** :
   - **Framework Preset** : Vite
   - **Root Directory** : `./`
   - **Build Command** : `npm run build` (par défaut)
   - **Output Directory** : `dist` (par défaut)
4. **Environment Variables** — ajouter les 2 mêmes que dans `.env` :
   - `VITE_SUPABASE_URL` = `https://xxxxxxxxxxxxxxxx.supabase.co`
   - `VITE_SUPABASE_ANON_KEY` = `eyJ...`
5. **Deploy** → attendre ~2 min

### 5.3 — Tester le déploiement

L'URL Vercel s'affiche en haut (format `<projet>.vercel.app`). Ouvrez-la dans une fenêtre **privée** pour tester sans cache :

- LoginPage s'affiche → connexion admin → dashboard charge
- DevTools → Console : aucun 401 ne doit apparaître
- Tester la création d'une entrée DUERP pour valider l'écriture

---

## Étape 6 — Configuration finale

### 6.1 — Configuration entreprise

1. Dans l'app, aller dans **Paramètres** (admin uniquement)
2. Renseigner :
   - Nom de l'entreprise
   - Effectif (utilisé pour le calcul des KPIs TF/TG)
   - Heures travaillées par an et par salarié (1607 par défaut)

### 6.2 — Création des autres comptes

Voir `HANDOVER.md` §4.1 pour la procédure de création des comptes Direction, Lecteur, etc.

### 6.3 — Domaine personnalisé (optionnel)

Vercel → projet → **Settings → Domains** → ajouter `qhse.votre-domaine.fr` ou similaire. Vercel guide pour la configuration DNS.

### 6.4 — Sauvegarde initiale

Dès que des données sont saisies, faire un premier **Export d'archive Excel** (menu Import Excel → bouton violet) et le stocker hors ligne. Recommandé : programmer un export mensuel.

---

## Étape 7 — Sécurité — actions de durcissement

À faire dans la première semaine :

- [ ] Activer **2FA** sur les comptes propriétaire Supabase et Vercel
- [ ] Vérifier que la **clé `service_role`** n'est jamais utilisée côté client (elle ne doit JAMAIS être dans `.env` — uniquement la `anon`)
- [ ] Confirmer la **DPA** (Data Processing Agreement) avec Supabase si vous traitez des données personnelles européennes — formulaire Supabase Settings → Compliance
- [ ] Documenter dans le **registre des traitements** RGPD (cf. `RGPD_REGISTRE_TRAITEMENTS.md`)
- [ ] Mettre en place une **rotation de mot de passe** annuelle pour les comptes admin

---

## Variables d'environnement complètes

```bash
# .env (ne jamais committer)

# Supabase — Settings → API
VITE_SUPABASE_URL=https://xxxxxxxxxxxxxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.xxxxxxxxxxxxxxxxxxxxxx
```

⚠️ **NE PAS** mettre la clé `service_role` ici — elle bypasse RLS et expose toute la base. Seule la `anon` est OK côté client (RLS la sécurise).

---

## Schéma SQL — version condensée

Pour une vue rapide du schéma sans appliquer toutes les migrations, vous pouvez générer un dump :

```bash
# Avec pg_dump (besoin du mot de passe DB Supabase)
pg_dump --schema-only \
  --no-owner --no-privileges \
  -h db.xxxxxxxxxxxxxxxx.supabase.co \
  -U postgres \
  -d postgres \
  -f schema.sql
```

Le fichier `schema.sql` contiendra toutes les tables, contraintes, policies RLS et triggers.

---

## Dépannage

### Build Vercel échoue
- Vérifier les logs (Deployments → cliquer le rouge → Build Logs)
- Erreur typique : `Cannot find module './X'` → un fichier renommé n'est pas committé

### LoginPage charge en boucle
- DevTools → Application → Local Storage → tout vider → F5
- Vérifier que les variables d'env Vercel sont bien renseignées

### "401 Unauthorized" partout
- Le rôle de l'utilisateur n'est pas inséré dans `public.user_roles`
- Vérifier avec : `SELECT * FROM public.user_roles WHERE email='<email>';`

### Realtime ne fonctionne pas
- Vérifier la publication : `SELECT * FROM pg_publication_tables WHERE pubname='supabase_realtime';`
- Doit contenir `listes_referentiel`

---

## Annexe — Commandes utiles

```bash
# Logs Vercel en temps réel (besoin Vercel CLI)
npx vercel logs <deployment-url> --follow

# Supabase CLI (utile pour les migrations en local)
npx supabase init
npx supabase db push
```

Pour toute question, consultez `HANDOVER.md` ou contactez le développeur original.
