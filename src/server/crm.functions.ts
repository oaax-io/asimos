import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import {
  createClientForUser,
  createLeadForUser,
  listClientsForUser,
  listLeadsForUser,
} from "./crm.server";

const authTokenSchema = z.object({ accessToken: z.string().min(1) });

async function getUserIdFromAccessToken(accessToken: string) {
  const supabaseUrl = process.env.SUPABASE_URL;
  const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !publishableKey) {
    throw new Error("Authentifizierung ist derzeit nicht verfügbar.");
  }

  const authClient = createClient(supabaseUrl, publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
  });

  const { data, error } = await authClient.auth.getUser(accessToken);
  if (error || !data.user) {
    throw new Error("Nicht angemeldet");
  }

  return data.user.id;
}

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

export const getLeads = createServerFn({ method: "POST" })
  .inputValidator((data) => authTokenSchema.parse(data))
  .handler(async ({ data }) => {
    return listLeadsForUser(await getUserIdFromAccessToken(data.accessToken));
  });

export const addLead = createServerFn({ method: "POST" })
  .inputValidator((data) => authTokenSchema.merge(leadInputSchema).parse(data))
  .handler(async ({ data }) => {
    const { accessToken, ...payload } = data;
    return createLeadForUser(await getUserIdFromAccessToken(accessToken), payload);
  });

export const getClients = createServerFn({ method: "POST" })
  .inputValidator((data) => authTokenSchema.parse(data))
  .handler(async ({ data }) => {
    return listClientsForUser(await getUserIdFromAccessToken(data.accessToken));
  });

export const addClient = createServerFn({ method: "POST" })
  .inputValidator((data) => authTokenSchema.merge(clientInputSchema).parse(data))
  .handler(async ({ data }) => {
    const { accessToken, ...payload } = data;
    return createClientForUser(await getUserIdFromAccessToken(accessToken), payload);
  });