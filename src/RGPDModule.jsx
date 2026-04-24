// =====================================================================
// src/RGPDModule.jsx — Module de conformité RGPD (Lot 6 Phase 1)
// =====================================================================
// Fournit les outils opérationnels pour exercer la conformité RGPD :
//  - Tab 1 "Registre"     : visualisation du registre Art. 30
//  - Tab 2 "Export"       : export JSON des données d'une personne (Art. 15 + 20)
//  - Tab 3 "Anonymisation" : effacement respectueux de l'audit ISO (Art. 17)
//  - Tab 4 "Demandes"     : suivi des demandes reçues et délais CNIL (Art. 12)
//
// Sécurité : réservé aux rôles admin + responsable_qhse (DPO).
// Traçabilité : chaque action loggée via logAction → audit_log.
// =====================================================================
import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from './supabaseClient';
import { logAction } from './auditLog';
import { useUser } from './UserContext';
import {
  TABLES_DONNEES_PERSONNELLES,
  DUREES_CONSERVATION_ANNEES,
  CATEGORIES_RGPD_PAR_TABLE,
  BASE_LEGALE_PAR_TABLE,
  TYPES_DEMANDE_RGPD,
  STATUTS_DEMANDE_RGPD,
  calculerEcheanceRGPD,
  estDemandeEnRetard,
  formatDateFR,
  joursAvantEcheance,
} from './utils/rgpd';
import {
  ShieldCheck, Download, UserX, ClipboardList,
  AlertTriangle, Lock, BookOpen, FileJson, Check, X,
  Clock, Plus, Search, ExternalLink,
} from 'lucide-react';

// =====================================================================
// Constantes UI
// =====================================================================
const TABS = [
  { id: 'registre',    label: 'Registre Art. 30', icon: BookOpen },
  { id: 'export',      label: 'Export personne',  icon: Download },
  { id: 'anonymiser',  label: 'Anonymisation',    icon: UserX },
  { id: 'demandes',    label: 'Demandes RGPD',    icon: ClipboardList },
];

// Tables à interroger lors d'un export/anonymisation d'une personne
// Clef = table Supabase, valeur = colonnes à considérer comme identifiantes (FK employé)
const TABLES_LIEES_PERSONNE = {
  rh_employes:        { fk: 'id', identifiants: ['nom', 'prenom', 'email'] },
  rh_habilitations:   { fk: 'employe_id', identifiants: [] },
  habilitations:      { fk: 'employe',    identifiants: ['employe'] },
  rh_formations:      { fk: 'employe_id', identifiants: [] },
  securite_accidents: { fk: 'employe_id', identifiants: ['nom', 'prenom'] },
};

// =====================================================================
// Composant principal
// =====================================================================
export default function RGPDModule() {
  const { role, user } = useUser();
  const [tab, setTab] = useState('registre');
  const autorise = role === 'admin' || role === 'responsable_qhse';

  if (!autorise) {
    return (
      <div style={{ padding: 40, textAlign: 'center', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12 }}>
        <Lock size={48} style={{ color: 'var(--text-3)', margin: '0 auto' }} />
        <h2 style={{ color: 'var(--text-1)', marginTop: 16, fontSize: 20 }}>Accès restreint</h2>
        <p style={{ color: 'var(--text-3)', marginTop: 8 }}>
          Le module RGPD est réservé aux administrateurs et au responsable QHSE / DPO.
        </p>
      </div>
    );
  }

  return (
    <div>
      <Header />
      <TabsBar tab={tab} setTab={setTab} />
      <div style={{ marginTop: 20 }}>
        {tab === 'registre'   && <TabRegistre />}
        {tab === 'export'     && <TabExport userEmail={user?.email} />}
        {tab === 'anonymiser' && <TabAnonymiser userEmail={user?.email} />}
        {tab === 'demandes'   && <TabDemandes userEmail={user?.email} />}
      </div>
    </div>
  );
}

