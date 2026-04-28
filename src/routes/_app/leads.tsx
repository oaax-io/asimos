import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Plus, Mail, Phone, ArrowRight } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { LayoutGrid, List as ListIcon } from "lucide-react";
import { leadStatusLabels, leadStatuses, type LeadStatus } from "@/lib/format";
import { useAuth } from "@/lib/auth";
import { getBackendErrorMessage, isBackendUnavailableError } from "@/lib/backend-errors";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";
import { addLead, getLeads } from "@/server/crm.functions";

export const Route = createFileRoute("/_app/leads")({ component: LeadsPage });

type Lead = Tables<"leads">;

function LeadsPage() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ full_name: "", email: "", phone: "", source: "", notes: "" });

  const leadsQuery = useQuery({
    queryKey: ["leads"],
    queryFn: async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) throw new Error("Nicht angemeldet");
      return getLeads({ headers: { authorization: `Bearer ${accessToken}` } });
    },
    refetchOnReconnect: true,
  });

  const leads = leadsQuery.data?.data ?? [];
  const queryUnavailable = leadsQuery.data?.unavailable ?? false;
  const queryErrorMessage = leadsQuery.data?.error ?? null;

  const create = useMutation({
    mutationFn: async () => {
      if (!form.full_name.trim()) throw new Error("Name ist erforderlich");
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) throw new Error("Nicht angemeldet");
      const result = await addLead({
        headers: { authorization: `Bearer ${accessToken}` },
        data: {
          full_name: form.full_name.trim(),
          email: form.email.trim() || null,
          phone: form.phone.trim() || null,
          source: form.source.trim() || null,
          notes: form.notes.trim() || null,
        },
      });

      if (result.error || !result.data) {
        const mutationError = new Error(result.error ?? "Es ist ein unerwarteter Fehler aufgetreten.");
        if (result.unavailable) {
          (mutationError as Error & { status?: number }).status = 503;
        }
        throw mutationError;
      }

      return result.data;
    },
    onSuccess: () => {
      toast.success("Lead erstellt – du kannst einen weiteren hinzufügen");
      qc.invalidateQueries({ queryKey: ["leads"] });
      setForm({ full_name: "", email: "", phone: "", source: "", notes: "" });
    },
    onError: (e: unknown) => toast.error(getBackendErrorMessage(e)),
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

      <Tabs defaultValue="kanban" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="kanban"><LayoutGrid className="mr-1 h-4 w-4" />Kanban</TabsTrigger>
          <TabsTrigger value="list"><ListIcon className="mr-1 h-4 w-4" />Liste</TabsTrigger>
        </TabsList>

        <TabsContent value="kanban">
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
        </TabsContent>

        <TabsContent value="list">
          <div className="rounded-xl border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>E-Mail</TableHead>
                  <TableHead>Telefon</TableHead>
                  <TableHead>Quelle</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Aktionen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leads.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="font-medium">{l.full_name}</TableCell>
                    <TableCell className="text-muted-foreground">{l.email ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{l.phone ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{l.source ?? "—"}</TableCell>
                    <TableCell>
                      <Select value={l.status} onValueChange={(v) => updateStatus.mutate({ id: l.id, status: v as LeadStatus })}>
                        <SelectTrigger className="h-8 w-[150px] text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {leadStatuses.map((s) => <SelectItem key={s} value={s}>{leadStatusLabels[s]}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-right">
                      {l.status !== "converted" && (
                        <Button size="sm" variant="outline" className="h-8" onClick={() => convert.mutate(l)}>
                          <ArrowRight className="mr-1 h-3 w-3" />Zu Kunde
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {leads.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                      Keine Leads vorhanden
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

      {queryUnavailable || (leadsQuery.error && isBackendUnavailableError(leadsQuery.error)) ? (
        <div className="rounded-xl border border-dashed bg-muted/30 p-4 text-sm text-muted-foreground">
          {queryErrorMessage ?? "Backend aktuell nicht erreichbar. Bitte in wenigen Sekunden erneut versuchen."}
        </div>
      ) : null}

      {!leadsQuery.error && leadsQuery.isLoading ? (
        <div className="rounded-xl border bg-muted/20 p-4 text-sm text-muted-foreground">Leads werden geladen…</div>
      ) : null}
    </>
  );
}
