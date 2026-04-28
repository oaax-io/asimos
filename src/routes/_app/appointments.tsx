import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Plus, Calendar as CalIcon, MapPin, Clock, ChevronLeft, ChevronRight, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { apptTypeLabels, formatDateTime } from "@/lib/format";
import { EmptyState } from "@/components/EmptyState";

export const Route = createFileRoute("/_app/appointments")({ component: AppointmentsPage });

const TYPES = ["viewing","meeting","call","other"] as const;
const STATUSES = ["scheduled","completed","cancelled"] as const;
const STATUS_LABELS: Record<typeof STATUSES[number], string> = {
  scheduled: "Geplant", completed: "Erledigt", cancelled: "Abgesagt",
};
const STATUS_VARIANTS: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  scheduled: "default", completed: "secondary", cancelled: "outline",
};

const emptyForm = {
  title: "", appointment_type: "viewing", status: "scheduled",
  starts_at: "", ends_at: "",
  location: "", notes: "",
  client_id: "", property_id: "", assigned_to: "",
};

function AppointmentsPage() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [view, setView] = useState<"list" | "week">("list");

  const { data: appts = [] } = useQuery({
    queryKey: ["appointments"],
    queryFn: async () => (await supabase.from("appointments")
      .select("*, clients(id, full_name), properties(id, title)")
      .order("starts_at")).data ?? [],
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

  const create = useMutation({
    mutationFn: async () => {
      if (!form.title.trim()) throw new Error("Titel ist erforderlich");
      if (!form.starts_at) throw new Error("Startzeit ist erforderlich");
      const { data: profile } = await supabase.from("profiles").select("agency_id").eq("id", user!.id).single();
      const startIso = new Date(form.starts_at).toISOString();
      const endIso = form.ends_at ? new Date(form.ends_at).toISOString() : new Date(new Date(form.starts_at).getTime() + 60 * 60 * 1000).toISOString();
      const { error } = await supabase.from("appointments").insert({
        agency_id: profile!.agency_id,
        owner_id: user!.id,
        title: form.title.trim(),
        appointment_type: form.appointment_type as any,
        status: form.status as any,
        starts_at: startIso,
        ends_at: endIso,
        location: form.location || null,
        notes: form.notes || null,
        client_id: form.client_id || null,
        property_id: form.property_id || null,
        assigned_to: form.assigned_to || user!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Termin erstellt"); qc.invalidateQueries({ queryKey: ["appointments"] }); setForm({ ...emptyForm }); setOpen(false); },
    onError: (e: any) => toast.error(e.message),
  });

  const update = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: any }) => {
      const { error } = await supabase.from("appointments").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["appointments"] }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("appointments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Termin gelöscht"); qc.invalidateQueries({ queryKey: ["appointments"] }); setEditId(null); },
  });

  const editing = appts.find((a: any) => a.id === editId);

  return (
    <>
      <PageHeader
        title="Termine"
        description="Besichtigungen, Calls und Meetings"
        action={<Button onClick={() => setOpen(true)}><Plus className="mr-1 h-4 w-4" />Neuer Termin</Button>}
      />

      <AppointmentDialog
        open={open}
        onOpenChange={setOpen}
        title="Neuer Termin"
        form={form}
        setForm={setForm}
        clients={clients}
        properties={properties}
        employees={employees}
        onSubmit={() => create.mutate()}
        submitting={create.isPending}
      />

      <Tabs value={view} onValueChange={(v) => setView(v as any)} className="space-y-4">
        <TabsList>
          <TabsTrigger value="list">Liste</TabsTrigger>
          <TabsTrigger value="week">Wochenkalender</TabsTrigger>
        </TabsList>

        <TabsContent value="list">
          <ListView
            appts={appts}
            employees={employees}
            onOpen={(id) => setEditId(id)}
            onStatus={(id, status) => update.mutate({ id, patch: { status } })}
          />
        </TabsContent>

        <TabsContent value="week">
          <WeekView appts={appts} onOpen={(id) => setEditId(id)} />
        </TabsContent>
      </Tabs>

      <AppointmentEditDrawer
        appt={editing}
        open={!!editId}
        onClose={() => setEditId(null)}
        clients={clients}
        properties={properties}
        employees={employees}
        onSave={(patch: any) => editing && update.mutate({ id: editing.id, patch }, { onSuccess: () => { toast.success("Aktualisiert"); setEditId(null); } })}
        onDelete={() => { if (editing && confirm("Termin wirklich löschen?")) remove.mutate(editing.id); }}
      />
    </>
  );
}

/* -------------------- Views -------------------- */

