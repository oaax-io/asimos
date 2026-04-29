// Central context resolver: pulls all CRM data needed for documents from clients,
// properties, owners, relationships, financing, company, bank accounts.
// Wizards call this once with the IDs they have, and only ask for what's still missing.

import { supabase } from "@/integrations/supabase/client";
import type { TemplateContext } from "@/lib/document-templates";

export type ResolveInput = {
  clientId?: string | null;
  partnerClientId?: string | null;
  propertyId?: string | null;
  bankAccountId?: string | null;
  // overrides: data the user typed in the wizard (always wins)
  overrides?: Partial<TemplateContext>;
};

export async function resolveDocumentContext(input: ResolveInput): Promise<TemplateContext> {
  const ctx: TemplateContext = {};

  // Company (singleton)
  const { data: company } = await supabase.from("company").select("*").maybeSingle();
  if (company) {
    ctx.company = {
      name: company.name,
      legal_name: (company as any).legal_name,
      address: (company as any).address,
      postal_code: (company as any).postal_code,
      city: (company as any).city,
      country: (company as any).country,
      phone: (company as any).phone,
      email: (company as any).email,
      website: (company as any).website,
      uid_number: (company as any).uid_number,
      commercial_register: (company as any).commercial_register,
      default_signatory_name: (company as any).default_signatory_name,
      default_signatory_role: (company as any).default_signatory_role,
      default_place: (company as any).default_place,
    };
    ctx.place = (company as any).default_place ?? undefined;
  }

  // Client
  if (input.clientId) {
    const { data: client } = await supabase
      .from("clients")
      .select("*")
      .eq("id", input.clientId)
      .maybeSingle();
    if (client) {
      ctx.client = {
        full_name: client.full_name,
        email: client.email,
        phone: client.phone,
        address: client.address,
        postal_code: client.postal_code,
        city: client.city,
        country: client.country,
      };

      // Try to enrich from self-disclosure (birth_date, nationality, salutation)
      const { data: disc } = await supabase
        .from("client_self_disclosures")
        .select("salutation, birth_date, nationality")
        .eq("client_id", input.clientId)
        .maybeSingle();
      if (disc) {
        ctx.client = {
          ...ctx.client,
          salutation: disc.salutation ?? ctx.client.salutation,
          birth_date: disc.birth_date ?? ctx.client.birth_date,
          nationality: disc.nationality ?? ctx.client.nationality,
        };
      }

      // Financing profile (auto-attach if exists)
      const { data: fin } = await supabase
        .from("financing_profiles" as any)
        .select("*")
        .eq("client_id", input.clientId)
        .maybeSingle();
      if (fin) {
        ctx.financing = {
          bank_name: (fin as any).bank_name,
          bank_contact: (fin as any).bank_contact,
          budget: (fin as any).budget,
          equity: (fin as any).equity,
          income: (fin as any).income,
          approval_status: (fin as any).approval_status,
        };
      }
    }
  }

  // Partner via relationships (spouse / partner / co-buyer)
  if (input.partnerClientId) {
    const { data: partner } = await supabase
      .from("clients")
      .select("*")
      .eq("id", input.partnerClientId)
      .maybeSingle();
    if (partner) {
      ctx.partner = {
        full_name: partner.full_name,
        email: partner.email,
        phone: partner.phone,
        address: partner.address,
        postal_code: partner.postal_code,
        city: partner.city,
      };
    }
  } else if (input.clientId) {
    // Auto-detect spouse/partner relationship
    const { data: rels } = await supabase
      .from("client_relationships")
      .select("related_client_id, relationship_type")
      .eq("client_id", input.clientId)
      .in("relationship_type", ["spouse", "partner"] as any);
    const first = rels?.[0];
    if (first?.related_client_id) {
      const { data: partner } = await supabase
        .from("clients")
        .select("*")
        .eq("id", first.related_client_id)
        .maybeSingle();
      if (partner) {
        ctx.partner = {
          full_name: partner.full_name,
          email: partner.email,
          phone: partner.phone,
          address: partner.address,
          postal_code: partner.postal_code,
          city: partner.city,
          relationship: first.relationship_type as string,
        };
      }
    }
  }

  // Property
  if (input.propertyId) {
    const { data: property } = await supabase
      .from("properties")
      .select("*")
      .eq("id", input.propertyId)
      .maybeSingle();
    if (property) {
      ctx.property = {
        title: property.title,
        address: property.address,
        postal_code: property.postal_code,
        city: property.city,
        country: property.country,
        price: property.price,
        rent: property.rent,
        rooms: property.rooms,
        living_area: property.living_area,
        plot_area: property.plot_area,
        property_type: property.property_type,
        year_built: property.year_built,
      };

      // Owner via owner_client_id or seller_client_id
      const ownerId = property.owner_client_id ?? property.seller_client_id;
      if (ownerId) {
        const { data: owner } = await supabase
          .from("clients")
          .select("*")
          .eq("id", ownerId)
          .maybeSingle();
        if (owner) {
          ctx.owner = {
            full_name: owner.full_name,
            email: owner.email,
            phone: owner.phone,
            address: owner.address,
            postal_code: owner.postal_code,
            city: owner.city,
          };
        }
      }
    }
  }

  // Bank account (explicit or default)
  let bankQuery = supabase.from("bank_accounts" as any).select("*").eq("is_active", true);
  if (input.bankAccountId) {
    bankQuery = bankQuery.eq("id", input.bankAccountId);
  } else {
    bankQuery = bankQuery.eq("is_default", true);
  }
  const { data: banks } = await bankQuery.limit(1);
  const bank = (banks as any[])?.[0];
  if (bank) {
    ctx.bank = {
      label: bank.label,
      bank_name: bank.bank_name,
      account_holder: bank.account_holder,
      iban: bank.iban,
      bic: bank.bic,
      purpose: bank.purpose,
    };
  }

  // Apply overrides last (wizard input wins)
  if (input.overrides) {
    return mergeContext(ctx, input.overrides);
  }
  return ctx;
}

