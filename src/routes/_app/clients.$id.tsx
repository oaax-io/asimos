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
  ArrowLeft, Mail, Phone, Trash2, RefreshCw, Pencil, FileSignature,
  Calendar, Target, Home, MapPin, Euro, Ruler, BedDouble, Building2, MessageSquare,
  CalendarPlus, ExternalLink, CheckSquare, FileText, Activity, Plus,
  ClipboardList, Heart,
} from "lucide-react";
import {
  clientTypeLabels, formatCurrency, formatDate, formatDateTime,
  propertyTypeLabels, propertyStatusLabels, listingTypeLabels, apptTypeLabels,
} from "@/lib/format";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { MatchPanel } from "@/components/matching/MatchPanel";
import { ClientSelfDisclosureTab } from "@/components/clients/ClientSelfDisclosureTab";
import { ClientRelationshipsTab } from "@/components/clients/ClientRelationshipsTab";
import { ClientProfileSummary } from "@/components/clients/ClientProfileSummary";
import { ClientEditDialog } from "@/components/clients/ClientEditDialog";
import { BenchmarkCard } from "@/components/clients/BenchmarkCard";
import { SelfDisclosureLinkCard } from "@/components/clients/SelfDisclosureLinkCard";
import { useClientBenchmark } from "@/hooks/useClientBenchmark";
import { GeneratedDocumentsTable } from "@/components/documents/GeneratedDocumentsTable";
import { FinancingQuickCheckWizard } from "@/components/financing/FinancingQuickCheckWizard";

export const Route = createFileRoute("/_app/clients/$id")({ component: ClientDetail });

