# Guide utilisateur — SMI Dashboard QHSE

Guide pratique pour utiliser l'application au quotidien. **Aucune compétence technique requise.**

---

## 1. Première connexion

1. Votre administrateur QHSE vous a transmis :
   - Une **URL** de l'application (généralement `https://qhse-dashboard2.vercel.app`)
   - Un **email + mot de passe** (ou un lien magique pour le DG)

2. Ouvrez l'URL dans votre navigateur (Chrome, Edge, Firefox — récents)
3. Vous arrivez sur l'écran de connexion (fond noir, logo bouclier 🛡️)
4. Saisissez votre email et mot de passe → **Se connecter**

### Mot de passe oublié

Cliquez **"Mot de passe oublié ?"** sous le formulaire → vous recevrez un email avec un lien de réinitialisation. Le lien expire après 1 heure.

### Bonnes pratiques

- Choisissez un mot de passe **différent** de vos autres comptes professionnels
- Minimum 12 caractères, mélange majuscules/minuscules/chiffres/symboles
- Ne le notez nulle part de visible (post-it, fichier texte non chiffré)
- Activez le **gestionnaire de mots de passe** intégré au navigateur

---

## 2. Comprendre votre rôle

En bas à gauche de l'app, sous votre nom, vous voyez votre rôle :

| Rôle affiché | Couleur | Ce que vous pouvez faire |
|---|---|---|
| **Administrateur** | violet | Tout — créer, modifier, supprimer, gérer utilisateurs |
| **Responsable QHSE** | bleu | Tout sauf gestion utilisateurs |
| **Direction** | orange | Consulter pilotage : Supervision, Revue, KPIs, Rapport |
| **Lecteur** | cyan | Tout consulter, ne peut rien modifier |
| **Opérateur** | vert | Saisie limitée : Accidents, Plan d'actions, Calendrier |

Si votre rôle ne vous donne pas accès à un menu, il n'apparaît simplement pas dans la barre latérale. Si vous pensez avoir besoin d'un accès supplémentaire, contactez votre admin.

---

## 3. Navigation générale

### Sidebar (barre latérale gauche)

Deux groupes de modules :

**Modules QHSE** (saisie quotidienne)
- Supervision, Registre DUERP, Accidents, Qualité, Environnement, Social/RH, Plan d'Actions, Calendrier, Veille, Réunions, Fournisseurs

**Analyses & Outils** (consultation/export)
- Revue de Direction, Statistiques, Objectifs annuels, KPIs, Import/Export Excel, Rapport PDF, Archives, Journal d'audit, Conformité RGPD, Recherche globale, Paramètres, Alertes Email

### En haut à droite

- Date du jour
- Avatar avec votre nom — bouton de **déconnexion**

### Bouton flottant en bas à droite (➕ bleu)

Actions rapides selon le module sur lequel vous êtes (ajouter un risque, déclarer un accident, etc.).

---

## 4. Modules QHSE — guide rapide

### 4.1 — Registre DUERP (évaluation des risques)

**Objectif** : recenser les dangers professionnels par unité de travail et calculer leur criticité.

1. Bouton orange **"+ Identifier un risque"**
2. Choisir l'unité de travail, la famille de risque, décrire le danger
3. Évaluer Gravité (1-4) × Probabilité (1-4) = **Criticité initiale**
4. Cocher les mesures déjà en place (EPC, Organisation, EPI) — ça réduit la criticité
5. Voir la **Criticité résiduelle** s'afficher (badge couleur Inacceptable / Action requise / À surveiller / Acceptable)
6. Si nécessaire, ajouter une **action préventive** avec pilote et échéance

Astuce : utilisez **"Gérer les listes"** pour personnaliser les unités de travail et les familles de risques propres à votre activité.

### 4.2 — Accidents & Incidents