function mergeContext(base: TemplateContext, override: Partial<TemplateContext>): TemplateContext {
  const result: TemplateContext = { ...base };
  for (const key of Object.keys(override) as (keyof TemplateContext)[]) {
    const ov = (override as any)[key];
    const ba = (base as any)[key];
    if (ov && typeof ov === "object" && !Array.isArray(ov) && ba && typeof ba === "object") {
      (result as any)[key] = { ...ba, ...ov };
    } else if (ov !== undefined) {
      (result as any)[key] = ov;
    }
  }
  return result;
}

/**
 * Variables grouped by section (for "missing fields" UI).
 */
export const VARIABLE_LABELS: Record<string, string> = {
  "client.full_name": "Kunde – Name",
  "client.address": "Kunde – Adresse",
  "client.postal_code": "Kunde – PLZ",
  "client.city": "Kunde – Ort",
  "client.email": "Kunde – E-Mail",
  "client.phone": "Kunde – Telefon",
  "client.birth_date": "Kunde – Geburtsdatum",
  "client.nationality": "Kunde – Nationalität",
  "partner.full_name": "Mitunterzeichner – Name",
  "partner.address": "Mitunterzeichner – Adresse",
  "property.title": "Objekt – Titel",
  "property.address": "Objekt – Adresse",
  "property.price": "Objekt – Preis",
  "owner.full_name": "Eigentümer – Name",
  "owner.address": "Eigentümer – Adresse",
  "mandate.commission_value": "Provision – Wert",
  "mandate.commission_model": "Provision – Modell",
  "mandate.valid_from": "Mandat – Gültig ab",
  "mandate.valid_until": "Mandat – Gültig bis",
  "reservation.reservation_fee": "Reservation – Gebühr",
  "reservation.valid_until": "Reservation – Gültig bis",
  "reservation.payment_deadline": "Reservation – Zahlungsfrist",
  "nda.purpose": "NDA – Zweck",
  "nda.valid_from": "NDA – Gültig ab",
  "nda.valid_until": "NDA – Gültig bis",
  "bank.iban": "Bank – IBAN",
  "bank.bank_name": "Bank – Name",
  "company.legal_name": "Firma – Rechtlicher Name",
  "company.uid_number": "Firma – UID-Nummer",
  "company.default_signatory_name": "Firma – Unterzeichner",
};

export function labelForVariable(path: string): string {
  return VARIABLE_LABELS[path] ?? path;
}
