import { createFileRoute, redirect, Link } from "@tanstack/react-router";
import { Building2, Sparkles, Users, Calendar, Target, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: "/dashboard" });
  },
  component: Landing,
});

function Feature({ icon: Icon, title, desc }: { icon: any; title: string; desc: string }) {
  return (
    <div className="rounded-2xl border bg-card p-6 shadow-soft transition hover:shadow-glow">
      <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-accent text-primary">
        <Icon className="h-5 w-5" />
      </div>
      <h3 className="font-semibold">{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{desc}</p>
    </div>
  );
}

function Landing() {
  return (
    <div className="min-h-screen bg-gradient-soft">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-brand text-primary-foreground">
            <Building2 className="h-5 w-5" />
          </div>
          <span className="font-display text-lg font-bold">Estatly</span>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost"><Link to="/auth" search={{ mode: "signin" }}>Anmelden</Link></Button>
          <Button asChild><Link to="/auth" search={{ mode: "signup" }}>Kostenlos starten</Link></Button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 pb-24 pt-12">
        <div className="mx-auto max-w-3xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs text-muted-foreground shadow-soft">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            Das CRM, das Makler lieben
          </div>
          <h1 className="mt-6 font-display text-5xl font-bold leading-tight tracking-tight md:text-6xl">
            Mehr Abschlüsse. <span className="text-gradient-brand">Weniger Chaos.</span>
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-lg text-muted-foreground">
            Leads, Kunden, Objekte, Termine und Exposés — alles in einer aufgeräumten Plattform mit smartem Matching.
          </p>
          <div className="mt-8 flex justify-center gap-3">
            <Button asChild size="lg" className="shadow-glow">
              <Link to="/auth" search={{ mode: "signup" }}>Jetzt starten</Link>
            </Button>
            <Button asChild size="lg" variant="outline"><Link to="/auth" search={{ mode: "signin" }}>Anmelden</Link></Button>
          </div>
        </div>

        <div className="mt-20 grid gap-4 md:grid-cols-3">
          <Feature icon={Users} title="Leads & Kunden" desc="Pipeline, Suchprofile, Aktivitätshistorie — alles an einem Ort." />
          <Feature icon={Building2} title="Immobilien" desc="Erfasse Objekte mit allen Details, Bildern und Status." />
          <Feature icon={Target} title="Smart Matching" desc="Automatischer Abgleich von Suchprofilen mit deinen Objekten." />
          <Feature icon={Calendar} title="Termine" desc="Besichtigungen, Calls und Meetings im Überblick." />
          <Feature icon={FileText} title="Exposé" desc="Professionelle Exposés in Sekunden generiert." />
          <Feature icon={Sparkles} title="Modern & schnell" desc="Aufgeräumtes UI, voll responsive, blitzschnell." />
        </div>
      </main>
    </div>
  );
}
