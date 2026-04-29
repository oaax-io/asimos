import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Plus, Mail, Phone, ArrowRight, Search, Pencil, ExternalLink, LayoutGrid, List as ListIcon, Trash2, UserCog, MoreHorizontal, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { leadStatusLabels, leadStatuses, leadStatusColors, type LeadStatus } from "@/lib/format";
import { useAuth } from "@/lib/auth";
import { getBackendErrorMessage, isBackendUnavailableError, throwIfError, unwrapServerResult } from "@/lib/backend-errors";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { Tables } from "@/integrations/supabase/types";
import { addLead, getLeads } from "@/server/crm.functions";

export const Route = createFileRoute("/_app/leads/")({ component: LeadsPage });

type Lead = Tables<"leads">;
type Profile = { id: string; full_name: string | null; email: string | null };

const ALL = "__all__";
const UNASSIGNED = "__unassigned__";

function LeadsPage() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ full_name: "", email: "", phone: "", source: "", notes: "", assigned_to: "" });

  // Filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>(ALL);
  const [sourceFilter, setSourceFilter] = useState<string>(ALL);
  const [assignedFilter, setAssignedFilter] = useState<string>(ALL);

  // Bulk-Selection
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const toggleOne = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const clearSelection = () => setSelected(new Set());

  const leadsQuery = useQuery({
    queryKey: ["leads"],
    queryFn: async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) throw new Error("Nicht angemeldet");
      const result = await getLeads({ headers: { authorization: `Bearer ${accessToken}` } });
      // Wirft bei Backend-Unavailable -> globaler Retry mit Backoff greift.
      return unwrapServerResult(result);
    },
    refetchOnReconnect: true,
  });

  const employeesQuery = useQuery({
    queryKey: ["employees"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .eq("is_active", true)
        .order("full_name");
      throwIfError(error);
      return (data ?? []) as Profile[];
    },
  });

  const leads = leadsQuery.data ?? [];
  const employees = employeesQuery.data ?? [];
  const employeeMap = useMemo(() => new Map(employees.map((e) => [e.id, e])), [employees]);

  const sources = useMemo(() => {
    const set = new Set<string>();
    leads.forEach((l: Lead) => { if (l.source) set.add(l.source); });
    return Array.from(set).sort();
  }, [leads]);

  const filtered = useMemo(() => {
    return leads.filter((l: Lead) => {
      if (statusFilter !== ALL && l.status !== statusFilter) return false;
      if (sourceFilter !== ALL && l.source !== sourceFilter) return false;
      if (assignedFilter !== ALL) {
        if (assignedFilter === UNASSIGNED && l.assigned_to) return false;
        if (assignedFilter !== UNASSIGNED && l.assigned_to !== assignedFilter) return false;
      }
      if (search) {
        const q = search.toLowerCase();
        if (
          !l.full_name?.toLowerCase().includes(q) &&
          !l.email?.toLowerCase().includes(q) &&
          !l.phone?.toLowerCase().includes(q)
        ) return false;
      }
      return true;
    });
  }, [leads, statusFilter, sourceFilter, assignedFilter, search]);

  // Banner nur bei "echten" Fehlern – Backend-Unavailable wird automatisch retryed.
  const queryError = leadsQuery.error;
  const showError = queryError && !isBackendUnavailableError(queryError);
  const queryErrorMessage = showError ? getBackendErrorMessage(queryError) : null;

  const create = useMutation({
    mutationFn: async () => {
      if (!form.full_name.trim()) throw new Error("Name ist erforderlich");
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) throw new Error("Nicht angemeldet");
      const result = await addLead({
        headers: { authorization: `Bearer ${accessToken}` },
        data: {
          full_name: form.full_name.trim(),
          email: form.email.trim() || null,
          phone: form.phone.trim() || null,
          source: form.source.trim() || null,
          notes: form.notes.trim() || null,
        },
      });

      if (result.error || !result.data) {
        const mutationError = new Error(result.error ?? "Es ist ein unerwarteter Fehler aufgetreten.");
        if (result.unavailable) (mutationError as Error & { status?: number }).status = 503;
        throw mutationError;
      }

      // Set assigned_to after create if chosen (server fn doesn't expose it)
      if (form.assigned_to && result.data?.id) {
        await supabase.from("leads").update({ assigned_to: form.assigned_to }).eq("id", result.data.id);
      }
      return result.data;
    },
    onSuccess: () => {
      toast.success("Lead erstellt");
      qc.invalidateQueries({ queryKey: ["leads"] });
      setForm({ full_name: "", email: "", phone: "", source: "", notes: "", assigned_to: "" });
    },
    onError: (e: unknown) => toast.error(getBackendErrorMessage(e)),
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: LeadStatus }) => {
      const { error } = await supabase.from("leads").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["leads"] }),
  });

  const convert = useMutation({
    mutationFn: async (lead: Lead) => {
      const { data: created, error } = await supabase.from("clients").insert({
        owner_id: user!.id,
        assigned_to: lead.assigned_to,
        full_name: lead.full_name,
        email: lead.email,
        phone: lead.phone,
        notes: lead.notes,
        client_type: "buyer",
      }).select("id").single();
      if (error) throw error;
      await supabase.from("leads").update({ status: "converted", converted_client_id: created.id }).eq("id", lead.id);
      return created;
    },
    onSuccess: () => {
      toast.success("Zu Kunde konvertiert");
      qc.invalidateQueries({ queryKey: ["leads"] });
      qc.invalidateQueries({ queryKey: ["clients"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  // ----- Bulk-Aktionen -----
  const bulkAssign = useMutation({
    mutationFn: async ({ ids, assignedTo }: { ids: string[]; assignedTo: string | null }) => {
      const { error } = await supabase.from("leads").update({ assigned_to: assignedTo }).in("id", ids);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      toast.success(`${vars.ids.length} Lead(s) zugewiesen`);
      qc.invalidateQueries({ queryKey: ["leads"] });
      clearSelection();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const bulkStatus = useMutation({
    mutationFn: async ({ ids, status }: { ids: string[]; status: LeadStatus }) => {
      const { error } = await supabase.from("leads").update({ status }).in("id", ids);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      toast.success(`Status für ${vars.ids.length} Lead(s) geändert`);
      qc.invalidateQueries({ queryKey: ["leads"] });
      clearSelection();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const bulkDelete = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase.from("leads").delete().in("id", ids);
      if (error) throw error;
    },
    onSuccess: (_d, ids) => {
      toast.success(`${ids.length} Lead(s) gelöscht`);
      qc.invalidateQueries({ queryKey: ["leads"] });
      clearSelection();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const employeeName = (id: string | null) => {
    if (!id) return "—";
    const p = employeeMap.get(id);
    return p?.full_name ?? p?.email ?? "—";
  };

  // Auswahl auf gefilterte Leads beschränken
  const filteredIds = useMemo(() => filtered.map((l) => l.id), [filtered]);
  const selectedInView = filteredIds.filter((id) => selected.has(id));
  const allSelected = filteredIds.length > 0 && selectedInView.length === filteredIds.length;
  const someSelected = selectedInView.length > 0 && !allSelected;
  const toggleAll = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allSelected) filteredIds.forEach((id) => next.delete(id));
      else filteredIds.forEach((id) => next.add(id));
      return next;
    });
  };

  return (
    <div>
    <Tabs defaultValue="list" className="w-full">

      <PageHeader
        title="Leads"
        description="Pipeline deiner Interessenten"
        action={
          <>
            <TabsList>
              <TabsTrigger value="list"><ListIcon className="mr-1 h-4 w-4" />Liste</TabsTrigger>
              <TabsTrigger value="kanban"><LayoutGrid className="mr-1 h-4 w-4" />Kanban</TabsTrigger>
            </TabsList>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="mr-1 h-4 w-4" />Neuer Lead</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Neuer Lead</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Name</Label><Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>E-Mail</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
                  <div><Label>Telefon</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
                </div>
                <div><Label>Quelle</Label><Input placeholder="Website, Empfehlung…" value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} /></div>
                <div>
                  <Label>Zugewiesen an</Label>
                  <Select value={form.assigned_to || UNASSIGNED} onValueChange={(v) => setForm({ ...form, assigned_to: v === UNASSIGNED ? "" : v })}>
                    <SelectTrigger><SelectValue placeholder="Niemand" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={UNASSIGNED}>Niemand</SelectItem>
                      {employees.map((e) => <SelectItem key={e.id} value={e.id}>{e.full_name ?? e.email ?? e.id}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Notizen</Label><Textarea rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
              </div>
              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => setOpen(false)}>Abbrechen</Button>
                <Button onClick={() => create.mutate()} disabled={!form.full_name || create.isPending}>
                  {create.isPending ? "Speichern…" : "Speichern"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          </>
        }
      />

      {/* Filters – direkt über der Liste */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1 max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Suchen (Name, E-Mail, Telefon)…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[170px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Alle Status</SelectItem>
            {leadStatuses.map((s) => <SelectItem key={s} value={s}>{leadStatusLabels[s]}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={sourceFilter} onValueChange={setSourceFilter}>
          <SelectTrigger className="w-[170px]"><SelectValue placeholder="Quelle" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Alle Quellen</SelectItem>
            {sources.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={assignedFilter} onValueChange={setAssignedFilter}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Zugewiesen" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Alle Mitarbeitenden</SelectItem>
            <SelectItem value={UNASSIGNED}>Nicht zugewiesen</SelectItem>
            {employees.map((e) => <SelectItem key={e.id} value={e.id}>{e.full_name ?? e.email ?? e.id}</SelectItem>)}
          </SelectContent>
        </Select>
        {(statusFilter !== ALL || sourceFilter !== ALL || assignedFilter !== ALL || search) && (
          <Button variant="ghost" size="sm" onClick={() => { setSearch(""); setStatusFilter(ALL); setSourceFilter(ALL); setAssignedFilter(ALL); }}>
            Zurücksetzen
          </Button>
        )}
        <span className="ml-auto text-sm text-muted-foreground">{filtered.length} von {leads.length}</span>
      </div>

      {/* Bulk-Aktionen Toolbar */}
      {selected.size > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 p-3">
          <span className="text-sm font-medium">
            {selected.size} Lead{selected.size === 1 ? "" : "s"} ausgewählt
          </span>

          {/* Zuweisen */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline" className="ml-2">
                <UserCog className="mr-1 h-3.5 w-3.5" />
                Zuweisen
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              <DropdownMenuLabel>Mitarbeitenden wählen</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => bulkAssign.mutate({ ids: Array.from(selected), assignedTo: null })}>
                Niemand (zurücksetzen)
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {employees.map((e) => (
                <DropdownMenuItem
                  key={e.id}
                  onSelect={() => bulkAssign.mutate({ ids: Array.from(selected), assignedTo: e.id })}
                >
                  {e.full_name ?? e.email ?? e.id}
                </DropdownMenuItem>
              ))}
              {employees.length === 0 && (
                <DropdownMenuItem disabled>Keine Mitarbeitenden</DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Status setzen */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline">
                <MoreHorizontal className="mr-1 h-3.5 w-3.5" />
                Status setzen
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {leadStatuses.map((s) => (
                <DropdownMenuItem
                  key={s}
                  onSelect={() => bulkStatus.mutate({ ids: Array.from(selected), status: s })}
                >
                  <span className={cn("mr-2 inline-block h-2 w-2 rounded-full", leadStatusColors[s].dot)} />
                  {leadStatusLabels[s]}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Löschen */}
          <Button
            size="sm"
            variant="outline"
            className="border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={() => {
              if (confirm(`${selected.size} Lead(s) wirklich löschen?`)) {
                bulkDelete.mutate(Array.from(selected));
              }
            }}
          >
            <Trash2 className="mr-1 h-3.5 w-3.5" />
            Löschen
          </Button>

          <Button size="sm" variant="ghost" className="ml-auto" onClick={clearSelection}>
            <X className="mr-1 h-3.5 w-3.5" />
            Auswahl aufheben
          </Button>
        </div>
      )}


        <TabsContent value="list">
          <div className="rounded-xl border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[44px]">
                    <Checkbox
                      checked={allSelected ? true : someSelected ? "indeterminate" : false}
                      onCheckedChange={toggleAll}
                      aria-label="Alle auswählen"
                    />
                  </TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Kontakt</TableHead>
                  <TableHead>Quelle</TableHead>
                  <TableHead>Zugewiesen</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Aktionen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((l) => {
                  const isSel = selected.has(l.id);
                  return (
                    <TableRow key={l.id} className={cn("group", isSel && "bg-primary/5")}>
                      <TableCell>
                        <Checkbox
                          checked={isSel}
                          onCheckedChange={() => toggleOne(l.id)}
                          aria-label={`Lead ${l.full_name} auswählen`}
                        />
                      </TableCell>
                      <TableCell className="font-medium">
                        <Link to="/leads/$id" params={{ id: l.id }} className="hover:text-primary">{l.full_name}</Link>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {l.email && <div className="flex items-center gap-1"><Mail className="h-3 w-3" />{l.email}</div>}
                        {l.phone && <div className="flex items-center gap-1"><Phone className="h-3 w-3" />{l.phone}</div>}
                        {!l.email && !l.phone && "—"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{l.source ?? "—"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{employeeName(l.assigned_to)}</TableCell>
                      <TableCell>
                        <StatusDropdown
                          value={l.status as LeadStatus}
                          onChange={(s) => updateStatus.mutate({ id: l.id, status: s })}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <EditLeadButton lead={l} employees={employees} />
                          {l.status !== "converted" && (
                            <Button size="sm" variant="outline" className="h-8" onClick={() => convert.mutate(l)}>
                              <ArrowRight className="mr-1 h-3 w-3" />Zu Kunde
                            </Button>
                          )}
                          <Button asChild size="sm" variant="ghost" className="h-8 w-8 p-0">
                            <Link to="/leads/$id" params={{ id: l.id }}><ExternalLink className="h-3.5 w-3.5" /></Link>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">
                      {leadsQuery.isLoading ? "Leads werden geladen…" : "Keine Leads vorhanden"}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="kanban">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
            {leadStatuses.map((status) => {
              const items = filtered.filter((l) => l.status === status);
              const c = leadStatusColors[status];
              return (
                <div key={status} className={cn("flex flex-col rounded-2xl border bg-muted/40 p-3", c.ring)}>
                  <div className="mb-3 flex items-center justify-between px-1">
                    <h3 className="flex items-center gap-2 text-sm font-semibold">
                      <span className={cn("inline-block h-2 w-2 rounded-full", c.dot)} />
                      {leadStatusLabels[status]}
                    </h3>
                    <span className={cn("rounded-full px-2 py-0.5 text-xs font-medium border", c.badge)}>{items.length}</span>
                  </div>
                  <div className="flex flex-col gap-2">
                    {items.map((l) => {
                      const isSel = selected.has(l.id);
                      return (
                        <div
                          key={l.id}
                          className={cn(
                            "rounded-xl border bg-card p-3 shadow-soft transition hover:shadow-glow",
                            isSel && "ring-2 ring-primary/40"
                          )}
                        >
                          <div className="flex items-start gap-2">
                            <Checkbox
                              checked={isSel}
                              onCheckedChange={() => toggleOne(l.id)}
                              aria-label={`Lead ${l.full_name} auswählen`}
                              className="mt-0.5"
                            />
                            <div className="min-w-0 flex-1">
                              <Link to="/leads/$id" params={{ id: l.id }} className="font-medium hover:text-primary">{l.full_name}</Link>
                              <div className="mt-1 flex flex-col gap-0.5 text-xs text-muted-foreground">
                                {l.email && <span className="flex items-center gap-1 truncate"><Mail className="h-3 w-3" />{l.email}</span>}
                                {l.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{l.phone}</span>}
                                {l.source && <span>· {l.source}</span>}
                              </div>
                            </div>
                          </div>
                          <div className="mt-3 flex items-center gap-2">
                            <StatusDropdown
                              value={l.status as LeadStatus}
                              onChange={(s) => updateStatus.mutate({ id: l.id, status: s })}
                              compact
                            />
                            {l.status !== "converted" && (
                              <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => convert.mutate(l)} title="Zu Kunde konvertieren">
                                <ArrowRight className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                    {items.length === 0 && <p className="px-1 py-3 text-xs text-muted-foreground">Keine Leads</p>}
                  </div>
                </div>
              );
            })}
          </div>
        </TabsContent>

    </Tabs>

    {showError ? (
      <div className="mt-4 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
        {queryErrorMessage}
      </div>
    ) : null}
    </div>
  );
}

function EditLeadButton({ lead, employees }: { lead: Lead; employees: Profile[] }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    full_name: lead.full_name ?? "",
    email: lead.email ?? "",
    phone: lead.phone ?? "",
    source: lead.source ?? "",
    notes: lead.notes ?? "",
    assigned_to: lead.assigned_to ?? "",
    status: lead.status as LeadStatus,
  });

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("leads").update({
        full_name: form.full_name,
        email: form.email || null,
        phone: form.phone || null,
        source: form.source || null,
        notes: form.notes || null,
        assigned_to: form.assigned_to || null,
        status: form.status,
      }).eq("id", lead.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Gespeichert");
      qc.invalidateQueries({ queryKey: ["leads"] });
      qc.invalidateQueries({ queryKey: ["lead", lead.id] });
      setOpen(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => setOpen(true)} title="Bearbeiten">
        <Pencil className="h-3.5 w-3.5" />
      </Button>
      <DialogContent>
        <DialogHeader><DialogTitle>Lead bearbeiten</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Name</Label><Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>E-Mail</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            <div><Label>Telefon</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Quelle</Label><Input value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} /></div>
            <div>
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as LeadStatus })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {leadStatuses.map((s) => <SelectItem key={s} value={s}>{leadStatusLabels[s]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Zugewiesen an</Label>
            <Select value={form.assigned_to || UNASSIGNED} onValueChange={(v) => setForm({ ...form, assigned_to: v === UNASSIGNED ? "" : v })}>
              <SelectTrigger><SelectValue placeholder="Niemand" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={UNASSIGNED}>Niemand</SelectItem>
                {employees.map((e) => <SelectItem key={e.id} value={e.id}>{e.full_name ?? e.email ?? e.id}</SelectItem>)}
              </SelectContent>
            </Select>
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

// Farbiger Status-Badge mit Dropdown zum Wechseln
function StatusDropdown({
  value,
  onChange,
  compact = false,
}: {
  value: LeadStatus;
  onChange: (s: LeadStatus) => void;
  compact?: boolean;
}) {
  const c = leadStatusColors[value];
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border px-2.5 font-medium transition hover:opacity-90",
            compact ? "h-6 text-[11px]" : "h-7 text-xs",
            c.badge
          )}
        >
          <span className={cn("inline-block h-1.5 w-1.5 rounded-full", c.dot)} />
          {leadStatusLabels[value]}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {leadStatuses.map((s) => (
          <DropdownMenuItem key={s} onSelect={() => onChange(s)}>
            <span className={cn("mr-2 inline-block h-2 w-2 rounded-full", leadStatusColors[s].dot)} />
            {leadStatusLabels[s]}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
