import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Plus, FileText, Download, Search, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { EmptyState } from "@/components/EmptyState";
import { formatDate } from "@/lib/format";

export const Route = createFileRoute("/_app/documents")({ component: DocumentsPage });

const TYPE_LABELS = {
  contract: "Vertrag", expose: "Exposé", id: "Ausweis", invoice: "Rechnung",
  energy_certificate: "Energieausweis", floor_plan: "Grundriss",
  bank_statement: "Kontoauszug", tax_document: "Steuerunterlage", other: "Sonstiges",
} as const;

function DocumentsPage() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [form, setForm] = useState({
    file_name: "", file_url: "", document_type: "other",
    related_type: "client", related_id: "", notes: "",
  });

  const { data: docs = [], isLoading } = useQuery({
    queryKey: ["documents"],
    queryFn: async () => {
      const { data, error } = await supabase.from("documents").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      if (!form.file_url.trim() || !form.related_id.trim()) throw new Error("URL und Verknüpfung erforderlich");
      const { error } = await supabase.from("documents").insert({
        file_name: form.file_name.trim() || form.file_url.split("/").pop() || "Dokument",
        file_url: form.file_url.trim(),
        document_type: form.document_type as "other",
        related_type: form.related_type,
        related_id: form.related_id.trim(),
        notes: form.notes.trim() || null,
        uploaded_by: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Dokument erfasst");
      qc.invalidateQueries({ queryKey: ["documents"] });
      setForm({ file_name: "", file_url: "", document_type: "other", related_type: "client", related_id: "", notes: "" });
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("documents").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Dokument gelöscht");
      qc.invalidateQueries({ queryKey: ["documents"] });
    },
  });

  const filtered = useMemo(() => docs.filter((d) => {
    if (typeFilter !== "all" && d.document_type !== typeFilter) return false;
    if (search && !d.file_name?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }), [docs, typeFilter, search]);

  return (
    <>
      <PageHeader
        title="Dokumente"
        description="Zentrale Ablage für Verträge, Ausweise und weitere Unterlagen"
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="mr-1 h-4 w-4" />Dokument erfassen</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Neues Dokument</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Dateiname</Label><Input value={form.file_name} onChange={(e) => setForm({ ...form, file_name: e.target.value })} placeholder="z.B. Mietvertrag-Mueller.pdf" /></div>
                <div><Label>Datei-URL</Label><Input value={form.file_url} onChange={(e) => setForm({ ...form, file_url: e.target.value })} placeholder="https://…" /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Typ</Label>
                    <Select value={form.document_type} onValueChange={(v) => setForm({ ...form, document_type: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(TYPE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Verknüpft mit</Label>
                    <Select value={form.related_type} onValueChange={(v) => setForm({ ...form, related_type: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="client">Kunde</SelectItem>
                        <SelectItem value="property">Immobilie</SelectItem>
                        <SelectItem value="lead">Lead</SelectItem>
                        <SelectItem value="mandate">Mandat</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div><Label>Verknüpfungs-ID</Label><Input value={form.related_id} onChange={(e) => setForm({ ...form, related_id: e.target.value })} placeholder="UUID des Kunden / Objekts" /></div>
                <div><Label>Notiz</Label><Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>Abbrechen</Button>
                <Button onClick={() => create.mutate()} disabled={create.isPending}>Speichern</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="mb-4 flex flex-wrap gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Dokumente suchen…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Typ" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Typen</SelectItem>
            {Object.entries(TYPE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="rounded-xl border bg-muted/20 p-4 text-sm text-muted-foreground">Dokumente werden geladen…</div>
      ) : filtered.length === 0 ? (
        <EmptyState title="Keine Dokumente" description="Lade dein erstes Dokument hoch oder verknüpfe eine externe URL." />
      ) : (
        <div className="rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Typ</TableHead>
                <TableHead>Verknüpft mit</TableHead>
                <TableHead>Datum</TableHead>
                <TableHead className="text-right">Aktionen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((d) => (
                <TableRow key={d.id}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      {d.file_name ?? "Unbenannt"}
                    </div>
                  </TableCell>
                  <TableCell><Badge variant="secondary">{TYPE_LABELS[d.document_type as keyof typeof TYPE_LABELS]}</Badge></TableCell>
                  <TableCell className="text-muted-foreground capitalize">{d.related_type}</TableCell>
                  <TableCell className="text-muted-foreground">{formatDate(d.created_at)}</TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" asChild>
                      <a href={d.file_url} target="_blank" rel="noopener noreferrer"><Download className="h-4 w-4" /></a>
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => remove.mutate(d.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </>
  );
}
