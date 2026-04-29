import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Plus, Search, FileCheck2, FileText, Eye } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { EmptyState } from "@/components/EmptyState";
import { formatDate, formatCurrency } from "@/lib/format";
import { DocumentWizard } from "@/components/documents/DocumentWizard";

export const Route = createFileRoute("/_app/reservations")({ component: ReservationsPage });

const STATUS_LABELS = {
  draft: "Entwurf",
  sent: "Versendet",
  signed: "Unterzeichnet",
  cancelled: "Storniert",
  converted: "Konvertiert",
} as const;
const STATUS_VARIANTS: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  draft: "outline",
  sent: "secondary",
  signed: "default",
  cancelled: "destructive",
  converted: "default",
};

type ReservationRow = {
  id: string;
  status: keyof typeof STATUS_LABELS;
  client_id: string | null;
  property_id: string | null;
  reservation_fee: number | null;
  valid_until: string | null;
  notes: string | null;
  generated_document_id: string | null;
  clients: { full_name: string; address: string | null; postal_code: string | null; city: string | null } | null;
  properties: {
    title: string;
    address: string | null;
    city: string | null;
    postal_code: string | null;
    price: number | null;
  } | null;
};

function ReservationsPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [genFor, setGenFor] = useState<ReservationRow | null>(null);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [form, setForm] = useState({
    client_id: "",
    property_id: "",
    reservation_fee: "",
    valid_until: "",
    notes: "",
  });

  const { data: reservations = [], isLoading } = useQuery<ReservationRow[]>({
    queryKey: ["reservations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reservations")
        .select(
          "*, clients(full_name, address, postal_code, city), properties(title, address, postal_code, city, price)",
        )
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data as ReservationRow[]) ?? [];
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
      const { error } = await supabase.from("reservations").insert({
        client_id: form.client_id || null,
        property_id: form.property_id || null,
        reservation_fee: form.reservation_fee ? Number(form.reservation_fee) : null,
        valid_until: form.valid_until || null,
        notes: form.notes.trim() || null,
        status: "draft",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Reservation erstellt");
      qc.invalidateQueries({ queryKey: ["reservations"] });
      setForm({ client_id: "", property_id: "", reservation_fee: "", valid_until: "", notes: "" });
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from("reservations")
        .update({ status: status as "draft" })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["reservations"] }),
  });

  const showGenerated = async (docId: string) => {
    const { data } = await supabase
      .from("generated_documents")
      .select("html_content")
      .eq("id", docId)
      .maybeSingle();
    setPreviewHtml(data?.html_content ?? "<p>Kein Inhalt</p>");
  };




  const filtered = useMemo(
    () =>
      reservations.filter((r) => {
        if (statusFilter !== "all" && r.status !== statusFilter) return false;
        if (search) {
          const c = r.clients?.full_name?.toLowerCase() ?? "";
          const p = r.properties?.title?.toLowerCase() ?? "";
          if (!c.includes(search.toLowerCase()) && !p.includes(search.toLowerCase())) return false;
        }
        return true;
      }),
    [reservations, statusFilter, search],
  );

  return (
    <>
      <PageHeader
        title="Reservationen"
        description="Reservationsverträge zwischen Käufern, Mietern und Objekten"
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-1 h-4 w-4" />
                Neue Reservation
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Neue Reservation</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Käufer / Mieter</Label>
                    <Select value={form.client_id} onValueChange={(v) => setForm({ ...form, client_id: v })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Auswählen" />
                      </SelectTrigger>
                      <SelectContent>
                        {clients.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.full_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Immobilie</Label>
                    <Select value={form.property_id} onValueChange={(v) => setForm({ ...form, property_id: v })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Auswählen" />
                      </SelectTrigger>
                      <SelectContent>
                        {properties.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Reservationsgebühr (CHF)</Label>
                    <Input
                      type="number"
                      value={form.reservation_fee}
                      onChange={(e) => setForm({ ...form, reservation_fee: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Gültig bis</Label>
                    <Input
                      type="date"
                      value={form.valid_until}
                      onChange={(e) => setForm({ ...form, valid_until: e.target.value })}
                    />
                  </div>
                </div>
                <div>
                  <Label>Notizen</Label>
                  <Textarea rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>
                  Abbrechen
                </Button>
                <Button onClick={() => create.mutate()} disabled={create.isPending}>
                  Speichern
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="mb-4 flex flex-wrap gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Suchen…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Status</SelectItem>
            {Object.entries(STATUS_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>
                {v}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="rounded-xl border bg-muted/20 p-4 text-sm text-muted-foreground">Wird geladen…</div>
      ) : filtered.length === 0 ? (
        <EmptyState
          title="Keine Reservationen"
          description="Erstelle eine Reservation, sobald ein Käufer ein Objekt verbindlich sichern möchte."
        />
      ) : (
        <div className="rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Käufer / Mieter</TableHead>
                <TableHead>Immobilie</TableHead>
                <TableHead>Gebühr</TableHead>
                <TableHead>Gültig bis</TableHead>
                <TableHead>Dokument</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Aktionen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <FileCheck2 className="h-4 w-4 text-muted-foreground" />
                      {r.clients?.full_name ?? "—"}
                    </div>
                  </TableCell>
                  <TableCell>{r.properties?.title ?? "—"}</TableCell>
                  <TableCell>{formatCurrency(r.reservation_fee != null ? Number(r.reservation_fee) : null)}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {r.valid_until ? formatDate(r.valid_until) : "—"}
                  </TableCell>
                  <TableCell>
                    {r.generated_document_id ? (
                      <Button variant="ghost" size="sm" onClick={() => showGenerated(r.generated_document_id!)}>
                        <Eye className="mr-1 h-3.5 w-3.5" />
                        Ansehen
                      </Button>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Select value={r.status} onValueChange={(v) => updateStatus.mutate({ id: r.id, status: v })}>
                      <SelectTrigger className="h-8 w-36">
                        <Badge variant={STATUS_VARIANTS[r.status]}>{STATUS_LABELS[r.status]}</Badge>
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(STATUS_LABELS).map(([k, v]) => (
                          <SelectItem key={k} value={k}>
                            {v}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="outline" size="sm" onClick={() => setGenFor(r)}>
                      <FileText className="mr-1 h-3.5 w-3.5" />
                      Dokument
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
          kind="reservation"
          defaultClientId={genFor.client_id ?? undefined}
          defaultPropertyId={genFor.property_id ?? undefined}
          relatedType="reservation"
          relatedId={genFor.id}
          extraContext={{
            reservation: {
              reservation_fee: genFor.reservation_fee,
              valid_until: genFor.valid_until,
            },
          }}
        />
      )}

      <Dialog open={!!previewHtml} onOpenChange={(o) => !o && setPreviewHtml(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Generiertes Dokument</DialogTitle>
          </DialogHeader>
          <iframe title="Dokument" srcDoc={previewHtml ?? ""} className="h-[70vh] w-full rounded-md border bg-white" />
        </DialogContent>
      </Dialog>
    </>
  );
}