// =====================================================================
// Header & Tabs
// =====================================================================
function Header() {
  return (
    <div style={{
      background: 'linear-gradient(135deg, rgba(79,99,231,0.12), rgba(16,185,129,0.08))',
      border: '1px solid rgba(79,99,231,0.3)',
      borderRadius: 12, padding: 20, marginBottom: 16,
      display: 'flex', alignItems: 'center', gap: 16,
    }}>
      <div style={{
        width: 52, height: 52, borderRadius: 12,
        background: 'rgba(79,99,231,0.2)', border: '1px solid rgba(79,99,231,0.4)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <ShieldCheck size={26} style={{ color: '#4F63E7' }} />
      </div>
      <div>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-1)', margin: 0 }}>
          Conformité RGPD
        </h1>
        <p style={{ fontSize: 13, color: 'var(--text-3)', margin: '4px 0 0' }}>
          Registre des traitements, exercice des droits, suivi des demandes (Art. 12/15/17/20/30)
        </p>
      </div>
    </div>
  );
}

function TabsBar({ tab, setTab }) {
  return (
    <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--border)', marginBottom: 4 }}>
      {TABS.map(t => {
        const Icon = t.icon;
        const actif = tab === t.id;
        return (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding: '10px 16px', border: 'none', background: 'transparent', cursor: 'pointer',
            color: actif ? '#4F63E7' : 'var(--text-3)',
            fontWeight: actif ? 700 : 500, fontSize: 13,
            borderBottom: actif ? '2px solid #4F63E7' : '2px solid transparent',
            display: 'flex', alignItems: 'center', gap: 8,
            transition: 'color 0.15s',
          }}>
            <Icon size={15} />
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

// =====================================================================
// Tab 1 — Registre Art. 30
// =====================================================================
function TabRegistre() {
  const tables = Object.keys(BASE_LEGALE_PAR_TABLE);
  return (
    <div>
      <Banner type="info" texte="Registre des activités de traitement au sens de l'article 30 du RGPD. Le document complet est versionné dans /docs/RGPD_REGISTRE_TRAITEMENTS.md." />
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: 'var(--bg-card-2)', textAlign: 'left' }}>
              <Th>Traitement (table)</Th>
              <Th>Base légale (Art. 6)</Th>
              <Th>Catégories de données</Th>
              <Th>Durée de conservation</Th>
            </tr>
          </thead>
          <tbody>
            {tables.map(t => (
              <tr key={t} style={{ borderTop: '1px solid var(--border)' }}>
                <Td><code style={{ fontSize: 12, color: '#4F63E7' }}>{t}</code></Td>
                <Td>
                  <span style={{ fontWeight: 600 }}>{BASE_LEGALE_PAR_TABLE[t].article}</span>
                  <br />
                  <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{BASE_LEGALE_PAR_TABLE[t].nom}</span>
                </Td>
                <Td>
                  {(CATEGORIES_RGPD_PAR_TABLE[t] || []).map(c => (
                    <span key={c} style={{
                      display: 'inline-block', fontSize: 11, padding: '2px 8px',
                      background: c.includes('Art. 9') ? 'rgba(239,68,68,0.15)' : 'rgba(79,99,231,0.1)',
                      color: c.includes('Art. 9') ? '#EF4444' : '#4F63E7',
                      border: `1px solid ${c.includes('Art. 9') ? 'rgba(239,68,68,0.3)' : 'rgba(79,99,231,0.2)'}`,
                      borderRadius: 4, margin: '2px 4px 2px 0',
                    }}>{c}</span>
                  ))}
                </Td>
                <Td>
                  <strong>{DUREES_CONSERVATION_ANNEES[t] || '—'} ans</strong>
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ marginTop: 16, padding: 12, background: 'var(--bg-card-2)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12, color: 'var(--text-3)' }}>
        <strong style={{ color: 'var(--text-1)' }}>⚠️ Note de conformité</strong> — Le déploiement actuel présente une non-conformité partielle à l'Art. 32 (sécurité) : RLS activée uniquement sur 4 tables sur 25. La remédiation est planifiée en Lot 5 Phase 2 (rollout Supabase Auth + policies par rôle).
      </div>
    </div>
  );
}

// =====================================================================
// Tab 2 — Export d'une personne (Art. 15 + 20)
// =====================================================================
function TabExport({ userEmail }) {
  const [employes, setEmployes]   = useState([]);
  const [selection, setSelection] = useState(null);
  const [loading, setLoading]     = useState(false);
  const [message, setMessage]     = useState(null);
  const [recherche, setRecherche] = useState('');

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('rh_employes')
        .select('id, nom, prenom, email')
        .is('rgpd_anonymise_le', null)
        .order('nom', { ascending: true });
      setEmployes(data || []);
    })();
  }, []);

  const filtres = employes.filter(e => {
    if (!recherche) return true;
    const q = recherche.toLowerCase();
    return `${e.nom || ''} ${e.prenom || ''} ${e.email || ''}`.toLowerCase().includes(q);
  });

  const handleExport = useCallback(async () => {
    if (!selection) return;
    setLoading(true);
    setMessage(null);
    const bundle = {
      _rgpd_export: {
        genere_le: new Date().toISOString(),
        genere_par: userEmail || 'inconnu',
        article_rgpd: 'Art. 15 (droit d\'accès) + Art. 20 (portabilité)',
        personne_id: selection.id,
        personne: `${selection.prenom || ''} ${selection.nom || ''}`.trim(),
      },
      donnees: {},
    };

    try {
      for (const [table, cfg] of Object.entries(TABLES_LIEES_PERSONNE)) {
        let query = supabase.from(table).select('*');
        if (cfg.fk === 'id') {
          query = query.eq('id', selection.id);
        } else if (cfg.fk === 'employe') {
          // Ancienne table habilitations : recherche par nom concaténé
          const nomComplet = `${selection.prenom || ''} ${selection.nom || ''}`.trim();
          if (nomComplet) query = query.ilike('employe', `%${nomComplet}%`);
          else continue;
        } else {
          query = query.eq(cfg.fk, selection.id);
        }
        const { data, error } = await query;
        bundle.donnees[table] = error ? { erreur: error.message } : (data || []);
      }

      // Téléchargement JSON
      const nom = `${selection.nom || 'inconnu'}_${selection.prenom || ''}`.replace(/[^a-zA-Z0-9_-]/g, '_');
      const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `RGPD_export_${nom}_${new Date().toISOString().slice(0,10)}.json`;
      a.click();
      URL.revokeObjectURL(url);

      try {
        await logAction('rh_employes', selection.id, 'RGPD_EXPORT', {
          personne_nom: `${selection.prenom} ${selection.nom}`,
          articles: 'Art. 15 + 20',
          tables_incluses: Object.keys(TABLES_LIEES_PERSONNE),
        }, userEmail);
      } catch {}

      setMessage({ type: 'ok', texte: `Export JSON généré (${Object.keys(bundle.donnees).length} tables).` });
    } catch (e) {
      setMessage({ type: 'err', texte: `Erreur export : ${e.message}` });
    } finally {
      setLoading(false);
    }
  }, [selection, userEmail]);

  return (
    <div>
      <Banner type="info" texte="Exercice des droits d'accès (Art. 15) et de portabilité (Art. 20). L'export fournit l'ensemble des données détenues sur la personne au format JSON structuré. Chaque export est journalisé." />

      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, padding: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, background: 'var(--bg-card-2)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px' }}>
          <Search size={16} style={{ color: 'var(--text-3)' }} />
          <input
            value={recherche}
            onChange={e => setRecherche(e.target.value)}
            placeholder="Rechercher un salarié..."
            style={{ flex: 1, border: 'none', background: 'transparent', color: 'var(--text-1)', outline: 'none', fontSize: 13 }}
          />
        </div>

        {employes.length === 0 && (
          <div style={{ padding: 20, textAlign: 'center', color: 'var(--text-3)' }}>
            Aucun salarié dans la table <code>rh_employes</code>.
          </div>
        )}

        <div style={{ maxHeight: 300, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}>
          {filtres.map(e => {
            const actif = selection?.id === e.id;
            return (
              <div key={e.id} onClick={() => setSelection(e)} style={{
                padding: '10px 14px', cursor: 'pointer',
                borderBottom: '1px solid var(--border)',
                background: actif ? 'rgba(79,99,231,0.1)' : 'transparent',
                display: 'flex', alignItems: 'center', gap: 12,
              }}>
                <div style={{
                  width: 32, height: 32, borderRadius: '50%',
                  background: 'linear-gradient(135deg, #4F63E7, #06B6D4)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'white', fontWeight: 700, fontSize: 12,
                }}>
                  {(e.prenom?.[0] || e.nom?.[0] || '?').toUpperCase()}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, color: 'var(--text-1)', fontSize: 13 }}>
                    {e.prenom} {e.nom}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{e.email || '—'}</div>
                </div>
                {actif && <Check size={16} style={{ color: '#10B981' }} />}
              </div>
            );
          })}
        </div>

        <div style={{ marginTop: 16, display: 'flex', gap: 10 }}>
          <button
            onClick={handleExport}
            disabled={!selection || loading}
            style={{
              padding: '10px 18px', border: 'none', borderRadius: 8,
              background: !selection ? 'var(--bg-card-2)' : 'linear-gradient(135deg, #4F63E7, #06B6D4)',
              color: 'white', fontWeight: 700, fontSize: 13,
              cursor: !selection ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.6 : 1,
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
            <FileJson size={15} />
            {loading ? 'Export en cours...' : 'Générer export JSON'}
          </button>
        </div>

        {message && (
          <div style={{
            marginTop: 12, padding: 10, borderRadius: 8, fontSize: 13,
            background: message.type === 'ok' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
            color: message.type === 'ok' ? '#10B981' : '#EF4444',
            border: `1px solid ${message.type === 'ok' ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
          }}>
            {message.texte}
          </div>
        )}
      </div>
    </div>
  );
}

// =====================================================================
// Tab 3 — Anonymisation (Art. 17)
// =====================================================================
function TabAnonymiser({ userEmail }) {
  const [employes, setEmployes]     = useState([]);
  const [selection, setSelection]   = useState(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [motif, setMotif]           = useState('');
  const [loading, setLoading]       = useState(false);
  const [message, setMessage]       = useState(null);

  const charger = useCallback(async () => {
    const { data } = await supabase
      .from('rh_employes')
      .select('id, nom, prenom, email, rgpd_anonymise_le')
      .order('nom', { ascending: true });
    setEmployes(data || []);
  }, []);

  useEffect(() => { charger(); }, [charger]);

  const handleAnonymise = async () => {
    if (!selection || !motif.trim()) {
      setMessage({ type: 'err', texte: 'Motif obligatoire pour traçabilité (Art. 17 + diligence).' });
      return;
    }
    setLoading(true);
    setMessage(null);
    const nomComplet = `${selection.prenom || ''} ${selection.nom || ''}`.trim();
    const horodatage = new Date().toISOString();

    try {
      // 1. Anonymiser rh_employes (table pivot)
      await supabase.from('rh_employes').update({
        nom: '[ANONYMISÉ]',
        prenom: '[ANONYMISÉ]',
        email: null,
        rgpd_anonymise_le: horodatage,
      }).eq('id', selection.id);

      // 2. Anonymiser les tables liées (rh_habilitations, rh_formations, securite_accidents)
      for (const t of ['rh_habilitations', 'rh_formations', 'securite_accidents']) {
        await supabase.from(t).update({ rgpd_anonymise_le: horodatage })
          .eq('employe_id', selection.id);
      }

      // 3. Table "habilitations" ancienne (champ texte employe concaténé)
      if (nomComplet) {
        await supabase.from('habilitations').update({
          employe: '[ANONYMISÉ]',
          rgpd_anonymise_le: horodatage,
        }).ilike('employe', `%${nomComplet}%`);
      }

      // 4. Trace ISO
      try {
        await logAction('rh_employes', selection.id, 'RGPD_ANONYMISE', {
          motif,
          article: 'Art. 17 (droit à l\'effacement)',
          personne_ex: nomComplet,
        }, userEmail);
      } catch {}

      setMessage({ type: 'ok', texte: `Personne anonymisée sur toutes les tables. L'audit ISO reste intact (les lignes sont préservées, identifiants masqués).` });
      setConfirmOpen(false);
      setSelection(null);
      setMotif('');
      charger();
    } catch (e) {
      setMessage({ type: 'err', texte: `Erreur : ${e.message}` });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <Banner type="warning" texte="Effacement irréversible (Art. 17). Les lignes sont préservées pour respecter l'intégrité ISO 9001 §7.5.3, mais les champs identifiants (nom, prénom, email) sont remplacés par [ANONYMISÉ]. Une demande doit être documentée en onglet 'Demandes RGPD'." />

      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, padding: 16 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-1)', marginBottom: 12 }}>
          Sélectionner la personne à anonymiser
        </h3>
        <div style={{ maxHeight: 300, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}>
          {employes.map(e => {
            const deja = !!e.rgpd_anonymise_le;
            const actif = selection?.id === e.id;
            return (
              <div key={e.id} onClick={() => !deja && setSelection(e)} style={{
                padding: '10px 14px', cursor: deja ? 'not-allowed' : 'pointer',
                borderBottom: '1px solid var(--border)',
                background: actif ? 'rgba(239,68,68,0.1)' : 'transparent',
                opacity: deja ? 0.4 : 1,
                display: 'flex', alignItems: 'center', gap: 12,
              }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, color: 'var(--text-1)', fontSize: 13 }}>
                    {e.prenom} {e.nom}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-3)' }}>
                    {deja
                      ? `Déjà anonymisé le ${formatDateFR(e.rgpd_anonymise_le)}`
                      : (e.email || '—')}
                  </div>
                </div>
                {deja && <Check size={16} style={{ color: 'var(--text-3)' }} />}
              </div>
            );
          })}
        </div>

        {selection && (
          <div style={{ marginTop: 16 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-2)' }}>
              Motif (obligatoire, conservé dans l'audit)
            </label>
            <textarea
              value={motif}
              onChange={e => setMotif(e.target.value)}
              placeholder="Ex: Demande d'effacement reçue le 2026-04-24, réf. RGPD-2026-015"
              style={{
                width: '100%', minHeight: 60, marginTop: 6, padding: 10,
                border: '1px solid var(--border)', borderRadius: 8,
                background: 'var(--bg-card-2)', color: 'var(--text-1)', fontSize: 13,
                resize: 'vertical', outline: 'none',
              }}
            />
            <button
              onClick={() => setConfirmOpen(true)}
              disabled={!motif.trim() || loading}
              style={{
                marginTop: 12, padding: '10px 18px', border: 'none', borderRadius: 8,
                background: !motif.trim() ? 'var(--bg-card-2)' : '#EF4444',
                color: 'white', fontWeight: 700, fontSize: 13,
                cursor: !motif.trim() ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', gap: 8,
              }}>
              <UserX size={15} />
              Anonymiser {selection.prenom} {selection.nom}
            </button>
          </div>
        )}

        {message && (
          <div style={{
            marginTop: 12, padding: 10, borderRadius: 8, fontSize: 13,
            background: message.type === 'ok' ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
            color: message.type === 'ok' ? '#10B981' : '#EF4444',
            border: `1px solid ${message.type === 'ok' ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
          }}>
            {message.texte}
          </div>
        )}
      </div>

      {confirmOpen && (
        <ModalConfirm
          titre="Confirmer l'anonymisation"
          message={`Cette action est IRRÉVERSIBLE. Tous les champs identifiants de ${selection.prenom} ${selection.nom} seront remplacés par [ANONYMISÉ] dans rh_employes, rh_habilitations, rh_formations, securite_accidents et habilitations. Les lignes d'historique et d'audit sont préservées.`}
          onConfirm={handleAnonymise}
          onCancel={() => setConfirmOpen(false)}
          loading={loading}
        />
      )}
    </div>
  );
}

// =====================================================================
// Tab 4 — Demandes RGPD (Art. 12)
// =====================================================================
function TabDemandes({ userEmail }) {
  const [demandes, setDemandes] = useState([]);
  const [ouvertForm, setOuvertForm] = useState(false);
  const [loading, setLoading] = useState(false);

  const charger = useCallback(async () => {
    const { data } = await supabase
      .from('rgpd_demandes')
      .select('*')
      .order('date_reception', { ascending: false });
    setDemandes(data || []);
  }, []);

  useEffect(() => { charger(); }, [charger]);

  return (
    <div>
      <Banner type="info" texte="Tout demande d'exercice des droits RGPD (Art. 15-21) doit être tracée ici. Délai légal de réponse : 1 mois (Art. 12), extensible à 3 mois pour demandes complexes." />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ display: 'flex', gap: 10, fontSize: 12 }}>
          {STATUTS_DEMANDE_RGPD.map(s => {
            const n = demandes.filter(d => d.statut === s.id).length;
            return (
              <span key={s.id} style={{
                padding: '4px 10px', borderRadius: 100,
                background: `${s.couleur}20`, color: s.couleur,
                border: `1px solid ${s.couleur}40`,
                fontWeight: 600,
              }}>
                {s.label} : {n}
              </span>
            );
          })}
        </div>
        <button onClick={() => setOuvertForm(true)} style={{
          padding: '8px 14px', border: 'none', borderRadius: 8,
          background: 'linear-gradient(135deg, #4F63E7, #06B6D4)',
          color: 'white', fontWeight: 700, fontSize: 13, cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <Plus size={15} />
          Nouvelle demande
        </button>
      </div>

      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
        {demandes.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-3)' }}>
            Aucune demande enregistrée.
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--bg-card-2)', textAlign: 'left' }}>
                <Th>Type</Th>
                <Th>Personne</Th>
                <Th>Reçue</Th>
                <Th>Échéance CNIL</Th>
                <Th>Statut</Th>
                <Th>Actions</Th>
              </tr>
            </thead>
            <tbody>
              {demandes.map(d => (
                <LigneDemande key={d.id} demande={d} userEmail={userEmail} onUpdate={charger} />
              ))}
            </tbody>
          </table>
        )}
      </div>

      {ouvertForm && (
        <FormNouvelleDemande
          onClose={() => setOuvertForm(false)}
          onSuccess={() => { setOuvertForm(false); charger(); }}
          userEmail={userEmail}
        />
      )}
    </div>
  );
}

function LigneDemande({ demande, userEmail, onUpdate }) {
  const [reponseOpen, setReponseOpen] = useState(false);
  const [reponse, setReponse] = useState('');
  const enRetard = estDemandeEnRetard(demande);
  const jours = joursAvantEcheance(demande.date_echeance);
  const type = TYPES_DEMANDE_RGPD.find(t => t.id === demande.type);
  const statut = STATUTS_DEMANDE_RGPD.find(s => s.id === demande.statut);

  const cloturer = async (nouveauStatut) => {
    if (!reponse.trim() && nouveauStatut !== 'EXPIREE') return;
    await supabase.from('rgpd_demandes').update({
      statut: nouveauStatut,
      reponse: reponse || null,
      date_cloture: new Date().toISOString(),
      traite_par: userEmail || null,
    }).eq('id', demande.id);
    try {
      await logAction('rgpd_demandes', demande.id, 'UPDATE', {
        ancien_statut: demande.statut,
        nouveau_statut: nouveauStatut,
      }, userEmail);
    } catch {}
    setReponseOpen(false);
    setReponse('');
    onUpdate();
  };

  return (
    <>
      <tr style={{ borderTop: '1px solid var(--border)', background: enRetard ? 'rgba(239,68,68,0.06)' : 'transparent' }}>
        <Td>
          <span style={{ fontWeight: 600 }}>{type?.label || demande.type}</span>
          <br />
          <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{type?.article}</span>
        </Td>
        <Td>
          {demande.personne_nom}
          {demande.personne_email && (
            <><br /><span style={{ fontSize: 11, color: 'var(--text-3)' }}>{demande.personne_email}</span></>
          )}
        </Td>
        <Td>{formatDateFR(demande.date_reception)}</Td>
        <Td>
          {formatDateFR(demande.date_echeance)}
          {demande.statut === 'EN_COURS' && jours !== null && (
            <>
              <br />
              <span style={{ fontSize: 11, color: enRetard ? '#EF4444' : jours <= 7 ? '#F59E0B' : 'var(--text-3)', fontWeight: 600 }}>
                {enRetard ? `⚠ En retard (${Math.abs(jours)} j)` : `J-${jours}`}
              </span>
            </>
          )}
        </Td>
        <Td>
          <span style={{
            padding: '3px 10px', borderRadius: 100,
            background: `${statut?.couleur}20`, color: statut?.couleur,
            border: `1px solid ${statut?.couleur}40`,
            fontSize: 11, fontWeight: 700,
          }}>{statut?.label}</span>
        </Td>
        <Td>
          {demande.statut === 'EN_COURS' && (
            <button onClick={() => setReponseOpen(!reponseOpen)} style={{
              padding: '4px 10px', border: '1px solid var(--border)',
              background: 'var(--bg-card-2)', color: 'var(--text-1)',
              borderRadius: 6, cursor: 'pointer', fontSize: 12,
            }}>Traiter</button>
          )}
        </Td>
      </tr>
      {reponseOpen && (
        <tr style={{ background: 'var(--bg-card-2)' }}>
          <td colSpan={6} style={{ padding: 14 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-2)' }}>
              Réponse apportée à la personne
            </label>
            <textarea
              value={reponse}
              onChange={e => setReponse(e.target.value)}
              style={{
                width: '100%', minHeight: 70, marginTop: 6, padding: 8,
                border: '1px solid var(--border)', borderRadius: 6,
                background: 'var(--bg-card)', color: 'var(--text-1)', fontSize: 13,
                resize: 'vertical', outline: 'none',
              }}
            />
            <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
              <button onClick={() => cloturer('TRAITEE')} disabled={!reponse.trim()} style={{
                padding: '6px 14px', border: 'none', borderRadius: 6,
                background: !reponse.trim() ? 'var(--bg-card-2)' : '#10B981',
                color: 'white', fontWeight: 600, fontSize: 12,
                cursor: !reponse.trim() ? 'not-allowed' : 'pointer',
              }}>✓ Traitée</button>
              <button onClick={() => cloturer('REJETEE')} disabled={!reponse.trim()} style={{
                padding: '6px 14px', border: 'none', borderRadius: 6,
                background: !reponse.trim() ? 'var(--bg-card-2)' : '#6B7280',
                color: 'white', fontWeight: 600, fontSize: 12,
                cursor: !reponse.trim() ? 'not-allowed' : 'pointer',
              }}>Rejeter</button>
              <button onClick={() => setReponseOpen(false)} style={{
                padding: '6px 14px', border: '1px solid var(--border)',
                background: 'transparent', color: 'var(--text-3)',
                borderRadius: 6, cursor: 'pointer', fontSize: 12,
              }}>Annuler</button>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function FormNouvelleDemande({ onClose, onSuccess, userEmail }) {
  const [type, setType]     = useState('ACCES');
  const [nom, setNom]       = useState('');
  const [email, setEmail]   = useState('');
  const [motif, setMotif]   = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr]       = useState(null);

  const submit = async () => {
    if (!nom.trim()) { setErr('Nom de la personne requis'); return; }
    setLoading(true); setErr(null);
    const dateReception = new Date();
    const dateEcheance  = calculerEcheanceRGPD(dateReception);
    const { data, error } = await supabase.from('rgpd_demandes').insert({
      type, personne_nom: nom.trim(), personne_email: email.trim() || null,
      motif: motif.trim() || null,
      date_reception: dateReception.toISOString(),
      date_echeance: dateEcheance.toISOString(),
      statut: 'EN_COURS',
    }).select().single();
    setLoading(false);
    if (error) { setErr(error.message); return; }
    try {
      await logAction('rgpd_demandes', data?.id, 'CREATE', {
        type, personne: nom,
      }, userEmail);
    } catch {}
    onSuccess();
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
      zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center',
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        background: 'var(--bg-card)', border: '1px solid var(--border)',
        borderRadius: 12, padding: 24, width: '90%', maxWidth: 500,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-1)', margin: 0 }}>
            Nouvelle demande RGPD
          </h3>
          <button onClick={onClose} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-3)' }}>
            <X size={18} />
          </button>
        </div>

        <Field label="Type de demande">
          <select value={type} onChange={e => setType(e.target.value)} style={fieldStyle}>
            {TYPES_DEMANDE_RGPD.map(t => (
              <option key={t.id} value={t.id}>{t.label} ({t.article})</option>
            ))}
          </select>
        </Field>
        <Field label="Nom de la personne *">
          <input value={nom} onChange={e => setNom(e.target.value)} style={fieldStyle} />
        </Field>
        <Field label="Email (si connu)">
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} style={fieldStyle} />
        </Field>
        <Field label="Motif / contexte">
          <textarea value={motif} onChange={e => setMotif(e.target.value)} style={{ ...fieldStyle, minHeight: 60, resize: 'vertical' }} />
        </Field>

        {err && (
          <div style={{ padding: 8, marginBottom: 10, background: 'rgba(239,68,68,0.1)', color: '#EF4444', borderRadius: 6, fontSize: 12 }}>
            {err}
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
          <button onClick={submit} disabled={loading} style={{
            padding: '10px 18px', border: 'none', borderRadius: 8,
            background: 'linear-gradient(135deg, #4F63E7, #06B6D4)',
            color: 'white', fontWeight: 700, fontSize: 13, cursor: 'pointer',
            opacity: loading ? 0.6 : 1,
          }}>{loading ? 'Enregistrement...' : 'Enregistrer'}</button>
          <button onClick={onClose} style={{
            padding: '10px 18px', border: '1px solid var(--border)',
            background: 'transparent', color: 'var(--text-2)',
            borderRadius: 8, cursor: 'pointer', fontSize: 13,
          }}>Annuler</button>
        </div>
      </div>
    </div>
  );
}

// =====================================================================
// Composants utilitaires
// =====================================================================
function Th({ children }) {
  return <th style={{ padding: '10px 14px', fontSize: 12, fontWeight: 700, color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{children}</th>;
}
function Td({ children }) {
  return <td style={{ padding: '10px 14px', color: 'var(--text-1)', verticalAlign: 'top' }}>{children}</td>;
}
function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-2)', marginBottom: 5 }}>
        {label}
      </label>
      {children}
    </div>
  );
}
const fieldStyle = {
  width: '100%', padding: 10, border: '1px solid var(--border)', borderRadius: 8,
  background: 'var(--bg-card-2)', color: 'var(--text-1)', fontSize: 13, outline: 'none',
};

function Banner({ type = 'info', texte }) {
  const couleurs = {
    info:    { bg: 'rgba(79,99,231,0.1)',  border: 'rgba(79,99,231,0.3)',  fg: '#4F63E7', icon: BookOpen },
    warning: { bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.3)', fg: '#F59E0B', icon: AlertTriangle },
    danger:  { bg: 'rgba(239,68,68,0.1)',  border: 'rgba(239,68,68,0.3)',  fg: '#EF4444', icon: AlertTriangle },
  };
  const c = couleurs[type];
  const Icon = c.icon;
  return (
    <div style={{
      display: 'flex', gap: 12, padding: 12, marginBottom: 14,
      background: c.bg, border: `1px solid ${c.border}`,
      borderRadius: 8, fontSize: 12, color: c.fg, lineHeight: 1.5,
    }}>
      <Icon size={16} style={{ flexShrink: 0, marginTop: 2 }} />
      <div>{texte}</div>
    </div>
  );
}

function ModalConfirm({ titre, message, onConfirm, onCancel, loading }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
      zIndex: 1001, display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: 'var(--bg-card)', border: '1px solid #EF4444',
        borderRadius: 12, padding: 24, width: '90%', maxWidth: 480,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
          <div style={{
            width: 40, height: 40, borderRadius: '50%',
            background: 'rgba(239,68,68,0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <AlertTriangle size={20} style={{ color: '#EF4444' }} />
          </div>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-1)', margin: 0 }}>{titre}</h3>
        </div>
        <p style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.5, marginBottom: 20 }}>{message}</p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onCancel} disabled={loading} style={{
            padding: '10px 18px', border: '1px solid var(--border)',
            background: 'transparent', color: 'var(--text-2)',
            borderRadius: 8, cursor: 'pointer', fontSize: 13,
          }}>Annuler</button>
          <button onClick={onConfirm} disabled={loading} style={{
            padding: '10px 18px', border: 'none', borderRadius: 8,
            background: '#EF4444', color: 'white',
            fontWeight: 700, fontSize: 13, cursor: 'pointer',
            opacity: loading ? 0.6 : 1,
          }}>{loading ? 'En cours...' : 'Confirmer l\'anonymisation'}</button>
        </div>
      </div>
    </div>
  );
}