const TYPES = ["buyer", "seller", "owner", "tenant", "landlord"] as const;
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

  const { data: dossiers = [] } = useQuery({
    queryKey: ["client_financing_dossiers", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financing_dossiers").select("*").eq("client_id", id)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    retry: false,
  });

  // Erstes/aktuelles Dossier (für Hero-KPI und Selbstauskunft-Link)
  const dossier = dossiers[0] ?? null;

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

  const { data: clientStatusFlags } = useQuery({
    queryKey: ["client_status_flags", id],
    queryFn: async () => {
      const [sd, fp, rv] = await Promise.all([
        supabase.from("client_self_disclosures").select("status").eq("client_id", id).in("status", ["submitted", "reviewed"]).limit(1),
        supabase.from("financing_profiles").select("profile_status,approval_status").eq("client_id", id).maybeSingle(),
        supabase.from("reservations").select("id,status").eq("client_id", id).in("status", ["sent", "signed"]).limit(1),
      ]);
      return {
        selfDisclosureSubmitted: (sd.data?.length ?? 0) > 0,
        financing: fp.data ?? null,
        hasActiveReservation: (rv.data?.length ?? 0) > 0,
      };
    },
    retry: false,
  });

  const { data: benchmarkData } = useClientBenchmark(id);
  const benchmark = benchmarkData?.benchmark ?? null;

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
          <ClientEditDialog client={client} onSaved={() => qc.invalidateQueries({ queryKey: ["client", id] })} />
          <Button variant="outline" size="icon" onClick={() => { if (confirm("Wirklich löschen?")) del.mutate(); }}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Hero */}
      <div className="mb-6 rounded-2xl border bg-gradient-to-br from-primary/5 via-background to-background p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">{clientTypeLabels[client.client_type as keyof typeof clientTypeLabels]}</Badge>
              {clientStatusFlags?.selfDisclosureSubmitted && (
                <Badge className="bg-emerald-600 hover:bg-emerald-600">Selbstauskunft eingereicht</Badge>
              )}
              {clientStatusFlags?.financing && (
                clientStatusFlags.financing.approval_status === "approved" || clientStatusFlags.financing.profile_status === "complete" ? (
                  <Badge className="bg-emerald-600 hover:bg-emerald-600">Finanzierung bereit</Badge>
                ) : (
                  <Badge className="bg-amber-500 hover:bg-amber-500">Finanzierung in Prüfung</Badge>
                )
              )}
              {clientStatusFlags?.hasActiveReservation && (
                <Badge className="bg-amber-500 hover:bg-amber-500">Aktive Reservation</Badge>
              )}
            </div>
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
        <TabsList className="flex-wrap">
          <TabsTrigger value="overview">Übersicht</TabsTrigger>
          <TabsTrigger value="consulting">
            <MessageSquare className="mr-1.5 h-4 w-4" />Beratung & Aktivität
            {appointments.length > 0 && (
              <Badge variant="secondary" className="ml-2">{appointments.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="financing">
            <FileSignature className="mr-1.5 h-4 w-4" />Finanzierung & Selbstauskunft
            {dossier && (
              <Badge variant="secondary" className="ml-2">{dossier.completion_percent}%</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="search">
            <Target className="mr-1.5 h-4 w-4" />Suchprofil & Matching
            {matches.length > 0 && (
              <Badge variant="secondary" className="ml-2">{matches.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="relationships">
            <Heart className="mr-1.5 h-4 w-4" />Beziehungen
          </TabsTrigger>
          <TabsTrigger value="documents">
            <FileText className="mr-1.5 h-4 w-4" />Dokumente
          </TabsTrigger>
        </TabsList>

        {/* 1. Übersicht */}
        <TabsContent value="overview" className="mt-6 space-y-4">
          <BenchmarkOrPlaceholder benchmark={benchmark} />
          <ClientProfileSummary clientId={id} entityType={client.entity_type} />
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

          {upcoming.length > 0 && (
            <Card>
              <CardContent className="p-6">
                <h3 className="mb-3 font-display text-lg font-semibold">Nächster Termin</h3>
                <AppointmentRow appt={upcoming[upcoming.length - 1]} />
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* 2. Beratung & Aktivität */}
        <TabsContent value="consulting" className="mt-6">
          <Tabs defaultValue="appointments">
            <TabsList>
              <TabsTrigger value="appointments">
                <Calendar className="mr-1.5 h-4 w-4" />Termine
              </TabsTrigger>
              <TabsTrigger value="tasks">
                <CheckSquare className="mr-1.5 h-4 w-4" />Aufgaben
              </TabsTrigger>
              <TabsTrigger value="activity">
                <Activity className="mr-1.5 h-4 w-4" />Notizen & Aktivität
              </TabsTrigger>
            </TabsList>
            <TabsContent value="appointments" className="mt-4 space-y-4">
              <Card><CardContent className="p-6">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="font-display text-lg font-semibold">Termine</h3>
                  <NewAppointmentButton clientId={id} userId={user!.id}
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
            <TabsContent value="tasks" className="mt-4">
              <ClientTasksTab clientId={id} userId={user!.id} />
            </TabsContent>
            <TabsContent value="activity" className="mt-4">
              <ClientActivityTab clientId={id} userId={user!.id} notes={client.notes} />
            </TabsContent>
          </Tabs>
        </TabsContent>

        {/* 3. Finanzierung & Selbstauskunft */}
        <TabsContent value="financing" className="mt-6">
          <div className="space-y-4">
            <BenchmarkOrPlaceholder benchmark={benchmark} compact />
            <Tabs defaultValue="disclosure">
              <TabsList>
                <TabsTrigger value="disclosure">
                  <ClipboardList className="mr-1.5 h-4 w-4" />Selbstauskunft
                </TabsTrigger>
                <TabsTrigger value="dossier">
                  <FileSignature className="mr-1.5 h-4 w-4" />Finanzierungs-Dossier
                  {dossier && (
                    <Badge variant="secondary" className="ml-2">{dossier.completion_percent}%</Badge>
                  )}
                </TabsTrigger>
              </TabsList>
              <TabsContent value="disclosure" className="mt-4 space-y-4">
                <SelfDisclosureLinkCard
                  clientId={id}
                  clientEmail={client.email}
                  userId={user!.id}
                />
                <ClientSelfDisclosureTab clientId={id} />
              </TabsContent>
              <TabsContent value="dossier" className="mt-4">
                <FinancingTab
                  clientId={id}
                  dossiers={dossiers}
                  onChange={() => {
                    qc.invalidateQueries({ queryKey: ["client_financing_dossiers", id] });
                  }}
                />
              </TabsContent>
            </Tabs>
          </div>
        </TabsContent>

        {/* 4. Suchprofil & Matching */}
        <TabsContent value="search" className="mt-6 space-y-4">
          <Card><CardContent className="p-6">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="font-display text-lg font-semibold">Passende Objekte</h3>
                <p className="text-xs text-muted-foreground">Auf Basis von Suchprofil, Budget, Lage und Eckdaten.</p>
              </div>
              <Button size="sm" variant="outline" asChild>
                <Link to="/matching" search={{ clientId: id }}>
                  <Target className="mr-1.5 h-4 w-4" />Matching-Übersicht
                </Link>
              </Button>
            </div>
            {benchmark && (benchmark.status === "tight" || benchmark.status === "critical") && (
              <div className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-400">
                Hinweis: Finanz-Benchmark ist «{benchmark.status === "tight" ? "knapp" : "kritisch"}». Tragfähigkeit vor Vermittlung prüfen.
              </div>
            )}
            <MatchPanel direction="client-to-property" client={client} />
          </CardContent></Card>

          {isSeller && (
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
          )}
        </TabsContent>

        {/* 5. Beziehungen */}
        <TabsContent value="relationships" className="mt-6">
          <ClientRelationshipsTab clientId={id} />
        </TabsContent>

        {/* 6. Dokumente */}
        <TabsContent value="documents" className="mt-6">
          <ClientDocumentsTab clientId={id} userId={user!.id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function BenchmarkOrPlaceholder({
  benchmark,
  compact,
}: {
  benchmark: any;
  compact?: boolean;
}) {
  if (benchmark) {
    return <BenchmarkCard benchmark={benchmark} variant={compact ? "compact" : "full"} />;
  }
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col gap-3 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <ClipboardList className="h-5 w-5" />
          </div>
          <div>
            <p className="font-medium">Finanz-Benchmark noch leer</p>
            <p className="text-sm text-muted-foreground">
              Selbstauskunft erfassen – die Reservequote wird live berechnet.
            </p>
          </div>
        </div>
        <p className="text-xs text-muted-foreground sm:text-right">
          Wechsle zum Tab «Finanzierung & Selbstauskunft»,<br className="hidden sm:inline" />
          um Einnahmen und Ausgaben zu erfassen oder einen externen Link zu senden.
        </p>
      </CardContent>
    </Card>
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
  clientId, userId, onCreated,
}: { clientId: string; userId: string; onCreated: () => void }) {
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
        owner_id: userId, client_id: clientId,
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
              <div><Label>Budget min (CHF)</Label><Input type="number" value={form.budget_min} onChange={(e) => setForm({ ...form, budget_min: e.target.value })} /></div>
              <div><Label>Budget max (CHF)</Label><Input type="number" value={form.budget_max} onChange={(e) => setForm({ ...form, budget_max: e.target.value })} /></div>
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

function FinancingTab({
  clientId, dossiers, onChange,
}: {
  clientId: string;
  dossiers: any[];
  onChange: () => void;
}) {
  const [wizardOpen, setWizardOpen] = useState(false);
  const navigate = useNavigate();

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-display text-lg font-semibold">Finanzierungs-Dossiers</h3>
            <p className="text-sm text-muted-foreground">
              Zentrale Finanzierungen für diesen Kunden. Jedes Dossier kann
              Quick Check, Selbstauskunft, Dokumente und Bank-Einreichung enthalten.
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => setWizardOpen(true)}>
              <Plus className="mr-1.5 h-4 w-4" />Neues Finanzierungsdossier
            </Button>
          </div>
        </CardContent>
      </Card>

      {dossiers.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <FileSignature className="mx-auto h-10 w-10 text-muted-foreground" />
            <h3 className="mt-4 font-display text-lg font-semibold">Noch kein Finanzierungsdossier</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Starte einen Quick Check, um die Finanzierbarkeit für diesen Kunden zu prüfen.
            </p>
            <div className="mt-6">
              <Button onClick={() => setWizardOpen(true)}>
                <Plus className="mr-1.5 h-4 w-4" />Quick Check starten
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {dossiers.map((d: any) => (
            <Card key={d.id} className="transition hover:shadow-md">
              <CardContent className="flex flex-wrap items-start gap-4 p-4">
                <div className="flex-1 min-w-0 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium truncate">
                      {d.title || `Dossier vom ${formatDate(d.created_at)}`}
                    </p>
                    {d.financing_type && (
                      <Badge variant="secondary">{d.financing_type}</Badge>
                    )}
                    <Badge variant="outline">
                      {d.dossier_status ?? "draft"}
                    </Badge>
                    {d.quick_check_status && (
                      <Badge variant="outline">{d.quick_check_status}</Badge>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    {d.requested_mortgage != null && <span>Hypothek: {formatCurrency(Number(d.requested_mortgage))}</span>}
                    {d.loan_to_value_ratio != null && <span>Belehnung: {Number(d.loan_to_value_ratio).toFixed(1)}%</span>}
                    {d.affordability_ratio != null && <span>Tragbarkeit: {Number(d.affordability_ratio).toFixed(1)}%</span>}
                    {d.bank_name && <span>Bank: {d.bank_name}</span>}
                    <span>Aktualisiert {formatDate(d.updated_at)}</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate({ to: "/financing/$id", params: { id: d.id } })}
                  >
                    <Pencil className="mr-1.5 h-4 w-4" />Bearbeiten
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <FinancingQuickCheckWizard
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        defaultClientId={clientId}
        onCreated={(id: string) => {
          setWizardOpen(false);
          onChange();
          navigate({ to: "/financing/$id", params: { id } });
        }}
      />
    </div>
  );
}

function ClientTasksTab({ clientId, userId }: { clientId: string; userId: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", due_date: "", priority: "normal" });

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ["client_tasks", clientId],
    queryFn: async () => {
      const { data } = await supabase.from("tasks").select("*")
        .eq("related_type", "client").eq("related_id", clientId)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      if (!form.title.trim()) throw new Error("Titel erforderlich");
      const { error } = await supabase.from("tasks").insert({
        title: form.title.trim(), description: form.description || null,
        due_date: form.due_date ? new Date(form.due_date).toISOString() : null,
        priority: form.priority as any,
        related_type: "client", related_id: clientId, created_by: userId,
      });
      if (error) throw error;
      await supabase.from("activity_logs").insert({
        actor_id: userId, action: `Aufgabe erstellt: ${form.title.trim()}`,
        related_type: "client", related_id: clientId,
      });
    },
    onSuccess: () => {
      toast.success("Aufgabe erstellt");
      setOpen(false); setForm({ title: "", description: "", due_date: "", priority: "normal" });
      qc.invalidateQueries({ queryKey: ["client_tasks", clientId] });
      qc.invalidateQueries({ queryKey: ["client_activity", clientId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const toggle = useMutation({
    mutationFn: async (t: any) => {
      const { error } = await supabase.from("tasks")
        .update({ status: t.status === "done" ? "open" : "done" }).eq("id", t.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["client_tasks", clientId] }),
  });

  return (
    <Card><CardContent className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-display text-lg font-semibold">Aufgaben</h3>
        <Dialog open={open} onOpenChange={setOpen}>
          <Button size="sm" onClick={() => setOpen(true)}><Plus className="mr-1.5 h-4 w-4" />Neue Aufgabe</Button>
          <DialogContent>
            <DialogHeader><DialogTitle>Neue Aufgabe</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Titel</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
              <div><Label>Beschreibung</Label><Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Fällig</Label><Input type="datetime-local" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} /></div>
                <div>
                  <Label>Priorität</Label>
                  <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Niedrig</SelectItem>
                      <SelectItem value="normal">Normal</SelectItem>
                      <SelectItem value="high">Hoch</SelectItem>
                      <SelectItem value="urgent">Dringend</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <DialogFooter><Button onClick={() => create.mutate()} disabled={!form.title || create.isPending}>Speichern</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      {isLoading ? <p className="text-sm text-muted-foreground">Lädt…</p>
        : tasks.length === 0 ? <p className="text-sm text-muted-foreground">Noch keine Aufgaben für diesen Kunden.</p>
        : <div className="space-y-2">
            {tasks.map((t: any) => (
              <div key={t.id} className="flex items-start gap-3 rounded-xl border p-3">
                <button onClick={() => toggle.mutate(t)} className={`mt-0.5 flex h-5 w-5 items-center justify-center rounded border ${t.status === "done" ? "bg-primary border-primary text-primary-foreground" : ""}`}>
                  {t.status === "done" && <CheckSquare className="h-3 w-3" />}
                </button>
                <div className="flex-1">
                  <p className={`text-sm font-medium ${t.status === "done" ? "line-through text-muted-foreground" : ""}`}>{t.title}</p>
                  {t.description && <p className="mt-0.5 text-xs text-muted-foreground">{t.description}</p>}
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    {t.due_date && <span>Fällig: {formatDate(t.due_date)}</span>}
                    {t.priority && <Badge variant="outline" className="text-[10px]">{t.priority}</Badge>}
                  </div>
                </div>
              </div>
            ))}
          </div>}
    </CardContent></Card>
  );
}

function ClientDocumentsTab({ clientId, userId }: { clientId: string; userId: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ file_name: "", file_url: "", document_type: "other", notes: "" });

  const { data: docs = [], isLoading } = useQuery({
    queryKey: ["client_documents", clientId],
    queryFn: async () => {
      const { data } = await supabase.from("documents").select("*")
        .eq("related_type", "client").eq("related_id", clientId)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      if (!form.file_url.trim()) throw new Error("URL erforderlich");
      const { error } = await supabase.from("documents").insert({
        file_url: form.file_url.trim(), file_name: form.file_name || null,
        document_type: form.document_type as any, notes: form.notes || null,
        related_type: "client", related_id: clientId, uploaded_by: userId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Dokument hinzugefügt");
      setOpen(false); setForm({ file_name: "", file_url: "", document_type: "other", notes: "" });
      qc.invalidateQueries({ queryKey: ["client_documents", clientId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Card><CardContent className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-display text-lg font-semibold">Dokumente</h3>
        <Dialog open={open} onOpenChange={setOpen}>
          <Button size="sm" onClick={() => setOpen(true)}><Plus className="mr-1.5 h-4 w-4" />Dokument hinzufügen</Button>
          <DialogContent>
            <DialogHeader><DialogTitle>Dokument hinzufügen</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Name</Label><Input value={form.file_name} onChange={(e) => setForm({ ...form, file_name: e.target.value })} /></div>
              <div><Label>URL / Link</Label><Input value={form.file_url} onChange={(e) => setForm({ ...form, file_url: e.target.value })} /></div>
              <div>
                <Label>Typ</Label>
                <Select value={form.document_type} onValueChange={(v) => setForm({ ...form, document_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="contract">Vertrag</SelectItem>
                    <SelectItem value="id">Ausweis</SelectItem>
                    <SelectItem value="financing">Finanzierung</SelectItem>
                    <SelectItem value="expose">Exposé</SelectItem>
                    <SelectItem value="other">Sonstige</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Notizen</Label><Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
            </div>
            <DialogFooter><Button onClick={() => create.mutate()} disabled={!form.file_url || create.isPending}>Speichern</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      {isLoading ? <p className="text-sm text-muted-foreground">Lädt…</p>
        : docs.length === 0 ? <p className="text-sm text-muted-foreground">Noch keine hochgeladenen Dokumente.</p>
        : <div className="space-y-2">
            {docs.map((d: any) => (
              <a key={d.id} href={d.file_url} target="_blank" rel="noreferrer"
                className="flex items-center justify-between gap-3 rounded-xl border p-3 transition hover:border-primary hover:bg-accent/30">
                <div className="flex items-center gap-3 min-w-0">
                  <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{d.file_name ?? d.file_url}</p>
                    <p className="text-xs text-muted-foreground">{d.document_type} · {formatDate(d.created_at)}</p>
                  </div>
                </div>
                <ExternalLink className="h-4 w-4 shrink-0 text-muted-foreground" />
              </a>
            ))}
          </div>}

      <div className="mt-8">
        <h3 className="mb-3 font-display text-lg font-semibold">Generierte Dokumente</h3>
        <GeneratedDocumentsTable filterRelatedType="client" filterRelatedId={clientId} />
      </div>
    </CardContent></Card>
  );
}

function ClientActivityTab({ clientId, userId, notes }: { clientId: string; userId: string; notes: string | null }) {
  const qc = useQueryClient();
  const [note, setNote] = useState("");

  const { data: activity = [], isLoading } = useQuery({
    queryKey: ["client_activity", clientId],
    queryFn: async () => {
      const { data } = await supabase.from("activity_logs").select("*")
        .eq("related_type", "client").eq("related_id", clientId)
        .order("created_at", { ascending: false }).limit(100);
      return data ?? [];
    },
  });

  const addNote = useMutation({
    mutationFn: async () => {
      if (!note.trim()) throw new Error("Notiz darf nicht leer sein");
      const { error } = await supabase.from("activity_logs").insert({
        actor_id: userId, action: note.trim(),
        related_type: "client", related_id: clientId, metadata: { type: "note" },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Notiz hinzugefügt"); setNote("");
      qc.invalidateQueries({ queryKey: ["client_activity", clientId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      {notes && (
        <Card><CardContent className="p-6">
          <h3 className="mb-2 font-display text-lg font-semibold">Stammnotiz</h3>
          <p className="whitespace-pre-wrap text-sm text-muted-foreground">{notes}</p>
        </CardContent></Card>
      )}
      <Card><CardContent className="p-6">
        <h3 className="mb-3 font-display text-lg font-semibold">Notiz hinzufügen</h3>
        <Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Was ist passiert?" />
        <div className="mt-3 flex justify-end">
          <Button size="sm" onClick={() => addNote.mutate()} disabled={!note.trim() || addNote.isPending}>
            <Plus className="mr-1.5 h-4 w-4" />Speichern
          </Button>
        </div>
      </CardContent></Card>
      <Card><CardContent className="p-6">
        <h3 className="mb-4 font-display text-lg font-semibold">Aktivitätsverlauf</h3>
        {isLoading ? <p className="text-sm text-muted-foreground">Lädt…</p>
          : activity.length === 0 ? <p className="text-sm text-muted-foreground">Noch keine Aktivität.</p>
          : <div className="space-y-3">
              {activity.map((a: any) => (
                <div key={a.id} className="flex items-start gap-3 rounded-xl border p-3">
                  <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" />
                  <div className="flex-1">
                    <p className="text-sm">{a.action}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{formatDateTime(a.created_at)}</p>
                  </div>
                </div>
              ))}
            </div>}
      </CardContent></Card>
    </div>
  );
}