**Objectif** : déclarer les événements (accident, presqu'accident, maladie pro), lancer l'enquête.

1. Bouton rouge **"+ Déclarer un événement"**
2. Saisir date, type, lieu, description, victime/témoin
3. Statut enquête : "À lancer" → "En cours d'analyse" → "Actions définies" → "Clôturée"
4. Causes immédiates et mesures correctives directement dans le formulaire

Suivi des KPIs : Taux de Fréquence (TF) et Taux de Gravité (TG) calculés automatiquement.

### 4.3 — Plan d'Actions (PDCA)

**Objectif** : suivre toutes les actions préventives et correctives avec leur avancement.

1. Bouton **"+ Nouvelle action"**
2. Origine (DUERP, Audit, NC, Réclamation, etc.) → Domaine → Type
3. Pilote, échéance, priorité
4. Avancement (%) à mettre à jour régulièrement
5. À la clôture : évaluer l'**efficacité** (Efficace / Partiellement / Non efficace)

### 4.4 — Qualité & Audits

Quatre sous-onglets :
- **Audits** — planifier et suivre les audits internes/externes
- **NC** — non-conformités à traiter
- **Satisfaction** — enquêtes clients
- **QVT** — qualité de vie au travail

### 4.5 — Environnement

**Objectif** : suivre les flux énergie, eau, déchets pour le bilan carbone.

1. Bouton vert **"+ Ajouter un relevé"**
2. Date, type de flux (Électricité, Gaz, Eau, DIB, etc.), quantité, unité
3. Émissions CO2 calculées automatiquement à partir des facteurs réglementaires
4. Suivi mensuel + tendances

### 4.6 — Social & RH

Trois sous-onglets :
- **Effectifs** — registre des employés (nom, poste, contrat)
- **Formations** — plan de formation avec coûts et statuts
- **Habilitations** — gestion des dates d'obtention et expiration

### 4.7 — Habilitations (sous-onglet RH ou dédié)

**Objectif** : ne plus jamais laisser une habilitation expirer.

- Liste des habilitations par employé avec **statut couleur** :
  - 🟢 Valide (> 90 jours)
  - 🔵 < 90 jours (à planifier le recyclage)
  - 🟡 < 30 jours (urgent)
  - 🔴 Périmée

L'app calcule automatiquement la date d'expiration en fonction de la durée de validité saisie.

### 4.8 — Calendrier QHSE

Vue mensuelle de toutes les échéances (actions, formations, audits, habilitations) — utile pour la planification de la semaine.

### 4.9 — Réunions QHSE

Tracer les réunions QHSE (CSE, Quart d'heure sécurité, comité de pilotage) avec ordre du jour, présents, décisions.

---

## 5. Analyses & Outils

### 5.1 — Supervision (Comex)

Tableau de bord de synthèse pour la Direction. **C'est l'écran que le DG ouvre en premier.**

Affiche en un coup d'œil :
- Nombre de risques par criticité
- Accidents en cours
- Actions en retard / urgentes
- Habilitations qui expirent bientôt
- Évolution des KPIs

### 5.2 — Statistiques

Graphiques détaillés par module (par année, par service, par cause, etc.). Sélecteur d'année en haut.

### 5.3 — KPIs & Indicateurs

Calcul automatique des indicateurs réglementaires :
- TF = (nombre d'accidents avec arrêt) × 1 000 000 / heures travaillées
- TG = (jours d'arrêt) × 1 000 / heures travaillées
- Taux de couverture habilitations
- Taux de réalisation du plan d'actions

### 5.4 — Revue de Direction

Compilation annuelle pour la revue de direction (norme ISO 9001/14001/45001) avec génération PDF.

### 5.5 — Import Excel

Pour ajouter beaucoup de données d'un coup (récupération d'un Excel existant, par exemple) :

1. **Templates Excel** — télécharger les modèles de fichier
2. Remplir les onglets correspondants à vos données
3. Glisser le fichier dans la zone de dépôt
4. Vérifier l'aperçu → corriger si erreurs signalées
5. **Importer** (mode Ajout par défaut, ou Mise à jour pour ré-importer un fichier corrigé)

**Mode Mise à jour (upsert)** : à utiliser si vous corrigez des lignes déjà importées (évite les doublons).

### 5.6 — Exporter l'archive

Bouton violet **"Exporter l'archive"** dans Import Excel :

- Export complet de toutes vos données dans un seul fichier `.xlsx`
- Un onglet par module + métadonnées + schéma
- Ré-importable tel quel pour reconstituer une instance

**Recommandation** : faire un export **mensuel** et le sauvegarder sur un disque réseau ou clé USB. Sécurité supplémentaire en cas de problème.

### 5.7 — Rapport PDF

Génération de rapports formatés pour impression (audit interne, direction, certification).

### 5.8 — Archives & Export

Visualisation des données archivées (actions terminées, accidents clôturés). Possibilité de désarchiver si besoin.

### 5.9 — Journal d'audit

Trace de qui a fait quoi dans l'app, à quelle date. Utile pour :
- Comprendre quand une donnée a été modifiée
- Conformité RGPD (Art. 32)
- Investigation en cas de doute

### 5.10 — Conformité RGPD

Module dédié à la gestion des demandes RGPD (accès, rectification, effacement). Voir le doc `RGPD_REGISTRE_TRAITEMENTS.md` pour les procédures complètes.

### 5.11 — Recherche globale

Une seule barre pour chercher dans tous les modules à la fois (par mot-clé : nom d'employé, type de danger, etc.).

### 5.12 — Paramètres

Configuration de l'entreprise : nom, effectif, heures travaillées par an (utilisées pour le calcul des KPIs).

### 5.13 — Alertes Email (en cours)

Configuration des notifications automatiques (échéances proches, accidents non clôturés, etc.). Module en cours de développement.

---

## 6. Listes de référence personnalisées

Dans la plupart des modules, vous trouverez un bouton **"Gérer les listes"**. Il vous permet d'ajouter/supprimer/réordonner les options des menus déroulants (familles de risques, postes, organismes de formation, etc.).

⚠️ **Particularité étape B** : les listes sont partagées entre tous les utilisateurs et synchronisées en temps réel. Si vous ajoutez "Risque cyber" dans les Familles de risques, votre DG le verra apparaître chez lui sans rafraîchissement.

Les listes sont également **enrichies automatiquement** lors d'un import Excel : si votre fichier contient des valeurs nouvelles, elles sont ajoutées au menu déroulant.

---

## 7. Astuces pratiques

### Recherche rapide

- `Ctrl + K` (à venir) — pas encore implémenté, mais le menu **Recherche globale** fait le job
- Filtres en haut de chaque module (par statut, période, etc.)

### Mode lecture seule

Si vous êtes connecté en tant que **Lecteur** (DG), tous les boutons "Ajouter / Modifier / Supprimer" sont **invisibles**. Vous pouvez tout consulter sans risque de toucher aux données par mégarde.

### Mode hors ligne (limité)

L'app fonctionne **partiellement** sans connexion Internet (les listes en cache local restent visibles), mais aucune modification ne sera enregistrée tant que la connexion n'est pas revenue. **Ne saisissez pas en mode déconnecté** — vos saisies seront perdues.

### Sur mobile / tablette

L'app est responsive. La sidebar se replie en hamburger. Pour la saisie, un ordinateur reste plus confortable.

---

## 8. En cas de problème

### "Je ne vois pas un menu"
→ Votre rôle ne vous donne pas accès. Contactez votre admin pour vérifier.

### "L'app affiche un spinner sans fin"
→ Faites **Ctrl + Shift + R** pour rafraîchir sans cache. Si ça persiste, contactez votre admin.

### "Une erreur 401 dans la console"
→ Votre session a expiré. Déconnectez-vous → reconnectez.

### "Je ne peux pas enregistrer / cliquer Ajouter ne fait rien"
→ Vérifier votre rôle (lecteur = pas d'écriture). Sinon, F12 → Console → copier l'erreur et envoyer à votre admin.

### "J'ai supprimé une donnée par erreur"
→ Allez dans **Archives & Export** → la donnée est probablement archivée plutôt que supprimée. Si vraiment supprimée, votre admin peut la restaurer depuis la dernière archive Excel mensuelle.

---

## 9. Contact

Pour toute question fonctionnelle (comment faire ceci, à quoi sert cela), contactez votre admin QHSE en interne. Pour un bug technique, le journal d'audit et les captures d'écran de la console (F12) accélèrent grandement la résolution.

Bonne utilisation !
