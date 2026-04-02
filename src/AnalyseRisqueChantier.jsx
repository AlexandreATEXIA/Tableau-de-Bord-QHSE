import React, { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from './supabaseClient';
import {
  AlertTriangle, CheckCircle, XCircle, ChevronRight, ChevronLeft,
  MapPin, CloudRain, Zap, Flame, Wind, Cpu, Truck, Volume2,
  HardHat, Users, Shield, ClipboardList, Plus, Trash2, Eye,
  Download, RotateCcw, Check, AlertCircle, Info, ChevronDown,
  ChevronUp, Search, Calendar, Clock, Building2, Star, FileText,
  ArrowRight, Save, X, Thermometer, Camera, Copy, Share2, Printer, Navigation
} from 'lucide-react';

// ── Données des catégories de risques ────────────────────────────────────────
const CATEGORIES = [
  {
    id: 'acces',
    label: 'Accès & Balisage',
    icon: MapPin,
    color: '#3B82F6',
    bg: 'rgba(59,130,246,0.12)',
    questions: [
      { id: 'a1', text: 'Les accès au chantier sont-ils clairement identifiés et balisés ?' },
      { id: 'a2', text: 'Les voies de circulation piétons/véhicules sont-elles séparées ?' },
      { id: 'a3', text: 'Les issues de secours et points de rassemblement sont-ils connus ?' },
      { id: 'a4', text: 'La signalisation temporaire est-elle conforme et visible ?' },
      { id: 'a5', text: 'Les zones interdites au public sont-elles sécurisées ?' },
    ]
  },
  {
    id: 'chute',
    label: 'Chutes de hauteur & Plain-pied',
    icon: AlertTriangle,
    color: '#EF4444',
    bg: 'rgba(239,68,68,0.12)',
    questions: [
      { id: 'c1', text: 'Les zones de travail en hauteur sont-elles protégées (garde-corps, filets) ?' },
      { id: 'c2', text: 'Les échafaudages sont-ils conformes et réceptionnés ?' },
      { id: 'c3', text: 'Les trémies et ouvertures au sol sont-elles protégées ?' },
      { id: 'c4', text: 'Le sol est-il dégagé, non glissant et sans obstacles ?' },
      { id: 'c5', text: 'Les EPI anti-chute sont-ils disponibles et en bon état ?' },
      { id: 'c6', text: 'Les voies de circulation sont-elles éclairées correctement ?' },
    ]
  },
  {
    id: 'electrique',
    label: 'Risques Électriques',
    icon: Zap,
    color: '#F59E0B',
    bg: 'rgba(245,158,11,0.12)',
    questions: [
      { id: 'e1', text: 'Les armoires et coffrets électriques sont-ils fermés à clé ?' },
      { id: 'e2', text: 'Les câbles et rallonges sont-ils en bon état et correctement posés ?' },
      { id: 'e3', text: 'Les zones de présence de réseaux enterrés ont-elles été identifiées (DICT) ?' },
      { id: 'e4', text: 'Les habilitations électriques des intervenants sont-elles valides ?' },
      { id: 'e5', text: 'Les équipements sont-ils reliés à la terre ?' },
    ]
  },
  {
    id: 'incendie',
    label: 'Incendie & Explosion',
    icon: Flame,
    color: '#F97316',
    bg: 'rgba(249,115,22,0.12)',
    questions: [
      { id: 'i1', text: 'Les extincteurs sont-ils présents, accessibles et vérifiés ?' },
      { id: 'i2', text: 'Les produits inflammables sont-ils stockés correctement et éloignés des sources de chaleur ?' },
      { id: 'i3', text: 'Un permis de feu est-il requis et délivré pour les travaux par point chaud ?' },
      { id: 'i4', text: 'Les réseaux gaz ont-ils été identifiés et coupés si nécessaire ?' },
      { id: 'i5', text: 'Les consignes incendie sont-elles affichées et connues ?' },
    ]
  },
  {
    id: 'chimique',
    label: 'Risques Chimiques & CMR',
    icon: Wind,
    color: '#8B5CF6',
    bg: 'rgba(139,92,246,0.12)',
    questions: [
      { id: 'ch1', text: 'Les FDS (Fiches de Données de Sécurité) sont-elles disponibles sur site ?' },
      { id: 'ch2', text: 'Les produits chimiques sont-ils étiquetés et stockés séparément ?' },
      { id: 'ch3', text: 'La ventilation est-elle suffisante dans les zones de travail confinées ?' },
      { id: 'ch4', text: 'Les EPI chimiques (masques, gants, lunettes) sont-ils adaptés aux produits utilisés ?' },
      { id: 'ch5', text: 'Les déchets chimiques sont-ils gérés selon la réglementation ?' },
    ]
  },
  {
    id: 'mecanique',
    label: 'Engins & Machines',
    icon: Cpu,
    color: '#06B6D4',
    bg: 'rgba(6,182,212,0.12)',
    questions: [
      { id: 'm1', text: 'Les engins et machines disposent-ils de leurs documents (CACES, VGP) à jour ?' },
      { id: 'm2', text: 'Les zones d\'évolution des engins sont-elles balisées ?' },
      { id: 'm3', text: 'La présence d\'un signaleur est-elle assurée lors des manœuvres ?' },
      { id: 'm4', text: 'Les protections des parties mobiles sont-elles en place ?' },
      { id: 'm5', text: 'La vérification journalière des engins a-t-elle été effectuée ?' },
    ]
  },
  {
    id: 'coactivite',
    label: 'Co-activité & Interférences',
    icon: Users,
    color: '#10B981',
    bg: 'rgba(16,185,129,0.12)',
    questions: [
      { id: 'co1', text: 'Le plan de prévention ou PPSPS est-il établi et signé par toutes les entreprises ?' },
      { id: 'co2', text: 'Les zones d\'intervention de chaque entreprise sont-elles définies ?' },
      { id: 'co3', text: 'Une réunion de coordination a-t-elle été tenue ?' },
      { id: 'co4', text: 'Les risques d\'interférence entre entreprises ont-ils été identifiés ?' },
      { id: 'co5', text: 'Le responsable de chantier est-il identifié et présent ?' },
    ]
  },
  {
    id: 'meteo',
    label: 'Conditions Météo & Environnement',
    icon: CloudRain,
    color: '#64748B',
    bg: 'rgba(100,116,139,0.12)',
    questions: [
      { id: 'me1', text: 'Les conditions météo sont-elles compatibles avec les travaux prévus ?' },
      { id: 'me2', text: 'En cas d\'orage, la procédure de mise à l\'abri est-elle connue ?' },
      { id: 'me3', text: 'La chaleur ou le froid extrême nécessite-t-il des mesures spécifiques (hydratation, pauses) ?' },
      { id: 'me4', text: 'Le vent ne risque-t-il pas d\'affecter la stabilité des équipements ou matériaux ?' },
      { id: 'me5', text: 'L\'environnement proche est-il dégagé (arbres, fils électriques, riverains) ?' },
    ]
  },
  {
    id: 'epi',
    label: 'EPI & Premiers Secours',
    icon: HardHat,
    color: '#EC4899',
    bg: 'rgba(236,72,153,0.12)',
    questions: [
      { id: 'ep1', text: 'Tous les intervenants portent-ils les EPI obligatoires (casque, chaussures, gilet) ?' },
      { id: 'ep2', text: 'Les EPI spécifiques aux travaux sont-ils disponibles et adaptés ?' },
      { id: 'ep3', text: 'Une trousse de premiers secours est-elle accessible et complète ?' },
      { id: 'ep4', text: 'Au moins une personne est-elle formée aux premiers secours (SST) ?' },
      { id: 'ep5', text: 'Les numéros d\'urgence sont-ils affichés (15, 18, 112) ?' },
    ]
  },
];

const SECTEURS_CHANTIER = [
  {
    secteur: '🏗️ BTP / Construction',
    color: '#3B82F6',
    types: ['Gros œuvre / Maçonnerie', 'Second œuvre / Finitions', 'Charpente / Ossature bois', 'Béton armé / Coffrage', 'Fondations / Micropieux', 'Carrelage / Revêtements']
  },
  {
    secteur: '🔧 Travaux spécialisés',
    color: '#F97316',
    types: ['Toiture / Couverture', 'Étanchéité / Imperméabilisation', 'Façade / Ravalement', 'Isolation thermique / ITE', 'Menuiserie / Serrurerie', 'Peinture / Enduits']
  },
  {
    secteur: '⚡ Réseaux & Fluides',
    color: '#F59E0B',
    types: ['Électricité HT / BT', 'Plomberie / Sanitaire', 'CVC (Chauffage / Ventilation / Clim)', 'Gaz / Réseaux combustibles', 'Fibre optique / Télécom', 'Sprinklage / Protection incendie']
  },
  {
    secteur: '🛣️ Travaux publics',
    color: '#10B981',
    types: ['VRD (Voirie / Réseaux Divers)', 'Terrassement / Déblais', 'Génie civil / Ouvrages d\'art', 'Voirie / Signalisation', 'Assainissement / Collecteur', 'Réseaux souterrains / DICT']
  },
  {
    secteur: '🏭 Industrie & Maintenance',
    color: '#8B5CF6',
    types: ['Installation industrielle', 'Maintenance / Entretien industriel', 'Tuyauterie / Process', 'Soudure / Chaudronnerie', 'Levage / Manutention lourde', 'Nettoyage industriel']
  },
  {
    secteur: '💥 Démolition & Désamiantage',
    color: '#EF4444',
    types: ['Démolition partielle', 'Démolition totale / Déconstruction', 'Désamiantage / Amiante', 'Déplombage / Plomb', 'Dépollution pyrotechnique', 'Curage / Vidange']
  },
  {
    secteur: '🌿 Environnement & Espaces',
    color: '#06B6D4',
    types: ['Espaces verts / Paysage', 'Abattage d\'arbres / Élagage', 'Dépollution de sols', 'Curage de cours d\'eau', 'Travaux en milieu aquatique', 'Géothermie']
  },
  {
    secteur: '🔍 Inspection & Contrôle',
    color: '#EC4899',
    types: ['Inspection / Diagnostic', 'Contrôle réglementaire', 'Audit de chantier', 'Travaux de nuit', 'Travaux en espace confiné', 'Autre (préciser)']
  },
];

const TYPES_INTERVENTION = [
  { value: 'neuf',        label: '🆕 Travaux neufs',         desc: 'Construction ou installation nouvelle' },
  { value: 'renovation',  label: '🔨 Rénovation',            desc: 'Réhabilitation d\'existant' },
  { value: 'maintenance', label: '⚙️ Maintenance / Entretien', desc: 'Opération planifiée de maintenance' },
  { value: 'urgence',     label: '🚨 Urgence / Dépannage',   desc: 'Intervention non planifiée' },
  { value: 'inspection',  label: '🔍 Inspection / Contrôle', desc: 'Visite de contrôle ou audit' },
  { value: 'demolition',  label: '💥 Démolition',            desc: 'Déconstruction ou dépose' },
];

const ENVIRONNEMENTS_SITE = [
  { value: 'urbain',       label: '🏙️ Zone urbaine',         color: '#3B82F6' },
  { value: 'residentiel',  label: '🏡 Zone résidentielle',   color: '#10B981' },
  { value: 'industriel',   label: '🏭 Site industriel',      color: '#8B5CF6' },
  { value: 'erp',          label: '🏥 ERP (hôpital, école…)', color: '#F97316' },
  { value: 'occupe',       label: '👥 Site occupé / activité', color: '#F59E0B' },
  { value: 'seveso',       label: '⚠️ Site SEVESO',           color: '#EF4444' },
  { value: 'inondable',    label: '🌊 Zone inondable',        color: '#06B6D4' },
  { value: 'naturel',      label: '🌿 Zone naturelle / protégée', color: '#059669' },
  { value: 'routier',      label: '🚗 Voie de circulation',  color: '#64748B' },
  { value: 'hauteur',      label: '🏔️ Altitude / Zone ventée', color: '#94A3B8' },
];

const METEO_OPTIONS = [
  { value: 'soleil', label: '☀️ Ensoleillé', color: '#F59E0B' },
  { value: 'nuageux', label: '⛅ Nuageux', color: '#94A3B8' },
  { value: 'pluie', label: '🌧️ Pluvieux', color: '#3B82F6' },
  { value: 'vent', label: '💨 Venteux', color: '#06B6D4' },
  { value: 'orage', label: '⛈️ Orageux', color: '#8B5CF6' },
  { value: 'brouillard', label: '🌫️ Brouillard', color: '#64748B' },
  { value: 'chaleur', label: '🥵 Forte chaleur', color: '#EF4444' },
  { value: 'froid', label: '🥶 Grand froid', color: '#06B6D4' },
];

const RISQUE_COLORS = {
  faible: { bg: 'rgba(16,185,129,0.15)', border: '#10B981', text: '#10B981', label: 'Faible' },
  modere: { bg: 'rgba(245,158,11,0.15)', border: '#F59E0B', text: '#F59E0B', label: 'Modéré' },
  eleve:  { bg: 'rgba(239,68,68,0.15)',  border: '#EF4444', text: '#EF4444', label: 'Élevé' },
  critique: { bg: 'rgba(139,92,246,0.15)', border: '#8B5CF6', text: '#8B5CF6', label: 'Critique' },
};

// ── Feature 5: Mapping type chantier → catégories prioritaires ───────────────
const TYPE_RISQUES_PRIORITAIRES = {
  'Toiture / Couverture': ['chute', 'epi'],
  'Désamiantage / Amiante': ['chimique', 'epi'],
  'Déplombage / Plomb': ['chimique', 'epi'],
  'Électricité HT / BT': ['electrique', 'epi'],
  'Démolition partielle': ['chute', 'mecanique'],
  'Démolition totale / Déconstruction': ['chute', 'mecanique', 'chimique'],
  'Soudure / Chaudronnerie': ['incendie', 'chimique'],
  'Levage / Manutention lourde': ['mecanique', 'coactivite'],
  'Terrassement / Déblais': ['chute', 'mecanique'],
  'Travaux en espace confiné': ['chimique', 'epi'],
  'Installation industrielle': ['electrique', 'mecanique'],
  'VRD (Voirie / Réseaux Divers)': ['electrique', 'mecanique'],
};

function getNiveauRisque(score) {
  if (score <= 4) return 'faible';
  if (score <= 9) return 'modere';
  if (score <= 16) return 'eleve';
  return 'critique';
}

function calcScore(reponses) {
  const total = Object.values(reponses).length;
  if (total === 0) return 0;
  const nonConformes = Object.values(reponses).filter(r => r === 'non').length;
  const nsps = Object.values(reponses).filter(r => r === 'nsp').length;
  return Math.round(((nonConformes + nsps * 0.5) / total) * 25);
}

function getInitialAnalyse() {
  return {
    id: Date.now(),
    date: new Date().toISOString().split('T')[0],
    heure: new Date().toTimeString().slice(0, 5),
    chantier: '',
    adresse: '',
    type: '',
    typeCustom: '',
    typeIntervention: '',
    environnement: [],
    meteo: '',
    temperature: '',
    responsable: '',
    entreprise: '',
    intervenants: '',
    reponses: {},
    observations: {},
    actionsPreventives: [],
    statut: 'en_cours',
    signature: '',
    photos: {},
  };
}

// ── Composant Badge risque ───────────────────────────────────────────────────
function BadgeRisque({ niveau, size = 'sm' }) {
  const c = RISQUE_COLORS[niveau] || RISQUE_COLORS.faible;
  return (
    <span style={{
      background: c.bg, border: `1px solid ${c.border}`, color: c.text,
      borderRadius: 100, padding: size === 'sm' ? '2px 10px' : '4px 14px',
      fontSize: size === 'sm' ? 11 : 13, fontWeight: 700, letterSpacing: '0.02em'
    }}>{c.label}</span>
  );
}

// ── Feature 4: Compression image ─────────────────────────────────────────────
function compressImage(file, maxWidth = 800) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let w = img.width;
        let h = img.height;
        if (w > maxWidth) {
          h = Math.round((h * maxWidth) / w);
          w = maxWidth;
        }
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.75));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

