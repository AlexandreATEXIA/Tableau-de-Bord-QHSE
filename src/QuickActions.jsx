import React, { useState } from 'react';
import { Plus, X, HeartPulse, FileText, HardHat, ShieldAlert, CheckCircle } from 'lucide-react';
import { supabase } from './supabaseClient';
import { logAction } from './auditLog';

const ACTIONS = [
  { id: 'incident', icon: HeartPulse, label: 'Déclarer un incident', color: '#EF4444' },
  { id: 'action',   icon: FileText,   label: 'Créer une action PDCA', color: '#4F63E7' },
  { id: 'risque',   icon: ShieldAlert, label: 'Risque rapide DUERP', color: '#F59E0B' },
  { id: 'analyse',  icon: HardHat,    label: 'Analyse risque chantier', color: '#10B981' },
];

function ModalIncident({ onClose }) {
  const [form, setForm] = useState({
    date_evenement: new Date().toISOString().split('T')[0],
    type_evenement: "Presqu'accident",
    lieu: '',
    description: '',
  });
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async () => {
    if (!form.description.trim()) return;
    setSaving(true);
    const { data } = await supabase.from('securite_accidents').insert([{
      ...form,
      cause_immediate: '', victime: '', temoin: '', jours_perdus: 0,
      statut_enquete: 'À lancer', mesures_immediates: '', actions_correctives: '',
    }]).select();
    try { await logAction('securite_accidents', data?.[0]?.id, 'CREATE', { source: 'QuickAction', type: form.type_evenement, lieu: form.lieu }); } catch { /* silencieux : non bloquant */ }
    setSaving(false);
    setDone(true);
    setTimeout(onClose, 1500);
  };

  return (
    <Modal title="⚡ Déclaration rapide" onClose={onClose}>
      {done ? (
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <CheckCircle size={40} style={{ color: '#10B981', margin: '0 auto 10px' }}/>
          <p style={{ color: '#10B981', fontWeight: 700 }}>Incident enregistré !</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={lbl}>Type d'événement</label>
            <select value={form.type_evenement} onChange={e => setForm({...form, type_evenement: e.target.value})} style={inp}>
              {["Presqu'accident","Soins (sans arrêt)","Accident avec arrêt","Incident matériel"].map(t=><option key={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label style={lbl}>Lieu</label>
            <input value={form.lieu} onChange={e=>setForm({...form,lieu:e.target.value})} placeholder="Chantier, atelier, parking..." style={inp}/>
          </div>
          <div>
            <label style={lbl}>Description *</label>
            <textarea rows={3} value={form.description} onChange={e=>setForm({...form,description:e.target.value})} placeholder="Décrivez brièvement ce qui s'est passé..." style={{...inp,resize:'none'}}/>
          </div>
          <button onClick={submit} disabled={saving||!form.description}
            style={{ padding:'11px', borderRadius:9, border:'none', background: saving||!form.description?'rgba(239,68,68,0.3)':'#EF4444', color:'#fff', fontWeight:700, cursor:'pointer', fontSize:14 }}>
            {saving ? 'Enregistrement...' : '🚨 Enregistrer la déclaration'}
          </button>
        </div>
      )}
    </Modal>
  );
}

function ModalAction({ onClose }) {
  const [form, setForm] = useState({
    action: '', pilote: '', echeance: new Date(Date.now()+30*86400000).toISOString().split('T')[0],
    origine: 'Terrain', domaine: 'Sécurité', priorite: 'Normale', statut: 'À lancer',
    type_action: 'Corrective',
  });
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async () => {
    if (!form.action.trim()) return;
    setSaving(true);
    const { data } = await supabase.from('plan_actions').insert([{
      ...form, avancement_pct: 0, cause_racine: '', commentaire: '', cout_estime: '',
    }]).select();
    try { await logAction('plan_actions', data?.[0]?.id, 'CREATE', { source: 'QuickAction', action: form.action, pilote: form.pilote }); } catch { /* silencieux : non bloquant */ }
    setSaving(false);
    setDone(true);
    setTimeout(onClose, 1500);
  };

  return (
    <Modal title="📋 Action rapide PDCA" onClose={onClose}>
      {done ? (
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <CheckCircle size={40} style={{ color: '#10B981', margin: '0 auto 10px' }}/>
          <p style={{ color: '#10B981', fontWeight: 700 }}>Action créée !</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={lbl}>Description de l'action *</label>
            <textarea rows={2} value={form.action} onChange={e=>setForm({...form,action:e.target.value})} placeholder="Quelle action à mener ?" style={{...inp,resize:'none'}}/>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
            <div>
              <label style={lbl}>Pilote</label>
              <input value={form.pilote} onChange={e=>setForm({...form,pilote:e.target.value})} placeholder="Responsable..." style={inp}/>
            </div>
            <div>
              <label style={lbl}>Échéance</label>
              <input type="date" value={form.echeance} onChange={e=>setForm({...form,echeance:e.target.value})} style={inp}/>
            </div>
            <div>
              <label style={lbl}>Domaine</label>
              <select value={form.domaine} onChange={e=>setForm({...form,domaine:e.target.value})} style={inp}>
                {['Sécurité','Qualité','Environnement','Énergie','RH/Social'].map(d=><option key={d}>{d}</option>)}
              </select>
            </div>
            <div>
              <label style={lbl}>Priorité</label>
              <select value={form.priorite} onChange={e=>setForm({...form,priorite:e.target.value})} style={inp}>
                {['Urgente','Haute','Normale','Basse'].map(p=><option key={p}>{p}</option>)}
              </select>
            </div>
          </div>
          <button onClick={submit} disabled={saving||!form.action}
            style={{ padding:'11px', borderRadius:9, border:'none', background: saving||!form.action?'rgba(79,99,231,0.3)':'#4F63E7', color:'#fff', fontWeight:700, cursor:'pointer', fontSize:14 }}>
            {saving ? 'Enregistrement...' : '✅ Créer l\'action'}
          </button>
        </div>
      )}
    </Modal>
  );
}

function ModalRisque({ onClose }) {
  const [form, setForm] = useState({ danger: '', famille_risque: 'Chutes de plain-pied', gravite: 2, probabilite: 2, unite_travail: 'Chantier / Déplacement' });
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async () => {
    if (!form.danger.trim()) return;
    setSaving(true);
    const ci = form.gravite * form.probabilite;
    const { data } = await supabase.from('registre_duerp').insert([{ ...form, criticite: ci, criticite_resid: ci, action_preventive: '', pilote: '', date_maj: new Date().toISOString().split('T')[0] }]).select();
    try { await logAction('registre_duerp', data?.[0]?.id, 'CREATE', { source: 'QuickAction', danger: form.danger, criticite: ci }); } catch { /* silencieux : non bloquant */ }
    setSaving(false);
    setDone(true);
    setTimeout(onClose, 1500);
  };

  return (
    <Modal title="⚠️ Risque DUERP rapide" onClose={onClose}>
      {done ? (
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <CheckCircle size={40} style={{ color: '#10B981', margin: '0 auto 10px' }}/>
          <p style={{ color: '#10B981', fontWeight: 700 }}>Risque enregistré !</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={lbl}>Danger identifié *</label>
            <input value={form.danger} onChange={e=>setForm({...form,danger:e.target.value})} placeholder="Ex: Sol glissant, câble exposé..." style={inp}/>
          </div>
          <div>
            <label style={lbl}>Famille de risque</label>
            <select value={form.famille_risque} onChange={e=>setForm({...form,famille_risque:e.target.value})} style={inp}>
              {['Chutes de plain-pied','Chutes de hauteur','Manutention manuelle','Risques mécaniques','Risques électriques','Risques chimiques','Incendie / Explosion','Circulation'].map(f=><option key={f}>{f}</option>)}
            </select>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
            <div>
              <label style={lbl}>Gravité (1-4)</label>
              <div style={{ display:'flex', gap:5 }}>
                {[1,2,3,4].map(v=>{
                  const c=v>=4?'#EF4444':v>=3?'#F97316':v>=2?'#F59E0B':'#10B981';
                  return <button key={v} onClick={()=>setForm({...form,gravite:v})}
                    style={{ flex:1, height:38, borderRadius:7, border:`2px solid ${form.gravite===v?c:'rgba(255,255,255,0.1)'}`, background:form.gravite===v?c+'20':'transparent', color:form.gravite===v?c:'#64748B', fontWeight:800, cursor:'pointer' }}>{v}</button>;
                })}
              </div>
            </div>
            <div>
              <label style={lbl}>Fréquence (1-4)</label>
              <div style={{ display:'flex', gap:5 }}>
                {[1,2,3,4].map(v=>{
                  const c=v>=4?'#EF4444':v>=3?'#F97316':v>=2?'#F59E0B':'#10B981';
                  return <button key={v} onClick={()=>setForm({...form,probabilite:v})}
                    style={{ flex:1, height:38, borderRadius:7, border:`2px solid ${form.probabilite===v?c:'rgba(255,255,255,0.1)'}`, background:form.probabilite===v?c+'20':'transparent', color:form.probabilite===v?c:'#64748B', fontWeight:800, cursor:'pointer' }}>{v}</button>;
                })}
              </div>
            </div>
          </div>
          <div style={{ background:'rgba(79,99,231,0.1)', borderRadius:8, padding:'8px 12px', fontSize:13, color:'#94A3B8', textAlign:'center' }}>
            Criticité : <strong style={{ fontSize:18, color: form.gravite*form.probabilite>=9?'#EF4444':form.gravite*form.probabilite>=5?'#F59E0B':'#10B981' }}>{form.gravite*form.probabilite}</strong>/16
          </div>
          <button onClick={submit} disabled={saving||!form.danger}
            style={{ padding:'11px', borderRadius:9, border:'none', background: saving||!form.danger?'rgba(245,158,11,0.3)':'#F59E0B', color:'#000', fontWeight:700, cursor:'pointer', fontSize:14 }}>
            {saving ? 'Enregistrement...' : '⚠️ Enregistrer le risque'}
          </button>
        </div>
      )}
    </Modal>
  );
}

/* ─── Modal wrapper ─────────────────────────────────────────────────────── */
function Modal({ title, onClose, children }) {
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', zIndex:9998, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}
         onClick={onClose}>
      <div style={{ background:'#0f1929', border:'1px solid rgba(255,255,255,0.1)', borderRadius:16, width:'100%', maxWidth:440, padding:'22px 22px', boxShadow:'0 24px 60px rgba(0,0,0,0.5)' }}
           onClick={e=>e.stopPropagation()}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:18 }}>
          <h3 style={{ fontWeight:800, fontSize:16, color:'#fff', margin:0 }}>{title}</h3>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color:'#64748B', padding:4 }}><X size={18}/></button>
        </div>
        {children}
      </div>
    </div>
  );
}

