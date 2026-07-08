// =====================================================================
// Edge Function : veille-auto
// Veille réglementaire QHSE RÉELLE.
//  1. Lit des flux RSS/Atom publics et gratuits de sources QHSE.
//  2. Écarte les doublons (déjà en base) et le hors-sujet (pré-filtre mots-clés).
//  3. Analyse chaque nouveauté avec Claude (Haiku) : pertinence, domaine,
//     résumé, impact.
//  4. Insère les textes pertinents dans la table `veille_reglementaire`.
//
// Contexte métier : ATEXIA Systèmes — installation électrique & sûreté, La Réunion.
//
// Secrets requis (Supabase → Edge Functions → veille-auto → Secrets) :
//   - ANTHROPIC_API_KEY        (clé API Anthropic — à ajouter)
//   - SUPABASE_URL             (fourni automatiquement par Supabase)
//   - SUPABASE_SERVICE_ROLE_KEY(fourni automatiquement par Supabase)
//
// Planification hebdo : Edge Functions → veille-auto → Schedules → `0 8 * * 1`.
// =====================================================================
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { XMLParser } from "https://esm.sh/fast-xml-parser@4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANTHROPIC_KEY = Deno.env.get("ANTHROPIC_API_KEY") ?? "";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Content-Type": "application/json",
};

// ── Sources RSS/Atom (LISTE À MAINTENIR) ──────────────────────────────────
// Les URLs de flux évoluent : si une source ne remonte rien, vérifiez son URL.
// Une source en panne est simplement ignorée (le reste continue).
const FLUX = [
  { source: "INRS",               url: "https://www.inrs.fr/rss/?feed=actualites-inrs" },
  { source: "Actu-Environnement", url: "https://www.actu-environnement.com/ae/rss/news.rss" },
  { source: "Ministère Travail",  url: "https://travail-emploi.gouv.fr/rss.xml" },
  { source: "Service-Public Pro", url: "https://entreprendre.service-public.fr/rss/actualites.rss" },
];

// Mots-clés QHSE — pré-filtre grossier avant l'analyse IA (économise des appels).
const MOTS_CLES = [
  "sécurit", "santé", "travail", "duerp", "risque", "prévention", "accident",
  "environnement", "icpe", "déchet", "pollution", "énergie", "iso", "qualité",
  "réglement", "décret", "arrêté", "loi ", "code du travail", "incendie",
  "électri", "habilitation", "epi", "chantier", "amiante", "rgpd", "cse",
  "vlep", "chimique", "norme",
];

const MAX_ANALYSE = 30;       // nb max de textes analysés par l'IA / exécution
const MAX_PAR_FLUX = 20;      // nb max d'articles lus par flux
const FETCH_TIMEOUT = 12000;  // ms par flux

const DOMAINES = ["Sécurité", "Environnement", "Qualité", "RH / Social", "Énergie", "Santé au travail"];
const IMPACTS = ["Élevé", "Moyen", "Faible"];

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" });

// ── Utilitaires ───────────────────────────────────────────────────────────
function asText(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (Array.isArray(v)) return asText(v[0]);
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    if ("#text" in o) return asText(o["#text"]);
  }
  return String(v);
}

function stripHtml(s: string): string {
  return s.replace(/<[^>]*>/g, " ").replace(/&[a-z]+;/gi, " ").replace(/\s+/g, " ").trim();
}

function extraireLien(item: Record<string, unknown>): string {
  // RSS : <link>texte</link>. Atom : <link href="..."/> (parfois plusieurs).
  const l = item.link;
  if (typeof l === "string") return l.trim();
  if (Array.isArray(l)) {
    const alt = l.find((x: Record<string, unknown>) => x?.["@_rel"] === "alternate") || l[0];
    return String((alt as Record<string, unknown>)?.["@_href"] || "").trim();
  }
  if (l && typeof l === "object") return String((l as Record<string, unknown>)["@_href"] || "").trim();
  return asText(item.guid).trim();
}

function toDateISO(s: string): string | null {
  if (!s) return null;
  const t = Date.parse(s);
  if (Number.isNaN(t)) return null;
  return new Date(t).toISOString().slice(0, 10);
}

// Récupère et normalise les articles d'un flux (RSS ou Atom).
async function lireFlux(url: string): Promise<Array<{ titre: string; url: string; date: string | null; extrait: string }>> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT);
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { "User-Agent": "QHSE-Veille/1.0" } });
    if (!res.ok) return [];
    const xml = await res.text();
    const doc = parser.parse(xml);

    let items: Record<string, unknown>[] = [];
    if (doc?.rss?.channel?.item) items = [].concat(doc.rss.channel.item);
    else if (doc?.feed?.entry) items = [].concat(doc.feed.entry);
    else if (doc?.["rdf:RDF"]?.item) items = [].concat(doc["rdf:RDF"].item);

    return items.slice(0, MAX_PAR_FLUX).map((it) => ({
      titre: stripHtml(asText(it.title)),
      url: extraireLien(it),
      date: toDateISO(asText(it.pubDate) || asText(it.published) || asText(it.updated) || asText(it["dc:date"])),
      extrait: stripHtml(asText(it.description) || asText(it.summary) || asText(it["content:encoded"])).slice(0, 800),
    })).filter((x) => x.titre);
  } catch {
    return []; // flux injoignable / timeout : on ignore
  } finally {
    clearTimeout(timer);
  }
}

function passeMotsCles(titre: string, extrait: string): boolean {
  const t = (titre + " " + extrait).toLowerCase();
  return MOTS_CLES.some((m) => t.includes(m));
}

function extraireJson(txt: string): string {
  const a = txt.indexOf("{");
  const b = txt.lastIndexOf("}");
  return a >= 0 && b > a ? txt.slice(a, b + 1) : txt;
}

