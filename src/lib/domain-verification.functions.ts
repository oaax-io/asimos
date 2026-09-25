/**
 * Phase 3C.5 – Eigentumsprüfung eigener Domains per DNS-TXT-Eintrag.
 * Der Status wird ausschliesslich hier, beim Server, nach echter DNS-Abfrage gesetzt.
 * Diese Prüfung verbindet die Domain NICHT mit dem Hosting – das ist ein separater Schritt.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const TXT_PREFIX = "_immolia-verify";

async function lookupTxt(name: string): Promise<string[]> {
  const res = await fetch(
    `https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(name)}&type=TXT`,
    { headers: { accept: "application/dns-json" } },
  );
  if (!res.ok) throw new Error("DNS-Abfrage fehlgeschlagen");
  const json = (await res.json()) as { Answer?: { type: number; data: string }[] };
  return (json.Answer ?? [])
    .filter((a) => a.type === 16)
    .map((a) => a.data.replace(/"\s*"/g, "").replace(/^"|"$/g, "").trim());
}

export const verifyCustomDomain = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ status: "verified" | "failed"; message: string }> => {
    const { data: isAdmin } = await context.supabase.rpc("is_owner_or_admin");
    if (!isAdmin) throw new Error("Keine Berechtigung");
    const { data: agencyId } = await context.supabase.rpc("current_agency_id");
    if (!agencyId) throw new Error("Keine Berechtigung");

    // Als angemeldete Person lesen (nur eigene Firma sichtbar).
    const { data: row } = await context.supabase
      .from("tenant_domains" as never)
      .select("id, domain, verification_status, verification_token")
      .eq("agency_id", agencyId as string)
      .eq("domain_type", "custom")
      .maybeSingle();
    const d = row as unknown as { id: string; domain: string; verification_status: string; verification_token: string | null } | null;
    if (!d || !d.verification_token) throw new Error("Keine Domain zur Prüfung erfasst");
    if (d.verification_status === "verified") return { status: "verified", message: "Bereits verifiziert" };

    let ok = false;
    let err = "";
    try {
      const values = await lookupTxt(`${TXT_PREFIX}.${d.domain}`);
      ok = values.includes(d.verification_token);
      if (!ok) err = values.length ? "Der TXT-Eintrag hat einen anderen Wert." : "Kein TXT-Eintrag gefunden.";
    } catch (e) {
      err = (e as Error).message;
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.rpc("tenant_domain_record_check" as never, { _id: d.id, _ok: ok, _error: err } as never);
    return ok
      ? { status: "verified", message: "Domain verifiziert" }
      : { status: "failed", message: `${err} Änderungen im DNS können bis zu 72 Stunden dauern.` };
  });
