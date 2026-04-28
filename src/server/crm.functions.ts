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

type UserScopeResult = {
  agencyId: string | null;
  isSuperadmin: boolean;
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

function toServerError<T>(fallbackData: T, error: unknown): ServerResult<T> {
  console.error("CRM server function error", error);

  return {
    data: fallbackData,
    error: getBackendErrorMessage(error),
    unavailable: isBackendUnavailableError(error),
  };
}

async function getUserScope(userId: string): Promise<UserScopeResult> {
  const [{ data: profile, error: profileError }, { data: superadminRole, error: roleError }] = await Promise.all([
    supabaseAdmin.from("profiles").select("agency_id").eq("id", userId).maybeSingle(),
    supabaseAdmin.from("user_roles").select("role").eq("user_id", userId).eq("role", "superadmin").maybeSingle(),
  ]);

  if (profileError) {
    const error = toServerError<null>(null, profileError);
    return {
      agencyId: null,
      isSuperadmin: false,
      error: error.error,
      unavailable: error.unavailable,
    };
  }

  if (roleError) {
    const error = toServerError<null>(null, roleError);
    return {
      agencyId: profile?.agency_id ?? null,
      isSuperadmin: false,
      error: error.error,
      unavailable: error.unavailable,
    };
  }

  if (!profile?.agency_id) {
    return {
      agencyId: null,
      isSuperadmin: false,
      error: "Profil nicht gefunden",
      unavailable: false,
    };
  }

  return {
    agencyId: profile.agency_id,
    isSuperadmin: Boolean(superadminRole),
    error: null,
    unavailable: false,
  };
}

export const getLeads = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ServerResult<Database["public"]["Tables"]["leads"]["Row"][]>> => {
    const scope = await getUserScope(context.userId);
    if (!scope.agencyId) {
      return {
        data: [],
        error: scope.error,
        unavailable: scope.unavailable,
      };
    }

    let query = supabaseAdmin.from("leads").select("*").order("created_at", { ascending: false });
    if (!scope.isSuperadmin) {
      query = query.eq("agency_id", scope.agencyId);
    }

    const { data, error } = await query;

    if (error) {
      return toServerError([], error);
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
    const scope = await getUserScope(context.userId);
    if (!scope.agencyId) {
      return {
        data: null,
        error: scope.error,
        unavailable: scope.unavailable,
      };
    }

    const payload: Database["public"]["Tables"]["leads"]["Insert"] = {
      agency_id: scope.agencyId,
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

    if (error) {
      return toServerError(null, error);
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
    const scope = await getUserScope(context.userId);
    if (!scope.agencyId) {
      return {
        data: [],
        error: scope.error,
        unavailable: scope.unavailable,
      };
    }

    let query = supabaseAdmin.from("clients").select("*").order("created_at", { ascending: false });
    if (!scope.isSuperadmin) {
      query = query.eq("agency_id", scope.agencyId);
    }

    const { data, error } = await query;

    if (error) {
      return toServerError([], error);
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
    const scope = await getUserScope(context.userId);
    if (!scope.agencyId) {
      return {
        data: null,
        error: scope.error,
        unavailable: scope.unavailable,
      };
    }

    const payload: Database["public"]["Tables"]["clients"]["Insert"] = {
      agency_id: scope.agencyId,
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

    if (error) {
      return toServerError(null, error);
    }

    return {
      data: createdClient,
      error: null,
      unavailable: false,
    };
  });