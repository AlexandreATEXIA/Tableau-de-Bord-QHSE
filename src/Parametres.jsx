import React, { useState } from 'react';
import { useTheme } from './ThemeContext';
import { useParametres, PARAMS_DEFAULT } from './ParametresContext';
import { useToast } from './ToastContext';
import { useUser } from './UserContext';
import { Settings, Save, RotateCcw, Users, Bell, Factory, AlertTriangle, TrendingDown, User, Palette } from 'lucide-react';

function Section({ icon, title, children, p }) {
  return (
    <div className="glass-panel p-6">
      <h3 className="font-bold mb-5 flex items-center gap-2" style={{ color: p.text1, fontSize: 14 }}>
        <span style={{ color: p.blue }}>{icon}</span>
        {title}
      </h3>
      <div className="space-y-4">
        {children}
      </div>
    </div>
  );
}

function Field({ label, help, children }) {
  return (
    <div>
      <label style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', display: 'block', marginBottom: 4 }}
        className="text-slate-400">{label}</label>
      {children}
      {help && <p style={{ fontSize: 11, marginTop: 4 }} className="text-slate-500">{help}</p>}
    </div>
  );
}

export default function Parametres() {
  const { p, theme, setTheme } = useTheme();
  const { params, saveParams } = useParametres();
  const toast = useToast();
  const { displayName, updateDisplayName } = useUser();
  const [draft, setDraft] = useState({ ...params });
  const [dirty, setDirty] = useState(false);
  const [draftName, setDraftName] = useState(displayName);
  const [nameDirty, setNameDirty] = useState(false);

  const set = (key, value) => {
    setDraft(d => ({ ...d, [key]: value }));
    setDirty(true);
  };

  const handleSave = () => {
    // Validation
    if (draft.effectif < 1 || draft.effectif > 100000) {
      toast.error('Effectif invalide (entre 1 et 100 000)');
      return;
    }
    if (draft.heuresAnnuelles < 1 || draft.heuresAnnuelles > 3000) {
      toast.error('Heures annuelles invalides (entre 1 et 3 000)');
      return;
    }
    if (draft.seuilAlertRouge < 1 || draft.seuilAlertRouge >= draft.seuilAlertOrange) {
      toast.error('Le seuil rouge doit être inférieur au seuil orange');
      return;
    }
    saveParams(draft);
    setDirty(false);
    toast.success('Paramètres enregistrés');
  };

  const handleReset = () => {
    setDraft({ ...PARAMS_DEFAULT });
    setDirty(true);
    toast.info('Valeurs par défaut restaurées — cliquez sur Enregistrer pour confirmer');
  };

  const handleSaveName = () => {
    const trimmed = draftName.trim();
    if (!trimmed) { toast.error('Le nom affiché ne peut pas être vide'); return; }
    updateDisplayName(trimmed);
    setNameDirty(false);
    toast.success('Nom affiché mis à jour');
  };

  const inputStyle = {
    width: '100%', boxSizing: 'border-box',
    padding: '9px 12px',
    background: p.bgInput, border: '1.5px solid ' + p.border2,
    borderRadius: 8, color: p.text1, fontSize: 13,
    outline: 'none', fontFamily: 'inherit',
    transition: 'border-color 0.15s',
  };

  const numInput = (key, min, max, step = 1) => (
    <input
      type="number" min={min} max={max} step={step}
      value={draft[key]}
      onChange={e => set(key, Number(e.target.value))}
      style={inputStyle}
      onFocus={e => e.target.style.borderColor = p.blue}
      onBlur={e => e.target.style.borderColor = p.border2}
    />
  );

  const _textInput = (key, placeholder) => (
    <input
      type="text"
      value={draft[key] || ''}
      placeholder={placeholder}
      onChange={e => set(key, e.target.value)}
      style={inputStyle}
      onFocus={e => e.target.style.borderColor = p.blue}
      onBlur={e => e.target.style.borderColor = p.border2}
    />
  );

  const selectInput = (key, options) => (
    <select
      value={draft[key] || ''}
      onChange={e => set(key, e.target.value)}
      style={{ ...inputStyle, cursor: 'pointer' }}
    >
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );

  // Calcul TF/TG estimé
  const heuresTotal = draft.effectif * draft.heuresAnnuelles;
  const TF_exemple  = ((1 * 1_000_000) / heuresTotal).toFixed(2);
  const TG_exemple  = ((5 * 1_000) / heuresTotal).toFixed(2);
  const coutEstime  = draft.effectif * 0.1 * draft.coutJournalierAT; // 10% absentéisme estimé

  return (
    <div className="space-y-5 pb-10">

      <header className="page-header">
        <div>
          <h2 className="page-title flex items-center gap-3">
            <Settings size={26} className="text-blue-400"/> Paramètres de l'application
          </h2>
          <p className="page-subtitle">Configuration globale utilisée par tous les modules</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleReset}
            style={{ display:'flex', alignItems:'center', gap:7, padding:'9px 16px', background:p.whiteFaint, border:'1px solid '+p.border2, borderRadius:9, color:p.text2, fontSize:13, fontWeight:600, cursor:'pointer' }}
          >
            <RotateCcw size={14}/> Réinitialiser
          </button>
          <button
            onClick={handleSave}
            disabled={!dirty}
            style={{ display:'flex', alignItems:'center', gap:7, padding:'9px 18px', background: dirty ? p.blue : p.whiteFaint, color: dirty ? 'white' : p.text4, border:'none', borderRadius:9, fontSize:13, fontWeight:700, cursor: dirty ? 'pointer' : 'default', transition:'all 0.2s' }}
          >
            <Save size={14}/> {dirty ? 'Enregistrer' : 'Enregistré ✓'}
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* Section 1 — Calculs TF/TG */}
        <Section icon={<Users size={15}/>} title="Indicateurs de performance (TF / TG)" p={p}>
          <Field label="Effectif total (ETP)" help="Nombre d'employés pris en compte pour le calcul du Taux de Fréquence et du Taux de Gravité">
            {numInput('effectif', 1, 100000)}
          </Field>
          <Field label="Heures annuelles par ETP" help="Heures de travail annuelles par employé à temps plein (légal France : 1 607 h)">
            {numInput('heuresAnnuelles', 100, 3000)}
          </Field>

          {/* Aperçu calcul */}
          <div style={{ background: p.whiteFaint2, border: '1px solid ' + p.border, borderRadius: 10, padding: '12px 14px' }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: p.text3, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
              Aperçu des formules avec ces valeurs
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <div>
                <p style={{ fontSize: 10, color: p.text4 }}>Heures totales exposées</p>
                <p style={{ fontSize: 14, fontWeight: 800, color: p.text1 }}>{heuresTotal.toLocaleString('fr-FR')} h</p>
              </div>
              <div>
                <p style={{ fontSize: 10, color: p.text4 }}>TF si 1 AT avec arrêt</p>
                <p style={{ fontSize: 14, fontWeight: 800, color: '#F59E0B' }}>{TF_exemple}</p>
              </div>
              <div>
                <p style={{ fontSize: 10, color: p.text4 }}>TG si 5 jours perdus</p>
                <p style={{ fontSize: 14, fontWeight: 800, color: '#EF4444' }}>{TG_exemple}</p>
              </div>
              <div>
                <p style={{ fontSize: 10, color: p.text4 }}>Formule TF</p>
                <p style={{ fontSize: 11, color: p.text3, fontStyle: 'italic' }}>AT × 1 000 000 / h</p>
              </div>
            </div>
          </div>
        </Section>

        {/* Section 2 — Alertes habilitations */}
        <Section icon={<Bell size={15}/>} title="Seuils d'alerte — Habilitations" p={p}>
          <Field label="Seuil alerte rouge (jours avant expiry)" help="Les habilitations expirant dans ce délai s'affichent en rouge urgent">
            {numInput('seuilAlertRouge', 1, 365)}
          </Field>
          <Field label="Seuil alerte orange (jours avant expiry)" help="Les habilitations expirant dans ce délai s'affichent en orange. Doit être supérieur au seuil rouge.">
            {numInput('seuilAlertOrange', 1, 365)}
          </Field>

          {/* Aperçu seuils */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
            {[
              { label: 'Expirée', color: '#EF4444', bg: 'rgba(239,68,68,0.08)', desc: 'Date dépassée' },
              { label: `< ${draft.seuilAlertRouge} jours`, color: '#EF4444', bg: 'rgba(239,68,68,0.08)', desc: 'Renouvellement urgent' },
              { label: `< ${draft.seuilAlertOrange} jours`, color: '#F59E0B', bg: 'rgba(245,158,11,0.08)', desc: 'À planifier' },
              { label: 'Valide', color: '#10B981', bg: 'rgba(16,185,129,0.08)', desc: 'Aucune action requise' },
            ].map((s, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 12px', background: s.bg, border: `1px solid ${s.color}30`, borderRadius: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: s.color, minWidth: 90 }}>{s.label}</span>
                <span style={{ fontSize: 11, color: p.text3 }}>{s.desc}</span>
              </div>
            ))}
          </div>
        </Section>

        {/* Section 3 — Coûts */}
        <Section icon={<TrendingDown size={15}/>} title="Coût des accidents" p={p}>
          <Field label="Coût journalier d'un AT (€)" help="Coût moyen d'une journée de travail perdue (charges sociales comprises). Utilisé pour estimer l'impact financier des accidents.">
            {numInput('coutJournalierAT', 1, 10000)}
          </Field>
          <Field label="Devise">
            {selectInput('devise', [
              { value: '€', label: 'Euro (€)' },
              { value: 'F CFP', label: 'Franc CFP (F CFP)' },
              { value: '$', label: 'Dollar ($)' },
              { value: '£', label: 'Livre (£)' },
            ])}
          </Field>

          <div style={{ background: p.whiteFaint2, border: '1px solid ' + p.border, borderRadius: 10, padding: '12px 14px' }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: p.text3, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
              Estimation (si 10% d'absentéisme AT)
            </p>
            <p style={{ fontSize: 22, fontWeight: 900, color: '#EF4444' }}>
              {coutEstime.toLocaleString('fr-FR')} {draft.devise}
            </p>
            <p style={{ fontSize: 11, color: p.text4, marginTop: 3 }}>
              Coût annuel estimé pour {draft.effectif} ETP
            </p>
          </div>
        </Section>

        {/* Section 4 — Entreprise */}
        <Section icon={<Factory size={15}/>} title="Informations entreprise" p={p}>
          <Field label="Secteur d'activité" help="Utilisé dans les rapports et la revue de direction">
            {selectInput('secteur', [
              { value: 'Industrie',               label: 'Industrie' },
              { value: 'BTP',                     label: 'BTP / Construction' },
              { value: 'Tertiaire',               label: 'Tertiaire / Services' },
              { value: 'Commerce',                label: 'Commerce / Distribution' },
              { value: 'Transport / Logistique',  label: 'Transport / Logistique' },
              { value: 'Santé / Médico-social',   label: 'Santé / Médico-social' },
              { value: 'Agroalimentaire',         label: 'Agroalimentaire' },
              { value: 'Énergie',                 label: 'Énergie / Utilities' },
              { value: 'Administration publique', label: 'Administration publique' },
              { value: 'Autre',                   label: 'Autre' },
            ])}
          </Field>
          <Field label="Année de référence par défaut" help="Année affichée au démarrage de l'application (filtre global à venir)">
            {numInput('annee', 2020, 2035)}
          </Field>

          {/* Résumé config actuelle */}
          <div style={{ background: p.whiteFaint2, border: '1px solid ' + p.border, borderRadius: 10, padding: '12px 14px' }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: p.text3, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
              Configuration active
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {[
                ['Effectif',           `${params.effectif} ETP`],
                ['Heures annuelles',   `${params.heuresAnnuelles} h/ETP`],
                ['Alerte rouge',       `< ${params.seuilAlertRouge} jours`],
                ['Alerte orange',      `< ${params.seuilAlertOrange} jours`],
                ['Coût journalier AT', `${params.coutJournalierAT} ${params.devise}`],
                ['Secteur',            params.secteur],
                ['Année référence',    params.annee],
              ].map(([k, v]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 11, color: p.text4 }}>{k}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: p.text2 }}>{v}</span>
                </div>
              ))}
            </div>
          </div>
        </Section>

        {/* Section 5 — Apparence & Profil */}
        <Section icon={<Palette size={15}/>} title="Apparence & Profil" p={p}>

          <Field label="Nom affiché" help="Apparaît dans la barre de navigation et la sidebar">
            <div style={{ display:'flex', gap:8 }}>
              <input
                type="text"
                value={draftName}
                placeholder="Votre prénom ou nom"
                onChange={e => { setDraftName(e.target.value); setNameDirty(true); }}
                style={{ ...inputStyle, flex:1 }}
                onFocus={e => e.target.style.borderColor = p.blue}
                onBlur={e => e.target.style.borderColor = p.border2}
              />
              <button
                onClick={handleSaveName}
                disabled={!nameDirty}
                style={{ padding:'9px 16px', background: nameDirty ? p.blue : p.whiteFaint, color: nameDirty ? 'white' : p.text4, border:'none', borderRadius:8, fontSize:13, fontWeight:700, cursor: nameDirty ? 'pointer' : 'default', transition:'all 0.2s', flexShrink:0 }}
              >
                <User size={13} style={{ display:'inline', marginRight:5, verticalAlign:'middle' }}/>OK
              </button>
            </div>
          </Field>

          <Field label="Thème de l'interface" help="Choisissez entre le mode sombre et le mode clair">
            <div style={{ display:'flex', gap:8 }}>
              {[{ val:'dark', label:'🌙 Sombre', desc:'Fond très sombre' }, { val:'light', label:'☀️ Clair', desc:'Fond blanc / gris clair' }].map(({ val, label, desc }) => (
                <button
                  key={val}
                  onClick={() => setTheme(val)}
                  style={{
                    flex:1, padding:'12px 8px', borderRadius:10,
                    border:`2px solid ${theme === val ? p.blue : p.border2}`,
                    background: theme === val ? (val === 'dark' ? 'rgba(59,130,246,0.1)' : 'rgba(79,99,231,0.08)') : p.whiteFaint,
                    color: theme === val ? p.blue : p.text3,
                    fontWeight: theme === val ? 700 : 500, fontSize:13, cursor:'pointer',
                    transition:'all 0.2s', textAlign:'center',
                  }}
                >
                  <div>{label}</div>
                  <div style={{ fontSize:10, marginTop:3, opacity:0.7 }}>{desc}</div>
                </button>
              ))}
            </div>
          </Field>

        </Section>

      </div>

      {/* Bandeau avertissement si modifié non sauvegardé */}
      {dirty && (
        <div style={{ position: 'sticky', bottom: 16, background: '#F59E0B', borderRadius: 10, padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 10, boxShadow: '0 8px 24px rgba(245,158,11,0.3)', zIndex: 100 }}>
          <AlertTriangle size={16} color="white"/>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'white', flex: 1 }}>
            Modifications non enregistrées — cliquez sur "Enregistrer" pour les appliquer à tous les modules
          </span>
          <button onClick={handleSave} style={{ background: 'white', color: '#D97706', border: 'none', borderRadius: 7, padding: '6px 16px', fontWeight: 800, fontSize: 13, cursor: 'pointer' }}>
            Enregistrer
          </button>
        </div>
      )}

    </div>
  );
}
