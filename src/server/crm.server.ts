import postgres from "postgres";

type DbLead = {
  id: string;
  agency_id: string;
  owner_id: string | null;
  full_name: string;
  email: string | null;
  phone: string | null;
  source: string | null;
  status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

type DbClient = {
  id: string;
  agency_id: string;
  owner_id: string | null;
  full_name: string;
  email: string | null;
  phone: string | null;
  client_type: string;
  notes: string | null;
  budget_min: number | null;
  budget_max: number | null;
  rooms_min: number | null;
  area_min: number | null;
  preferred_cities: string[] | null;
  preferred_types: string[] | null;
  preferred_listing: string | null;
  created_at: string;
  updated_at: string;
};

let sqlClient: postgres.Sql | null = null;

function getSql() {
  if (sqlClient) return sqlClient;

  const connectionString = process.env.SUPABASE_DB_URL;
  if (!connectionString) {
    throw new Error("Datenbankverbindung ist nicht konfiguriert.");
  }

  sqlClient = postgres(connectionString, {
    prepare: false,
    max: 1,
    idle_timeout: 20,
    connect_timeout: 10,
  });

  return sqlClient;
}

export async function getAgencyIdForUser(userId: string) {
  const sql = getSql();
  const rows = await sql<{ agency_id: string }[]>`
    select agency_id
    from public.profiles
    where id = ${userId}::uuid
    limit 1
  `;

  const agencyId = rows[0]?.agency_id;
  if (!agencyId) {
    throw new Error("Profil nicht gefunden");
  }

  return agencyId;
}

export async function listLeadsForUser(userId: string) {
  const sql = getSql();
  const agencyId = await getAgencyIdForUser(userId);

  return sql<DbLead[]>`
    select id, agency_id, owner_id, full_name, email, phone, source, status, notes, created_at, updated_at
    from public.leads
    where agency_id = ${agencyId}::uuid
    order by created_at desc
  `;
}

export async function createLeadForUser(
  userId: string,
  input: Pick<DbLead, "full_name" | "email" | "phone" | "source" | "notes">,
) {
  const sql = getSql();
  const agencyId = await getAgencyIdForUser(userId);

  const rows = await sql<DbLead[]>`
    insert into public.leads (agency_id, owner_id, full_name, email, phone, source, notes)
    values (
      ${agencyId}::uuid,
      ${userId}::uuid,
      ${input.full_name},
      ${input.email},
      ${input.phone},
      ${input.source},
      ${input.notes}
    )
    returning id, agency_id, owner_id, full_name, email, phone, source, status, notes, created_at, updated_at
  `;

  return rows[0];
}

export async function listClientsForUser(userId: string) {
  const sql = getSql();
  const agencyId = await getAgencyIdForUser(userId);

  return sql<DbClient[]>`
    select id, agency_id, owner_id, full_name, email, phone, client_type, notes,
           budget_min, budget_max, rooms_min, area_min, preferred_cities, preferred_types,
           preferred_listing, created_at, updated_at
    from public.clients
    where agency_id = ${agencyId}::uuid
    order by created_at desc
  `;
}

export async function createClientForUser(
  userId: string,
  input: Omit<DbClient, "id" | "agency_id" | "owner_id" | "created_at" | "updated_at">,
) {
  const sql = getSql();
  const agencyId = await getAgencyIdForUser(userId);

  const rows = await sql<DbClient[]>`
    insert into public.clients (
      agency_id, owner_id, full_name, email, phone, client_type, notes,
      budget_min, budget_max, rooms_min, area_min, preferred_cities, preferred_types, preferred_listing
    )
    values (
      ${agencyId}::uuid,
      ${userId}::uuid,
      ${input.full_name},
      ${input.email},
      ${input.phone},
      ${input.client_type},
      ${input.notes},
      ${input.budget_min},
      ${input.budget_max},
      ${input.rooms_min},
      ${input.area_min},
      ${input.preferred_cities},
      ${input.preferred_types},
      ${input.preferred_listing}
    )
    returning id, agency_id, owner_id, full_name, email, phone, client_type, notes,
              budget_min, budget_max, rooms_min, area_min, preferred_cities, preferred_types,
              preferred_listing, created_at, updated_at
  `;

  return rows[0];
}