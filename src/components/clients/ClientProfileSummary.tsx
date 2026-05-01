import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Briefcase,
  Building2,
  Home,
  Search,
  Users,
  ExternalLink,
  MapPin,
  Euro,
  BedDouble,
  Ruler,
  TrendingUp,
} from "lucide-react";
import { formatCurrency, formatDate, listingTypeLabels, propertyTypeLabels } from "@/lib/format";

type RoleType =
  | "buyer"
  | "seller"
  | "owner"
  | "former_owner"
  | "tenant"
  | "landlord"
  | "financing_applicant"
  | "co_applicant"
  | "investor"
  | "contact_person"
  | "general_contact";

const roleLabels: Record<RoleType, string> = {
  buyer: "Käufer / Suchkunde",
  seller: "Verkäufer",
  owner: "Eigentümer",
  former_owner: "Ehemaliger Eigentümer",
  tenant: "Mieter",
  landlord: "Vermieter",
  financing_applicant: "Finanzierungskunde",
  co_applicant: "Mitantragsteller",
  investor: "Investor",
  contact_person: "Kontaktperson",
  general_contact: "Allgemeiner Kontakt",
};

const statusLabels: Record<string, string> = {
  active: "Aktiv",
  inactive: "Inaktiv",
  completed: "Abgeschlossen",
  cancelled: "Storniert",
};

const statusVariant: Record<string, "default" | "secondary" | "outline"> = {
  active: "default",
  inactive: "secondary",
  completed: "outline",
  cancelled: "outline",
};

interface Props {
  clientId: string;
  entityType: string | null | undefined;
}