const lbl = { fontSize:11, fontWeight:700, color:'#94A3B8', textTransform:'uppercase', letterSpacing:'0.06em', display:'block', marginBottom:5 };
const inp = { width:'100%', padding:'9px 12px', borderRadius:8, background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', color:'#fff', fontSize:13, outline:'none', boxSizing:'border-box', fontFamily:'inherit' };

/* ─── Main floating button ──────────────────────────────────────────────── */
export default function QuickActions({ onNavigate }) {
  const [open, setOpen]   = useState(false);
  const [modal, setModal] = useState(null);

  const handleAction = (id) => {
    setOpen(false);
    if (id === 'analyse') { onNavigate?.('analyse'); return; }
    setModal(id);
  };

  return (
    <>
      {/* Floating button */}
      <div style={{ position:'fixed', bottom:'max(24px, calc(env(safe-area-inset-bottom) + 24px))', right:20, zIndex:9990, display:'flex', flexDirection:'column', alignItems:'flex-end', gap:10 }}>
        {/* Sub-actions */}
        {open && ACTIONS.map((a, i) => {
          const Icon = a.icon;
          return (
            <button key={a.id} onClick={() => handleAction(a.id)}
              style={{
                display:'flex', alignItems:'center', gap:10,
                background:'#0f1929', border:'1px solid rgba(255,255,255,0.12)',
                borderRadius:100, padding:'9px 16px 9px 12px',
                color:'#fff', cursor:'pointer', fontSize:13, fontWeight:600,
                boxShadow:'0 4px 20px rgba(0,0,0,0.4)',
                animation:`slideUp 0.2s ease ${i * 0.04}s both`,
                whiteSpace:'nowrap',
              }}>
              <span style={{ width:28, height:28, borderRadius:'50%', background:a.color+'20', border:`1px solid ${a.color}40`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                <Icon size={14} style={{ color:a.color }}/>
              </span>
              {a.label}
            </button>
          );
        })}

        {/* Main + button */}
        <button onClick={() => setOpen(v => !v)}
          style={{
            width:52, height:52, borderRadius:'50%', border:'none',
            background: open ? '#1e293b' : 'linear-gradient(135deg,#4F63E7,#3B4FD4)',
            color:'#fff', cursor:'pointer', fontSize:22, fontWeight:300,
            display:'flex', alignItems:'center', justifyContent:'center',
            boxShadow: open ? '0 4px 16px rgba(0,0,0,0.3)' : '0 4px 24px rgba(79,99,231,0.5)',
            transition:'all 0.25s', transform: open ? 'rotate(45deg)' : 'none',
            flexShrink:0,
          }}>
          <Plus size={22}/>
        </button>
      </div>

      {/* Backdrop */}
      {open && <div style={{ position:'fixed', inset:0, zIndex:9989 }} onClick={() => setOpen(false)}/>}

      {/* Modals */}
      {modal === 'incident' && <ModalIncident onClose={() => setModal(null)}/>}
      {modal === 'action'   && <ModalAction   onClose={() => setModal(null)}/>}
      {modal === 'risque'   && <ModalRisque   onClose={() => setModal(null)}/>}

      <style>{`
        @keyframes slideUp {
          from { opacity:0; transform:translateY(10px) scale(0.95); }
          to   { opacity:1; transform:translateY(0) scale(1); }
        }
      `}</style>
    </>
  );
}
