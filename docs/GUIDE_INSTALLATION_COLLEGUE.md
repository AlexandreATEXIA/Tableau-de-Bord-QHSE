# Guide d'installation — Application QHSE

Bonjour ! Ce document vous guide pas à pas pour mettre en place votre **propre instance** de l'application QHSE, complètement séparée et autonome.

> **Aucune compétence en programmation requise.** Si vous savez naviguer sur Internet et copier-coller, vous y arriverez.

**Temps estimé : 1h - 1h30** (dont 30 min de pauses pendant que ça charge).

**Coût : 0 €** — Tout se fait en plan gratuit. Aucune carte bancaire ne sera demandée.

---

## 📋 Avant de commencer (5 min)

### Ce dont vous avez besoin

- Un ordinateur (Windows, Mac ou Linux)
- Une connexion Internet stable
- Un email professionnel (à votre nom, idéalement de l'entreprise)
- 1h30 devant vous, sans interruption si possible
- Le **dossier ZIP de l'application** que vous a transmis votre prédécesseur (ou le lien GitHub)

### Ce que vous allez faire (vue d'ensemble)

L'application repose sur 3 services gratuits qui travaillent ensemble :

```
Vous (sur votre PC)
   ↓
[Application Web QHSE]   ← le code (vous allez l'installer)
   ↓
[Supabase]               ← la base de données (gratuit)
   ↓
[Vercel] (optionnel)     ← l'hébergement web public (gratuit)
```

Vous allez créer **votre propre compte** sur chacun de ces services. Aucun contact avec ceux de votre prédécesseur. **Vous serez 100 % autonome.**

---

## 🟢 Étape 1 — Créer votre compte Supabase (10 min)

Supabase, c'est l'endroit où vos données seront stockées (DUERP, accidents, formations, etc.). C'est l'équivalent d'un disque dur sécurisé dans le cloud, en Europe.

### 1.1 — Inscription

1. Ouvrez votre navigateur et allez sur **[supabase.com](https://supabase.com)**
2. Cliquez sur **"Start your project"** (en haut à droite)
3. Choisissez **"Sign up with GitHub"** OU **"Continue with email"** :
   - Si vous prenez **email** : entrez votre email pro + un mot de passe fort (notez-le bien, on en aura besoin tout à l'heure)
   - Vous recevrez un email de confirmation : cliquez sur le lien dedans
4. De retour sur Supabase, vous arrivez sur le dashboard

### 1.2 — Créer votre premier projet

1. Cliquez sur le grand bouton vert **"New Project"**
2. Si on vous demande de créer une **"Organization"** : nom au choix (ex. votre nom ou nom d'entreprise) → **Create**
3. Sur la page de configuration du projet, remplissez :
   - **Project Name** : choisissez un nom, ex. `qhse-monentreprise` (sans espaces, en minuscules)
   - **Database Password** : cliquez **"Generate a password"** → un mot de passe fort apparaît → **COPIEZ-LE et notez-le précieusement** dans un coffre de mots de passe ou un papier en sécurité. On en aura besoin si jamais on doit dépanner. **Ne le perdez surtout pas.**
   - **Region** : choisissez **"Frankfurt (eu-central-1)"** ou **"Stockholm (eu-north-1)"** (Europe = obligatoire pour le RGPD)
   - **Pricing Plan** : laissez **Free** (largement suffisant)
4. Cliquez **"Create new project"**
5. Patientez **2-3 minutes** pendant que Supabase prépare votre base de données (l'écran charge avec un sablier).

### 1.3 — Récupérer vos clés d'accès

Une fois le projet prêt :

1. Dans la sidebar gauche → cliquez **"Settings"** (icône engrenage en bas)
2. Dans le sous-menu → cliquez **"API"**
3. Sur la page qui s'affiche, repérez ces 2 valeurs et **notez-les soigneusement** dans un fichier texte sur votre bureau :

   - 🔵 **Project URL** : commence par `https://` et finit par `.supabase.co`
     ```
     Exemple : https://abcdefghijklmnop.supabase.co
     ```

   - 🟡 **Project API keys → anon / public** : une longue chaîne qui commence par `eyJ...`
     ```
     Exemple : eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVC...
     ```

⚠️ **Ne notez PAS** la clé `service_role` (juste en dessous). Celle-là est dangereuse, on n'y touche pas.

✅ **Vous venez de créer votre base de données. Bravo !**

---

## 🟢 Étape 2 — Initialiser la base de données (15 min)

Maintenant on va créer toutes les "tables" (DUERP, accidents, etc.) dans votre base. C'est rapide : on copie-colle 5 fichiers de code.

### 2.1 — Ouvrir l'éditeur SQL

1. Toujours dans Supabase Dashboard, sidebar gauche → cliquez **"SQL Editor"** (icône feuille de papier)
2. Vous voyez une zone de saisie vide

### 2.2 — Préparer la fonction "helper"

Dans la zone de saisie, **collez ce code** :

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

Cliquez **"Run"** (bouton vert en bas à droite ou Ctrl+Entrée).

→ Vous devez voir un message **"Success. No rows returned"** en vert. Si vous voyez du rouge, recommencez le copier-coller (oubli d'un caractère).

### 2.3 — Appliquer les 4 migrations

Dans le ZIP de l'application que vous avez reçu, ouvrez le dossier `db/migrations/`. Vous y voyez plusieurs fichiers `.sql`.

**Vous appliquerez UNIQUEMENT ces 4 fichiers, DANS L'ORDRE** :

1. `00000000000000_baseline_schema.sql` ← **Le plus important — crée toutes les tables**
2. `20260425000001_etape_b1_listes_referentiel.sql`
3. `20260425000002_etape_e1_user_roles_auth.sql`
4. `20260425000003_etape_e7_rls_tables_metier.sql`

⚠️ **NE PAS appliquer les fichiers `20260424...`** — ils sont historiques (ajouts progressifs au schéma) et leurs apports sont déjà inclus dans le baseline.

**Pour chacun des 4 fichiers ci-dessus, dans l'ordre** :

1. Ouvrez-le dans un éditeur de texte (Notepad, TextEdit, VS Code…)
2. **Sélectionnez tout** (Ctrl+A) puis **copiez** (Ctrl+C)
3. Retournez dans Supabase SQL Editor
4. **Effacez** le code précédent
5. **Collez** (Ctrl+V) le contenu du fichier
6. Cliquez **"Run"**
7. Attendez le message **"Success"** vert
8. Passez au fichier suivant

⏱️ Compter ~2 min par fichier, soit **~8 min pour les 4**. Le 1er (baseline) est le plus long à exécuter (~30 secondes), les autres sont quasi-instantanés.

### 2.4 — Activer la synchronisation en temps réel

Dernière commande à exécuter dans le SQL Editor :

```sql
ALTER PUBLICATION supabase_realtime ADD TABLE public.listes_referentiel;
```

→ "Success" vert.

### 2.5 — Vérification

Pour vérifier que tout est en place, exécutez :

```sql
SELECT COUNT(*) FROM pg_class
WHERE relkind='r'
  AND relnamespace = (SELECT oid FROM pg_namespace WHERE nspname='public');
```

Le résultat doit être **`28`** ou plus. Si oui, votre base est prête.

✅ **Votre base de données est initialisée avec toute la structure QHSE.**

---

## 🟢 Étape 3 — Créer votre compte administrateur (5 min)

C'est le compte avec lequel **VOUS** vous connecterez à l'application.

### 3.1 — Désactiver la confirmation par email (recommandé)

Sinon, à chaque création de compte, vous devrez cliquer sur un lien dans un email avant de pouvoir vous connecter. C'est une étape en plus inutile pour 2-3 comptes.

1. Sidebar Supabase → **"Authentication"** → **"Providers"**
2. Cliquez sur **"Email"** dans la liste
3. **Décochez** la case **"Confirm email"**
4. Cliquez **"Save"** en bas

### 3.2 — Créer votre compte utilisateur

1. Sidebar Supabase → **"Authentication"** → **"Users"**
2. Bouton **"Add user"** en haut à droite → **"Create new user"**
3. Remplissez :
   - **Email** : votre email pro
   - **Password** : un mot de passe fort que vous retenez (ce sera votre mot de passe pour vous connecter à l'application QHSE)
   - Cochez **"Auto Confirm User"**
4. Cliquez **"Create user"**

→ Votre compte apparaît dans la liste des Users.

### 3.3 — Vous attribuer le rôle administrateur

1. Sidebar Supabase → **"SQL Editor"**
2. Effacez tout, collez :

```sql
INSERT INTO public.user_roles (user_id, role, email, nom)
SELECT id, 'admin', email, 'Votre Nom Prénom'
FROM auth.users
WHERE email = 'VOTRE_EMAIL_ICI';
```

3. **Important** : remplacez `'VOTRE_EMAIL_ICI'` par votre email entre les apostrophes (ex. `'marie.dupont@entreprise.fr'`) et `'Votre Nom Prénom'` par votre vrai nom.
4. **Run** → "Success" vert.

✅ **Vous avez un compte admin qui pourra accéder à tout dans l'app.**

---

## 🟢 Étape 4 — Récupérer et configurer le code (10 min)

### 4.1 — Décompresser le ZIP

1. Si vous avez reçu un fichier `.zip` de l'application : décompressez-le sur votre Bureau (clic droit → "Extraire tout")
2. Vous obtenez un dossier (ex. `qhse-dashboard2`)
3. Ouvrez ce dossier

### 4.2 — Configurer le fichier `.env`

À la racine du dossier, vous voyez un fichier appelé `.env.example`.

1. **Copiez-le** dans le même dossier et **renommez** la copie en `.env` (sans rien à la fin, juste un point devant)
   - Sur Windows, si l'extension n'apparaît pas : Affichage → cocher "Extensions de noms de fichiers"
2. **Ouvrez `.env`** avec le Bloc-notes (clic droit → Ouvrir avec → Bloc-notes)
3. Remplissez avec **VOS clés** notées à l'étape 1.3 :

```
VITE_SUPABASE_URL=https://abcdefghijklmnop.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVC...
```

⚠️ **Pas d'espaces autour du `=`**. Pas de guillemets. Juste : variable, égal, valeur.

4. **Enregistrez** (Ctrl+S) et fermez.

✅ **Le code est configuré pour parler à VOTRE base de données Supabase.**

---

## 🟢 Étape 5 — Lancer l'application sur votre PC (10 min)

### 5.1 — Installer Node.js (à faire une seule fois)

Si Node.js n'est pas déjà installé sur votre PC :

1. Allez sur **[nodejs.org](https://nodejs.org)**
2. Cliquez sur le bouton **"LTS"** (version recommandée)
3. Lancez le programme téléchargé
4. Cliquez **Next** sur tous les écrans, puis **Install** (laissez les options par défaut)
5. Patientez la fin de l'installation
6. **Redémarrez** votre PC pour être sûre

### 5.2 — Ouvrir un terminal dans le dossier de l'app

- **Sur Windows** : ouvrez l'Explorateur de fichiers, allez dans le dossier `qhse-dashboard2`, cliquez dans la barre d'adresse, tapez `powershell` et appuyez sur Entrée. Une fenêtre noire s'ouvre.
- **Sur Mac** : ouvrez l'application **Terminal**, tapez `cd ` (avec un espace), puis glissez-déposez le dossier `qhse-dashboard2` dans la fenêtre, puis Entrée.

### 5.3 — Installer les dépendances

Dans la fenêtre noire qui s'est ouverte, tapez :

```
npm install
```

→ Appuyez Entrée. Patientez **2-5 minutes** pendant que ça charge plein de petites pièces (vous verrez du texte défiler — c'est normal).

À la fin, vous devez voir un message du type `added 250 packages in 2m`.

### 5.4 — Lancer l'application

Toujours dans la même fenêtre, tapez :

```
npm run dev
```

→ Entrée. Quelques secondes plus tard, vous voyez :

```
  VITE v8.x  ready in 200 ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: http://192.168.x.x:5173/
```

### 5.5 — Ouvrir l'app dans le navigateur

1. Ouvrez votre navigateur (Chrome, Edge, Firefox)
2. Tapez dans la barre d'adresse : `http://localhost:5173`
3. Vous devez voir un écran de connexion fond noir avec un logo bouclier 🛡️
4. Connectez-vous avec **votre email + mot de passe créés à l'étape 3.2**
5. ✅ **Le tableau de bord QHSE s'affiche !** Vous êtes admin.

⚠️ **Important** : tant que la fenêtre noire (terminal) reste ouverte, l'app fonctionne. Si vous la fermez, l'app s'arrête. Pour relancer plus tard : étape 5.2 + `npm run dev`.

---

## 🟡 Étape 6 (optionnel) — Mettre l'application en ligne (15 min)

Cette étape n'est nécessaire que si vous voulez que **votre Direction puisse consulter l'app sans que votre PC soit allumé**, depuis n'importe où sur Internet.

Si l'app ne sera utilisée que par vous depuis votre PC, **vous pouvez sauter cette étape**.

### 6.1 — Créer un compte Vercel

1. Allez sur **[vercel.com](https://vercel.com)** → **"Sign Up"**
2. Vous pouvez vous connecter avec **GitHub**, **Google** ou **email**. Choisissez ce qui vous arrange.
3. Une fois connectée, vous arrivez sur le dashboard.

### 6.2 — Mettre votre code sur GitHub (préalable)

Vercel a besoin de votre code source quelque part en ligne. Le plus simple : GitHub.

1. Inscrivez-vous sur **[github.com](https://github.com)** si pas déjà fait
2. Bouton **"+"** en haut à droite → **"New repository"**
3. **Repository name** : `qhse-monentreprise` (privé, ne pas cocher "Public")
4. **Create repository**
5. Suivez les instructions à l'écran "...or push an existing repository from the command line" → copiez les 3 commandes affichées et collez-les dans votre terminal (ouvert dans le dossier `qhse-dashboard2`).

Si vous bloquez ici, c'est l'étape la plus technique du processus. **N'hésitez pas à demander de l'aide à un proche développeur** — ça lui prendra 5 min.

### 6.3 — Connecter Vercel à votre repo

1. Dashboard Vercel → bouton **"Add New..."** → **"Project"**
2. Vercel liste vos repos GitHub → cliquez **"Import"** sur `qhse-monentreprise`
3. **Configure Project** :
   - Framework Preset : laisser **Vite** (auto-détecté)
   - **Environment Variables** → ajoutez vos 2 clés Supabase :
     - Nom `VITE_SUPABASE_URL`, valeur = votre URL Supabase
     - Nom `VITE_SUPABASE_ANON_KEY`, valeur = votre clé anon
4. Cliquez **"Deploy"**
5. Patientez 2-3 min.
6. Une fois terminé, Vercel affiche votre URL publique (ex. `qhse-monentreprise.vercel.app`).

✅ **Votre app est en ligne !** Partagez l'URL avec votre Direction.

---

## 🟢 Étape 7 — Premiers pas dans l'app (5 min)

Une fois connectée :

1. Allez dans **Paramètres** (sidebar) → renseignez le nom de votre entreprise et l'effectif
2. Allez dans **Registre DUERP** → cliquez "Identifier un risque" → testez la création
3. Cliquez **"Gérer les listes"** → personnalisez les unités de travail propres à votre activité
4. Quand vous serez à l'aise, créez le compte de votre Direction :
   - Sidebar bas-gauche → icône "Ajouter un utilisateur"
   - Email du DG, mot de passe temporaire, rôle **"Lecteur"**

Pour la suite de la prise en main, lisez le **`docs/USER_GUIDE.md`** dans le dossier — c'est le guide quotidien complet.

---

## 🆘 Si ça bloque

### "L'application ne se lance pas, le terminal affiche du rouge"

- Vérifiez que le fichier `.env` est bien rempli (étape 4.2)
- Fermez le terminal, ré-ouvrez-le, ressaisissez `npm install` puis `npm run dev`
- Vérifiez que vous êtes bien dans le bon dossier

### "Connexion à l'application : email/mot de passe incorrect"

- Cherchez votre compte dans Supabase → Authentication → Users. Il existe ?
- Cliquez sur le compte → bouton "Send password reset" (si vous avez oublié)

### "Une fois connectée, l'app affiche un écran 🔒 Compte non configuré"

- Vous avez créé l'utilisateur (étape 3.2) mais pas attribué le rôle (étape 3.3)
- Refaites l'étape 3.3 dans le SQL Editor

### "Erreur 401 dans la console quand je clique quelque part"

- C'est probablement parce qu'une migration n'a pas été appliquée correctement
- Reprenez l'étape 2.3 et exécutez les fichiers que vous n'avez peut-être pas appliqués

### "J'ai oublié mon mot de passe Database (étape 1.2)"

- Pas dramatique. Vous pouvez le réinitialiser : Supabase Dashboard → Settings → Database → Reset password.

### "Je suis perdue sur tout"

Contactez **votre prédécesseur** pour 30-60 min de visio de coaching. C'est largement suffisant pour franchir les blocages.

---

## ✅ Check-list finale

Vous êtes opérationnelle quand :

- [ ] Votre projet Supabase est créé en région EU
- [ ] La base de données contient 28 tables
- [ ] Votre compte admin existe et a le rôle `admin` dans `user_roles`
- [ ] Le fichier `.env` est rempli avec **vos** clés
- [ ] `npm run dev` démarre sans erreur
- [ ] Vous arrivez à vous connecter et créer un test dans le DUERP
- [ ] (Optionnel) Le déploiement Vercel est en ligne
- [ ] Vous avez créé le compte de votre Direction

---

## 📅 Bonnes habitudes à prendre

- **Une fois par mois** : faites un export d'archive Excel (menu Import Excel → bouton violet) et stockez-le sur un disque externe ou réseau d'entreprise. C'est votre filet de sécurité.
- **Tous les 6 mois** : changez votre mot de passe applicatif.
- **Tous les 6 mois** : vérifiez dans Supabase Authentication → Users qu'il n'y a aucun compte que vous ne reconnaissez pas (sinon, supprimez-le).

---

Bon courage pour la prise en main ! Une fois passées les 1h30 d'installation initiale, l'usage quotidien est très simple. Le `USER_GUIDE.md` est votre prochaine lecture.
