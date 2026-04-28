import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Plus, ListChecks, ChevronRight, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { EmptyState } from "@/components/EmptyState";

export const Route = createFileRoute("/_app/checklists")({ component: ChecklistsPage });

function ChecklistsPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [form, setForm] = useState({ title: "", related_type: "property", related_id: "" });
  const [newItem, setNewItem] = useState("");

  const { data: lists = [], isLoading } = useQuery({
    queryKey: ["checklists"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("checklists")
        .select("*, checklist_items(id, title, is_done, sort_order)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Array<{
        id: string; title: string; related_type: string | null; related_id: string | null;
        checklist_items: Array<{ id: string; title: string; is_done: boolean; sort_order: number }>;
      }>;
    },
  });

  const createList = useMutation({
    mutationFn: async () => {
      if (!form.title.trim()) throw new Error("Titel erforderlich");
      const { error } = await supabase.from("checklists").insert({
        title: form.title.trim(),
        related_type: form.related_type || null,
        related_id: form.related_id.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Checkliste erstellt");
      qc.invalidateQueries({ queryKey: ["checklists"] });
      setForm({ title: "", related_type: "property", related_id: "" });
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addItem = useMutation({
    mutationFn: async ({ checklist_id, title }: { checklist_id: string; title: string }) => {
      const { error } = await supabase.from("checklist_items").insert({ checklist_id, title });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["checklists"] });
      setNewItem("");
    },
  });

  const toggleItem = useMutation({
    mutationFn: async ({ id, is_done }: { id: string; is_done: boolean }) => {
      const { error } = await supabase.from("checklist_items").update({ is_done }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["checklists"] }),
  });

  const removeList = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from("checklist_items").delete().eq("checklist_id", id);
      const { error } = await supabase.from("checklists").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Checkliste gelöscht");
      qc.invalidateQueries({ queryKey: ["checklists"] });
      setOpenId(null);
    },
  });

  const activeList = lists.find((l) => l.id === openId);

  return (
    <>
      <PageHeader
        title="Checklisten"
        description="Intelligente Abläufe für wiederkehrende Prozesse"
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="mr-1 h-4 w-4" />Neue Checkliste</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Neue Checkliste</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Titel</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="z.B. Vorbereitung Verkauf" /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Bezug</Label>
                    <Select value={form.related_type} onValueChange={(v) => setForm({ ...form, related_type: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="property">Immobilie</SelectItem>
                        <SelectItem value="client">Kunde</SelectItem>
                        <SelectItem value="mandate">Mandat</SelectItem>
                        <SelectItem value="general">Allgemein</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div><Label>Bezugs-ID (optional)</Label><Input value={form.related_id} onChange={(e) => setForm({ ...form, related_id: e.target.value })} /></div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>Abbrechen</Button>
                <Button onClick={() => createList.mutate()} disabled={createList.isPending}>Erstellen</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      {isLoading ? (
        <div className="rounded-xl border bg-muted/20 p-4 text-sm text-muted-foreground">Wird geladen…</div>
      ) : lists.length === 0 ? (
        <EmptyState title="Keine Checklisten" description="Erstelle deine erste Checkliste, um Prozesse zu standardisieren." />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {lists.map((l) => {
            const total = l.checklist_items?.length ?? 0;
            const done = l.checklist_items?.filter((i) => i.is_done).length ?? 0;
            const pct = total ? Math.round((done / total) * 100) : 0;
            return (
              <Card key={l.id} className="cursor-pointer transition hover:shadow-soft" onClick={() => setOpenId(l.id)}>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent text-primary">
                      <ListChecks className="h-5 w-5" />
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <h3 className="mt-3 font-semibold">{l.title}</h3>
                  <p className="text-xs capitalize text-muted-foreground">{l.related_type ?? "—"}</p>
                  <div className="mt-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">{done} / {total}</span>
                      <span className="font-medium">{pct}%</span>
                    </div>
                    <Progress value={pct} className="mt-1 h-1.5" />
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={!!openId} onOpenChange={(o) => !o && setOpenId(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between gap-3">
              <span>{activeList?.title}</span>
              {activeList && (
                <Button variant="ghost" size="icon" onClick={() => removeList.mutate(activeList.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            {activeList?.checklist_items
              ?.sort((a, b) => a.sort_order - b.sort_order)
              .map((it) => (
                <div key={it.id} className="flex items-center gap-3 rounded-lg border p-3">
                  <Checkbox
                    checked={it.is_done}
                    onCheckedChange={(c) => toggleItem.mutate({ id: it.id, is_done: !!c })}
                  />
                  <span className={it.is_done ? "text-muted-foreground line-through" : ""}>{it.title}</span>
                </div>
              ))}
            {activeList && activeList.checklist_items.length === 0 && (
              <p className="text-sm text-muted-foreground">Noch keine Punkte.</p>
            )}
          </div>
          <div className="flex gap-2">
            <Input
              value={newItem}
              onChange={(e) => setNewItem(e.target.value)}
              placeholder="Neuer Punkt"
              onKeyDown={(e) => {
                if (e.key === "Enter" && newItem.trim() && activeList) {
                  addItem.mutate({ checklist_id: activeList.id, title: newItem.trim() });
                }
              }}
            />
            <Button
              onClick={() => activeList && newItem.trim() && addItem.mutate({ checklist_id: activeList.id, title: newItem.trim() })}
            >
              Hinzufügen
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