export function ClientProfileSummary({ clientId, entityType }: Props) {
  const { data: roles = [] } = useQuery({
    queryKey: ["client_roles", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_roles")
        .select("*")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: searchProfiles = [] } = useQuery({
    queryKey: ["client_search_profiles", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_search_profiles")
        .select("*")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: ownerships = [] } = useQuery({
    queryKey: ["client_ownerships", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("property_ownerships")
        .select("*, property:properties(id, title, city, status, price)")
        .eq("client_id", clientId)
        .is("end_date", null)
        .order("start_date", { ascending: false, nullsFirst: false });
      if (error) throw error;
      return (data ?? []) as Array<any>;
    },
  });

  const { data: companyContacts = [] } = useQuery({
    queryKey: ["client_company_contacts", clientId, entityType],
    enabled: entityType === "company",
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_relationships")
        .select(
          "id, relationship_type, notes, related:clients!client_relationships_related_client_id_fkey(id, full_name, email, phone)",
        )
        .eq("client_id", clientId);
      if (error) throw error;
      return (data ?? []) as Array<any>;
    },
  });

  // Property/related lookups for role.related_id
  const propertyIds = roles
    .filter((r: any) => r.related_type === "property" && r.related_id)
    .map((r: any) => r.related_id);
  const clientIds = roles
    .filter((r: any) => r.related_type === "client" && r.related_id)
    .map((r: any) => r.related_id);

  const { data: relatedProperties = [] } = useQuery({
    queryKey: ["client_roles_properties", clientId, propertyIds.join(",")],
    enabled: propertyIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("properties")
        .select("id, title, city")
        .in("id", propertyIds);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: relatedClients = [] } = useQuery({
    queryKey: ["client_roles_clients", clientId, clientIds.join(",")],
    enabled: clientIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("id, full_name")
        .in("id", clientIds);
      if (error) throw error;
      return data ?? [];
    },
  });

  const propertyMap = new Map(relatedProperties.map((p: any) => [p.id, p]));
  const clientMap = new Map(relatedClients.map((c: any) => [c.id, c]));

  return (
    <div className="space-y-4">
      {/* Rollen */}
      <Card>
        <CardContent className="p-6">
          <div className="mb-4 flex items-center gap-2">
            <Briefcase className="h-4 w-4 text-muted-foreground" />
            <h3 className="font-display text-lg font-semibold">Rollen</h3>
            <Badge variant="secondary" className="ml-1">{roles.length}</Badge>
          </div>
          {roles.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Noch keine Rollen hinterlegt.
            </p>
          ) : (
            <div className="space-y-2">
              {roles.map((r: any) => {
                const relProp = r.related_type === "property" ? propertyMap.get(r.related_id) : null;
                const relCli = r.related_type === "client" ? clientMap.get(r.related_id) : null;
                return (
                  <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge>{roleLabels[r.role_type as RoleType] ?? r.role_type}</Badge>
                      <Badge variant={statusVariant[r.status] ?? "outline"}>
                        {statusLabels[r.status] ?? r.status}
                      </Badge>
                      {relProp && (
                        <Link
                          to="/properties/$id"
                          params={{ id: relProp.id }}
                          className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                        >
                          <Home className="h-3.5 w-3.5" />
                          {relProp.title}
                          <ExternalLink className="h-3 w-3" />
                        </Link>
                      )}
                      {relCli && (
                        <Link
                          to="/clients/$id"
                          params={{ id: relCli.id }}
                          className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                        >
                          <Users className="h-3.5 w-3.5" />
                          {relCli.full_name}
                          <ExternalLink className="h-3 w-3" />
                        </Link>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {r.start_date ? `Ab ${formatDate(r.start_date)}` : "—"}
                      {r.end_date ? ` · Bis ${formatDate(r.end_date)}` : ""}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Suchprofile */}
      <Card>
        <CardContent className="p-6">
          <div className="mb-4 flex items-center gap-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <h3 className="font-display text-lg font-semibold">Suchprofile</h3>
            <Badge variant="secondary" className="ml-1">{searchProfiles.length}</Badge>
          </div>
          {searchProfiles.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Kein Suchprofil hinterlegt.
            </p>
          ) : (
            <div className="space-y-3">
              {searchProfiles.map((sp: any) => (
                <div key={sp.id} className="rounded-xl border p-4">
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <Badge>{roleLabels[sp.role_type as RoleType] ?? sp.role_type}</Badge>
                    {sp.listing_type && (
                      <Badge variant="outline">
                        {listingTypeLabels[sp.listing_type as keyof typeof listingTypeLabels] ?? sp.listing_type}
                      </Badge>
                    )}
                    {!sp.is_active && <Badge variant="secondary">Inaktiv</Badge>}
                  </div>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    <Field icon={<Euro className="h-3.5 w-3.5" />} label="Budget" value={
                      sp.budget_min || sp.budget_max
                        ? `${sp.budget_min ? formatCurrency(Number(sp.budget_min)) : "—"} – ${sp.budget_max ? formatCurrency(Number(sp.budget_max)) : "—"}`
                        : "—"
                    } />
                    <Field icon={<MapPin className="h-3.5 w-3.5" />} label="Orte" value={
                      sp.preferred_cities?.length ? sp.preferred_cities.join(", ") : "—"
                    } />
                    <Field icon={<Building2 className="h-3.5 w-3.5" />} label="Objektarten" value={
                      sp.preferred_property_types?.length
                        ? sp.preferred_property_types
                            .map((t: string) => propertyTypeLabels[t as keyof typeof propertyTypeLabels] ?? t)
                            .join(", ")
                        : "—"
                    } />
                    <Field icon={<BedDouble className="h-3.5 w-3.5" />} label="Zimmer ab" value={sp.rooms_min ?? "—"} />
                    <Field icon={<Ruler className="h-3.5 w-3.5" />} label="Fläche" value={
                      sp.area_min || sp.area_max
                        ? `${sp.area_min ?? "—"} – ${sp.area_max ?? "—"} m²`
                        : "—"
                    } />
                    {sp.role_type === "investor" && (
                      <>
                        <Field icon={<TrendingUp className="h-3.5 w-3.5" />} label="Zielrendite" value={
                          sp.yield_target ? `${sp.yield_target}%` : "—"
                        } />
                        <Field icon={<Building2 className="h-3.5 w-3.5" />} label="Nutzungen" value={
                          sp.usage_types?.length ? sp.usage_types.join(", ") : "—"
                        } />
                      </>
                    )}
                  </div>
                  {sp.notes && (
                    <p className="mt-3 text-xs text-muted-foreground">{sp.notes}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Firmenkontakte */}
      {entityType === "company" && (
        <Card>
          <CardContent className="p-6">
            <div className="mb-4 flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <h3 className="font-display text-lg font-semibold">Kontaktpersonen</h3>
              <Badge variant="secondary" className="ml-1">{companyContacts.length}</Badge>
            </div>
            {companyContacts.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Noch keine Kontaktpersonen verknüpft.
              </p>
            ) : (
              <div className="space-y-2">
                {companyContacts.map((c: any) => (
                  <div key={c.id} className="flex items-center justify-between rounded-xl border p-3">
                    <div className="min-w-0">
                      {c.related ? (
                        <Link
                          to="/clients/$id"
                          params={{ id: c.related.id }}
                          className="font-medium hover:text-primary"
                        >
                          {c.related.full_name}
                        </Link>
                      ) : (
                        <span className="text-sm text-muted-foreground">Unbekannt</span>
                      )}
                      {c.related?.email && (
                        <p className="text-xs text-muted-foreground">{c.related.email}</p>
                      )}
                      {c.notes && (
                        <p className="mt-0.5 text-xs text-muted-foreground">{c.notes}</p>
                      )}
                    </div>
                    {c.related && (
                      <Link
                        to="/clients/$id"
                        params={{ id: c.related.id }}
                        className="text-muted-foreground hover:text-primary"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Link>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Eigentum */}
      <Card>
        <CardContent className="p-6">
          <div className="mb-4 flex items-center gap-2">
            <Home className="h-4 w-4 text-muted-foreground" />
            <h3 className="font-display text-lg font-semibold">Eigentum</h3>
            <Badge variant="secondary" className="ml-1">{ownerships.length}</Badge>
          </div>
          {ownerships.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Aktuell keine Immobilien als Eigentum hinterlegt.
            </p>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {ownerships.map((o: any) => (
                <Link
                  key={o.id}
                  to="/properties/$id"
                  params={{ id: o.property?.id ?? o.property_id }}
                  className="rounded-xl border p-4 transition hover:border-primary"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium">{o.property?.title ?? "Immobilie"}</p>
                    {o.is_primary_contact && (
                      <Badge variant="secondary">Hauptkontakt</Badge>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {o.property?.city ?? "—"}
                    {o.property?.price ? ` · ${formatCurrency(Number(o.property.price))}` : ""}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {o.start_date ? `Eigentümer seit ${formatDate(o.start_date)}` : "Startdatum —"}
                    {o.source ? ` · Quelle: ${o.source}` : ""}
                  </p>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Field({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-xs uppercase text-muted-foreground">{icon}{label}</div>
      <p className="mt-0.5 text-sm font-medium">{value}</p>
    </div>
  );
}
