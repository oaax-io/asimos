import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { z } from "zod";

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>) => ({
    mode: (s.mode === "signup" ? "signup" : "signin") as "signin" | "signup",
  }),
  component: AuthPage,
});

const signinSchema = z.object({
  email: z.string().email("Ungültige E-Mail"),
  password: z.string().min(6, "Mindestens 6 Zeichen"),
});

function AuthPage() {
  const navigate = useNavigate();
  const { signIn, user, isSuperadmin, superadminStatus } = useAuth();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ email: "", password: "" });

  useEffect(() => {
    if (user && superadminStatus !== "unknown") {
      navigate({ to: isSuperadmin && superadminStatus === "granted" ? "/oaax" : "/dashboard" });
    }
  }, [user, isSuperadmin, superadminStatus, navigate]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const r = signinSchema.safeParse(form);
      if (!r.success) { toast.error(r.error.issues[0].message); return; }
      const { error } = await signIn(form.email, form.password);
      if (error) { toast.error(error); return; }
    } finally { setLoading(false); }
  };

  return (
    <div className="flex min-h-screen bg-gradient-soft">
      <div className="hidden flex-1 flex-col justify-between bg-gradient-brand p-12 text-primary-foreground lg:flex">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/20 backdrop-blur">
            <Building2 className="h-5 w-5" />
          </div>
          <span className="font-display text-lg font-bold">Estatly</span>
        </div>
        <div>
          <h2 className="font-display text-4xl font-bold leading-tight">
            Dein digitales Maklerbüro.
          </h2>
          <p className="mt-3 max-w-md text-lg text-white/85">
            Verwalte Leads, Kunden, Objekte und Termine — und finde mit einem Klick die passende Immobilie für jeden Kunden.
          </p>
        </div>
        <p className="text-sm text-white/70">© Estatly</p>
      </div>

      <div className="flex flex-1 items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="mb-8 lg:hidden">
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-brand text-primary-foreground">
                <Building2 className="h-5 w-5" />
              </div>
              <span className="font-display text-lg font-bold">Estatly</span>
            </div>
          </div>
          <h1 className="font-display text-3xl font-bold">Willkommen zurück</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Melde dich an, um fortzufahren.
          </p>

          <form onSubmit={onSubmit} className="mt-8 space-y-4">
            <div>
              <Label htmlFor="email">E-Mail</Label>
              <Input id="email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="du@beispiel.de" />
            </div>
            <div>
              <Label htmlFor="password">Passwort</Label>
              <Input id="password" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="••••••••" />
            </div>
            <Button type="submit" className="w-full shadow-glow" size="lg" disabled={loading}>
              {loading ? "Bitte warten…" : "Anmelden"}
            </Button>
          </form>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            Konten werden vom Administrator angelegt.
          </p>
        </div>
      </div>
    </div>
  );
}
