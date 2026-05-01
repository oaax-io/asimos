import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

function genPassword(len = 14) {
  const charset = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%&*";
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  let out = "";
  for (let i = 0; i < len; i++) out += charset[bytes[i] % charset.length];
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Nicht autorisiert" }, 401);

    const url = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(url, anon, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) return json({ error: "Nicht autorisiert" }, 401);

    const admin = createClient(url, service);

    // Caller-Berechtigung prüfen
    const { data: callerProfile } = await admin
      .from("profiles")
      .select("role")
      .eq("id", userData.user.id)
      .single();

    const { data: superRow } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id)
      .eq("role", "superadmin")
      .maybeSingle();

    const isSuper = !!superRow;
    const isOwnerOrAdmin =
      callerProfile?.role === "owner" || callerProfile?.role === "admin";

    if (!isSuper && !isOwnerOrAdmin) {
      return json({ error: "Keine Berechtigung" }, 403);
    }

    const body = await req.json();
    const action = String(body.action ?? "");
    const userId = String(body.user_id ?? "");
    if (!userId) return json({ error: "user_id fehlt" }, 400);

    // ===== Profil-Update =====
    if (action === "update_profile") {
      const updates: Record<string, unknown> = {};
      if (typeof body.full_name === "string") updates.full_name = body.full_name.trim() || null;
      if (typeof body.phone === "string") updates.phone = body.phone.trim() || null;
      if (typeof body.email === "string" && body.email.trim()) updates.email = body.email.trim().toLowerCase();
      if (typeof body.role === "string" && ["owner", "admin", "agent", "assistant", "manager"].includes(body.role)) {
        updates.role = body.role;
      }
      if (typeof body.is_active === "boolean") updates.is_active = body.is_active;

      // Nur Superadmin darf Rollen owner/admin setzen
      if (!isSuper && (updates.role === "owner" || updates.role === "admin")) {
        return json({ error: "Nur Superadmin darf diese Rolle vergeben" }, 403);
      }

      if (Object.keys(updates).length > 0) {
        const { error: profErr } = await admin.from("profiles").update(updates).eq("id", userId);
        if (profErr) return json({ error: profErr.message }, 400);
      }

      // E-Mail auch im Auth aktualisieren
      if (typeof body.email === "string" && body.email.trim()) {
        const { error: authErr } = await admin.auth.admin.updateUserById(userId, {
          email: body.email.trim().toLowerCase(),
          email_confirm: true,
        });
        if (authErr) return json({ error: authErr.message }, 400);
      }

      return json({ ok: true });
    }

    // ===== Passwort setzen oder generieren =====
    if (action === "set_password") {
      let password = String(body.password ?? "");
      if (!password) password = genPassword();
      if (password.length < 8) return json({ error: "Passwort muss mind. 8 Zeichen haben" }, 400);

      const { error: pwErr } = await admin.auth.admin.updateUserById(userId, { password });
      if (pwErr) return json({ error: pwErr.message }, 400);

      return json({ ok: true, password });
    }

    // ===== Passwort-Reset-Link erzeugen (E-Mail-basiert) =====
    if (action === "send_reset") {
      const redirectTo = String(body.redirect_to ?? "");
      if (!redirectTo) return json({ error: "redirect_to fehlt" }, 400);

      // E-Mail des Users laden
      const { data: targetProfile } = await admin
        .from("profiles")
        .select("email")
        .eq("id", userId)
        .single();
      if (!targetProfile?.email) return json({ error: "E-Mail des Mitarbeiters unbekannt" }, 400);

      const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
        type: "recovery",
        email: targetProfile.email,
        options: { redirectTo },
      });
      if (linkErr) return json({ error: linkErr.message }, 400);

      return json({ ok: true, action_link: linkData.properties?.action_link ?? null });
    }

    return json({ error: "Unbekannte Aktion" }, 400);
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
