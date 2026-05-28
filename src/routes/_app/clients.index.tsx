import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Plus, Search, Mail, Phone, Target, LayoutGrid, List as ListIcon, Archive, ArchiveRestore, Trash2, UserCog, MoreHorizontal, X, Link2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { getBackendErrorMessage, isBackendUnavailableError, unwrapServerResult } from "@/lib/backend-errors";
import { toast } from "sonner";
import { clientTypeLabels, formatCurrency } from "@/lib/format";
import { EmptyState } from "@/components/EmptyState";
import { getClients } from "@/server/crm.functions";
import { ClientWizard } from "@/components/clients/ClientWizard";

import { ClientDetailDialog } from "@/components/clients/ClientDetailDialog";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";

export const Route = createFileRoute("/_app/clients/")({ component: ClientsPage });

const TYPES = ["buyer","seller","owner","tenant","landlord","investor","other"] as const;

const clientTypeBadgeClass: Record<string, string> = {
  buyer:     "bg-cyan-500/15 text-cyan-700 border-cyan-500/30 dark:text-cyan-300",
  seller:    "bg-teal-500/15 text-teal-700 border-teal-500/30 dark:text-teal-300",
  owner:     "bg-indigo-500/15 text-indigo-700 border-indigo-500/30 dark:text-indigo-300",
  tenant:    "bg-orange-500/15 text-orange-700 border-orange-500/30 dark:text-orange-300",
  landlord:  "bg-pink-500/15 text-pink-700 border-pink-500/30 dark:text-pink-300",
  investor:  "bg-rose-500/15 text-rose-700 border-rose-500/30 dark:text-rose-300",
  other:     "bg-stone-500/15 text-stone-700 border-stone-500/30 dark:text-stone-300",
};
function typeBadge(t: string) {
  return clientTypeBadgeClass[t] ?? clientTypeBadgeClass.other;
}
const PROP_TYPES = ["apartment","house","commercial","land","other"] as const;
const FINANCING_OPTIONS = ["unklar", "in Prüfung", "Vorabbestätigung", "bestätigt", "abgelehnt"];

