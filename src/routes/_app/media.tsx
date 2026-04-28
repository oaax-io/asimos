import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Plus, Search, Trash2, Image as ImageIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { EmptyState } from "@/components/EmptyState";

export const Route = createFileRoute("/_app/media")({ component: MediaPage });

function MediaPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [propertyFilter, setPropertyFilter] = useState<string>("all");
  const [form, setForm] = useState({ property_id: "", file_url: "", title: "" });

  const { data: media = [], isLoading } = useQuery({
    queryKey: ["property-media"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("property_media")
        .select("*, properties(title, city)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: properties = [] } = useQuery({
    queryKey: ["properties-min"],
    queryFn: async () => (await supabase.from("properties").select("id, title").order("title")).data ?? [],
  });

  const create = useMutation({
    mutationFn: async () => {
      if (!form.property_id || !form.file_url) throw new Error("Immobilie und URL erforderlich");
      const { error } = await supabase.from("property_media").insert({
        property_id: form.property_id,
        file_url: form.file_url.trim(),
        title: form.title.trim() || null,
        file_type: "image",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Medium hinzugefügt");
      qc.invalidateQueries({ queryKey: ["property-media"] });
      setForm({ property_id: "", file_url: "", title: "" });
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("property_media").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Gelöscht");
      qc.invalidateQueries({ queryKey: ["property-media"] });
    },
  });

  const filtered = useMemo(() => media.filter((m) => {
    if (propertyFilter !== "all" && m.property_id !== propertyFilter) return false;
    if (search && !m.title?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }), [media, propertyFilter, search]);

  return (
    <>
      <PageHeader
        title="Mediathek"
        description="Bilder und Mediendateien zu allen Objekten"
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="mr-1 h-4 w-4" />Medium hinzufügen</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Neues Medium</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label>Immobilie</Label>
                  <Select value={form.property_id} onValueChange={(v) => setForm({ ...form, property_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Auswählen" /></SelectTrigger>
                    <SelectContent>
                      {properties.map((p) => <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Bild-URL</Label><Input value={form.file_url} onChange={(e) => setForm({ ...form, file_url: e.target.value })} placeholder="https://…" /></div>
                <div><Label>Titel (optional)</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
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
          <Input className="pl-9" placeholder="Medien suchen…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={propertyFilter} onValueChange={setPropertyFilter}>
          <SelectTrigger className="w-56"><SelectValue placeholder="Immobilie" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Immobilien</SelectItem>
            {properties.map((p) => <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="rounded-xl border bg-muted/20 p-4 text-sm text-muted-foreground">Wird geladen…</div>
      ) : filtered.length === 0 ? (
        <EmptyState title="Mediathek leer" description="Füge Bilder zu deinen Objekten hinzu, um sie hier zu sehen." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {filtered.map((m) => (
            <div key={m.id} className="group relative overflow-hidden rounded-xl border bg-card shadow-soft">
              <div className="aspect-square overflow-hidden bg-muted">
                {m.file_url ? (
                  <img src={m.file_url} alt={m.title ?? ""} className="h-full w-full object-cover transition group-hover:scale-105" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center"><ImageIcon className="h-8 w-8 text-muted-foreground" /></div>
                )}
              </div>
              <div className="p-3">
                <p className="truncate text-sm font-medium">{m.title ?? "Ohne Titel"}</p>
                {m.properties && (
                  <Link to="/properties/$id" params={{ id: m.property_id }} className="truncate text-xs text-muted-foreground hover:text-primary">
                    {(m.properties as { title: string }).title}
                  </Link>
                )}
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-2 top-2 bg-background/80 opacity-0 transition group-hover:opacity-100"
                onClick={() => remove.mutate(m.id)}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
