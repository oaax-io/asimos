import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Plus, MapPin, Bed, Maximize, Search, LayoutGrid, List as ListIcon, Map as MapIcon, Archive, ArchiveRestore, Trash2, UserCog, MoreHorizontal, X, Upload, Building2, Layers3, ChevronRight, ChevronDown, SlidersHorizontal, RotateCcw } from "lucide-react";
import { PropertiesMap } from "@/components/properties/PropertiesMap";
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
import { formatCurrency, formatArea, getPropertyStatusBadgeClass, getPropertyStatusDotClass } from "@/lib/format";
import { EmptyState } from "@/components/EmptyState";
import { PropertyWizard, type WizardSubmit } from "@/components/properties/PropertyWizard";
import { useTranslation } from "react-i18next";

export const Route = createFileRoute("/_app/properties/")({ component: PropertiesPage });

const PROP_TYPES = ["apartment","house","commercial","land","parking","mixed_use","other"] as const;
const STATUSES = ["draft","preparation","available","reserved","sold","rented","archived"] as const;

function getMediaPublicUrl(path?: string | null) {
  if (!path) return "";
  if (path.startsWith("http")) return path;
  return supabase.storage.from("media").getPublicUrl(path).data.publicUrl;
}

type ViewMode = "grid" | "list" | "map";