const CLIENT_STATUSES = [
  { value: "entwurf",       label: "Entwurf",       dot: "bg-slate-400",   badge: "bg-slate-500/15 text-slate-700 border-slate-500/30 dark:text-slate-300" },
  { value: "pendent",       label: "Pendent",       dot: "bg-amber-500",   badge: "bg-amber-500/15 text-amber-700 border-amber-500/30 dark:text-amber-300" },
  { value: "vollstaendig",  label: "Vollständig",   dot: "bg-blue-500",    badge: "bg-blue-500/15 text-blue-700 border-blue-500/30 dark:text-blue-300" },
  { value: "finanzierung",  label: "Finanzierung",  dot: "bg-violet-500",  badge: "bg-violet-500/15 text-violet-700 border-violet-500/30 dark:text-violet-300" },
  { value: "abgeschlossen", label: "Abgeschlossen", dot: "bg-emerald-500", badge: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30 dark:text-emerald-300" },
  { value: "abgelehnt",     label: "Abgelehnt",     dot: "bg-red-500",     badge: "bg-red-500/15 text-red-700 border-red-500/30 dark:text-red-300" },
  { value: "storniert",     label: "Storniert",     dot: "bg-zinc-500",    badge: "bg-zinc-500/15 text-zinc-700 border-zinc-500/30 dark:text-zinc-300" },
] as const;
const statusMap = new Map<string, (typeof CLIENT_STATUSES)[number]>(CLIENT_STATUSES.map((s) => [s.value, s]));

const ALL = "__all__";
const UNASSIGNED = "__unassigned__";
const NO_FIN = "__none__";


type ViewMode = "grid" | "list";

function ClientsPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>(ALL);
  const [assignedFilter, setAssignedFilter] = useState<string>(ALL);
  const [financingFilter, setFinancingFilter] = useState<string>(ALL);
  const [statusFilter, setStatusFilter] = useState<string>(ALL);
  const [archivedFilter, setArchivedFilter] = useState<"active" | "archived" | "all">("active");

  const [view, setView] = useState<ViewMode>("list");
  const [open, setOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmDelete, setConfirmDelete] = useState(false);

  const clientsQuery = useQuery({
    queryKey: ["clients"],
    queryFn: async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) throw new Error("Nicht angemeldet");
      const result = await getClients({ headers: { authorization: `Bearer ${accessToken}` } });
      return unwrapServerResult(result);
    },
  });

  const employeesQuery = useQuery({
    queryKey: ["employees"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id, full_name, email").eq("is_active", true).order("full_name");
      return data ?? [];
    },
  });

  const clients = clientsQuery.data ?? [];
  const employees = employeesQuery.data ?? [];
  const employeeMap = useMemo(() => new Map(employees.map((e: any) => [e.id, e])), [employees]);

  const disclosuresQuery = useQuery({
    queryKey: ["clients_disclosures_contact"],
    queryFn: async () => {
      const { data } = await supabase
        .from("client_self_disclosures")
        .select("client_id,email,phone,mobile,street,street_number,postal_code,city");
      return data ?? [];
    },
  });
  const disclosureMap = useMemo(() => {
    const m = new Map<string, any>();
    (disclosuresQuery.data ?? []).forEach((d: any) => { m.set(d.client_id, d); });
    return m;
  }, [disclosuresQuery.data]);

  const relationshipsQuery = useQuery({
    queryKey: ["clients_relationships_all"],
    queryFn: async () => {
      const { data } = await supabase
        .from("client_relationships")
        .select("client_id, related_client_id, relationship_type");
      return data ?? [];
    },
  });
  const relationshipLabels: Record<string, string> = {
    spouse: "Ehepartner",
    co_applicant: "Antragsteller",
    co_investor: "Co-Investor",
    other: "Weitere",
  };
  const relationshipsByClient = useMemo(() => {
    const m = new Map<string, Array<{ id: string; type: string }>>();
    const push = (key: string, val: { id: string; type: string }) => {
      if (!m.has(key)) m.set(key, []);
      const arr = m.get(key)!;
      if (!arr.some((x) => x.id === val.id)) arr.push(val);
    };
    (relationshipsQuery.data ?? []).forEach((r: any) => {
      push(r.client_id, { id: r.related_client_id, type: r.relationship_type });
      push(r.related_client_id, { id: r.client_id, type: r.relationship_type });
    });
    return m;
  }, [relationshipsQuery.data]);
  const clientNameMap = useMemo(() => {
    const m = new Map<string, string>();
    clients.forEach((c: any) => m.set(c.id, c.full_name));
    return m;
  }, [clients]);
  const clientInfoMap = useMemo(() => {
    const m = new Map<string, any>();
    clients.forEach((c: any) => m.set(c.id, c));
    return m;
  }, [clients]);

  const showError = clientsQuery.error && !isBackendUnavailableError(clientsQuery.error);
  const queryErrorMessage = showError ? getBackendErrorMessage(clientsQuery.error) : null;

  // Union-Find: group linked partners so they appear together in the list
  const groupInfo = useMemo(() => {
    const parent = new Map<string, string>();
    const find = (x: string): string => {
      const p = parent.get(x) ?? x;
      if (p === x) return x;
      const r = find(p);
      parent.set(x, r);
      return r;
    };
    const union = (a: string, b: string) => {
      const ra = find(a), rb = find(b);
      if (ra !== rb) parent.set(ra, rb);
    };
    clients.forEach((c: any) => { if (!parent.has(c.id)) parent.set(c.id, c.id); });
    (relationshipsQuery.data ?? []).forEach((r: any) => {
      if (parent.has(r.client_id) && parent.has(r.related_client_id)) union(r.client_id, r.related_client_id);
    });
    const groupSize = new Map<string, number>();
    const groupSortName = new Map<string, string>();
    clients.forEach((c: any) => {
      const root = find(c.id);
      groupSize.set(root, (groupSize.get(root) ?? 0) + 1);
      const cur = groupSortName.get(root);
      const name = (c.full_name ?? "").toLowerCase();
      if (cur === undefined || name < cur) groupSortName.set(root, name);
    });
    return { find, groupSize, groupSortName };
  }, [clients, relationshipsQuery.data]);

  const filtered = useMemo(() => {
    const list = clients.filter((c: any) => {
      if (archivedFilter === "active" && c.is_archived) return false;
      if (archivedFilter === "archived" && !c.is_archived) return false;
      if (typeFilter !== ALL && c.client_type !== typeFilter) return false;
      if (assignedFilter !== ALL) {
        const eff = c.assigned_to ?? c.owner_id;
        if (assignedFilter === UNASSIGNED && eff) return false;
        if (assignedFilter !== UNASSIGNED && eff !== assignedFilter) return false;
      }
      if (financingFilter !== ALL) {
        if (financingFilter === NO_FIN && c.financing_status) return false;
        if (financingFilter !== NO_FIN && c.financing_status !== financingFilter) return false;
      }
      if (statusFilter !== ALL && c.status !== statusFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!c.full_name?.toLowerCase().includes(q) && !c.email?.toLowerCase().includes(q)) return false;
      }
      return true;
    });
    // Sort: keep linked partners adjacent by sharing a group key (lead partner's name)
    return list.sort((a: any, b: any) => {
      const ra = groupInfo.find(a.id);
      const rb = groupInfo.find(b.id);
      const ga = groupInfo.groupSortName.get(ra) ?? (a.full_name ?? "").toLowerCase();
      const gb = groupInfo.groupSortName.get(rb) ?? (b.full_name ?? "").toLowerCase();
      if (ga !== gb) return ga.localeCompare(gb);
      if (ra !== rb) return ra.localeCompare(rb);
      return (a.full_name ?? "").localeCompare(b.full_name ?? "");
    });
  }, [clients, archivedFilter, typeFilter, assignedFilter, financingFilter, statusFilter, search, groupInfo]);

  // Pagination
  const [pageSize, setPageSize] = useState<number>(20);
  const [page, setPage] = useState(1);
  useEffect(() => { setPage(1); }, [search, typeFilter, assignedFilter, financingFilter, statusFilter, archivedFilter, pageSize, view]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paginated = useMemo(
    () => filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    [filtered, currentPage, pageSize],
  );

  const toggleOne = (id: string) => setSelected((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const allFilteredSelected = filtered.length > 0 && filtered.every((c: any) => selected.has(c.id));
  const toggleAll = () => setSelected((prev) => {
    if (allFilteredSelected) {
      const next = new Set(prev);
      filtered.forEach((c: any) => next.delete(c.id));
      return next;
    }
    const next = new Set(prev);
    filtered.forEach((c: any) => next.add(c.id));
    return next;
  });
  const clearSelection = () => setSelected(new Set());

  const assign = useMutation({
    mutationFn: async (assignedTo: string | null) => {
      const ids = Array.from(selected);
      if (!ids.length) return;
      const { error } = await supabase.from("clients").update({ assigned_to: assignedTo }).in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Zuweisung aktualisiert");
      qc.invalidateQueries({ queryKey: ["clients"] });
      clearSelection();
    },
    onError: (e: unknown) => toast.error(getBackendErrorMessage(e)),
  });

  const archive = useMutation({
    mutationFn: async (archive: boolean) => {
      const ids = Array.from(selected);
      if (!ids.length) return;
      const { error } = await supabase.from("clients").update({
        is_archived: archive,
        archived_at: archive ? new Date().toISOString() : null,
      }).in("id", ids);
      if (error) throw error;
    },
    onSuccess: (_, archived) => {
      toast.success(archived ? "Kunden archiviert" : "Kunden wiederhergestellt");
      qc.invalidateQueries({ queryKey: ["clients"] });
      clearSelection();
    },
    onError: (e: unknown) => toast.error(getBackendErrorMessage(e)),
  });

  const remove = useMutation({
    mutationFn: async () => {
      const ids = Array.from(selected);
      if (!ids.length) return;
      const { error } = await supabase.from("clients").delete().in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Kunden gelöscht");
      qc.invalidateQueries({ queryKey: ["clients"] });
      clearSelection();
      setConfirmDelete(false);
    },
    onError: (e: unknown) => toast.error(getBackendErrorMessage(e)),
  });

  const selectionCount = selected.size;

  return (
    <>
      <PageHeader
        title="Kunden"
        description="Alle Käufer, Verkäufer, Mieter und Vermieter"
        action={
          <div className="flex items-center gap-2">
            <Tabs value={view} onValueChange={(v) => setView(v as ViewMode)}>
              <TabsList>
                <TabsTrigger value="grid"><LayoutGrid className="mr-1 h-4 w-4" />Kacheln</TabsTrigger>
                <TabsTrigger value="list"><ListIcon className="mr-1 h-4 w-4" />Liste</TabsTrigger>
              </TabsList>
            </Tabs>
            
            <Button onClick={() => setOpen(true)}>
              <Plus className="mr-1 h-4 w-4" />Neuer Kunde
            </Button>
          </div>
        }
      />

      <ClientWizard open={open} onOpenChange={setOpen} />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] max-w-xs flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Kunden suchen…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[150px]"><SelectValue placeholder="Typ" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Alle Typen</SelectItem>
            {TYPES.map((t) => <SelectItem key={t} value={t}>{clientTypeLabels[t]}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={assignedFilter} onValueChange={setAssignedFilter}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Zugewiesen" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Alle Mitarbeitenden</SelectItem>
            <SelectItem value={UNASSIGNED}>Nicht zugewiesen</SelectItem>
            {employees.map((e: any) => <SelectItem key={e.id} value={e.id}>{e.full_name ?? e.email}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[170px]">
            <SelectValue placeholder="Status">
              {statusFilter !== ALL && statusMap.get(statusFilter) ? (
                <span className="flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${statusMap.get(statusFilter)!.dot}`} />
                  {statusMap.get(statusFilter)!.label}
                </span>
              ) : "Alle Status"}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Alle Status</SelectItem>
            {CLIENT_STATUSES.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                <span className="flex items-center gap-2">
                  <span className={`h-2.5 w-2.5 rounded-full ${s.dot}`} />
                  {s.label}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={archivedFilter} onValueChange={(v) => setArchivedFilter(v as typeof archivedFilter)}>
          <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Aktiv</SelectItem>
            <SelectItem value="archived">Archiviert</SelectItem>
            <SelectItem value="all">Alle</SelectItem>
          </SelectContent>
        </Select>
        {(typeFilter !== ALL || assignedFilter !== ALL || financingFilter !== ALL || statusFilter !== ALL || search) && (
          <Button variant="ghost" size="sm" onClick={() => { setSearch(""); setTypeFilter(ALL); setAssignedFilter(ALL); setFinancingFilter(ALL); setStatusFilter(ALL); }}>
            Zurücksetzen
          </Button>
        )}

        <span className="ml-auto text-sm text-muted-foreground">{filtered.length} von {clients.length}</span>
      </div>

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

      {showError ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {queryErrorMessage}
        </div>
      ) : null}

      {!clientsQuery.error && clientsQuery.isLoading ? (
        <div className="rounded-xl border bg-muted/20 p-4 text-sm text-muted-foreground">Kunden werden geladen…</div>
      ) : null}

      {filtered.length === 0 && !clientsQuery.error && !clientsQuery.isLoading ? (
        <EmptyState title="Keine Kunden" description="Lege deinen ersten Kunden an oder ändere die Filter." />
      ) : view === "grid" ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {paginated.map((c: any) => {
            const isSel = selected.has(c.id);
            return (
              <Card key={c.id} className={`transition hover:shadow-glow ${isSel ? "ring-2 ring-primary" : ""}`}>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2 flex-1 min-w-0">
                      <Checkbox
                        checked={isSel}
                        onCheckedChange={() => toggleOne(c.id)}
                        aria-label="Auswählen"
                        className="mt-1"
                      />
                      <button type="button" onClick={() => setDetailId(c.id)} className="flex-1 min-w-0 text-left">
                        <p className="font-semibold hover:text-primary truncate">{c.full_name}</p>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {(() => {
                            const s = statusMap.get(c.status ?? "entwurf") ?? statusMap.get("entwurf")!;
                            return (
                              <Badge variant="outline" className={s.badge}>
                                <span className={`mr-1.5 h-2 w-2 rounded-full ${s.dot}`} />
                                {s.label}
                              </Badge>
                            );
                          })()}
                          <Badge variant="outline" className={typeBadge(c.client_type)}>{clientTypeLabels[c.client_type as keyof typeof clientTypeLabels]}</Badge>
                          {c.is_archived && <Badge variant="outline">Archiviert</Badge>}

                          {(c.assigned_to ?? c.owner_id) && employeeMap.get(c.assigned_to ?? c.owner_id) && (
                            <Badge variant="outline" className="text-xs">
                              {(employeeMap.get(c.assigned_to ?? c.owner_id) as any).full_name ?? (employeeMap.get(c.assigned_to ?? c.owner_id) as any).email}
                            </Badge>
                          )}
                        </div>
                      </button>
                    </div>
                    <Link to="/matching" search={{ clientId: c.id }} className="rounded-lg border p-2 text-primary transition hover:bg-accent" title="Matching">
                      <Target className="h-4 w-4" />
                    </Link>
                  </div>
                  <button type="button" onClick={() => setDetailId(c.id)} className="block w-full text-left">
                    <div className="mt-3 space-y-1 text-sm text-muted-foreground">
                      {c.email && <p className="flex items-center gap-2"><Mail className="h-3.5 w-3.5" />{c.email}</p>}
                      {c.phone && <p className="flex items-center gap-2"><Phone className="h-3.5 w-3.5" />{c.phone}</p>}
                    </div>
                    {(relationshipsByClient.get(c.id)?.length ?? 0) > 0 && (
                    <div className="mt-3 flex flex-wrap items-center gap-1">
                        <Link2 className="h-3 w-3 text-muted-foreground" />
                        {relationshipsByClient.get(c.id)!.map((rel) => {
                          const partner = clientInfoMap.get(rel.id);
                          return (
                            <HoverCard key={rel.id + rel.type} openDelay={120} closeDelay={80}>
                              <HoverCardTrigger asChild>
                                <Badge variant="secondary" className="text-[10px] py-0 px-1.5 h-5 cursor-pointer" onClick={(e) => { e.stopPropagation(); setDetailId(rel.id); }}>
                                  {relationshipLabels[rel.type] ?? rel.type}
                                </Badge>
                              </HoverCardTrigger>
                              <HoverCardContent className="w-64 text-sm" onClick={(e) => e.stopPropagation()}>
                                <p className="font-medium">{partner?.full_name ?? "Unbekannt"}</p>
                                <p className="text-xs text-muted-foreground mb-2">{relationshipLabels[rel.type] ?? rel.type}</p>
                                {partner?.email && <p className="flex items-center gap-2 text-xs"><Mail className="h-3 w-3" />{partner.email}</p>}
                                {partner?.phone && <p className="flex items-center gap-2 text-xs"><Phone className="h-3 w-3" />{partner.phone}</p>}
                              </HoverCardContent>
                            </HoverCard>
                          );
                        })}
                      </div>
                    )}
                    {(c.budget_max || c.preferred_cities?.length) && (
                      <div className="mt-3 rounded-lg bg-muted/40 p-3 text-xs">
                        {c.budget_max && <p>Budget: bis {formatCurrency(Number(c.budget_max))}</p>}
                        {c.preferred_cities?.length ? <p>Städte: {c.preferred_cities.join(", ")}</p> : null}
                        {c.rooms_min ? <p>Zimmer ab: {c.rooms_min}</p> : null}
                      </div>
                    )}
                  </button>

                </CardContent>
              </Card>
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
                <TableHead>Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Typ</TableHead>

                <TableHead>Telefon</TableHead>
                <TableHead>E-Mail</TableHead>
                <TableHead>PLZ / Ort</TableHead>
                <TableHead>Zugewiesen</TableHead>
                <TableHead>Verknüpfungen</TableHead>
                
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginated.map((c: any) => {
                const assignedId = c.assigned_to ?? c.owner_id;
                const emp = assignedId ? (employeeMap.get(assignedId) as any) : null;
                const disc = disclosureMap.get(c.id);
                const email = c.email || disc?.email;
                const phone = c.phone || disc?.mobile || disc?.phone;
                const addr = [
                  [disc?.street, disc?.street_number].filter(Boolean).join(" "),
                  [disc?.postal_code, disc?.city].filter(Boolean).join(" "),
                ].filter(Boolean).join(", ") || [c.address, [c.postal_code, c.city].filter(Boolean).join(" ")].filter(Boolean).join(", ");
                const plzOrt = [disc?.postal_code ?? c.postal_code, disc?.city ?? c.city].filter(Boolean).join(" ");
                const groupRoot = groupInfo.find(c.id);
                const isLinked = (groupInfo.groupSize.get(groupRoot) ?? 1) > 1;
                return (
                  <TableRow
                    key={c.id}
                    data-state={selected.has(c.id) ? "selected" : undefined}
                    className={isLinked ? "border-l-2 border-l-primary/60" : undefined}
                  >
                  
                    <TableCell>
                      <Checkbox checked={selected.has(c.id)} onCheckedChange={() => toggleOne(c.id)} aria-label="Auswählen" />
                    </TableCell>
                    <TableCell>
                      <button type="button" onClick={() => setDetailId(c.id)} className="font-medium hover:text-primary">
                        {c.full_name}
                      </button>
                      {c.is_archived && <Badge variant="outline" className="ml-2">Archiviert</Badge>}
                    </TableCell>
                    <TableCell>
                      {(() => {
                        const s = statusMap.get(c.status ?? "entwurf") ?? statusMap.get("entwurf")!;
                        return (
                          <Badge variant="outline" className={s.badge}>
                            <span className={`mr-1.5 h-2 w-2 rounded-full ${s.dot}`} />
                            {s.label}
                          </Badge>
                        );
                      })()}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={typeBadge(c.client_type)}>{clientTypeLabels[c.client_type as keyof typeof clientTypeLabels]}</Badge>
                    </TableCell>

                    <TableCell className="text-sm">
                      {phone ? <a href={`tel:${phone}`} className="hover:text-primary">{phone}</a> : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="text-sm">
                      {email ? <a href={`mailto:${email}`} className="hover:text-primary">{email}</a> : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="text-sm">
                      {plzOrt || <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="text-sm">{emp ? (emp.full_name ?? emp.email) : <span className="text-muted-foreground">—</span>}</TableCell>
                    <TableCell className="text-sm">
                      {(relationshipsByClient.get(c.id)?.length ?? 0) > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {relationshipsByClient.get(c.id)!.map((rel) => {
                            const partner = clientInfoMap.get(rel.id);
                            return (
                              <HoverCard key={rel.id + rel.type} openDelay={120} closeDelay={80}>
                                <HoverCardTrigger asChild>
                                  <Badge
                                    variant="secondary"
                                    className="cursor-pointer text-[10px] py-0 px-1.5 h-5"
                                    onClick={(e) => { e.stopPropagation(); setDetailId(rel.id); }}
                                  >
                                    <Link2 className="mr-0.5 h-2.5 w-2.5" />
                                    {relationshipLabels[rel.type] ?? rel.type}
                                  </Badge>
                                </HoverCardTrigger>
                                <HoverCardContent className="w-64 text-sm" onClick={(e) => e.stopPropagation()}>
                                  <p className="font-medium">{partner?.full_name ?? "Unbekannt"}</p>
                                  <p className="text-xs text-muted-foreground mb-2">{relationshipLabels[rel.type] ?? rel.type}</p>
                                  {partner?.email && <p className="flex items-center gap-2 text-xs"><Mail className="h-3 w-3" />{partner.email}</p>}
                                  {partner?.phone && <p className="flex items-center gap-2 text-xs"><Phone className="h-3 w-3" />{partner.phone}</p>}
                                </HoverCardContent>
                              </HoverCard>
                            );
                          })}
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0"><MoreHorizontal className="h-4 w-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setDetailId(c.id)}>Öffnen</DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <Link to="/matching" search={{ clientId: c.id }}>Matching</Link>
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {c.is_archived ? (
                            <DropdownMenuItem onClick={() => { setSelected(new Set([c.id])); archive.mutate(false); }}>
                              <ArchiveRestore className="mr-2 h-4 w-4" />Wiederherstellen
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem onClick={() => { setSelected(new Set([c.id])); archive.mutate(true); }}>
                              <Archive className="mr-2 h-4 w-4" />Archivieren
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => { setSelected(new Set([c.id])); setConfirmDelete(true); }}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />Löschen
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {filtered.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <span>
              Zeige {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, filtered.length)} von {filtered.length}
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
            <AlertDialogTitle>Kunden löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              {selectionCount} Kunde{selectionCount === 1 ? "" : "n"} werden unwiderruflich gelöscht. Verknüpfte Daten können verloren gehen.
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

      <ClientDetailDialog
        clientId={detailId}
        open={!!detailId}
        onOpenChange={(o) => !o && setDetailId(null)}
        clientIds={filtered.map((c: any) => c.id)}
        onNavigate={(nextId) => setDetailId(nextId)}
      />
    </>
  );
}
