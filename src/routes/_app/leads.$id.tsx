import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  ArrowLeft, Mail, Phone, Calendar, MessageSquare, CheckSquare, Activity,
  ArrowRight, Pencil, Trash2, Plus, RefreshCw, User as UserIcon,
} from "lucide-react";
import { leadStatusLabels, leadStatuses, type LeadStatus, formatDate, formatDateTime, apptTypeLabels } from "@/lib/format";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { ConvertLeadDialog } from "@/components/leads/ConvertLeadDialog";

export const Route = createFileRoute("/_app/leads/$id")({ component: LeadDetail });

const UNASSIGNED = "__unassigned__";

function LeadDetail() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { user } = useAuth();

  const leadQuery = useQuery({
    queryKey: ["lead", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("leads").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("Lead nicht gefunden");
      return data;
    },
  });

  const employeesQuery = useQuery({
    queryKey: ["employees"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id, full_name, email").eq("is_active", true).order("full_name");
      return data ?? [];
    },
  });

  const tasksQuery = useQuery({
    queryKey: ["lead_tasks", id],
    queryFn: async () => {
      const { data } = await supabase.from("tasks").select("*")
        .eq("related_type", "lead").eq("related_id", id).order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const apptsQuery = useQuery({
    queryKey: ["lead_appointments", id],
    queryFn: async () => {
      // Appointments don't have lead_id; use related via activity. We track via notes for now.
      const { data } = await supabase.from("appointments").select("*")
        .eq("client_id", id).order("starts_at", { ascending: false });
      return data ?? [];
    },
  });

  const activityQuery = useQuery({
    queryKey: ["lead_activity", id],
    queryFn: async () => {
      const { data } = await supabase.from("activity_logs").select("*")
        .eq("related_type", "lead").eq("related_id", id)
        .order("created_at", { ascending: false }).limit(50);
      return data ?? [];
    },
  });

  const employees = employeesQuery.data ?? [];
  const employeeName = (uid: string | null) => {
    if (!uid) return "Niemand";
    const p = employees.find((e: any) => e.id === uid);
    return p?.full_name ?? p?.email ?? "—";
  };

  const updateStatus = useMutation({
    mutationFn: async (status: LeadStatus) => {
      const { error } = await supabase.from("leads").update({ status }).eq("id", id);
      if (error) throw error;
      await supabase.from("activity_logs").insert({
        actor_id: user?.id ?? null, action: `Status auf "${leadStatusLabels[status]}" geändert`,
        related_type: "lead", related_id: id,
      });
    },
    onSuccess: () => {
      toast.success("Status aktualisiert");
      qc.invalidateQueries({ queryKey: ["lead", id] });
      qc.invalidateQueries({ queryKey: ["lead_activity", id] });
    },
  });

  const [convertOpen, setConvertOpen] = useState(false);

  const del = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("leads").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Lead gelöscht"); navigate({ to: "/leads" }); },
    onError: (e: any) => toast.error(e.message),
  });

  if (leadQuery.isLoading) return <div className="p-6 text-sm text-muted-foreground">Lädt…</div>;
  if (leadQuery.isError || !leadQuery.data) {
    return (
      <div className="space-y-4 p-6">
        <Button variant="ghost" asChild><Link to="/leads"><ArrowLeft className="mr-1 h-4 w-4" />Zurück</Link></Button>
        <Card><CardContent className="p-6">
          <h2 className="font-display text-lg font-semibold">Lead konnte nicht geladen werden</h2>
          <p className="mt-1 text-sm text-muted-foreground">{(leadQuery.error as any)?.message ?? "Unbekannter Fehler"}</p>
          <Button className="mt-4" onClick={() => leadQuery.refetch()}><RefreshCw className="mr-1.5 h-4 w-4" />Erneut versuchen</Button>
        </CardContent></Card>
      </div>
    );
  }

  const lead = leadQuery.data;
  const tasks = tasksQuery.data ?? [];
  const openTasks = tasks.filter((t: any) => t.status !== "done");
  const appts = apptsQuery.data ?? [];
  const activity = activityQuery.data ?? [];

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <Button variant="ghost" asChild>
          <Link to="/leads"><ArrowLeft className="mr-1 h-4 w-4" />Zurück</Link>
        </Button>
        <div className="flex gap-2">
          <EditLeadDialog lead={lead} employees={employees} onSaved={() => {
            qc.invalidateQueries({ queryKey: ["lead", id] });
            qc.invalidateQueries({ queryKey: ["lead_activity", id] });
          }} />
          {lead.status !== "converted" && (
            <Button onClick={() => setConvertOpen(true)}>
              <ArrowRight className="mr-1.5 h-4 w-4" />Zu Kunde konvertieren
            </Button>
          )}
          <ConvertLeadDialog
            lead={lead}
            open={convertOpen}
            onOpenChange={setConvertOpen}
            onConverted={(clientId) => navigate({ to: "/clients/$id", params: { id: clientId } })}
          />

          <Button variant="outline" size="icon" onClick={() => { if (confirm("Wirklich löschen?")) del.mutate(); }}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Hero */}
      <div className="mb-6 rounded-2xl border bg-gradient-to-br from-primary/5 via-background to-background p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary">Lead</Badge>
              <Select value={lead.status} onValueChange={(v) => updateStatus.mutate(v as LeadStatus)}>
                <SelectTrigger className="h-7 w-[160px] text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {leadStatuses.map((s) => <SelectItem key={s} value={s}>{leadStatusLabels[s]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <h1 className="mt-2 font-display text-3xl font-bold">{lead.full_name}</h1>
            <div className="mt-3 flex flex-wrap gap-4 text-sm text-muted-foreground">
              {lead.email && <a href={`mailto:${lead.email}`} className="flex items-center gap-1.5 hover:text-primary"><Mail className="h-4 w-4" />{lead.email}</a>}
              {lead.phone && <a href={`tel:${lead.phone}`} className="flex items-center gap-1.5 hover:text-primary"><Phone className="h-4 w-4" />{lead.phone}</a>}
              {lead.source && <span>Quelle: {lead.source}</span>}
              <span className="flex items-center gap-1.5"><UserIcon className="h-4 w-4" />{employeeName(lead.assigned_to)}</span>
              <span className="flex items-center gap-1.5"><Calendar className="h-4 w-4" />Erstellt {formatDate(lead.created_at)}</span>
            </div>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat icon={<CheckSquare className="h-4 w-4" />} label="Offene Aufgaben" value={openTasks.length} />
          <Stat icon={<Calendar className="h-4 w-4" />} label="Termine" value={appts.length} />
          <Stat icon={<Activity className="h-4 w-4" />} label="Aktivitäten" value={activity.length} />
          <Stat icon={<MessageSquare className="h-4 w-4" />} label="Notizen" value={lead.notes ? "✓" : "—"} />
        </div>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Übersicht</TabsTrigger>
          <TabsTrigger value="tasks"><CheckSquare className="mr-1.5 h-4 w-4" />Aufgaben{openTasks.length > 0 && <Badge variant="secondary" className="ml-2">{openTasks.length}</Badge>}</TabsTrigger>
          <TabsTrigger value="appointments"><Calendar className="mr-1.5 h-4 w-4" />Termine{appts.length > 0 && <Badge variant="secondary" className="ml-2">{appts.length}</Badge>}</TabsTrigger>
          <TabsTrigger value="activity"><Activity className="mr-1.5 h-4 w-4" />Aktivität</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6 space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card><CardContent className="p-6">
              <div className="mb-3 flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-muted-foreground" />
                <h3 className="font-display text-lg font-semibold">Notizen</h3>
              </div>
              {lead.notes ? (
                <p className="whitespace-pre-wrap text-sm text-muted-foreground">{lead.notes}</p>
              ) : (
                <p className="text-sm text-muted-foreground">Keine Notizen hinterlegt.</p>
              )}
            </CardContent></Card>

            <Card><CardContent className="p-6">
              <h3 className="mb-3 font-display text-lg font-semibold">Letzte Aktivität</h3>
              {activity.length === 0 ? (
                <p className="text-sm text-muted-foreground">Noch keine Aktivität.</p>
              ) : (
                <div className="space-y-2">
                  {activity.slice(0, 5).map((a: any) => (
                    <div key={a.id} className="flex items-start gap-2 text-sm">
                      <div className="mt-1 h-1.5 w-1.5 rounded-full bg-primary" />
                      <div className="flex-1">
                        <p>{a.action}</p>
                        <p className="text-xs text-muted-foreground">{formatDateTime(a.created_at)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent></Card>
          </div>
        </TabsContent>

        <TabsContent value="tasks" className="mt-6">
          <Card><CardContent className="p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-display text-lg font-semibold">Aufgaben</h3>
              <NewTaskButton leadId={id} userId={user?.id ?? null} employees={employees} onCreated={() => {
                qc.invalidateQueries({ queryKey: ["lead_tasks", id] });
                qc.invalidateQueries({ queryKey: ["lead_activity", id] });
              }} />
            </div>
            {tasks.length === 0 ? (
              <p className="text-sm text-muted-foreground">Noch keine Aufgaben.</p>
            ) : (
              <div className="space-y-2">
                {tasks.map((t: any) => (
                  <TaskRow key={t.id} task={t} employees={employees} onChange={() => {
                    qc.invalidateQueries({ queryKey: ["lead_tasks", id] });
                  }} />
                ))}
              </div>
            )}
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="appointments" className="mt-6">
          <Card><CardContent className="p-6">
            <h3 className="mb-4 font-display text-lg font-semibold">Termine</h3>
            {appts.length === 0 ? (
              <p className="text-sm text-muted-foreground">Termine werden direkt am Kunden geführt. Konvertiere den Lead zuerst zu einem Kunden, um Termine anzulegen.</p>
            ) : (
              <div className="space-y-2">
                {appts.map((a: any) => (
                  <div key={a.id} className="rounded-xl border p-4">
                    <p className="font-medium">{a.title}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {formatDateTime(a.starts_at)} · {apptTypeLabels[a.appointment_type as keyof typeof apptTypeLabels]}
                      {a.location ? ` · ${a.location}` : ""}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="activity" className="mt-6">
          <Card><CardContent className="p-6">
            <h3 className="mb-4 font-display text-lg font-semibold">Aktivitätsverlauf</h3>
            {activity.length === 0 ? (
              <p className="text-sm text-muted-foreground">Noch keine Aktivität.</p>
            ) : (
              <div className="space-y-3">
                {activity.map((a: any) => (
                  <div key={a.id} className="flex items-start gap-3 rounded-xl border p-3">
                    <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">{a.action}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{formatDateTime(a.created_at)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent></Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-background/60 p-3">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">{icon}{label}</div>
      <p className="mt-1 text-lg font-semibold">{value}</p>
    </div>
  );
}

function TaskRow({ task, employees, onChange }: { task: any; employees: any[]; onChange: () => void }) {
  const toggle = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("tasks")
        .update({ status: task.status === "done" ? "open" : "done" }).eq("id", task.id);
      if (error) throw error;
    },
    onSuccess: onChange,
  });
  const assignee = employees.find((e) => e.id === task.assigned_to);
  return (
    <div className="flex items-start justify-between gap-3 rounded-xl border p-3">
      <div className="flex items-start gap-3">
        <button onClick={() => toggle.mutate()} className={`mt-0.5 flex h-5 w-5 items-center justify-center rounded border ${task.status === "done" ? "bg-primary border-primary text-primary-foreground" : ""}`}>
          {task.status === "done" && <CheckSquare className="h-3 w-3" />}
        </button>
        <div>
          <p className={`text-sm font-medium ${task.status === "done" ? "line-through text-muted-foreground" : ""}`}>{task.title}</p>
          {task.description && <p className="mt-0.5 text-xs text-muted-foreground">{task.description}</p>}
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            {task.due_date && <span>Fällig: {formatDate(task.due_date)}</span>}
            {assignee && <span>· {assignee.full_name ?? assignee.email}</span>}
            {task.priority && <Badge variant="outline" className="text-[10px]">{task.priority}</Badge>}
          </div>
        </div>
      </div>
    </div>
  );
}

function NewTaskButton({ leadId, userId, employees, onCreated }: { leadId: string; userId: string | null; employees: any[]; onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", due_date: "", assigned_to: "", priority: "normal" });
  const create = useMutation({
    mutationFn: async () => {
      if (!form.title.trim()) throw new Error("Titel ist erforderlich");
      const { error } = await supabase.from("tasks").insert({
        title: form.title.trim(),
        description: form.description || null,
        due_date: form.due_date ? new Date(form.due_date).toISOString() : null,
        assigned_to: form.assigned_to || null,
        priority: form.priority as any,
        related_type: "lead",
        related_id: leadId,
        created_by: userId,
      });
      if (error) throw error;
      await supabase.from("activity_logs").insert({
        actor_id: userId, action: `Aufgabe erstellt: ${form.title.trim()}`,
        related_type: "lead", related_id: leadId,
      });
    },
    onSuccess: () => {
      toast.success("Aufgabe erstellt");
      setOpen(false);
      setForm({ title: "", description: "", due_date: "", assigned_to: "", priority: "normal" });
      onCreated();
    },
    onError: (e: any) => toast.error(e.message),
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button size="sm" onClick={() => setOpen(true)}><Plus className="mr-1.5 h-4 w-4" />Neue Aufgabe</Button>
      <DialogContent>
        <DialogHeader><DialogTitle>Neue Aufgabe</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Titel</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
          <div><Label>Beschreibung</Label><Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Fällig am</Label><Input type="datetime-local" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} /></div>
            <div>
              <Label>Priorität</Label>
              <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Niedrig</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="high">Hoch</SelectItem>
                  <SelectItem value="urgent">Dringend</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Zugewiesen an</Label>
            <Select value={form.assigned_to || UNASSIGNED} onValueChange={(v) => setForm({ ...form, assigned_to: v === UNASSIGNED ? "" : v })}>
              <SelectTrigger><SelectValue placeholder="Niemand" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={UNASSIGNED}>Niemand</SelectItem>
                {employees.map((e) => <SelectItem key={e.id} value={e.id}>{e.full_name ?? e.email}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={() => create.mutate()} disabled={!form.title || create.isPending}>Speichern</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditLeadDialog({ lead, employees, onSaved }: { lead: any; employees: any[]; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    full_name: lead.full_name ?? "",
    email: lead.email ?? "",
    phone: lead.phone ?? "",
    source: lead.source ?? "",
    notes: lead.notes ?? "",
    assigned_to: lead.assigned_to ?? "",
  });
  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("leads").update({
        full_name: form.full_name,
        email: form.email || null,
        phone: form.phone || null,
        source: form.source || null,
        notes: form.notes || null,
        assigned_to: form.assigned_to || null,
      }).eq("id", lead.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Gespeichert"); setOpen(false); onSaved(); },
    onError: (e: any) => toast.error(e.message),
  });
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}><Pencil className="mr-1.5 h-4 w-4" />Bearbeiten</Button>
      <DialogContent>
        <DialogHeader><DialogTitle>Lead bearbeiten</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Name</Label><Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>E-Mail</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            <div><Label>Telefon</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
          </div>
          <div><Label>Quelle</Label><Input value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} /></div>
          <div>
            <Label>Zugewiesen an</Label>
            <Select value={form.assigned_to || UNASSIGNED} onValueChange={(v) => setForm({ ...form, assigned_to: v === UNASSIGNED ? "" : v })}>
              <SelectTrigger><SelectValue placeholder="Niemand" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={UNASSIGNED}>Niemand</SelectItem>
                {employees.map((e: any) => <SelectItem key={e.id} value={e.id}>{e.full_name ?? e.email}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div><Label>Notizen</Label><Textarea rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
        </div>
        <DialogFooter><Button onClick={() => save.mutate()} disabled={!form.full_name || save.isPending}>Speichern</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
