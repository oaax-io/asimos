import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Plus, Search, FileLock2, FileText, Eye, Archive, ArchiveRestore, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { EmptyState } from "@/components/EmptyState";
import { formatDate } from "@/lib/format";
import { DocumentWizard } from "@/components/documents/DocumentWizard";
import { DocumentPreviewDialog } from "@/components/documents/DocumentPreviewDialog";

export const Route = createFileRoute("/_app/ndas")({ component: NdasPage });

const STATUS_LABELS: Record<string, string> = {
  draft: "Entwurf",
  sent: "Versendet",
  signed: "Unterzeichnet",
  expired: "Abgelaufen",
  cancelled: "Storniert",
};
const STATUS_VARIANTS: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  draft: "outline",
  sent: "secondary",
  signed: "default",
  expired: "secondary",
  cancelled: "destructive",
};

const TYPE_LABELS: Record<string, string> = {
  mutual: "Beidseitig",
  one_way: "Einseitig",
  buyer: "Käufer",
  partner: "Partner",
};

type NdaRow = {
  id: string;
  client_id: string | null;
  property_id: string | null;
  nda_type: string;
  status: string;
  valid_from: string | null;
  valid_until: string | null;
  notes: string | null;
  penalty_amount: number | null;
  is_archived: boolean | null;
  generated_document_id: string | null;
  clients: { full_name: string } | null;
  properties: { title: string } | null;
};

function formatChf(n: number): string {
  return `CHF ${n.toLocaleString("de-CH", { maximumFractionDigits: 0 })}`;
}

function NdasPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [archiveFilter, setArchiveFilter] = useState<"active" | "archived" | "all">("active");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [genFor, setGenFor] = useState<NdaRow | null>(null);
  const [previewFor, setPreviewFor] = useState<NdaRow | null>(null);
  const [form, setForm] = useState({
    client_id: "",
    property_id: "",
    nda_type: "mutual",
    purpose: "",
    valid_from: "",
    valid_until: "",
    notes: "",
    penalty_amount: 10000,
  });

  const { data: canManage = false } = useQuery({
    queryKey: ["is-manager-or-above"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("is_manager_or_above");
      if (error) return false;
      return !!data;
    },
  });

  const { data: ndas = [], isLoading } = useQuery<NdaRow[]>({
    queryKey: ["nda-agreements"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("nda_agreements" as any)
        .select("*, clients(full_name), properties(title)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return ((data as unknown) as NdaRow[]) ?? [];
    },
  });

  const { data: clients = [] } = useQuery({
    queryKey: ["clients-min"],
    queryFn: async () => (await supabase.from("clients").select("id, full_name").order("full_name")).data ?? [],
  });
  const { data: properties = [] } = useQuery({
    queryKey: ["properties-min"],
    queryFn: async () => (await supabase.from("properties").select("id, title").order("title")).data ?? [],
  });

  const create = useMutation({
    mutationFn: async () => {
      if (!form.client_id) throw new Error("Bitte Kunde wählen");
      const { data, error } = await supabase.from("nda_agreements" as any).insert({
        client_id: form.client_id,
        property_id: form.property_id || null,
        nda_type: form.nda_type,
        valid_from: form.valid_from || null,
        valid_until: form.valid_until || null,
        notes: form.notes.trim() || (form.purpose ? `Zweck: ${form.purpose}` : null),
        penalty_amount: form.penalty_amount,
        status: "draft",
      } as any).select("*, clients(full_name), properties(title)").single();
      if (error) throw error;
      return data as unknown as NdaRow;
    },
    onSuccess: (row) => {
      toast.success("NDA erstellt");
      qc.invalidateQueries({ queryKey: ["nda-agreements"] });
      setForm({ client_id: "", property_id: "", nda_type: "mutual", purpose: "", valid_from: "", valid_until: "", notes: "", penalty_amount: 10000 });
      setOpen(false);
      setGenFor(row);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("nda_agreements" as any).update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["nda-agreements"] }),
  });

  const archiveBulk = useMutation({
    mutationFn: async ({ ids, archive }: { ids: string[]; archive: boolean }) => {
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("nda_agreements" as any)
        .update({
          is_archived: archive,
          archived_at: archive ? new Date().toISOString() : null,
          archived_by: archive ? u.user?.id ?? null : null,
        } as any)
        .in("id", ids);
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      toast.success(v.archive ? `${v.ids.length} NDA(s) archiviert` : `${v.ids.length} NDA(s) wiederhergestellt`);
      setSelected(new Set());
      qc.invalidateQueries({ queryKey: ["nda-agreements"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteBulk = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase.from("nda_agreements" as any).delete().in("id", ids);
      if (error) throw error;
    },
    onSuccess: (_d, ids) => {
      toast.success(`${ids.length} NDA(s) gelöscht`);
      setSelected(new Set());
      setConfirmDelete(false);
      qc.invalidateQueries({ queryKey: ["nda-agreements"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = useMemo(
    () =>
      ndas.filter((n) => {
        const archived = !!n.is_archived;
        if (archiveFilter === "active" && archived) return false;
        if (archiveFilter === "archived" && !archived) return false;
        if (statusFilter !== "all" && n.status !== statusFilter) return false;
        if (search) {
          const c = n.clients?.full_name?.toLowerCase() ?? "";
          const p = n.properties?.title?.toLowerCase() ?? "";
          if (!c.includes(search.toLowerCase()) && !p.includes(search.toLowerCase())) return false;
        }
        return true;
      }),
    [ndas, statusFilter, search, archiveFilter],
  );

  const allSelected = filtered.length > 0 && filtered.every((n) => selected.has(n.id));
  const someSelected = selected.size > 0;
  const selectedIds = Array.from(selected);
  const selectedRows = ndas.filter((n) => selected.has(n.id));
  const allSelectedArchived = selectedRows.length > 0 && selectedRows.every((n) => n.is_archived);

  const toggleAll = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(filtered.map((n) => n.id)));
  };
  const toggleOne = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  return (
    <>
      <PageHeader
        i18nKey="ndas"
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="mr-1 size-4" /> Neues NDA</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Neues NDA</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Kunde *</Label>
                    <Select value={form.client_id} onValueChange={(v) => setForm({ ...form, client_id: v })}>
                      <SelectTrigger><SelectValue placeholder="Auswählen" /></SelectTrigger>
                      <SelectContent>
                        {clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Bezug zum Objekt (optional)</Label>
                    <Select value={form.property_id} onValueChange={(v) => setForm({ ...form, property_id: v })}>
                      <SelectTrigger><SelectValue placeholder="Keines" /></SelectTrigger>
                      <SelectContent>
                        {properties.map((p) => <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>NDA-Typ</Label>
                    <Select value={form.nda_type} onValueChange={(v) => setForm({ ...form, nda_type: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(TYPE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Zweck</Label>
                    <Input value={form.purpose} onChange={(e) => setForm({ ...form, purpose: e.target.value })} placeholder="z.B. Prüfung Objektunterlagen" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Gültig ab</Label>
                    <Input type="date" value={form.valid_from} onChange={(e) => setForm({ ...form, valid_from: e.target.value })} />
                  </div>
                  <div>
                    <Label>Gültig bis</Label>
                    <Input type="date" value={form.valid_until} onChange={(e) => setForm({ ...form, valid_until: e.target.value })} />
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between">
                    <Label>Konventionalstrafe</Label>
                    <span className="text-sm font-medium tabular-nums">{formatChf(form.penalty_amount)}</span>
                  </div>
                  <Slider
                    className="mt-2"
                    min={5000}
                    max={100000}
                    step={1000}
                    value={[form.penalty_amount]}
                    onValueChange={([v]) => setForm({ ...form, penalty_amount: v })}
                  />
                  <div className="mt-1 flex justify-between text-xs text-muted-foreground">
                    <span>CHF 5'000</span>
                    <span>CHF 100'000</span>
                  </div>
                </div>
                <div>
                  <Label>Notizen</Label>
                  <Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>Abbrechen</Button>
                <Button onClick={() => create.mutate()} disabled={create.isPending || !form.client_id}>
                  Speichern & Dokument erstellen
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="NDAs suchen…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Status</SelectItem>
            {Object.entries(STATUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={archiveFilter} onValueChange={(v) => setArchiveFilter(v as any)}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Aktiv</SelectItem>
            <SelectItem value="archived">Archiviert</SelectItem>
            <SelectItem value="all">Alle</SelectItem>
          </SelectContent>
        </Select>

        {someSelected && canManage && (
          <div className="ml-auto flex items-center gap-2">
            <span className="text-sm text-muted-foreground">{selected.size} ausgewählt</span>
            {allSelectedArchived ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => archiveBulk.mutate({ ids: selectedIds, archive: false })}
                disabled={archiveBulk.isPending}
              >
                <ArchiveRestore className="mr-1 size-4" /> Wiederherstellen
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => archiveBulk.mutate({ ids: selectedIds, archive: true })}
                disabled={archiveBulk.isPending}
              >
                <Archive className="mr-1 size-4" /> Archivieren
              </Button>
            )}
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setConfirmDelete(true)}
              disabled={deleteBulk.isPending}
            >
              <Trash2 className="mr-1 size-4" /> Löschen
            </Button>
          </div>
        )}
        {someSelected && !canManage && (
          <span className="ml-auto text-xs text-muted-foreground">
            Archivieren/Löschen nur für Manager und höher.
          </span>
        )}
      </div>

      {isLoading ? (
        <div className="rounded-xl border bg-muted/20 p-4 text-sm text-muted-foreground">Wird geladen…</div>
      ) : filtered.length === 0 ? (
        <EmptyState title="Keine NDAs" description="Erstelle dein erstes NDA, um vertrauliche Informationen zu schützen." />
      ) : (
        <div className="rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={toggleAll}
                    aria-label="Alle auswählen"
                  />
                </TableHead>
                <TableHead>Kunde</TableHead>
                <TableHead>Objekt</TableHead>
                <TableHead>Typ</TableHead>
                <TableHead>Gültigkeit</TableHead>
                <TableHead>Dokument</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Aktionen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((n) => (
                <TableRow key={n.id} data-state={selected.has(n.id) ? "selected" : undefined}>
                  <TableCell>
                    <Checkbox
                      checked={selected.has(n.id)}
                      onCheckedChange={() => toggleOne(n.id)}
                      aria-label="Zeile auswählen"
                    />
                  </TableCell>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <FileLock2 className="size-4 text-muted-foreground" />
                      {n.clients?.full_name ?? "—"}
                      {n.is_archived && (
                        <Badge variant="outline" className="ml-1 text-xs">Archiviert</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{n.properties?.title ?? "—"}</TableCell>
                  <TableCell>{TYPE_LABELS[n.nda_type] ?? n.nda_type}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {n.valid_from ? formatDate(n.valid_from) : "—"} – {n.valid_until ? formatDate(n.valid_until) : "offen"}
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm" onClick={() => setPreviewFor(n)}>
                      <Eye className="mr-1 size-3.5" /> {n.generated_document_id ? "Ansehen" : "Vorschau"}
                    </Button>
                  </TableCell>
                  <TableCell>
                    <Select value={n.status} onValueChange={(v) => updateStatus.mutate({ id: n.id, status: v })}>
                      <SelectTrigger className="h-8 w-36">
                        <Badge variant={STATUS_VARIANTS[n.status]}>{STATUS_LABELS[n.status] ?? n.status}</Badge>
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(STATUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="outline" size="sm" onClick={() => setGenFor(n)}>
                      <FileText className="mr-1 size-3.5" /> Dokument
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {genFor && (
        <DocumentWizard
          open={!!genFor}
          onOpenChange={(o) => !o && setGenFor(null)}
          kind="nda"
          defaultClientId={genFor.client_id ?? undefined}
          defaultPropertyId={genFor.property_id ?? undefined}
          relatedType="nda"
          relatedId={genFor.id}
          extraContext={{
            nda: {
              type: TYPE_LABELS[genFor.nda_type] ?? genFor.nda_type,
              valid_from: genFor.valid_from,
              valid_until: genFor.valid_until,
              purpose: genFor.notes?.startsWith("Zweck: ") ? genFor.notes.slice(7) : undefined,
              penalty_amount: genFor.penalty_amount ?? 10000,
            },
          }}
        />
      )}

      {previewFor && (
        <DocumentPreviewDialog
          open={!!previewFor}
          onOpenChange={(o) => !o && setPreviewFor(null)}
          generatedDocumentId={previewFor.generated_document_id}
          kind="nda"
          clientId={previewFor.client_id}
          propertyId={previewFor.property_id}
          extraContext={{
            nda: {
              type: TYPE_LABELS[previewFor.nda_type] ?? previewFor.nda_type,
              valid_from: previewFor.valid_from,
              valid_until: previewFor.valid_until,
              purpose: previewFor.notes?.startsWith("Zweck: ") ? previewFor.notes.slice(7) : undefined,
              penalty_amount: previewFor.penalty_amount ?? 10000,
            },
          }}
        />
      )}

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>NDA(s) endgültig löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              {selected.size} NDA(s) werden unwiderruflich gelöscht. Diese Aktion kann nicht rückgängig gemacht werden. Ziehe stattdessen ggf. das Archivieren in Betracht.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteBulk.mutate(selectedIds)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
