import React, { useState } from 'react';
import { supabase } from './supabaseClient';
import { Lock, Mail, ShieldCheck } from 'lucide-react';

export default function Auth() {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    // Demande à Supabase de vérifier l'email et le mot de passe
    const { error } = await supabase.auth.signInWithPassword({
      email: email,
      password: password,
    });

    if (error) {
      setErrorMsg("Email ou mot de passe incorrect.");
    }
    setLoading(false);
  };

  return (
    <div className="flex items-center justify-center h-screen bg-[#0B1120]">
      <div className="glass-panel p-8 w-full max-w-md relative overflow-hidden">
        
        {/* Effet visuel */}
        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-blue-600 to-emerald-500"></div>
        
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-blue-500/20 text-blue-400 rounded-2xl shadow-[0_0_15px_rgba(59,130,246,0.5)]">
              <ShieldCheck size={40} />
            </div>
          </div>
          <h1 className="text-2xl font-extrabold text-white tracking-widest uppercase">DEF Réunion</h1>
          <p className="text-sm text-blue-400 font-bold mt-1">SMI DASHBOARD PRO</p>
          <p className="text-slate-400 mt-2 text-sm">Veuillez vous identifier pour accéder au portail</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-5">
          <div>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Mail size={18} />
              </div>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Adresse Email"
                className="w-full pl-10 pr-3 py-3 bg-slate-900/50 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-blue-500 transition-colors"
                required
              />
            </div>
          </div>

          <div>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <Lock size={18} />
              </div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Mot de passe"
                className="w-full pl-10 pr-3 py-3 bg-slate-900/50 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-blue-500 transition-colors"
                required
              />
            </div>
          </div>

          {errorMsg && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-lg text-center font-medium">
              {errorMsg}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg transition-colors flex justify-center items-center shadow-[0_0_15px_rgba(37,99,235,0.4)] disabled:opacity-50"
          >
            {loading ? 'Vérification...' : 'Se connecter'}
          </button>
        </form>
      </div>
    </div>
  );
}