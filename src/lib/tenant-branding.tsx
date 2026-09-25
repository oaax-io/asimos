/**
 * White-Label-Runtime: einziger Ort, an dem die App Branding bezieht.
 * Komponenten nutzen useTenantBranding() – keine direkten Abfragen auf
 * brand_settings/company. Branding ist Darstellung, keine Autorisierung.
 */
import { createContext, useContext, useEffect, useMemo, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { useTenantConfig, TENANT_CONFIG_QUERY_KEY, type TenantCompany, type TenantBranding } from "@/lib/tenant-config";

/** Neutraler Plattform-Fallback (kein Tenant-Kontext). Keine ASIMO-Werte. */
export const PLATFORM_BRANDING = {
  productName: "Immolia",
  primaryColor: "#334155",
  secondaryColor: "#64748b",
  accentColor: "#0ea5e9",
  faviconUrl: "/favicon.png",
} as const;

export type TenantBrandingValue = {
  agencyId: string | null;
  agencyName: string | null;
  companyName: string;
  logoUrl: string | null;
  alternativeLogoUrl: string | null;
  faviconUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  fontFamily: string | null;
  companyEmail: string | null;
  companyWebsite: string | null;
  companyAddress: string | null;
  company: TenantCompany | null;
  /** Rohdaten für Berichte/PDFs (null ohne Tenant). */
  raw: TenantBranding | null;
  isLoading: boolean;
  hasTenantContext: boolean;
};

const FALLBACK: TenantBrandingValue = {
  agencyId: null,
  agencyName: null,
  companyName: PLATFORM_BRANDING.productName,
  logoUrl: null,
  alternativeLogoUrl: null,
  faviconUrl: PLATFORM_BRANDING.faviconUrl,
  primaryColor: PLATFORM_BRANDING.primaryColor,
  secondaryColor: PLATFORM_BRANDING.secondaryColor,
  accentColor: PLATFORM_BRANDING.accentColor,
  fontFamily: null,
  companyEmail: null,
  companyWebsite: null,
  companyAddress: null,
  company: null,
  raw: null,
  isLoading: false,
  hasTenantContext: false,
};

const Ctx = createContext<TenantBrandingValue>(FALLBACK);

export function TenantBrandingProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const qc = useQueryClient();
  const q = useTenantConfig(!!user);

  // Bei Benutzerwechsel/Logout keine fremde Konfiguration im Cache behalten.
  useEffect(() => {
    qc.removeQueries({ queryKey: TENANT_CONFIG_QUERY_KEY });
  }, [user?.id, qc]);

  const value = useMemo<TenantBrandingValue>(() => {
    const cfg = user ? q.data : null;
    const b = cfg?.branding ?? null;
    if (!cfg || !b) {
      return { ...FALLBACK, isLoading: authLoading || (!!user && q.isLoading) };
    }
    return {
      agencyId: cfg.agency_id,
      agencyName: cfg.agency_name ?? null,
      companyName: b.company_name || cfg.agency_name || PLATFORM_BRANDING.productName,
      logoUrl: b.logo_url,
      alternativeLogoUrl: b.logo_alt_url,
      faviconUrl: b.favicon_url || PLATFORM_BRANDING.faviconUrl,
      primaryColor: b.primary_color || PLATFORM_BRANDING.primaryColor,
      secondaryColor: b.secondary_color || PLATFORM_BRANDING.secondaryColor,
      accentColor: b.accent_color || b.primary_color || PLATFORM_BRANDING.accentColor,
      fontFamily: b.font_family,
      companyEmail: b.company_email,
      companyWebsite: b.company_website,
      companyAddress: b.company_address,
      company: b.company ?? null,
      raw: b,
      isLoading: false,
      hasTenantContext: true,
    };
  }, [user, q.data, q.isLoading, authLoading]);

  // Zentrale CSS-Variablen + Favicon
  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    root.style.setProperty("--tenant-primary", value.primaryColor);
    root.style.setProperty("--tenant-secondary", value.secondaryColor);
    root.style.setProperty("--tenant-accent", value.accentColor);
    root.dataset.tenantContext = value.hasTenantContext ? "tenant" : "platform";
    if (value.faviconUrl) {
      let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
      if (!link) {
        link = document.createElement("link");
        link.rel = "icon";
        document.head.appendChild(link);
      }
      if (link.getAttribute("href") !== value.faviconUrl) link.href = value.faviconUrl;
    }
  }, [value.primaryColor, value.secondaryColor, value.accentColor, value.faviconUrl, value.hasTenantContext]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTenantBranding(): TenantBrandingValue {
  return useContext(Ctx);
}

/** Briefkopf-Daten für Finanzierungsberichte (gleiche Form wie bisher brand_settings). */
export function reportBrandFrom(b: TenantBrandingValue) {
  if (!b.raw) return null;
  return {
    company_name: b.raw.company_name,
    company_address: b.raw.company_address,
    company_email: b.raw.company_email,
    company_website: b.raw.company_website,
    logo_url: b.raw.logo_url,
    primary_color: b.raw.primary_color,
    secondary_color: b.raw.secondary_color,
    font_family: b.raw.font_family,
  };
}
