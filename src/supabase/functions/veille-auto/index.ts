import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

/* ── Textes réglementaires à vérifier / injecter ─────────────────────────── */
const TEXTES_REFERENCE = [
  {
    titre: "Code du travail - Art. L4121-1 : Obligation générale de sécurité",
    domaine: "Sécurité", source: "Ministère Travail",
    date_parution: "2023-01-01",
    resume: "L'employeur prend les mesures nécessaires pour assurer la sécurité et protéger la santé physique et mentale des travailleurs.",
    url: "https://www.legifrance.gouv.fr", statut: "À analyser", impact: "Élevé", notes: "", archive: false,
  },
  {
    titre: "Décret n°2022-1765 - Évaluation des risques professionnels",
    domaine: "Sécurité", source: "Journal Officiel",
    date_parution: "2022-12-30",
    resume: "Renforcement des obligations de mise à jour du DUERP et de consultation du CSE.",
    url: "https://www.legifrance.gouv.fr", statut: "À analyser", impact: "Élevé", notes: "", archive: false,
  },
  {
    titre: "Loi Climat et Résilience - Obligations environnementales",
    domaine: "Environnement", source: "Journal Officiel",
    date_parution: "2021-08-22",
    resume: "Renforcement des obligations de reporting environnemental et réduction des émissions de GES.",
    url: "https://www.legifrance.gouv.fr", statut: "À analyser", impact: "Élevé", notes: "", archive: false,
  },
  {
    titre: "ISO 45001:2018 - Santé et sécurité au travail",
    domaine: "Santé au travail", source: "ISO/AFNOR",
    date_parution: "2018-03-12",
    resume: "Norme internationale de référence pour les systèmes de management de la santé et sécurité au travail.",
    url: "https://www.iso.org", statut: "À analyser", impact: "Élevé", notes: "", archive: false,
  },
  {
    titre: "Arrêté du 12/01/2024 - Formation SST obligatoire",
    domaine: "Santé au travail", source: "Ministère Travail",
    date_parution: "2024-01-12",
    resume: "Nouvelles modalités de formation et recyclage SST. Recyclage tous les 24 mois.",
    url: "https://www.legifrance.gouv.fr", statut: "À analyser", impact: "Moyen", notes: "", archive: false,
  },
  {
    titre: "Décret ICPE - Installations classées mise à jour",
    domaine: "Environnement", source: "DREAL",
    date_parution: "2024-01-01",
    resume: "Mise à jour des seuils et procédures pour les installations classées pour la protection de l'environnement.",
    url: "https://www.legifrance.gouv.fr", statut: "À analyser", impact: "Élevé", notes: "", archive: false,
  },
  {
    titre: "Loi Travail 2024 - Temps de travail et télétravail",
    domaine: "RH / Social", source: "Journal Officiel",
    date_parution: "2024-02-15",
    resume: "Nouvelles dispositions sur l'organisation du temps de travail et encadrement du télétravail.",
    url: "https://www.legifrance.gouv.fr", statut: "À analyser", impact: "Moyen", notes: "", archive: false,
  },
  {
    titre: "ISO 9001:2015 - Systèmes de management de la qualité",
    domaine: "Qualité", source: "ISO/AFNOR",
    date_parution: "2015-09-15",
    resume: "Exigences pour un système de management de la qualité orienté satisfaction client.",
    url: "https://www.iso.org", statut: "À analyser", impact: "Élevé", notes: "", archive: false,
  },
  {
    titre: "Arrêté du 04/03/2025 - Valeurs limites d'exposition professionnelle",
    domaine: "Santé au travail", source: "Journal Officiel",
    date_parution: "2025-03-04",
    resume: "Mise à jour des VLEP pour les agents chimiques dangereux. Nouvelles valeurs pour 12 substances.",
    url: "https://www.legifrance.gouv.fr", statut: "À analyser", impact: "Élevé", notes: "", archive: false,
  },
  {
    titre: "Décret n°2025-124 - Prévention des risques liés aux chaleurs extrêmes",
    domaine: "Sécurité", source: "Journal Officiel",
    date_parution: "2025-02-01",
    resume: "Nouvelles obligations pour les employeurs en cas de vigilance météo orange/rouge canicule.",
    url: "https://www.legifrance.gouv.fr", statut: "À analyser", impact: "Moyen", notes: "", archive: false,
  },
  {
    titre: "ISO 14001:2015 - Systèmes de management environnemental",
    domaine: "Environnement", source: "ISO/AFNOR",
    date_parution: "2015-09-15",
    resume: "Norme internationale pour la mise en place d'un SME efficace.",
    url: "https://www.iso.org", statut: "À analyser", impact: "Élevé", notes: "", archive: false,
  },
  {
    titre: "Loi n°2024-364 - Partage de la valeur en entreprise",
    domaine: "RH / Social", source: "Journal Officiel",
    date_parution: "2024-04-22",
    resume: "Généralisation de la participation aux bénéfices pour les entreprises de 11 à 49 salariés.",
    url: "https://www.legifrance.gouv.fr", statut: "À analyser", impact: "Moyen", notes: "", archive: false,
  },
];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Récupérer les titres déjà en base
    const { data: existing, error: fetchErr } = await supabase
      .from("veille_reglementaire")
      .select("titre");

    if (fetchErr) {
      return new Response(
        JSON.stringify({ success: false, message: fetchErr.message }),
        { status: 500, headers: corsHeaders }
      );
    }

    const titresExistants = new Set((existing || []).map((r: any) => r.titre));

    // Filtrer les nouveaux textes
    const nouveauxTextes = TEXTES_REFERENCE.filter(
      (t) => !titresExistants.has(t.titre)
    );

    let inseres = 0;
    if (nouveauxTextes.length > 0) {
      const { error: insertErr } = await supabase
        .from("veille_reglementaire")
        .insert(nouveauxTextes);

      if (insertErr) {
        return new Response(
          JSON.stringify({ success: false, message: insertErr.message }),
          { status: 500, headers: corsHeaders }
        );
      }
      inseres = nouveauxTextes.length;
    }

    const message = inseres > 0
      ? `${inseres} nouveau${inseres > 1 ? "x" : ""} texte${inseres > 1 ? "s" : ""} réglementaire${inseres > 1 ? "s" : ""} détecté${inseres > 1 ? "s" : ""} et ajouté${inseres > 1 ? "s" : ""}.`
      : "Veille à jour — aucun nouveau texte détecté.";

    return new Response(
      JSON.stringify({ success: true, nouveaux: inseres, message }),
      { status: 200, headers: corsHeaders }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, message: String(err?.message || err) }),
      { status: 500, headers: corsHeaders }
    );
  }
});
