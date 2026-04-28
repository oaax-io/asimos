import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Plus, Mail, Phone, ArrowRight } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { leadStatusLabels, leadStatuses, type LeadStatus } from "@/lib/format";
import { useAuth } from "@/lib/auth";
import { getBackendErrorMessage, isBackendUnavailableError } from "@/lib/backend-errors";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

export const Route = createFileRoute("/_app/leads")({ component: LeadsPage });

type Lead = Tables<"leads">;
type PendingLead = Pick<Lead, "full_name" | "email" | "phone" | "source" | "notes"> & { tempId: string; created_at: string };

function LeadsPage() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ full_name: "", email: "", phone: "", source: "", notes: "" });
  const [pendingLeads, setPendingLeads] = useState<PendingLead[]>([]);
  const syncInFlightRef = useRef(false);

  const pendingStorageKey = user ? `pending-leads:${user.id}` : null;

  const persistPendingLeads = useCallback((items: PendingLead[]) => {
    setPendingLeads(items);
    if (!pendingStorageKey) return;
    if (items.length === 0) {
      localStorage.removeItem(pendingStorageKey);
      return;
    }
    localStorage.setItem(pendingStorageKey, JSON.stringify(items));
  }, [pendingStorageKey]);

  const enqueuePendingLead = useCallback((values: typeof form) => {
    const item: PendingLead = {
      tempId: `pending-${crypto.randomUUID()}`,
      created_at: new Date().toISOString(),
      full_name: values.full_name.trim(),
      email: values.email.trim() || null,
      phone: values.phone.trim() || null,
      source: values.source.trim() || null,
      notes: values.notes.trim() || null,
    };

    persistPendingLeads([item, ...pendingLeads]);
    return item;
  }, [pendingLeads, persistPendingLeads]);

  useEffect(() => {
    if (!pendingStorageKey) {
      setPendingLeads([]);
      return;
    }

    const raw = localStorage.getItem(pendingStorageKey);
    if (!raw) {
      setPendingLeads([]);
      return;
    }

    try {
      const parsed = JSON.parse(raw) as PendingLead[];
      setPendingLeads(Array.isArray(parsed) ? parsed : []);
    } catch {
      setPendingLeads([]);
    }
  }, [pendingStorageKey]);

  const { data: leads = [], error, isLoading } = useQuery({
    queryKey: ["leads"],
    queryFn: async () => {
      const { data, error } = await supabase.from("leads").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    refetchOnReconnect: true,
  });

  const syncPendingLeads = useCallback(async () => {
    if (!user || pendingLeads.length === 0 || syncInFlightRef.current) return;

    syncInFlightRef.current = true;

    try {
      const { data: profile, error: pErr } = await supabase.from("profiles").select("agency_id").eq("id", user.id).single();
      if (pErr) throw pErr;

      const payload = pendingLeads.map((lead) => ({
        full_name: lead.full_name,
        email: lead.email,
        phone: lead.phone,
        source: lead.source,
        notes: lead.notes,
        agency_id: profile.agency_id,
        owner_id: user.id,
      }));

      const { error: insertError } = await supabase.from("leads").insert(payload);
      if (insertError) throw insertError;

      persistPendingLeads([]);
      qc.invalidateQueries({ queryKey: ["leads"] });
      toast.success(`${payload.length} lokal gespeicherte Leads wurden synchronisiert`);
    } catch (syncError) {
      if (!isBackendUnavailableError(syncError)) {
        toast.error(getBackendErrorMessage(syncError));
      }
    } finally {
      syncInFlightRef.current = false;
    }
  }, [pendingLeads, persistPendingLeads, qc, user]);

  useEffect(() => {
    if (!error && pendingLeads.length > 0) {
      void syncPendingLeads();
    }
  }, [error, pendingLeads.length, syncPendingLeads]);

  useEffect(() => {
    const onReconnect = () => void syncPendingLeads();
    window.addEventListener("online", onReconnect);
    window.addEventListener("focus", onReconnect);
    return () => {
      window.removeEventListener("online", onReconnect);
      window.removeEventListener("focus", onReconnect);
    };
  }, [syncPendingLeads]);

  const create = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Nicht angemeldet");
      if (!form.full_name.trim()) throw new Error("Name ist erforderlich");
      const { data: profile, error: pErr } = await supabase.from("profiles").select("agency_id").eq("id", user.id).single();
      if (pErr || !profile) throw new Error(pErr?.message || "Profil nicht gefunden");
      const { error } = await supabase.from("leads").insert({
        full_name: form.full_name.trim(),
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        source: form.source.trim() || null,
        notes: form.notes.trim() || null,
        agency_id: profile.agency_id,
        owner_id: user.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Lead erstellt – du kannst einen weiteren hinzufügen");
      qc.invalidateQueries({ queryKey: ["leads"] });
      setForm({ full_name: "", email: "", phone: "", source: "", notes: "" });
    },
    onError: (e: unknown) => {
      if (isBackendUnavailableError(e)) {
        enqueuePendingLead(form);
        setForm({ full_name: "", email: "", phone: "", source: "", notes: "" });
        toast.success("Lead lokal gespeichert und wird automatisch synchronisiert, sobald das Backend wieder stabil ist");
        return;
      }

      toast.error(getBackendErrorMessage(e));
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: LeadStatus }) => {
      const { error } = await supabase.from("leads").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["leads"] }),
  });

  const convert = useMutation({
    mutationFn: async (lead: Lead) => {
      const { data: profile } = await supabase.from("profiles").select("agency_id").eq("id", user!.id).single();
      const { error } = await supabase.from("clients").insert({
        agency_id: profile!.agency_id, owner_id: user!.id,
        full_name: lead.full_name, email: lead.email, phone: lead.phone,
        notes: lead.notes, client_type: "buyer",
      });
      if (error) throw error;
      await supabase.from("leads").update({ status: "converted" }).eq("id", lead.id);
    },
    onSuccess: () => {
      toast.success("Zu Kunde konvertiert");
      qc.invalidateQueries({ queryKey: ["leads"] });
      qc.invalidateQueries({ queryKey: ["clients"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <>
      <PageHeader
        title="Leads"
        description="Pipeline deiner Interessenten"
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="mr-1 h-4 w-4" />Neuer Lead</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Neuer Lead</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Name</Label><Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>E-Mail</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
                  <div><Label>Telefon</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
                </div>
                <div><Label>Quelle</Label><Input placeholder="Website, Empfehlung…" value={form.source} onChange={(e) => setForm({ ...form, source: e.target.value })} /></div>
                <div><Label>Notizen</Label><Textarea rows={3} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
              </div>
              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => setOpen(false)}>Abbrechen</Button>
                <Button onClick={() => create.mutate()} disabled={!form.full_name || create.isPending}>
                  {create.isPending ? "Speichern…" : "Speichern & weiteren hinzufügen"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      {pendingLeads.length > 0 ? (
        <div className="mb-4 rounded-xl border border-dashed bg-muted/30 p-4 text-sm text-muted-foreground">
          {pendingLeads.length} Lead{pendingLeads.length === 1 ? " ist" : "s sind"} lokal zwischengespeichert und werden automatisch synchronisiert.
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
        {leadStatuses.map((status) => {
          const items = leads.filter((l) => l.status === status);
          return (
            <div key={status} className="flex flex-col rounded-2xl bg-muted/40 p-3">
              <div className="mb-3 flex items-center justify-between px-1">
                <h3 className="text-sm font-semibold">{leadStatusLabels[status]}</h3>
                <span className="rounded-full bg-background px-2 py-0.5 text-xs text-muted-foreground">{items.length}</span>
              </div>
              <div className="flex flex-col gap-2">
                {items.map((l) => (
                  <div key={l.id} className="rounded-xl border bg-card p-3 shadow-soft transition hover:shadow-glow">
                    <p className="font-medium">{l.full_name}</p>
                    <div className="mt-1 flex flex-col gap-0.5 text-xs text-muted-foreground">
                      {l.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{l.email}</span>}
                      {l.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{l.phone}</span>}
                      {l.source && <span>· {l.source}</span>}
                    </div>
                    <div className="mt-3 flex items-center gap-2">
                      <Select value={l.status} onValueChange={(v) => updateStatus.mutate({ id: l.id, status: v as LeadStatus })}>
                        <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {leadStatuses.map((s) => <SelectItem key={s} value={s}>{leadStatusLabels[s]}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      {l.status !== "converted" && (
                        <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => convert.mutate(l)} title="Zu Kunde konvertieren">
                          <ArrowRight className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
                {items.length === 0 && <p className="px-1 py-3 text-xs text-muted-foreground">Keine Leads</p>}
              </div>
            </div>
          );
        })}
      </div>
      {error && isBackendUnavailableError(error) ? (
        <div className="rounded-xl border border-dashed bg-muted/30 p-4 text-sm text-muted-foreground">
          Backend aktuell nicht erreichbar. Neue Leads werden lokal zwischengespeichert und später automatisch übertragen.
        </div>
      ) : null}

      {!error && isLoading ? (
        <div className="rounded-xl border bg-muted/20 p-4 text-sm text-muted-foreground">Leads werden geladen…</div>
      ) : null}
    </>
  );
}
