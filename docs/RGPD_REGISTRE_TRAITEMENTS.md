# Registre des activités de traitement — RGPD Art. 30

**Responsable de traitement** : DEF Réunion (à compléter : SIRET, adresse, représentant légal)
**Délégué à la protection des données (DPO)** : _(à désigner — obligation Art. 37 si traitement à grande échelle de catégories particulières de données, ce qui est le cas ici pour les accidents de travail)_
**Dernière mise à jour** : 2026-04-24
**Version** : 1.0 (Lot 6 Phase 1 — fondations)

---

## Sommaire

1. [Préambule et base juridique](#1-préambule)
2. [Traitements recensés](#2-traitements-recensés)
3. [Mesures de sécurité communes](#3-mesures-de-sécurité)
4. [Droits des personnes concernées](#4-droits-des-personnes)
5. [Durées de conservation](#5-durées-de-conservation)
6. [Transferts hors UE](#6-transferts-hors-ue)
7. [Procédure de violation de données](#7-violation-de-données)

---

## 1. Préambule

Le présent registre formalise, au titre de l'article 30 du Règlement (UE) 2016/679 (RGPD), la liste des traitements de données à caractère personnel mis en œuvre par l'application SMI Dashboard Pro (module QHSE).

La base de données Supabase (région eu-north-1, Stockholm) héberge l'ensemble des données. L'authentification est gérée par Supabase Auth.

**Note de conformité (2026-04-24)** : le déploiement actuel présente une non-conformité partielle à l'article 32 (sécurité du traitement) — les policies Row Level Security ne sont activées que sur 4 des 25 tables publiques. La remédiation est planifiée en Lot 5 Phase 2 (rollout Supabase Auth).

---

## 2. Traitements recensés

### 2.1 Gestion du personnel — `rh_employes`

| Rubrique | Valeur |
|---|---|
| **Finalité** | Identification des salariés, pilotage des compétences et habilitations |
| **Base légale (Art. 6)** | 6.1.b — Exécution du contrat de travail |
| **Catégories de personnes** | Salariés en CDI/CDD, intérimaires, stagiaires, apprentis |
| **Catégories de données** | Identité (nom, prénom), coordonnées (email pro), vie professionnelle (poste, unité, date d'embauche, date de sortie) |
| **Destinataires internes** | Service RH, responsable QHSE, encadrants hiérarchiques |
| **Destinataires externes** | Médecine du travail (sur demande ciblée), CNAM (déclarations AT-MP), inspection du travail (contrôles) |
| **Durée de conservation** | 5 ans après la sortie du salarié (bulletins paie : Code du travail L3243-4) |
| **Transferts hors UE** | Non |

### 2.2 Habilitations et compétences — `rh_habilitations` / `habilitations`

| Rubrique | Valeur |
|---|---|
| **Finalité** | Traçabilité des qualifications professionnelles (CACES, habilitations électriques, autorisations de conduite, certifications) |
| **Base légale** | 6.1.c — Obligation légale (Code du travail R4323-55 et suiv.) |
| **Catégories de personnes** | Salariés opérant des équipements ou activités réglementées |
| **Catégories de données** | Identité, type d'habilitation, organisme formateur, date d'obtention, date d'expiration |
| **Destinataires** | Service RH, responsable QHSE, encadrants, inspection du travail |
| **Durée de conservation** | 10 ans après expiration (couverture des accidents différés) |
| **Transferts hors UE** | Non |

### 2.3 Formations — `rh_formations`

| Rubrique | Valeur |
|---|---|
| **Finalité** | Preuve de l'obligation de formation à la sécurité (Code du travail L4141-1 et suiv.), suivi du plan de développement des compétences |
| **Base légale** | 6.1.c — Obligation légale (Code du travail L6321-1) |
| **Catégories de personnes** | Salariés ayant suivi une formation |
| **Catégories de données** | Identité, intitulé de la formation, date, durée, organisme, résultat/attestation |
| **Destinataires** | Service RH, responsable QHSE, OPCO (contrôles), inspection du travail |
| **Durée de conservation** | 5 ans |
| **Transferts hors UE** | Non |

### 2.4 Accidents du travail — `securite_accidents`

| Rubrique | Valeur |
|---|---|
| **Finalité** | Déclaration AT-MP, analyse des causes, prévention (obligation Art. L441-1 CSS) |
| **Base légale** | 6.1.c — Obligation légale ET 6.1.d — Intérêt vital de la personne concernée |
| **Catégorie particulière Art. 9** | **OUI** — données de santé (description des lésions, suites médicales) |
| **Justification Art. 9.2** | 9.2.b — Obligation en matière de droit du travail et de la sécurité sociale |
| **Catégories de personnes** | Salariés accidentés, témoins |
| **Catégories de données** | Identité, circonstances, lésions, arrêt de travail, témoins |
| **Destinataires** | CPAM (déclaration DS-AT), médecine du travail, inspection du travail, CSE, organismes de prévention (CARSAT) |
| **Durée de conservation** | **50 ans** (délai de prescription des maladies professionnelles à effet différé) |
| **Transferts hors UE** | Non |
| **DPIA requise** | Oui (données de santé, Art. 35) — _à formaliser en Phase 2_ |

### 2.5 Plan d'actions QHSE — `plan_actions`

| Rubrique | Valeur |
|---|---|
| **Finalité** | Pilotage des actions correctives et préventives (ISO 9001 §10.2) |
| **Base légale** | 6.1.f — Intérêt légitime (pilotage qualité) |
| **Catégories de personnes** | Salariés désignés comme pilote ou contributeur d'une action |
| **Catégories de données** | Identité (nom du pilote), contenu de l'action |
| **Durée de conservation** | 5 ans après clôture de l'action |

### 2.6 Réunions QHSE — `reunions_qhse`

| Rubrique | Valeur |
|---|---|
| **Finalité** | Traçabilité des comités de pilotage et revues ISO |
| **Base légale** | 6.1.f — Intérêt légitime |
| **Catégories de données** | Identité des participants, contenu des débats |
| **Durée de conservation** | 5 ans |

### 2.7 Journal d'audit technique — `audit_log`

| Rubrique | Valeur |
|---|---|
| **Finalité** | Preuve d'intégrité des modifications (ISO 9001 §7.5.3), investigations de sécurité |
| **Base légale** | 6.1.f — Intérêt légitime (obligation de preuve) + 6.1.c (ISO contractuelle) |
| **Catégories de données** | Identité de l'utilisateur (email/id Supabase), action, table, données avant/après |
| **Destinataires** | Auditeurs qualité internes et externes (AFNOR, Bureau Veritas) |
| **Durée de conservation** | 10 ans (alignée ISO + diligence RGPD) |
| **Immutabilité** | Prévue en Lot 6 Phase 2 (RLS INSERT-only, pas de DELETE) |

---

## 3. Mesures de sécurité

### État actuel (2026-04-24)

| Mesure | État | Référence |
|---|---|---|
| Hébergement UE (eu-north-1) | ✅ OK | Supabase |
| TLS/HTTPS en transit | ✅ OK | Supabase |
| Chiffrement au repos (disque) | ✅ OK | Supabase par défaut |
| Authentification utilisateurs | ✅ OK | Supabase Auth |
| RBAC rôles (admin / responsable_qhse / direction / operateur) | ✅ OK | `UserContext.jsx` |
| Row Level Security (RLS) sur tables sensibles | ⚠️ **PARTIEL** (4/25) | Lot 5 Phase 2 |
| Fonctions SQL `search_path` fixe | ✅ OK | Lot 5 Phase 1 |
| Bucket storage : pas de listing | ✅ OK | Lot 5 Phase 1 |
| HaveIBeenPwned check sur mots de passe | ⏳ À activer | Console Supabase |
| Journal d'audit applicatif (`logAction`) | ✅ OK | Lot 3 |
| Chiffrement colonne pour données de santé | ❌ Non | Lot 6 Phase 3 |

### Gouvernance

- Revue annuelle du registre par le responsable QHSE
- Information aux salariés lors de leur embauche (annexe au contrat)
- Désignation d'un DPO externe recommandée (volume de données santé)

---

## 4. Droits des personnes

Les personnes concernées peuvent exercer leurs droits via `rgpd@defreunion.local` _(à configurer)_.

| Droit | Article RGPD | Outil en place |
|---|---|---|
| Accès | Art. 15 | Module RGPD → Export personne |
| Rectification | Art. 16 | Admin applicatif (modification ligne `rh_employes`) |
| Effacement | Art. 17 | Module RGPD → Anonymisation |
| Limitation | Art. 18 | Manuel (ticket) — à industrialiser Phase 2 |
| Portabilité | Art. 20 | Module RGPD → Export JSON |
| Opposition | Art. 21 | Manuel (ticket) — à industrialiser Phase 2 |

**Délai légal de réponse** : 1 mois (Art. 12), extensible à 3 mois pour demandes complexes.

Toute demande est journalisée dans la table `rgpd_demandes` (cf. migration `20260424000002_lot6_phase1_rgpd_fondations.sql`).

---

## 5. Durées de conservation

Centralisées dans `src/utils/rgpd.js` (constante `DUREES_CONSERVATION_ANNEES`).

| Table | Durée | Fondement |
|---|---|---|
| `rh_employes` | 5 ans après sortie | Code du travail L3243-4 (paie) |
| `rh_habilitations` | 10 ans post-expiration | Prévention accidents différés |
| `habilitations` | 10 ans | idem |
| `rh_formations` | 5 ans | Code du travail L6321-1 |
| `securite_accidents` | **50 ans** | Prescription MP différée (L441-4 CSS) |
| `plan_actions` | 5 ans | Opérationnel |
| `reunions_qhse` | 5 ans | Opérationnel |
| `audit_log` | 10 ans | ISO 9001 §7.5.3 + RGPD diligence |
| `registre_duerp` | 40 ans | Décret 2022-395 (traçabilité expositions) |

---

## 6. Transferts hors UE

**Aucun** à ce jour. Supabase région eu-north-1 (Stockholm, Suède, UE).

---

## 7. Violation de données

Procédure à formaliser en Phase 3. Points clés :

- **Délai notification CNIL** : 72h (Art. 33)
- **Délai information personnes concernées** : sans délai (Art. 34) si risque élevé
- **Modèle de notification** : à préparer dans `NotificationsEmail.jsx`
- **Registre interne des violations** : obligatoire (Art. 33.5)

---

_Document généré automatiquement par le Lot 6 Phase 1. Toute modification doit être validée par le DPO ou le responsable QHSE et versionnée dans le dépôt._
