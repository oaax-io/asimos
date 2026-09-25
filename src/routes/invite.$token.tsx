import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import {
  acceptInvitation, clearPendingInvite, INVITE_ROLE_LABEL, previewInvitation, rememberPendingInvite,
} from "@/lib/invitations";
import { resetTenantCache } from "@/lib/workspaces";

export const Route = createFileRoute("/invite/$token")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Einladung – Immolia" },
      { name: "description", content: "Einladung zu Immolia annehmen." },
      { name: "robots", content: "noindex, nofollow" },
      { property: "og:title", content: "Einladung – Immolia" },
      { property: "og:description", content: "Einladung zu Immolia annehmen." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: InvitePage,
});

const STATUS_TEXT: Record<string, string> = {
  invalid: "Dieser Einladungslink ist ungültig.",
  expired: "Diese Einladung ist abgelaufen. Bitte um eine neue Einladung bitten.",
  revoked: "Diese Einladung wurde widerrufen.",
  accepted: "Diese Einladung wurde bereits angenommen.",
};

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-md"><CardContent className="space-y-4 p-6">{children}</CardContent></Card>
    </div>
  );
}

function InvitePage() {
  const { token } = Route.useParams();
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [signup, setSignup] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [checkMail, setCheckMail] = useState(false);

  useEffect(() => { if (/^[a-f0-9]{64}$/.test(token)) rememberPendingInvite(token); }, [token]);

  const preview = useQuery({
    queryKey: ["invite-preview", token, user?.id ?? "anon"],
    enabled: !loading,
    queryFn: () => previewInvitation(token),
    retry: false,
  });

  const accept = async () => {
    setBusy(true);
    try {
      const r = await acceptInvitation(token);
      clearPendingInvite();
      resetTenantCache(qc);
      toast.success(r.outcome === "accepted" ? "Einladung angenommen" :
        r.outcome === "already_member" ? "Sie sind bereits Mitglied dieses Unternehmens." : "Sie haben bereits einen Plattformzugang.");
      navigate({ to: r.type === "platform_user" ? "/platform" : "/dashboard" });
    } catch (e) {
      toast.error((e as Error).message);
      void preview.refetch();
    } finally { setBusy(false); }
  };

  const doSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password.length < 8) return toast.error("Passwort: mindestens 8 Zeichen");
    setBusy(true);
    const { data, error } = await supabase.auth.signUp({
      email: form.email.trim().toLowerCase(), password: form.password,
      options: { emailRedirectTo: `${window.location.origin}/invite`, data: { full_name: form.name.trim() } },
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    if (!data.session) setCheckMail(true);
  };

  if (loading || preview.isLoading) return <Shell><p className="text-sm text-muted-foreground">Einen Moment …</p></Shell>;
  const p = preview.data;
  if (!p || p.status !== "pending") {
    clearPendingInvite();
    return <Shell><h1 className="text-lg font-semibold">Einladung</h1><p className="text-sm">{STATUS_TEXT[p?.status ?? "invalid"]}</p>
      <Button asChild variant="outline"><Link to="/auth" search={{ mode: "signin" }}>Zur Anmeldung</Link></Button></Shell>;
  }

  if (!user) {
    if (checkMail) return <Shell><h1 className="text-lg font-semibold">Bitte E-Mail bestätigen</h1>
      <p className="text-sm text-muted-foreground">Wir haben Ihnen eine Bestätigung gesendet. Nach der Bestätigung kehren Sie automatisch zur Einladung zurück.</p></Shell>;
    return (
      <Shell>
        <h1 className="text-lg font-semibold">Sie wurden zu Immolia eingeladen.</h1>
        <p className="text-sm text-muted-foreground">Melden Sie sich mit der eingeladenen E-Mail-Adresse an oder erstellen Sie ein Konto, um die Einladung anzunehmen.</p>
        {!signup ? (
          <div className="flex flex-col gap-2">
            <Button asChild><Link to="/auth" search={{ mode: "signin" }}>Anmelden</Link></Button>
            <Button variant="outline" onClick={() => setSignup(true)}>Konto erstellen</Button>
          </div>
        ) : (
          <form className="space-y-3" onSubmit={doSignup}>
            <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /></div>
            <div><Label>E-Mail (eingeladene Adresse)</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></div>
            <div><Label>Passwort</Label><Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required /></div>
            <div className="flex gap-2">
              <Button type="button" variant="ghost" onClick={() => setSignup(false)}>Zurück</Button>
              <Button type="submit" disabled={busy}>Konto erstellen</Button>
            </div>
          </form>
        )}
      </Shell>
    );
  }

  const role = p.role ? INVITE_ROLE_LABEL[p.role] ?? p.role : "";
  return (
    <Shell>
      <h1 className="text-lg font-semibold">Einladung annehmen</h1>
      <div className="rounded-md border p-3 text-sm">
        <div><span className="text-muted-foreground">{p.type === "platform_user" ? "Bereich" : "Unternehmen"}:</span> <span className="font-medium">{p.company_name ?? "–"}</span></div>
        <div><span className="text-muted-foreground">{p.type === "platform_user" ? "Plattformrolle" : "Rolle"}:</span> <span className="font-medium">{role}</span></div>
      </div>
      {p.email_match ? (
        <Button className="w-full" disabled={busy} onClick={accept}>{busy ? "Wird angenommen …" : "Einladung annehmen"}</Button>
      ) : (
        <>
          <p className="text-sm">Diese Einladung gilt für eine andere E-Mail-Adresse als die, mit der Sie angemeldet sind ({user.email}).</p>
          <Button variant="outline" onClick={() => { void signOut(); }}>Abmelden und mit anderer Adresse anmelden</Button>
        </>
      )}
    </Shell>
  );
}
