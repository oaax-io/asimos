import { useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Plus, ChevronDown, CalendarPlus, CheckSquare, ListChecks, TrendingUp, Handshake, FileSignature,
} from "lucide-react";
import { apptTypeLabels } from "@/lib/format";
import { MandateWizard } from "@/components/mandates/MandateWizard";

type QuickAction = null | "task" | "appointment" | "checklist" | "market" | "mandate" | "reservation";

export function PropertyQuickActions({
  propertyId,
  marketAnalysisSlot,
}: {
  propertyId: string;
  marketAnalysisSlot?: ReactNode;
}) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [action, setAction] = useState<QuickAction>(null);
  const close = () => setAction(null);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button>
            <Plus className="mr-1.5 h-4 w-4" />Neu
            <ChevronDown className="ml-1 h-3.5 w-3.5 opacity-70" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem onSelect={() => setAction("task")}>
            <CheckSquare className="mr-2 h-4 w-4" />Neue Aufgabe
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setAction("appointment")}>
            <CalendarPlus className="mr-2 h-4 w-4" />Neuer Termin
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setAction("checklist")}>
            <ListChecks className="mr-2 h-4 w-4" />Neue Checkliste
          </DropdownMenuItem>
          {marketAnalysisSlot && (
            <DropdownMenuItem onSelect={() => setAction("market")}>
              <TrendingUp className="mr-2 h-4 w-4" />Marktanalyse
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => setAction("mandate")}>
            <Handshake className="mr-2 h-4 w-4" />Neues Mandat
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setAction("reservation")}>
            <FileSignature className="mr-2 h-4 w-4" />Neue Reservation
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {user && (
        <NewTaskDialog
          open={action === "task"}
          onOpenChange={(o) => !o && close()}
          propertyId={propertyId}
          userId={user.id}
          onCreated={() => {
            close();
            qc.invalidateQueries({ queryKey: ["property_tasks", propertyId] });
            qc.invalidateQueries({ queryKey: ["property_activities", propertyId] });
          }}
        />
      )}

      {user && (
        <NewAppointmentDialog
          open={action === "appointment"}
          onOpenChange={(o) => !o && close()}
          propertyId={propertyId}
          userId={user.id}
          onCreated={() => {
            close();
            qc.invalidateQueries({ queryKey: ["property_appointments", propertyId] });
          }}
        />
      )}

      <NewChecklistDialog
        open={action === "checklist"}
        onOpenChange={(o) => !o && close()}
        propertyId={propertyId}
        onCreated={() => { close(); qc.invalidateQueries({ queryKey: ["checklists"] }); }}
      />

      <Dialog open={action === "market"} onOpenChange={(o) => !o && close()}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Marktanalyse</DialogTitle></DialogHeader>
          {marketAnalysisSlot}
        </DialogContent>
      </Dialog>

      <MandateWizard
        open={action === "mandate"}
        onOpenChange={(o) => !o && close()}
        onCreated={() => { close(); qc.invalidateQueries({ queryKey: ["mandates"] }); }}
      />

      <NewReservationDialog
        open={action === "reservation"}
        onOpenChange={(o) => !o && close()}
        propertyId={propertyId}
        onCreated={() => { close(); qc.invalidateQueries({ queryKey: ["reservations"] }); }}
      />
    </>
  );
}

