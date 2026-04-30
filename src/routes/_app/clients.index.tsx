import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Plus, Search, Mail, Phone, Target, LayoutGrid, List as ListIcon, Archive, ArchiveRestore, Trash2, UserCog, MoreHorizontal, X } from "lucide-react";
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

export const Route = createFileRoute("/_app/clients/")({ component: ClientsPage });

const TYPES = ["buyer","seller","tenant","landlord","investor","other"] as const;
const PROP_TYPES = ["apartment","house","commercial","land","other"] as const;
const FINANCING_OPTIONS = ["unklar", "in Prüfung", "Vorabbestätigung", "bestätigt", "abgelehnt"];
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
  const [archivedFilter, setArchivedFilter] = useState<"active" | "archived" | "all">("active");
  const [view, setView] = useState<ViewMode>("grid");
  const [open, setOpen] = useState(false);
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

  const showError = clientsQuery.error && !isBackendUnavailableError(clientsQuery.error);
  const queryErrorMessage = showError ? getBackendErrorMessage(clientsQuery.error) : null;

  const filtered = useMemo(() => clients.filter((c: any) => {
    if (archivedFilter === "active" && c.is_archived) return false;
    if (archivedFilter === "archived" && !c.is_archived) return false;
    if (typeFilter !== ALL && c.client_type !== typeFilter) return false;
    if (assignedFilter !== ALL) {
      if (assignedFilter === UNASSIGNED && c.assigned_to) return false;
      if (assignedFilter !== UNASSIGNED && c.assigned_to !== assignedFilter) return false;
    }
    if (financingFilter !== ALL) {
      if (financingFilter === NO_FIN && c.financing_status) return false;
      if (financingFilter !== NO_FIN && c.financing_status !== financingFilter) return false;
    }
    if (search) {
      const q = search.toLowerCase();
      if (!c.full_name?.toLowerCase().includes(q) && !c.email?.toLowerCase().includes(q)) return false;
    }
    return true;
  }), [clients, archivedFilter, typeFilter, assignedFilter, financingFilter, search]);

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
        <Select value={financingFilter} onValueChange={setFinancingFilter}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Finanzierung" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Alle Finanzierungen</SelectItem>
            <SelectItem value={NO_FIN}>Keine Angabe</SelectItem>
            {FINANCING_OPTIONS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
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
        {(typeFilter !== ALL || assignedFilter !== ALL || financingFilter !== ALL || search) && (
          <Button variant="ghost" size="sm" onClick={() => { setSearch(""); setTypeFilter(ALL); setAssignedFilter(ALL); setFinancingFilter(ALL); }}>
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
          {filtered.map((c: any) => {
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
                      <Link to="/clients/$id" params={{ id: c.id }} className="flex-1 min-w-0">
                        <p className="font-semibold hover:text-primary truncate">{c.full_name}</p>
                        <div className="mt-1 flex flex-wrap gap-1">
                          <Badge variant="secondary">{clientTypeLabels[c.client_type as keyof typeof clientTypeLabels]}</Badge>
                          {c.is_archived && <Badge variant="outline">Archiviert</Badge>}
                          {c.assigned_to && employeeMap.get(c.assigned_to) && (
                            <Badge variant="outline" className="text-xs">
                              {(employeeMap.get(c.assigned_to) as any).full_name ?? (employeeMap.get(c.assigned_to) as any).email}
                            </Badge>
                          )}
                        </div>
                      </Link>
                    </div>
                    <Link to="/matching" search={{ clientId: c.id }} className="rounded-lg border p-2 text-primary transition hover:bg-accent" title="Matching">
                      <Target className="h-4 w-4" />
                    </Link>
                  </div>
                  <Link to="/clients/$id" params={{ id: c.id }} className="block">
                    <div className="mt-3 space-y-1 text-sm text-muted-foreground">
                      {c.email && <p className="flex items-center gap-2"><Mail className="h-3.5 w-3.5" />{c.email}</p>}
                      {c.phone && <p className="flex items-center gap-2"><Phone className="h-3.5 w-3.5" />{c.phone}</p>}
                    </div>
                    {(c.budget_max || c.preferred_cities?.length) && (
                      <div className="mt-3 rounded-lg bg-muted/40 p-3 text-xs">
                        {c.budget_max && <p>Budget: bis {formatCurrency(Number(c.budget_max))}</p>}
                        {c.preferred_cities?.length ? <p>Städte: {c.preferred_cities.join(", ")}</p> : null}
                        {c.rooms_min ? <p>Zimmer ab: {c.rooms_min}</p> : null}
                      </div>
                    )}
                  </Link>
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
                <TableHead>Typ</TableHead>
                <TableHead>Kontakt</TableHead>
                <TableHead>Zugewiesen</TableHead>
                <TableHead>Finanzierung</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((c: any) => {
                const emp = c.assigned_to ? (employeeMap.get(c.assigned_to) as any) : null;
                return (
                  <TableRow key={c.id} data-state={selected.has(c.id) ? "selected" : undefined}>
                    <TableCell>
                      <Checkbox checked={selected.has(c.id)} onCheckedChange={() => toggleOne(c.id)} aria-label="Auswählen" />
                    </TableCell>
                    <TableCell>
                      <Link to="/clients/$id" params={{ id: c.id }} className="font-medium hover:text-primary">
                        {c.full_name}
                      </Link>
                      {c.is_archived && <Badge variant="outline" className="ml-2">Archiviert</Badge>}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{clientTypeLabels[c.client_type as keyof typeof clientTypeLabels]}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      <div className="space-y-0.5">
                        {c.email && <div>{c.email}</div>}
                        {c.phone && <div>{c.phone}</div>}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{emp ? (emp.full_name ?? emp.email) : <span className="text-muted-foreground">—</span>}</TableCell>
                    <TableCell className="text-sm">{c.financing_status ?? <span className="text-muted-foreground">—</span>}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0"><MoreHorizontal className="h-4 w-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link to="/clients/$id" params={{ id: c.id }}>Öffnen</Link>
                          </DropdownMenuItem>
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
    </>
  );
}
