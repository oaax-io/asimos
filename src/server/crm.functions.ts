import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Database } from "@/integrations/supabase/types";
import { getBackendErrorMessage, isBackendUnavailableError } from "@/lib/backend-errors";

type ServerResult<T> = {
  data: T;
  error: string | null;
  unavailable: boolean;
};

// Single-company mode: no agency scoping. Authenticated users access all CRM data.

const leadInputSchema = z.object({
  full_name: z.string().min(1),
  email: z.string().trim().nullable(),
  phone: z.string().trim().nullable(),
  source: z.string().trim().nullable(),
  notes: z.string().trim().nullable(),
});

const clientInputSchema = z.object({
  full_name: z.string().min(1),
  email: z.string().trim().nullable(),
  phone: z.string().trim().nullable(),
  client_type: z.enum(["buyer", "seller", "owner", "tenant", "landlord", "investor", "other"]),
  notes: z.string().trim().nullable(),
  budget_min: z.number().nullable(),
  budget_max: z.number().nullable(),
  rooms_min: z.number().nullable(),
  area_min: z.number().nullable(),
  preferred_cities: z.array(z.string()).nullable(),
  preferred_types: z.array(z.enum(["apartment", "house", "commercial", "land", "other"])).nullable(),
  preferred_listing: z.enum(["sale", "rent"]).nullable(),
});

function toServerError<T>(fallbackData: T, error: unknown): ServerResult<T> {
  console.error("CRM server function error", error);

  return {
    data: fallbackData,
    error: getBackendErrorMessage(error),
    unavailable: isBackendUnavailableError(error),
  };
}

export const getLeads = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async (): Promise<ServerResult<Database["public"]["Tables"]["leads"]["Row"][]>> => {
    const { data, error } = await supabaseAdmin
      .from("leads")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) return toServerError([], error);
    return { data: data ?? [], error: null, unavailable: false };
  });

export const addLead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => leadInputSchema.parse(data))
  .handler(async ({ data, context }): Promise<ServerResult<Database["public"]["Tables"]["leads"]["Row"] | null>> => {
    const payload: Database["public"]["Tables"]["leads"]["Insert"] = {
      owner_id: context.userId,
      full_name: data.full_name,
      email: data.email,
      phone: data.phone,
      source: data.source,
      notes: data.notes,
    };

    const { data: createdLead, error } = await supabaseAdmin
      .from("leads")
      .insert(payload)
      .select("*")
      .single();

    if (error) return toServerError(null, error);
    return { data: createdLead, error: null, unavailable: false };
  });

export const getClients = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async (): Promise<ServerResult<Database["public"]["Tables"]["clients"]["Row"][]>> => {
    const { data, error } = await supabaseAdmin
      .from("clients")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) return toServerError([], error);
    return { data: data ?? [], error: null, unavailable: false };
  });

export const addClient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => clientInputSchema.parse(data))
  .handler(async ({ data, context }): Promise<ServerResult<Database["public"]["Tables"]["clients"]["Row"] | null>> => {
    const payload: Database["public"]["Tables"]["clients"]["Insert"] = {
      owner_id: context.userId,
      full_name: data.full_name,
      email: data.email,
      phone: data.phone,
      client_type: data.client_type,
      notes: data.notes,
      budget_min: data.budget_min,
      budget_max: data.budget_max,
      rooms_min: data.rooms_min,
      area_min: data.area_min,
      preferred_cities: data.preferred_cities,
      preferred_types: data.preferred_types,
      preferred_listing: data.preferred_listing,
    };

    const { data: createdClient, error } = await supabaseAdmin
      .from("clients")
      .insert(payload)
      .select("*")
      .single();

    if (error) return toServerError(null, error);
    return { data: createdClient, error: null, unavailable: false };
  });