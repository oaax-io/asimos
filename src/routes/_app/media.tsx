import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Search, Trash2, Image as ImageIcon, Upload, Star, ArrowUp, ArrowDown } from "lucide-react";
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

export const Route = createFileRoute("/_app/media")({ component: MediaPage });

type MediaItem = {
  id: string;
  property_id: string;
  file_url: string;
  file_name: string | null;
  file_type: string | null;
  title: string | null;
  description: string | null;
  is_cover: boolean;
  sort_order: number;
  created_at: string;
  properties?: { title: string; city: string | null } | null;
};

function getPublicUrl(path: string) {
  if (path.startsWith("http")) return path;
  return supabase.storage.from("media").getPublicUrl(path).data.publicUrl;
}

function detectKind(file: File): string {
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("video/")) return "video";
  if (file.name.toLowerCase().includes("grundriss") || file.name.toLowerCase().includes("floor")) return "floor_plan";
  return "other";
}

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

  const { data: media = [], isLoading } = useQuery<MediaItem[]>({
    queryKey: ["property-media"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("property_media")
        .select("*, properties(title, city)")
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data as MediaItem[]) ?? [];
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
          title: files.length === 1 && form.title ? form.title : null,
          description: files.length === 1 && form.description ? form.description : null,
          sort_order: maxSort + i + 1,
        });
        if (error) throw error;
      }
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
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["property-media"] }),
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
                    accept="image/*,video/*,.pdf,.tif,.tiff,.heic,.heif"
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
          {filtered.map((m) => {
            const url = getPublicUrl(m.file_url);
            const isVideo = m.file_type === "video";
            return (
              <div key={m.id} className="group relative overflow-hidden rounded-xl border bg-card shadow-soft">
                <div className="relative aspect-square overflow-hidden bg-muted">
                  {isVideo ? (
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
                </div>
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
                <div className="absolute right-2 top-12 flex flex-col gap-1 opacity-0 transition group-hover:opacity-100">
                  {!m.is_cover && (
                    <Button
                      variant="secondary"
                      size="icon"
                      className="h-7 w-7 bg-background/90"
                      title="Als Titelbild setzen"
                      onClick={() => setCover.mutate(m)}
                    >
                      <Star className="h-3.5 w-3.5" />
                    </Button>
                  )}
                  <Button
                    variant="secondary"
                    size="icon"
                    className="h-7 w-7 bg-background/90"
                    title="Nach oben"
                    onClick={() => moveSort.mutate({ item: m, dir: -1 })}
                  >
                    <ArrowUp className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="secondary"
                    size="icon"
                    className="h-7 w-7 bg-background/90"
                    title="Nach unten"
                    onClick={() => moveSort.mutate({ item: m, dir: 1 })}
                  >
                    <ArrowDown className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="secondary"
                    size="icon"
                    className="h-7 w-7 bg-background/90"
                    title="Löschen"
                    onClick={() => remove.mutate(m)}
                  >
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
