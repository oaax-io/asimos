import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft, MapPin, Bed, Bath, Maximize, Calendar, Zap, FileText, Trash2, Pencil, Plus, ExternalLink, CheckCircle2, Circle, Image as ImageIcon, User, Building2, Layers3, Banknote, Activity, TrendingUp, Sparkles, RefreshCw } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState } from "@/components/EmptyState";
import { PropertyWizard, type WizardSubmit } from "@/components/properties/PropertyWizard";
import { formatCurrency, formatArea, formatDate, formatDateTime, propertyTypeLabels, propertyStatusLabels, listingTypeLabels, getPropertyStatusBadgeClass, getPropertyStatusDotClass } from "@/lib/format";
import { toast } from "sonner";
import { MatchPanel } from "@/components/matching/MatchPanel";
import { matchPropertyToClients } from "@/lib/matching";
import { GeneratedDocumentsTable } from "@/components/documents/GeneratedDocumentsTable";
import { PropertyOwnersTab } from "@/components/properties/PropertyOwnersTab";
import { FinancingQuickCheckWizard } from "@/components/financing/FinancingQuickCheckWizard";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_app/properties/$id")({ component: PropertyDetail });

const STATUSES = ["draft","preparation","active","available","reserved","sold","rented","archived"] as const;

function getMediaPublicUrl(path?: string | null) {
  if (!path) return "";
  if (path.startsWith("http")) return path;
  return supabase.storage.from("media").getPublicUrl(path).data.publicUrl;
}

