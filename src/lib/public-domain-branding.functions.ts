/**
 * Phase 3C.1 – Öffentliche Domain-Auflösung (nur Darstellung).
 *
 * hostname (aus der Anfrage, nie vom Browser als Parameter)
 *   → tenant_domains (nur verification_status = 'verified')
 *   → Agency → öffentlich sichere Branding-Felder.
 *
 * Liefert NIE Zugriff, IDs oder CRM-Daten. Autorisierung bleibt
 * Auth → aktive agency_membership → current_agency_id() → RLS.
 * Unbekannte/nicht verifizierte Domains → null → Immolia-Branding.
 */
import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";

export type PublicDomainBranding = {
  company_name: string | null;
  logo_url: string | null;
  logo_alt_url: string | null;
  favicon_url: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  accent_color: string | null;
};

export const resolvePublicDomainBranding = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ hostname: string; branding: PublicDomainBranding | null }> => {
    const raw = getRequestHeader("x-forwarded-host") || getRequestHeader("host") || "";
    const hostname = raw.split(",")[0].trim().toLowerCase().replace(/:\d+$/, "").replace(/\.$/, "");
    if (!hostname || hostname.length > 253) return { hostname: "", branding: null };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.rpc(
      "resolve_public_tenant_branding" as never,
      { _hostname: hostname } as never,
    );
    if (error || !data) return { hostname, branding: null };
    return { hostname, branding: data as unknown as PublicDomainBranding };
  },
);

/** Query-Key berücksichtigt den Hostname → keine Vermischung verschiedener Domains. */
export const publicDomainBrandingKey = (hostname: string) => ["public-domain-branding", hostname] as const;