function NewTaskDialog({
  open, onOpenChange, propertyId, userId, onCreated,
}: {
  open: boolean; onOpenChange: (o: boolean) => void;
  propertyId: string; userId: string; onCreated: () => void;
}) {
  const [form, setForm] = useState({ title: "", description: "", due_date: "", priority: "normal" });

  const create = useMutation({
    mutationFn: async () => {
      if (!form.title.trim()) throw new Error("Titel erforderlich");
      const { error } = await supabase.from("tasks").insert({
        title: form.title.trim(),
        description: form.description || null,
        due_date: form.due_date ? new Date(form.due_date).toISOString() : null,
        priority: form.priority as any,
        related_type: "property", related_id: propertyId, created_by: userId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Aufgabe erstellt");
      setForm({ title: "", description: "", due_date: "", priority: "normal" });
      onCreated();
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Neue Aufgabe</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Titel</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
          <div><Label>Beschreibung</Label><Textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Fällig</Label><Input type="date" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} /></div>
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
        </div>
        <DialogFooter>
          <Button onClick={() => create.mutate()} disabled={create.isPending}>Speichern</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NewAppointmentDialog({
  open, onOpenChange, propertyId, userId, onCreated,
}: {
  open: boolean; onOpenChange: (o: boolean) => void;
  propertyId: string; userId: string; onCreated: () => void;
}) {
  const [form, setForm] = useState({
    title: "Besichtigung",
    appointment_type: "viewing" as "viewing" | "meeting" | "call" | "other",
    starts_at: "", ends_at: "", location: "", notes: "",
  });

  const create = useMutation({
    mutationFn: async () => {
      if (!form.title || !form.starts_at || !form.ends_at)
        throw new Error("Titel, Start und Ende sind erforderlich");
      const { error } = await supabase.from("appointments").insert({
        owner_id: userId, property_id: propertyId,
        title: form.title, appointment_type: form.appointment_type,
        starts_at: new Date(form.starts_at).toISOString(),
        ends_at: new Date(form.ends_at).toISOString(),
        location: form.location || null, notes: form.notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Termin angelegt"); onCreated(); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Neuer Termin</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Titel</Label><Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
          <div>
            <Label>Typ</Label>
            <Select value={form.appointment_type} onValueChange={(v: any) => setForm({ ...form, appointment_type: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {(Object.keys(apptTypeLabels) as Array<keyof typeof apptTypeLabels>).map((k) =>
                  <SelectItem key={k} value={k}>{apptTypeLabels[k]}</SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Start</Label><Input type="datetime-local" value={form.starts_at} onChange={(e) => setForm({ ...form, starts_at: e.target.value })} /></div>
            <div><Label>Ende</Label><Input type="datetime-local" value={form.ends_at} onChange={(e) => setForm({ ...form, ends_at: e.target.value })} /></div>
          </div>
          <div><Label>Ort</Label><Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} /></div>
          <div><Label>Notizen</Label><Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
        </div>
        <DialogFooter>
          <Button onClick={() => create.mutate()} disabled={create.isPending}>Speichern</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NewChecklistDialog({
  open, onOpenChange, propertyId, onCreated,
}: {
  open: boolean; onOpenChange: (o: boolean) => void;
  propertyId: string; onCreated: () => void;
}) {
  const [title, setTitle] = useState("");
  const [tplKey, setTplKey] = useState("");

  const { data: templates = [] } = useQuery<any[]>({
    queryKey: ["checklist_templates"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("checklist_templates").select("*").order("title");
      return data ?? [];
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const tpl = templates.find((t) => t.key === tplKey);
      const finalTitle = (title.trim() || tpl?.title || "").trim();
      if (!finalTitle) throw new Error("Titel oder Vorlage erforderlich");
      const { data: cl, error } = await supabase.from("checklists").insert({
        title: finalTitle,
        related_type: "property",
        related_id: propertyId,
        template_key: tpl?.key ?? null,
      } as any).select("id").single();
      if (error) throw error;
      if (tpl?.items?.length) {
        const rows = tpl.items.map((t: string, i: number) => ({ checklist_id: cl.id, title: t, sort_order: i }));
        const { error: e2 } = await supabase.from("checklist_items").insert(rows);
        if (e2) throw e2;
      }
    },
    onSuccess: () => { toast.success("Checkliste erstellt"); setTitle(""); setTplKey(""); onCreated(); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Neue Checkliste</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Vorlage (optional)</Label>
            <Select value={tplKey} onValueChange={setTplKey}>
              <SelectTrigger><SelectValue placeholder="Ohne Vorlage" /></SelectTrigger>
              <SelectContent>
                {templates.map((t) => <SelectItem key={t.key} value={t.key}>{t.title}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div><Label>Titel</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="z. B. Vermarktungsstart" /></div>
        </div>
        <DialogFooter>
          <Button onClick={() => create.mutate()} disabled={create.isPending}>Speichern</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NewReservationDialog({
  open, onOpenChange, propertyId, onCreated,
}: {
  open: boolean; onOpenChange: (o: boolean) => void;
  propertyId: string; onCreated: () => void;
}) {
  const [form, setForm] = useState({ client_id: "", reservation_fee: "", valid_until: "", notes: "" });

  const { data: clients = [] } = useQuery<any[]>({
    queryKey: ["clients-min"],
    queryFn: async () => (await supabase.from("clients").select("id, full_name").order("full_name")).data ?? [],
  });

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("reservations").insert({
        client_id: form.client_id || null,
        property_id: propertyId,
        reservation_fee: form.reservation_fee ? Number(form.reservation_fee) : null,
        valid_until: form.valid_until || null,
        notes: form.notes.trim() || null,
        status: "draft",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Reservation erstellt");
      setForm({ client_id: "", reservation_fee: "", valid_until: "", notes: "" });
      onCreated();
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Neue Reservation</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Kunde</Label>
            <Select value={form.client_id} onValueChange={(v) => setForm({ ...form, client_id: v })}>
              <SelectTrigger><SelectValue placeholder="Kunde wählen" /></SelectTrigger>
              <SelectContent>
                {clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Reservationsgebühr</Label><Input type="number" value={form.reservation_fee} onChange={(e) => setForm({ ...form, reservation_fee: e.target.value })} /></div>
            <div><Label>Gültig bis</Label><Input type="date" value={form.valid_until} onChange={(e) => setForm({ ...form, valid_until: e.target.value })} /></div>
          </div>
          <div><Label>Notizen</Label><Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
        </div>
        <DialogFooter>
          <Button onClick={() => create.mutate()} disabled={create.isPending}>Speichern</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
