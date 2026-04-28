import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Plus, Mail, Phone, Shield } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/team")({ component: TeamPage });

const ROLES = ["owner", "agent", "assistant"] as const;
const ROLE_LABELS: Record<(typeof ROLES)[number], string> = {
  owner: "Inhaber",
  agent: "Makler",
  assistant: "Assistenz",
};

function TeamPage() {
  const qc = useQueryClient();
  const { user, isSuperadmin } = useAuth();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    phone: "",
    role: "agent" as (typeof ROLES)[number],
  });

  const meQuery = useQuery({
    queryKey: ["me-team"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("agency_id, role").eq("id", user!.id).single();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const canManage = isSuperadmin || meQuery.data?.role === "owner";

  const teamQuery = useQuery({
    queryKey: ["team", meQuery.data?.agency_id],
    queryFn: async () => {
      let q = supabase.from("profiles").select("id, full_name, email, phone, role, created_at").order("created_at", { ascending: true });
      if (!isSuperadmin && meQuery.data?.agency_id) q = q.eq("agency_id", meQuery.data.agency_id);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!meQuery.data,
  });

  const create = useMutation({
    mutationFn: async () => {
      if (!form.full_name.trim() || !form.email.trim()) {
        throw new Error("Name und E-Mail sind erforderlich");
      }
      const redirectTo = `${window.location.origin}/set-password`;
      const { data, error } = await supabase.functions.invoke("team-create-member", {
        body: {
          full_name: form.full_name.trim(),
          email: form.email.trim(),
          phone: form.phone.trim(),
          role: form.role,
          redirect_to: redirectTo,
        },
      });
      if (error) throw error;
      if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
      return data;
    },
    onSuccess: () => {
      toast.success("Einladung per E-Mail gesendet");
      setForm({ full_name: "", email: "", phone: "", role: "agent" });
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["team"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateRole = useMutation({
    mutationFn: async ({ id, role }: { id: string; role: (typeof ROLES)[number] }) => {
      const { error } = await supabase.from("profiles").update({ role }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Rolle aktualisiert");
      qc.invalidateQueries({ queryKey: ["team"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const initials = (name?: string | null, email?: string | null) =>
    (name || email || "?").split(" ").map((s) => s[0]).slice(0, 2).join("").toUpperCase();

  return (
    <>
      <PageHeader
        title="Team"
        description="Mitarbeiter deiner Agentur verwalten"
        action={
          canManage ? (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild><Button><Plus className="mr-1 h-4 w-4" />Mitarbeiter hinzufügen</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Neuer Mitarbeiter</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div><Label>Name</Label><Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>E-Mail</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
                    <div><Label>Telefon</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
                  </div>
                  <div>
                    <Label>Rolle</Label>
                    <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v as (typeof ROLES)[number] })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {ROLES.map((r) => <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Der Mitarbeiter erhält eine Einladungs-E-Mail mit einem Link, über den er sein Passwort selbst festlegt.
                  </p>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setOpen(false)}>Abbrechen</Button>
                  <Button onClick={() => create.mutate()} disabled={create.isPending}>
                    {create.isPending ? "Speichern…" : "Anlegen"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          ) : null
        }
      />

      {teamQuery.isLoading ? (
        <div className="rounded-xl border bg-muted/20 p-4 text-sm text-muted-foreground">Team wird geladen…</div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {(teamQuery.data ?? []).map((m) => (
            <Card key={m.id} className="transition hover:shadow-glow">
              <CardContent className="p-5">
                <div className="flex items-start gap-3">
                  <Avatar className="h-10 w-10"><AvatarFallback className="bg-primary text-primary-foreground text-xs">{initials(m.full_name, m.email)}</AvatarFallback></Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{m.full_name || m.email}</p>
                    <Badge variant="secondary" className="mt-1">
                      <Shield className="mr-1 h-3 w-3" />{ROLE_LABELS[m.role as (typeof ROLES)[number]] ?? m.role}
                    </Badge>
                  </div>
                </div>
                <div className="mt-3 space-y-1 text-sm text-muted-foreground">
                  {m.email && <p className="flex items-center gap-2"><Mail className="h-3.5 w-3.5" />{m.email}</p>}
                  {m.phone && <p className="flex items-center gap-2"><Phone className="h-3.5 w-3.5" />{m.phone}</p>}
                </div>
                {canManage && m.id !== user?.id && (
                  <div className="mt-3">
                    <Label className="text-xs">Rolle ändern</Label>
                    <Select value={m.role} onValueChange={(v) => updateRole.mutate({ id: m.id, role: v as (typeof ROLES)[number] })}>
                      <SelectTrigger className="mt-1 h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {ROLES.map((r) => <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
          {(teamQuery.data ?? []).length === 0 && (
            <p className="col-span-full rounded-xl border border-dashed bg-muted/20 p-6 text-center text-sm text-muted-foreground">
              Noch keine Mitarbeiter angelegt.
            </p>
          )}
        </div>
      )}
    </>
  );
}
