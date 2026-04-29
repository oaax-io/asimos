import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Plus, Search, FileLock2, FileText, Eye } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { EmptyState } from "@/components/EmptyState";
import { formatDate } from "@/lib/format";
import { DocumentWizard } from "@/components/documents/DocumentWizard";

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
  generated_document_id: string | null;
  clients: { full_name: string } | null;
  properties: { title: string } | null;
};

function NdasPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [genFor, setGenFor] = useState<NdaRow | null>(null);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [form, setForm] = useState({
    client_id: "",
    property_id: "",
    nda_type: "mutual",
    purpose: "",
    valid_from: "",
    valid_until: "",
    notes: "",
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
        status: "draft",
      } as any).select("*, clients(full_name), properties(title)").single();
      if (error) throw error;
      return data as unknown as NdaRow;
    },
    onSuccess: (row) => {
      toast.success("NDA erstellt");
      qc.invalidateQueries({ queryKey: ["nda-agreements"] });
      setForm({ client_id: "", property_id: "", nda_type: "mutual", purpose: "", valid_from: "", valid_until: "", notes: "" });
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

  const showGenerated = async (docId: string) => {
    const { data } = await supabase.from("generated_documents").select("html_content").eq("id", docId).maybeSingle();
    setPreviewHtml(data?.html_content ?? "<p>Kein Inhalt</p>");
  };

  const filtered = useMemo(
    () =>
      ndas.filter((n) => {
        if (statusFilter !== "all" && n.status !== statusFilter) return false;
        if (search) {
          const c = n.clients?.full_name?.toLowerCase() ?? "";
          const p = n.properties?.title?.toLowerCase() ?? "";
          if (!c.includes(search.toLowerCase()) && !p.includes(search.toLowerCase())) return false;
        }
        return true;
      }),
    [ndas, statusFilter, search],
  );

  return (
    <>
      <PageHeader
        title="NDAs"
        description="Vertraulichkeitsvereinbarungen mit Kunden und Partnern"
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

      <div className="mb-4 flex flex-wrap gap-3">
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
                <TableRow key={n.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <FileLock2 className="size-4 text-muted-foreground" />
                      {n.clients?.full_name ?? "—"}
                    </div>
                  </TableCell>
                  <TableCell>{n.properties?.title ?? "—"}</TableCell>
                  <TableCell>{TYPE_LABELS[n.nda_type] ?? n.nda_type}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {n.valid_from ? formatDate(n.valid_from) : "—"} – {n.valid_until ? formatDate(n.valid_until) : "offen"}
                  </TableCell>
                  <TableCell>
                    {n.generated_document_id ? (
                      <Button variant="ghost" size="sm" onClick={() => showGenerated(n.generated_document_id!)}>
                        <Eye className="mr-1 size-3.5" /> Ansehen
                      </Button>
                    ) : <span className="text-xs text-muted-foreground">—</span>}
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
            },
          }}
        />
      )}

      <Dialog open={!!previewHtml} onOpenChange={(o) => !o && setPreviewHtml(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader><DialogTitle>Generiertes Dokument</DialogTitle></DialogHeader>
          <iframe title="Dokument" srcDoc={previewHtml ?? ""} className="h-[70vh] w-full rounded-md border bg-white" />
        </DialogContent>
      </Dialog>
    </>
  );
}
