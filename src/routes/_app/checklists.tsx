import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Plus, ListChecks, ChevronRight, Trash2, Sparkles, Building2, Users } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { EmptyState } from "@/components/EmptyState";

export const Route = createFileRoute("/_app/checklists")({ component: ChecklistsPage });

type ChecklistRow = {
  id: string; title: string; related_type: string | null; related_id: string | null; template_key: string | null;
  checklist_items: Array<{ id: string; title: string; is_done: boolean; sort_order: number; assigned_to: string | null }>;
};
type Template = { id: string; key: string; title: string; description: string | null; default_related_type: string | null; items: string[] };

function ChecklistsPage() {
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [tplKey, setTplKey] = useState<string>("");
  const [form, setForm] = useState({ title: "", related_type: "property", related_id: "" });
  const [newItem, setNewItem] = useState("");

  const { data: lists = [], isLoading } = useQuery({
    queryKey: ["checklists"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("checklists")
        .select("*, checklist_items(id, title, is_done, sort_order, assigned_to)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as ChecklistRow[];
    },
  });

  const { data: templates = [] } = useQuery({
    queryKey: ["checklist_templates"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("checklist_templates").select("*").order("title");
      if (error) throw error;
      return (data ?? []).map((t: any) => ({ ...t, items: Array.isArray(t.items) ? t.items : [] })) as Template[];
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
  const { data: employees = [] } = useQuery({
    queryKey: ["employees"],
    queryFn: async () => (await supabase.from("profiles").select("id, full_name, email").eq("is_active", true)).data ?? [],
  });

  const createList = useMutation({
    mutationFn: async () => {
      const tpl = templates.find((t) => t.key === tplKey);
      const title = (form.title.trim() || tpl?.title || "").trim();
      if (!title) throw new Error("Titel oder Vorlage erforderlich");
      const payload: any = {
        title,
        related_type: form.related_type === "none" ? null : form.related_type,
        related_id: form.related_id || null,
        template_key: tpl?.key ?? null,
      };
      const { data: cl, error } = await supabase.from("checklists").insert(payload).select("id").single();
      if (error) throw error;
      if (tpl && tpl.items.length) {
        const rows = tpl.items.map((t, i) => ({ checklist_id: cl.id, title: t, sort_order: i }));
        const { error: e2 } = await supabase.from("checklist_items").insert(rows);
        if (e2) throw e2;
      }
    },
    onSuccess: () => {
      toast.success("Checkliste erstellt");
      qc.invalidateQueries({ queryKey: ["checklists"] });
      setForm({ title: "", related_type: "property", related_id: "" });
      setTplKey("");
      setCreateOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addItem = useMutation({
    mutationFn: async ({ checklist_id, title }: { checklist_id: string; title: string }) => {
      const { error } = await supabase.from("checklist_items").insert({ checklist_id, title });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["checklists"] }); setNewItem(""); },
  });

  const toggleItem = useMutation({
    mutationFn: async ({ id, is_done }: { id: string; is_done: boolean }) => {
      const { error } = await supabase.from("checklist_items").update({ is_done }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["checklists"] }),
  });

  const assignItem = useMutation({
    mutationFn: async ({ id, assigned_to }: { id: string; assigned_to: string | null }) => {
      const { error } = await supabase.from("checklist_items").update({ assigned_to }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["checklists"] }),
  });

  const removeItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("checklist_items").delete().eq("id", id);
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
    onSuccess: () => { toast.success("Checkliste gelöscht"); qc.invalidateQueries({ queryKey: ["checklists"] }); setOpenId(null); },
  });

  const activeList = lists.find((l) => l.id === openId);
  const relatedOptions = form.related_type === "client" ? clients : form.related_type === "property" ? properties : [];

  const startFromTemplate = (key: string) => {
    const tpl = templates.find((t) => t.key === key);
    if (!tpl) return;
    setTplKey(key);
    setForm({ title: tpl.title, related_type: tpl.default_related_type || "none", related_id: "" });
    setCreateOpen(true);
  };

  return (
    <>
      <PageHeader
        title="Checklisten"
        description="Standardisierte Abläufe für wiederkehrende Prozesse"
        action={<Button onClick={() => { setTplKey(""); setForm({ title: "", related_type: "property", related_id: "" }); setCreateOpen(true); }}><Plus className="mr-1 h-4 w-4" />Neue Checkliste</Button>}
      />

      <Tabs defaultValue="active" className="space-y-4">
        <TabsList>
          <TabsTrigger value="active">Aktive Checklisten</TabsTrigger>
          <TabsTrigger value="templates"><Sparkles className="mr-1 h-3 w-3" />Vorlagen</TabsTrigger>
        </TabsList>

        <TabsContent value="active">
          {isLoading ? (
            <div className="rounded-xl border bg-muted/20 p-4 text-sm text-muted-foreground">Wird geladen…</div>
          ) : lists.length === 0 ? (
            <EmptyState
              title="Keine Checklisten"
              description="Starte mit einer Vorlage oder erstelle eine eigene Checkliste."
              action={<Button variant="outline" onClick={() => { const el = document.querySelector('[value="templates"]') as HTMLElement | null; el?.click(); }}><Sparkles className="mr-1 h-4 w-4" />Vorlagen ansehen</Button>}
            />
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
                      <h3 className="mt-3 line-clamp-1 font-semibold">{l.title}</h3>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {l.template_key && <Badge variant="secondary" className="text-xs"><Sparkles className="mr-1 h-3 w-3" />Vorlage</Badge>}
                        {l.related_type && (
                          <Badge variant="outline" className="text-xs">
                            {l.related_type === "property" ? <Building2 className="mr-1 h-3 w-3" /> : l.related_type === "client" ? <Users className="mr-1 h-3 w-3" /> : null}
                            {l.related_type === "property" ? "Immobilie" : l.related_type === "client" ? "Kunde" : l.related_type}
                          </Badge>
                        )}
                      </div>
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
        </TabsContent>

        <TabsContent value="templates">
          {templates.length === 0 ? (
            <EmptyState title="Keine Vorlagen" description="Lade die Standardvorlagen neu." />
          ) : (
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
              {templates.map((t) => (
                <Card key={t.id} className="transition hover:shadow-soft">
                  <CardContent className="p-5">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 text-primary">
                      <Sparkles className="h-5 w-5" />
                    </div>
                    <h3 className="mt-3 font-semibold">{t.title}</h3>
                    {t.description && <p className="mt-1 text-xs text-muted-foreground">{t.description}</p>}
                    <p className="mt-2 text-xs text-muted-foreground">{t.items.length} Schritte</p>
                    <Button size="sm" className="mt-3 w-full" onClick={() => startFromTemplate(t.key)}>
                      <Plus className="mr-1 h-3 w-3" />Aus Vorlage erstellen
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Neue Checkliste</DialogTitle>
            <DialogDescription>Wähle optional eine Vorlage und verknüpfe die Checkliste mit Kunde oder Immobilie.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Vorlage</Label>
              <Select value={tplKey || "none"} onValueChange={(v) => {
                if (v === "none") { setTplKey(""); return; }
                const tpl = templates.find((t) => t.key === v);
                setTplKey(v);
                if (tpl) setForm((f) => ({ ...f, title: tpl.title, related_type: tpl.default_related_type || f.related_type }));
              }}>
                <SelectTrigger><SelectValue placeholder="Ohne Vorlage" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Ohne Vorlage</SelectItem>
                  {templates.map((t) => <SelectItem key={t.key} value={t.key}>{t.title}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Titel</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="z.B. Vorbereitung Verkauf Hauptstrasse 12" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Bezug</Label>
                <Select value={form.related_type} onValueChange={(v) => setForm({ ...form, related_type: v, related_id: "" })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="property">Immobilie</SelectItem>
                    <SelectItem value="client">Kunde</SelectItem>
                    <SelectItem value="none">Allgemein</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Verknüpfung</Label>
                <Select value={form.related_id || "none"} onValueChange={(v) => setForm({ ...form, related_id: v === "none" ? "" : v })} disabled={form.related_type === "none"}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">—</SelectItem>
                    {relatedOptions.map((o: any) => <SelectItem key={o.id} value={o.id}>{o.full_name || o.title}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Abbrechen</Button>
            <Button onClick={() => createList.mutate()} disabled={createList.isPending}>Erstellen</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail dialog */}
      <Dialog open={!!openId} onOpenChange={(o) => !o && setOpenId(null)}>
        <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between gap-3">
              <span>{activeList?.title}</span>
              {activeList && (
                <Button variant="ghost" size="icon" onClick={() => removeList.mutate(activeList.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              )}
            </DialogTitle>
            {activeList && (() => {
              const total = activeList.checklist_items.length;
              const done = activeList.checklist_items.filter((i) => i.is_done).length;
              const pct = total ? Math.round((done / total) * 100) : 0;
              return (
                <div className="mt-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{done} / {total} erledigt</span>
                    <span className="font-medium">{pct}%</span>
                  </div>
                  <Progress value={pct} className="mt-1 h-1.5" />
                </div>
              );
            })()}
          </DialogHeader>
          <div className="space-y-2">
            {activeList?.checklist_items
              ?.slice()
              .sort((a, b) => a.sort_order - b.sort_order)
              .map((it) => (
                <div key={it.id} className="flex items-center gap-3 rounded-lg border p-3">
                  <Checkbox checked={it.is_done} onCheckedChange={(c) => toggleItem.mutate({ id: it.id, is_done: !!c })} />
                  <span className={`flex-1 text-sm ${it.is_done ? "text-muted-foreground line-through" : ""}`}>{it.title}</span>
                  <Select value={it.assigned_to || "none"} onValueChange={(v) => assignItem.mutate({ id: it.id, assigned_to: v === "none" ? null : v })}>
                    <SelectTrigger className="h-8 w-36 text-xs"><SelectValue placeholder="Zuweisen" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Niemand</SelectItem>
                      {employees.map((e: any) => <SelectItem key={e.id} value={e.id}>{e.full_name || e.email}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Button variant="ghost" size="icon" onClick={() => removeItem.mutate(it.id)}><Trash2 className="h-3 w-3" /></Button>
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
            <Button onClick={() => activeList && newItem.trim() && addItem.mutate({ checklist_id: activeList.id, title: newItem.trim() })}>
              Hinzufügen
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