// Analyse IA d'un article → { pertinent, domaine, resume, impact }.
async function analyser(titre: string, extrait: string): Promise<{ pertinent: boolean; domaine: string; resume: string; impact: string } | null> {
  const prompt =
    "Tu es un assistant de veille réglementaire QHSE pour une PME (ATEXIA Systèmes, " +
    "installation électrique et sûreté, à La Réunion). Analyse cet article issu d'un flux " +
    "d'actualité et réponds UNIQUEMENT par un objet JSON, sans aucun texte autour.\n\n" +
    `Titre : ${titre}\n` +
    `Extrait : ${extrait || "(aucun)"}\n\n` +
    "Format attendu :\n" +
    "{\n" +
    '  "pertinent": true ou false,  // true uniquement si c\'est une actualité réglementaire ou ' +
    "normative QHSE réellement utile (sécurité, santé au travail, environnement, qualité, énergie, " +
    "RH/social). false si hors sujet (marketing, événement, offre d'emploi, publicité...).\n" +
    '  "domaine": un de "Sécurité","Environnement","Qualité","RH / Social","Énergie","Santé au travail",\n' +
    '  "resume": un résumé factuel en 1 à 2 phrases, en français,\n' +
    '  "impact": un de "Élevé","Moyen","Faible"\n' +
    "}";

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": ANTHROPIC_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5",
      max_tokens: 400,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) throw new Error(`Anthropic ${res.status} : ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  const txt = (data.content || []).filter((b: Record<string, unknown>) => b.type === "text").map((b: Record<string, unknown>) => b.text).join("");
  try {
    const j = JSON.parse(extraireJson(txt));
    return {
      pertinent: !!j.pertinent,
      domaine: DOMAINES.includes(j.domaine) ? j.domaine : "Sécurité",
      resume: String(j.resume || "").slice(0, 600),
      impact: IMPACTS.includes(j.impact) ? j.impact : "Moyen",
    };
  } catch {
    return null; // JSON illisible : on ignore cet article
  }
}

// ── Point d'entrée ────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    if (!ANTHROPIC_KEY) {
      return new Response(
        JSON.stringify({ success: false, message: "Secret ANTHROPIC_API_KEY manquant sur la fonction veille-auto." }),
        { status: 200, headers: corsHeaders },
      );
    }

    // 1. Textes déjà en base (dédoublonnage par titre + url)
    const { data: existants, error: errFetch } = await supabase
      .from("veille_reglementaire").select("titre, url");
    if (errFetch) {
      return new Response(JSON.stringify({ success: false, message: errFetch.message }), { status: 200, headers: corsHeaders });
    }
    const titresVus = new Set((existants || []).map((r: { titre: string }) => (r.titre || "").trim().toLowerCase()));
    const urlsVues = new Set((existants || []).map((r: { url: string }) => (r.url || "").trim()));

    // 2. Lecture de tous les flux
    const lots = await Promise.all(FLUX.map((f) => lireFlux(f.url).then((arts) => ({ source: f.source, arts }))));
    const sourcesOk = lots.filter((l) => l.arts.length > 0).length;

    // 3. Sélection des nouveautés pertinentes (dédoublonnage + pré-filtre)
    let doublons = 0;
    const candidats: Array<{ source: string; titre: string; url: string; date: string | null; extrait: string }> = [];
    const vusRun = new Set<string>();
    for (const lot of lots) {
      for (const a of lot.arts) {
        const cleTitre = a.titre.trim().toLowerCase();
        const cle = a.url || cleTitre;
        if (vusRun.has(cle)) continue;
        vusRun.add(cle);
        if (titresVus.has(cleTitre) || (a.url && urlsVues.has(a.url))) { doublons++; continue; }
        if (!passeMotsCles(a.titre, a.extrait)) continue;
        candidats.push({ source: lot.source, ...a });
      }
    }
    const aAnalyser = candidats.slice(0, MAX_ANALYSE);
    const ignoresVolume = candidats.length - aAnalyser.length;

    // 4. Analyse IA + insertion
    const nouvelles: Record<string, unknown>[] = [];
    const today = new Date().toISOString().slice(0, 10);
    for (const c of aAnalyser) {
      let a;
      try { a = await analyser(c.titre, c.extrait); } catch { a = null; }
      if (!a || !a.pertinent) continue;
      nouvelles.push({
        titre: c.titre,
        domaine: a.domaine,
        source: c.source,
        date_parution: c.date,
        resume: a.resume,
        url: c.url,
        statut: "À analyser",
        impact: a.impact,
        notes: "",
        archive: false,
        date_detection: today,
      });
    }

    let inseres = 0;
    if (nouvelles.length > 0) {
      const { error: errIns } = await supabase.from("veille_reglementaire").insert(nouvelles);
      if (errIns) {
        return new Response(JSON.stringify({ success: false, message: errIns.message }), { status: 200, headers: corsHeaders });
      }
      inseres = nouvelles.length;
    }

    const message = inseres > 0
      ? `${inseres} nouveau${inseres > 1 ? "x" : ""} texte${inseres > 1 ? "s" : ""} réglementaire${inseres > 1 ? "s" : ""} détecté${inseres > 1 ? "s" : ""}.`
      : "Veille à jour — aucun nouveau texte pertinent détecté."
        + (ignoresVolume > 0 ? ` (${ignoresVolume} articles au-delà de la limite non analysés)` : "");

    return new Response(
      JSON.stringify({ success: true, nouveaux: inseres, doublons, sources: sourcesOk, message }),
      { status: 200, headers: corsHeaders },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ success: false, message: String((err as Error)?.message || err) }),
      { status: 200, headers: corsHeaders },
    );
  }
});
