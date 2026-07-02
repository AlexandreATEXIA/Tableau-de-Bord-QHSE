import React, { useState } from 'react';
import { supabase } from './supabaseClient';
import { Shield, Eye, EyeOff, LogIn, RefreshCw } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd]   = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [mode, setMode]         = useState('login'); // 'login' | 'reset'
  const [resetSent, setResetSent] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setError(error.message === 'Invalid login credentials'
      ? 'Email ou mot de passe incorrect.'
      : error.message);
    setLoading(false);
  };

  const handleReset = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin,
    });
    if (error) setError(error.message);
    else setResetSent(true);
    setLoading(false);
  };

  return (
    <div style={{
      minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(135deg, #050c18 0%, #0b1120 50%, #080f1e 100%)',
      padding: 20, fontFamily: 'inherit',
    }}>
      {/* Glow background */}
      <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: '20%', left: '30%', width: 400, height: 400, background: 'rgba(79,99,231,0.08)', borderRadius: '50%', filter: 'blur(80px)' }}/>
        <div style={{ position: 'absolute', bottom: '20%', right: '30%', width: 300, height: 300, background: 'rgba(16,185,129,0.06)', borderRadius: '50%', filter: 'blur(60px)' }}/>
      </div>

      <div style={{
        width: '100%', maxWidth: 400,
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 20,
        padding: '40px 36px',
        backdropFilter: 'blur(20px)',
        boxShadow: '0 32px 80px rgba(0,0,0,0.5)',
        position: 'relative', zIndex: 1,
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <img src="/logo-atexia.png" alt="ATEXIA" style={{ height:64, margin: '0 auto 14px', display:'block', objectFit:'contain' }} />
          <div style={{ fontSize: 20, fontWeight: 800, color: '#fff', letterSpacing: '-0.3px' }}>DEF Réunion</div>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#4F63E7', letterSpacing: '0.1em', marginTop: 3, textTransform: 'uppercase' }}>SMI Dashboard Pro</div>
        </div>

        {mode === 'login' ? (
          <>
            <h1 style={{ fontSize: 18, fontWeight: 700, color: '#fff', marginBottom: 6 }}>Connexion</h1>
            <p style={{ fontSize: 13, color: '#64748B', marginBottom: 24 }}>Accès réservé aux membres de l'équipe QHSE</p>

            <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>Email</label>
                <input
                  type="email" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="votre@email.com" required autoComplete="email"
                  style={{
                    width: '100%', padding: '11px 14px', borderRadius: 10,
                    background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                    color: '#fff', fontSize: 14, outline: 'none', boxSizing: 'border-box',
                    transition: 'border-color 0.15s',
                  }}
                  onFocus={e => e.target.style.borderColor = 'rgba(79,99,231,0.6)'}
                  onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
                />
              </div>

              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>Mot de passe</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPwd ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••" required autoComplete="current-password"
                    style={{
                      width: '100%', padding: '11px 40px 11px 14px', borderRadius: 10,
                      background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                      color: '#fff', fontSize: 14, outline: 'none', boxSizing: 'border-box',
                    }}
                    onFocus={e => e.target.style.borderColor = 'rgba(79,99,231,0.6)'}
                    onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
                  />
                  <button type="button" onClick={() => setShowPwd(v => !v)}
                    style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#64748B', padding: 0, display: 'flex' }}>
                    {showPwd ? <EyeOff size={16}/> : <Eye size={16}/>}
                  </button>
                </div>
              </div>

              {error && (
                <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '9px 12px', fontSize: 13, color: '#FCA5A5' }}>
                  {error}
                </div>
              )}

              <button type="submit" disabled={loading}
                style={{
                  width: '100%', padding: '12px', borderRadius: 10, border: 'none',
                  background: loading ? 'rgba(79,99,231,0.4)' : 'linear-gradient(135deg,#4F63E7,#3B4FD4)',
                  color: '#fff', fontSize: 14, fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  boxShadow: loading ? 'none' : '0 4px 20px rgba(79,99,231,0.4)',
                  transition: 'all 0.2s', marginTop: 4,
                }}>
                {loading ? <RefreshCw size={16} style={{ animation: 'spin 1s linear infinite' }}/> : <LogIn size={16}/>}
                {loading ? 'Connexion...' : 'Se connecter'}
              </button>
            </form>

            <button onClick={() => { setMode('reset'); setError(''); }}
              style={{ marginTop: 16, width: '100%', background: 'none', border: 'none', color: '#4F63E7', fontSize: 13, cursor: 'pointer', textAlign: 'center' }}>
              Mot de passe oublié ?
            </button>
          </>
        ) : (
          <>
            <h1 style={{ fontSize: 18, fontWeight: 700, color: '#fff', marginBottom: 6 }}>Réinitialisation</h1>
            <p style={{ fontSize: 13, color: '#64748B', marginBottom: 24 }}>Un lien vous sera envoyé par email</p>

            {resetSent ? (
              <div style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 10, padding: '16px', textAlign: 'center' }}>
                <div style={{ fontSize: 28, marginBottom: 8 }}>✉️</div>
                <p style={{ fontSize: 13, color: '#6EE7B7', fontWeight: 600 }}>Email envoyé !</p>
                <p style={{ fontSize: 12, color: '#64748B', marginTop: 4 }}>Vérifiez votre boîte mail pour réinitialiser votre mot de passe.</p>
              </div>
            ) : (
              <form onSubmit={handleReset} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label style={{ fontSize: 11, fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 6 }}>Email</label>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                    placeholder="votre@email.com" required
                    style={{ width: '100%', padding: '11px 14px', borderRadius: 10, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: 14, outline: 'none', boxSizing: 'border-box' }}/>
                </div>
                {error && <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '9px 12px', fontSize: 13, color: '#FCA5A5' }}>{error}</div>}
                <button type="submit" disabled={loading}
                  style={{ width: '100%', padding: '12px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg,#4F63E7,#3B4FD4)', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  {loading ? <RefreshCw size={16} style={{ animation: 'spin 1s linear infinite' }}/> : <Shield size={16}/>}
                  Envoyer le lien
                </button>
              </form>
            )}

            <button onClick={() => { setMode('login'); setResetSent(false); setError(''); }}
              style={{ marginTop: 16, width: '100%', background: 'none', border: 'none', color: '#64748B', fontSize: 13, cursor: 'pointer', textAlign: 'center' }}>
              ← Retour à la connexion
            </button>
          </>
        )}

        <div style={{ marginTop: 28, paddingTop: 20, borderTop: '1px solid rgba(255,255,255,0.06)', textAlign: 'center', fontSize: 11, color: '#334155' }}>
          SMI Dashboard Pro · Accès sécurisé
        </div>
      </div>
    </div>
  );
}
