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

    // Caller's profile + role
    const { data: callerProfile, error: cpErr } = await admin
      .from("profiles")
      .select("agency_id, role")
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
    const isOwner = callerProfile.role === "owner";

    if (!isSuper && !isOwner) {
      return json({ error: "Nur Inhaber dürfen Mitarbeiter anlegen" }, 403);
    }

    const body = await req.json();
    const email = String(body.email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");
    const fullName = String(body.full_name ?? "").trim();
    const phone = String(body.phone ?? "").trim();
    const role = (["owner", "agent", "assistant"].includes(body.role) ? body.role : "agent") as
      | "owner" | "agent" | "assistant";
    const targetAgencyId: string = (isSuper && body.agency_id) ? String(body.agency_id) : callerProfile.agency_id;

    if (!email || !password || password.length < 6) {
      return json({ error: "E-Mail und Passwort (min. 6 Zeichen) erforderlich" }, 400);
    }

    // Create auth user (skip handle_new_user agency creation by setting metadata after — but trigger runs on insert).
    // The handle_new_user trigger will create a NEW agency. We then move the profile to the caller's agency
    // and remove the orphan agency.
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName, agency_name: "__placeholder__" },
    });
    if (createErr || !created.user) return json({ error: createErr?.message ?? "Fehler beim Anlegen" }, 400);

    const newUserId = created.user.id;

    // Find the orphan agency the trigger just created
    const { data: newProfile } = await admin
      .from("profiles")
      .select("agency_id")
      .eq("id", newUserId)
      .single();
    const orphanAgencyId = newProfile?.agency_id;

    // Move profile into target agency with proper role/phone
    const { error: updErr } = await admin
      .from("profiles")
      .update({
        agency_id: targetAgencyId,
        role,
        full_name: fullName || email,
        phone: phone || null,
      })
      .eq("id", newUserId);
    if (updErr) return json({ error: updErr.message }, 400);

    // Delete orphan agency (only if different and unused)
    if (orphanAgencyId && orphanAgencyId !== targetAgencyId) {
      await admin.from("agencies").delete().eq("id", orphanAgencyId);
    }

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
