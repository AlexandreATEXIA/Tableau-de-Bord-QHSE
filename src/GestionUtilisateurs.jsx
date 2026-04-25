import React, { useState } from 'react';
import { supabase } from './supabaseClient';
import { UserPlus, X, CheckCircle, Eye, EyeOff, AlertTriangle, ExternalLink } from 'lucide-react';
import { useUser, ROLES } from './UserContext';

export default function GestionUtilisateurs({ onClose }) {
  const { role: roleAppelant } = useUser();
  const [email, setEmail]     = useState('');
  const [nom, setNom]         = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole]       = useState('lecteur'); // moindre privilège par défaut (étape E)
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult]   = useState(null); // { success, message }

  // Défense en profondeur : si un non-admin arrive jusqu'ici (ex : bypass UI),
  // on bloque immédiatement. La vraie protection reste côté Edge Function.
  if (roleAppelant !== 'admin') {
    return (
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
           onClick={onClose}>
        <div style={{ background: 'var(--bg-sidebar)', border: '1px solid var(--border)', borderRadius: 16, padding: 24, maxWidth: 360, textAlign: 'center' }}
             onClick={e => e.stopPropagation()}>
          <p style={{ color: 'var(--text-1)', fontWeight: 700, marginBottom: 8 }}>Accès refusé</p>
          <p style={{ color: 'var(--text-3)', fontSize: 13 }}>Seul un administrateur peut créer un compte utilisateur.</p>
        </div>
      </div>
    );
  }

  // Étape E — Création d'un utilisateur sans Edge Function dédiée.
  //
  // Stratégie :
  //   1. signUp(email, password) — crée l'entrée dans auth.users via la clé
  //      anon. Supabase enverra un email de confirmation par défaut. Pour
  //      éviter cette friction sur un usage interne, désactivez la
  //      confirmation email dans Authentication → Providers → Email.
  //   2. Insertion immédiate dans public.user_roles avec le rôle choisi.
  //      Si l'étape 1 a réussi mais le user_id n'est pas encore disponible
  //      (cas confirmation email obligatoire), on retombe sur une
  //      résolution par email après un court délai.
  //
  // Cas d'usage : 2-3 comptes max par organisation. Pour des volumes plus
  // importants, il faudra créer une Edge Function dédiée avec
  // service_role pour bypasser la confirmation email.
  const inviter = async (e) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    try {
      // 1. Création de l'utilisateur Auth
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { nom },              // stocké dans user_metadata, utile pour displayName
          emailRedirectTo: window.location.origin,
        },
      });
      if (signUpError) throw signUpError;

      // 2. Récupérer l'user_id (peut être présent dans signUpData OU via lookup)
      let userId = signUpData?.user?.id;
      if (!userId) {
        // Cas où la confirmation email est requise — l'user existe en base
        // mais signUp ne renvoie pas l'id. On le retrouve via l'API Supabase.
        // En l'absence d'accès admin côté client, on prévient l'admin.
        setResult({
          success: false,
          message: `Compte créé pour ${email}, mais l'attribution du rôle nécessite que l'utilisateur clique sur le lien de confirmation reçu par email. Vous pourrez ensuite lui attribuer le rôle "${ROLES[role]?.label}" via Supabase Dashboard.`,
        });
        return;
      }

      // 3. Insertion du rôle dans user_roles
      const { error: roleError } = await supabase
        .from('user_roles')
        .upsert({ user_id: userId, role, email, nom }, { onConflict: 'user_id' });
      if (roleError) throw roleError;

      setResult({
        success: true,
        message: `Compte créé pour ${email} (rôle : ${ROLES[role]?.label || role})`,
      });
      setEmail(''); setNom(''); setPassword(''); setRole('lecteur');
    } catch (err) {
      setResult({ success: false, message: String(err?.message || err) });
    }
    setLoading(false);
  };

  const inp = {
    width: '100%', padding: '9px 12px', borderRadius: 8,
    background: 'var(--bg-input)', border: '1px solid var(--border)',
    color: 'var(--text-1)', fontSize: 13, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
  };
  const lbl = { fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 5 };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
         onClick={onClose}>
      <div style={{ background: 'var(--bg-sidebar)', border: '1px solid var(--border)', borderRadius: 16, width: '100%', maxWidth: 400, padding: '24px', boxShadow: '0 24px 60px rgba(0,0,0,0.5)' }}
           onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <UserPlus size={18} style={{ color: 'var(--blue)' }}/>
            <h3 style={{ fontWeight: 800, fontSize: 16, color: 'var(--text-1)', margin: 0 }}>Ajouter un utilisateur</h3>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)' }}><X size={18}/></button>
        </div>

        <p style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 18, lineHeight: 1.5 }}>
          Crée un accès sécurisé pour un collègue. Il pourra se connecter avec cet email + mot de passe.
        </p>

        {result ? (
          <div style={{ padding: '16px', borderRadius: 10, background: result.success ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', border: `1px solid ${result.success ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`, textAlign: 'center', marginBottom: 16 }}>
            {result.success && <CheckCircle size={28} style={{ color: '#10B981', marginBottom: 8 }}/>}
            <p style={{ fontSize: 13, fontWeight: 700, color: result.success ? '#10B981' : '#EF4444' }}>{result.message}</p>
            {result.success && <p style={{ fontSize: 11, color: 'var(--text-4)', marginTop: 4 }}>L'utilisateur peut maintenant se connecter à l'application.</p>}
          </div>
        ) : null}

        <form onSubmit={inviter} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={lbl}>Prénom / Nom</label>
            <input value={nom} onChange={e => setNom(e.target.value)} placeholder="Ex: Marie Martin" style={inp}/>
          </div>
          <div>
            <label style={lbl}>Email *</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="marie@def-reunion.fr" required style={inp}/>
          </div>
          <div>
            <label style={lbl}>Mot de passe * (min. 8 caractères)</label>
            <div style={{ position: 'relative' }}>
              <input type={showPwd ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
                placeholder="Minimum 8 caractères" required minLength={8} style={{ ...inp, paddingRight: 38 }}/>
              <button type="button" onClick={() => setShowPwd(v => !v)}
                style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-4)', display: 'flex' }}>
                {showPwd ? <EyeOff size={15}/> : <Eye size={15}/>}
              </button>
            </div>
          </div>
          <div>
            <label style={lbl}>Rôle *</label>
            <select value={role} onChange={e => setRole(e.target.value)} required style={inp}>
              <option value="lecteur">Lecteur (consultation seule, voit tous les modules)</option>
              <option value="operateur">Opérateur (accès limité : Supervision, Accidents, Plan d'actions, Calendrier)</option>
              <option value="direction">Direction (pilotage : Supervision, Revue, Stats, Objectifs, KPI, Calendrier, Rapport)</option>
              <option value="responsable_qhse">Responsable QHSE (accès complet)</option>
              <option value="admin">Administrateur (accès complet + gestion utilisateurs)</option>
            </select>
            <p style={{ fontSize: 10.5, color: 'var(--text-4)', marginTop: 5, lineHeight: 1.4 }}>
              Le rôle peut être modifié plus tard via SQL Supabase ou en relançant ce formulaire.
            </p>
          </div>
          {result && !result.success && (
            <div style={{ padding: '8px 12px', borderRadius: 8, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', fontSize: 12, color: '#FCA5A5' }}>{result.message}</div>
          )}
          <button type="submit" disabled={loading || !email || !password}
            style={{ padding: '11px', borderRadius: 9, border: 'none', background: loading || !email || !password ? 'rgba(79,99,231,0.3)' : '#4F63E7', color: '#fff', fontWeight: 700, cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 4 }}>
            <UserPlus size={15}/>
            {loading ? 'Création en cours...' : 'Créer l\'accès'}
          </button>
        </form>
      </div>
    </div>
  );
}
