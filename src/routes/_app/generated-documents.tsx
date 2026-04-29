import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FileText, Search, Eye, Send, Printer } from "lucide-react";
import { formatDate } from "@/lib/format";
import { SendDocumentDialog } from "@/components/documents/SendDocumentDialog";

export const Route = createFileRoute("/_app/generated-documents")({
  component: GeneratedDocumentsPage,
});

const TYPE_LABELS: Record<string, string> = {
  reservation: "Reservation",
  reservation_receipt: "Reservations-Quittung",
  mandate: "Mandat (exklusiv)",
  mandate_partial: "Mandat (teilexklusiv)",
  nda: "NDA",
  expose: "Exposé",
  contract: "Vertrag",
  other: "Sonstiges",
};

const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline"> = {
  draft: "outline",
  ready: "secondary",
  sent: "default",
  sent_for_signature: "default",
  signed: "default",
};

const STATUS_LABELS: Record<string, string> = {
  draft: "Entwurf",
  ready: "Bereit",
  sent: "Versendet",
  sent_for_signature: "Zur E-Signatur",
  signed: "Unterzeichnet",
};

const ESIGN_LABELS: Record<string, string> = {
  pending: "Ausstehend",
  delivered: "Zugestellt",
  signed: "Unterzeichnet",
  declined: "Abgelehnt",
  expired: "Abgelaufen",
};

type Row = {
  id: string;
  title: string | null;
  document_type: string | null;
  status: string;
  created_at: string;
  sent_at: string | null;
  esign_provider: string | null;
  esign_status: string | null;
  related_type: string | null;
  related_id: string | null;
  recipients: unknown;
  html_content: string | null;
};

function GeneratedDocumentsPage() {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [previewDoc, setPreviewDoc] = useState<Row | null>(null);
  const [sendDoc, setSendDoc] = useState<Row | null>(null);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["generated-documents"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("generated_documents")
        .select(
          "id, title, document_type, status, created_at, sent_at, esign_provider, esign_status, related_type, related_id, recipients, html_content",
        )
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (typeFilter !== "all" && r.document_type !== typeFilter) return false;
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (search) {
        const s = search.toLowerCase();
        if (!(r.title ?? "").toLowerCase().includes(s)) return false;
      }
      return true;
    });
  }, [rows, search, typeFilter, statusFilter]);

  const printDoc = (row: Row) => {
    if (!row.html_content) return;
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(row.html_content);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 300);
  };

  const recipientsOf = (row: Row): { name: string; email: string; role?: string }[] => {
    if (!Array.isArray(row.recipients)) return [];
    return row.recipients as { name: string; email: string; role?: string }[];
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Generierte Dokumente"
        description="Alle aus Vorlagen erstellten Dokumente – Status, Versand und E-Signatur."
      />

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Titel suchen…"
            className="pl-8"
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Typen</SelectItem>
            {Object.entries(TYPE_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Status</SelectItem>
            {Object.entries(STATUS_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Lädt…</p>
      ) : filtered.length === 0 ? (
        <EmptyState
          title="Noch keine generierten Dokumente"
          description="Erstelle ein Dokument aus einem Mandat, einer Reservation oder NDA."
        />
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Titel</TableHead>
                <TableHead>Typ</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>E-Signatur</TableHead>
                <TableHead>Empfänger</TableHead>
                <TableHead>Erstellt</TableHead>
                <TableHead>Versendet</TableHead>
                <TableHead className="text-right">Aktionen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r) => {
                const rec = recipientsOf(r);
                return (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.title ?? "—"}</TableCell>
                    <TableCell>{TYPE_LABELS[r.document_type ?? ""] ?? r.document_type ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[r.status] ?? "outline"}>
                        {STATUS_LABELS[r.status] ?? r.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {r.esign_provider ? (
                        <div className="flex flex-col text-xs">
                          <span className="font-medium">{r.esign_provider}</span>
                          <span className="text-muted-foreground">
                            {ESIGN_LABELS[r.esign_status ?? ""] ?? r.esign_status ?? "—"}
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {rec.length > 0 ? `${rec.length} · ${rec.map((x) => x.name).join(", ")}` : "—"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{formatDate(r.created_at)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {r.sent_at ? formatDate(r.sent_at) : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" title="Vorschau" onClick={() => setPreviewDoc(r)}>
                          <Eye className="size-4" />
                        </Button>
                        <Button variant="ghost" size="icon" title="Drucken / PDF" onClick={() => printDoc(r)}>
                          <Printer className="size-4" />
                        </Button>
                        <Button variant="ghost" size="icon" title="Senden" onClick={() => setSendDoc(r)}>
                          <Send className="size-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={!!previewDoc} onOpenChange={(o) => !o && setPreviewDoc(null)}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle>{previewDoc?.title ?? "Vorschau"}</DialogTitle>
          </DialogHeader>
          <iframe
            title="Dokument-Vorschau"
            srcDoc={previewDoc?.html_content ?? ""}
            className="h-[70vh] w-full rounded-md border bg-white"
          />
        </DialogContent>
      </Dialog>

      {sendDoc && (
        <SendDocumentDialog
          open={!!sendDoc}
          onOpenChange={(o) => !o && setSendDoc(null)}
          generatedDocumentId={sendDoc.id}
          documentTitle={sendDoc.title}
          initialRecipients={recipientsOf(sendDoc)}
        />
      )}
    </div>
  );
}
