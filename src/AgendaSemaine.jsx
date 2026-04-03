import React, { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';
import { Calendar, Clock, AlertTriangle, GraduationCap, Target, ShieldAlert, ClipboardList } from 'lucide-react';
import { useTheme } from './ThemeContext';

const URGENCE = (dateStr) => {
  if (!dateStr) return 'normal';
  const diff = (new Date(dateStr) - new Date()) / 86400000;
  if (diff < 0)   return 'retard';
  if (diff <= 2)  return 'critique';
  if (diff <= 7)  return 'proche';
  return 'normal';
};

const URGENCE_STYLE = {
  retard:   { color: '#EF4444', bg: 'rgba(239,68,68,0.1)',   border: 'rgba(239,68,68,0.25)',   label: 'En retard' },
  critique: { color: '#F97316', bg: 'rgba(249,115,22,0.1)',  border: 'rgba(249,115,22,0.25)',  label: 'Urgent' },
  proche:   { color: '#F59E0B', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.2)',   label: 'Cette semaine' },
  normal:   { color: '#10B981', bg: 'rgba(16,185,129,0.08)', border: 'rgba(16,185,129,0.2)',   label: 'À venir' },
};

function addYears(dateStr, years) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  d.setFullYear(d.getFullYear() + Number(years || 1));
  return d.toISOString().split('T')[0];
}

export default function AgendaSemaine({ onNavigate }) {
  const { p } = useTheme();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { charger(); }, []);

  const charger = async () => {
    setLoading(true);
    const horizon = new Date();
    horizon.setDate(horizon.getDate() + 30); // 30 jours à venir
    const horizonStr = horizon.toISOString().split('T')[0];
    const now = new Date().toISOString().split('T')[0];

    const [r1, r2, r3, r4] = await Promise.all([
      // Actions PDCA à échéance dans 30j ou en retard
      supabase.from('plan_actions').select('id,action,echeance,pilote,statut,domaine')
        .lte('echeance', horizonStr).not('statut', 'in', '("Terminé","Annulé")').order('echeance'),
      // Audits planifiés dans 30j
      supabase.from('qualite_audits').select('id,type_audit,date_audit,auditeur,statut')
        .lte('date_audit', horizonStr).gte('date_audit', now).order('date_audit'),
      // Habilitations (on calcule l'expiration)
      supabase.from('habilitations').select('id,employe_id,type_habilitation,obtention,validiteAns'),
      // Analyses risque à revoir (date_analyse dans le passé)
      supabase.from('analyses_risque').select('id,titre_chantier,date_analyse,statut').order('date_analyse', { ascending: false }).limit(20),
    ]);

    const all = [];

    // Actions PDCA
    (r1.data || []).forEach(a => {
      all.push({
        date: a.echeance, label: a.action, sub: a.pilote ? `Pilote : ${a.pilote}` : a.domaine,
        icon: Target, color: '#4F63E7', tab: 'pdca', urgence: URGENCE(a.echeance),
      });
    });

    // Audits
    (r2.data || []).forEach(a => {
      all.push({
        date: a.date_audit, label: a.type_audit || 'Audit planifié', sub: a.auditeur || '',
        icon: ClipboardList, color: '#8B5CF6', tab: 'qualite', urgence: URGENCE(a.date_audit),
      });
    });

    // Habilitations expirant dans 30j ou périmées
    const now2 = new Date();
    (r3.data || []).forEach(h => {
      const exp = addYears(h.obtention, h.validiteAns);
      if (!exp) return;
      const diff = (new Date(exp) - now2) / 86400000;
      if (diff <= 30) {
        all.push({
          date: exp, label: h.type_habilitation || 'Habilitation', sub: `Expiration le ${new Date(exp).toLocaleDateString('fr-FR')}`,
          icon: GraduationCap, color: '#F59E0B', tab: 'rh', urgence: URGENCE(exp),
        });
      }
    });

    // Trier par urgence puis par date
    const order = { retard: 0, critique: 1, proche: 2, normal: 3 };
    all.sort((a, b) => order[a.urgence] - order[b.urgence] || a.date?.localeCompare(b.date));

    setItems(all.slice(0, 12)); // max 12 items
    setLoading(false);
  };

  if (loading) return null;
  if (!items.length) return (
    <div style={{ background: p.whiteFaint2, border: `1px solid ${p.border}`, borderRadius: 12, padding: '16px 18px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <Calendar size={15} style={{ color: 'var(--blue)' }}/>
        <span style={{ fontSize: 13, fontWeight: 700, color: p.text1 }}>Agenda — 30 prochains jours</span>
      </div>
      <p style={{ fontSize: 12, color: p.text4, marginTop: 6 }}>✅ Aucune échéance urgente dans les 30 prochains jours.</p>
    </div>
  );

  const retard = items.filter(i => i.urgence === 'retard').length;
  const urgent = items.filter(i => i.urgence === 'critique').length;

  return (
    <div style={{ background: p.whiteFaint2, border: `1px solid ${p.border}`, borderRadius: 12, padding: '16px 18px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Calendar size={15} style={{ color: 'var(--blue)' }}/>
          <span style={{ fontSize: 13, fontWeight: 700, color: p.text1 }}>Agenda — 30 prochains jours</span>
          {retard > 0 && (
            <span style={{ fontSize: 10, fontWeight: 700, background: 'rgba(239,68,68,0.15)', color: '#EF4444', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 100, padding: '2px 7px' }}>
              {retard} en retard
            </span>
          )}
          {urgent > 0 && (
            <span style={{ fontSize: 10, fontWeight: 700, background: 'rgba(249,115,22,0.15)', color: '#F97316', border: '1px solid rgba(249,115,22,0.3)', borderRadius: 100, padding: '2px 7px' }}>
              {urgent} urgent{urgent > 1 ? 's' : ''}
            </span>
          )}
        </div>
        <span style={{ fontSize: 11, color: p.text4 }}>{items.length} échéance{items.length > 1 ? 's' : ''}</span>
      </div>

      {/* Liste */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {items.map((item, i) => {
          const Icon = item.icon;
          const u = URGENCE_STYLE[item.urgence];
          const dateLabel = item.date
            ? new Date(item.date + 'T12:00:00').toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })
            : '';
          return (
            <div key={i}
              onClick={() => onNavigate?.(item.tab)}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                background: u.bg, border: `1px solid ${u.border}`,
                borderRadius: 8, padding: '8px 10px', cursor: 'pointer',
                transition: 'opacity 0.15s',
              }}
              onMouseEnter={e => e.currentTarget.style.opacity = '0.8'}
              onMouseLeave={e => e.currentTarget.style.opacity = '1'}>
              <div style={{ width: 28, height: 28, borderRadius: 7, background: item.color + '20', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Icon size={13} style={{ color: item.color }}/>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: p.text1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.label}</div>
                {item.sub && <div style={{ fontSize: 11, color: p.text4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.sub}</div>}
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: u.color }}>{dateLabel}</div>
                <div style={{ fontSize: 10, color: u.color, opacity: 0.8 }}>{u.label}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
