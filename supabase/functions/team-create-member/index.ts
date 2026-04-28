import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Nicht autorisiert" }, 401);

    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) return json({ error: "Nicht autorisiert" }, 401);

    const admin = createClient(url, service);

    const { data: callerProfile, error: cpErr } = await admin
      .from("profiles")
      .select("role")
      .eq("id", userData.user.id)
      .single();
    if (cpErr || !callerProfile) return json({ error: "Profil nicht gefunden" }, 400);

    const { data: superRow } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id)
      .eq("role", "superadmin")
      .maybeSingle();
    const isSuper = !!superRow;
    const isOwnerOrAdmin = callerProfile.role === "owner" || callerProfile.role === "admin";

    if (!isSuper && !isOwnerOrAdmin) {
      return json({ error: "Nur Inhaber/Admin dürfen Mitarbeiter anlegen" }, 403);
    }

    const body = await req.json();
    const email = String(body.email ?? "").trim().toLowerCase();
    const fullName = String(body.full_name ?? "").trim();
    const phone = String(body.phone ?? "").trim();
    const role = (["owner", "agent", "assistant"].includes(body.role) ? body.role : "agent") as
      | "owner" | "agent" | "assistant";
    const redirectTo = String(body.redirect_to ?? "");

    if (!email) return json({ error: "E-Mail erforderlich" }, 400);
    if (!redirectTo) return json({ error: "redirect_to fehlt" }, 400);

    // Send invitation email — user clicks link and sets their own password
    const { data: invited, error: inviteErr } = await admin.auth.admin.inviteUserByEmail(email, {
      redirectTo,
      data: { full_name: fullName },
    });
    if (inviteErr || !invited.user) {
      return json({ error: inviteErr?.message ?? "Einladung konnte nicht gesendet werden" }, 400);
    }

    const newUserId = invited.user.id;

    const { error: updErr } = await admin
      .from("profiles")
      .update({
        role,
        full_name: fullName || email,
        phone: phone || null,
      })
      .eq("id", newUserId);
    if (updErr) return json({ error: updErr.message }, 400);

    return json({ ok: true, user_id: newUserId });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}
