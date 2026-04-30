import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Plus, Search, FileSignature, FileText, Eye } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/EmptyState";
import { formatDate } from "@/lib/format";
import { DocumentWizard } from "@/components/documents/DocumentWizard";
import { DocumentPreviewDialog } from "@/components/documents/DocumentPreviewDialog";
import { MandateWizard } from "@/components/mandates/MandateWizard";

export const Route = createFileRoute("/_app/mandates")({ component: MandatesPage });

const STATUS_LABELS = {
  draft: "Entwurf",
  sent: "Versendet",
  signed: "Unterzeichnet",
  active: "Aktiv",
  expired: "Abgelaufen",
  cancelled: "Storniert",
} as const;
const STATUS_VARIANTS: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  draft: "outline",
  sent: "secondary",
  signed: "default",
  active: "default",
  expired: "secondary",
  cancelled: "destructive",
};

type MandateRow = {
  id: string;
  status: keyof typeof STATUS_LABELS;
  client_id: string | null;
  property_id: string | null;
  commission_model: string | null;
  commission_value: number | null;
  valid_from: string | null;
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

function MandatesPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [genFor, setGenFor] = useState<MandateRow | null>(null);
  const [previewFor, setPreviewFor] = useState<MandateRow | null>(null);
  const [form, setForm] = useState({
    client_id: "",
    property_id: "",
    commission_model: "percent",
    commission_value: "",
    valid_from: "",
    valid_until: "",
    notes: "",
  });

  const { data: mandates = [], isLoading } = useQuery<MandateRow[]>({
    queryKey: ["mandates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mandates")
        .select(
          "*, clients(full_name, address, postal_code, city), properties(title, address, postal_code, city, price)",
        )
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data as MandateRow[]) ?? [];
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
      const { error } = await supabase.from("mandates").insert({
        client_id: form.client_id || null,
        property_id: form.property_id || null,
        commission_model: form.commission_model,
        commission_value: form.commission_value ? Number(form.commission_value) : null,
        valid_from: form.valid_from || null,
        valid_until: form.valid_until || null,
        notes: form.notes.trim() || null,
        status: "draft",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Mandat erstellt");
      qc.invalidateQueries({ queryKey: ["mandates"] });
      setForm({
        client_id: "",
        property_id: "",
        commission_model: "percent",
        commission_value: "",
        valid_from: "",
        valid_until: "",
        notes: "",
      });
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from("mandates")
        .update({ status: status as "draft" })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["mandates"] }),
  });





  const filtered = useMemo(
    () =>
      mandates.filter((m) => {
        if (statusFilter !== "all" && m.status !== statusFilter) return false;
        if (search) {
          const c = m.clients?.full_name?.toLowerCase() ?? "";
          const p = m.properties?.title?.toLowerCase() ?? "";
          if (!c.includes(search.toLowerCase()) && !p.includes(search.toLowerCase())) return false;
        }
        return true;
      }),
    [mandates, statusFilter, search],
  );

  return (
    <>
      <PageHeader
        title="Mandate"
        description="Maklerverträge mit Eigentümern und Käufern"
        action={
          <Button onClick={() => setOpen(true)}>
            <Plus className="mr-1 h-4 w-4" />
            Neues Mandat
          </Button>
        }
      />

      <MandateWizard open={open} onOpenChange={setOpen} />

      <div className="mb-4 flex flex-wrap gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Mandate suchen…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
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
          title="Keine Mandate"
          description="Lege dein erstes Mandat an, um Provisionen und Vertragsdetails zu verwalten."
        />
      ) : (
        <div className="rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Eigentümer</TableHead>
                <TableHead>Immobilie</TableHead>
                <TableHead>Provision</TableHead>
                <TableHead>Gültigkeit</TableHead>
                <TableHead>Dokument</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Aktionen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <FileSignature className="h-4 w-4 text-muted-foreground" />
                      {m.clients?.full_name ?? "—"}
                    </div>
                  </TableCell>
                  <TableCell>{m.properties?.title ?? "—"}</TableCell>
                  <TableCell>
                    {m.commission_value != null
                      ? `${m.commission_value} ${m.commission_model === "percent" ? "%" : "CHF"}`
                      : "—"}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {m.valid_from ? formatDate(m.valid_from) : "—"} –{" "}
                    {m.valid_until ? formatDate(m.valid_until) : "offen"}
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm" onClick={() => setPreviewFor(m)}>
                      <Eye className="mr-1 h-3.5 w-3.5" />
                      {m.generated_document_id ? "Ansehen" : "Vorschau"}
                    </Button>
                  </TableCell>
                  <TableCell>
                    <Select value={m.status} onValueChange={(v) => updateStatus.mutate({ id: m.id, status: v })}>
                      <SelectTrigger className="h-8 w-36">
                        <Badge variant={STATUS_VARIANTS[m.status]}>
                          {STATUS_LABELS[m.status]}
                        </Badge>
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
                    <Button variant="outline" size="sm" onClick={() => setGenFor(m)}>
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
          kind="mandate"
          defaultClientId={genFor.client_id ?? undefined}
          defaultPropertyId={genFor.property_id ?? undefined}
          relatedType="mandate"
          relatedId={genFor.id}
          extraContext={{
            mandate: {
              commission_model: genFor.commission_model === "percent" ? "Prozent" : "Pauschal",
              commission_value:
                genFor.commission_value != null
                  ? `${genFor.commission_value}${genFor.commission_model === "percent" ? " %" : " CHF"}`
                  : null,
              valid_from: genFor.valid_from,
              valid_until: genFor.valid_until,
            },
          }}
        />
      )}

      {previewFor && (
        <DocumentPreviewDialog
          open={!!previewFor}
          onOpenChange={(o) => !o && setPreviewFor(null)}
          generatedDocumentId={previewFor.generated_document_id}
          kind="mandate"
          clientId={previewFor.client_id}
          propertyId={previewFor.property_id}
          extraContext={{
            mandate: {
              commission_model: previewFor.commission_model === "percent" ? "Prozent" : "Pauschal",
              commission_value:
                previewFor.commission_value != null
                  ? `${previewFor.commission_value}${previewFor.commission_model === "percent" ? " %" : " CHF"}`
                  : null,
              valid_from: previewFor.valid_from,
              valid_until: previewFor.valid_until,
            },
          }}
        />
      )}
    </>
  );
}
