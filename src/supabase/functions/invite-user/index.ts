// Edge Function : invite-user
// -----------------------------------------------------------------------------
// Crée un compte utilisateur dans auth.users avec son rôle stocké dans
// user_metadata (role). Protège l'endpoint : seul un appelant authentifié dont
// le rôle est "admin" peut créer un utilisateur.
//
// Variables d'environnement requises (Supabase Dashboard > Edge Functions > Secrets) :
//   - SUPABASE_URL
//   - SUPABASE_ANON_KEY          (pour valider le JWT de l'appelant)
//   - SUPABASE_SERVICE_ROLE_KEY  (pour créer l'utilisateur)
//
// Déploiement :
//   supabase functions deploy invite-user
// -----------------------------------------------------------------------------

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL               = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY          = Deno.env.get("SUPABASE_ANON_KEY")!;
const SUPABASE_SERVICE_ROLE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const ROLES_AUTORISES = ["admin", "responsable_qhse", "direction", "operateur"] as const;
type RoleAutorise = typeof ROLES_AUTORISES[number];

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // ─── 1. Vérification de l'authentification de l'appelant ────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse({ success: false, message: "Authentification requise." }, 401);
    }

    const supabaseAppelant = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user: appelant }, error: errAppelant } = await supabaseAppelant.auth.getUser();
    if (errAppelant || !appelant) {
      return jsonResponse({ success: false, message: "Session invalide ou expirée." }, 401);
    }

    // ─── 2. Vérification du rôle (seul admin peut inviter) ──────────────────
    const roleAppelant = appelant.user_metadata?.role;
    if (roleAppelant !== "admin") {
      return jsonResponse({
        success: false,
        message: "Action réservée aux administrateurs.",
      }, 403);
    }

    // ─── 3. Validation du corps de la requête ───────────────────────────────
    let body: { email?: string; password?: string; nom?: string; role?: string };
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ success: false, message: "Corps JSON invalide." }, 400);
    }

    const { email, password, nom = "", role } = body;

    if (!email || typeof email !== "string" || !email.includes("@")) {
      return jsonResponse({ success: false, message: "Email invalide." }, 400);
    }
    if (!password || typeof password !== "string" || password.length < 8) {
      return jsonResponse({ success: false, message: "Mot de passe trop court (8 caractères minimum)." }, 400);
    }
    if (!role || !ROLES_AUTORISES.includes(role as RoleAutorise)) {
      return jsonResponse({
        success: false,
        message: `Rôle invalide. Valeurs acceptées : ${ROLES_AUTORISES.join(", ")}.`,
      }, 400);
    }

    // ─── 4. Création de l'utilisateur via la Service Role Key ───────────────
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // l'admin est responsable de la vérification
      user_metadata: {
        prenom: nom,
        role,
      },
    });

    if (error) {
      // Cas fréquent : email déjà utilisé
      return jsonResponse({
        success: false,
        message: error.message || "Création impossible.",
      }, 400);
    }

    return jsonResponse({
      success: true,
      message: `Compte créé pour ${email} (rôle : ${role}).`,
      user: { id: data.user?.id, email: data.user?.email },
    });
  } catch (e) {
    return jsonResponse({
      success: false,
      message: `Erreur serveur : ${e instanceof Error ? e.message : String(e)}`,
    }, 500);
  }
});