function ListView({
  appts, employees, onOpen, onStatus,
}: { appts: any[]; employees: any[]; onOpen: (id: string) => void; onStatus: (id: string, s: string) => void }) {
  const now = Date.now();
  const upcoming = appts.filter((a) => new Date(a.starts_at).getTime() >= now);
  const past = appts.filter((a) => new Date(a.starts_at).getTime() < now).reverse();

  return (
    <>
      <h2 className="mb-3 text-sm font-semibold text-muted-foreground">Anstehend</h2>
      {upcoming.length === 0 ? (
        <EmptyState title="Keine anstehenden Termine" description="Plane Besichtigungen, Beurkundungen oder Calls." />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {upcoming.map((a) => <ApptCard key={a.id} a={a} employees={employees} onOpen={onOpen} onStatus={onStatus} />)}
        </div>
      )}

      {past.length > 0 && (
        <>
          <h2 className="mb-3 mt-8 text-sm font-semibold text-muted-foreground">Vergangene</h2>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {past.slice(0, 12).map((a) => <ApptCard key={a.id} a={a} employees={employees} dim onOpen={onOpen} onStatus={onStatus} />)}
          </div>
        </>
      )}
    </>
  );
}

function ApptCard({
  a, employees, dim, onOpen, onStatus,
}: { a: any; employees: any[]; dim?: boolean; onOpen: (id: string) => void; onStatus: (id: string, s: string) => void }) {
  const assignee = employees.find((e) => e.id === a.assigned_to);
  return (
    <Card className={`cursor-pointer transition hover:shadow-soft ${dim ? "opacity-70" : ""}`} onClick={() => onOpen(a.id)}>
      <CardContent className="p-5">
        <div className="flex items-center justify-between gap-2">
          <Badge variant="secondary">{apptTypeLabels[a.appointment_type as keyof typeof apptTypeLabels]}</Badge>
          <Badge variant={STATUS_VARIANTS[a.status]}>{STATUS_LABELS[a.status as keyof typeof STATUS_LABELS]}</Badge>
        </div>
        <h3 className="mt-2 line-clamp-1 font-semibold">{a.title}</h3>
        <div className="mt-2 space-y-1 text-xs text-muted-foreground">
          <p className="flex items-center gap-1"><CalIcon className="h-3 w-3" />{formatDateTime(a.starts_at)}</p>
          {a.ends_at && <p className="flex items-center gap-1"><Clock className="h-3 w-3" />bis {formatDateTime(a.ends_at)}</p>}
          {a.location && <p className="flex items-center gap-1"><MapPin className="h-3 w-3" />{a.location}</p>}
          {a.clients?.full_name && <p>Kunde: {a.clients.full_name}</p>}
          {a.properties?.title && <p>Objekt: {a.properties.title}</p>}
          {assignee && <p>Zuständig: {assignee.full_name || assignee.email}</p>}
        </div>
        <div className="mt-3" onClick={(e) => e.stopPropagation()}>
          <Select value={a.status} onValueChange={(v) => onStatus(a.id, v)}>
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {STATUSES.map(s => <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  );
}

function WeekView({ appts, onOpen }: { appts: any[]; onOpen: (id: string) => void }) {
  const [anchor, setAnchor] = useState(() => startOfWeek(new Date()));
  const days = Array.from({ length: 7 }, (_, i) => new Date(anchor.getTime() + i * 86400000));
  const byDay = useMemo(() => {
    const map: Record<string, any[]> = {};
    days.forEach((d) => { map[d.toDateString()] = []; });
    for (const a of appts) {
      const d = new Date(a.starts_at);
      const key = d.toDateString();
      if (key in map) map[key].push(a);
    }
    return map;
  }, [appts, anchor]);

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setAnchor(new Date(anchor.getTime() - 7 * 86400000))}><ChevronLeft className="h-4 w-4" /></Button>
          <Button variant="outline" size="sm" onClick={() => setAnchor(startOfWeek(new Date()))}>Heute</Button>
          <Button variant="outline" size="icon" onClick={() => setAnchor(new Date(anchor.getTime() + 7 * 86400000))}><ChevronRight className="h-4 w-4" /></Button>
        </div>
        <p className="text-sm text-muted-foreground">
          {new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "short" }).format(days[0])} – {new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "short", year: "numeric" }).format(days[6])}
        </p>
      </div>
      <div className="grid gap-2 md:grid-cols-7">
        {days.map((d) => {
          const isToday = d.toDateString() === new Date().toDateString();
          const items = byDay[d.toDateString()] ?? [];
          return (
            <div key={d.toISOString()} className={`rounded-xl border bg-card p-3 ${isToday ? "ring-2 ring-primary/30" : ""}`}>
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {new Intl.DateTimeFormat("de-DE", { weekday: "short" }).format(d)}
                </p>
                <p className={`text-lg font-bold ${isToday ? "text-primary" : ""}`}>{d.getDate()}</p>
              </div>
              <div className="space-y-1.5">
                {items.length === 0 && <p className="text-xs text-muted-foreground">—</p>}
                {items.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => onOpen(a.id)}
                    className="block w-full rounded-md border bg-accent/30 p-2 text-left text-xs transition hover:bg-accent"
                  >
                    <p className="font-medium text-primary">
                      {new Intl.DateTimeFormat("de-DE", { hour: "2-digit", minute: "2-digit" }).format(new Date(a.starts_at))}
                    </p>
                    <p className="line-clamp-2 font-medium">{a.title}</p>
                    {a.location && <p className="line-clamp-1 text-muted-foreground">{a.location}</p>}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function startOfWeek(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const dow = (x.getDay() + 6) % 7; // Monday-first
  x.setDate(x.getDate() - dow);
  return x;
}

/* -------------------- Form / Dialog / Drawer -------------------- */

function AppointmentForm({
  form, setForm, clients, properties, employees,
}: { form: any; setForm: (f: any) => void; clients: any[]; properties: any[]; employees: any[] }) {
  return (
    <div className="space-y-3">
      <div><Label>Titel *</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Besichtigung Hauptstrasse 12" /></div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Typ</Label>
          <Select value={form.appointment_type} onValueChange={(v) => setForm({ ...form, appointment_type: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{TYPES.map(t => <SelectItem key={t} value={t}>{apptTypeLabels[t]}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div>
          <Label>Status</Label>
          <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{STATUSES.map(s => <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div><Label>Start *</Label><Input type="datetime-local" value={form.starts_at} onChange={(e) => setForm({ ...form, starts_at: e.target.value })} /></div>
        <div><Label>Ende</Label><Input type="datetime-local" value={form.ends_at} onChange={(e) => setForm({ ...form, ends_at: e.target.value })} /></div>
        <div className="col-span-2"><Label>Ort</Label><Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Adresse, Treffpunkt oder Link" /></div>
        <div>
          <Label>Kunde</Label>
          <Select value={form.client_id || "none"} onValueChange={(v) => setForm({ ...form, client_id: v === "none" ? "" : v })}>
            <SelectTrigger><SelectValue placeholder="Keiner" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Kein Kunde</SelectItem>
              {clients.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Immobilie</Label>
          <Select value={form.property_id || "none"} onValueChange={(v) => setForm({ ...form, property_id: v === "none" ? "" : v })}>
            <SelectTrigger><SelectValue placeholder="Keine" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Keine Immobilie</SelectItem>
              {properties.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="col-span-2">
          <Label>Zuständig</Label>
          <Select value={form.assigned_to || "none"} onValueChange={(v) => setForm({ ...form, assigned_to: v === "none" ? "" : v })}>
            <SelectTrigger><SelectValue placeholder="Mir zuweisen" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Mir zuweisen</SelectItem>
              {employees.map((e: any) => <SelectItem key={e.id} value={e.id}>{e.full_name || e.email}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div><Label>Notizen</Label><Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
    </div>
  );
}

function AppointmentDialog({
  open, onOpenChange, title, form, setForm, clients, properties, employees, onSubmit, submitting,
}: any) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>Verknüpfe Termin mit Kunde und/oder Immobilie und weise einen Mitarbeiter zu.</DialogDescription>
        </DialogHeader>
        <AppointmentForm form={form} setForm={setForm} clients={clients} properties={properties} employees={employees} />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Abbrechen</Button>
          <Button onClick={onSubmit} disabled={submitting}>Speichern</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AppointmentEditDrawer({
  appt, open, onClose, clients, properties, employees, onSave, onDelete,
}: any) {
  const [form, setForm] = useState({ ...emptyForm });

  useEffect(() => {
    if (appt) {
      setForm({
        title: appt.title ?? "",
        appointment_type: appt.appointment_type ?? "viewing",
        status: appt.status ?? "scheduled",
        starts_at: appt.starts_at ? new Date(appt.starts_at).toISOString().slice(0, 16) : "",
        ends_at: appt.ends_at ? new Date(appt.ends_at).toISOString().slice(0, 16) : "",
        location: appt.location ?? "",
        notes: appt.notes ?? "",
        client_id: appt.client_id ?? "",
        property_id: appt.property_id ?? "",
        assigned_to: appt.assigned_to ?? "",
      });
    }
  }, [appt]);

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Termin bearbeiten</SheetTitle>
          <SheetDescription>Aktualisiere Details, Status oder Zuweisung.</SheetDescription>
        </SheetHeader>
        <div className="my-4">
          <AppointmentForm form={form} setForm={setForm} clients={clients} properties={properties} employees={employees} />
        </div>
        <SheetFooter className="flex-row justify-between gap-2">
          <Button variant="outline" onClick={onDelete}><Trash2 className="mr-1 h-4 w-4" />Löschen</Button>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>Schliessen</Button>
            <Button onClick={() => onSave({
              title: form.title.trim(),
              appointment_type: form.appointment_type,
              status: form.status,
              starts_at: form.starts_at ? new Date(form.starts_at).toISOString() : appt.starts_at,
              ends_at: form.ends_at ? new Date(form.ends_at).toISOString() : null,
              location: form.location || null,
              notes: form.notes || null,
              client_id: form.client_id || null,
              property_id: form.property_id || null,
              assigned_to: form.assigned_to || null,
            })} disabled={!form.title.trim() || !form.starts_at}>Speichern</Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
