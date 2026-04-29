import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft, MapPin, Bed, Bath, Maximize, Calendar, Zap, FileText, Trash2, Pencil, Plus, ExternalLink, CheckCircle2, Circle, Image as ImageIcon, User } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState } from "@/components/EmptyState";
import { PropertyFormDialog, type PropertyFormValues } from "@/components/properties/PropertyFormDialog";
import { formatCurrency, formatArea, formatDate, formatDateTime, propertyTypeLabels, propertyStatusLabels, listingTypeLabels } from "@/lib/format";
import { toast } from "sonner";
import { MatchPanel } from "@/components/matching/MatchPanel";
import { GeneratedDocumentsTable } from "@/components/documents/GeneratedDocumentsTable";

export const Route = createFileRoute("/_app/properties/$id")({ component: PropertyDetail });

const STATUSES = ["draft","preparation","active","available","reserved","sold","rented","archived"] as const;

function PropertyDetail() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [editOpen, setEditOpen] = useState(false);

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

  const update = useMutation({
    mutationFn: async (values: Partial<PropertyFormValues>) => {
      const { error } = await supabase.from("properties").update(values as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Gespeichert");
      qc.invalidateQueries({ queryKey: ["property", id] });
      qc.invalidateQueries({ queryKey: ["properties"] });
      setEditOpen(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const updateStatus = useMutation({
    mutationFn: async (status: string) => {
      const { error } = await supabase.from("properties").update({ status: status as any }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Status aktualisiert"); qc.invalidateQueries({ queryKey: ["property", id] }); },
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
          <Button variant="outline" onClick={() => setEditOpen(true)}><Pencil className="mr-1 h-4 w-4" />Bearbeiten</Button>
          <Select value={p.status} onValueChange={(v) => updateStatus.mutate(v)}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>{STATUSES.map(s => <SelectItem key={s} value={s}>{propertyStatusLabels[s]}</SelectItem>)}</SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={() => { if (confirm("Wirklich löschen?")) del.mutate(); }}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <PropertyFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        employees={employees as any}
        initial={p as any}
        onSubmit={(v) => update.mutate(v)}
        submitting={update.isPending}
      />

      {/* Hero */}
      <div className="mb-6 grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 aspect-[16/10] overflow-hidden rounded-2xl border bg-muted">
          {p.images?.[0] ? (
            <img src={p.images[0]} alt={p.title} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gradient-soft text-muted-foreground">Kein Bild</div>
          )}
        </div>
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Badge>{propertyStatusLabels[p.status as keyof typeof propertyStatusLabels]}</Badge>
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
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="flex flex-wrap h-auto gap-1">
          <TabsTrigger value="overview">Übersicht</TabsTrigger>
          <TabsTrigger value="owner">Eigentümer</TabsTrigger>
          <TabsTrigger value="facts">Eckdaten</TabsTrigger>
          <TabsTrigger value="media">Medien</TabsTrigger>
          <TabsTrigger value="documents">Dokumente</TabsTrigger>
          <TabsTrigger value="checklists">Checklisten</TabsTrigger>
          <TabsTrigger value="tasks">Aufgaben</TabsTrigger>
          <TabsTrigger value="appointments">Termine</TabsTrigger>
          <TabsTrigger value="mandate">Mandat</TabsTrigger>
          <TabsTrigger value="reservation">Reservation</TabsTrigger>
          <TabsTrigger value="expose">Exposé</TabsTrigger>
          <TabsTrigger value="matching">Matching</TabsTrigger>
        </TabsList>

        <TabsContent value="overview"><OverviewTab p={p} /></TabsContent>
        <TabsContent value="owner"><OwnerTab p={p} /></TabsContent>
        <TabsContent value="facts"><FactsTab p={p} /></TabsContent>
        <TabsContent value="media"><MediaTab propertyId={id} cover={p.images?.[0]} /></TabsContent>
        <TabsContent value="documents"><DocumentsTab propertyId={id} /></TabsContent>
        <TabsContent value="checklists"><ChecklistsTab propertyId={id} /></TabsContent>
        <TabsContent value="tasks"><TasksTab propertyId={id} /></TabsContent>
        <TabsContent value="appointments"><AppointmentsTab propertyId={id} /></TabsContent>
        <TabsContent value="mandate"><MandateTab propertyId={id} /></TabsContent>
        <TabsContent value="reservation"><ReservationTab propertyId={id} /></TabsContent>
        <TabsContent value="expose"><ExposeTab propertyId={id} /></TabsContent>
        <TabsContent value="matching" className="mt-4"><MatchPanel direction="property-to-client" property={p} /></TabsContent>
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
              {m.file_url?.match(/\.(jpe?g|png|webp|gif|avif)$/i) ? (
                <img src={m.file_url} alt={m.title ?? ""} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-xs text-muted-foreground">
                  <ImageIcon className="h-6 w-6" />
                  <a href={m.file_url} target="_blank" rel="noreferrer" className="underline">Datei öffnen</a>
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