// ── Feature 2: SignaturePad ──────────────────────────────────────────────────
function SignaturePad({ value, onChange }) {
  const canvasRef = useRef(null);
  const drawing = useRef(false);
  const lastPos = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    // Si une signature est déjà stockée, la recharger
    if (value) {
      const img = new Image();
      img.onload = () => { ctx.drawImage(img, 0, 0); };
      img.src = value;
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function getPos(e, canvas) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if (e.touches) {
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top) * scaleY,
      };
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  }

  function startDraw(e) {
    e.preventDefault();
    drawing.current = true;
    const canvas = canvasRef.current;
    lastPos.current = getPos(e, canvas);
  }

  function draw(e) {
    e.preventDefault();
    if (!drawing.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const pos = getPos(e, canvas);
    ctx.beginPath();
    ctx.moveTo(lastPos.current.x, lastPos.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
    lastPos.current = pos;
  }

  function endDraw(e) {
    if (!drawing.current) return;
    drawing.current = false;
    const canvas = canvasRef.current;
    onChange(canvas.toDataURL('image/png'));
  }

  function clearCanvas() {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    onChange('');
  }

  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Signature du responsable
        </label>
        <button onClick={clearCanvas} style={{
          fontSize: 12, color: 'var(--text-3)', background: 'transparent', border: '1px solid var(--border-2)',
          borderRadius: 7, padding: '4px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4
        }}>
          <RotateCcw size={11} /> Effacer
        </button>
      </div>
      <canvas
        ref={canvasRef}
        width={800}
        height={160}
        onMouseDown={startDraw}
        onMouseMove={draw}
        onMouseUp={endDraw}
        onMouseLeave={endDraw}
        onTouchStart={startDraw}
        onTouchMove={draw}
        onTouchEnd={endDraw}
        style={{
          width: '100%', height: 160, borderRadius: 10, cursor: 'crosshair',
          border: '1.5px dashed var(--border-2)', background: 'var(--bg-card-2)', display: 'block',
          touchAction: 'none',
        }}
      />
      {!value && (
        <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--text-4)', marginTop: 6 }}>
          Signez dans la zone ci-dessus avec votre doigt ou la souris
        </div>
      )}
    </div>
  );
}

