import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Folder,
  FolderOpen,
  FileText,
  FileBadge,
  Download,
  ExternalLink,
  Search,
} from "lucide-react";
import { toast } from "sonner";
import { formatDate } from "@/lib/format";
import { EmptyState } from "@/components/EmptyState";

const CATEGORY_LABELS: Record<string, string> = {
  client: "Kunden",
  property: "Immobilien",
  lead: "Leads",
  mandate: "Mandate",
  reservation: "Reservationen",
  financing: "Finanzierungen",
  financing_profile: "Finanzierungen",
  other: "Sonstige",
};

type AnyDoc = {
  id: string;
  name: string;
  related_type: string | null;
  related_id: string | null;
  file_url: string | null;
  size_bytes: number | null;
  created_at: string;
  source: "uploaded" | "generated";
  badge?: string | null;
};

function formatBytes(bytes: number | null | undefined) {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function DocumentFolderView() {
  const [search, setSearch] = useState("");

  const { data: uploaded = [] } = useQuery({
    queryKey: ["folder-uploaded"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("documents")
        .select("id, file_name, related_type, related_id, file_url, size_bytes, created_at, document_type")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map<AnyDoc>((d) => ({
        id: d.id,
        name: d.file_name ?? "Unbenannt",
        related_type: d.related_type ?? null,
        related_id: d.related_id ?? null,
        file_url: d.file_url,
        size_bytes: d.size_bytes,
        created_at: d.created_at,
        source: "uploaded",
        badge: d.document_type ?? null,
      }));
    },
  });

  const { data: generated = [] } = useQuery({
    queryKey: ["folder-generated"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("generated_documents")
        .select("id, title, related_type, related_id, created_at, document_type, file_url")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map<AnyDoc>((d: any) => ({
        id: d.id,
        name: d.title ?? "Generiertes Dokument",
        related_type: d.related_type ?? null,
        related_id: d.related_id ?? null,
        file_url: d.file_url ?? null,
        size_bytes: null,
        created_at: d.created_at,
        source: "generated",
        badge: d.document_type ?? null,
      }));
    },
  });

  const all = useMemo(() => [...uploaded, ...generated], [uploaded, generated]);

  // collect related ids per type to resolve names
  const idsByType = useMemo(() => {
    const map: Record<string, Set<string>> = {};
    for (const d of all) {
      if (!d.related_type || !d.related_id) continue;
      const t = d.related_type === "financing_profile" ? "financing" : d.related_type;
      (map[t] ??= new Set()).add(d.related_id);
    }
    return map;
  }, [all]);

  const { data: nameMap = {} } = useQuery({
    queryKey: ["folder-names", Object.fromEntries(Object.entries(idsByType).map(([k, v]) => [k, [...v].sort()]))],
    queryFn: async () => {
      const result: Record<string, Record<string, string>> = {};
      const tasks: Promise<void>[] = [];
      const fetchSet = async (key: string, table: string, field: string) => {
        const ids = [...(idsByType[key] ?? [])];
        if (ids.length === 0) return;
        const { data } = await supabase.from(table as any).select(`id, ${field}`).in("id", ids);
        result[key] = Object.fromEntries((data ?? []).map((r: any) => [r.id, r[field] ?? "—"]));
      };
      tasks.push(fetchSet("client", "clients", "full_name"));
      tasks.push(fetchSet("property", "properties", "title"));
      tasks.push(fetchSet("lead", "leads", "full_name"));
      tasks.push(fetchSet("mandate", "mandates", "title"));
      tasks.push(fetchSet("reservation", "reservations", "id"));
      // financing dossiers - use client name via join would be heavy; just use id snippet
      const fIds = [...(idsByType["financing"] ?? [])];
      if (fIds.length) {
        const { data } = await supabase
          .from("financing_dossiers")
          .select("id, client_id")
          .in("id", fIds);
        const clientIds = (data ?? []).map((d: any) => d.client_id).filter(Boolean);
        let clientNames: Record<string, string> = {};
        if (clientIds.length) {
          const { data: cs } = await supabase.from("clients").select("id, full_name").in("id", clientIds);
          clientNames = Object.fromEntries((cs ?? []).map((c: any) => [c.id, c.full_name]));
        }
        result["financing"] = Object.fromEntries(
          (data ?? []).map((d: any) => [d.id, clientNames[d.client_id] ?? d.id.slice(0, 8)]),
        );
      }
      await Promise.all(tasks);
      return result;
    },
    enabled: all.length > 0,
  });

  // Group: category -> folderId -> docs[]
  const grouped = useMemo(() => {
    const out: Record<string, Record<string, { name: string; docs: AnyDoc[] }>> = {};
    const filtered = search
      ? all.filter((d) => d.name.toLowerCase().includes(search.toLowerCase()))
      : all;
    for (const d of filtered) {
      const rawType = d.related_type ?? "other";
      const type = rawType === "financing_profile" ? "financing" : rawType;
      const folderId = d.related_id ?? "unassigned";
      const names = (nameMap as Record<string, Record<string, string>>)[type] ?? {};
      const folderName = folderId === "unassigned"
        ? "Nicht zugeordnet"
        : names[folderId] ?? folderId.slice(0, 8);
      (out[type] ??= {});
      (out[type][folderId] ??= { name: folderName, docs: [] }).docs.push(d);
    }
    return out;
  }, [all, nameMap, search]);

  const openDoc = async (d: AnyDoc) => {
    if (!d.file_url) {
      toast.error("Keine Datei vorhanden");
      return;
    }
    if (d.file_url.startsWith("http")) {
      window.open(d.file_url, "_blank", "noopener");
      return;
    }
    const bucket = d.source === "generated" ? "generated-documents" : "documents";
    const { data, error } = await supabase.storage.from(bucket).createSignedUrl(d.file_url, 300);
    if (error || !data) {
      toast.error("Konnte Datei nicht öffnen");
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener");
  };

  const categories = Object.keys(grouped).sort((a, b) => {
    const order = ["client", "property", "lead", "mandate", "reservation", "financing", "other"];
    return order.indexOf(a) - order.indexOf(b);
  });

  return (
    <div className="space-y-4">
      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-9"
          placeholder="Dokumente in Ordnern suchen…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {categories.length === 0 ? (
        <EmptyState title="Keine Ordner" description="Sobald Dokumente verknüpft werden, erscheinen sie hier in Ordnern." />
      ) : (
        <Accordion type="multiple" defaultValue={categories.slice(0, 2)} className="space-y-2">
          {categories.map((cat) => {
            const folders = Object.entries(grouped[cat]).sort(([, a], [, b]) => a.name.localeCompare(b.name));
            const totalDocs = folders.reduce((s, [, f]) => s + f.docs.length, 0);
            return (
              <AccordionItem key={cat} value={cat} className="rounded-xl border bg-card px-4">
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center gap-2">
                    <FolderOpen className="h-4 w-4 text-primary" />
                    <span className="font-medium">{CATEGORY_LABELS[cat] ?? cat}</span>
                    <Badge variant="secondary">{folders.length} Ordner · {totalDocs} Dateien</Badge>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-2">
                    {folders.map(([fid, folder]) => (
                      <FolderRow key={fid} name={folder.name} docs={folder.docs} onOpen={openDoc} />
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      )}
    </div>
  );
}

function FolderRow({
  name,
  docs,
  onOpen,
}: {
  name: string;
  docs: AnyDoc[];
  onOpen: (d: AnyDoc) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card>
        <CollapsibleTrigger asChild>
          <CardContent className="flex cursor-pointer items-center gap-3 p-3 hover:bg-muted/40">
            {open ? <FolderOpen className="h-4 w-4 text-primary" /> : <Folder className="h-4 w-4 text-muted-foreground" />}
            <span className="flex-1 truncate text-sm font-medium">{name}</span>
            <Badge variant="outline">{docs.length}</Badge>
          </CardContent>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="divide-y border-t">
            {docs.map((d) => (
              <div key={`${d.source}-${d.id}`} className="flex items-center gap-3 px-4 py-2">
                {d.source === "generated" ? (
                  <FileBadge className="h-4 w-4 text-primary" />
                ) : (
                  <FileText className="h-4 w-4 text-muted-foreground" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">{d.name}</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    {d.badge && <Badge variant="secondary" className="text-[10px]">{d.badge}</Badge>}
                    <span>{formatDate(d.created_at)}</span>
                    {d.size_bytes ? <span>· {formatBytes(d.size_bytes)}</span> : null}
                  </div>
                </div>
                <Button variant="ghost" size="icon" onClick={() => onOpen(d)} title="Öffnen">
                  {d.file_url?.startsWith("http") ? (
                    <ExternalLink className="h-4 w-4" />
                  ) : (
                    <Download className="h-4 w-4" />
                  )}
                </Button>
              </div>
            ))}
          </div>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
