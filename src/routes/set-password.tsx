import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";

export const Route = createFileRoute("/set-password")({ component: SetPasswordPage });

function SetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [saving, setSaving] = useState(false);
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    // Supabase puts the recovery/invite tokens in the URL hash on arrival.
    // The client picks them up automatically and creates a session.
    const check = async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        setEmail(data.session.user.email ?? null);
        setReady(true);
        return;
      }
      // Wait for hash-based session bootstrap (auth state change)
      const sub = supabase.auth.onAuthStateChange((_e, session) => {
        if (session) {
          setEmail(session.user.email ?? null);
          setReady(true);
        }
      });
      return () => sub.data.subscription.unsubscribe();
    };
    void check();
  }, []);

  const submit = async () => {
    if (pw.length < 8) return toast.error("Mindestens 8 Zeichen");
    if (pw !== pw2) return toast.error("Passwörter stimmen nicht überein");
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Passwort gesetzt – willkommen!");
    navigate({ to: "/dashboard" });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-soft p-4">
      <Card className="w-full max-w-md">
        <CardContent className="space-y-4 p-6">
          <div>
            <h1 className="text-xl font-semibold">Passwort festlegen</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {email ? <>Für <span className="font-medium">{email}</span></> : "Lege dein Passwort fest, um loszulegen."}
            </p>
          </div>

          {!ready ? (
            <div className="py-8 text-center text-sm text-muted-foreground">Einladung wird verifiziert…</div>
          ) : (
            <>
              <div>
                <Label>Neues Passwort</Label>
                <Input type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="min. 8 Zeichen" />
              </div>
              <div>
                <Label>Passwort bestätigen</Label>
                <Input type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} />
              </div>
              <Button className="w-full" onClick={submit} disabled={saving}>
                {saving ? "Speichern…" : "Passwort speichern & einloggen"}
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
