import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Search, Trash2, Image as ImageIcon, Upload, Star, ArrowUp, ArrowDown, FileText, HardDrive, ChevronLeft, ChevronRight, Download, X, Pencil, Check, Calendar, User as UserIcon, Building2, Folder, ArrowLeft, Copy } from "lucide-react";
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
import { toast } from "sonner";
import { EmptyState } from "@/components/EmptyState";
import { Badge } from "@/components/ui/badge";
import { convertUnsupportedImages } from "@/lib/image-convert";
import { extractPropertyImagePaths } from "@/lib/property-media";

export const Route = createFileRoute("/_app/media")({ component: MediaPage });

type MediaItem = {
  id: string;
  property_id: string;
  file_url: string;
  file_name: string | null;
  file_type: string | null;
  file_size: number | null;
  title: string | null;
  description: string | null;
  is_cover: boolean;
  sort_order: number;
  created_at: string;
  uploaded_by: string | null;
  properties?: { title: string; city: string | null } | null;
  uploader?: { full_name: string | null; email: string | null } | null;
};

function getPublicUrl(path: string) {
  if (path.startsWith("http")) return path;
  return supabase.storage.from("media").getPublicUrl(path).data.publicUrl;
}

async function syncPropertyImages(propertyId: string) {
  const { data, error } = await supabase
    .from("property_media")
    .select("file_url, file_type, sort_order, is_cover, created_at")
    .eq("property_id", propertyId);
  if (error) throw error;

  const { error: updateError } = await supabase
    .from("properties")
    .update({ images: extractPropertyImagePaths(data ?? []) })
    .eq("id", propertyId);
  if (updateError) throw updateError;
}

function detectKind(file: File): string {
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("video/")) return "video";
  if (file.name.toLowerCase().includes("grundriss") || file.name.toLowerCase().includes("floor")) return "floor_plan";
  return "other";
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

const MAX_STORAGE = 20 * 1024 * 1024 * 1024; // 20 GB

function MediaPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [propertyFilter, setPropertyFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [form, setForm] = useState({ property_id: "", title: "", description: "" });
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const [editingTitle, setEditingTitle] = useState<string | null>(null);

  const { data: media = [], isLoading } = useQuery<MediaItem[]>({
    queryKey: ["property-media"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("property_media")
        .select("*, properties(title, city)")
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: false });
      if (error) throw error;
      const items = (data as MediaItem[]) ?? [];
      // Background: fill missing file_size from storage metadata
      const missing = items.filter((m) => m.file_size == null && m.file_url && !m.file_url.startsWith("http"));
      if (missing.length > 0) {
        const folderMap = new Map<string, string[]>();
        for (const m of missing) {
          const folder = m.file_url.split("/")[0] ?? "";
          if (!folderMap.has(folder)) folderMap.set(folder, []);
          folderMap.get(folder)!.push(m.file_url);
        }
        for (const [folder, paths] of folderMap) {
          const { data: listData } = await supabase.storage.from("media").list(folder);
          if (listData) {
            for (const m of missing) {
              const fileName = m.file_url.split("/").pop();
              const meta = listData.find((f) => f.name === fileName);
              if (meta?.metadata?.size) {
                await supabase.from("property_media").update({ file_size: meta.metadata.size }).eq("id", m.id);
                m.file_size = meta.metadata.size;
              }
            }
          }
        }
      }
      // Fetch uploader profiles
      const uploaderIds = Array.from(new Set(items.map((m) => m.uploaded_by).filter((x): x is string => !!x)));
      if (uploaderIds.length > 0) {
        const { data: profs } = await supabase.from("profiles").select("id, full_name, email").in("id", uploaderIds);
        const map = new Map((profs ?? []).map((p) => [p.id, p]));
        for (const m of items) {
          if (m.uploaded_by) {
            const p = map.get(m.uploaded_by);
            if (p) m.uploader = { full_name: p.full_name, email: p.email };
          }
        }
      }
      return items;
    },
  });

  const { data: properties = [] } = useQuery({
    queryKey: ["properties-min"],
    queryFn: async () => (await supabase.from("properties").select("id, title").order("title")).data ?? [],
  });

  const reset = () => {
    setFiles([]);
    setForm({ property_id: "", title: "", description: "" });
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const upload = useMutation({
    mutationFn: async () => {
      if (!form.property_id) throw new Error("Bitte Immobilie wählen");
      if (files.length === 0) throw new Error("Bitte mindestens eine Datei auswählen");
      setUploading(true);
      const processed = await convertUnsupportedImages(files);
      const maxSort = Math.max(0, ...media.filter((m) => m.property_id === form.property_id).map((m) => m.sort_order));

      for (let i = 0; i < processed.length; i++) {
        const file = processed[i];
        const ext = file.name.split(".").pop() ?? "bin";
        const path = `${form.property_id}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage.from("media").upload(path, file, {
          contentType: file.type || "application/octet-stream",
          upsert: false,
        });
        if (upErr) throw upErr;

        const { error } = await supabase.from("property_media").insert({
          property_id: form.property_id,
          file_url: path,
          file_name: file.name,
          file_type: detectKind(file),
          file_size: file.size,
          title: files.length === 1 && form.title ? form.title : null,
          description: files.length === 1 && form.description ? form.description : null,
          sort_order: maxSort + i + 1,
        });
        if (error) throw error;
      }

      await syncPropertyImages(form.property_id);
    },
    onSuccess: () => {
      toast.success("Medien hochgeladen");
      qc.invalidateQueries({ queryKey: ["property-media"] });
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
    mutationFn: async (item: MediaItem) => {
      if (item.file_url && !item.file_url.startsWith("http")) {
        await supabase.storage.from("media").remove([item.file_url]);
      }
      const { error } = await supabase.from("property_media").delete().eq("id", item.id);
      if (error) throw error;
      await syncPropertyImages(item.property_id);
    },
    onSuccess: () => {
      toast.success("Gelöscht");
      qc.invalidateQueries({ queryKey: ["property-media"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const setCover = useMutation({
    mutationFn: async (item: MediaItem) => {
      await supabase.from("property_media").update({ is_cover: false }).eq("property_id", item.property_id);
      const { error } = await supabase.from("property_media").update({ is_cover: true }).eq("id", item.id);
      if (error) throw error;
      await syncPropertyImages(item.property_id);
    },
    onSuccess: () => {
      toast.success("Titelbild gesetzt");
      qc.invalidateQueries({ queryKey: ["property-media"] });
    },
  });

  const moveSort = useMutation({
    mutationFn: async ({ item, dir }: { item: MediaItem; dir: -1 | 1 }) => {
      const siblings = media.filter((m) => m.property_id === item.property_id);
      const idx = siblings.findIndex((m) => m.id === item.id);
      const target = siblings[idx + dir];
      if (!target) return;
      await supabase.from("property_media").update({ sort_order: target.sort_order }).eq("id", item.id);
      await supabase.from("property_media").update({ sort_order: item.sort_order }).eq("id", target.id);
      await syncPropertyImages(item.property_id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["property-media"] }),
  });

  const rename = useMutation({
    mutationFn: async ({ id, title }: { id: string; title: string }) => {
      // We only update the display title; file_url and file_name in storage remain unchanged → keine Datei geht verloren.
      const { error } = await supabase
        .from("property_media")
        .update({ title: title.trim() || null })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Umbenannt");
      qc.invalidateQueries({ queryKey: ["property-media"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeDuplicates = useMutation({
    mutationFn: async (propertyId: string) => {
      const items = media.filter((m) => m.property_id === propertyId);
      // Group by file_size + file_type (keep earliest created_at, remove the rest)
      const groups = new Map<string, MediaItem[]>();
      for (const m of items) {
        if (m.file_size == null) continue;
        const key = `${m.file_type ?? ""}::${m.file_size}`;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push(m);
      }
      const toRemove: MediaItem[] = [];
      for (const group of groups.values()) {
        if (group.length < 2) continue;
        const sorted = [...group].sort(
          (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
        );
        // Keep first; remove rest. But prefer to keep the cover if any.
        const coverIdx = sorted.findIndex((m) => m.is_cover);
        const keepIdx = coverIdx >= 0 ? coverIdx : 0;
        sorted.forEach((m, i) => {
          if (i !== keepIdx) toRemove.push(m);
        });
      }
      if (toRemove.length === 0) return 0;
      const paths = toRemove
        .map((m) => m.file_url)
        .filter((p) => p && !p.startsWith("http"));
      if (paths.length > 0) {
        await supabase.storage.from("media").remove(paths);
      }
      const { error } = await supabase
        .from("property_media")
        .delete()
        .in("id", toRemove.map((m) => m.id));
      if (error) throw error;
      await syncPropertyImages(propertyId);
      return toRemove.length;
    },
    onSuccess: (count) => {
      if (count === 0) toast.info("Keine Duplikate gefunden");
      else toast.success(`${count} Duplikat(e) entfernt`);
      qc.invalidateQueries({ queryKey: ["property-media"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = useMemo(
    () =>
      media.filter((m) => {
        if (propertyFilter !== "all" && m.property_id !== propertyFilter) return false;
        if (typeFilter !== "all" && m.file_type !== typeFilter) return false;
        if (search) {
          const q = search.toLowerCase();
          if (!m.title?.toLowerCase().includes(q) && !m.file_name?.toLowerCase().includes(q)) return false;
        }
        return true;
      }),
    [media, propertyFilter, typeFilter, search],
  );

  return (
    <>
      <PageHeader
        title="Mediathek"
        description="Bilder, Videos und Grundrisse für alle Objekte"
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
                Medien hochladen
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Neue Medien</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
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
                <div>
                  <Label>Dateien</Label>
                  <Input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,video/*,.tif,.tiff,.heic,.heif"
                    multiple
                    onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
                  />
                  {files.length > 0 && (
                    <p className="mt-1 text-xs text-muted-foreground">{files.length} Datei(en) ausgewählt</p>
                  )}
                </div>
                {files.length === 1 && (
                  <>
                    <div>
                      <Label>Titel (optional)</Label>
                      <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
                    </div>
                    <div>
                      <Label>Beschreibung (optional)</Label>
                      <Textarea
                        rows={2}
                        value={form.description}
                        onChange={(e) => setForm({ ...form, description: e.target.value })}
                      />
                    </div>
                  </>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>
                  Abbrechen
                </Button>
                <Button onClick={() => upload.mutate()} disabled={uploading || files.length === 0}>
                  {uploading ? "Wird hochgeladen…" : "Hochladen"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      {/* Storage usage */}
      {(() => {
        const used = media.reduce((sum, m) => sum + (m.file_size ?? 0), 0);
        const pct = Math.min(100, Math.round((used / MAX_STORAGE) * 100));
        return (
          <div className="mb-4 flex items-center gap-4 rounded-xl border bg-card p-3 shadow-soft">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <HardDrive className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="mb-1 flex items-center justify-between text-sm">
                <span className="font-medium text-foreground">Speicherverbrauch</span>
                <span className="text-muted-foreground">
                  {formatBytes(used)} / {formatBytes(MAX_STORAGE)} ({pct}%)
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          </div>
        );
      })()}

      <div className="mb-4 flex flex-wrap gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Medien suchen…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={propertyFilter} onValueChange={setPropertyFilter}>
          <SelectTrigger className="w-56">
            <SelectValue placeholder="Immobilie" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Immobilien</SelectItem>
            {properties.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Typ" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Typen</SelectItem>
            <SelectItem value="image">Bilder</SelectItem>
            <SelectItem value="video">Videos</SelectItem>
            <SelectItem value="floor_plan">Grundrisse</SelectItem>
            <SelectItem value="other">Sonstiges</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="rounded-xl border bg-muted/20 p-4 text-sm text-muted-foreground">Wird geladen…</div>
      ) : filtered.length === 0 ? (
        <EmptyState
          title="Mediathek leer"
          description="Lade Bilder, Videos oder Grundrisse zu deinen Objekten hoch."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {filtered.map((m, idx) => {
            const url = getPublicUrl(m.file_url);
            const isVideo = m.file_type === "video";
            const isPdf = (m.file_name ?? m.file_url ?? "").toLowerCase().endsWith(".pdf");
            return (
              <div key={m.id} className="group relative overflow-hidden rounded-xl border bg-card shadow-soft">
                <button
                  type="button"
                  onClick={() => setViewerIndex(idx)}
                  className="relative block aspect-square w-full overflow-hidden bg-muted text-left"
                >
                  {isPdf ? (
                    <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-muted/60 text-muted-foreground transition group-hover:bg-muted">
                      <FileText className="h-10 w-10" />
                      <span className="text-xs font-medium">PDF öffnen</span>
                    </div>
                  ) : isVideo ? (
                    <video src={url} className="h-full w-full object-cover" muted />
                  ) : url ? (
                    <img
                      src={url}
                      alt={m.title ?? m.file_name ?? ""}
                      className="h-full w-full object-cover transition group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <ImageIcon className="h-8 w-8 text-muted-foreground" />
                    </div>
                  )}
                  {m.is_cover && (
                    <Badge className="absolute left-2 top-2 bg-primary text-primary-foreground">
                      <Star className="mr-1 h-3 w-3" />
                      Cover
                    </Badge>
                  )}
                  {m.file_type && m.file_type !== "image" && (
                    <Badge variant="secondary" className="absolute right-2 top-2 capitalize">
                      {m.file_type === "floor_plan" ? "Grundriss" : m.file_type}
                    </Badge>
                  )}
                </button>
                <div className="p-3">
                  <p className="truncate text-sm font-medium">{m.title ?? m.file_name ?? "Ohne Titel"}</p>
                  {m.properties && (
                    <Link
                      to="/properties/$id"
                      params={{ id: m.property_id }}
                      className="truncate text-xs text-muted-foreground hover:text-primary"
                    >
                      {m.properties.title}
                    </Link>
                  )}
                </div>
                <div className="absolute right-2 top-12 flex flex-col gap-1.5 opacity-0 transition group-hover:opacity-100">
                  {!m.is_cover && (
                    <Button
                      variant="secondary"
                      size="icon"
                      className="h-8 w-8 bg-card/95 text-foreground border border-border shadow-md backdrop-blur-sm hover:bg-primary hover:text-primary-foreground transition-colors"
                      title="Als Titelbild setzen"
                      onClick={() => setCover.mutate(m)}
                    >
                      <Star className="h-3.5 w-3.5" />
                    </Button>
                  )}
                  <Button
                    variant="secondary"
                    size="icon"
                    className="h-8 w-8 bg-card/95 text-foreground border border-border shadow-md backdrop-blur-sm hover:bg-primary hover:text-primary-foreground transition-colors"
                    title="Nach oben"
                    onClick={() => moveSort.mutate({ item: m, dir: -1 })}
                  >
                    <ArrowUp className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="secondary"
                    size="icon"
                    className="h-8 w-8 bg-card/95 text-foreground border border-border shadow-md backdrop-blur-sm hover:bg-primary hover:text-primary-foreground transition-colors"
                    title="Nach unten"
                    onClick={() => moveSort.mutate({ item: m, dir: 1 })}
                  >
                    <ArrowDown className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="secondary"
                    size="icon"
                    className="h-8 w-8 bg-card/95 text-foreground border border-border shadow-md backdrop-blur-sm hover:bg-primary hover:text-primary-foreground transition-colors"
                    title="Umbenennen"
                    onClick={() => {
                      const next = window.prompt("Neuer Titel", m.title ?? m.file_name ?? "");
                      if (next !== null) rename.mutate({ id: m.id, title: next });
                    }}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="secondary"
                    size="icon"
                    className="h-8 w-8 bg-card/95 text-foreground border border-border shadow-md backdrop-blur-sm hover:bg-destructive hover:text-destructive-foreground transition-colors"
                    title="Löschen"
                    onClick={() => remove.mutate(m)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Viewer / Lightbox */}
      {viewerIndex !== null && filtered[viewerIndex] && (() => {
        const current = filtered[viewerIndex];
        const url = getPublicUrl(current.file_url);
        const isVideo = current.file_type === "video";
        const isPdf = (current.file_name ?? current.file_url ?? "").toLowerCase().endsWith(".pdf");
        const goPrev = () => setViewerIndex((i) => (i === null ? null : (i - 1 + filtered.length) % filtered.length));
        const goNext = () => setViewerIndex((i) => (i === null ? null : (i + 1) % filtered.length));
        return (
          <div
            className="fixed inset-0 z-50 flex flex-col bg-background/95 backdrop-blur-sm"
            onKeyDown={(e) => {
              if (e.key === "Escape") setViewerIndex(null);
              if (e.key === "ArrowLeft") goPrev();
              if (e.key === "ArrowRight") goNext();
            }}
            tabIndex={-1}
            ref={(el) => el?.focus()}
          >
            <div className="flex items-center justify-between gap-3 border-b bg-card/80 px-4 py-3">
              <div className="min-w-0 flex-1">
                {editingTitle !== null ? (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      rename.mutate({ id: current.id, title: editingTitle });
                      setEditingTitle(null);
                    }}
                    className="flex items-center gap-2"
                  >
                    <Input
                      autoFocus
                      value={editingTitle}
                      onChange={(e) => setEditingTitle(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Escape") setEditingTitle(null); }}
                      className="h-8 max-w-md"
                    />
                    <Button type="submit" size="icon" variant="secondary" className="h-8 w-8" title="Speichern">
                      <Check className="h-4 w-4" />
                    </Button>
                    <Button type="button" size="icon" variant="ghost" className="h-8 w-8" title="Abbrechen" onClick={() => setEditingTitle(null)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </form>
                ) : (
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium">{current.title ?? current.file_name ?? "Ohne Titel"}</p>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 shrink-0"
                      title="Umbenennen"
                      onClick={() => setEditingTitle(current.title ?? current.file_name ?? "")}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <span>{viewerIndex + 1} / {filtered.length}</span>
                  {current.properties && (
                    <Link
                      to="/properties/$id"
                      params={{ id: current.property_id }}
                      className="inline-flex items-center gap-1 hover:text-primary"
                    >
                      <Building2 className="h-3 w-3" />
                      {current.properties.title}
                    </Link>
                  )}
                  <span className="inline-flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {new Date(current.created_at).toLocaleString("de-CH", { dateStyle: "medium", timeStyle: "short" })}
                  </span>
                  {(current.uploader?.full_name || current.uploader?.email) && (
                    <span className="inline-flex items-center gap-1">
                      <UserIcon className="h-3 w-3" />
                      {current.uploader.full_name ?? current.uploader.email}
                    </span>
                  )}
                  {current.file_size != null && <span>{formatBytes(current.file_size)}</span>}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button asChild variant="outline" size="sm">
                  <a href={url} download={current.file_name ?? undefined} target="_blank" rel="noreferrer">
                    <Download className="mr-1 h-4 w-4" /> Herunterladen
                  </a>
                </Button>
                <Button variant="ghost" size="icon" onClick={() => setViewerIndex(null)} title="Schließen">
                  <X className="h-5 w-5" />
                </Button>
              </div>
            </div>
            <div className="relative flex flex-1 items-center justify-center overflow-hidden p-4">
              <Button
                variant="secondary"
                size="icon"
                className="absolute left-4 top-1/2 z-10 -translate-y-1/2 rounded-full shadow-lg"
                onClick={goPrev}
                title="Vorheriges"
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <div className="flex h-full w-full max-w-6xl items-center justify-center">
                {isPdf ? (
                  <iframe src={url} className="h-full w-full rounded-lg border bg-white" title={current.file_name ?? "PDF"} />
                ) : isVideo ? (
                  <video src={url} controls className="max-h-full max-w-full rounded-lg" />
                ) : (
                  <img src={url} alt={current.title ?? current.file_name ?? ""} className="max-h-full max-w-full rounded-lg object-contain" />
                )}
              </div>
              <Button
                variant="secondary"
                size="icon"
                className="absolute right-4 top-1/2 z-10 -translate-y-1/2 rounded-full shadow-lg"
                onClick={goNext}
                title="Nächstes"
              >
                <ChevronRight className="h-5 w-5" />
              </Button>
            </div>
          </div>
        );
      })()}
    </>
  );
}