// ── Composant Question ───────────────────────────────────────────────────────
function QuestionItem({ question, value, onChange, observation, onObservation, photo, onPhoto }) {
  const [showObs, setShowObs] = useState(false);
  const fileInputRef = useRef(null);
  const colors = { oui: '#10B981', non: '#EF4444', nsp: '#F59E0B', '': 'var(--text-4)' };

  async function handlePhotoChange(e) {
    const file = e.target.files[0];
    if (!file) return;
    const dataUrl = await compressImage(file);
    onPhoto(dataUrl);
  }

  return (
    <div style={{
      background: value === 'non' ? 'rgba(239,68,68,0.05)' : value === 'oui' ? 'rgba(16,185,129,0.04)' : 'var(--bg-card-2)',
      border: `1px solid ${value === 'non' ? 'rgba(239,68,68,0.25)' : value === 'oui' ? 'rgba(16,185,129,0.2)' : 'var(--border)'}`,
      borderRadius: 10, padding: '12px 14px', marginBottom: 8, transition: 'all 0.2s'
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ flex: 1, fontSize: 13.5, color: 'var(--text-1)', lineHeight: 1.5, paddingTop: 2 }}>
          {question.text}
        </div>
        <div style={{ display: 'flex', gap: 6, flexShrink: 0, alignItems: 'center' }}>
          {['oui', 'non', 'nsp'].map(opt => (
            <button key={opt} onClick={() => onChange(opt === value ? '' : opt)} style={{
              padding: '5px 12px', borderRadius: 8, border: `1.5px solid ${value === opt ? colors[opt] : 'var(--border-2)'}`,
              background: value === opt ? (opt === 'oui' ? 'rgba(16,185,129,0.18)' : opt === 'non' ? 'rgba(239,68,68,0.18)' : 'rgba(245,158,11,0.18)') : 'transparent',
              color: value === opt ? colors[opt] : 'var(--text-3)',
              fontSize: 12, fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s',
              textTransform: 'uppercase', letterSpacing: '0.04em'
            }}>
              {opt === 'nsp' ? '?' : opt}
            </button>
          ))}
          <button onClick={() => setShowObs(!showObs)} style={{
            width: 30, height: 30, borderRadius: 8, border: `1.5px solid ${observation ? 'var(--blue)' : 'var(--border-2)'}`,
            background: observation ? 'var(--blue-l)' : 'transparent', color: observation ? 'var(--blue)' : 'var(--text-4)',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
          }}>
            <FileText size={13} />
          </button>
          {/* Feature 4: Camera button */}
          <button onClick={() => fileInputRef.current && fileInputRef.current.click()} style={{
            width: 30, height: 30, borderRadius: 8, border: `1.5px solid ${photo ? '#10B981' : 'var(--border-2)'}`,
            background: photo ? 'rgba(16,185,129,0.15)' : 'transparent', color: photo ? '#10B981' : 'var(--text-4)',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, position: 'relative'
          }}>
            <Camera size={13} />
            {photo && (
              <span style={{
                position: 'absolute', top: -4, right: -4, width: 10, height: 10,
                background: '#10B981', borderRadius: '50%', border: '2px solid var(--bg-card)'
              }} />
            )}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            style={{ display: 'none' }}
            onChange={handlePhotoChange}
          />
        </div>
      </div>
      {/* Miniature photo */}
      {photo && (
        <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
          <img src={photo} alt="Photo" style={{ width: 60, height: 40, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--border-2)' }} />
          <button onClick={() => onPhoto(null)} style={{
            fontSize: 11, color: '#EF4444', background: 'transparent', border: 'none', cursor: 'pointer'
          }}>Supprimer</button>
        </div>
      )}
      {showObs && (
        <div style={{ marginTop: 10 }}>
          <textarea
            value={observation || ''}
            onChange={e => onObservation(e.target.value)}
            placeholder="Observation, remarque ou précision..."
            style={{
              width: '100%', background: 'var(--input-bg)', border: '1px solid var(--input-border)',
              borderRadius: 8, padding: '8px 12px', fontSize: 13, color: 'var(--text-1)',
              resize: 'vertical', minHeight: 60, outline: 'none', fontFamily: 'inherit'
            }}
          />
        </div>
      )}
    </div>
  );
}

// ── Composant Catégorie ──────────────────────────────────────────────────────
function CategorieSection({ cat, reponses, observations, photos, onChange, onObservation, onPhoto, prioritaire }) {
  const [expanded, setExpanded] = useState(true);
  const Icon = cat.icon;
  const answered = cat.questions.filter(q => reponses[q.id]).length;
  const nonConformes = cat.questions.filter(q => reponses[q.id] === 'non').length;

  return (
    <div className="glass-panel" style={{
      marginBottom: 16, overflow: 'hidden',
      border: prioritaire ? `2px solid ${cat.color}` : undefined,
    }}>
      <button onClick={() => setExpanded(!expanded)} style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 12,
        padding: '14px 18px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left'
      }}>
        <div style={{
          width: 38, height: 38, borderRadius: 10, background: cat.bg,
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
        }}>
          <Icon size={18} style={{ color: cat.color }} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-1)', display: 'flex', alignItems: 'center', gap: 8 }}>
            {cat.label}
            {/* Feature 5: Badge prioritaire */}
            {prioritaire && (
              <span style={{
                fontSize: 10, fontWeight: 700, color: cat.color, background: `${cat.color}20`,
                border: `1px solid ${cat.color}`, borderRadius: 20, padding: '1px 7px', letterSpacing: '0.02em'
              }}>⚡ Prioritaire</span>
            )}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>
            {answered}/{cat.questions.length} réponses
            {nonConformes > 0 && <span style={{ color: '#EF4444', marginLeft: 8, fontWeight: 600 }}>• {nonConformes} non-conformité{nonConformes > 1 ? 's' : ''}</span>}
          </div>
        </div>
        {/* Progress bar */}
        <div style={{ width: 80, height: 6, background: 'var(--border)', borderRadius: 3, overflow: 'hidden', flexShrink: 0 }}>
          <div style={{ height: '100%', width: `${(answered / cat.questions.length) * 100}%`, background: nonConformes > 0 ? '#EF4444' : cat.color, borderRadius: 3, transition: 'width 0.3s' }} />
        </div>
        {expanded ? <ChevronUp size={16} style={{ color: 'var(--text-4)', flexShrink: 0 }} /> : <ChevronDown size={16} style={{ color: 'var(--text-4)', flexShrink: 0 }} />}
      </button>

      {expanded && (
        <div style={{ padding: '0 18px 18px' }}>
          {cat.questions.map(q => (
            <QuestionItem
              key={q.id}
              question={q}
              value={reponses[q.id] || ''}
              onChange={v => onChange(q.id, v)}
              observation={observations[q.id]}
              onObservation={v => onObservation(q.id, v)}
              photo={(photos || {})[q.id] || null}
              onPhoto={v => onPhoto(q.id, v)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Composant Synthèse ───────────────────────────────────────────────────────
function Synthese({ analyse, onRetour }) {
  const totalQ = CATEGORIES.reduce((s, c) => s + c.questions.length, 0);
  const totalAnswered = Object.keys(analyse.reponses).length;
  const totalOui = Object.values(analyse.reponses).filter(r => r === 'oui').length;
  const totalNon = Object.values(analyse.reponses).filter(r => r === 'non').length;
  const totalNsp = Object.values(analyse.reponses).filter(r => r === 'nsp').length;
  const score = calcScore(analyse.reponses);
  const niveau = getNiveauRisque(score);
  const niveauInfo = RISQUE_COLORS[niveau];

  const nonConformitesByCat = CATEGORIES.map(cat => ({
    cat,
    items: cat.questions.filter(q => analyse.reponses[q.id] === 'non' || analyse.reponses[q.id] === 'nsp')
  })).filter(x => x.items.length > 0);

  // Feature 6: Email & WhatsApp sharing
  const nonConformesCount = totalNon + totalNsp;
  const shareSubject = `Analyse de risque - ${analyse.chantier || 'Chantier'}`;
  const shareBody = `Analyse de risque chantier\n\nChantier : ${analyse.chantier || 'Non défini'}\nDate : ${analyse.date} ${analyse.heure}\nScore : ${score}/25\nNiveau : ${RISQUE_COLORS[niveau].label}\nNon-conformités : ${nonConformesCount}\n\nResponsable : ${analyse.responsable || 'Non défini'}`;
  const emailHref = `mailto:?subject=${encodeURIComponent(shareSubject)}&body=${encodeURIComponent(shareBody)}`;
  const waHref = `https://wa.me/?text=${encodeURIComponent(shareBody)}`;

  // Feature 3: Export PDF
  function handlePrint() {
    window.print();
  }

  return (
    <div>
      {/* Score global */}
      <div id="print-zone">
        <div className="glass-panel" style={{ padding: 28, marginBottom: 20, textAlign: 'center' }}>
          <div style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>
            Niveau de risque global
          </div>
          <div style={{
            width: 120, height: 120, borderRadius: '50%', margin: '0 auto 16px',
            background: niveauInfo.bg, border: `3px solid ${niveauInfo.border}`,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center'
          }}>
            <div style={{ fontSize: 32, fontWeight: 900, color: niveauInfo.text }}>{score}</div>
            <div style={{ fontSize: 11, color: niveauInfo.text, opacity: 0.8 }}>/25</div>
          </div>
          <BadgeRisque niveau={niveau} size="lg" />
          <div style={{ marginTop: 20, display: 'flex', justifyContent: 'center', gap: 24 }}>
            {[
              { label: 'Conformes', val: totalOui, color: '#10B981' },
              { label: 'Non-conformes', val: totalNon, color: '#EF4444' },
              { label: 'À vérifier', val: totalNsp, color: '#F59E0B' },
              { label: 'Non répondus', val: totalQ - totalAnswered, color: 'var(--text-4)' },
            ].map(s => (
              <div key={s.label} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 24, fontWeight: 800, color: s.color }}>{s.val}</div>
                <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Feature 6: Partager */}
        <div className="glass-panel" style={{ padding: 16, marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-1)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Share2 size={14} style={{ color: 'var(--blue)' }} /> Partager
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <a href={emailHref} style={{
              display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 16px',
              background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.3)', borderRadius: 10,
              color: 'var(--blue)', textDecoration: 'none', fontSize: 13, fontWeight: 600
            }}>📧 Email</a>
            <a href={waHref} target="_blank" rel="noopener noreferrer" style={{
              display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 16px',
              background: 'rgba(37,211,102,0.12)', border: '1px solid rgba(37,211,102,0.3)', borderRadius: 10,
              color: '#25D166', textDecoration: 'none', fontSize: 13, fontWeight: 600
            }}>💬 WhatsApp</a>
            {/* Feature 3: Exporter PDF */}
            <button onClick={handlePrint} style={{
              display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 16px',
              background: 'rgba(139,92,246,0.12)', border: '1px solid rgba(139,92,246,0.3)', borderRadius: 10,
              color: '#8B5CF6', cursor: 'pointer', fontSize: 13, fontWeight: 600
            }}>
              <Printer size={14} /> Exporter PDF
            </button>
          </div>
        </div>

        {/* Non-conformités détaillées */}
        {nonConformitesByCat.length > 0 && (
          <div className="glass-panel" style={{ padding: 20, marginBottom: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-1)', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
              <AlertTriangle size={16} style={{ color: '#EF4444' }} /> Points d'attention
            </div>
            {nonConformitesByCat.map(({ cat, items }) => {
              const Icon = cat.icon;
              return (
                <div key={cat.id} style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <Icon size={14} style={{ color: cat.color }} />
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-2)' }}>{cat.label}</span>
                  </div>
                  {items.map(q => (
                    <div key={q.id} style={{
                      display: 'flex', alignItems: 'flex-start', gap: 8, padding: '7px 10px',
                      background: analyse.reponses[q.id] === 'non' ? 'rgba(239,68,68,0.07)' : 'rgba(245,158,11,0.07)',
                      borderRadius: 8, marginBottom: 4, marginLeft: 22
                    }}>
                      <div style={{
                        width: 18, height: 18, borderRadius: '50%', flexShrink: 0, marginTop: 1,
                        background: analyse.reponses[q.id] === 'non' ? '#EF4444' : '#F59E0B',
                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                      }}>
                        <span style={{ fontSize: 10, color: 'white', fontWeight: 800 }}>
                          {analyse.reponses[q.id] === 'non' ? '!' : '?'}
                        </span>
                      </div>
                      <div style={{ fontSize: 12.5, color: 'var(--text-2)', lineHeight: 1.4, flex: 1 }}>
                        {q.text}
                        {analyse.observations[q.id] && (
                          <div style={{ marginTop: 4, color: 'var(--text-3)', fontStyle: 'italic', fontSize: 12 }}>
                            → {analyse.observations[q.id]}
                          </div>
                        )}
                        {/* Feature 4: Miniature photo dans la synthèse */}
                        {analyse.photos && analyse.photos[q.id] && (
                          <div style={{ marginTop: 6 }}>
                            <img src={analyse.photos[q.id]} alt="Photo" style={{
                              width: 80, height: 54, objectFit: 'cover', borderRadius: 6,
                              border: '1px solid var(--border-2)'
                            }} />
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        )}

        {/* Actions préventives */}
        {analyse.actionsPreventives.length > 0 && (
          <div className="glass-panel" style={{ padding: 20, marginBottom: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-1)', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
              <CheckCircle size={16} style={{ color: '#10B981' }} /> Actions préventives
            </div>
            {analyse.actionsPreventives.map((a, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 12px',
                background: 'rgba(16,185,129,0.07)', border: '1px solid rgba(16,185,129,0.2)',
                borderRadius: 8, marginBottom: 6
              }}>
                <div style={{ width: 20, height: 20, borderRadius: '50%', background: 'rgba(16,185,129,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                  <span style={{ fontSize: 10, color: '#10B981', fontWeight: 800 }}>{i + 1}</span>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, color: 'var(--text-1)', fontWeight: 600 }}>{a.action}</div>
                  {a.responsable && <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>Responsable : {a.responsable} {a.delai ? `• Délai : ${a.delai}` : ''}</div>}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Feature 2: Signature dans la synthèse */}
        {analyse.signature && (
          <div className="glass-panel" style={{ padding: 20, marginBottom: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-1)', marginBottom: 12 }}>Signature du responsable</div>
            <img src={analyse.signature} alt="Signature" style={{
              maxWidth: '100%', height: 100, objectFit: 'contain',
              border: '1px solid var(--border-2)', borderRadius: 8, background: 'var(--bg-card-2)', padding: 8
            }} />
          </div>
        )}

        {/* Info chantier résumé */}
        <div className="glass-panel" style={{ padding: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-1)', marginBottom: 14 }}>Informations chantier</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {[
              { label: 'Chantier', val: analyse.chantier },
              { label: 'Type travaux', val: analyse.type === 'Autre (préciser)' ? analyse.typeCustom || 'Autre' : analyse.type },
              { label: 'Intervention', val: TYPES_INTERVENTION.find(t => t.value === analyse.typeIntervention)?.label },
              { label: 'Environnement', val: (analyse.environnement || []).map(v => ENVIRONNEMENTS_SITE.find(e => e.value === v)?.label).filter(Boolean).join(', ') || null },
              { label: 'Date', val: analyse.date },
              { label: 'Heure', val: analyse.heure },
              { label: 'Météo', val: analyse.meteo },
              { label: 'Responsable', val: analyse.responsable },
            ].filter(x => x.val).map(({ label, val }) => (
              <div key={label} style={{ padding: '8px 12px', background: 'var(--bg-card-2)', borderRadius: 8 }}>
                <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 2, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
                <div style={{ fontSize: 13, color: 'var(--text-1)', fontWeight: 600 }}>{val}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Carte analyse sauvegardée ────────────────────────────────────────────────
function AnalyseCard({ analyse, onView, onDelete, onDuplicate }) {
  const score = calcScore(analyse.reponses);
  const niveau = getNiveauRisque(score);
  const niveauInfo = RISQUE_COLORS[niveau];
  const totalQ = CATEGORIES.reduce((s, c) => s + c.questions.length, 0);
  const answered = Object.keys(analyse.reponses).length;

  return (
    <div className="glass-panel" style={{
      padding: '16px 18px', cursor: 'pointer', transition: 'all 0.2s',
      borderLeft: `3px solid ${niveauInfo.border}`
    }}
      onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-2px)'}
      onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
        <div style={{
          width: 44, height: 44, borderRadius: 10, background: niveauInfo.bg,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexShrink: 0
        }}>
          <div style={{ fontSize: 16, fontWeight: 900, color: niveauInfo.text }}>{score}</div>
          <div style={{ fontSize: 9, color: niveauInfo.text, opacity: 0.7 }}>/25</div>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-1)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {analyse.chantier || 'Sans nom'}
            </div>
            <BadgeRisque niveau={niveau} />
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-3)', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <span>📅 {analyse.date}</span>
            {analyse.heure && <span>🕐 {analyse.heure}</span>}
            {analyse.type && <span>🏗️ {analyse.type}</span>}
            <span style={{ color: answered === totalQ ? '#10B981' : 'var(--text-4)' }}>
              ✓ {answered}/{totalQ} questions
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          <button onClick={e => { e.stopPropagation(); onView(); }} style={{
            width: 32, height: 32, borderRadius: 8, border: '1px solid var(--border-2)',
            background: 'var(--blue-l)', color: 'var(--blue)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <Eye size={14} />
          </button>
          {/* Feature 7: Duplicate button */}
          <button onClick={e => { e.stopPropagation(); onDuplicate(); }} title="Dupliquer" style={{
            width: 32, height: 32, borderRadius: 8, border: '1px solid rgba(245,158,11,0.3)',
            background: 'rgba(245,158,11,0.1)', color: '#F59E0B', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <Copy size={14} />
          </button>
          <button onClick={e => { e.stopPropagation(); onDelete(); }} style={{
            width: 32, height: 32, borderRadius: 8, border: '1px solid rgba(239,68,68,0.3)',
            background: 'rgba(239,68,68,0.1)', color: '#EF4444', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Mapping JS ↔ Supabase ────────────────────────────────────────────────────
function toRow(a) {
  return {
    id:                  a.id,
    chantier:            a.chantier,
    adresse:             a.adresse,
    type:                a.type,
    type_custom:         a.typeCustom,
    type_intervention:   a.typeIntervention,
    environnement:       a.environnement,
    meteo:               a.meteo,
    temperature:         a.temperature,
    responsable:         a.responsable,
    entreprise:          a.entreprise,
    intervenants:        a.intervenants,
    date:                a.date,
    heure:               a.heure,
    reponses:            a.reponses,
    observations:        a.observations,
    actions_preventives: a.actionsPreventives,
    statut:              a.statut,
    saved_at:            a.savedAt || new Date().toISOString(),
    signature:           a.signature,
    photos:              a.photos,
  };
}

function fromRow(r) {
  return {
    id:                r.id,
    chantier:          r.chantier,
    adresse:           r.adresse,
    type:              r.type,
    typeCustom:        r.type_custom,
    typeIntervention:  r.type_intervention,
    environnement:     r.environnement || [],
    meteo:             r.meteo,
    temperature:       r.temperature,
    responsable:       r.responsable,
    entreprise:        r.entreprise,
    intervenants:      r.intervenants,
    date:              r.date,
    heure:             r.heure,
    reponses:          r.reponses || {},
    observations:      r.observations || {},
    actionsPreventives: r.actions_preventives || [],
    statut:            r.statut,
    savedAt:           r.saved_at,
    signature:         r.signature || '',
    photos:            r.photos || {},
  };
}

// ── Main Component ───────────────────────────────────────────────────────────
export default function AnalyseRisqueChantier() {
  const [vue, setVue] = useState('liste');
  const [step, setStep] = useState(1);
  const [analyse, setAnalyse] = useState(getInitialAnalyse());
  const [historique, setHistorique] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [analyseVue, setAnalyseVue] = useState(null);
  const [search, setSearch] = useState('');
  const [nouvelleAction, setNouvelleAction] = useState({ action: '', responsable: '', delai: '' });
  const topRef = useRef(null);
  // Feature 1: Géolocalisation state
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoError, setGeoError] = useState('');
  // Feature 7: Toast notification
  const [toast, setToast] = useState('');
  // Feature 8: PWA banner
  const [pwaBanner, setPwaBanner] = useState(() => {
    try { return !localStorage.getItem('pwa_banner_dismissed'); } catch { return false; }
  });

  // Chargement depuis Supabase
  const loadHistorique = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('analyses_risque')
      .select('*')
      .order('saved_at', { ascending: false });
    if (!error && data) setHistorique(data.map(fromRow));
    setLoading(false);
  }, []);

  useEffect(() => { loadHistorique(); }, [loadHistorique]);

  const updateReponse = (qid, val) => {
    setAnalyse(a => ({ ...a, reponses: { ...a.reponses, [qid]: val } }));
  };
  const updateObservation = (qid, val) => {
    setAnalyse(a => ({ ...a, observations: { ...a.observations, [qid]: val } }));
  };
  // Feature 4: update photos
  const updatePhoto = (qid, val) => {
    setAnalyse(a => {
      const newPhotos = { ...(a.photos || {}) };
      if (val === null) { delete newPhotos[qid]; } else { newPhotos[qid] = val; }
      return { ...a, photos: newPhotos };
    });
  };

  const saveAnalyse = async (statut = 'termine') => {
    setSaving(true);
    const updated = { ...analyse, statut, savedAt: new Date().toISOString() };
    const { error } = await supabase
      .from('analyses_risque')
      .upsert(toRow(updated), { onConflict: 'id' });
    if (!error) {
      await loadHistorique();
    }
    setSaving(false);
    return updated;
  };

  const deleteAnalyse = async (id) => {
    await supabase.from('analyses_risque').delete().eq('id', id);
    setHistorique(h => h.filter(x => x.id !== id));
  };

  // Feature 7: Dupliquer une analyse
  const duplicateAnalyse = async (original) => {
    const now = new Date();
    const copy = {
      ...original,
      id: Date.now(),
      date: now.toISOString().split('T')[0],
      heure: now.toTimeString().slice(0, 5),
      statut: 'en_cours',
      savedAt: null,
      signature: '',
      photos: {},
    };
    const { error } = await supabase
      .from('analyses_risque')
      .upsert(toRow({ ...copy, savedAt: now.toISOString() }), { onConflict: 'id' });
    if (!error) {
      await loadHistorique();
      setToast('Dupliqué !');
      setTimeout(() => setToast(''), 2500);
    }
  };

  const addAction = () => {
    if (!nouvelleAction.action.trim()) return;
    setAnalyse(a => ({ ...a, actionsPreventives: [...a.actionsPreventives, { ...nouvelleAction }] }));
    setNouvelleAction({ action: '', responsable: '', delai: '' });
  };
  const removeAction = (i) => {
    setAnalyse(a => ({ ...a, actionsPreventives: a.actionsPreventives.filter((_, idx) => idx !== i) }));
  };

  // Feature 1: Géolocalisation
  const handleGeolocate = () => {
    setGeoError('');
    if (!navigator.geolocation) {
      setGeoError('Géolocalisation non supportée');
      return;
    }
    setGeoLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lon } = pos.coords;
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`);
          const data = await res.json();
          const addr = data.display_name || `${lat.toFixed(5)}, ${lon.toFixed(5)}`;
          setAnalyse(a => ({ ...a, adresse: addr }));
        } catch {
          setAnalyse(a => ({ ...a, adresse: `${lat.toFixed(5)}, ${lon.toFixed(5)}` }));
        }
        setGeoLoading(false);
      },
      (err) => {
        setGeoLoading(false);
        setGeoError('Accès à la position refusé');
      }
    );
  };

  const totalQ = CATEGORIES.reduce((s, c) => s + c.questions.length, 0);
  const answered = Object.keys(analyse.reponses).length;
  const nonConformes = Object.values(analyse.reponses).filter(r => r === 'non').length;
  const score = calcScore(analyse.reponses);
  const niveau = getNiveauRisque(score);

  // Feature 5: catégories prioritaires pour le type sélectionné
  const priorityCats = analyse.type && TYPE_RISQUES_PRIORITAIRES[analyse.type]
    ? TYPE_RISQUES_PRIORITAIRES[analyse.type]
    : [];

  const filteredHistorique = historique.filter(h =>
    !search || h.chantier?.toLowerCase().includes(search.toLowerCase()) || h.type?.toLowerCase().includes(search.toLowerCase())
  );

  const stepLabels = ['Identification', 'Analyse risques', 'Actions', 'Synthèse'];

  const inputStyle = { width: '100%', background: 'var(--input-bg)', border: '1px solid var(--input-border)', borderRadius: 10, padding: '10px 14px', fontSize: 14, color: 'var(--text-1)', outline: 'none', fontFamily: 'inherit' };
  const labelStyle = { fontSize: 12, fontWeight: 600, color: 'var(--text-3)', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' };

  // Feature 3 & 6: detail view share helpers
  const detailShareSubject = analyseVue ? `Analyse de risque - ${analyseVue.chantier || 'Chantier'}` : '';
  const detailScore = analyseVue ? calcScore(analyseVue.reponses) : 0;
  const detailNiveau = analyseVue ? RISQUE_COLORS[getNiveauRisque(detailScore)].label : '';
  const detailNonConf = analyseVue ? Object.values(analyseVue.reponses).filter(r => r === 'non' || r === 'nsp').length : 0;
  const detailShareBody = analyseVue
    ? `Analyse de risque chantier\n\nChantier : ${analyseVue.chantier || 'Non défini'}\nDate : ${analyseVue.date} ${analyseVue.heure}\nScore : ${detailScore}/25\nNiveau : ${detailNiveau}\nNon-conformités : ${detailNonConf}\n\nResponsable : ${analyseVue.responsable || 'Non défini'}`
    : '';

  // ── Vue Détail ─────────────────────────────────────────────────────────────
  if (vue === 'detail' && analyseVue) {
    return (
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
          <button onClick={() => { setVue('liste'); setAnalyseVue(null); }} style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px',
            background: 'var(--bg-card-2)', border: '1px solid var(--border)', borderRadius: 10,
            color: 'var(--text-2)', cursor: 'pointer', fontSize: 13, fontWeight: 600
          }}>
            <ChevronLeft size={15} /> Retour
          </button>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-1)' }}>{analyseVue.chantier || 'Analyse sans nom'}</div>
            <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{analyseVue.date} {analyseVue.heure}</div>
          </div>
          {/* Feature 3 & 6 in detail view */}
          <div style={{ display: 'flex', gap: 8 }}>
            <a href={`mailto:?subject=${encodeURIComponent(detailShareSubject)}&body=${encodeURIComponent(detailShareBody)}`} style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px',
              background: 'rgba(59,130,246,0.12)', border: '1px solid rgba(59,130,246,0.3)', borderRadius: 10,
              color: 'var(--blue)', textDecoration: 'none', fontSize: 13, fontWeight: 600
            }}>📧</a>
            <a href={`https://wa.me/?text=${encodeURIComponent(detailShareBody)}`} target="_blank" rel="noopener noreferrer" style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px',
              background: 'rgba(37,211,102,0.12)', border: '1px solid rgba(37,211,102,0.3)', borderRadius: 10,
              color: '#25D166', textDecoration: 'none', fontSize: 13, fontWeight: 600
            }}>💬</a>
            <button onClick={() => window.print()} style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px',
              background: 'rgba(139,92,246,0.12)', border: '1px solid rgba(139,92,246,0.3)', borderRadius: 10,
              color: '#8B5CF6', cursor: 'pointer', fontSize: 13, fontWeight: 600
            }}>
              <Printer size={14} /> PDF
            </button>
          </div>
        </div>
        <Synthese analyse={analyseVue} onRetour={() => setVue('liste')} />
      </div>
    );
  }

  // ── Vue Nouvelle Analyse ───────────────────────────────────────────────────
  if (vue === 'nouvelle') {
    return (
      <div ref={topRef}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
          <button onClick={() => setVue('liste')} style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px',
            background: 'var(--bg-card-2)', border: '1px solid var(--border)', borderRadius: 10,
            color: 'var(--text-2)', cursor: 'pointer', fontSize: 13, fontWeight: 600
          }}>
            <ChevronLeft size={15} /> Retour
          </button>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-1)' }}>Nouvelle analyse de risque</div>
            <div style={{ fontSize: 12, color: 'var(--text-3)' }}>Étape {step}/4 — {stepLabels[step - 1]}</div>
          </div>
          <button onClick={async () => { await saveAnalyse('en_cours'); setVue('liste'); }} style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px',
            background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 10,
            color: '#F59E0B', cursor: 'pointer', fontSize: 13, fontWeight: 600
          }}>
            <Save size={14} /> Sauvegarder
          </button>
        </div>

        {/* Stepper */}
        <div style={{ display: 'flex', gap: 0, marginBottom: 28 }}>
          {stepLabels.map((label, i) => {
            const num = i + 1;
            const active = step === num;
            const done = step > num;
            return (
              <div key={num} style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
                <button onClick={() => setStep(num)} style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                  flex: 1, background: 'none', border: 'none', cursor: 'pointer', padding: '10px 4px'
                }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: done ? '#10B981' : active ? 'var(--blue)' : 'var(--bg-card-2)',
                    border: `2px solid ${done ? '#10B981' : active ? 'var(--blue)' : 'var(--border-2)'}`,
                    color: done || active ? 'white' : 'var(--text-4)', fontSize: 13, fontWeight: 800, transition: 'all 0.2s'
                  }}>
                    {done ? <Check size={14} /> : num}
                  </div>
                  <span style={{ fontSize: 11, fontWeight: active ? 700 : 500, color: active ? 'var(--blue)' : done ? '#10B981' : 'var(--text-4)', textAlign: 'center', letterSpacing: '0.02em' }}>
                    {label}
                  </span>
                </button>
                {i < stepLabels.length - 1 && (
                  <div style={{ height: 2, flex: 0.3, background: step > num ? '#10B981' : 'var(--border)', transition: 'background 0.3s', marginBottom: 16 }} />
                )}
              </div>
            );
          })}
        </div>

        {/* ── STEP 1 : Identification ── */}
        {step === 1 && (
          <div>
            {/* Bloc infos générales */}
            <div className="glass-panel" style={{ padding: 24, marginBottom: 16 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-1)', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Building2 size={16} style={{ color: 'var(--blue)' }} /> Informations générales
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <div style={{ gridColumn: '1/-1' }}>
                  <label style={labelStyle}>Nom du chantier *</label>
                  <input value={analyse.chantier} onChange={e => setAnalyse(a => ({ ...a, chantier: e.target.value }))}
                    placeholder="Ex: Rénovation bâtiment A – Site Nord"
                    style={inputStyle} />
                </div>
                <div style={{ gridColumn: '1/-1' }}>
                  <label style={labelStyle}>Adresse / Localisation</label>
                  {/* Feature 1: Champ adresse + bouton géolocalisation */}
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input value={analyse.adresse} onChange={e => setAnalyse(a => ({ ...a, adresse: e.target.value }))}
                      placeholder="Ex: 12 rue de la Paix, 97400 Saint-Denis"
                      style={{ ...inputStyle, flex: 1 }} />
                    <button onClick={handleGeolocate} disabled={geoLoading} title="Géolocaliser automatiquement" style={{
                      flexShrink: 0, padding: '10px 14px', borderRadius: 10,
                      border: '1px solid var(--input-border)', background: geoLoading ? 'var(--bg-card-2)' : 'rgba(59,130,246,0.1)',
                      color: 'var(--blue)', cursor: geoLoading ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                      fontSize: 13, fontWeight: 600
                    }}>
                      {geoLoading
                        ? <div style={{ width: 14, height: 14, border: '2px solid rgba(59,130,246,0.3)', borderTopColor: 'var(--blue)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                        : <Navigation size={14} />
                      }
                    </button>
                  </div>
                  {geoError && (
                    <div style={{ fontSize: 12, color: '#EF4444', marginTop: 5 }}>{geoError}</div>
                  )}
                </div>
                <div>
                  <label style={labelStyle}>Date</label>
                  <input type="date" value={analyse.date} onChange={e => setAnalyse(a => ({ ...a, date: e.target.value }))} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Heure d'arrivée</label>
                  <input type="time" value={analyse.heure} onChange={e => setAnalyse(a => ({ ...a, heure: e.target.value }))} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Responsable chantier</label>
                  <input value={analyse.responsable} onChange={e => setAnalyse(a => ({ ...a, responsable: e.target.value }))}
                    placeholder="Nom prénom" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Entreprise</label>
                  <input value={analyse.entreprise} onChange={e => setAnalyse(a => ({ ...a, entreprise: e.target.value }))}
                    placeholder="Nom de l'entreprise" style={inputStyle} />
                </div>
                <div style={{ gridColumn: '1/-1' }}>
                  <label style={labelStyle}>Intervenants présents</label>
                  <input value={analyse.intervenants} onChange={e => setAnalyse(a => ({ ...a, intervenants: e.target.value }))}
                    placeholder="Noms ou nombre de personnes" style={inputStyle} />
                </div>
              </div>
            </div>

            {/* Type d'intervention */}
            <div className="glass-panel" style={{ padding: 24, marginBottom: 16 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-1)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                <ClipboardList size={16} style={{ color: '#10B981' }} /> Type d'intervention
              </div>
              <div className="r-grid-3">
                {TYPES_INTERVENTION.map(t => {
                  const active = analyse.typeIntervention === t.value;
                  return (
                    <button key={t.value} onClick={() => setAnalyse(a => ({ ...a, typeIntervention: a.typeIntervention === t.value ? '' : t.value }))} style={{
                      padding: '12px 14px', borderRadius: 12, textAlign: 'left', cursor: 'pointer', transition: 'all 0.15s',
                      border: `1.5px solid ${active ? '#10B981' : 'var(--border-2)'}`,
                      background: active ? 'rgba(16,185,129,0.12)' : 'var(--bg-card-2)',
                    }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: active ? '#10B981' : 'var(--text-1)', marginBottom: 3 }}>{t.label}</div>
                      <div style={{ fontSize: 11, color: active ? '#10B981' : 'var(--text-4)', opacity: 0.85 }}>{t.desc}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Type de chantier par secteur */}
            <div className="glass-panel" style={{ padding: 24, marginBottom: 16 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-1)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                <HardHat size={16} style={{ color: '#F97316' }} /> Secteur & Type de travaux
              </div>
              {SECTEURS_CHANTIER.map(s => (
                <div key={s.secteur} style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: s.color, marginBottom: 8, letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ height: 1, width: 16, background: s.color, opacity: 0.5 }} />
                    {s.secteur}
                    <div style={{ height: 1, flex: 1, background: s.color, opacity: 0.2 }} />
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
                    {s.types.map(t => {
                      const active = analyse.type === t;
                      return (
                        <button key={t} onClick={() => setAnalyse(a => ({ ...a, type: a.type === t ? '' : t, typeCustom: a.type === t ? '' : a.typeCustom }))} style={{
                          padding: '6px 13px', borderRadius: 20, cursor: 'pointer', transition: 'all 0.15s', fontSize: 12.5, fontWeight: 600,
                          border: `1.5px solid ${active ? s.color : 'var(--border-2)'}`,
                          background: active ? `${s.color}22` : 'transparent',
                          color: active ? s.color : 'var(--text-3)',
                        }}>
                          {t}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
              {/* Champ personnalisé si "Autre" sélectionné */}
              {analyse.type === 'Autre (préciser)' && (
                <div style={{ marginTop: 8 }}>
                  <input value={analyse.typeCustom} onChange={e => setAnalyse(a => ({ ...a, typeCustom: e.target.value }))}
                    placeholder="Précisez le type de travaux..."
                    style={{ ...inputStyle, borderColor: '#EC4899' }} autoFocus />
                </div>
              )}
              {/* Feature 5: Notification catégories prioritaires */}
              {priorityCats.length > 0 && (
                <div style={{
                  marginTop: 14, padding: '10px 14px',
                  background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.35)',
                  borderRadius: 10, display: 'flex', alignItems: 'center', gap: 8
                }}>
                  <span style={{ fontSize: 16 }}>⚡</span>
                  <span style={{ fontSize: 13, color: '#F59E0B', fontWeight: 600 }}>
                    {priorityCats.length} catégorie{priorityCats.length > 1 ? 's' : ''} de risques prioritaires identifiée{priorityCats.length > 1 ? 's' : ''} pour ce type de chantier
                  </span>
                </div>
              )}
            </div>

            {/* Environnement du site */}
            <div className="glass-panel" style={{ padding: 24, marginBottom: 16 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-1)', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
                <MapPin size={16} style={{ color: '#8B5CF6' }} /> Environnement du site
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-4)', marginBottom: 14 }}>Plusieurs choix possibles</div>
              <div className="r-grid-5">
                {ENVIRONNEMENTS_SITE.map(e => {
                  const active = (analyse.environnement || []).includes(e.value);
                  return (
                    <button key={e.value} onClick={() => setAnalyse(a => {
                      const env = a.environnement || [];
                      return { ...a, environnement: active ? env.filter(x => x !== e.value) : [...env, e.value] };
                    })} style={{
                      padding: '10px 8px', borderRadius: 10, cursor: 'pointer', transition: 'all 0.15s', textAlign: 'center',
                      border: `1.5px solid ${active ? e.color : 'var(--border-2)'}`,
                      background: active ? `${e.color}20` : 'var(--bg-card-2)',
                      color: active ? e.color : 'var(--text-3)', fontSize: 11.5, fontWeight: 600, lineHeight: 1.35
                    }}>
                      {e.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Météo */}
            <div className="glass-panel" style={{ padding: 24 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-1)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                <CloudRain size={16} style={{ color: '#06B6D4' }} /> Conditions météorologiques
              </div>
              <div className="r-grid-4" style={{ marginBottom: 14 }}>
                {METEO_OPTIONS.map(m => (
                  <button key={m.value} onClick={() => setAnalyse(a => ({ ...a, meteo: a.meteo === m.value ? '' : m.value }))} style={{
                    padding: '10px 8px', borderRadius: 10, border: `1.5px solid ${analyse.meteo === m.value ? m.color : 'var(--border-2)'}`,
                    background: analyse.meteo === m.value ? `${m.color}20` : 'var(--bg-card-2)',
                    color: analyse.meteo === m.value ? m.color : 'var(--text-3)', fontSize: 12, fontWeight: 600,
                    cursor: 'pointer', transition: 'all 0.15s', textAlign: 'center'
                  }}>
                    {m.label}
                  </button>
                ))}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Thermometer size={15} style={{ color: 'var(--text-3)' }} />
                <input value={analyse.temperature} onChange={e => setAnalyse(a => ({ ...a, temperature: e.target.value }))}
                  placeholder="Température (°C)"
                  style={{ width: 180, ...inputStyle }} />
              </div>
            </div>
          </div>
        )}

        {/* ── STEP 2 : Analyse risques ── */}
        {step === 2 && (
          <div>
            {/* Progress bar global */}
            <div className="glass-panel" style={{ padding: '14px 18px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 600 }}>Progression</span>
                  <span style={{ fontSize: 12, color: 'var(--text-2)', fontWeight: 700 }}>{answered}/{totalQ} questions répondues</span>
                </div>
                <div style={{ height: 8, background: 'var(--border)', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${(answered / totalQ) * 100}%`, background: 'linear-gradient(90deg,var(--blue),#10B981)', borderRadius: 4, transition: 'width 0.3s' }} />
                </div>
              </div>
              <div style={{ textAlign: 'center', flexShrink: 0 }}>
                <BadgeRisque niveau={niveau} />
                <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>Score : {score}/25</div>
              </div>
            </div>

            {CATEGORIES.map(cat => (
              <CategorieSection
                key={cat.id}
                cat={cat}
                reponses={analyse.reponses}
                observations={analyse.observations}
                photos={analyse.photos}
                onChange={updateReponse}
                onObservation={updateObservation}
                onPhoto={updatePhoto}
                prioritaire={priorityCats.includes(cat.id)}
              />
            ))}
          </div>
        )}

        {/* ── STEP 3 : Actions préventives ── */}
        {step === 3 && (
          <div>
            {nonConformes > 0 && (
              <div style={{
                padding: '14px 18px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
                borderRadius: 12, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10
              }}>
                <AlertCircle size={18} style={{ color: '#EF4444', flexShrink: 0 }} />
                <div style={{ fontSize: 13, color: '#EF4444' }}>
                  <strong>{nonConformes} point{nonConformes > 1 ? 's' : ''} non-conforme{nonConformes > 1 ? 's' : ''}</strong> identifié{nonConformes > 1 ? 's' : ''}. Définissez les actions correctives ci-dessous.
                </div>
              </div>
            )}

            <div className="glass-panel" style={{ padding: 24, marginBottom: 20 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-1)', marginBottom: 18, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Plus size={16} style={{ color: '#10B981' }} /> Ajouter une action préventive
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                <div style={{ gridColumn: '1/-1' }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-3)', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Action à mettre en place *</label>
                  <input value={nouvelleAction.action} onChange={e => setNouvelleAction(a => ({ ...a, action: e.target.value }))}
                    placeholder="Description de l'action préventive ou corrective"
                    onKeyDown={e => e.key === 'Enter' && addAction()}
                    style={{ width: '100%', background: 'var(--input-bg)', border: '1px solid var(--input-border)', borderRadius: 10, padding: '10px 14px', fontSize: 14, color: 'var(--text-1)', outline: 'none', fontFamily: 'inherit' }} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-3)', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Responsable</label>
                  <input value={nouvelleAction.responsable} onChange={e => setNouvelleAction(a => ({ ...a, responsable: e.target.value }))}
                    placeholder="Nom du responsable"
                    style={{ width: '100%', background: 'var(--input-bg)', border: '1px solid var(--input-border)', borderRadius: 10, padding: '10px 14px', fontSize: 14, color: 'var(--text-1)', outline: 'none', fontFamily: 'inherit' }} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-3)', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Délai</label>
                  <input type="date" value={nouvelleAction.delai} onChange={e => setNouvelleAction(a => ({ ...a, delai: e.target.value }))}
                    style={{ width: '100%', background: 'var(--input-bg)', border: '1px solid var(--input-border)', borderRadius: 10, padding: '10px 14px', fontSize: 14, color: 'var(--text-1)', outline: 'none', fontFamily: 'inherit' }} />
                </div>
              </div>
              <button onClick={addAction} style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px',
                background: 'linear-gradient(135deg,#10B981,#059669)', border: 'none', borderRadius: 10,
                color: 'white', fontSize: 13, fontWeight: 700, cursor: 'pointer'
              }}>
                <Plus size={15} /> Ajouter l'action
              </button>
            </div>

            {/* Liste actions */}
            {analyse.actionsPreventives.length === 0 ? (
              <div className="glass-panel" style={{ padding: 32, textAlign: 'center' }}>
                <Shield size={36} style={{ color: 'var(--text-4)', margin: '0 auto 12px' }} />
                <div style={{ fontSize: 14, color: 'var(--text-3)' }}>Aucune action définie pour l'instant</div>
                <div style={{ fontSize: 12, color: 'var(--text-4)', marginTop: 4 }}>Ajoutez des mesures préventives ou correctives ci-dessus</div>
              </div>
            ) : (
              <div className="glass-panel" style={{ padding: 20 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-1)', marginBottom: 14 }}>
                  {analyse.actionsPreventives.length} action{analyse.actionsPreventives.length > 1 ? 's' : ''} définie{analyse.actionsPreventives.length > 1 ? 's' : ''}
                </div>
                {analyse.actionsPreventives.map((a, i) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 14px',
                    background: 'rgba(16,185,129,0.07)', border: '1px solid rgba(16,185,129,0.2)',
                    borderRadius: 10, marginBottom: 8
                  }}>
                    <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'rgba(16,185,129,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                      <span style={{ fontSize: 11, color: '#10B981', fontWeight: 800 }}>{i + 1}</span>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13.5, color: 'var(--text-1)', fontWeight: 600 }}>{a.action}</div>
                      {(a.responsable || a.delai) && (
                        <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 4, display: 'flex', gap: 12 }}>
                          {a.responsable && <span>👤 {a.responsable}</span>}
                          {a.delai && <span>📅 {a.delai}</span>}
                        </div>
                      )}
                    </div>
                    <button onClick={() => removeAction(i)} style={{
                      width: 28, height: 28, borderRadius: 7, border: 'none',
                      background: 'rgba(239,68,68,0.15)', color: '#EF4444', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                    }}>
                      <X size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Feature 2: Signature numérique en bas du step 3 */}
            <div className="glass-panel" style={{ padding: 24, marginTop: 20 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-1)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
                <FileText size={16} style={{ color: 'var(--blue)' }} /> Signature
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-4)', marginBottom: 4 }}>
                Signez pour valider l'analyse
              </div>
              <SignaturePad
                value={analyse.signature}
                onChange={v => setAnalyse(a => ({ ...a, signature: v }))}
              />
            </div>
          </div>
        )}

        {/* ── STEP 4 : Synthèse ── */}
        {step === 4 && (
          <div>
            <Synthese analyse={analyse} />
          </div>
        )}

        {/* Navigation bas */}
        <div className="bottom-nav">
          <button onClick={() => step > 1 ? setStep(s => s - 1) : setVue('liste')} style={{
            display: 'flex', alignItems: 'center', gap: 7, padding: '11px 20px',
            background: 'var(--bg-card-2)', border: '1px solid var(--border)', borderRadius: 10,
            color: 'var(--text-2)', cursor: 'pointer', fontSize: 13, fontWeight: 600
          }}>
            <ChevronLeft size={15} /> {step > 1 ? 'Précédent' : 'Annuler'}
          </button>

          {step < 4 ? (
            <button onClick={() => setStep(s => s + 1)} style={{
              display: 'flex', alignItems: 'center', gap: 7, padding: '11px 24px',
              background: 'linear-gradient(135deg,#4F63E7,#3B82F6)', border: 'none', borderRadius: 10,
              color: 'white', cursor: 'pointer', fontSize: 13, fontWeight: 700
            }}>
              Suivant <ChevronRight size={15} />
            </button>
          ) : (
            <button onClick={async () => { await saveAnalyse('termine'); setVue('liste'); }} style={{
              display: 'flex', alignItems: 'center', gap: 7, padding: '11px 24px',
              background: 'linear-gradient(135deg,#10B981,#059669)', border: 'none', borderRadius: 10,
              color: 'white', cursor: 'pointer', fontSize: 14, fontWeight: 700
            }}>
              <CheckCircle size={16} /> Valider et enregistrer
            </button>
          )}
        </div>
      </div>
    );
  }

  // ── Vue Liste ──────────────────────────────────────────────────────────────
  return (
    <div>
      {saving && (
        <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 999, background: 'var(--blue)', color: 'white', borderRadius: 12, padding: '10px 18px', fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, boxShadow: '0 4px 20px rgba(59,130,246,0.4)' }}>
          <div style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,0.4)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          Enregistrement…
        </div>
      )}

      {/* Feature 7: Toast notification */}
      {toast && (
        <div style={{ position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', zIndex: 1000, background: '#10B981', color: 'white', borderRadius: 12, padding: '10px 20px', fontSize: 13, fontWeight: 700, boxShadow: '0 4px 20px rgba(16,185,129,0.4)' }}>
          {toast}
        </div>
      )}

      {/* Feature 8: PWA Banner */}
      {pwaBanner && (
        <div style={{
          padding: '12px 16px', background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.25)',
          borderRadius: 12, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10
        }}>
          <span style={{ fontSize: 20 }}>📱</span>
          <span style={{ flex: 1, fontSize: 13, color: 'var(--blue)', fontWeight: 500 }}>
            App disponible hors-ligne — installez-la depuis votre navigateur
          </span>
          <button onClick={() => {
            setPwaBanner(false);
            try { localStorage.setItem('pwa_banner_dismissed', '1'); } catch {}
          }} style={{
            background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 4, borderRadius: 6
          }}>
            <X size={16} />
          </button>
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
        <div style={{
          width: 52, height: 52, borderRadius: 14, flexShrink: 0,
          background: 'linear-gradient(135deg,rgba(239,68,68,0.25),rgba(245,158,11,0.2))',
          border: '1px solid rgba(239,68,68,0.3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24
        }}>⚠️</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--text-1)', letterSpacing: '-0.3px' }}>Analyse de Risque Chantier</div>
          <div style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 2 }}>Évaluez les risques avant d'intervenir sur site</div>
        </div>
        <button onClick={() => { setAnalyse(getInitialAnalyse()); setStep(1); setVue('nouvelle'); }} style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '11px 22px',
          background: 'linear-gradient(135deg,#EF4444,#DC2626)', border: 'none', borderRadius: 12,
          color: 'white', cursor: 'pointer', fontSize: 14, fontWeight: 700,
          boxShadow: '0 4px 14px rgba(239,68,68,0.35)'
        }}>
          <Plus size={16} /> Nouvelle analyse
        </button>
      </div>

      {/* Stats */}
      {historique.length > 0 && (
        <div className="r-grid-stats">
          {[
            { label: 'Total', val: historique.length, icon: ClipboardList, color: '#3B82F6', bg: 'rgba(59,130,246,0.12)' },
            { label: 'Risque faible', val: historique.filter(h => getNiveauRisque(calcScore(h.reponses)) === 'faible').length, icon: CheckCircle, color: '#10B981', bg: 'rgba(16,185,129,0.12)' },
            { label: 'Risque modéré', val: historique.filter(h => ['modere'].includes(getNiveauRisque(calcScore(h.reponses)))).length, icon: AlertCircle, color: '#F59E0B', bg: 'rgba(245,158,11,0.12)' },
            { label: 'Risque élevé/critique', val: historique.filter(h => ['eleve', 'critique'].includes(getNiveauRisque(calcScore(h.reponses)))).length, icon: AlertTriangle, color: '#EF4444', bg: 'rgba(239,68,68,0.12)' },
          ].map(s => {
            const Icon = s.icon;
            return (
              <div key={s.label} className="glass-panel" style={{ padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Icon size={18} style={{ color: s.color }} />
                </div>
                <div>
                  <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--text-1)' }}>{s.val}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--text-3)' }}>{s.label}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Search */}
      {historique.length > 0 && (
        <div style={{ position: 'relative', marginBottom: 16 }}>
          <Search size={15} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-4)' }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher un chantier..."
            style={{
              width: '100%', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12,
              padding: '11px 14px 11px 40px', fontSize: 14, color: 'var(--text-1)', outline: 'none', fontFamily: 'inherit'
            }}
          />
        </div>
      )}

      {/* Liste */}
      {loading ? (
        <div className="glass-panel" style={{ padding: 60, textAlign: 'center' }}>
          <div style={{ width: 36, height: 36, border: '3px solid var(--border-2)', borderTopColor: 'var(--blue)', borderRadius: '50%', margin: '0 auto 16px', animation: 'spin 0.8s linear infinite' }} />
          <div style={{ fontSize: 14, color: 'var(--text-3)' }}>Chargement des analyses…</div>
        </div>
      ) : filteredHistorique.length === 0 ? (
        <div className="glass-panel" style={{ padding: 60, textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🏗️</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-2)', marginBottom: 8 }}>
            {historique.length === 0 ? 'Aucune analyse pour l\'instant' : 'Aucun résultat'}
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-4)', marginBottom: 24 }}>
            {historique.length === 0 ? 'Créez votre première analyse de risque avant d\'intervenir sur un chantier.' : 'Modifiez votre recherche.'}
          </div>
          {historique.length === 0 && (
            <button onClick={() => { setAnalyse(getInitialAnalyse()); setStep(1); setVue('nouvelle'); }} style={{
              display: 'inline-flex', alignItems: 'center', gap: 8, padding: '12px 24px',
              background: 'linear-gradient(135deg,#EF4444,#DC2626)', border: 'none', borderRadius: 12,
              color: 'white', cursor: 'pointer', fontSize: 14, fontWeight: 700
            }}>
              <Plus size={16} /> Créer une analyse
            </button>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filteredHistorique.map(h => (
            <AnalyseCard
              key={h.id}
              analyse={h}
              onView={() => { setAnalyseVue(h); setVue('detail'); }}
              onDelete={() => deleteAnalyse(h.id)}
              onDuplicate={() => duplicateAnalyse(h)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
