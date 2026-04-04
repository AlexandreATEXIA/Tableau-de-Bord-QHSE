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
function getUserName() {
  try { return JSON.parse(localStorage.getItem('qhse_profil') || '{}').prenom || 'Utilisateur'; } catch { return 'Utilisateur'; }
}

export async function logAction(tableName, recordId, action, details = {}, userName = '') {
  const entry = {
    id:         `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    table_name: tableName,
    record_id:  String(recordId || ''),
    action,
    details,
    user_name:  userName || getUserName(),
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
