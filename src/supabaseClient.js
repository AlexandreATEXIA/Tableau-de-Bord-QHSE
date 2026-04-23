import { createClient } from '@supabase/supabase-js';

// Les secrets sont lus depuis les variables d'environnement Vite (.env local,
// Environment Variables sur Vercel pour les environnements Preview/Production).
// Ne jamais committer les valeurs réelles : voir .env.example pour le template.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Fail-fast : si la configuration est incomplète, on refuse de démarrer l'app
// plutôt que de laisser un écran blanc ou des erreurs silencieuses.
if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    'Configuration Supabase manquante. ' +
    'Vérifie que VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY sont définies ' +
    'dans .env (local) ou dans les Environment Variables Vercel (production).'
  );
}

export const supabase = createClient(supabaseUrl, supabaseKey);