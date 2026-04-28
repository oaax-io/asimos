import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, Users, UserPlus, Calendar, ArrowRight, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDateTime, propertyTypeLabels, propertyStatusLabels } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { isBackendUnavailableError } from "@/lib/backend-errors";

export const Route = createFileRoute("/_app/dashboard")({
  component: Dashboard,
});

function StatCard({ icon: Icon, label, value, hint }: { icon: any; label: string; value: string | number; hint?: string }) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="mt-2 font-display text-3xl font-bold">{value}</p>
            {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
          </div>
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent text-primary">
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function Dashboard() {
  const stats = useQuery({
    queryKey: ["stats"],
    queryFn: async () => {
      const [leads, clients, properties, appts] = await Promise.all([
        supabase.from("leads").select("id", { count: "exact", head: true }),
        supabase.from("clients").select("id", { count: "exact", head: true }),
        supabase.from("properties").select("id, status", { count: "exact" }),
        supabase.from("appointments").select("id, starts_at").gte("starts_at", new Date().toISOString()).order("starts_at").limit(5),
      ]);

      const errors = [leads.error, clients.error, properties.error, appts.error].filter(Boolean);
      if (errors.some((error) => isBackendUnavailableError(error))) {
        return {
          leads: 0,
          clients: 0,
          properties: 0,
          available: 0,
          upcoming: [],
          unavailable: true,
        };
      }

      const available = (properties.data || []).filter(p => p.status === "available").length;
      return {
        leads: leads.count ?? 0,
        clients: clients.count ?? 0,
        properties: properties.count ?? 0,
        available,
        upcoming: appts.data ?? [],
        unavailable: false,
      };
    },
  });

  const recentProps = useQuery({
    queryKey: ["recent-properties"],
    queryFn: async () => {
      const { data, error } = await supabase.from("properties").select("*").order("created_at", { ascending: false }).limit(4);
      if (error && isBackendUnavailableError(error)) {
        return [];
      }
      return data ?? [];
    },
  });

  return (
    <>
      <PageHeader title="Dashboard" description="Überblick über deine Aktivitäten" />

      {stats.data?.unavailable ? (
        <div className="mb-4 rounded-xl border border-dashed bg-muted/30 p-4 text-sm text-muted-foreground">
          Backend aktuell nicht erreichbar. Die Übersicht wird automatisch wieder geladen, sobald die Verbindung stabil ist.
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={UserPlus} label="Leads" value={stats.data?.leads ?? "—"} hint="Gesamt" />
        <StatCard icon={Users} label="Kunden" value={stats.data?.clients ?? "—"} />
        <StatCard icon={Building2} label="Immobilien" value={stats.data?.properties ?? "—"} hint={`${stats.data?.available ?? 0} verfügbar`} />
        <StatCard icon={TrendingUp} label="Anstehende Termine" value={stats.data?.upcoming.length ?? "—"} />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Neueste Immobilien</CardTitle>
            <Button variant="ghost" size="sm" asChild><Link to="/properties">Alle <ArrowRight className="ml-1 h-3 w-3" /></Link></Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {(recentProps.data ?? []).length === 0 && (
              <p className="text-sm text-muted-foreground">Noch keine Immobilien erfasst.</p>
            )}
            {(recentProps.data ?? []).map((p) => (
              <Link key={p.id} to="/properties/$id" params={{ id: p.id }} className="flex items-center justify-between rounded-xl border p-3 transition hover:bg-accent/40">
                <div className="min-w-0">
                  <p className="truncate font-medium">{p.title}</p>
                  <p className="truncate text-xs text-muted-foreground">{[p.city, propertyTypeLabels[p.property_type as keyof typeof propertyTypeLabels]].filter(Boolean).join(" · ")}</p>
                </div>
                <div className="ml-3 flex items-center gap-3">
                  <Badge variant="secondary">{propertyStatusLabels[p.status as keyof typeof propertyStatusLabels]}</Badge>
                  <span className="font-semibold">{formatCurrency(p.price ? Number(p.price) : null)}</span>
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Anstehende Termine</CardTitle>
            <Button variant="ghost" size="sm" asChild><Link to="/appointments"><Calendar className="h-4 w-4" /></Link></Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {(stats.data?.upcoming ?? []).length === 0 && (
              <p className="text-sm text-muted-foreground">Keine anstehenden Termine.</p>
            )}
            {(stats.data?.upcoming ?? []).map((a: any) => (
              <div key={a.id} className="rounded-xl border p-3">
                <p className="text-sm font-medium">{formatDateTime(a.starts_at)}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
