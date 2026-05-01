import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Plus, Mail, Phone, Shield, KeyRound, Pencil, Copy, RefreshCw } from "lucide-react";
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

const ROLES = ["owner", "admin", "manager", "agent", "assistant"] as const;
const ROLE_LABELS: Record<(typeof ROLES)[number], string> = {
  owner: "Inhaber",
  admin: "Administrator",
  manager: "Manager",
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
      const { data, error } = await supabase.from("profiles").select("role").eq("id", user!.id).single();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const canManage = isSuperadmin || meQuery.data?.role === "owner" || meQuery.data?.role === "admin";

  const teamQuery = useQuery({
    queryKey: ["team"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email, phone, role, created_at")
        .order("created_at", { ascending: true });
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

  const [editing, setEditing] = useState<any | null>(null);

  const initials = (name?: string | null, email?: string | null) =>
    (name || email || "?").split(" ").map((s) => s[0]).slice(0, 2).join("").toUpperCase();


  return (
    <>
      <PageHeader
        title="Team"
        description="Mitarbeitende deiner Firma verwalten"
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
                {canManage && (
                  <div className="mt-3 flex justify-end">
                    <Button variant="outline" size="sm" onClick={() => setEditing(m)}>
                      <Pencil className="mr-1 h-3 w-3" /> Bearbeiten
                    </Button>
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

      {editing && (
        <EditMemberDialog
          member={editing}
          isSuperadmin={!!isSuperadmin}
          onClose={() => setEditing(null)}
          onSaved={() => qc.invalidateQueries({ queryKey: ["team"] })}
        />
      )}
    </>
  );
}

function EditMemberDialog({
  member, isSuperadmin, onClose, onSaved,
}: {
  member: any;
  isSuperadmin: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [tab, setTab] = useState<"profile" | "password">("profile");
  const [form, setForm] = useState({
    full_name: member.full_name ?? "",
    email: member.email ?? "",
    phone: member.phone ?? "",
    role: member.role as (typeof ROLES)[number],
  });
  const [pw, setPw] = useState("");
  const [generatedPw, setGeneratedPw] = useState<string | null>(null);
  const [resetLink, setResetLink] = useState<string | null>(null);

  const allowedRoles: (typeof ROLES)[number][] = isSuperadmin
    ? [...ROLES]
    : ["manager", "agent", "assistant"];

  const invoke = async (body: Record<string, unknown>) => {
    const { data, error } = await supabase.functions.invoke("team-update-member", {
      body: { user_id: member.id, ...body },
    });
    if (error) throw error;
    if ((data as any)?.error) throw new Error((data as any).error);
    return data as any;
  };

  const saveProfile = useMutation({
    mutationFn: () => invoke({
      action: "update_profile",
      full_name: form.full_name,
      email: form.email,
      phone: form.phone,
      role: form.role,
    }),
    onSuccess: () => { toast.success("Profil aktualisiert"); onSaved(); onClose(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const setPassword = useMutation({
    mutationFn: (custom?: string) => invoke({ action: "set_password", password: custom ?? "" }),
    onSuccess: (data) => {
      setGeneratedPw(data.password);
      setPw("");
      toast.success("Passwort gesetzt");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const sendReset = useMutation({
    mutationFn: () => invoke({
      action: "send_reset",
      redirect_to: `${window.location.origin}/set-password`,
    }),
    onSuccess: (data) => {
      setResetLink(data.action_link ?? null);
      toast.success("Reset-Link erzeugt");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const copy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("In Zwischenablage kopiert");
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{member.full_name || member.email}</DialogTitle>
        </DialogHeader>

        <div className="mb-4 flex gap-1 rounded-lg bg-muted p-1">
          <button
            onClick={() => setTab("profile")}
            className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition ${tab === "profile" ? "bg-background shadow-sm" : "text-muted-foreground"}`}
          >Profil</button>
          <button
            onClick={() => setTab("password")}
            className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition ${tab === "password" ? "bg-background shadow-sm" : "text-muted-foreground"}`}
          >Passwort</button>
        </div>

        {tab === "profile" ? (
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
                  {allowedRoles.map((r) => <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>)}
                </SelectContent>
              </Select>
              {!isSuperadmin && (
                <p className="mt-1 text-xs text-muted-foreground">
                  Nur Superadmin darf "Inhaber" oder "Administrator" vergeben.
                </p>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={onClose}>Abbrechen</Button>
              <Button onClick={() => saveProfile.mutate()} disabled={saveProfile.isPending}>
                {saveProfile.isPending ? "Speichern…" : "Speichern"}
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-lg border bg-muted/30 p-3">
              <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                <KeyRound className="h-4 w-4" /> Neues Passwort setzen
              </div>
              <div className="flex gap-2">
                <Input
                  type="text"
                  placeholder="Eigenes Passwort eingeben (mind. 8 Zeichen)"
                  value={pw}
                  onChange={(e) => setPw(e.target.value)}
                />
                <Button onClick={() => setPassword.mutate(pw)} disabled={setPassword.isPending || pw.length < 8}>
                  Setzen
                </Button>
              </div>
              <Button
                variant="secondary"
                className="mt-2 w-full"
                onClick={() => setPassword.mutate(undefined)}
                disabled={setPassword.isPending}
              >
                <RefreshCw className="mr-1 h-3 w-3" /> Sicheres Passwort generieren
              </Button>
              {generatedPw && (
                <div className="mt-3 rounded-md border bg-background p-2">
                  <p className="text-xs text-muted-foreground">Neues Passwort (jetzt kopieren — nur einmal sichtbar):</p>
                  <div className="mt-1 flex items-center gap-2">
                    <code className="flex-1 break-all rounded bg-muted px-2 py-1 text-sm font-mono">{generatedPw}</code>
                    <Button size="sm" variant="outline" onClick={() => copy(generatedPw)}>
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              )}
            </div>

            <div className="rounded-lg border bg-muted/30 p-3">
              <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                <Mail className="h-4 w-4" /> Reset-Link erzeugen
              </div>
              <p className="text-xs text-muted-foreground">
                Erzeugt einen Recovery-Link, den der Mitarbeiter zum Setzen eines neuen Passworts verwenden kann.
              </p>
              <Button
                className="mt-2 w-full"
                variant="secondary"
                onClick={() => sendReset.mutate()}
                disabled={sendReset.isPending}
              >
                Link erzeugen
              </Button>
              {resetLink && (
                <div className="mt-3 rounded-md border bg-background p-2">
                  <div className="flex items-center gap-2">
                    <code className="flex-1 truncate rounded bg-muted px-2 py-1 text-xs font-mono">{resetLink}</code>
                    <Button size="sm" variant="outline" onClick={() => copy(resetLink)}>
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={onClose}>Schließen</Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