function PropertyDetail() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [editOpen, setEditOpen] = useState(false);
  const [financingOpen, setFinancingOpen] = useState(false);
  const [tab, setTab] = useState("overview");

  const { data: p, isLoading } = useQuery({
    queryKey: ["property", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("properties").select("*").eq("id", id).single();
      if (error) throw error;
      return data;
    },
  });

  const { data: employees = [] } = useQuery({
    queryKey: ["employees"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id, full_name, email").eq("is_active", true);
      return data ?? [];
    },
  });

  const { data: statusFlags } = useQuery({
    queryKey: ["property_status_flags", id],
    queryFn: async () => {
      const [m, n] = await Promise.all([
        supabase.from("mandates").select("id,status").eq("property_id", id).in("status", ["active", "signed"]).limit(1),
        supabase.from("nda_agreements").select("id").eq("property_id", id).limit(1),
      ]);
      return {
        hasActiveMandate: (m.data?.length ?? 0) > 0,
        hasNda: (n.data?.length ?? 0) > 0,
      };
    },
  });

  const { data: units = [] } = useQuery({
    queryKey: ["property_units", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("properties")
        .select("id,title,unit_number,unit_type,unit_floor,unit_status,rooms,living_area,price,rent,listing_type,status,property_type")
        .eq("parent_property_id", id)
        .order("unit_number", { ascending: true });
      return data ?? [];
    },
    enabled: !!id && !!p && !p.is_unit,
  });

  const { data: parent } = useQuery({
    queryKey: ["property_parent", p?.parent_property_id],
    queryFn: async () => {
      if (!p?.parent_property_id) return null;
      const { data } = await supabase.from("properties").select("id,title,address,city").eq("id", p.parent_property_id).single();
      return data;
    },
    enabled: !!p?.is_unit && !!p?.parent_property_id,
  });

  const { data: currentOwners = [] } = useQuery({
    queryKey: ["property_current_owners", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("property_ownerships")
        .select("client_id, ownership_type, client:clients!property_ownerships_client_id_fkey(id, full_name)")
        .eq("property_id", id)
        .is("end_date", null);
      return (data ?? []) as unknown as Array<{
        client_id: string;
        ownership_type: string;
        client: { id: string; full_name: string } | null;
      }>;
    },
    enabled: !!id,
  });

  const { data: counts } = useQuery({
    queryKey: ["property_counts", id, p?.updated_at],
    queryFn: async () => {
      const head = { count: "exact" as const, head: true };
      const [storedMatches, allClients, d, a, md] = await Promise.all([
        supabase.from("matches").select("property_id, client_id").eq("property_id", id),
        supabase.from("clients").select("*"),
        supabase.from("documents").select("id", head).eq("related_type", "property").eq("related_id", id),
        supabase.from("appointments").select("id", head).eq("property_id", id),
        supabase.from("mandates").select("id", head).eq("property_id", id),
      ]);
      // Live-Matches berechnen (entspricht MatchPanel: score >= 40)
      const computed = p ? matchPropertyToClients(p as any, (allClients.data ?? []) as any[], 40) : [];
      const ids = new Set<string>(computed.map((c) => c.client.id));
      (storedMatches.data ?? []).forEach((m: any) => ids.add(m.client_id));
      return {
        matches: ids.size,
        documents: d.count ?? 0,
        appointments: a.count ?? 0,
        mandates: md.count ?? 0,
      };
    },
    enabled: !!id && !!p,
  });

  const { data: activities = [] } = useQuery({
    queryKey: ["property_activities", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("activity_logs")
        .select("id, action, created_at, actor_id, metadata")
        .eq("related_type", "property")
        .eq("related_id", id)
        .order("created_at", { ascending: false })
        .limit(200);
      return data ?? [];
    },
    enabled: !!id,
  });

  const update = useMutation({
    mutationFn: async (payload: WizardSubmit) => {
      const newOwnerId =
        (payload.property as any)?.owner_client_id ??
        (payload.property as any)?.seller_client_id ??
        null;
      const prevOwnerId = p?.owner_client_id ?? p?.seller_client_id ?? null;

      const { error } = await supabase.from("properties").update(payload.property as any).eq("id", id);
      if (error) throw error;

      // Eigentümer-Historie synchron halten
      if (newOwnerId && newOwnerId !== prevOwnerId) {
        const today = new Date().toISOString().slice(0, 10);
        // Alte aktive Eigentümer schließen
        await supabase
          .from("property_ownerships")
          .update({ end_date: today, ownership_type: "former_owner" })
          .eq("property_id", id)
          .is("end_date", null);
        await supabase
          .from("client_roles")
          .update({ status: "completed", end_date: today, role_type: "former_owner" })
          .eq("related_type", "property")
          .eq("related_id", id)
          .eq("role_type", "owner")
          .eq("status", "active");
        // Neuen Eigentümer setzen
        await supabase.from("property_ownerships").insert({
          property_id: id,
          client_id: newOwnerId,
          ownership_type: "owner",
          start_date: today,
          source: "manual",
          is_primary_contact: true,
        });
        await supabase.from("client_roles").insert({
          client_id: newOwnerId,
          role_type: "owner",
          related_type: "property",
          related_id: id,
          status: "active",
          start_date: today,
        });
      } else if (newOwnerId && prevOwnerId && newOwnerId === prevOwnerId) {
        // Sicherstellen, dass mindestens ein aktiver Eintrag existiert
        const { data: existing } = await supabase
          .from("property_ownerships")
          .select("id")
          .eq("property_id", id)
          .is("end_date", null)
          .limit(1);
        if (!existing || existing.length === 0) {
          const today = new Date().toISOString().slice(0, 10);
          await supabase.from("property_ownerships").insert({
            property_id: id,
            client_id: newOwnerId,
            ownership_type: "owner",
            start_date: today,
            source: "manual",
            is_primary_contact: true,
          });
        }
      }

      const { error: deleteMediaError } = await supabase.from("property_media").delete().eq("property_id", id);
      if (deleteMediaError) throw deleteMediaError;

      if (payload.media.length > 0) {
        const mediaRows = payload.media.map((m, index) => ({
          property_id: id,
          file_url: m.file_url,
          file_name: m.file_name,
          file_type: m.file_type,
          title: m.title,
          is_cover: m.is_cover,
          sort_order: index + 1,
        }));
        const { error: mediaError } = await supabase.from("property_media").insert(mediaRows as any);
        if (mediaError) throw mediaError;
      }

      await supabase.from("activity_logs").insert({
        actor_id: user?.id ?? null,
        action: "Immobilie bearbeitet",
        related_type: "property",
        related_id: id,
        metadata: {
          fields: Object.keys(payload.property ?? {}),
          owner_changed: !!(newOwnerId && newOwnerId !== prevOwnerId),
        },
      });
    },
    onSuccess: () => {
      toast.success("Gespeichert");
      qc.invalidateQueries({ queryKey: ["property", id] });
      qc.invalidateQueries({ queryKey: ["property_activities", id] });
      qc.invalidateQueries({ queryKey: ["properties"] });
      qc.invalidateQueries({ queryKey: ["property_current_owners", id] });
      qc.invalidateQueries({ queryKey: ["property_ownerships", id] });
      setEditOpen(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const updateStatus = useMutation({
    mutationFn: async (status: string) => {
      const prevStatus = p?.status;
      const { error } = await supabase.from("properties").update({ status: status as any }).eq("id", id);
      if (error) throw error;
      await supabase.from("activity_logs").insert({
        actor_id: user?.id ?? null,
        action: `Status geändert: ${prevStatus ?? "—"} → ${status}`,
        related_type: "property",
        related_id: id,
        metadata: { from: prevStatus, to: status },
      });
    },
    onSuccess: () => {
      toast.success("Status aktualisiert");
      qc.invalidateQueries({ queryKey: ["property", id] });
      qc.invalidateQueries({ queryKey: ["property_activities", id] });
    },
  });

  const del = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("properties").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Gelöscht"); navigate({ to: "/properties" }); },
  });

  if (isLoading || !p) return <div className="text-sm text-muted-foreground">Lädt…</div>;

  const assignedEmp = employees.find((e: any) => e.id === p.assigned_to);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <Button variant="ghost" asChild><Link to="/properties"><ArrowLeft className="mr-1 h-4 w-4" />Zurück</Link></Button>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild>
            <Link to="/properties/$id/expose" params={{ id }}><FileText className="mr-1 h-4 w-4" />Exposé</Link>
          </Button>
          <Button variant="outline" onClick={() => setFinancingOpen(true)}>
            <Banknote className="mr-1 h-4 w-4" />Finanzierung starten
          </Button>
          <Button variant="outline" onClick={() => setEditOpen(true)}><Pencil className="mr-1 h-4 w-4" />Bearbeiten</Button>
          <Select value={p.status} onValueChange={(v) => updateStatus.mutate(v)}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>{STATUSES.map(s => (
              <SelectItem key={s} value={s}>
                <span className="flex items-center gap-2">
                  <span className={`inline-block h-2.5 w-2.5 rounded-full ${getPropertyStatusDotClass(s)}`} />
                  {propertyStatusLabels[s]}
                </span>
              </SelectItem>
            ))}</SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={() => { if (confirm("Wirklich löschen?")) del.mutate(); }}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <PropertyWizard
        open={editOpen}
        onOpenChange={setEditOpen}
        mode="edit"
        initial={p}
        onSubmit={(payload) => update.mutate(payload)}
        submitting={update.isPending}
      />

      <FinancingQuickCheckWizard
        open={financingOpen}
        onOpenChange={setFinancingOpen}
        defaultPropertyId={id}
        defaultClientId={currentOwners[0]?.client_id}
        onCreated={(dossierId) => navigate({ to: "/financing/$id", params: { id: dossierId } })}
      />

      {/* Parent / Unit context banner */}
      {p.is_unit && parent && (
        <Card className="mb-4 border-primary/30 bg-primary/5">
          <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div className="flex items-center gap-2 text-sm">
              <Layers3 className="h-4 w-4 text-primary" />
              <span className="text-muted-foreground">Einheit in</span>
              <span className="font-medium">{parent.title}</span>
              {parent.address && <span className="text-muted-foreground">· {[parent.address, parent.city].filter(Boolean).join(", ")}</span>}
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link to="/properties/$id" params={{ id: parent.id }}>
                <ExternalLink className="mr-1 h-4 w-4" />Liegenschaft öffnen
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}
      {!p.is_unit && units.length > 0 && (
        <Card className="mb-4 border-primary/20 bg-muted/30">
          <CardContent className="flex flex-wrap items-center gap-2 p-4 text-sm">
            <Building2 className="h-4 w-4 text-primary" />
            <span className="font-medium">{units.length} Einheit{units.length === 1 ? "" : "en"}</span>
            <span className="text-muted-foreground">in dieser Liegenschaft</span>
          </CardContent>
        </Card>
      )}

      <div className="mb-6 grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 aspect-[16/10] overflow-hidden rounded-2xl border bg-muted">
          {p.images?.[0] ? (
            <img src={getMediaPublicUrl(p.images[0])} alt={p.title} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-soft text-muted-foreground">Kein Bild</div>
          )}
        </div>
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className={getPropertyStatusBadgeClass(p.status)}>{propertyStatusLabels[p.status as keyof typeof propertyStatusLabels]}</Badge>
            <Badge variant="secondary">{propertyTypeLabels[p.property_type as keyof typeof propertyTypeLabels]}</Badge>
            <Badge variant="outline">{listingTypeLabels[p.listing_type as keyof typeof listingTypeLabels]}</Badge>
            {p.status === "reserved" && <Badge className="bg-amber-500 hover:bg-amber-500">Aktive Reservation</Badge>}
            {statusFlags?.hasActiveMandate && <Badge className="bg-emerald-600 hover:bg-emerald-600">Aktives Mandat</Badge>}
            {statusFlags?.hasNda && <Badge variant="outline" className="border-primary/50 text-primary">NDA vorhanden</Badge>}
          </div>
          <h1 className="font-display text-2xl font-bold leading-tight">{p.title}</h1>
          <p className="flex items-center gap-1 text-sm text-muted-foreground">
            <MapPin className="h-4 w-4" />{[p.address, p.postal_code, p.city].filter(Boolean).join(", ") || "—"}
          </p>
          <Card><CardContent className="p-4">
            <p className="text-xs uppercase text-muted-foreground">{p.listing_type === "rent" ? "Miete / Monat" : "Kaufpreis"}</p>
            <p className="font-display text-3xl font-bold text-gradient-brand">
              {formatCurrency(p.listing_type === "rent" ? (p.rent ? Number(p.rent) : null) : (p.price ? Number(p.price) : null))}
            </p>
            {p.living_area && p.price && p.listing_type !== "rent" && (
              <p className="mt-1 text-xs text-muted-foreground">{formatCurrency(Number(p.price) / Number(p.living_area))} / m²</p>
            )}
          </CardContent></Card>
          <Card><CardContent className="p-4 text-sm">
            <p className="flex items-center gap-2 text-muted-foreground"><User className="h-4 w-4" />Zuständig</p>
            <p className="mt-1 font-medium">{assignedEmp ? (assignedEmp as any).full_name || (assignedEmp as any).email : "Niemand zugewiesen"}</p>
          </CardContent></Card>
          <button
            type="button"
            onClick={() => setTab("owner")}
            className="block w-full text-left"
          >
            <Card className="transition hover:border-primary/50 hover:bg-primary/5">
              <CardContent className="p-4 text-sm">
                <p className="flex items-center gap-2 text-muted-foreground"><User className="h-4 w-4" />Eigentümer</p>
                {currentOwners.length === 0 ? (
                  <p className="mt-1 italic text-muted-foreground">Noch kein Eigentümer hinterlegt</p>
                ) : currentOwners.length === 1 ? (
                  <p className="mt-1 font-medium">{currentOwners[0].client?.full_name ?? "—"}</p>
                ) : (
                  <p className="mt-1 font-medium">Mehrere Eigentümer ({currentOwners.length})</p>
                )}
              </CardContent>
            </Card>
          </button>
          <div className="grid grid-cols-3 gap-2">
            <button type="button" onClick={() => setTab("marketing")} className="text-left">
              <Card className="transition hover:border-primary/50 hover:bg-primary/5">
                <CardContent className="p-3">
                  <p className="text-[11px] uppercase text-muted-foreground">Matches</p>
                  <p className="font-display text-xl font-bold">{counts?.matches ?? 0}</p>
                </CardContent>
              </Card>
            </button>
            <button type="button" onClick={() => setTab("organisation")} className="text-left">
              <Card className="transition hover:border-primary/50 hover:bg-primary/5">
                <CardContent className="p-3">
                  <p className="text-[11px] uppercase text-muted-foreground">Termine</p>
                  <p className="font-display text-xl font-bold">{counts?.appointments ?? 0}</p>
                </CardContent>
              </Card>
            </button>
            <button type="button" onClick={() => setTab("documents")} className="text-left">
              <Card className="transition hover:border-primary/50 hover:bg-primary/5">
                <CardContent className="p-3">
                  <p className="text-[11px] uppercase text-muted-foreground">Dokumente</p>
                  <p className="font-display text-xl font-bold">{counts?.documents ?? 0}</p>
                </CardContent>
              </Card>
            </button>
          </div>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="space-y-4">
        <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1">
          <TabsTrigger value="overview">Übersicht</TabsTrigger>
          <TabsTrigger value="details">Details & Medien</TabsTrigger>
          <TabsTrigger value="owner">Eigentümer</TabsTrigger>
          <TabsTrigger value="marketing">
            Vermarktung{counts?.matches ? ` (${counts.matches})` : ""}
          </TabsTrigger>
          <TabsTrigger value="organisation">Organisation</TabsTrigger>
          <TabsTrigger value="documents">
            Dokumente{counts?.documents ? ` (${counts.documents})` : ""}
          </TabsTrigger>
          {!p.is_unit && (
            <TabsTrigger value="units">
              Einheiten{units.length ? ` (${units.length})` : ""}
            </TabsTrigger>
          )}
          <TabsTrigger value="market"><TrendingUp className="mr-1 h-3.5 w-3.5" />Marktanalyse</TabsTrigger>
          <TabsTrigger value="activity">Aktivitäten</TabsTrigger>
        </TabsList>


        <div className="min-w-0">
          <TabsContent value="overview" className="mt-0"><OverviewTab p={p} /></TabsContent>

          <TabsContent value="details" className="mt-0">
            <Accordion type="multiple" defaultValue={["facts"]} className="space-y-2">
              <AccordionItem value="facts" className="rounded-xl border px-4">
                <AccordionTrigger className="font-display text-base">Eckdaten</AccordionTrigger>
                <AccordionContent><FactsTab p={p} /></AccordionContent>
              </AccordionItem>
              <AccordionItem value="media" className="rounded-xl border px-4">
                <AccordionTrigger className="font-display text-base">Medien</AccordionTrigger>
                <AccordionContent><MediaTab propertyId={id} cover={getMediaPublicUrl(p.images?.[0])} /></AccordionContent>
              </AccordionItem>
            </Accordion>
          </TabsContent>

          <TabsContent value="owner" className="mt-0">
            <PropertyOwnersTab propertyId={id} legacyOwnerClientId={p.owner_client_id ?? p.seller_client_id} />
          </TabsContent>

          <TabsContent value="marketing" className="mt-0">
            <Accordion type="multiple" defaultValue={["mandate"]} className="space-y-2">
              <AccordionItem value="mandate" className="rounded-xl border px-4">
                <AccordionTrigger className="font-display text-base">Mandat</AccordionTrigger>
                <AccordionContent><MandateTab propertyId={id} /></AccordionContent>
              </AccordionItem>
              <AccordionItem value="expose" className="rounded-xl border px-4">
                <AccordionTrigger className="font-display text-base">Exposé</AccordionTrigger>
                <AccordionContent><ExposeTab propertyId={id} /></AccordionContent>
              </AccordionItem>
              <AccordionItem value="reservation" className="rounded-xl border px-4">
                <AccordionTrigger className="font-display text-base">Reservation</AccordionTrigger>
                <AccordionContent><ReservationTab propertyId={id} /></AccordionContent>
              </AccordionItem>
              <AccordionItem value="matching" className="rounded-xl border px-4">
                <AccordionTrigger className="font-display text-base">Matching</AccordionTrigger>
                <AccordionContent><MatchPanel direction="property-to-client" property={p} /></AccordionContent>
              </AccordionItem>
            </Accordion>
          </TabsContent>

          <TabsContent value="organisation" className="mt-0">
            <Accordion type="multiple" defaultValue={["tasks"]} className="space-y-2">
              <AccordionItem value="tasks" className="rounded-xl border px-4">
                <AccordionTrigger className="font-display text-base">Aufgaben</AccordionTrigger>
                <AccordionContent><TasksTab propertyId={id} /></AccordionContent>
              </AccordionItem>
              <AccordionItem value="appointments" className="rounded-xl border px-4">
                <AccordionTrigger className="font-display text-base">Termine</AccordionTrigger>
                <AccordionContent><AppointmentsTab propertyId={id} /></AccordionContent>
              </AccordionItem>
              <AccordionItem value="checklists" className="rounded-xl border px-4">
                <AccordionTrigger className="font-display text-base">Checklisten</AccordionTrigger>
                <AccordionContent><ChecklistsTab propertyId={id} /></AccordionContent>
              </AccordionItem>
            </Accordion>
          </TabsContent>

          <TabsContent value="documents" className="mt-0"><DocumentsTab propertyId={id} /></TabsContent>
          {!p.is_unit && <TabsContent value="units" className="mt-0"><UnitsTab parentId={id} units={units} /></TabsContent>}
          <TabsContent value="market" className="mt-0">
            <MarketAnalysisTab property={p} />
          </TabsContent>
          <TabsContent value="activity" className="mt-0">
            <ActivityTab activities={activities} employees={employees} />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  );
}

/* ----------------- Tabs ----------------- */

function OverviewTab({ p }: { p: any }) {
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2 space-y-6">
        {p.description ? (
          <Card><CardContent className="p-6">
            <h2 className="mb-2 font-semibold">Beschreibung</h2>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">{p.description}</p>
          </CardContent></Card>
        ) : (
          <EmptyState title="Keine Beschreibung" description="Bearbeite das Objekt, um eine Beschreibung hinzuzufügen." />
        )}

        {p.features?.length ? (
          <Card><CardContent className="p-6">
            <h2 className="mb-3 font-semibold">Ausstattung</h2>
            <div className="flex flex-wrap gap-2">
              {p.features.map((f: string) => <Badge key={f} variant="secondary">{f}</Badge>)}
            </div>
          </CardContent></Card>
        ) : null}

        {p.internal_notes && (
          <Card className="border-amber-500/30 bg-amber-500/5"><CardContent className="p-6">
            <h2 className="mb-2 text-sm font-semibold text-amber-700 dark:text-amber-400">Interne Notizen</h2>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">{p.internal_notes}</p>
          </CardContent></Card>
        )}
      </div>

      <div className="space-y-4">
        <Card><CardContent className="grid grid-cols-2 gap-4 p-6">
          <Stat icon={Maximize} label="Wohnfläche" value={formatArea(p.living_area ? Number(p.living_area) : (p.area ? Number(p.area) : null))} />
          <Stat icon={Maximize} label="Grundstück" value={formatArea(p.plot_area ? Number(p.plot_area) : null)} />
          <Stat icon={Bed} label="Zimmer" value={p.rooms ? String(p.rooms) : "—"} />
          <Stat icon={Bath} label="Bäder" value={p.bathrooms ? String(p.bathrooms) : "—"} />
          <Stat icon={Calendar} label="Baujahr" value={p.year_built ? String(p.year_built) : "—"} />
          <Stat icon={Calendar} label="Renoviert" value={p.renovated_at ? String(p.renovated_at) : "—"} />
          <Stat icon={Zap} label="Energie" value={p.energy_class ?? "—"} />
        </CardContent></Card>
        <Card><CardContent className="p-6 text-sm">
          <h3 className="mb-2 font-semibold">Erfasst</h3>
          <p className="text-muted-foreground">{formatDateTime(p.created_at)}</p>
        </CardContent></Card>
      </div>
    </div>
  );
}

