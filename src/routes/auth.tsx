import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { z } from "zod";
import bgNewbuild from "@/assets/login-bg-newbuild.jpg";

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>) => ({
    mode: (s.mode === "signup" ? "signup" : "signin") as "signin" | "signup",
  }),
  component: AuthPage,
});

const signinSchema = z.object({
  email: z.string().trim().email("Ungültige E-Mail").transform((v) => v.toLowerCase()),
  password: z.string().min(6, "Mindestens 6 Zeichen"),
});

function AuthPage() {
  const navigate = useNavigate();
  const { signIn, user, loading: authLoading, isSuperadmin, superadminStatus } = useAuth();
  const submittingRef = useRef(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ email: "", password: "" });
  const [stayLoggedIn, setStayLoggedIn] = useState(true);
  const [forgotMode, setForgotMode] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  useEffect(() => {
    // Nur eine bereits bestehende, gültige Session leitet weiter – nie Eingaben im Formular.
    if (!authLoading && user && superadminStatus !== "unknown") {
      navigate({ to: isSuperadmin && superadminStatus === "granted" ? "/oaax" : "/dashboard" });
    }
  }, [authLoading, user, isSuperadmin, superadminStatus, navigate]);

  const sendReset = async () => {
    if (!form.email) return;
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(form.email, {
        redirectTo: `${window.location.origin}/set-password`,
      });
      if (error) {
        toast.error(error.message);
        return;
      }
      setResetSent(true);
      toast.success("Reset-Link versendet");
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (forgotMode) {
      await sendReset();
      return;
    }
    if (submittingRef.current) return;
    const r = signinSchema.safeParse(form);
    if (!r.success) { toast.error(r.error.issues[0].message); return; }
    submittingRef.current = true;
    setLoading(true);
    try {
      const { error } = await signIn(r.data.email, form.password);
      if (error) {
        toast.error(/invalid login credentials/i.test(error) ? "E-Mail oder Passwort ist falsch." : error);
        return;
      }
    } finally { submittingRef.current = false; setLoading(false); }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-black p-6 overflow-hidden">
      {/* Hintergrund */}
      <div
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${bgNewbuild})` }}
        aria-hidden
      />

      {/* Leichte Vignette für Lesbarkeit der Karte */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: "radial-gradient(ellipse at center, rgba(0,0,0,0) 30%, rgba(0,0,0,0.45) 100%)" }}
        aria-hidden
      />

      {/* Login Karte */}
      <div className="relative z-10 w-full max-w-md rounded-3xl border border-primary/40 bg-primary/80 backdrop-blur-md p-8 text-primary-foreground shadow-2xl">
        <div className="mb-8 flex justify-center">
          <span className="font-display text-3xl font-bold tracking-tight">Immolia</span>
        </div>

        {authLoading ? (
          <p className="text-center text-sm text-primary-foreground/80">Sitzung wird geprüft…</p>
        ) : (
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <div>
            <Label htmlFor="email" className="text-primary-foreground">E-Mail</Label>
            <Input
              id="email"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="name@firma.ch"
              autoComplete="email"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              className="mt-1 border-white bg-white text-foreground placeholder:text-muted-foreground focus-visible:ring-white"
            />
          </div>

          {!forgotMode && (
            <div>
              <Label htmlFor="password" className="text-primary-foreground">Passwort</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="••••••••"
                className="mt-1 border-white bg-white text-foreground placeholder:text-muted-foreground focus-visible:ring-white"
              />
            </div>
          )}

          {forgotMode && (
            <div className="rounded-xl border border-white/20 bg-white/10 p-4 text-sm text-primary-foreground">
              <p className="mb-3">
                Gib deine E-Mail-Adresse ein. Wir senden dir einen Link, mit dem du ein neues Passwort setzen kannst.
              </p>
              {resetSent ? (
                <p className="font-medium text-green-300">✓ Link versendet. Bitte prüfe dein Postfach.</p>
              ) : (
                <Button
                  type="button"
                  onClick={sendReset}
                  disabled={!form.email || loading}
                  className="w-full bg-white text-black hover:bg-white/90"
                >
                  {loading ? "Bitte warten…" : "Reset-Link senden"}
                </Button>
              )}
              <button
                type="button"
                onClick={() => { setForgotMode(false); setResetSent(false); }}
                className="mt-3 text-xs underline hover:text-white"
              >
                Zurück zum Login
              </button>
            </div>
          )}

          {!forgotMode && (
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm text-primary-foreground/90 cursor-pointer">
                <Checkbox
                  checked={stayLoggedIn}
                  onCheckedChange={(v) => setStayLoggedIn(Boolean(v))}
                  className="border-white/50 data-[state=checked]:bg-brand-deep data-[state=checked]:text-brand-deep-foreground"
                />
                Angemeldet bleiben
              </label>
              <button
                type="button"
                onClick={() => setForgotMode(true)}
                className="text-xs text-primary-foreground/80 underline hover:text-primary-foreground"
              >
                Passwort vergessen?
              </button>
            </div>
          )}

          {!forgotMode && (
            <Button
              type="submit"
              size="lg"
              disabled={loading}
              className="w-full bg-brand-deep text-brand-deep-foreground hover:bg-brand-deep/90 shadow-lg"
            >
              {loading ? "Anmeldung läuft…" : "Anmelden"}
            </Button>
          )}
        </form>
        )}
      </div>

      <p className="absolute z-10 bottom-6 left-0 right-0 text-center text-xs text-white/70">
        Immolia — Powered by OAASE
      </p>
    </div>
  );
}
