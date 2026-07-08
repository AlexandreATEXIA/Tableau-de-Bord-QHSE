// =====================================================================
// Edge Function : analyse-qhse
// Reçoit les KPI déjà calculés par l'application (module Rapports), les
// fait analyser par Mistral, et renvoie une analyse structurée :
//   { synthese_generale, points_forts[], points_vigilance[], recommandations[] }
// Le front assemble ensuite un document Word.
//
// Secret requis : MISTRAL_API_KEY (partagé au niveau du projet Supabase).
// =====================================================================
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const MISTRAL_KEY = Deno.env.get("MISTRAL_API_KEY") ?? "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

function extraireJson(txt: string): string {
  const a = txt.indexOf("{");
  const b = txt.lastIndexOf("}");
  return a >= 0 && b > a ? txt.slice(a, b + 1) : txt;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    if (!MISTRAL_KEY) {
      return new Response(
        JSON.stringify({ success: false, message: "Secret MISTRAL_API_KEY manquant sur la fonction." }),
        { status: 200, headers: corsHeaders },
      );
    }

    const body = await req.json().catch(() => ({}));
    const synthese = body?.synthese ?? {};
    const entreprise = body?.entreprise || "l'entreprise";
    const annee = body?.annee || new Date().getFullYear();

    const prompt =
      `Tu es un consultant QHSE expérimenté. Voici les indicateurs (KPI) du tableau de bord ` +
      `QHSE de « ${entreprise} » (PME d'installation électrique et de sûreté, à La Réunion) ` +
      `pour l'année ${annee}, au format JSON :\n\n` +
      "```json\n" + JSON.stringify(synthese, null, 2) + "\n```\n\n" +
      "Rédige une analyse claire, professionnelle et factuelle, en français. " +
      "Base-toi UNIQUEMENT sur les chiffres fournis (cite les valeurs quand c'est utile). " +
      "Réponds UNIQUEMENT par un objet JSON, sans aucun texte autour, de la forme :\n" +
      "{\n" +
      '  "synthese_generale": "2 à 4 phrases résumant la performance QHSE globale",\n' +
      '  "points_forts": ["...", "..."],        // ce qui va bien (3 à 6 éléments)\n' +
      '  "points_vigilance": ["...", "..."],     // ce qui ne va pas / à surveiller (3 à 6 éléments)\n' +
      '  "recommandations": ["...", "..."]       // actions prioritaires concrètes (3 à 6 éléments)\n' +
      "}";

    const res = await fetch("https://api.mistral.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "authorization": `Bearer ${MISTRAL_KEY}`,
      },
      body: JSON.stringify({
        model: "mistral-small-latest",
        max_tokens: 2000,
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!res.ok) {
      return new Response(
        JSON.stringify({ success: false, message: `Mistral ${res.status} : ${(await res.text()).slice(0, 200)}` }),
        { status: 200, headers: corsHeaders },
      );
    }
    const data = await res.json();
    const txt = data?.choices?.[0]?.message?.content ?? "";

    let analyse;
    try {
      const j = JSON.parse(extraireJson(txt));
      analyse = {
        synthese_generale: String(j.synthese_generale || ""),
        points_forts: Array.isArray(j.points_forts) ? j.points_forts.map(String) : [],
        points_vigilance: Array.isArray(j.points_vigilance) ? j.points_vigilance.map(String) : [],
        recommandations: Array.isArray(j.recommandations) ? j.recommandations.map(String) : [],
      };
    } catch {
      return new Response(
        JSON.stringify({ success: false, message: "Réponse IA illisible, réessayez." }),
        { status: 200, headers: corsHeaders },
      );
    }

    return new Response(JSON.stringify({ success: true, analyse }), { status: 200, headers: corsHeaders });
  } catch (err) {
    return new Response(
      JSON.stringify({ success: false, message: String((err as Error)?.message || err) }),
      { status: 200, headers: corsHeaders },
    );
  }
});
