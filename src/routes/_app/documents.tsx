import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Plus, FileText, Download, Search, Trash2, Upload, ExternalLink } from "lucide-react";
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
  contract: "Vertrag",
  expose: "Exposé",
  id: "Ausweis",
  invoice: "Rechnung",
  energy_certificate: "Energieausweis",
  floor_plan: "Grundriss",
  bank_statement: "Kontoauszug",
  tax_document: "Steuerunterlage",
  other: "Sonstiges",
} as const;

const RELATED_LABELS: Record<string, string> = {
  client: "Kunde",
  property: "Immobilie",
  lead: "Lead",
  mandate: "Mandat",
  reservation: "Reservation",
  financing_profile: "Finanzierung",
};

function formatBytes(bytes: number | null | undefined) {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function DocumentsPage() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [relatedFilter, setRelatedFilter] = useState<string>("all");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({
    document_type: "other",
    related_type: "client",
    related_id: "",
    notes: "",
  });

  const { data: profile } = useQuery({
    queryKey: ["my-profile-role", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("user_role").eq("id", user!.id).maybeSingle();
      return data;
    },
  });
  const canDelete = profile?.user_role === "owner" || profile?.user_role === "admin";

  const { data: docs = [], isLoading } = useQuery({
    queryKey: ["documents"],
    queryFn: async () => {
      const { data, error } = await supabase.from("documents").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      const docs = data ?? [];
      const uploaderIds = Array.from(new Set(docs.map((d) => d.uploaded_by).filter(Boolean) as string[]));
      let uploaders: Record<string, string> = {};
      if (uploaderIds.length > 0) {
        const { data: profs } = await supabase.from("profiles").select("id, full_name").in("id", uploaderIds);
        uploaders = Object.fromEntries((profs ?? []).map((p) => [p.id, p.full_name ?? ""]));
      }
      return docs.map((d) => ({ ...d, uploader: d.uploaded_by ? { full_name: uploaders[d.uploaded_by] } : null }));
    },
  });

  const { data: clients = [] } = useQuery({
    queryKey: ["docs-clients"],
    queryFn: async () => (await supabase.from("clients").select("id, full_name").order("full_name")).data ?? [],
  });
  const { data: properties = [] } = useQuery({
    queryKey: ["docs-properties"],
    queryFn: async () => (await supabase.from("properties").select("id, title").order("title")).data ?? [],
  });
  const { data: leads = [] } = useQuery({
    queryKey: ["docs-leads"],
    queryFn: async () => (await supabase.from("leads").select("id, full_name").order("full_name")).data ?? [],
  });

  const relatedOptions = useMemo(() => {
    if (form.related_type === "client") return clients.map((c) => ({ id: c.id, label: c.full_name }));
    if (form.related_type === "property") return properties.map((p) => ({ id: p.id, label: p.title }));
    if (form.related_type === "lead") return leads.map((l) => ({ id: l.id, label: l.full_name }));
    return [];
  }, [form.related_type, clients, properties, leads]);

  const reset = () => {
    setFile(null);
    setForm({ document_type: "other", related_type: "client", related_id: "", notes: "" });
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const upload = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error("Bitte Datei auswählen");
      if (!form.related_id) throw new Error("Bitte Verknüpfung wählen");
      setUploading(true);
      const ext = file.name.split(".").pop() ?? "bin";
      const path = `${form.related_type}/${form.related_id}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("documents").upload(path, file, {
        contentType: file.type || "application/octet-stream",
        upsert: false,
      });
      if (upErr) throw upErr;
      const { data: signed } = await supabase.storage.from("documents").createSignedUrl(path, 60);
      const fileUrl = signed?.signedUrl ?? path;
      const { error } = await supabase.from("documents").insert({
        file_name: file.name,
        file_url: path,
        document_type: form.document_type as "other",
        related_type: form.related_type,
        related_id: form.related_id,
        notes: form.notes.trim() || null,
        uploaded_by: user?.id,
        size_bytes: file.size,
        mime_type: file.type || null,
      });
      if (error) throw error;
      return fileUrl;
    },
    onSuccess: () => {
      toast.success("Dokument hochgeladen");
      qc.invalidateQueries({ queryKey: ["documents"] });
      reset();
      setOpen(false);
      setUploading(false);
    },
    onError: (e: Error) => {
      toast.error(e.message);
      setUploading(false);
    },
  });

  const remove = useMutation({
    mutationFn: async (doc: { id: string; file_url: string }) => {
      if (doc.file_url && !doc.file_url.startsWith("http")) {
        await supabase.storage.from("documents").remove([doc.file_url]);
      }
      const { error } = await supabase.from("documents").delete().eq("id", doc.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Dokument gelöscht");
      qc.invalidateQueries({ queryKey: ["documents"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const openDocument = async (doc: { file_url: string }) => {
    if (doc.file_url.startsWith("http")) {
      window.open(doc.file_url, "_blank", "noopener");
      return;
    }
    const { data, error } = await supabase.storage.from("documents").createSignedUrl(doc.file_url, 300);
    if (error || !data) {
      toast.error("Konnte Datei nicht öffnen");
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener");
  };

  const filtered = useMemo(
    () =>
      docs.filter((d) => {
        if (typeFilter !== "all" && d.document_type !== typeFilter) return false;
        if (relatedFilter !== "all" && d.related_type !== relatedFilter) return false;
        if (search && !d.file_name?.toLowerCase().includes(search.toLowerCase())) return false;
        return true;
      }),
    [docs, typeFilter, relatedFilter, search],
  );

  return (
    <>
      <PageHeader
        title="Dokumente"
        description="Zentrale Ablage für Verträge, Ausweise und weitere Unterlagen"
        action={
          <Dialog
            open={open}
            onOpenChange={(o) => {
              setOpen(o);
              if (!o) reset();
            }}
          >
            <DialogTrigger asChild>
              <Button>
                <Upload className="mr-1 h-4 w-4" />
                Dokument hochladen
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Neues Dokument</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label>Datei</Label>
                  <Input
                    ref={fileInputRef}
                    type="file"
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  />
                  {file && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {file.name} · {formatBytes(file.size)}
                    </p>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Typ</Label>
                    <Select value={form.document_type} onValueChange={(v) => setForm({ ...form, document_type: v })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(TYPE_LABELS).map(([k, v]) => (
                          <SelectItem key={k} value={k}>
                            {v}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Verknüpft mit</Label>
                    <Select
                      value={form.related_type}
                      onValueChange={(v) => setForm({ ...form, related_type: v, related_id: "" })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(RELATED_LABELS).map(([k, v]) => (
                          <SelectItem key={k} value={k}>
                            {v}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label>Eintrag</Label>
                  {relatedOptions.length > 0 ? (
                    <Select value={form.related_id} onValueChange={(v) => setForm({ ...form, related_id: v })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Auswählen…" />
                      </SelectTrigger>
                      <SelectContent>
                        {relatedOptions.map((o) => (
                          <SelectItem key={o.id} value={o.id}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      value={form.related_id}
                      onChange={(e) => setForm({ ...form, related_id: e.target.value })}
                      placeholder="UUID des Eintrags"
                    />
                  )}
                </div>
                <div>
                  <Label>Notiz</Label>
                  <Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>
                  Abbrechen
                </Button>
                <Button onClick={() => upload.mutate()} disabled={uploading || !file}>
                  {uploading ? "Wird hochgeladen…" : "Hochladen"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="mb-4 flex flex-wrap gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Dokumente suchen…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Typ" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Typen</SelectItem>
            {Object.entries(TYPE_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>
                {v}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={relatedFilter} onValueChange={setRelatedFilter}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Verknüpfung" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Verknüpfungen</SelectItem>
            {Object.entries(RELATED_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>
                {v}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="rounded-xl border bg-muted/20 p-4 text-sm text-muted-foreground">
          Dokumente werden geladen…
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          title="Keine Dokumente"
          description="Lade dein erstes Dokument hoch, um es hier zu sehen."
        />
      ) : (
        <div className="rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Typ</TableHead>
                <TableHead>Verknüpfung</TableHead>
                <TableHead>Grösse</TableHead>
                <TableHead>Hochgeladen von</TableHead>
                <TableHead>Datum</TableHead>
                <TableHead className="text-right">Aktionen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((d) => {
                const uploader = (d as { uploader?: { full_name?: string } }).uploader;
                return (
                  <TableRow key={d.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <span className="truncate">{d.file_name ?? "Unbenannt"}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {TYPE_LABELS[d.document_type as keyof typeof TYPE_LABELS]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {RELATED_LABELS[d.related_type ?? ""] ?? d.related_type}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{formatBytes(d.size_bytes)}</TableCell>
                    <TableCell className="text-muted-foreground">{uploader?.full_name ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{formatDate(d.created_at)}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => openDocument(d)} title="Öffnen">
                        {d.file_url?.startsWith("http") ? (
                          <ExternalLink className="h-4 w-4" />
                        ) : (
                          <Download className="h-4 w-4" />
                        )}
                      </Button>
                      {canDelete && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => remove.mutate({ id: d.id, file_url: d.file_url })}
                          title="Löschen"
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </>
  );
}
