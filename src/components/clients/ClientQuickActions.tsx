import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
  Plus, ChevronDown, CalendarPlus, CheckSquare, FileSignature,
  MessageSquare, ClipboardList, Pencil,
} from "lucide-react";
import { apptTypeLabels } from "@/lib/format";

import { ClientEditDialog } from "@/components/clients/ClientEditDialog";
import { FinancingQuickCheckWizard } from "@/components/financing/FinancingQuickCheckWizard";
import { ClientSelfDisclosureWizard } from "@/components/clients/ClientSelfDisclosureWizard";

type QuickAction = null | "appointment" | "task" | "financing" | "note" | "selfdisclosure";

export function ClientQuickActions({ client }: { client: any }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [action, setAction] = useState<QuickAction>(null);

  const close = () => setAction(null);
  const invalidate = (keys: string[]) =>
    keys.forEach((k) => qc.invalidateQueries({ queryKey: [k, client.id] }));

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm">
            <Plus className="mr-1.5 h-4 w-4" />Neu
            <ChevronDown className="ml-1 h-3.5 w-3.5 opacity-70" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem onSelect={() => setAction("appointment")}>
            <CalendarPlus className="mr-2 h-4 w-4" />Neuer Termin
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setAction("task")}>
            <CheckSquare className="mr-2 h-4 w-4" />Neue Aufgabe
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setAction("financing")}>
            <FileSignature className="mr-2 h-4 w-4" />Neue Finanzierung
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setAction("selfdisclosure")}>
            <ClipboardList className="mr-2 h-4 w-4" />Neue Selbstauskunft
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setAction("note")}>
            <MessageSquare className="mr-2 h-4 w-4" />Neue Notiz
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {user && (
        <NewAppointmentDialog
          open={action === "appointment"}
          onOpenChange={(o) => !o && close()}
          clientId={client.id}
          userId={user.id}
          onCreated={() => { close(); invalidate(["client_appointments"]); }}
        />
      )}

      {user && (
        <NewTaskDialog
          open={action === "task"}
          onOpenChange={(o) => !o && close()}
          clientId={client.id}
          userId={user.id}
          onCreated={() => { close(); invalidate(["client_tasks", "client_activity"]); }}
        />
      )}

      <FinancingQuickCheckWizard
        open={action === "financing"}
        onOpenChange={(o) => !o && close()}
        defaultClientId={client.id}
        onCreated={() => { close(); invalidate(["client_financing_dossiers"]); }}
      />

      <ClientSelfDisclosureWizard
        clientId={client.id}
        open={action === "selfdisclosure"}
        onOpenChange={(o) => !o && close()}
      />

      <NewNoteDialog
        open={action === "note"}
        onOpenChange={(o) => !o && close()}
        client={client}
        onSaved={() => { close(); qc.invalidateQueries({ queryKey: ["client", client.id] }); }}
      />
    </>
  );
}

function NewAppointmentDialog({
  open, onOpenChange, clientId, userId, onCreated,
}: {
  open: boolean; onOpenChange: (o: boolean) => void;
  clientId: string; userId: string; onCreated: () => void;
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
        owner_id: userId, client_id: clientId,
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

function NewTaskDialog({
  open, onOpenChange, clientId, userId, onCreated,
}: {
  open: boolean; onOpenChange: (o: boolean) => void;
  clientId: string; userId: string; onCreated: () => void;
}) {
  const [form, setForm] = useState({ title: "", description: "", due_date: "", priority: "normal" });

  const create = useMutation({
    mutationFn: async () => {
      if (!form.title.trim()) throw new Error("Titel erforderlich");
      const { error } = await supabase.from("tasks").insert({
        title: form.title.trim(), description: form.description || null,
        due_date: form.due_date ? new Date(form.due_date).toISOString() : null,
        priority: form.priority as any,
        related_type: "client", related_id: clientId, created_by: userId,
      });
      if (error) throw error;
      await supabase.from("activity_logs").insert({
        actor_id: userId, action: `Aufgabe erstellt: ${form.title.trim()}`,
        related_type: "client", related_id: clientId,
      });
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

function NewNoteDialog({
  open, onOpenChange, client, onSaved,
}: {
  open: boolean; onOpenChange: (o: boolean) => void;
  client: any; onSaved: () => void;
}) {
  const [note, setNote] = useState("");

  const save = useMutation({
    mutationFn: async () => {
      const trimmed = note.trim();
      if (!trimmed) throw new Error("Notiz darf nicht leer sein");
      const stamp = new Date().toLocaleString("de-CH");
      const existing = (client.notes ?? "").trim();
      const combined = existing
        ? `${existing}\n\n— ${stamp} —\n${trimmed}`
        : `— ${stamp} —\n${trimmed}`;
      const { error } = await supabase.from("clients").update({ notes: combined }).eq("id", client.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Notiz gespeichert"); setNote(""); onSaved(); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Neue Notiz</DialogTitle></DialogHeader>
        <Textarea rows={6} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Notiz zum Kunden…" />
        <DialogFooter>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>Speichern</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
