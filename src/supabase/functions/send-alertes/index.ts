import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const SUPABASE_URL   = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_KEY   = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const EMAIL_DEST     = Deno.env.get("EMAIL_DESTINATAIRE")!;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function calculerExpiration(dateObtention, validiteAns) {
  const d = new Date(dateObtention);
  d.setFullYear(d.getFullYear() + Number(validiteAns));
  return d.toISOString().split("T")[0];
}

function diffJours(dateStr) {
  return Math.ceil((new Date(dateStr).getTime() - new Date().getTime()) / 86400000);
}

serve(async (req) => {
  try {
    const [r1, r2] = await Promise.all([
      supabase.from("plan_actions").select("id,action,pilote,echeance,statut"),
      supabase.from("habilitations").select("id,employe,domaine,obtention,validiteAns"),
    ]);

    const actions       = r1.data || [];
    const habilitations = r2.data || [];

    const actionsRetard = actions.filter(a =>
      a.echeance && !a.statut?.includes("Terminé") && !a.statut?.includes("Annulé") && diffJours(a.echeance) < 0
    );
    const actionsImminent = actions.filter(a => {
      if (!a.echeance || a.statut?.includes("Terminé") || a.statut?.includes("Annulé")) return false;
      const d = diffJours(a.echeance);
      return d >= 0 && d <= 7;
    });
    const habsPerimees = habilitations.filter(h =>
      h.obtention && diffJours(calculerExpiration(h.obtention, h.validiteAns)) < 0
    );
    const habsBientot = habilitations.filter(h => {
      if (!h.obtention) return false;
      const d = diffJours(calculerExpiration(h.obtention, h.validiteAns));
      return d >= 0 && d <= 30;
    });

    const total = actionsRetard.length + actionsImminent.length + habsPerimees.length + habsBientot.length;

    if (total === 0) {
      return new Response(JSON.stringify({ message: "Aucune alerte — email non envoyé" }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    const date = new Date().toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });

    const ligneAction = (a, couleur) => `
      <tr>
        <td style="padding:8px 12px;border-bottom:1px solid #1e293b;color:#cbd5e1;font-size:13px;">${a.action?.substring(0,50) || "—"}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #1e293b;color:#94a3b8;font-size:13px;">${a.pilote || "—"}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #1e293b;font-size:13px;">
          <span style="background:${couleur}20;color:${couleur};padding:2px 8px;border-radius:4px;font-weight:700;font-size:11px;">${a.echeance || "—"}</span>
        </td>
      </tr>`;

    const ligneHab = (h, couleur) => {
      const exp = calculerExpiration(h.obtention, h.validiteAns);
      return `
      <tr>
        <td style="padding:8px 12px;border-bottom:1px solid #1e293b;color:#cbd5e1;font-size:13px;">${h.employe || "—"}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #1e293b;color:#94a3b8;font-size:13px;">${h.domaine?.substring(0,45) || "—"}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #1e293b;font-size:13px;">
          <span style="background:${couleur}20;color:${couleur};padding:2px 8px;border-radius:4px;font-weight:700;font-size:11px;">${exp}</span>
        </td>
      </tr>`;
    };

    const html = `<!DOCTYPE html>
<html lang="fr"><head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#0B1120;font-family:'Segoe UI',Arial,sans-serif;">
<div style="max-width:640px;margin:0 auto;padding:32px 24px;">
  <div style="background:#1e293b;border-radius:12px;padding:24px 28px;margin-bottom:20px;border:1px solid #334155;">
    <div style="font-size:11px;font-weight:700;color:#3b82f6;text-transform:uppercase;margin-bottom:8px;">DEF Réunion — SMI Dashboard Pro</div>
    <div style="font-size:22px;font-weight:900;color:#fff;">Rapport d'alertes QHSE</div>
    <div style="font-size:13px;color:#64748b;margin-top:4px;">${date}</div>
    <div style="margin-top:14px;display:inline-block;background:#ef444420;border:1px solid #ef444440;border-radius:8px;padding:6px 14px;color:#f87171;font-weight:700;font-size:13px;">
      ${total} alerte${total > 1 ? "s" : ""} active${total > 1 ? "s" : ""}
    </div>
  </div>
  ${actionsRetard.length > 0 ? `
  <div style="margin-bottom:20px;">
    <div style="background:#ef444415;border:1px solid #ef444440;border-radius:10px;padding:12px 16px;margin-bottom:10px;">
      <strong style="color:#ef4444;">${actionsRetard.length} action${actionsRetard.length > 1 ? "s" : ""} PDCA en retard</strong>
    </div>
    <table style="width:100%;border-collapse:collapse;background:#1e293b;border-radius:8px;overflow:hidden;">
      <thead><tr style="background:#0f172a;">
        <th style="padding:10px 12px;text-align:left;color:#64748b;font-size:11px;text-transform:uppercase;">Action</th>
        <th style="padding:10px 12px;text-align:left;color:#64748b;font-size:11px;text-transform:uppercase;">Pilote</th>
        <th style="padding:10px 12px;text-align:left;color:#64748b;font-size:11px;text-transform:uppercase;">Échéance</th>
      </tr></thead>
      <tbody>${actionsRetard.map(a => ligneAction(a, "#ef4444")).join("")}</tbody>
    </table>
  </div>` : ""}
  ${habsPerimees.length > 0 ? `
  <div style="margin-bottom:20px;">
    <div style="background:#ef444415;border:1px solid #ef444440;border-radius:10px;padding:12px 16px;margin-bottom:10px;">
      <strong style="color:#ef4444;">${habsPerimees.length} habilitation${habsPerimees.length > 1 ? "s" : ""} périmée${habsPerimees.length > 1 ? "s" : ""}</strong>
    </div>
    <table style="width:100%;border-collapse:collapse;background:#1e293b;border-radius:8px;overflow:hidden;">
      <thead><tr style="background:#0f172a;">
        <th style="padding:10px 12px;text-align:left;color:#64748b;font-size:11px;text-transform:uppercase;">Employé</th>
        <th style="padding:10px 12px;text-align:left;color:#64748b;font-size:11px;text-transform:uppercase;">Habilitation</th>
        <th style="padding:10px 12px;text-align:left;color:#64748b;font-size:11px;text-transform:uppercase;">Expirée le</th>
      </tr></thead>
      <tbody>${habsPerimees.map(h => ligneHab(h, "#ef4444")).join("")}</tbody>
    </table>
  </div>` : ""}
  <div style="margin-top:28px;padding-top:16px;border-top:1px solid #1e293b;color:#475569;font-size:11px;">
    DEF Réunion — SMI Dashboard Pro — Email généré automatiquement
  </div>
</div>
</body></html>`;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from:    "QHSE Dashboard <alertes@resend.dev>",
        to:      [EMAIL_DEST],
        subject: `SMI Dashboard — ${total} alerte${total > 1 ? "s" : ""} QHSE du ${date}`,
        html:    html,
      }),
    });

    const result = await res.json();

    return new Response(JSON.stringify({ success: true, alertes: total, resend: result }), {
      headers: { "Content-Type": "application/json" },
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});