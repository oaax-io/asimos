import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import { getBackendErrorMessage, isBackendUnavailableError } from "@/lib/backend-errors";

type ServerResult<T> = {
  data: T;
  error: string | null;
  unavailable: boolean;
};

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
  client_type: z.enum(["buyer", "seller", "tenant", "landlord"]),
  notes: z.string().trim().nullable(),
  budget_min: z.number().nullable(),
  budget_max: z.number().nullable(),
  rooms_min: z.number().nullable(),
  area_min: z.number().nullable(),
  preferred_cities: z.array(z.string()).nullable(),
  preferred_types: z.array(z.enum(["apartment", "house", "commercial", "land", "other"])).nullable(),
  preferred_listing: z.enum(["sale", "rent"]).nullable(),
});

async function getAgencyIdForUser(supabase: any, userId: string) {
  const { data, error } = await supabase
    .from("profiles")
    .select("agency_id")
    .eq("id", userId)
    .single();

  if (error) {
    return {
      agencyId: null,
      error: getBackendErrorMessage(error),
      unavailable: isBackendUnavailableError(error),
    };
  }

  if (!data?.agency_id) {
    return {
      agencyId: null,
      error: "Profil nicht gefunden",
      unavailable: false,
    };
  }

  return {
    agencyId: data.agency_id as string,
    error: null,
    unavailable: false,
  };
}

export const getLeads = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ServerResult<Database["public"]["Tables"]["leads"]["Row"][]>> => {
    const { data, error } = await context.supabase
      .from("leads")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      return {
        data: [],
        error: getBackendErrorMessage(error),
        unavailable: isBackendUnavailableError(error),
      };
    }

    return {
      data: data ?? [],
      error: null,
      unavailable: false,
    };
  });

export const addLead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => leadInputSchema.parse(data))
  .handler(async ({ data, context }): Promise<ServerResult<Database["public"]["Tables"]["leads"]["Row"] | null>> => {
    const agency = await getAgencyIdForUser(context.supabase, context.userId);
    if (!agency.agencyId) {
      return {
        data: null,
        error: agency.error,
        unavailable: agency.unavailable,
      };
    }

    const payload: Database["public"]["Tables"]["leads"]["Insert"] = {
      agency_id: agency.agencyId,
      owner_id: context.userId,
      full_name: data.full_name,
      email: data.email,
      phone: data.phone,
      source: data.source,
      notes: data.notes,
    };
    const { data: createdLead, error } = await context.supabase
      .from("leads")
      .insert(payload)
      .select("*")
      .single();

    if (error) {
      return {
        data: null,
        error: getBackendErrorMessage(error),
        unavailable: isBackendUnavailableError(error),
      };
    }

    return {
      data: createdLead,
      error: null,
      unavailable: false,
    };
  });

export const getClients = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ServerResult<Database["public"]["Tables"]["clients"]["Row"][]>> => {
    const { data, error } = await context.supabase
      .from("clients")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      return {
        data: [],
        error: getBackendErrorMessage(error),
        unavailable: isBackendUnavailableError(error),
      };
    }

    return {
      data: data ?? [],
      error: null,
      unavailable: false,
    };
  });

export const addClient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => clientInputSchema.parse(data))
  .handler(async ({ data, context }): Promise<ServerResult<Database["public"]["Tables"]["clients"]["Row"] | null>> => {
    const agency = await getAgencyIdForUser(context.supabase, context.userId);
    if (!agency.agencyId) {
      return {
        data: null,
        error: agency.error,
        unavailable: agency.unavailable,
      };
    }

    const payload: Database["public"]["Tables"]["clients"]["Insert"] = {
      agency_id: agency.agencyId,
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
    const { data: createdClient, error } = await context.supabase
      .from("clients")
      .insert(payload)
      .select("*")
      .single();

    if (error) {
      return {
        data: null,
        error: getBackendErrorMessage(error),
        unavailable: isBackendUnavailableError(error),
      };
    }

    return {
      data: createdClient,
      error: null,
      unavailable: false,
    };
  });