function PropertiesPage() {
  const { t } = useTranslation();
  const statusLabel = (s: string) => t(`properties.status.${s}`, { defaultValue: s });
  const typeLabel = (s: string) => t(`properties.type.${s}`, { defaultValue: s });
  const listingLabel = (s: string) => t(`properties.listing.${s}`, { defaultValue: s });
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

      const ownerClientId = (payload.property as { owner_client_id?: string | null }).owner_client_id ?? null;
      if (ownerClientId && created?.id) {
        await supabase.from("property_ownerships").insert({
          property_id: created.id,
          client_id: ownerClientId,
          ownership_type: "owner",
          start_date: new Date().toISOString().slice(0, 10),
          source: "manual",
          is_primary_contact: true,
        });
        await supabase.from("client_roles").insert({
          client_id: ownerClientId,
          role_type: "owner",
          related_type: "property",
          related_id: created.id,
          status: "active",
          start_date: new Date().toISOString().slice(0, 10),
        });
      }

      if (payload.units.length > 0 && created?.id) {
        const unitsPayload = payload.units.map((u) => ({
          ...u,
          owner_id: user!.id,
          parent_property_id: created.id,
        }));
        const { data: createdUnits, error: uErr } = await supabase
          .from("properties")
          .insert(unitsPayload as any)
          .select("id, owner_client_id");
        if (uErr) throw uErr;
        const today = new Date().toISOString().slice(0, 10);
        const unitOwnerships = (createdUnits ?? [])
          .filter((u: any) => u.owner_client_id)
          .map((u: any) => ({
            property_id: u.id,
            client_id: u.owner_client_id,
            ownership_type: "owner" as const,
            start_date: today,
            source: "manual",
            is_primary_contact: true,
          }));
        if (unitOwnerships.length > 0) {
          await supabase.from("property_ownerships").insert(unitOwnerships);
        }
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
      toast.success(t("properties.toasts.created"));
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

  // Units-by-parent map, children sorted newest-first
  const unitsByParent = useMemo(() => {
    const m = new Map<string, any[]>();
    for (const p of properties as any[]) {
      if (p.parent_property_id) {
        const arr = m.get(p.parent_property_id) ?? [];
        arr.push(p);
        m.set(p.parent_property_id, arr);
      }
    }
    for (const [key, arr] of m) {
      m.set(key, arr.sort((a: any, b: any) => {
        const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
        const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
        return bTime - aTime;
      }));
    }
    return m;
  }, [properties]);
  const propertyById = useMemo(() => new Map((properties as any[]).map(p => [p.id, p])), [properties]);

  // Build display rows: when grouping, hide units whose parent is also visible (they show inside parent)
  const displayed = useMemo(() => {
    let rows: any[];
    if (!groupUnits || fStructure === "units") rows = filtered;
    else {
      const visibleIds = new Set(filtered.map(p => p.id));
      rows = filtered.filter(p => !(p.is_unit && p.parent_property_id && visibleIds.has(p.parent_property_id)));
    }
    // Sicherstellen: zuletzt hinzugefügt zuoberst
    return [...rows].sort((a, b) => {
      const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
      const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
      return bTime - aTime;
    });
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
      toast.success(t("properties.toasts.assignmentUpdated"));
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
      toast.success(toArchived ? t("properties.toasts.archived") : t("properties.toasts.restored"));
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
      toast.success(t("properties.toasts.deleted"));
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
        i18nKey="properties"
        action={
          <div className="flex items-center gap-2">
            <Tabs value={view} onValueChange={(v) => setView(v as ViewMode)}>
              <TabsList className="h-9 rounded-lg bg-primary/15 p-1">
                <TabsTrigger value="grid" className="gap-1.5 rounded-md data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"><LayoutGrid className="h-4 w-4" />{t("properties.view.grid")}</TabsTrigger>
                <TabsTrigger value="list" className="gap-1.5 rounded-md data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"><ListIcon className="h-4 w-4" />{t("properties.view.list")}</TabsTrigger>
                <TabsTrigger value="map" className="gap-1.5 rounded-md data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"><MapIcon className="h-4 w-4" />{t("properties.view.map")}</TabsTrigger>
              </TabsList>
            </Tabs>
            <Button variant="outline" onClick={() => setImportOpen(true)}><Upload className="mr-1 h-4 w-4" />{t("properties.import")}</Button>
            <Button onClick={() => setOpen(true)}><Plus className="mr-1 h-4 w-4" />{t("properties.new")}</Button>
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
        if (fStatus !== "all") activeChips.push({ key: "status", label: t("properties.chips.status", { value: statusLabel(fStatus) }), clear: () => setFStatus("all") });
        if (fListing !== "all") activeChips.push({ key: "listing", label: t("properties.chips.listing", { value: listingLabel(fListing) }), clear: () => setFListing("all") });
        if (fType !== "all") activeChips.push({ key: "type", label: t("properties.chips.type", { value: typeLabel(fType) }), clear: () => setFType("all") });
        if (fCity !== "all") activeChips.push({ key: "city", label: t("properties.chips.city", { value: fCity }), clear: () => setFCity("all") });
        if (fAssigned !== "all") {
          const emp = employees.find((e: any) => e.id === fAssigned) as any;
          activeChips.push({ key: "assigned", label: t("properties.chips.assigned", { value: emp?.full_name || emp?.email || "—" }), clear: () => setFAssigned("all") });
        }
        if (fStructure !== "all") {
          const labels: Record<string, string> = {
            buildings: t("properties.structure.buildings"),
            units: t("properties.structure.units"),
            standalone: t("properties.structure.standalone"),
          };
          activeChips.push({ key: "structure", label: t("properties.chips.structure", { value: labels[fStructure] }), clear: () => setFStructure("all") });
        }
        if (archivedFilter !== "active") {
          activeChips.push({ key: "arch", label: archivedFilter === "archived" ? t("properties.chips.onlyArchived") : t("properties.chips.activeAndArchived"), clear: () => setArchivedFilter("active") });
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
                <Input className="pl-9" placeholder={t("properties.search")} value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
              <Select value={fStatus} onValueChange={setFStatus}>
                <SelectTrigger className="h-9 w-[150px]"><SelectValue placeholder={t("properties.filters.status")} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("properties.filters.allStatuses")}</SelectItem>
                  {STATUSES.map(s => (
                    <SelectItem key={s} value={s}>
                      <span className="flex items-center gap-2">
                        <span className={`inline-block h-2.5 w-2.5 rounded-full ${getPropertyStatusDotClass(s)}`} />
                        {statusLabel(s)}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={fListing} onValueChange={setFListing}>
                <SelectTrigger className="h-9 w-[140px]"><SelectValue placeholder={t("properties.filters.listing")} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("properties.filters.saleAndRent")}</SelectItem>
                  <SelectItem value="sale">{t("properties.listing.sale")}</SelectItem>
                  <SelectItem value="rent">{t("properties.listing.rent")}</SelectItem>
                </SelectContent>
              </Select>
              <Select value={archivedFilter} onValueChange={(v) => setArchivedFilter(v as typeof archivedFilter)}>
                <SelectTrigger className="h-9 w-[130px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">{t("properties.filters.active")}</SelectItem>
                  <SelectItem value="archived">{t("properties.filters.archived")}</SelectItem>
                  <SelectItem value="all">{t("properties.filters.all")}</SelectItem>
                </SelectContent>
              </Select>
              {view === "list" && fStructure !== "units" && (
                <Button
                  size="sm"
                  variant={groupUnits ? "default" : "outline"}
                  onClick={() => setGroupUnits(g => !g)}
                  title={groupUnits ? t("properties.filters.groupedTitle") : t("properties.filters.flatTitle")}
                >
                  <Layers3 className="mr-1 h-4 w-4" />
                  {groupUnits ? t("properties.filters.grouped") : t("properties.filters.flat")}
                </Button>
              )}
              <Button
                size="sm"
                variant={moreOpen ? "default" : "outline"}
                onClick={() => setMoreOpen(o => !o)}
              >
                <SlidersHorizontal className="mr-1 h-4 w-4" />
                {t("properties.filters.more")}
                {activeChips.filter(c => ["type","city","assigned","structure"].includes(c.key)).length > 0 && (
                  <Badge variant="secondary" className="ml-2 h-5 px-1.5 text-[10px]">
                    {activeChips.filter(c => ["type","city","assigned","structure"].includes(c.key)).length}
                  </Badge>
                )}
              </Button>
              {hasActive && (
                <Button size="sm" variant="ghost" onClick={resetAll}>
                  <RotateCcw className="mr-1 h-4 w-4" />{t("properties.filters.reset")}
                </Button>
              )}
            </div>

            {/* Expandable advanced filters */}
            {moreOpen && (
              <div className="grid gap-2 rounded-xl border bg-muted/20 p-3 sm:grid-cols-2 lg:grid-cols-4">
                <Select value={fType} onValueChange={setFType}>
                  <SelectTrigger className="h-9"><SelectValue placeholder={t("properties.filters.type")} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t("properties.filters.allTypes")}</SelectItem>
                    {PROP_TYPES.map(tp => <SelectItem key={tp} value={tp}>{typeLabel(tp)}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={fStructure} onValueChange={(v) => setFStructure(v as typeof fStructure)}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t("properties.filters.allStructures")}</SelectItem>
                    <SelectItem value="buildings">{t("properties.filters.buildingsOnly")}</SelectItem>
                    <SelectItem value="units">{t("properties.filters.unitsOnly")}</SelectItem>
                    <SelectItem value="standalone">{t("properties.filters.standaloneOnly")}</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={fAssigned} onValueChange={setFAssigned}>
                  <SelectTrigger className="h-9"><SelectValue placeholder={t("properties.filters.assigned")} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t("properties.filters.allEmployees")}</SelectItem>
                    {employees.map((e: any) => <SelectItem key={e.id} value={e.id}>{e.full_name || e.email}</SelectItem>)}
                  </SelectContent>
                </Select>
                {cities.length > 1 && (
                  <Select value={fCity} onValueChange={setFCity}>
                    <SelectTrigger className="h-9"><SelectValue placeholder={t("properties.filters.city")} /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t("properties.filters.allCities")}</SelectItem>
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
                      aria-label={t("properties.chips.remove", { label: chip.label })}
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
          <span className="text-sm font-medium">{t("properties.bulk.selected", { count: selectionCount })}</span>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline"><UserCog className="mr-1 h-4 w-4" />{t("properties.bulk.assign")}</Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="max-h-72 overflow-y-auto">
                <DropdownMenuLabel>{t("properties.bulk.employees")}</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => assign.mutate(null)}>
                  <X className="mr-2 h-4 w-4" />{t("properties.bulk.removeAssignment")}
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
                <ArchiveRestore className="mr-1 h-4 w-4" />{t("properties.bulk.restore")}
              </Button>
            ) : (
              <Button size="sm" variant="outline" onClick={() => archive.mutate(true)}>
                <Archive className="mr-1 h-4 w-4" />{t("properties.bulk.archive")}
              </Button>
            )}
            <Button size="sm" variant="destructive" onClick={() => setConfirmDelete(true)}>
              <Trash2 className="mr-1 h-4 w-4" />{t("properties.bulk.delete")}
            </Button>
            <Button size="sm" variant="ghost" onClick={clearSelection}>
              <X className="mr-1 h-4 w-4" />{t("properties.bulk.clear")}
            </Button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="text-sm text-muted-foreground">{t("properties.loading")}</div>
      ) : displayed.length === 0 ? (
        <EmptyState
          title={properties.length === 0 ? t("properties.empty.noneTitle") : t("properties.empty.noMatchTitle")}
          description={properties.length === 0
            ? t("properties.empty.noneDescription")
            : t("properties.empty.noMatchDescription")}
          action={properties.length === 0 ? (
            <Button onClick={() => setOpen(true)}><Plus className="mr-1 h-4 w-4" />{t("properties.new")}</Button>
          ) : undefined}
        />
      ) : view === "map" ? (
        <PropertiesMap properties={displayed} />
      ) : view === "grid" ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {paginated.map((p: any) => {
            const isSel = selected.has(p.id);
            const childUnits = unitsByParent.get(p.id) ?? [];
            const parentProp = p.parent_property_id ? propertyById.get(p.parent_property_id) : null;
            return (
              <div key={p.id} className={`group relative overflow-hidden rounded-2xl border bg-card shadow-soft transition hover:shadow-glow ${isSel ? "ring-2 ring-primary" : ""}`}>
                <div className="absolute left-3 top-3 z-10 rounded-md bg-background/90 p-1 backdrop-blur">
                  <Checkbox checked={isSel} onCheckedChange={() => toggleOne(p.id)} aria-label={t("properties.card.select")} />
                </div>
                <Link to="/properties/$id" params={{ id: p.id }} className="block">
                  <div className="aspect-[4/3] overflow-hidden bg-muted">
                    {p.images?.[0] ? (
                      <img src={getMediaPublicUrl(p.images[0])} alt={p.title} className="h-full w-full object-cover transition group-hover:scale-105" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-gradient-soft text-muted-foreground">{t("properties.noImage")}</div>
                    )}
                  </div>
                  <div className="p-4">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Badge variant="outline" className={`text-xs ${getPropertyStatusBadgeClass(p.status)}`}>{statusLabel(p.status)}</Badge>
                      {childUnits.length > 0 && (
                        <Badge className="bg-primary/10 text-primary hover:bg-primary/15 text-xs">
                          <Building2 className="mr-1 h-3 w-3" />{t("properties.card.buildingUnits", { count: childUnits.length })}
                        </Badge>
                      )}
                      {p.is_unit && (
                        <Badge variant="outline" className="text-xs">
                          <Layers3 className="mr-1 h-3 w-3" />{t("properties.card.unit")}{p.unit_number ? ` ${p.unit_number}` : ""}
                        </Badge>
                      )}
                      <span className="ml-auto text-xs text-muted-foreground">{listingLabel(p.listing_type)}</span>
                    </div>
                    <h3 className="mt-2 line-clamp-1 font-semibold">{p.title}</h3>
                    {parentProp && (
                      <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{t("properties.card.inParent", { title: parentProp.title })}</p>
                    )}
                    <p className="mt-1 line-clamp-1 flex items-center gap-1 text-xs text-muted-foreground">
                      <MapPin className="h-3 w-3" />{[p.address, p.city].filter(Boolean).join(", ") || "—"}
                    </p>
                    <div className="mt-3 flex items-center justify-between">
                      <span className="font-display text-lg font-bold">
                        {formatCurrency(p.listing_type === "rent" ? (p.rent ? Number(p.rent) : null) : (p.price ? Number(p.price) : null))}
                        {p.listing_type === "rent" && p.rent ? <span className="text-xs font-normal text-muted-foreground"> {t("properties.perMonth")}</span> : null}
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
                  <Checkbox checked={allFilteredSelected} onCheckedChange={toggleAll} aria-label={t("properties.table.selectAll")} />
                </TableHead>
                <TableHead>{t("properties.columns.title")}</TableHead>
                <TableHead>{t("properties.columns.type")}</TableHead>
                <TableHead>{t("properties.columns.status")}</TableHead>
                <TableHead>{t("properties.columns.city")}</TableHead>
                <TableHead className="text-right">{t("properties.columns.price")}</TableHead>
                <TableHead>{t("properties.columns.assignedTo")}</TableHead>
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
                        <Checkbox checked={selected.has(row.id)} onCheckedChange={() => toggleOne(row.id)} aria-label={t("properties.card.select")} />
                      </TableCell>
                      <TableCell>
                        <div className={`flex items-center gap-2 ${opts.indent ? "pl-6" : ""}`}>
                          {showExpander ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 w-6 p-0 -ml-1"
                              onClick={(e) => { e.preventDefault(); toggleExpanded(row.id); }}
                              aria-label={isExpanded ? t("properties.table.collapse") : t("properties.table.expand")}
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
                                  <Building2 className="mr-1 h-3 w-3" />{t("properties.table.buildingShort", { count: childUnits.length })}
                                </Badge>
                              )}
                              {row.is_unit && (
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                                  <Layers3 className="mr-1 h-3 w-3" />{t("properties.card.unit")}{row.unit_number ? ` ${row.unit_number}` : ""}
                                </Badge>
                              )}
                              {row.is_unit && parentProp && !opts.indent && (
                                <span className="text-[11px] text-muted-foreground">{t("properties.table.inParent", { title: parentProp.title })}</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{typeLabel(row.property_type)}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-xs ${getPropertyStatusBadgeClass(row.status)}`}>{statusLabel(row.status)}</Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{[row.address, row.city].filter(Boolean).join(", ") || "—"}</TableCell>
                      <TableCell className="text-right text-sm">
                        {formatCurrency(row.listing_type === "rent" ? (row.rent ? Number(row.rent) : null) : (row.price ? Number(row.price) : null))}
                        {row.listing_type === "rent" && row.rent ? <span className="text-xs text-muted-foreground"> {t("properties.perMonth")}</span> : null}
                      </TableCell>
                      <TableCell className="text-sm">{emp ? (emp.full_name ?? emp.email) : <span className="text-muted-foreground">—</span>}</TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0"><MoreHorizontal className="h-4 w-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem asChild>
                              <Link to="/properties/$id" params={{ id: row.id }}>{t("properties.table.open")}</Link>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {isArchived ? (
                              <DropdownMenuItem onClick={() => { setSelected(new Set([row.id])); archive.mutate(false); }}>
                                <ArchiveRestore className="mr-2 h-4 w-4" />{t("properties.bulk.restore")}
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem onClick={() => { setSelected(new Set([row.id])); archive.mutate(true); }}>
                                <Archive className="mr-2 h-4 w-4" />{t("properties.bulk.archive")}
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => { setSelected(new Set([row.id])); setConfirmDelete(true); }}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />{t("properties.bulk.delete")}
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

      {displayed.length > 0 && view !== "map" && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <span>
              {t("properties.pagination.showing", {
                from: (currentPage - 1) * pageSize + 1,
                to: Math.min(currentPage * pageSize, displayed.length),
                total: displayed.length,
              })}
            </span>
            <Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v))}>
              <SelectTrigger className="h-8 w-[110px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="20">{t("properties.pagination.perPage", { count: 20 })}</SelectItem>
                <SelectItem value="50">{t("properties.pagination.perPage", { count: 50 })}</SelectItem>
                <SelectItem value="100">{t("properties.pagination.perPage", { count: 100 })}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}>{t("properties.pagination.prev")}</Button>
            <span>{t("properties.pagination.page", { current: currentPage, total: totalPages })}</span>
            <Button size="sm" variant="outline" disabled={currentPage >= totalPages} onClick={() => setPage(currentPage + 1)}>{t("properties.pagination.next")}</Button>
          </div>
        </div>
      )}

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("properties.deleteDialog.title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("properties.deleteDialog.description", { count: selectionCount })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("properties.deleteDialog.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={() => remove.mutate()} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {t("properties.deleteDialog.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
