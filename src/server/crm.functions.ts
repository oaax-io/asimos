import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

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
  client_type: z.string().min(1),
  notes: z.string().trim().nullable(),
  budget_min: z.number().nullable(),
  budget_max: z.number().nullable(),
  rooms_min: z.number().nullable(),
  area_min: z.number().nullable(),
  preferred_cities: z.array(z.string()).nullable(),
  preferred_types: z.array(z.string()).nullable(),
  preferred_listing: z.string().nullable(),
});

async function getAgencyIdForUser(supabase: any, userId: string) {
  const { data, error } = await supabase
    .from("profiles")
    .select("agency_id")
    .eq("id", userId)
    .single();

  if (error || !data?.agency_id) {
    throw new Error("Profil nicht gefunden");
  }

  return data.agency_id as string;
}

export const getLeads = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("leads")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    return data;
  });

export const addLead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => leadInputSchema.parse(data))
  .handler(async ({ data, context }) => {
    const agencyId = await getAgencyIdForUser(context.supabase, context.userId);
    const { data: createdLead, error } = await context.supabase
      .from("leads")
      .insert({
        agency_id: agencyId,
        owner_id: context.userId,
        ...data,
      })
      .select("*")
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return createdLead;
  });

export const getClients = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("clients")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    return data;
  });

export const addClient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => clientInputSchema.parse(data))
  .handler(async ({ data, context }) => {
    const agencyId = await getAgencyIdForUser(context.supabase, context.userId);
    const { data: createdClient, error } = await context.supabase
      .from("clients")
      .insert({
        agency_id: agencyId,
        owner_id: context.userId,
        ...data,
      })
      .select("*")
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return createdClient;
  });