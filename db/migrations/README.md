# Migrations SQL — QHSE Dashboard

Ce dossier contient les migrations SQL destinées à Supabase.

## Pourquoi `db/migrations/` et pas `supabase/migrations/` ?

Le dossier canonique Supabase CLI est `supabase/migrations/` à la racine
du dépôt. Cependant, dans certains environnements de développement
(sandbox mount Windows), ce dossier n'est pas accessible en écriture.
Les migrations sont donc livrées ici et **doivent être copiées** vers
`supabase/migrations/` avant `supabase db push`.

## Procédure de déploiement

### Option A — Dashboard Supabase (recommandé)

1. Ouvrir [Dashboard Supabase](https://supabase.com/dashboard) → projet `cwreletuirtrnviqlila`
2. SQL Editor → New query
3. Coller le contenu du fichier `.sql` dans l'ordre chronologique (timestamp croissant)
4. Exécuter
5. Vérifier avec les blocs `VALIDATION POST-MIGRATION` en fin de fichier

### Option B — Supabase CLI

```bash
# Depuis la racine du dépôt (poste Windows, pas le sandbox)
cp db/migrations/*.sql supabase/migrations/
supabase db push
```

## Ordre d'exécution

1. `20260424000001_lot5_phase1_quickwins.sql` — sécurité (search_path, bucket)
2. `20260424000002_lot6_phase1_rgpd_fondations.sql` — colonnes RGPD + table demandes

## Action console (non scriptable)

Après déploiement de la migration 20260424000001 :
- Dashboard Supabase → Authentication → Policies → **Enable Leaked Password Protection**