function FactsTab({ p }: { p: any }) {
  const rows: [string, any][] = [
    ["Titel", p.title],
    ["Typ", propertyTypeLabels[p.property_type as keyof typeof propertyTypeLabels]],
    ["Vermarktung", listingTypeLabels[p.listing_type as keyof typeof listingTypeLabels]],
    ["Status", propertyStatusLabels[p.status as keyof typeof propertyStatusLabels]],
    ["Kaufpreis", p.price ? formatCurrency(Number(p.price)) : "—"],
    ["Miete / Monat", p.rent ? formatCurrency(Number(p.rent)) : "—"],
    ["Wohnfläche", formatArea(p.living_area ? Number(p.living_area) : (p.area ? Number(p.area) : null))],
    ["Grundstück", formatArea(p.plot_area ? Number(p.plot_area) : null)],
    ["Zimmer", p.rooms ?? "—"],
    ["Bäder", p.bathrooms ?? "—"],
    ["Stockwerk", p.floor ?? "—"],
    ["Geschosse", p.total_floors ?? "—"],
    ["Baujahr", p.year_built ?? "—"],
    ["Renoviert", p.renovated_at ?? "—"],
    ["Energieklasse", p.energy_class ?? "—"],
    ["Adresse", p.address ?? "—"],
    ["PLZ", p.postal_code ?? "—"],
    ["Ort", p.city ?? "—"],
    ["Land", p.country ?? "—"],
  ];
  return (
    <Card><CardContent className="p-0">
      <dl className="divide-y">
        {rows.map(([k, v]) => (
          <div key={k} className="grid grid-cols-3 gap-4 px-6 py-3 text-sm">
            <dt className="text-muted-foreground">{k}</dt>
            <dd className="col-span-2 font-medium">{String(v)}</dd>
          </div>
        ))}
      </dl>
    </CardContent></Card>
  );
}

