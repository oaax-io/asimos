import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { z } from "zod";
import logo from "@/assets/logo-asimo.png";

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>) => ({
    mode: (s.mode === "signup" ? "signup" : "signin") as "signin" | "signup",
  }),
  component: AuthPage,
});

const signinSchema = z.object({
  email: z.string().trim().email("Ungültige E-Mail").transform((value) => value.toLowerCase()),
  password: z.string().min(6, "Mindestens 6 Zeichen"),
});

function AuthPage() {
  const navigate = useNavigate();
  const { signIn, user, isSuperadmin, superadminStatus } = useAuth();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ email: "", password: "" });
  const [stayLoggedIn, setStayLoggedIn] = useState(true);

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
      const { error } = await signIn(r.data.email, form.password);
      if (error) { toast.error(error); return; }
    } finally { setLoading(false); }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-black p-6">
      <div className="w-full max-w-md rounded-3xl border border-primary/40 bg-primary p-8 text-primary-foreground shadow-2xl">
        <div className="mb-8 flex justify-center">
          <img src={logo} alt="ASIMO" className="h-16 w-auto" />
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <Label htmlFor="email" className="text-primary-foreground">E-Mail</Label>
            <Input
              id="email"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="mail@asimo.ch"
              autoComplete="email"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              className="mt-1 border-white bg-white text-foreground placeholder:text-muted-foreground focus-visible:ring-white"
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
              className="mt-1 border-white bg-white text-foreground placeholder:text-muted-foreground focus-visible:ring-white"
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-primary-foreground/90 cursor-pointer">
            <Checkbox
              checked={stayLoggedIn}
              onCheckedChange={(v) => setStayLoggedIn(Boolean(v))}
              className="border-white/50 data-[state=checked]:bg-black data-[state=checked]:text-primary"
            />
            Angemeldet bleiben
          </label>

          <Button
            type="submit"
            size="lg"
            disabled={loading}
            className="w-full bg-black text-primary hover:bg-black/90 shadow-lg"
          >
            {loading ? "Bitte warten…" : "Login"}
          </Button>
        </form>
      </div>

      <p className="absolute bottom-6 left-0 right-0 text-center text-xs text-white/60">
        ASIMO Treuhand AG — SaaS Powered by OAASE
      </p>
    </div>
  );
}
