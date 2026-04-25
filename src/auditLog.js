import { supabase } from './supabaseClient';

/*
  TABLE SUPABASE À CRÉER (facultatif — fallback localStorage si absente) :

  CREATE TABLE audit_log (
    id          BIGSERIAL PRIMARY KEY,
    table_name  TEXT,
    record_id   TEXT,
    action      TEXT,       -- 'CREATE' | 'UPDATE' | 'DELETE'
    details     JSONB,
    user_name   TEXT,
    created_at  TIMESTAMPTZ DEFAULT NOW()
  );

  Utilisation dans n'importe quel module :
    import { logAction } from './auditLog';
    await logAction('plan_actions', data[0].id, 'CREATE', { titre: form.titre });
*/

const MAX_LOCAL    = 500;
const STORAGE_KEY  = 'qhse_audit_log';

function getLocal() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; }
}
function saveLocal(entries) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(entries.slice(-MAX_LOCAL))); } catch {}
}
// Étape E8 — Identité nominative dans l'audit log.
// Ordre de priorité pour identifier l'utilisateur :
//   1. session Supabase Auth → email réel (RGPD : traçabilité fiable)
//   2. user_metadata.nom (fallback si email absent)
//   3. localStorage qhse_profil.prenom (legacy, avant l'auth Supabase)
//   4. 'Utilisateur' (cas extrême — ne devrait plus arriver post-E7)
async function getUserIdentity() {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      const u = session.user;
      return {
        userName: u.email || u.user_metadata?.nom || u.user_metadata?.name || 'Utilisateur',
        userId:   u.id,
      };
    }
  } catch { /* session absente, fallback ci-dessous */ }
  try {
    const profil = JSON.parse(localStorage.getItem('qhse_profil') || '{}');
    return { userName: profil.prenom || 'Utilisateur', userId: null };
  } catch {
    return { userName: 'Utilisateur', userId: null };
  }
}

export async function logAction(tableName, recordId, action, details = {}, userName = '') {
  const identity = userName ? { userName, userId: null } : await getUserIdentity();

  const entry = {
    id:         `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    table_name: tableName,
    record_id:  String(recordId || ''),
    action,
    // On glisse user_id dans details pour le retrouver côté requête sans
    // changer le schéma de la table (audit_log n'a pas de colonne user_id).
    details:    { ...details, user_id: identity.userId },
    user_name:  identity.userName,
    created_at: new Date().toISOString(),
  };

  try {
    await supabase.from('audit_log').insert([{
      table_name: entry.table_name,
      record_id:  entry.record_id,
      action:     entry.action,
      details:    entry.details,
      user_name:  entry.user_name,
    }]);
  } catch {}

  const local = getLocal();
  local.push(entry);
  saveLocal(local);
}

export function getLocalLogs()   { return [...getLocal()].reverse(); }
export function clearLocalLogs() { localStorage.removeItem(STORAGE_KEY); }