function OwnerTab({ p }: { p: any }) {
  const ownerId = p.seller_client_id || p.owner_client_id;
  const { data: owner } = useQuery({
    queryKey: ["client", ownerId],
    queryFn: async () => {
      if (!ownerId) return null;
      const { data } = await supabase.from("clients").select("*").eq("id", ownerId).single();
      return data;
    },
    enabled: !!ownerId,
  });

  if (!ownerId) {
    return <EmptyState
      title="Kein Eigentümer hinterlegt"
      description="Verknüpfe einen Kunden vom Typ Verkäufer oder Vermieter mit diesem Objekt."
      action={<Button asChild variant="outline"><Link to="/clients">Zu den Kunden</Link></Button>}
    />;
  }

  if (!owner) return <div className="text-sm text-muted-foreground">Lädt…</div>;

  return (
    <Card><CardContent className="p-6 space-y-3">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-display text-xl font-semibold">{owner.full_name}</h3>
          <p className="text-sm text-muted-foreground">{owner.email || "—"} · {owner.phone || "—"}</p>
        </div>
        <Button variant="outline" asChild>
          <Link to="/clients/$id" params={{ id: owner.id }}><ExternalLink className="mr-1 h-4 w-4" />Öffnen</Link>
        </Button>
      </div>
      {owner.notes && <p className="whitespace-pre-wrap text-sm text-muted-foreground">{owner.notes}</p>}
    </CardContent></Card>
  );
}

