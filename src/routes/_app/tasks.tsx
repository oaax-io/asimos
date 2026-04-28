import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Plus, CheckCircle2, Circle, Clock, AlertCircle, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { EmptyState } from "@/components/EmptyState";
import { formatDateTime } from "@/lib/format";

export const Route = createFileRoute("/_app/tasks")({ component: TasksPage });

const STATUS_LABELS = { open: "Offen", in_progress: "In Arbeit", done: "Erledigt", cancelled: "Abgebrochen" } as const;
const PRIORITY_LABELS = { low: "Niedrig", normal: "Normal", high: "Hoch", urgent: "Dringend" } as const;

const STATUS_VARIANTS: Record<string, "default" | "secondary" | "outline"> = {
  open: "outline", in_progress: "default", done: "secondary", cancelled: "secondary",
};

function TasksPage() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [form, setForm] = useState({
    title: "", description: "", status: "open", priority: "normal", due_date: "",
  });

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ["tasks"],
    queryFn: async () => {
      const { data, error } = await supabase.from("tasks").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      if (!form.title.trim()) throw new Error("Titel ist erforderlich");
      const { error } = await supabase.from("tasks").insert({
        title: form.title.trim(),
        description: form.description.trim() || null,
        status: form.status as "open",
        priority: form.priority as "normal",
        due_date: form.due_date || null,
        created_by: user?.id,
        assigned_to: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Aufgabe erstellt");
      qc.invalidateQueries({ queryKey: ["tasks"] });
      setForm({ title: "", description: "", status: "open", priority: "normal", due_date: "" });
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("tasks").update({ status: status as "open" }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
  });

  const filtered = useMemo(() => tasks.filter((t) => {
    if (statusFilter !== "all" && t.status !== statusFilter) return false;
    if (search && !t.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }), [tasks, statusFilter, search]);

  return (
    <>
      <PageHeader
        title="Aufgaben"
        description="Persönliche und teamübergreifende To-dos"
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="mr-1 h-4 w-4" />Neue Aufgabe</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Neue Aufgabe</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Titel</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
                <div><Label>Beschreibung</Label><Textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Priorität</Label>
                    <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(PRIORITY_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Fällig am</Label>
                    <Input type="datetime-local" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
                  </div>
                </div>
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
          <Input className="pl-9" placeholder="Aufgaben suchen…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Status</SelectItem>
            {Object.entries(STATUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="rounded-xl border bg-muted/20 p-4 text-sm text-muted-foreground">Aufgaben werden geladen…</div>
      ) : filtered.length === 0 ? (
        <EmptyState
          title="Keine Aufgaben"
          description="Erstelle deine erste Aufgabe, um den Überblick über offene To-dos zu behalten."
        />
      ) : (
        <div className="grid gap-3">
          {filtered.map((t) => {
            const Icon = t.status === "done" ? CheckCircle2 : t.status === "in_progress" ? Clock : t.priority === "urgent" ? AlertCircle : Circle;
            return (
              <Card key={t.id} className="transition hover:shadow-soft">
                <CardContent className="flex items-start gap-3 p-4">
                  <button
                    type="button"
                    onClick={() => updateStatus.mutate({ id: t.id, status: t.status === "done" ? "open" : "done" })}
                    className="mt-0.5"
                  >
                    <Icon className={`h-5 w-5 ${t.status === "done" ? "text-success" : "text-muted-foreground"}`} />
                  </button>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className={`font-medium ${t.status === "done" ? "text-muted-foreground line-through" : ""}`}>{t.title}</h3>
                      <Badge variant={STATUS_VARIANTS[t.status]}>{STATUS_LABELS[t.status as keyof typeof STATUS_LABELS]}</Badge>
                      {t.priority !== "normal" && (
                        <Badge variant={t.priority === "urgent" ? "destructive" : "outline"}>
                          {PRIORITY_LABELS[t.priority as keyof typeof PRIORITY_LABELS]}
                        </Badge>
                      )}
                    </div>
                    {t.description && <p className="mt-1 text-sm text-muted-foreground">{t.description}</p>}
                    {t.due_date && (
                      <p className="mt-1 text-xs text-muted-foreground">Fällig: {formatDateTime(t.due_date)}</p>
                    )}
                  </div>
                  <Select value={t.status} onValueChange={(v) => updateStatus.mutate({ id: t.id, status: v })}>
                    <SelectTrigger className="h-8 w-32 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(STATUS_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
