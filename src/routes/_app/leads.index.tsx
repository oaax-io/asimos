import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Plus, Mail, Phone, ArrowRight, Search, Pencil, ExternalLink, LayoutGrid, List as ListIcon } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { leadStatusLabels, leadStatuses, type LeadStatus } from "@/lib/format";
import { useAuth } from "@/lib/auth";
import { getBackendErrorMessage, isBackendUnavailableError, throwIfError, unwrapServerResult } from "@/lib/backend-errors";
import { toast } from "sonner";
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
      const { data: profile } = await supabase.from("profiles").select("agency_id").eq("id", user!.id).single();
      const { data: created, error } = await supabase.from("clients").insert({
        agency_id: profile!.agency_id,
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

  const employeeName = (id: string | null) => {
    if (!id) return "—";
    const p = employeeMap.get(id);
    return p?.full_name ?? p?.email ?? "—";
  };

  return (
    <>
      <PageHeader
        title="Leads"
        description="Pipeline deiner Interessenten"
        action={
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
        }
      />

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
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

      <Tabs defaultValue="list" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="list"><ListIcon className="mr-1 h-4 w-4" />Liste</TabsTrigger>
          <TabsTrigger value="kanban"><LayoutGrid className="mr-1 h-4 w-4" />Kanban</TabsTrigger>
        </TabsList>

        <TabsContent value="list">
          <div className="rounded-xl border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Kontakt</TableHead>
                  <TableHead>Quelle</TableHead>
                  <TableHead>Zugewiesen</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Aktionen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((l) => (
                  <TableRow key={l.id} className="group">
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
                      <Select value={l.status} onValueChange={(v) => updateStatus.mutate({ id: l.id, status: v as LeadStatus })}>
                        <SelectTrigger className="h-8 w-[150px] text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {leadStatuses.map((s) => <SelectItem key={s} value={s}>{leadStatusLabels[s]}</SelectItem>)}
                        </SelectContent>
                      </Select>
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
                ))}
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
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
              return (
                <div key={status} className="flex flex-col rounded-2xl bg-muted/40 p-3">
                  <div className="mb-3 flex items-center justify-between px-1">
                    <h3 className="text-sm font-semibold">{leadStatusLabels[status]}</h3>
                    <span className="rounded-full bg-background px-2 py-0.5 text-xs text-muted-foreground">{items.length}</span>
                  </div>
                  <div className="flex flex-col gap-2">
                    {items.map((l) => (
                      <div key={l.id} className="rounded-xl border bg-card p-3 shadow-soft transition hover:shadow-glow">
                        <Link to="/leads/$id" params={{ id: l.id }} className="font-medium hover:text-primary">{l.full_name}</Link>
                        <div className="mt-1 flex flex-col gap-0.5 text-xs text-muted-foreground">
                          {l.email && <span className="flex items-center gap-1 truncate"><Mail className="h-3 w-3" />{l.email}</span>}
                          {l.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{l.phone}</span>}
                          {l.source && <span>· {l.source}</span>}
                        </div>
                        <div className="mt-3 flex items-center gap-2">
                          <Select value={l.status} onValueChange={(v) => updateStatus.mutate({ id: l.id, status: v as LeadStatus })}>
                            <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {leadStatuses.map((s) => <SelectItem key={s} value={s}>{leadStatusLabels[s]}</SelectItem>)}
                            </SelectContent>
                          </Select>
                          {l.status !== "converted" && (
                            <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => convert.mutate(l)} title="Zu Kunde konvertieren">
                              <ArrowRight className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                    {items.length === 0 && <p className="px-1 py-3 text-xs text-muted-foreground">Keine Leads</p>}
                  </div>
                </div>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>

      {queryUnavailable || (leadsQuery.error && isBackendUnavailableError(leadsQuery.error)) ? (
        <div className="mt-4 rounded-xl border border-dashed bg-muted/30 p-4 text-sm text-muted-foreground">
          {queryErrorMessage ?? "Backend aktuell nicht erreichbar. Bitte in wenigen Sekunden erneut versuchen."}
        </div>
      ) : null}
    </>
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
