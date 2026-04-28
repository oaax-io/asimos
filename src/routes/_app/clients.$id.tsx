import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  ArrowLeft, Mail, Phone, Trash2, Copy, RefreshCw, Pencil, Link2, FileSignature,
  Calendar, Target, Home, MapPin, Euro, Ruler, BedDouble, Building2, MessageSquare,
  CalendarPlus, ExternalLink,
} from "lucide-react";
import {
  clientTypeLabels, formatCurrency, formatDate, formatDateTime,
  propertyTypeLabels, propertyStatusLabels, listingTypeLabels, apptTypeLabels,
} from "@/lib/format";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_app/clients/$id")({ component: ClientDetail });

const TYPES = ["buyer", "seller", "tenant", "landlord"] as const;
const PROP_TYPES = ["apartment", "house", "commercial", "land", "other"] as const;

function ClientDetail() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loadTimedOut, setLoadTimedOut] = useState(false);

  useEffect(() => {
    setLoadTimedOut(false);
  }, [id]);

  const { data: client, isLoading, isError, error: clientError, refetch } = useQuery({
    queryKey: ["client", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("Kunde nicht gefunden");
      return data;
    },
    retry: 1,
    retryDelay: 600,
  });

  useEffect(() => {
    if (!isLoading || isError || client) {
      setLoadTimedOut(false);
      return;
    }

    const timeout = window.setTimeout(() => setLoadTimedOut(true), 2500);
    return () => window.clearTimeout(timeout);
  }, [client, id, isError, isLoading]);

  const { data: dossier } = useQuery({
    queryKey: ["financing_dossier", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financing_dossiers").select("*").eq("client_id", id).maybeSingle();
      if (error) throw error;
      return data;
    },
    retry: false,
  });

  const { data: links = [] } = useQuery({
    queryKey: ["financing_links", dossier?.id],
    enabled: !!dossier?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financing_links").select("*").eq("dossier_id", dossier!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    retry: false,
  });

  const { data: appointments = [] } = useQuery({
    queryKey: ["client_appointments", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("appointments").select("*").eq("client_id", id)
        .order("starts_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    retry: false,
  });

  const { data: matches = [] } = useQuery({
    queryKey: ["client_matches", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("matches")
        .select("*, properties(*)")
        .eq("client_id", id)
        .order("score", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
    retry: false,
  });

  const { data: ownProperties = [] } = useQuery({
    queryKey: ["client_own_properties", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("properties").select("*").eq("seller_client_id", id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    retry: false,
  });

  const del = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("clients").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Gelöscht"); navigate({ to: "/clients" }); },
    onError: (e: any) => toast.error(e.message ?? "Fehler beim Löschen"),
  });

  if (isLoading && !isError && !loadTimedOut) return <div className="text-sm text-muted-foreground">Lädt…</div>;
  if (clientError || !client) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" asChild><Link to="/clients"><ArrowLeft className="mr-1 h-4 w-4" />Zurück</Link></Button>
        <Card><CardContent className="p-6">
          <h2 className="font-display text-lg font-semibold">Kunde konnte nicht geladen werden</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {(clientError as any)?.message ?? "Datenbank derzeit nicht erreichbar. Bitte gleich erneut versuchen."}
          </p>
          <Button className="mt-4" onClick={() => refetch()}><RefreshCw className="mr-1.5 h-4 w-4" />Erneut versuchen</Button>
        </CardContent></Card>
      </div>
    );
  }

  const isSeller = client.client_type === "seller" || client.client_type === "landlord";
  const upcoming = appointments.filter((a: any) => new Date(a.starts_at) >= new Date());
  const past = appointments.filter((a: any) => new Date(a.starts_at) < new Date());

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <Button variant="ghost" asChild>
          <Link to="/clients"><ArrowLeft className="mr-1 h-4 w-4" />Zurück</Link>
        </Button>
        <div className="flex gap-2">
          <EditClientDialog client={client} onSaved={() => qc.invalidateQueries({ queryKey: ["client", id] })} />
          <Button variant="outline" size="icon" onClick={() => { if (confirm("Wirklich löschen?")) del.mutate(); }}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Hero */}
      <div className="mb-6 rounded-2xl border bg-gradient-to-br from-primary/5 via-background to-background p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <Badge variant="secondary">{clientTypeLabels[client.client_type as keyof typeof clientTypeLabels]}</Badge>
            <h1 className="mt-2 font-display text-3xl font-bold">{client.full_name}</h1>
            <div className="mt-3 flex flex-wrap gap-4 text-sm text-muted-foreground">
              {client.email && (
                <a href={`mailto:${client.email}`} className="flex items-center gap-1.5 hover:text-primary">
                  <Mail className="h-4 w-4" />{client.email}
                </a>
              )}
              {client.phone && (
                <a href={`tel:${client.phone}`} className="flex items-center gap-1.5 hover:text-primary">
                  <Phone className="h-4 w-4" />{client.phone}
                </a>
              )}
              <span className="flex items-center gap-1.5">
                <Calendar className="h-4 w-4" />Angelegt {formatDate(client.created_at)}
              </span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {client.email && (
              <Button variant="outline" size="sm" asChild>
                <a href={`mailto:${client.email}`}><Mail className="mr-1.5 h-4 w-4" />Mail</a>
              </Button>
            )}
            {client.phone && (
              <Button variant="outline" size="sm" asChild>
                <a href={`tel:${client.phone}`}><Phone className="mr-1.5 h-4 w-4" />Anrufen</a>
              </Button>
            )}
            <Button size="sm" asChild>
              <Link to="/matching" search={{ clientId: id }}>
                <Target className="mr-1.5 h-4 w-4" />Matching
              </Link>
            </Button>
          </div>
        </div>

        {/* KPIs */}
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat icon={<Target className="h-4 w-4" />} label="Matches" value={matches.length} />
          <Stat icon={<Calendar className="h-4 w-4" />} label="Termine" value={appointments.length} />
          <Stat
            icon={<FileSignature className="h-4 w-4" />}
            label="Finanzierung"
            value={dossier ? `${dossier.completion_percent}%` : "—"}
          />
          <Stat
            icon={<Home className="h-4 w-4" />}
            label={isSeller ? "Eigene Objekte" : "Budget"}
            value={isSeller ? ownProperties.length : (client.budget_max ? formatCurrency(Number(client.budget_max)) : "—")}
          />
        </div>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Übersicht</TabsTrigger>
          <TabsTrigger value="matches">
            <Target className="mr-1.5 h-4 w-4" />Matches
            {matches.length > 0 && <Badge variant="secondary" className="ml-2">{matches.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="appointments">
            <Calendar className="mr-1.5 h-4 w-4" />Termine
            {appointments.length > 0 && <Badge variant="secondary" className="ml-2">{appointments.length}</Badge>}
          </TabsTrigger>
          {isSeller && (
            <TabsTrigger value="properties">
              <Building2 className="mr-1.5 h-4 w-4" />Objekte
              {ownProperties.length > 0 && <Badge variant="secondary" className="ml-2">{ownProperties.length}</Badge>}
            </TabsTrigger>
          )}
          <TabsTrigger value="financing">
            <FileSignature className="mr-1.5 h-4 w-4" />Finanzierung
            {dossier && <Badge variant="secondary" className="ml-2">{dossier.completion_percent}%</Badge>}
          </TabsTrigger>
        </TabsList>

        {/* Übersicht */}
        <TabsContent value="overview" className="mt-6 space-y-4">
          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardContent className="p-6">
                <h3 className="mb-4 font-display text-lg font-semibold">Suchprofil</h3>
                <div className="grid grid-cols-2 gap-4">
                  <Field icon={<Euro className="h-4 w-4" />} label="Budget" value={
                    client.budget_min || client.budget_max
                      ? `${client.budget_min ? formatCurrency(Number(client.budget_min)) : "—"} – ${client.budget_max ? formatCurrency(Number(client.budget_max)) : "—"}`
                      : "—"
                  } />
                  <Field icon={<MapPin className="h-4 w-4" />} label="Städte" value={client.preferred_cities?.length ? client.preferred_cities.join(", ") : "—"} />
                  <Field icon={<BedDouble className="h-4 w-4" />} label="Zimmer ab" value={client.rooms_min ?? "—"} />
                  <Field icon={<Ruler className="h-4 w-4" />} label="Fläche ab" value={client.area_min ? `${client.area_min} m²` : "—"} />
                  <Field icon={<Home className="h-4 w-4" />} label="Vermarktung" value={client.preferred_listing ? listingTypeLabels[client.preferred_listing as keyof typeof listingTypeLabels] : "—"} />
                  <Field icon={<Building2 className="h-4 w-4" />} label="Objekttypen" value={
                    client.preferred_types?.length
                      ? client.preferred_types.map((t: string) => propertyTypeLabels[t as keyof typeof propertyTypeLabels]).join(", ")
                      : "—"
                  } />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="mb-3 flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-muted-foreground" />
                  <h3 className="font-display text-lg font-semibold">Notizen</h3>
                </div>
                {client.notes ? (
                  <p className="whitespace-pre-wrap text-sm text-muted-foreground">{client.notes}</p>
                ) : (
                  <p className="text-sm text-muted-foreground">Keine Notizen hinterlegt.</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Nächster Termin */}
          {upcoming.length > 0 && (
            <Card>
              <CardContent className="p-6">
                <h3 className="mb-3 font-display text-lg font-semibold">Nächster Termin</h3>
                <AppointmentRow appt={upcoming[upcoming.length - 1]} />
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Matches */}
        <TabsContent value="matches" className="mt-6">
          <Card><CardContent className="p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-display text-lg font-semibold">Passende Objekte</h3>
              <Button size="sm" asChild>
                <Link to="/matching" search={{ clientId: id }}>
                  <Target className="mr-1.5 h-4 w-4" />Matching öffnen
                </Link>
              </Button>
            </div>
            {matches.length === 0 ? (
              <p className="text-sm text-muted-foreground">Noch keine Matches. Starte das Matching, um passende Objekte zu finden.</p>
            ) : (
              <div className="space-y-2">
                {matches.map((m: any) => (
                  <Link
                    key={m.id} to="/properties/$id" params={{ id: m.property_id }}
                    className="flex items-center justify-between rounded-xl border p-4 transition hover:border-primary hover:shadow-glow"
                  >
                    <div className="flex-1">
                      <p className="font-medium">{m.properties?.title ?? "Objekt"}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {m.properties?.city ?? "—"} · {m.properties?.price ? formatCurrency(Number(m.properties.price)) : "—"}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant="secondary">{Math.round(Number(m.score))}%</Badge>
                      <ExternalLink className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent></Card>
        </TabsContent>

        {/* Termine */}
        <TabsContent value="appointments" className="mt-6 space-y-4">
          <Card><CardContent className="p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-display text-lg font-semibold">Termine</h3>
              <NewAppointmentButton clientId={id} agencyId={client.agency_id} userId={user!.id}
                onCreated={() => qc.invalidateQueries({ queryKey: ["client_appointments", id] })} />
            </div>
            {appointments.length === 0 ? (
              <p className="text-sm text-muted-foreground">Noch keine Termine. Lege den ersten Termin an.</p>
            ) : (
              <div className="space-y-4">
                {upcoming.length > 0 && (
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Bevorstehend</p>
                    <div className="space-y-2">
                      {upcoming.map((a: any) => <AppointmentRow key={a.id} appt={a} />)}
                    </div>
                  </div>
                )}
                {past.length > 0 && (
                  <div>
                    <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Vergangen</p>
                    <div className="space-y-2">
                      {past.map((a: any) => <AppointmentRow key={a.id} appt={a} />)}
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent></Card>
        </TabsContent>

        {/* Eigene Objekte (Verkäufer/Vermieter) */}
        {isSeller && (
          <TabsContent value="properties" className="mt-6">
            <Card><CardContent className="p-6">
              <h3 className="mb-4 font-display text-lg font-semibold">Eigene Objekte</h3>
              {ownProperties.length === 0 ? (
                <p className="text-sm text-muted-foreground">Diesem Kunden sind noch keine Objekte zugeordnet.</p>
              ) : (
                <div className="grid gap-3 md:grid-cols-2">
                  {ownProperties.map((p: any) => (
                    <Link key={p.id} to="/properties/$id" params={{ id: p.id }}
                      className="rounded-xl border p-4 transition hover:border-primary hover:shadow-glow"
                    >
                      <div className="flex items-start justify-between">
                        <p className="font-medium">{p.title}</p>
                        <Badge variant="outline">{propertyStatusLabels[p.status as keyof typeof propertyStatusLabels]}</Badge>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {p.city ?? "—"} · {p.price ? formatCurrency(Number(p.price)) : "—"}
                      </p>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent></Card>
          </TabsContent>
        )}

        {/* Finanzierung */}
        <TabsContent value="financing" className="mt-6">
          <FinancingTab
            clientId={id}
            agencyId={client.agency_id}
            userId={user!.id}
            dossier={dossier}
            links={links}
            onChange={() => {
              qc.invalidateQueries({ queryKey: ["financing_dossier", id] });
              qc.invalidateQueries({ queryKey: ["financing_links"] });
            }}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-background/60 p-3">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">{icon}{label}</div>
      <p className="mt-1 text-lg font-semibold">{value}</p>
    </div>
  );
}

function Field({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-xs uppercase text-muted-foreground">{icon}{label}</div>
      <p className="mt-1 text-sm font-medium">{value}</p>
    </div>
  );
}

function AppointmentRow({ appt }: { appt: any }) {
  return (
    <div className="flex items-center justify-between rounded-xl border p-4">
      <div>
        <p className="font-medium">{appt.title}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {formatDateTime(appt.starts_at)} · {apptTypeLabels[appt.appointment_type as keyof typeof apptTypeLabels]}
          {appt.location ? ` · ${appt.location}` : ""}
        </p>
      </div>
      <Badge variant="outline">{appt.status}</Badge>
    </div>
  );
}

function NewAppointmentButton({
  clientId, agencyId, userId, onCreated,
}: { clientId: string; agencyId: string; userId: string; onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    title: "Besichtigung",
    appointment_type: "viewing" as "viewing" | "meeting" | "call" | "other",
    starts_at: "",
    ends_at: "",
    location: "",
    notes: "",
  });

  const create = useMutation({
    mutationFn: async () => {
      if (!form.title || !form.starts_at || !form.ends_at) throw new Error("Titel, Start und Ende sind erforderlich");
      const { error } = await supabase.from("appointments").insert({
        agency_id: agencyId, owner_id: userId, client_id: clientId,
        title: form.title, appointment_type: form.appointment_type,
        starts_at: new Date(form.starts_at).toISOString(),
        ends_at: new Date(form.ends_at).toISOString(),
        location: form.location || null, notes: form.notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Termin angelegt"); setOpen(false); onCreated(); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button size="sm" onClick={() => setOpen(true)}><CalendarPlus className="mr-1.5 h-4 w-4" />Neuer Termin</Button>
      <DialogContent>
        <DialogHeader><DialogTitle>Neuer Termin</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Titel</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
          <div>
            <Label>Typ</Label>
            <Select value={form.appointment_type} onValueChange={(v: any) => setForm({ ...form, appointment_type: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(apptTypeLabels) as Array<keyof typeof apptTypeLabels>).map(k =>
                  <SelectItem key={k} value={k}>{apptTypeLabels[k]}</SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Start</Label><Input type="datetime-local" value={form.starts_at} onChange={(e) => setForm({ ...form, starts_at: e.target.value })} /></div>
            <div><Label>Ende</Label><Input type="datetime-local" value={form.ends_at} onChange={(e) => setForm({ ...form, ends_at: e.target.value })} /></div>
          </div>
          <div><Label>Ort</Label><Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} /></div>
          <div><Label>Notizen</Label><Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
        </div>
        <DialogFooter>
          <Button onClick={() => create.mutate()} disabled={create.isPending}>Speichern</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditClientDialog({ client, onSaved }: { client: any; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    full_name: client.full_name ?? "",
    email: client.email ?? "",
    phone: client.phone ?? "",
    client_type: client.client_type as typeof TYPES[number],
    notes: client.notes ?? "",
    budget_min: client.budget_min?.toString() ?? "",
    budget_max: client.budget_max?.toString() ?? "",
    rooms_min: client.rooms_min?.toString() ?? "",
    area_min: client.area_min?.toString() ?? "",
    preferred_cities: client.preferred_cities?.join(", ") ?? "",
    preferred_types: (client.preferred_types ?? []) as string[],
    preferred_listing: (client.preferred_listing ?? "sale") as "sale" | "rent",
  });

  useEffect(() => {
    if (open) {
      setForm({
        full_name: client.full_name ?? "",
        email: client.email ?? "",
        phone: client.phone ?? "",
        client_type: client.client_type,
        notes: client.notes ?? "",
        budget_min: client.budget_min?.toString() ?? "",
        budget_max: client.budget_max?.toString() ?? "",
        rooms_min: client.rooms_min?.toString() ?? "",
        area_min: client.area_min?.toString() ?? "",
        preferred_cities: client.preferred_cities?.join(", ") ?? "",
        preferred_types: client.preferred_types ?? [],
        preferred_listing: client.preferred_listing ?? "sale",
      });
    }
  }, [open, client]);

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("clients").update({
        full_name: form.full_name,
        email: form.email || null,
        phone: form.phone || null,
        client_type: form.client_type,
        notes: form.notes || null,
        budget_min: form.budget_min ? Number(form.budget_min) : null,
        budget_max: form.budget_max ? Number(form.budget_max) : null,
        rooms_min: form.rooms_min ? Number(form.rooms_min) : null,
        area_min: form.area_min ? Number(form.area_min) : null,
        preferred_cities: form.preferred_cities ? form.preferred_cities.split(",").map((s: string) => s.trim()).filter(Boolean) : null,
        preferred_types: form.preferred_types.length ? (form.preferred_types as Array<"apartment" | "house" | "commercial" | "land" | "other">) : null,
        preferred_listing: form.preferred_listing,
      }).eq("id", client.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Gespeichert"); setOpen(false); onSaved(); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Pencil className="mr-1.5 h-4 w-4" />Bearbeiten
      </Button>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader><DialogTitle>Kunde bearbeiten</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Name</Label><Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></div>
            <div>
              <Label>Typ</Label>
              <Select value={form.client_type} onValueChange={(v: any) => setForm({ ...form, client_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{TYPES.map(t => <SelectItem key={t} value={t}>{clientTypeLabels[t]}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>E-Mail</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            <div><Label>Telefon</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
          </div>

          <div className="rounded-xl border bg-muted/30 p-4">
            <p className="mb-3 text-sm font-semibold">Suchprofil</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Vermarktung</Label>
                <Select value={form.preferred_listing} onValueChange={(v: any) => setForm({ ...form, preferred_listing: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="sale">Kauf</SelectItem><SelectItem value="rent">Miete</SelectItem></SelectContent>
                </Select>
              </div>
              <div><Label>Städte (Komma-getrennt)</Label><Input value={form.preferred_cities} onChange={(e) => setForm({ ...form, preferred_cities: e.target.value })} /></div>
              <div><Label>Budget min (€)</Label><Input type="number" value={form.budget_min} onChange={(e) => setForm({ ...form, budget_min: e.target.value })} /></div>
              <div><Label>Budget max (€)</Label><Input type="number" value={form.budget_max} onChange={(e) => setForm({ ...form, budget_max: e.target.value })} /></div>
              <div><Label>Zimmer min</Label><Input type="number" value={form.rooms_min} onChange={(e) => setForm({ ...form, rooms_min: e.target.value })} /></div>
              <div><Label>Fläche min (m²)</Label><Input type="number" value={form.area_min} onChange={(e) => setForm({ ...form, area_min: e.target.value })} /></div>
            </div>
            <div className="mt-3">
              <Label>Bevorzugte Objekttypen</Label>
              <div className="mt-2 flex flex-wrap gap-2">
                {PROP_TYPES.map(t => {
                  const sel = form.preferred_types.includes(t);
                  return (
                    <button type="button" key={t} onClick={() => setForm({
                      ...form,
                      preferred_types: sel ? form.preferred_types.filter((x: string) => x !== t) : [...form.preferred_types, t],
                    })} className={`rounded-full border px-3 py-1 text-xs transition ${sel ? "border-primary bg-primary text-primary-foreground" : "bg-background"}`}>
                      {propertyTypeLabels[t]}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div><Label>Notizen</Label><Textarea rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
        </div>
        <DialogFooter>
          <Button onClick={() => save.mutate()} disabled={!form.full_name || save.isPending}>Speichern</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function generateToken() {
  const arr = new Uint8Array(24);
  crypto.getRandomValues(arr);
  return Array.from(arr).map(b => b.toString(16).padStart(2, "0")).join("");
}

function FinancingTab({
  clientId, agencyId, userId, dossier, links, onChange,
}: {
  clientId: string;
  agencyId: string;
  userId: string;
  dossier: any;
  links: any[];
  onChange: () => void;
}) {
  const [generating, setGenerating] = useState(false);

  const ensureDossier = async (): Promise<string> => {
    if (dossier?.id) return dossier.id;
    const { data, error } = await supabase
      .from("financing_dossiers")
      .insert({ client_id: clientId, agency_id: agencyId })
      .select().single();
    if (error) throw error;
    return data.id;
  };

  const handleGenerateLink = async () => {
    setGenerating(true);
    try {
      const dossierId = await ensureDossier();
      const token = generateToken();
      const { error } = await supabase.from("financing_links").insert({
        dossier_id: dossierId, agency_id: agencyId, token, created_by: userId,
      });
      if (error) throw error;
      toast.success("Link generiert");
      onChange();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setGenerating(false);
    }
  };

  const handleSelfFill = async () => {
    try {
      await ensureDossier();
      onChange();
      toast.info("Bearbeitung folgt in Schritt 2");
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const copyLink = (token: string) => {
    const url = `${window.location.origin}/finanzierung/${token}`;
    navigator.clipboard.writeText(url);
    toast.success("Link kopiert");
  };

  const activeLink = links.find(l => !l.used_at && new Date(l.expires_at) > new Date());

  if (!dossier) {
    return (
      <Card><CardContent className="p-8 text-center">
        <FileSignature className="mx-auto h-10 w-10 text-muted-foreground" />
        <h3 className="mt-4 font-display text-lg font-semibold">Noch keine Finanzierungsangaben</h3>
        <p className="mt-1 text-sm text-muted-foreground">Wie möchtest du starten?</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Button onClick={handleSelfFill}><Pencil className="mr-1.5 h-4 w-4" />Selbst ausfüllen</Button>
          <Button variant="outline" onClick={handleGenerateLink} disabled={generating}>
            <Link2 className="mr-1.5 h-4 w-4" />Link für Kunden generieren
          </Button>
        </div>
      </CardContent></Card>
    );
  }

  const isComplete = dossier.completion_percent >= 100;
  const submittedDate = dossier.submitted_at ? new Date(dossier.submitted_at).toLocaleDateString("de-DE") : null;

  return (
    <div className="space-y-6">
      <Card><CardContent className="p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Badge className={isComplete ? "bg-emerald-600 hover:bg-emerald-600" : "bg-orange-500 hover:bg-orange-500"}>
                {isComplete ? "Vollständig" : "Unvollständig"}
              </Badge>
              <Badge variant="outline">
                {dossier.status === "draft" ? "Entwurf" : dossier.status === "submitted" ? "Eingereicht" : "Geprüft"}
              </Badge>
            </div>
            {submittedDate && <p className="mt-2 text-sm text-muted-foreground">Ausgefüllt am {submittedDate}</p>}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleSelfFill}><Pencil className="mr-1.5 h-4 w-4" />Bearbeiten</Button>
            <Button variant="outline" onClick={handleGenerateLink} disabled={generating}>
              <RefreshCw className="mr-1.5 h-4 w-4" />Neu generieren (Link)
            </Button>
          </div>
        </div>

        <div className="mt-6">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Vollständigkeit</span>
            <span className="font-medium">{dossier.completion_percent}%</span>
          </div>
          <Progress value={dossier.completion_percent} />
        </div>
      </CardContent></Card>

      {activeLink && (
        <Card><CardContent className="p-6">
          <p className="text-xs uppercase text-muted-foreground">Aktiver Kundenlink</p>
          <div className="mt-2 flex items-center gap-2">
            <code className="flex-1 truncate rounded-lg border bg-muted/50 px-3 py-2 text-xs">
              {window.location.origin}/finanzierung/{activeLink.token}
            </code>
            <Button size="icon" variant="outline" onClick={() => copyLink(activeLink.token)}>
              <Copy className="h-4 w-4" />
            </Button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Gültig bis {new Date(activeLink.expires_at).toLocaleDateString("de-DE")}
          </p>
        </CardContent></Card>
      )}
    </div>
  );
}
