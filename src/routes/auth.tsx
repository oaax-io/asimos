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
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-black p-6">
      {/* Ambient glow */}
      <div className="pointer-events-none absolute -top-40 left-1/2 h-[500px] w-[500px] -translate-x-1/2 rounded-full bg-primary/30 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 right-1/4 h-[400px] w-[400px] rounded-full bg-primary/20 blur-3xl" />

      <div className="relative w-full max-w-md rounded-3xl border border-primary/40 bg-gradient-brand p-8 text-primary-foreground shadow-2xl shadow-primary/30 backdrop-blur-xl">
        <div className="mb-8 flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 backdrop-blur">
            <Building2 className="h-5 w-5" />
          </div>
          <span className="font-display text-xl font-bold">Estatly</span>
        </div>

        <h1 className="font-display text-3xl font-bold">Willkommen zurück</h1>
        <p className="mt-2 text-sm text-primary-foreground/80">
          Melde dich an, um fortzufahren.
        </p>

        <form onSubmit={onSubmit} className="mt-8 space-y-4">
          <div>
            <Label htmlFor="email" className="text-primary-foreground">E-Mail</Label>
            <Input
              id="email"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="du@beispiel.de"
              className="mt-1 border-white/30 bg-white/10 text-primary-foreground placeholder:text-primary-foreground/50 focus-visible:ring-white/50"
            />
          </div>
          <div>
            <Label htmlFor="password" className="text-primary-foreground">Passwort</Label>
            <Input
              id="password"
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder="••••••••"
              className="mt-1 border-white/30 bg-white/10 text-primary-foreground placeholder:text-primary-foreground/50 focus-visible:ring-white/50"
            />
          </div>
          <Button
            type="submit"
            size="lg"
            disabled={loading}
            className="w-full bg-black text-primary hover:bg-black/90 shadow-lg"
          >
            {loading ? "Bitte warten…" : "Anmelden"}
          </Button>
        </form>

        <p className="mt-6 text-center text-xs text-primary-foreground/70">
          Konten werden vom Administrator angelegt.
        </p>
      </div>
    </div>
  );
}
