import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Plus, MapPin, Bed, Maximize, Search, LayoutGrid, List as ListIcon, Archive, ArchiveRestore, Trash2, UserCog, MoreHorizontal, X, Upload, Building2, Layers3, ChevronRight, ChevronDown, SlidersHorizontal, RotateCcw } from "lucide-react";
import { PropertyImportDialog } from "@/components/properties/PropertyImportDialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { formatCurrency, formatArea, propertyTypeLabels, propertyStatusLabels, listingTypeLabels, getPropertyStatusBadgeClass, getPropertyStatusDotClass } from "@/lib/format";
import { EmptyState } from "@/components/EmptyState";
import { PropertyWizard, type WizardSubmit } from "@/components/properties/PropertyWizard";

export const Route = createFileRoute("/_app/properties/")({ component: PropertiesPage });

const PROP_TYPES = ["apartment","house","commercial","land","parking","mixed_use","other"] as const;
const STATUSES = ["draft","preparation","active","available","reserved","sold","rented","archived"] as const;

function getMediaPublicUrl(path?: string | null) {
  if (!path) return "";
  if (path.startsWith("http")) return path;
  return supabase.storage.from("media").getPublicUrl(path).data.publicUrl;
}

type ViewMode = "grid" | "list";

function PropertiesPage() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [fStatus, setFStatus] = useState<string>("all");
  const [fType, setFType] = useState<string>("all");
  const [fListing, setFListing] = useState<string>("all");
  const [fCity, setFCity] = useState<string>("all");
  const [fAssigned, setFAssigned] = useState<string>("all");
  const [archivedFilter, setArchivedFilter] = useState<"active" | "archived" | "all">("active");
  const [fStructure, setFStructure] = useState<"all" | "buildings" | "units" | "standalone">("all");
  const [groupUnits, setGroupUnits] = useState<boolean>(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [view, setView] = useState<ViewMode>("list");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  const { data: properties = [], isLoading } = useQuery({
    queryKey: ["properties"],
    queryFn: async () => {
      const { data, error } = await supabase.from("properties").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: employees = [] } = useQuery({
    queryKey: ["employees"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id, full_name, email").eq("is_active", true);
      if (error) throw error;
      return data;
    },
  });

  const employeeMap = useMemo(() => new Map(employees.map((e: any) => [e.id, e])), [employees]);
  const cities = useMemo(() => Array.from(new Set(properties.map(p => p.city).filter(Boolean))) as string[], [properties]);

  const create = useMutation({
    mutationFn: async (payload: WizardSubmit) => {
      const propPayload = { ...payload.property, owner_id: user!.id };
      const { data: created, error } = await supabase
        .from("properties")
        .insert(propPayload as any)
        .select("id")
        .single();
      if (error) throw error;
      if (payload.units.length > 0 && created?.id) {
        const unitsPayload = payload.units.map((u) => ({
          ...u,
          owner_id: user!.id,
          parent_property_id: created.id,
        }));
        const { error: uErr } = await supabase.from("properties").insert(unitsPayload as any);
        if (uErr) throw uErr;
      }
      if (payload.media.length > 0 && created?.id) {
        const mediaRows = payload.media.map((m, i) => ({
          property_id: created.id,
          file_url: m.file_url,
          file_name: m.file_name,
          file_type: m.file_type,
          title: m.title,
          is_cover: m.is_cover,
          sort_order: i + 1,
        }));
        const { error: mErr } = await supabase.from("property_media").insert(mediaRows as any);
        if (mErr) throw mErr;
      }
      return created;
    },
    onSuccess: () => {
      toast.success("Immobilie erstellt");
      qc.invalidateQueries({ queryKey: ["properties"] });
      setOpen(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const filtered = properties.filter(p => {
    if (archivedFilter === "active" && p.status === "archived") return false;
    if (archivedFilter === "archived" && p.status !== "archived") return false;
    if (search && !(`${p.title} ${p.city ?? ""} ${p.address ?? ""}`.toLowerCase().includes(search.toLowerCase()))) return false;
    if (fStatus !== "all" && p.status !== fStatus) return false;
    if (fType !== "all" && p.property_type !== fType) return false;
    if (fListing !== "all" && p.listing_type !== fListing) return false;
    if (fCity !== "all" && p.city !== fCity) return false;
    if (fAssigned !== "all" && p.assigned_to !== fAssigned) return false;
    if (fStructure === "units" && !p.is_unit) return false;
    if (fStructure === "standalone" && (p.is_unit || (properties as any[]).some(x => x.parent_property_id === p.id))) return false;
    if (fStructure === "buildings" && !(properties as any[]).some(x => x.parent_property_id === p.id)) return false;
    return true;
  });

  // Units-by-parent map for badges + grouping
  const unitsByParent = useMemo(() => {
    const m = new Map<string, any[]>();
    for (const p of properties as any[]) {
      if (p.parent_property_id) {
        const arr = m.get(p.parent_property_id) ?? [];
        arr.push(p);
        m.set(p.parent_property_id, arr);
      }
    }
    return m;
  }, [properties]);
  const propertyById = useMemo(() => new Map((properties as any[]).map(p => [p.id, p])), [properties]);

  // Build display rows: when grouping, hide units whose parent is also visible (they show inside parent)
  const displayed = useMemo(() => {
    if (!groupUnits || fStructure === "units") return filtered;
    const visibleIds = new Set(filtered.map(p => p.id));
    return filtered.filter(p => !(p.is_unit && p.parent_property_id && visibleIds.has(p.parent_property_id)));
  }, [filtered, groupUnits, fStructure]);

  const toggleExpanded = (id: string) => setExpanded(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const [pageSize, setPageSize] = useState<number>(20);
  const [page, setPage] = useState(1);
  useEffect(() => { setPage(1); }, [search, fStatus, fType, fListing, fCity, fAssigned, archivedFilter, fStructure, groupUnits, pageSize, view]);
  const totalPages = Math.max(1, Math.ceil(displayed.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paginated = useMemo(
    () => displayed.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    [displayed, currentPage, pageSize],
  );

  const toggleOne = (id: string) => setSelected((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const allFilteredSelected = filtered.length > 0 && filtered.every((p: any) => selected.has(p.id));
  const toggleAll = () => setSelected((prev) => {
    if (allFilteredSelected) {
      const next = new Set(prev);
      filtered.forEach((p: any) => next.delete(p.id));
      return next;
    }
    const next = new Set(prev);
    filtered.forEach((p: any) => next.add(p.id));
    return next;
  });
  const clearSelection = () => setSelected(new Set());

  const assign = useMutation({
    mutationFn: async (assignedTo: string | null) => {
      const ids = Array.from(selected);
      if (!ids.length) return;
      const { error } = await supabase.from("properties").update({ assigned_to: assignedTo }).in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Zuweisung aktualisiert");
      qc.invalidateQueries({ queryKey: ["properties"] });
      clearSelection();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const archive = useMutation({
    mutationFn: async (toArchived: boolean) => {
      const ids = Array.from(selected);
      if (!ids.length) return;
      const { error } = await supabase
        .from("properties")
        .update({ status: toArchived ? "archived" : "draft" })
        .in("id", ids);
      if (error) throw error;
    },
    onSuccess: (_, toArchived) => {
      toast.success(toArchived ? "Immobilien archiviert" : "Immobilien wiederhergestellt");
      qc.invalidateQueries({ queryKey: ["properties"] });
      clearSelection();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async () => {
      const ids = Array.from(selected);
      if (!ids.length) return;
      const { error } = await supabase.from("properties").delete().in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Immobilien gelöscht");
      qc.invalidateQueries({ queryKey: ["properties"] });
      clearSelection();
      setConfirmDelete(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const selectionCount = selected.size;

  return (
    <>
      <PageHeader
        title="Immobilien"
        description="Dein Immobilienportfolio im Überblick"
        action={
          <div className="flex items-center gap-2">
            <Tabs value={view} onValueChange={(v) => setView(v as ViewMode)}>
              <TabsList>
                <TabsTrigger value="grid"><LayoutGrid className="mr-1 h-4 w-4" />Kacheln</TabsTrigger>
                <TabsTrigger value="list"><ListIcon className="mr-1 h-4 w-4" />Liste</TabsTrigger>
              </TabsList>
            </Tabs>
            <Button variant="outline" onClick={() => setImportOpen(true)}><Upload className="mr-1 h-4 w-4" />Immobilien importieren</Button>
            <Button onClick={() => setOpen(true)}><Plus className="mr-1 h-4 w-4" />Neue Immobilie</Button>
          </div>
        }
      />

      <PropertyWizard
        open={open}
        onOpenChange={setOpen}
        onSubmit={(payload) => create.mutate(payload)}
        submitting={create.isPending}
      />

      <PropertyImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onImported={() => qc.invalidateQueries({ queryKey: ["properties"] })}
      />

      {(() => {
        const activeChips: Array<{ key: string; label: string; clear: () => void }> = [];
        if (fStatus !== "all") activeChips.push({ key: "status", label: `Status: ${propertyStatusLabels[fStatus as keyof typeof propertyStatusLabels]}`, clear: () => setFStatus("all") });
        if (fListing !== "all") activeChips.push({ key: "listing", label: `Vermarktung: ${fListing === "sale" ? "Kauf" : "Miete"}`, clear: () => setFListing("all") });
        if (fType !== "all") activeChips.push({ key: "type", label: `Typ: ${propertyTypeLabels[fType as keyof typeof propertyTypeLabels]}`, clear: () => setFType("all") });
        if (fCity !== "all") activeChips.push({ key: "city", label: `Stadt: ${fCity}`, clear: () => setFCity("all") });
        if (fAssigned !== "all") {
          const emp = employees.find((e: any) => e.id === fAssigned) as any;
          activeChips.push({ key: "assigned", label: `Zuständig: ${emp?.full_name || emp?.email || "—"}`, clear: () => setFAssigned("all") });
        }
        if (fStructure !== "all") {
          const labels: Record<string, string> = { buildings: "Liegenschaften", units: "Einheiten", standalone: "Einzelobjekte" };
          activeChips.push({ key: "structure", label: `Struktur: ${labels[fStructure]}`, clear: () => setFStructure("all") });
        }
        if (archivedFilter !== "active") {
          activeChips.push({ key: "arch", label: archivedFilter === "archived" ? "Nur archivierte" : "Aktiv & archivierte", clear: () => setArchivedFilter("active") });
        }
        const resetAll = () => {
          setSearch(""); setFStatus("all"); setFType("all"); setFListing("all");
          setFCity("all"); setFAssigned("all"); setFStructure("all"); setArchivedFilter("active");
        };
        const hasActive = activeChips.length > 0 || search.length > 0;

        return (
          <div className="mb-4 space-y-2">
            {/* Quick filter row */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative min-w-[220px] flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input className="pl-9" placeholder="Suchen nach Titel, Adresse, Ort…" value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
              <Select value={fStatus} onValueChange={setFStatus}>
                <SelectTrigger className="h-9 w-[150px]"><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle Status</SelectItem>
                  {STATUSES.map(s => <SelectItem key={s} value={s}>{propertyStatusLabels[s]}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={fListing} onValueChange={setFListing}>
                <SelectTrigger className="h-9 w-[140px]"><SelectValue placeholder="Vermarktung" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Kauf & Miete</SelectItem>
                  <SelectItem value="sale">Kauf</SelectItem>
                  <SelectItem value="rent">Miete</SelectItem>
                </SelectContent>
              </Select>
              <Select value={archivedFilter} onValueChange={(v) => setArchivedFilter(v as typeof archivedFilter)}>
                <SelectTrigger className="h-9 w-[130px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Aktiv</SelectItem>
                  <SelectItem value="archived">Archiviert</SelectItem>
                  <SelectItem value="all">Alle</SelectItem>
                </SelectContent>
              </Select>
              {view === "list" && fStructure !== "units" && (
                <Button
                  size="sm"
                  variant={groupUnits ? "default" : "outline"}
                  onClick={() => setGroupUnits(g => !g)}
                  title={groupUnits ? "Gruppiert nach Liegenschaft" : "Flache Liste"}
                >
                  <Layers3 className="mr-1 h-4 w-4" />
                  {groupUnits ? "Gruppiert" : "Flach"}
                </Button>
              )}
              <Button
                size="sm"
                variant={moreOpen ? "default" : "outline"}
                onClick={() => setMoreOpen(o => !o)}
              >
                <SlidersHorizontal className="mr-1 h-4 w-4" />
                Mehr Filter
                {activeChips.filter(c => ["type","city","assigned","structure"].includes(c.key)).length > 0 && (
                  <Badge variant="secondary" className="ml-2 h-5 px-1.5 text-[10px]">
                    {activeChips.filter(c => ["type","city","assigned","structure"].includes(c.key)).length}
                  </Badge>
                )}
              </Button>
              {hasActive && (
                <Button size="sm" variant="ghost" onClick={resetAll}>
                  <RotateCcw className="mr-1 h-4 w-4" />Zurücksetzen
                </Button>
              )}
            </div>

            {/* Expandable advanced filters */}
            {moreOpen && (
              <div className="grid gap-2 rounded-xl border bg-muted/20 p-3 sm:grid-cols-2 lg:grid-cols-4">
                <Select value={fType} onValueChange={setFType}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Typ" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Alle Typen</SelectItem>
                    {PROP_TYPES.map(t => <SelectItem key={t} value={t}>{propertyTypeLabels[t]}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={fStructure} onValueChange={(v) => setFStructure(v as typeof fStructure)}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Alle Strukturen</SelectItem>
                    <SelectItem value="buildings">Nur Liegenschaften</SelectItem>
                    <SelectItem value="units">Nur Einheiten</SelectItem>
                    <SelectItem value="standalone">Nur Einzelobjekte</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={fAssigned} onValueChange={setFAssigned}>
                  <SelectTrigger className="h-9"><SelectValue placeholder="Zuständig" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Alle Mitarbeiter</SelectItem>
                    {employees.map((e: any) => <SelectItem key={e.id} value={e.id}>{e.full_name || e.email}</SelectItem>)}
                  </SelectContent>
                </Select>
                {cities.length > 1 && (
                  <Select value={fCity} onValueChange={setFCity}>
                    <SelectTrigger className="h-9"><SelectValue placeholder="Stadt" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Alle Städte</SelectItem>
                      {cities.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )}
              </div>
            )}

            {/* Active chips */}
            {activeChips.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                {activeChips.map(chip => (
                  <Badge key={chip.key} variant="secondary" className="gap-1 pr-1">
                    {chip.label}
                    <button
                      type="button"
                      onClick={chip.clear}
                      className="rounded-sm p-0.5 hover:bg-background/60"
                      aria-label={`${chip.label} entfernen`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>
        );
      })()}

      {selectionCount > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border bg-accent/40 p-3">
          <span className="text-sm font-medium">{selectionCount} ausgewählt</span>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline"><UserCog className="mr-1 h-4 w-4" />Zuweisen</Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="max-h-72 overflow-y-auto">
                <DropdownMenuLabel>Mitarbeitende</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => assign.mutate(null)}>
                  <X className="mr-2 h-4 w-4" />Zuweisung entfernen
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {employees.map((e: any) => (
                  <DropdownMenuItem key={e.id} onClick={() => assign.mutate(e.id)}>
                    {e.full_name ?? e.email}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            {archivedFilter === "archived" ? (
              <Button size="sm" variant="outline" onClick={() => archive.mutate(false)}>
                <ArchiveRestore className="mr-1 h-4 w-4" />Wiederherstellen
              </Button>
            ) : (
              <Button size="sm" variant="outline" onClick={() => archive.mutate(true)}>
                <Archive className="mr-1 h-4 w-4" />Archivieren
              </Button>
            )}
            <Button size="sm" variant="destructive" onClick={() => setConfirmDelete(true)}>
              <Trash2 className="mr-1 h-4 w-4" />Löschen
            </Button>
            <Button size="sm" variant="ghost" onClick={clearSelection}>
              <X className="mr-1 h-4 w-4" />Auswahl aufheben
            </Button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="text-sm text-muted-foreground">Lädt…</div>
      ) : displayed.length === 0 ? (
        <EmptyState
          title={properties.length === 0 ? "Noch keine Immobilien" : "Keine Treffer"}
          description={properties.length === 0
            ? "Erfasse dein erstes Objekt — Titel, Adresse, Preis und Bild reichen zum Start."
            : "Passe die Filter an oder leere die Suche."}
          action={properties.length === 0 ? (
            <Button onClick={() => setOpen(true)}><Plus className="mr-1 h-4 w-4" />Neue Immobilie</Button>
          ) : undefined}
        />
      ) : view === "grid" ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {paginated.map((p: any) => {
            const isSel = selected.has(p.id);
            const childUnits = unitsByParent.get(p.id) ?? [];
            const parentProp = p.parent_property_id ? propertyById.get(p.parent_property_id) : null;
            return (
              <div key={p.id} className={`group relative overflow-hidden rounded-2xl border bg-card shadow-soft transition hover:shadow-glow ${isSel ? "ring-2 ring-primary" : ""}`}>
                <div className="absolute left-3 top-3 z-10 rounded-md bg-background/90 p-1 backdrop-blur">
                  <Checkbox checked={isSel} onCheckedChange={() => toggleOne(p.id)} aria-label="Auswählen" />
                </div>
                <Link to="/properties/$id" params={{ id: p.id }} className="block">
                  <div className="aspect-[4/3] overflow-hidden bg-muted">
                    {p.images?.[0] ? (
                      <img src={getMediaPublicUrl(p.images[0])} alt={p.title} className="h-full w-full object-cover transition group-hover:scale-105" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-gradient-soft text-muted-foreground">Kein Bild</div>
                    )}
                  </div>
                  <div className="p-4">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge variant="outline" className={`text-xs ${getPropertyStatusBadgeClass(p.status)}`}>{propertyStatusLabels[p.status as keyof typeof propertyStatusLabels]}</Badge>
                      {childUnits.length > 0 && (
                        <Badge className="bg-primary/10 text-primary hover:bg-primary/15 text-xs">
                          <Building2 className="mr-1 h-3 w-3" />Liegenschaft · {childUnits.length} Einheit{childUnits.length === 1 ? "" : "en"}
                        </Badge>
                      )}
                      {p.is_unit && (
                        <Badge variant="outline" className="text-xs">
                          <Layers3 className="mr-1 h-3 w-3" />Einheit{p.unit_number ? ` ${p.unit_number}` : ""}
                        </Badge>
                      )}
                      <span className="ml-auto text-xs text-muted-foreground">{listingTypeLabels[p.listing_type as keyof typeof listingTypeLabels]}</span>
                    </div>
                    <h3 className="mt-2 line-clamp-1 font-semibold">{p.title}</h3>
                    {parentProp && (
                      <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">↳ in {parentProp.title}</p>
                    )}
                    <p className="mt-1 line-clamp-1 flex items-center gap-1 text-xs text-muted-foreground">
                      <MapPin className="h-3 w-3" />{[p.address, p.city].filter(Boolean).join(", ") || "—"}
                    </p>
                    <div className="mt-3 flex items-center justify-between">
                      <span className="font-display text-lg font-bold">
                        {formatCurrency(p.listing_type === "rent" ? (p.rent ? Number(p.rent) : null) : (p.price ? Number(p.price) : null))}
                        {p.listing_type === "rent" && p.rent ? <span className="text-xs font-normal text-muted-foreground"> /Mt.</span> : null}
                      </span>
                      <div className="flex gap-3 text-xs text-muted-foreground">
                        {p.rooms && <span className="flex items-center gap-1"><Bed className="h-3 w-3" />{p.rooms}</span>}
                        {(p.living_area || p.area) && <span className="flex items-center gap-1"><Maximize className="h-3 w-3" />{formatArea(Number(p.living_area || p.area))}</span>}
                      </div>
                    </div>
                  </div>
                </Link>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox checked={allFilteredSelected} onCheckedChange={toggleAll} aria-label="Alle auswählen" />
                </TableHead>
                <TableHead>Titel</TableHead>
                <TableHead>Typ</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Ort</TableHead>
                <TableHead className="text-right">Preis</TableHead>
                <TableHead>Zuständig</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginated.flatMap((p: any) => {
                const renderRow = (row: any, opts: { indent?: boolean } = {}) => {
                  const emp = row.assigned_to ? (employeeMap.get(row.assigned_to) as any) : null;
                  const isArchived = row.status === "archived";
                  const childUnits = unitsByParent.get(row.id) ?? [];
                  const isParent = !opts.indent && childUnits.length > 0;
                  const showExpander = isParent && groupUnits && fStructure !== "units";
                  const isExpanded = expanded.has(row.id);
                  const parentProp = row.parent_property_id ? propertyById.get(row.parent_property_id) : null;
                  return (
                    <TableRow key={row.id} data-state={selected.has(row.id) ? "selected" : undefined} className={opts.indent ? "bg-muted/20" : undefined}>
                      <TableCell>
                        <Checkbox checked={selected.has(row.id)} onCheckedChange={() => toggleOne(row.id)} aria-label="Auswählen" />
                      </TableCell>
                      <TableCell>
                        <div className={`flex items-center gap-2 ${opts.indent ? "pl-6" : ""}`}>
                          {showExpander ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0 -ml-1"
                              onClick={(e) => { e.preventDefault(); toggleExpanded(row.id); }}
                              aria-label={isExpanded ? "Einklappen" : "Aufklappen"}
                            >
                              {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                            </Button>
                          ) : opts.indent ? (
                            <span className="text-muted-foreground">↳</span>
                          ) : null}
                          <div className="min-w-0">
                            <Link to="/properties/$id" params={{ id: row.id }} className="font-medium hover:text-primary">
                              {row.title}
                            </Link>
                            <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                              {isParent && (
                                <Badge className="bg-primary/10 text-primary hover:bg-primary/15 text-[10px] px-1.5 py-0">
                                  <Building2 className="mr-1 h-3 w-3" />Liegenschaft · {childUnits.length}
                                </Badge>
                              )}
                              {row.is_unit && (
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                                  <Layers3 className="mr-1 h-3 w-3" />Einheit{row.unit_number ? ` ${row.unit_number}` : ""}
                                </Badge>
                              )}
                              {row.is_unit && parentProp && !opts.indent && (
                                <span className="text-[11px] text-muted-foreground">in {parentProp.title}</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{propertyTypeLabels[row.property_type as keyof typeof propertyTypeLabels]}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-xs ${getPropertyStatusBadgeClass(row.status)}`}>{propertyStatusLabels[row.status as keyof typeof propertyStatusLabels]}</Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{[row.address, row.city].filter(Boolean).join(", ") || "—"}</TableCell>
                      <TableCell className="text-right text-sm">
                        {formatCurrency(row.listing_type === "rent" ? (row.rent ? Number(row.rent) : null) : (row.price ? Number(row.price) : null))}
                        {row.listing_type === "rent" && row.rent ? <span className="text-xs text-muted-foreground"> /Mt.</span> : null}
                      </TableCell>
                      <TableCell className="text-sm">{emp ? (emp.full_name ?? emp.email) : <span className="text-muted-foreground">—</span>}</TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0"><MoreHorizontal className="h-4 w-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem asChild>
                              <Link to="/properties/$id" params={{ id: row.id }}>Öffnen</Link>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {isArchived ? (
                              <DropdownMenuItem onClick={() => { setSelected(new Set([row.id])); archive.mutate(false); }}>
                                <ArchiveRestore className="mr-2 h-4 w-4" />Wiederherstellen
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem onClick={() => { setSelected(new Set([row.id])); archive.mutate(true); }}>
                                <Archive className="mr-2 h-4 w-4" />Archivieren
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => { setSelected(new Set([row.id])); setConfirmDelete(true); }}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />Löschen
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                };
                const rows = [renderRow(p)];
                const childUnits = unitsByParent.get(p.id) ?? [];
                if (groupUnits && fStructure !== "units" && childUnits.length > 0 && expanded.has(p.id)) {
                  for (const u of childUnits) rows.push(renderRow(u, { indent: true }));
                }
                return rows;
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {displayed.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <span>
              Zeige {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, displayed.length)} von {displayed.length}
            </span>
            <Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v))}>
              <SelectTrigger className="h-8 w-[110px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="20">20 / Seite</SelectItem>
                <SelectItem value="50">50 / Seite</SelectItem>
                <SelectItem value="100">100 / Seite</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}>Zurück</Button>
            <span>Seite {currentPage} / {totalPages}</span>
            <Button size="sm" variant="outline" disabled={currentPage >= totalPages} onClick={() => setPage(currentPage + 1)}>Weiter</Button>
          </div>
        </div>
      )}

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Immobilien löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              {selectionCount} Objekt{selectionCount === 1 ? "" : "e"} werden unwiderruflich gelöscht. Verknüpfte Daten können verloren gehen.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={() => remove.mutate()} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Endgültig löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
