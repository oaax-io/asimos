import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  createClientForUser,
  createLeadForUser,
  listClientsForUser,
  listLeadsForUser,
} from "./crm.server";

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

export const getLeads = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    return listLeadsForUser(context.userId);
  });

export const addLead = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => leadInputSchema.parse(data))
  .handler(async ({ context, data }) => {
    return createLeadForUser(context.userId, data);
  });

export const getClients = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    return listClientsForUser(context.userId);
  });

export const addClient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => clientInputSchema.parse(data))
  .handler(async ({ context, data }) => {
    return createClientForUser(context.userId, data);
  });