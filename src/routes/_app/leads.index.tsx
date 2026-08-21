import { createFileRoute, Link } from "@tanstack/react-router";
import { LeadDetailDialog } from "@/components/leads/LeadDetailDialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Plus, Mail, Phone, ArrowRight, Search, Pencil, ExternalLink, LayoutGrid, List as ListIcon, Trash2, UserCog, MoreHorizontal, X, Upload, UserPlus} from "lucide-react";
import { LeadImportSourceDialog } from "@/components/leads/LeadImportSourceDialog";
import { LeadImportWizard } from "@/components/leads/LeadImportWizard";
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
import { useConfirm } from "@/components/confirm/ConfirmProvider";
import { useAuth } from "@/lib/auth";
import { getBackendErrorMessage, isBackendUnavailableError, throwIfError, unwrapServerResult } from "@/lib/backend-errors";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { Tables } from "@/integrations/supabase/types";
import { addLead, getLeads } from "@/lib/crm.functions";
import { ConvertLeadDialog } from "@/components/leads/ConvertLeadDialog";
import { useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { deleteToTrash } from "@/lib/trash";
import { usePersistedState } from "@/hooks/usePersistedState";
import { FilterMultiSelect } from "@/components/filters/FilterMultiSelect";

export const Route = createFileRoute("/_app/leads/")({ component: LeadsPage });

type Lead = Tables<"leads">;
type Profile = { id: string; full_name: string | null; email: string | null; avatar_url?: string | null };

const UNASSIGNED = "__unassigned__";
const LEAD_SOURCES = ["Eigenlead", "Website", "Empfehlung", "Tiktok", "Instagram", "Facebook"] as const;

function LeadsPage() {
  const { t } = useTranslation();
  const confirm = useConfirm();
  const qc = useQueryClient();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ full_name: "", email: "", phone: "", source: "", notes: "", assigned_to: "" });
  const [importSourceOpen, setImportSourceOpen] = useState(false);
  const [importWizardVariant, setImportWizardVariant] = useState<"csv" | "casaone" | null>(null);

  // Filters
  const [search, setSearch] = usePersistedState("leads:filter:search", "");
  const [statusFilters, setStatusFilters] = usePersistedState<string[]>("leads:filter:status", []);
  const [sourceFilters, setSourceFilters] = usePersistedState<string[]>("leads:filter:source", []);
  const [assignedFilters, setAssignedFilters] = usePersistedState<string[]>("leads:filter:assigned", []);

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
        .select("id, full_name, email, avatar_url")
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
      if (statusFilters.length && !statusFilters.includes(l.status as string)) return false;
      if (sourceFilters.length && !(l.source && sourceFilters.includes(l.source))) return false;
      if (assignedFilters.length) {
        const matches = l.assigned_to
          ? assignedFilters.includes(l.assigned_to)
          : assignedFilters.includes(UNASSIGNED);
        if (!matches) return false;
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
  }, [leads, statusFilters, sourceFilters, assignedFilters, search]);

  // Pagination (Liste)
  const [pageSize, setPageSize] = usePersistedState<number>("leads:filter:pageSize", 20);
  const [page, setPage] = useState(1);
  useEffect(() => { setPage(1); }, [search, statusFilters, sourceFilters, assignedFilters, pageSize]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paginated = useMemo(
    () => filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    [filtered, currentPage, pageSize],
  );

  // Banner nur bei "echten" Fehlern – Backend-Unavailable wird automatisch retryed.
  const queryError = leadsQuery.error;
  const showError = queryError && !isBackendUnavailableError(queryError);
  const queryErrorMessage = showError ? getBackendErrorMessage(queryError) : null;

  const create = useMutation({
    mutationFn: async () => {
      if (!form.full_name.trim()) throw new Error(t("leads.errors.nameRequired"));
      if (!form.email.trim()) throw new Error(t("leads.errors.emailRequired"));
      if (!form.phone.trim()) throw new Error(t("leads.errors.phoneRequired"));
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) throw new Error(t("leads.errors.notLoggedIn"));
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
      toast.success(t("leads.toast.created"));
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

  const navigate = useNavigate();
  const [convertLead, setConvertLead] = useState<Lead | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);



  // ----- Bulk-Aktionen -----
  const bulkAssign = useMutation({
    mutationFn: async ({ ids, assignedTo }: { ids: string[]; assignedTo: string | null }) => {
      const { error } = await supabase.from("leads").update({ assigned_to: assignedTo }).in("id", ids);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      toast.success(t("leads.bulk.assignedToast", { count: vars.ids.length }));
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
      toast.success(t("leads.bulk.statusToast", { count: vars.ids.length }));
      qc.invalidateQueries({ queryKey: ["leads"] });
      clearSelection();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const bulkDelete = useMutation({
    mutationFn: async (ids: string[]) => {
      await deleteToTrash("leads", ids);
    },
    onSuccess: (_d, ids) => {
      toast.success(t("leads.bulk.deletedToast", { count: ids.length }));
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
        title={
          <span className="inline-flex items-center gap-2.5">
            <UserPlus className="h-8 w-8 text-[#6F6B94]" />
            {t("pages.leads.title")}
          </span>
        }
        action={
          <>
            <TabsList className="h-9 rounded-lg bg-primary/15 p-1">
              <TabsTrigger value="list" className="gap-1.5 rounded-md data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"><ListIcon className="h-4 w-4" />{t("leads.tabs.list")}</TabsTrigger>
              <TabsTrigger value="kanban" className="gap-1.5 rounded-md data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"><LayoutGrid className="h-4 w-4" />{t("leads.tabs.kanban")}</TabsTrigger>
            </TabsList>
          <Button variant="outline" onClick={() => setImportSourceOpen(true)}>
            <Upload className="mr-1 h-4 w-4" />
            {t("leads.import")}
          </Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="mr-1 h-4 w-4" />{t("leads.new")}</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{t("leads.new")}</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>{t("leads.form.nameRequired")}</Label><Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>{t("leads.form.emailRequired")}</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
                  <div><Label>{t("leads.form.phoneRequired")}</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
                </div>
                <div>
                  <Label>{t("leads.form.source")}</Label>
                  <Select value={form.source || UNASSIGNED} onValueChange={(v) => setForm({ ...form, source: v === UNASSIGNED ? "" : v })}>
                    <SelectTrigger><SelectValue placeholder={t("leads.form.sourcePlaceholder")} /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={UNASSIGNED}>{t("leads.form.noSource")}</SelectItem>
                      {LEAD_SOURCES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>{t("leads.form.assignedTo")}</Label>
                  <Select value={form.assigned_to || UNASSIGNED} onValueChange={(v) => setForm({ ...form, assigned_to: v === UNASSIGNED ? "" : v })}>
                    <SelectTrigger><SelectValue placeholder={t("leads.form.nobody")} /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={UNASSIGNED}>{t("leads.form.nobody")}</SelectItem>
                      {employees.map((e) => <SelectItem key={e.id} value={e.id}>{e.full_name ?? e.email ?? e.id}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>{t("leads.form.notes")}</Label><Textarea rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
              </div>
              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => setOpen(false)}>{t("common.cancel")}</Button>
                <Button onClick={() => create.mutate()} disabled={!form.full_name.trim() || !form.email.trim() || !form.phone.trim() || create.isPending}>
                  {create.isPending ? t("common.saving") : t("common.save")}
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
          <Input className="pl-9" placeholder={t("leads.filters.searchPlaceholder")} value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <FilterMultiSelect
          options={leadStatuses.map((s) => ({ value: s, label: leadStatusLabels[s] }))}
          selected={statusFilters}
          onChange={setStatusFilters}
          placeholder={t("leads.filters.allStatus")}
        />
        <FilterMultiSelect
          options={sources.map((s) => ({ value: s, label: s }))}
          selected={sourceFilters}
          onChange={setSourceFilters}
          placeholder={t("leads.filters.allSources")}
        />
        <FilterMultiSelect
          options={[
            { value: UNASSIGNED, label: t("leads.filters.unassigned") },
            ...employees.map((e) => ({ value: e.id, label: e.full_name ?? e.email ?? e.id, avatar_url: e.avatar_url ?? null })),
          ]}
          selected={assignedFilters}
          onChange={setAssignedFilters}
          placeholder={t("leads.filters.allEmployees")}
        />
        {(statusFilters.length > 0 || sourceFilters.length > 0 || assignedFilters.length > 0 || search) && (
          <Button variant="ghost" size="sm" onClick={() => { setSearch(""); setStatusFilters([]); setSourceFilters([]); setAssignedFilters([]); }}>
            {t("leads.filters.reset")}
          </Button>
        )}
        <span className="ml-auto text-sm text-muted-foreground">{t("leads.filters.ofTotal", { shown: filtered.length, total: leads.length })}</span>
      </div>

      {/* Bulk-Aktionen Toolbar */}
      {selected.size > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 p-3">
          <span className="text-sm font-medium">
            {t("leads.bulk.selected", { count: selected.size })}
          </span>

          {/* Zuweisen */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline" className="ml-2">
                <UserCog className="mr-1 h-3.5 w-3.5" />
                {t("leads.bulk.assign")}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              <DropdownMenuLabel>{t("leads.bulk.chooseEmployee")}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => bulkAssign.mutate({ ids: Array.from(selected), assignedTo: null })}>
                {t("leads.bulk.resetAssignee")}
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
                <DropdownMenuItem disabled>{t("leads.bulk.noEmployees")}</DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Status setzen */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline">
                <MoreHorizontal className="mr-1 h-3.5 w-3.5" />
                {t("leads.bulk.setStatus")}
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
            onClick={async () => {
              if (await confirm({ title: t("leads.bulk.deleteTitle"), description: t("leads.bulk.deleteDescription", { count: selected.size }), confirmText: t("common.delete") })) {
                bulkDelete.mutate(Array.from(selected));
              }
            }}
          >
            <Trash2 className="mr-1 h-3.5 w-3.5" />
            {t("leads.bulk.delete")}
          </Button>

          <Button size="sm" variant="ghost" className="ml-auto" onClick={clearSelection}>
            <X className="mr-1 h-3.5 w-3.5" />
            {t("leads.bulk.clear")}
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
                      aria-label={t("leads.table.selectAll")}
                    />
                  </TableHead>
                  <TableHead>{t("leads.columns.name")}</TableHead>
                  <TableHead>{t("leads.columns.contact")}</TableHead>
                  <TableHead>{t("leads.columns.source")}</TableHead>
                  <TableHead>{t("leads.columns.assignedTo")}</TableHead>
                  <TableHead>{t("leads.columns.status")}</TableHead>
                  <TableHead className="text-right">{t("leads.table.actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginated.map((l) => {
                  const isSel = selected.has(l.id);
                  return (
                    <TableRow key={l.id} className={cn("group", isSel && "bg-primary/5")}>
                      <TableCell>
                        <Checkbox
                          checked={isSel}
                          onCheckedChange={() => toggleOne(l.id)}
                          aria-label={`Lead ${l.full_name}`}
                        />
                      </TableCell>
                      <TableCell className="font-medium">
                        <button type="button" onClick={() => setDetailId(l.id)} className="text-left hover:text-primary hover:underline">{l.full_name}</button>
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
                            <Button size="sm" variant="outline" className="h-8" onClick={() => setConvertLead(l)}>
                              <ArrowRight className="mr-1 h-3 w-3" />{t("leads.table.toClient")}
                            </Button>
                          )}
                          <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => setDetailId(l.id)}>
                            <ExternalLink className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">
                      {leadsQuery.isLoading ? t("leads.table.loading") : t("leads.table.empty")}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          {filtered.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <span>
                  {t("leads.pagination.showing", { from: (currentPage - 1) * pageSize + 1, to: Math.min(currentPage * pageSize, filtered.length), total: filtered.length })}
                </span>
                <Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v))}>
                  <SelectTrigger className="h-8 w-[110px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="20">{t("leads.pagination.perPage", { n: 20 })}</SelectItem>
                    <SelectItem value="50">{t("leads.pagination.perPage", { n: 50 })}</SelectItem>
                    <SelectItem value="100">{t("leads.pagination.perPage", { n: 100 })}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}>
                  {t("leads.pagination.prev")}
                </Button>
                <span>{t("leads.pagination.page", { current: currentPage, total: totalPages })}</span>
                <Button size="sm" variant="outline" disabled={currentPage >= totalPages} onClick={() => setPage(currentPage + 1)}>
                  {t("leads.pagination.next")}
                </Button>
              </div>
            </div>
          )}
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
                              <button type="button" onClick={() => setDetailId(l.id)} className="text-left font-medium hover:text-primary hover:underline">{l.full_name}</button>
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
                              <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => setConvertLead(l)} title={t("leads.table.convertTitle")}>
                                <ArrowRight className="h-3 w-3" />
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                    {items.length === 0 && <p className="px-1 py-3 text-xs text-muted-foreground">{t("leads.table.noLeads")}</p>}
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

    <LeadImportSourceDialog
      open={importSourceOpen}
      onOpenChange={setImportSourceOpen}
      onPick={(variant) => {
        setImportSourceOpen(false);
        setImportWizardVariant(variant);
      }}
    />
    {importWizardVariant && (
      <LeadImportWizard
        open={true}
        onOpenChange={(v) => { if (!v) setImportWizardVariant(null); }}
        variant={importWizardVariant}
      />
    )}
    {convertLead && (
      <ConvertLeadDialog
        lead={convertLead}
        open={!!convertLead}
        onOpenChange={(v) => { if (!v) setConvertLead(null); }}
        onConverted={(clientId) => {
          setConvertLead(null);
          qc.invalidateQueries({ queryKey: ["leads"] });
          qc.invalidateQueries({ queryKey: ["clients"] });
          navigate({ to: "/clients/$id", params: { id: clientId } });
        }}
      />
    )}
    <LeadDetailDialog
      leadId={detailId}
      open={!!detailId}
      onOpenChange={(v) => { if (!v) setDetailId(null); }}
      leadIds={filtered.map((l: any) => l.id)}
      onNavigate={(nextId) => setDetailId(nextId)}
    />
    </div>

  );
}

function EditLeadButton({ lead, employees }: { lead: Lead; employees: Profile[] }) {
  const { t } = useTranslation();
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
      toast.success(t("leads.toast.saved"));
      qc.invalidateQueries({ queryKey: ["leads"] });
      qc.invalidateQueries({ queryKey: ["lead", lead.id] });
      setOpen(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={() => setOpen(true)} title={t("leads.table.edit")}>
        <Pencil className="h-3.5 w-3.5" />
      </Button>
      <DialogContent>
        <DialogHeader><DialogTitle>{t("leads.editTitle")}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>{t("leads.form.name")}</Label><Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>{t("leads.form.email")}</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            <div><Label>{t("leads.form.phone")}</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>{t("leads.form.source")}</Label>
              <Select value={form.source || UNASSIGNED} onValueChange={(v) => setForm({ ...form, source: v === UNASSIGNED ? "" : v })}>
                <SelectTrigger><SelectValue placeholder={t("leads.form.sourcePlaceholder")} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={UNASSIGNED}>{t("leads.form.noSource")}</SelectItem>
                  {LEAD_SOURCES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  {form.source && !LEAD_SOURCES.includes(form.source as typeof LEAD_SOURCES[number]) && (
                    <SelectItem value={form.source}>{form.source}</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t("leads.form.status")}</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as LeadStatus })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {leadStatuses.map((s) => <SelectItem key={s} value={s}>{leadStatusLabels[s]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>{t("leads.form.assignedTo")}</Label>
            <Select value={form.assigned_to || UNASSIGNED} onValueChange={(v) => setForm({ ...form, assigned_to: v === UNASSIGNED ? "" : v })}>
              <SelectTrigger><SelectValue placeholder={t("leads.form.nobody")} /></SelectTrigger>
              <SelectContent>
                <SelectItem value={UNASSIGNED}>{t("leads.form.nobody")}</SelectItem>
                {employees.map((e) => <SelectItem key={e.id} value={e.id}>{e.full_name ?? e.email ?? e.id}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div><Label>{t("leads.form.notes")}</Label><Textarea rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
        </div>
        <DialogFooter>
          <Button onClick={() => save.mutate()} disabled={!form.full_name || save.isPending}>{t("common.save")}</Button>
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