function MediaTab({ propertyId, cover }: { propertyId: string; cover?: string | null }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");

  const { data: media = [] } = useQuery({
    queryKey: ["property_media", propertyId],
    queryFn: async () => {
      const { data } = await supabase.from("property_media").select("*").eq("property_id", propertyId).order("sort_order");
      return data ?? [];
    },
  });

  const add = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("property_media").insert({ property_id: propertyId, file_url: url, title: title || null });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Medium hinzugefügt"); setUrl(""); setTitle(""); setOpen(false); qc.invalidateQueries({ queryKey: ["property_media", propertyId] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (mid: string) => {
      const { error } = await supabase.from("property_media").delete().eq("id", mid);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["property_media", propertyId] }); },
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setOpen(true)}><Plus className="mr-1 h-4 w-4" />Medium hinzufügen</Button>
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Medium hinzufügen</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>URL</Label><Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" /></div>
            <div><Label>Titel (optional)</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} /></div>
          </div>
          <DialogFooter><Button onClick={() => add.mutate()} disabled={!url || add.isPending}>Hinzufügen</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {media.length === 0 && !cover ? (
        <EmptyState title="Noch keine Medien" description="Lade Bilder oder Pläne hoch, um das Objekt zu präsentieren." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {cover && (
            <div className="group relative aspect-[4/3] overflow-hidden rounded-xl border bg-muted">
              <img src={cover} alt="Cover" className="h-full w-full object-cover" />
              <Badge className="absolute left-2 top-2">Cover</Badge>
            </div>
          )}
          {media.map((m: any) => (
            <div key={m.id} className="group relative aspect-[4/3] overflow-hidden rounded-xl border bg-muted">
              {m.file_type === "image" || m.file_url?.match(/\.(jpe?g|png|webp|gif|avif|jfif)$/i) ? (
                <img src={getMediaPublicUrl(m.file_url)} alt={m.title ?? ""} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-xs text-muted-foreground">
                  <ImageIcon className="h-6 w-6" />
                  <a href={getMediaPublicUrl(m.file_url)} target="_blank" rel="noreferrer" className="underline">Datei öffnen</a>
                </div>
              )}
              <button onClick={() => del.mutate(m.id)} className="absolute right-2 top-2 rounded-md bg-background/80 p-1 opacity-0 transition group-hover:opacity-100">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function DocumentsTab({ propertyId }: { propertyId: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");

  const { data: docs = [] } = useQuery({
    queryKey: ["docs", "property", propertyId],
    queryFn: async () => {
      const { data } = await supabase.from("documents").select("*").eq("related_type", "property").eq("related_id", propertyId).order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const add = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("documents").insert({ related_type: "property", related_id: propertyId, file_name: name, file_url: url });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Dokument verknüpft"); setName(""); setUrl(""); setOpen(false); qc.invalidateQueries({ queryKey: ["docs", "property", propertyId] }); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setOpen(true)}><Plus className="mr-1 h-4 w-4" />Dokument hinzufügen</Button>
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Dokument verknüpfen</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
            <div><Label>URL</Label><Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" /></div>
          </div>
          <DialogFooter><Button onClick={() => add.mutate()} disabled={!url || !name || add.isPending}>Speichern</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {docs.length === 0 ? (
        <EmptyState title="Keine Dokumente" description="Verknüpfe Verträge, Pläne oder Energieausweise." />
      ) : (
        <Card><CardContent className="p-0">
          <ul className="divide-y">
            {docs.map((d: any) => (
              <li key={d.id} className="flex items-center justify-between gap-3 px-6 py-3">
                <div className="min-w-0">
                  <p className="truncate font-medium">{d.file_name}</p>
                  <p className="text-xs text-muted-foreground">{formatDateTime(d.created_at)}</p>
                </div>
                <Button variant="outline" size="sm" asChild><a href={d.file_url} target="_blank" rel="noreferrer"><ExternalLink className="mr-1 h-3 w-3" />Öffnen</a></Button>
              </li>
            ))}
          </ul>
        </CardContent></Card>
      )}

      <div className="pt-4">
        <h3 className="mb-3 font-display text-lg font-semibold">Generierte Dokumente</h3>
        <GeneratedDocumentsTable filterRelatedType="property" filterRelatedId={propertyId} />
      </div>
    </div>
  );
}

function ChecklistsTab({ propertyId }: { propertyId: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");

  const { data: lists = [] } = useQuery({
    queryKey: ["checklists", "property", propertyId],
    queryFn: async () => {
      const { data } = await supabase.from("checklists").select("*").eq("related_type", "property").eq("related_id", propertyId).order("created_at");
      return data ?? [];
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("checklists").insert({ related_type: "property", related_id: propertyId, title });
      if (error) throw error;
    },
    onSuccess: () => { setTitle(""); setOpen(false); qc.invalidateQueries({ queryKey: ["checklists", "property", propertyId] }); },
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setOpen(true)}><Plus className="mr-1 h-4 w-4" />Checkliste</Button>
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Neue Checkliste</DialogTitle></DialogHeader>
          <div><Label>Titel</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Onboarding Verkauf" /></div>
          <DialogFooter><Button onClick={() => create.mutate()} disabled={!title || create.isPending}>Erstellen</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {lists.length === 0 ? (
        <EmptyState title="Keine Checklisten" description="Strukturiere wiederkehrende Schritte wie Vorbereitung, Vermarktung, Übergabe." />
      ) : (
        <div className="space-y-4">
          {lists.map((cl: any) => <ChecklistCard key={cl.id} checklist={cl} />)}
        </div>
      )}
    </div>
  );
}

function ChecklistCard({ checklist }: { checklist: any }) {
  const qc = useQueryClient();
  const [item, setItem] = useState("");

  const { data: items = [] } = useQuery({
    queryKey: ["checklist_items", checklist.id],
    queryFn: async () => {
      const { data } = await supabase.from("checklist_items").select("*").eq("checklist_id", checklist.id).order("sort_order");
      return data ?? [];
    },
  });

  const add = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("checklist_items").insert({ checklist_id: checklist.id, title: item, sort_order: items.length });
      if (error) throw error;
    },
    onSuccess: () => { setItem(""); qc.invalidateQueries({ queryKey: ["checklist_items", checklist.id] }); },
  });

  const toggle = useMutation({
    mutationFn: async ({ iid, done }: { iid: string; done: boolean }) => {
      const { error } = await supabase.from("checklist_items").update({ is_done: done }).eq("id", iid);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["checklist_items", checklist.id] }); },
  });

  const doneCount = items.filter((i: any) => i.is_done).length;

  return (
    <Card><CardContent className="p-6">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-semibold">{checklist.title}</h3>
        <span className="text-xs text-muted-foreground">{doneCount}/{items.length}</span>
      </div>
      <ul className="mb-3 space-y-1">
        {items.map((it: any) => (
          <li key={it.id}>
            <button onClick={() => toggle.mutate({ iid: it.id, done: !it.is_done })} className="flex w-full items-center gap-2 rounded-md p-2 text-left text-sm hover:bg-muted">
              {it.is_done ? <CheckCircle2 className="h-4 w-4 text-primary" /> : <Circle className="h-4 w-4 text-muted-foreground" />}
              <span className={it.is_done ? "line-through text-muted-foreground" : ""}>{it.title}</span>
            </button>
          </li>
        ))}
      </ul>
      <div className="flex gap-2">
        <Input value={item} onChange={(e) => setItem(e.target.value)} placeholder="Neuer Punkt…" onKeyDown={(e) => { if (e.key === "Enter" && item) add.mutate(); }} />
        <Button onClick={() => add.mutate()} disabled={!item || add.isPending} size="icon"><Plus className="h-4 w-4" /></Button>
      </div>
    </CardContent></Card>
  );
}

function TasksTab({ propertyId }: { propertyId: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");

  const { data: tasks = [] } = useQuery({
    queryKey: ["tasks", "property", propertyId],
    queryFn: async () => {
      const { data } = await supabase.from("tasks").select("*").eq("related_type", "property").eq("related_id", propertyId).order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const add = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("tasks").insert({ related_type: "property", related_id: propertyId, title });
      if (error) throw error;
    },
    onSuccess: () => { setTitle(""); setOpen(false); qc.invalidateQueries({ queryKey: ["tasks", "property", propertyId] }); },
  });

  const toggle = useMutation({
    mutationFn: async ({ tid, done }: { tid: string; done: boolean }) => {
      const { error } = await supabase.from("tasks").update({ status: (done ? "done" : "open") as any }).eq("id", tid);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["tasks", "property", propertyId] }); },
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => setOpen(true)}><Plus className="mr-1 h-4 w-4" />Aufgabe</Button>
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Neue Aufgabe</DialogTitle></DialogHeader>
          <div><Label>Titel</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} /></div>
          <DialogFooter><Button onClick={() => add.mutate()} disabled={!title || add.isPending}>Erstellen</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {tasks.length === 0 ? (
        <EmptyState title="Keine Aufgaben" description="Erstelle Aufgaben wie Fotos planen, Inserat schalten, Besichtigung vorbereiten." />
      ) : (
        <Card><CardContent className="p-0">
          <ul className="divide-y">
            {tasks.map((t: any) => (
              <li key={t.id} className="flex items-center gap-3 px-6 py-3">
                <button onClick={() => toggle.mutate({ tid: t.id, done: t.status !== "done" })}>
                  {t.status === "done" ? <CheckCircle2 className="h-4 w-4 text-primary" /> : <Circle className="h-4 w-4 text-muted-foreground" />}
                </button>
                <div className="flex-1">
                  <p className={"text-sm " + (t.status === "done" ? "line-through text-muted-foreground" : "font-medium")}>{t.title}</p>
                  {t.due_date && <p className="text-xs text-muted-foreground">Fällig: {formatDate(t.due_date)}</p>}
                </div>
                <Badge variant="outline" className="text-xs">{t.priority}</Badge>
              </li>
            ))}
          </ul>
        </CardContent></Card>
      )}
    </div>
  );
}

function AppointmentsTab({ propertyId }: { propertyId: string }) {
  const { data: appts = [] } = useQuery({
    queryKey: ["appts", "property", propertyId],
    queryFn: async () => {
      const { data } = await supabase.from("appointments").select("*").eq("property_id", propertyId).order("starts_at", { ascending: false });
      return data ?? [];
    },
  });

  if (appts.length === 0) {
    return <EmptyState
      title="Keine Termine"
      description="Plane Besichtigungen oder Beurkundungen für dieses Objekt."
      action={<Button asChild><Link to="/appointments">Zu den Terminen</Link></Button>}
    />;
  }

  return (
    <Card><CardContent className="p-0">
      <ul className="divide-y">
        {appts.map((a: any) => (
          <li key={a.id} className="px-6 py-3">
            <div className="flex items-center justify-between">
              <p className="font-medium">{a.title}</p>
              <Badge variant="outline">{a.status}</Badge>
            </div>
            <p className="text-xs text-muted-foreground">{formatDateTime(a.starts_at)}{a.location ? ` · ${a.location}` : ""}</p>
          </li>
        ))}
      </ul>
    </CardContent></Card>
  );
}

function MandateTab({ propertyId }: { propertyId: string }) {
  const { data: mandates = [] } = useQuery({
    queryKey: ["mandates", "property", propertyId],
    queryFn: async () => {
      const { data } = await supabase.from("mandates").select("*").eq("property_id", propertyId).order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  if (mandates.length === 0) {
    return <EmptyState
      title="Kein Mandat hinterlegt"
      description="Lege ein Maklermandat für dieses Objekt an."
      action={<Button asChild><Link to="/mandates">Zu den Mandaten</Link></Button>}
    />;
  }

  return (
    <div className="space-y-3">
      {mandates.map((m: any) => (
        <Card key={m.id}><CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold">Mandat · {m.commission_model || "—"}</p>
              <p className="text-sm text-muted-foreground">Provision: {m.commission_value ?? "—"} · Gültig bis {m.valid_until ? formatDate(m.valid_until) : "—"}</p>
            </div>
            <Badge>{m.status}</Badge>
          </div>
          {m.notes && <p className="mt-2 text-sm text-muted-foreground">{m.notes}</p>}
        </CardContent></Card>
      ))}
    </div>
  );
}

function ReservationTab({ propertyId }: { propertyId: string }) {
  const { data: rs = [] } = useQuery({
    queryKey: ["reservations", "property", propertyId],
    queryFn: async () => {
      const { data } = await supabase.from("reservations").select("*").eq("property_id", propertyId).order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  if (rs.length === 0) {
    return <EmptyState
      title="Keine Reservation"
      description="Erstelle eine Reservationsvereinbarung, sobald ein Interessent das Objekt sichert."
      action={<Button asChild><Link to="/reservations">Zu den Reservationen</Link></Button>}
    />;
  }

  return (
    <div className="space-y-3">
      {rs.map((r: any) => (
        <Card key={r.id}><CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold">Reservation</p>
              <p className="text-sm text-muted-foreground">Gebühr: {formatCurrency(r.reservation_fee)} · Gültig bis {r.valid_until ? formatDate(r.valid_until) : "—"}</p>
            </div>
            <Badge>{r.status}</Badge>
          </div>
          {r.notes && <p className="mt-2 text-sm text-muted-foreground">{r.notes}</p>}
        </CardContent></Card>
      ))}
    </div>
  );
}

// MatchingTab replaced by <MatchPanel direction="property-to-client" />

function Stat({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div>
      <p className="flex items-center gap-1 text-xs text-muted-foreground"><Icon className="h-3 w-3" />{label}</p>
      <p className="mt-0.5 font-semibold">{value}</p>
    </div>
  );
}

function ExposeTab({ propertyId }: { propertyId: string }) {
  const { data: exposes = [], isLoading } = useQuery({
    queryKey: ["exposes", propertyId],
    queryFn: async () => {
      const { data } = await supabase
        .from("generated_documents")
        .select("*")
        .eq("related_type", "property").eq("related_id", propertyId)
        .order("created_at", { ascending: false });
      return (data ?? []).filter((d: any) => (d.variables as any)?.kind === "expose");
    },
  });
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <Card><CardContent className="flex flex-wrap items-center justify-between gap-4 p-6">
        <div>
          <h3 className="font-display text-lg font-semibold">Exposé erstellen</h3>
          <p className="text-sm text-muted-foreground">Geführter Wizard mit Cover, Galerie, Eckdaten und Vorschau.</p>
        </div>
        <Button asChild>
          <Link to="/properties/$id/expose" params={{ id: propertyId }}>
            <FileText className="mr-1 h-4 w-4" />Exposé erstellen
          </Link>
        </Button>
      </CardContent></Card>

      <Card><CardContent className="p-6">
        <h4 className="mb-3 font-semibold">Bisher erstellte Exposés</h4>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Wird geladen…</p>
        ) : exposes.length === 0 ? (
          <EmptyState title="Noch keine Exposés" description="Starte den Wizard, um das erste Exposé zu erstellen." />
        ) : (
          <div className="space-y-2">
            {exposes.map((d: any) => (
              <div key={d.id} className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <p className="text-sm font-medium">{(d.variables as any)?.title ?? "Exposé"}</p>
                  <p className="text-xs text-muted-foreground">{formatDateTime(d.created_at)}</p>
                </div>
                <Button size="sm" variant="outline" onClick={() => setPreviewHtml(d.html_content)}>
                  <ExternalLink className="mr-1 h-3 w-3" />Ansehen
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent></Card>

      <Dialog open={!!previewHtml} onOpenChange={(o) => !o && setPreviewHtml(null)}>
        <DialogContent className="max-w-5xl">
          <DialogHeader><DialogTitle>Exposé-Vorschau</DialogTitle></DialogHeader>
          {previewHtml && <iframe title="Exposé" srcDoc={previewHtml} className="h-[75vh] w-full rounded border" />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function UnitsTab({ parentId, units }: { parentId: string; units: any[] }) {
  if (!units.length) {
    return (
      <EmptyState
        title="Noch keine Einheiten erfasst"
        description="Lege einzelne Wohnungen oder Einheiten an, die zu dieser Liegenschaft gehören."
        action={
          <Button asChild>
            <Link to="/properties" search={{ newUnitParent: parentId } as any}>
              <Plus className="mr-1 h-4 w-4" />Einheit hinzufügen
            </Link>
          </Button>
        }
      />
    );
  }
  return (
    <Card>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-2 text-left">Nr.</th>
                <th className="px-4 py-2 text-left">Bezeichnung</th>
                <th className="px-4 py-2 text-left">Typ</th>
                <th className="px-4 py-2 text-left">Etage</th>
                <th className="px-4 py-2 text-right">Zimmer</th>
                <th className="px-4 py-2 text-right">Fläche</th>
                <th className="px-4 py-2 text-right">Preis / Miete</th>
                <th className="px-4 py-2 text-left">Status</th>
                <th className="px-4 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {units.map((u) => (
                <tr key={u.id} className="hover:bg-muted/30">
                  <td className="px-4 py-2 font-medium">{u.unit_number || "—"}</td>
                  <td className="px-4 py-2">{u.title}</td>
                  <td className="px-4 py-2 text-muted-foreground">{u.unit_type || propertyTypeLabels[u.property_type as keyof typeof propertyTypeLabels] || "—"}</td>
                  <td className="px-4 py-2 text-muted-foreground">{u.unit_floor || "—"}</td>
                  <td className="px-4 py-2 text-right">{u.rooms ?? "—"}</td>
                  <td className="px-4 py-2 text-right">{formatArea(u.living_area ? Number(u.living_area) : null)}</td>
                  <td className="px-4 py-2 text-right">
                    {u.listing_type === "rent"
                      ? (u.rent ? formatCurrency(Number(u.rent)) : "—")
                      : (u.price ? formatCurrency(Number(u.price)) : "—")}
                  </td>
                  <td className="px-4 py-2"><Badge variant="outline" className={getPropertyStatusBadgeClass(u.status)}>{propertyStatusLabels[u.status as keyof typeof propertyStatusLabels]}</Badge></td>
                  <td className="px-4 py-2 text-right">
                    <Button variant="ghost" size="sm" asChild>
                      <Link to="/properties/$id" params={{ id: u.id }}>Öffnen<ExternalLink className="ml-1 h-3 w-3" /></Link>
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function ActivityTab({ activities, employees }: { activities: any[]; employees: any[] }) {
  if (!activities.length) {
    return (
      <EmptyState
        title="Noch keine Aktivitäten"
        description="Hier erscheinen alle Bearbeitungen, Statusänderungen und Ereignisse zu dieser Immobilie."
      />
    );
  }
  const empMap = new Map(employees.map((e: any) => [e.id, e.full_name || e.email]));
  return (
    <Card>
      <CardContent className="p-6">
        <ol className="relative space-y-4 border-l pl-6">
          {activities.map((a) => (
            <li key={a.id} className="relative">
              <span className="absolute -left-[31px] mt-1.5 inline-block h-3 w-3 rounded-full border-2 border-background bg-primary" />
              <p className="text-sm font-medium">{a.action}</p>
              <p className="text-xs text-muted-foreground">
                {formatDateTime(a.created_at)}
                {a.actor_id && empMap.get(a.actor_id) ? ` · ${empMap.get(a.actor_id)}` : ""}
              </p>
              {a.metadata && Object.keys(a.metadata).length > 0 && (
                <pre className="mt-1 whitespace-pre-wrap rounded-md bg-muted/50 p-2 text-[11px] text-muted-foreground">
                  {JSON.stringify(a.metadata, null, 2)}
                </pre>
              )}
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}

function fmtRange(min: number | null | undefined, max: number | null | undefined, suffix = "", currency = "") {
  const f = (n: number) => currency ? formatCurrency(n) : n.toLocaleString("de-CH", { maximumFractionDigits: 0 });
  if (min == null && max == null) return "—";
  if (min == null) return `bis ${f(max!)}${suffix}`;
  if (max == null) return `ab ${f(min)}${suffix}`;
  if (min === max) return `${f(min)}${suffix}`;
  return `${f(min)} – ${f(max)}${suffix}`;
}

const verdictMap: Record<string, { label: string; cls: string }> = {
  strong_buy: { label: "Starker Kauf", cls: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30" },
  buy: { label: "Kaufempfehlung", cls: "bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/30" },
  hold: { label: "Halten / Beobachten", cls: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30" },
  caution: { label: "Vorsicht", cls: "bg-orange-500/15 text-orange-700 dark:text-orange-400 border-orange-500/30" },
  avoid: { label: "Eher vermeiden", cls: "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/30" },
};
const trendMap: Record<string, { label: string; cls: string; arrow: string }> = {
  rising: { label: "Steigend", cls: "text-emerald-600", arrow: "↗" },
  stable: { label: "Stabil", cls: "text-blue-600", arrow: "→" },
  declining: { label: "Rückläufig", cls: "text-red-600", arrow: "↘" },
  mixed: { label: "Gemischt", cls: "text-amber-600", arrow: "↔" },
};
const comparisonMap: Record<string, { label: string; cls: string }> = {
  below_market: { label: "Unter Marktwert", cls: "text-emerald-600" },
  at_market: { label: "Marktgerecht", cls: "text-blue-600" },
  above_market: { label: "Über Marktwert", cls: "text-red-600" },
  unknown: { label: "Nicht eindeutig", cls: "text-muted-foreground" },
};

function MarketAnalysisTab({ property }: { property: any }) {
  const qc = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: history = [] } = useQuery({
    queryKey: ["market_analyses", property.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("property_market_analyses")
        .select("id, created_at, sections, model, created_by")
        .eq("property_id", property.id)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const current = history.find((h: any) => h.id === selectedId) ?? history[0];
  const sections: any = current?.sections;

  const runAnalysis = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("property-market-analysis", {
        body: { property },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      await qc.invalidateQueries({ queryKey: ["market_analyses", property.id] });
      setSelectedId((data as any).id ?? null);
      toast.success("Marktanalyse erstellt");
    } catch (e: any) {
      toast.error(e?.message ?? "Marktanalyse fehlgeschlagen");
    } finally {
      setLoading(false);
    }
  };

  const deleteAnalysis = async (id: string) => {
    if (!confirm("Diese Analyse wirklich löschen?")) return;
    const { error } = await supabase.from("property_market_analyses").delete().eq("id", id);
    if (error) return toast.error("Löschen fehlgeschlagen");
    if (selectedId === id) setSelectedId(null);
    qc.invalidateQueries({ queryKey: ["market_analyses", property.id] });
    toast.success("Analyse gelöscht");
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="flex flex-wrap items-start justify-between gap-3 p-5">
          <div>
            <h2 className="flex items-center gap-2 font-display text-lg">
              <TrendingUp className="h-5 w-5 text-primary" />
              KI-Marktanalyse
            </h2>
            <p className="text-sm text-muted-foreground">
              Kaufpreis, Mietpotenzial & Lageeinschätzung – alle Versionen werden gespeichert.
            </p>
          </div>
          <Button onClick={runAnalysis} disabled={loading} className="gap-2">
            {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {history.length ? "Neue Analyse" : "Analyse starten"}
          </Button>
        </CardContent>
      </Card>

      {history.length > 0 && (
        <Card>
          <CardContent className="p-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Historie</span>
              {history.map((h: any) => {
                const isActive = (current?.id === h.id);
                return (
                  <button
                    key={h.id}
                    onClick={() => setSelectedId(h.id)}
                    className={`group flex items-center gap-2 rounded-full border px-3 py-1 text-xs transition ${isActive ? "border-primary bg-primary/10 text-primary" : "hover:bg-muted"}`}
                  >
                    <Calendar className="h-3 w-3" />
                    {formatDateTime(h.created_at)}
                    <Trash2
                      className="h-3 w-3 opacity-0 hover:text-destructive group-hover:opacity-60"
                      onClick={(e) => { e.stopPropagation(); deleteAnalysis(h.id); }}
                    />
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {!sections && !loading && (
        <Card><CardContent className="p-10 text-center">
          <Sparkles className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Klicke auf <strong>Analyse starten</strong>, um eine KI-gestützte Marktbeobachtung zu erstellen.
          </p>
        </CardContent></Card>
      )}
      {loading && !sections && (
        <Card><CardContent className="p-10 text-center text-sm text-muted-foreground">
          <RefreshCw className="mx-auto mb-2 h-5 w-5 animate-spin" />
          KI analysiert Markt, Lage und Preise…
        </CardContent></Card>
      )}

      {sections && (
        <div className="grid gap-4 md:grid-cols-2">
          {sections.recommendation && (
            <Card className={`md:col-span-2 border-2 ${verdictMap[sections.recommendation.verdict]?.cls ?? ""}`}>
              <CardContent className="flex flex-wrap items-center justify-between gap-3 p-5">
                <div className="flex items-center gap-3">
                  <div className="rounded-full bg-background/60 p-2"><CheckCircle2 className="h-5 w-5" /></div>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide opacity-70">Empfehlung</p>
                    <p className="font-display text-lg">{verdictMap[sections.recommendation.verdict]?.label ?? sections.recommendation.verdict}</p>
                  </div>
                </div>
                <p className="max-w-xl text-sm">{sections.recommendation.summary}</p>
              </CardContent>
            </Card>
          )}

          {sections.location && (
            <Card>
              <CardContent className="space-y-3 p-5">
                <div className="flex items-center justify-between">
                  <h3 className="flex items-center gap-2 font-display text-base"><MapPin className="h-4 w-4 text-primary" />Lageanalyse</h3>
                  <Badge variant="secondary">{sections.location.score}/10</Badge>
                </div>
                <p className="text-sm text-muted-foreground">{sections.location.summary}</p>
                {sections.location.highlights?.length > 0 && (
                  <ul className="space-y-1 text-sm">
                    {sections.location.highlights.map((h: string, i: number) => (
                      <li key={i} className="flex gap-2"><CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" /><span>{h}</span></li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          )}

          {sections.trend && (
            <Card>
              <CardContent className="space-y-3 p-5">
                <h3 className="flex items-center gap-2 font-display text-base"><TrendingUp className="h-4 w-4 text-primary" />Markttrend</h3>
                <div className={`flex items-baseline gap-2 ${trendMap[sections.trend.direction]?.cls ?? ""}`}>
                  <span className="text-3xl">{trendMap[sections.trend.direction]?.arrow}</span>
                  <span className="font-display text-lg">{trendMap[sections.trend.direction]?.label ?? sections.trend.direction}</span>
                </div>
                <p className="text-sm text-muted-foreground">{sections.trend.outlook}</p>
              </CardContent>
            </Card>
          )}

          {sections.purchase_price && (
            <Card>
              <CardContent className="space-y-3 p-5">
                <h3 className="flex items-center gap-2 font-display text-base"><Banknote className="h-4 w-4 text-primary" />Kaufpreis</h3>
                <div className="grid grid-cols-2 gap-3">
                  <MarketStat label="Preis pro m²" value={fmtRange(sections.purchase_price.price_per_sqm_min, sections.purchase_price.price_per_sqm_max, ` ${sections.purchase_price.currency}/m²`)} />
                  <MarketStat label="Verkehrswert" value={fmtRange(sections.purchase_price.estimated_value_min, sections.purchase_price.estimated_value_max, "", sections.purchase_price.currency)} />
                </div>
                <div className={`text-sm font-medium ${comparisonMap[sections.purchase_price.comparison]?.cls ?? ""}`}>
                  {comparisonMap[sections.purchase_price.comparison]?.label}
                </div>
                <p className="text-xs text-muted-foreground">{sections.purchase_price.comment}</p>
              </CardContent>
            </Card>
          )}

          {sections.rental && (
            <Card>
              <CardContent className="space-y-3 p-5">
                <h3 className="flex items-center gap-2 font-display text-base"><Building2 className="h-4 w-4 text-primary" />Vermietungspotenzial</h3>
                <div className="grid grid-cols-2 gap-3">
                  <MarketStat label="Miete pro m²" value={fmtRange(sections.rental.rent_per_sqm_min, sections.rental.rent_per_sqm_max, " /m²")} />
                  <MarketStat label="Monatsmiete" value={fmtRange(sections.rental.monthly_rent_min, sections.rental.monthly_rent_max)} />
                  {(sections.rental.gross_yield_min != null || sections.rental.gross_yield_max != null) && (
                    <MarketStat label="Bruttorendite" value={fmtRange(sections.rental.gross_yield_min, sections.rental.gross_yield_max, " %")} className="col-span-2" />
                  )}
                </div>
                <p className="text-xs text-muted-foreground">{sections.rental.comment}</p>
              </CardContent>
            </Card>
          )}

          {sections.opportunities?.length > 0 && (
            <Card className="border-emerald-500/30">
              <CardContent className="space-y-2 p-5">
                <h3 className="flex items-center gap-2 font-display text-base text-emerald-700 dark:text-emerald-400">
                  <CheckCircle2 className="h-4 w-4" />Chancen
                </h3>
                <ul className="space-y-1.5 text-sm">
                  {sections.opportunities.map((o: string, i: number) => (
                    <li key={i} className="flex gap-2"><span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" /><span>{o}</span></li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {sections.risks?.length > 0 && (
            <Card className="border-red-500/30">
              <CardContent className="space-y-2 p-5">
                <h3 className="flex items-center gap-2 font-display text-base text-red-700 dark:text-red-400">
                  <Activity className="h-4 w-4" />Risiken
                </h3>
                <ul className="space-y-1.5 text-sm">
                  {sections.risks.map((r: string, i: number) => (
                    <li key={i} className="flex gap-2"><span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-red-500" /><span>{r}</span></li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          <div className="md:col-span-2 px-1 text-xs text-muted-foreground">
            ⚠️ KI-generierte Einschätzung – ersetzt keine professionelle Verkehrswertermittlung.
            {current?.created_at && ` · Erstellt ${formatDateTime(current.created_at)}`}
            {current?.model && ` · ${current.model}`}
          </div>
        </div>
      )}
    </div>
  );
}

function MarketStat({ label, value, className = "" }: { label: string; value: string; className?: string }) {
  return (
    <div className={`rounded-lg border bg-muted/30 p-3 ${className}`}>
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-base">{value}</p>
    </div>
  );
}
