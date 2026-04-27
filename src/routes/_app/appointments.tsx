import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Plus, Calendar as CalIcon, MapPin, Clock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { apptTypeLabels, formatDateTime } from "@/lib/format";
import { EmptyState } from "@/components/EmptyState";

export const Route = createFileRoute("/_app/appointments")({ component: AppointmentsPage });

const TYPES = ["viewing","meeting","call","other"] as const;

function AppointmentsPage() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    title: "", appointment_type: "viewing", starts_at: "", ends_at: "",
    location: "", notes: "", client_id: "", property_id: "",
  });

  const { data: appts = [] } = useQuery({
    queryKey: ["appointments"],
    queryFn: async () => (await supabase.from("appointments").select("*, clients(full_name), properties(title)").order("starts_at")).data ?? [],
  });
  const { data: clients = [] } = useQuery({
    queryKey: ["clients-min"],
    queryFn: async () => (await supabase.from("clients").select("id, full_name").order("full_name")).data ?? [],
  });
  const { data: properties = [] } = useQuery({
    queryKey: ["properties-min"],
    queryFn: async () => (await supabase.from("properties").select("id, title").order("title")).data ?? [],
  });

  const create = useMutation({
    mutationFn: async () => {
      const { data: profile } = await supabase.from("profiles").select("agency_id").eq("id", user!.id).single();
      const { error } = await supabase.from("appointments").insert({
        agency_id: profile!.agency_id, owner_id: user!.id,
        title: form.title,
        appointment_type: form.appointment_type as any,
        starts_at: new Date(form.starts_at).toISOString(),
        ends_at: new Date(form.ends_at || form.starts_at).toISOString(),
        location: form.location || null,
        notes: form.notes || null,
        client_id: form.client_id || null,
        property_id: form.property_id || null,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Termin erstellt"); qc.invalidateQueries({ queryKey: ["appointments"] }); setOpen(false); },
    onError: (e: any) => toast.error(e.message),
  });

  const now = Date.now();
  const upcoming = appts.filter((a: any) => new Date(a.starts_at).getTime() >= now);
  const past = appts.filter((a: any) => new Date(a.starts_at).getTime() < now).reverse();

  return (
    <>
      <PageHeader
        title="Termine"
        description="Besichtigungen, Calls und Meetings"
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="mr-1 h-4 w-4" />Neuer Termin</Button></DialogTrigger>
            <DialogContent className="max-w-xl">
              <DialogHeader><DialogTitle>Neuer Termin</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Titel</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Typ</Label>
                    <Select value={form.appointment_type} onValueChange={(v) => setForm({ ...form, appointment_type: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{TYPES.map(t => <SelectItem key={t} value={t}>{apptTypeLabels[t]}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div><Label>Ort</Label><Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} /></div>
                  <div><Label>Start</Label><Input type="datetime-local" value={form.starts_at} onChange={(e) => setForm({ ...form, starts_at: e.target.value })} /></div>
                  <div><Label>Ende</Label><Input type="datetime-local" value={form.ends_at} onChange={(e) => setForm({ ...form, ends_at: e.target.value })} /></div>
                  <div><Label>Kunde</Label>
                    <Select value={form.client_id} onValueChange={(v) => setForm({ ...form, client_id: v })}>
                      <SelectTrigger><SelectValue placeholder="Keiner" /></SelectTrigger>
                      <SelectContent>{clients.map(c => <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div><Label>Immobilie</Label>
                    <Select value={form.property_id} onValueChange={(v) => setForm({ ...form, property_id: v })}>
                      <SelectTrigger><SelectValue placeholder="Keine" /></SelectTrigger>
                      <SelectContent>{properties.map(p => <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
                <div><Label>Notizen</Label><Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
              </div>
              <DialogFooter>
                <Button onClick={() => create.mutate()} disabled={!form.title || !form.starts_at || create.isPending}>Speichern</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <h2 className="mb-3 text-sm font-semibold text-muted-foreground">Anstehend</h2>
      {upcoming.length === 0 ? (
        <EmptyState title="Keine anstehenden Termine" />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {upcoming.map((a: any) => <ApptCard key={a.id} a={a} />)}
        </div>
      )}

      {past.length > 0 && (
        <>
          <h2 className="mb-3 mt-8 text-sm font-semibold text-muted-foreground">Vergangene</h2>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {past.slice(0, 12).map((a: any) => <ApptCard key={a.id} a={a} dim />)}
          </div>
        </>
      )}
    </>
  );
}

function ApptCard({ a, dim }: { a: any; dim?: boolean }) {
  return (
    <Card className={dim ? "opacity-70" : ""}>
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <Badge variant="secondary">{apptTypeLabels[a.appointment_type as keyof typeof apptTypeLabels]}</Badge>
          <span className="flex items-center gap-1 text-xs text-muted-foreground"><CalIcon className="h-3 w-3" />{formatDateTime(a.starts_at)}</span>
        </div>
        <h3 className="mt-2 font-semibold">{a.title}</h3>
        <div className="mt-2 space-y-1 text-xs text-muted-foreground">
          {a.location && <p className="flex items-center gap-1"><MapPin className="h-3 w-3" />{a.location}</p>}
          {a.clients?.full_name && <p>Kunde: {a.clients.full_name}</p>}
          {a.properties?.title && <p>Objekt: {a.properties.title}</p>}
          {a.ends_at && <p className="flex items-center gap-1"><Clock className="h-3 w-3" />bis {formatDateTime(a.ends_at)}</p>}
        </div>
      </CardContent>
    </Card>
  );
}
