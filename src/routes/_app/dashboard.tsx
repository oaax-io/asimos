import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Building2, Users, UserPlus, CheckSquare, CalendarDays, FileSignature,
  ArrowRight, Plus, Upload, Sparkles, AlertTriangle, Clock, ChevronDown,
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  formatCurrency, formatDateTime, formatDate,
  propertyStatusLabels, propertyTypeLabels, leadStatusLabels,
} from "@/lib/format";
import { isBackendUnavailableError } from "@/lib/backend-errors";

export const Route = createFileRoute("/_app/dashboard")({
  component: Dashboard,
});

// ---------- helpers ----------
const startOfToday = () => { const d = new Date(); d.setHours(0,0,0,0); return d.toISOString(); };
const endOfToday = () => { const d = new Date(); d.setHours(23,59,59,999); return d.toISOString(); };
const sevenDaysAgo = () => { const d = new Date(); d.setDate(d.getDate()-7); return d.toISOString(); };

function unwrap<T>(res: { data: T | null; error: any; count?: number | null }) {
  if (res.error) {
    if (isBackendUnavailableError(res.error)) return { data: null, count: 0, unavailable: true };
    throw res.error;
  }
  return { data: res.data, count: res.count ?? 0, unavailable: false };
}

// ---------- KPI ----------
function KpiCard({ icon: Icon, label, value, hint, accent, loading, to }: {
  icon: any; label: string; value: number | string; hint?: string;
  accent?: string; loading?: boolean; to?: string;
}) {
  const inner = (
    <Card className="group transition hover:border-primary/40 hover:shadow-md">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="min-w-0">
            <p className="text-sm text-muted-foreground">{label}</p>
            {loading ? (
              <Skeleton className="mt-2 h-8 w-16" />
            ) : (
              <p className="mt-2 font-display text-3xl font-bold tracking-tight">{value}</p>
            )}
            {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
          </div>
          <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${accent ?? "bg-accent text-primary"}`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
  return to ? <Link to={to}>{inner}</Link> : inner;
}

// ---------- main ----------
function Dashboard() {
  const kpis = useQuery({
    queryKey: ["dashboard", "kpis"],
    queryFn: async () => {
      const [newLeads, clients, activeProps, openTasks, todayAppts, activeRes] = await Promise.all([
        supabase.from("leads").select("id", { count: "exact", head: true }).gte("created_at", sevenDaysAgo()),
        supabase.from("clients").select("id", { count: "exact", head: true }),
        supabase.from("properties").select("id", { count: "exact", head: true }).in("status", ["available", "active", "preparation"]),
        supabase.from("tasks").select("id", { count: "exact", head: true }).neq("status", "done"),
        supabase.from("appointments").select("id", { count: "exact", head: true })
          .gte("starts_at", startOfToday()).lte("starts_at", endOfToday()),
        supabase.from("reservations").select("id", { count: "exact", head: true })
          .in("status", ["draft", "sent", "signed"]),
      ]);
      return {
        newLeads: unwrap(newLeads).count,
        clients: unwrap(clients).count,
        activeProps: unwrap(activeProps).count,
        openTasks: unwrap(openTasks).count,
        todayAppts: unwrap(todayAppts).count,
        activeRes: unwrap(activeRes).count,
      };
    },
  });

  const today = useQuery({
    queryKey: ["dashboard", "today"],
    queryFn: async () => {
      const [appts, overdue, leads] = await Promise.all([
        supabase.from("appointments").select("id, title, starts_at, location")
          .gte("starts_at", startOfToday()).lte("starts_at", endOfToday()).order("starts_at").limit(6),
        supabase.from("tasks").select("id, title, due_date, priority")
          .neq("status", "done").lt("due_date", new Date().toISOString())
          .order("due_date").limit(6),
        supabase.from("leads").select("id, full_name, source, status, created_at")
          .order("created_at", { ascending: false }).limit(6),
      ]);
      return {
        appts: unwrap(appts).data ?? [],
        overdue: unwrap(overdue).data ?? [],
        leads: unwrap(leads).data ?? [],
      };
    },
  });

  const pipeline = useQuery({
    queryKey: ["dashboard", "pipeline"],
    queryFn: async () => {
      const [leads, props] = await Promise.all([
        supabase.from("leads").select("status"),
        supabase.from("properties").select("status"),
      ]);
      const leadCounts: Record<string, number> = {};
      (unwrap(leads).data ?? []).forEach((l: any) => { leadCounts[l.status] = (leadCounts[l.status] ?? 0) + 1; });
      const propCounts: Record<string, number> = {};
      (unwrap(props).data ?? []).forEach((p: any) => { propCounts[p.status] = (propCounts[p.status] ?? 0) + 1; });
      return { leadCounts, propCounts };
    },
  });

  const matches = useQuery({
    queryKey: ["dashboard", "matches"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("matches")
        .select("id, score, status, reasons, client_id, property_id")
        .order("score", { ascending: false })
        .limit(5);
      if (error) {
        if (isBackendUnavailableError(error)) return [];
        throw error;
      }
      const list = data ?? [];
      if (list.length === 0) return [];
      const clientIds = [...new Set(list.map((m: any) => m.client_id).filter(Boolean))];
      const propIds = [...new Set(list.map((m: any) => m.property_id).filter(Boolean))];
      const [clients, props] = await Promise.all([
        clientIds.length ? supabase.from("clients").select("id, full_name").in("id", clientIds) : Promise.resolve({ data: [], error: null }),
        propIds.length ? supabase.from("properties").select("id, title, city, price").in("id", propIds) : Promise.resolve({ data: [], error: null }),
      ]);
      const cMap = new Map((clients.data ?? []).map((c: any) => [c.id, c]));
      const pMap = new Map((props.data ?? []).map((p: any) => [p.id, p]));
      return list.map((m: any) => ({ ...m, client: cMap.get(m.client_id), property: pMap.get(m.property_id) }));
    },
  });

  const anyError = kpis.error || today.error || pipeline.error || matches.error;

  return (
    <>
      <PageHeader title="Dashboard" description="Übersicht über dein Tagesgeschäft" />

      <PageHeader
        title="Dashboard"
        description="Übersicht über dein Tagesgeschäft"
        action={
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm">
                <Plus className="mr-1 h-4 w-4" />
                Schnellaktionen
                <ChevronDown className="ml-1 h-4 w-4 opacity-70" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Neu erfassen</DropdownMenuLabel>
              <DropdownMenuItem asChild>
                <Link to="/leads"><UserPlus className="mr-2 h-4 w-4" />Lead erfassen</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/clients"><Users className="mr-2 h-4 w-4" />Kunde erfassen</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/properties"><Building2 className="mr-2 h-4 w-4" />Immobilie erfassen</Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link to="/appointments"><CalendarDays className="mr-2 h-4 w-4" />Termin erstellen</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/tasks"><CheckSquare className="mr-2 h-4 w-4" />Aufgabe erstellen</Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link to="/documents"><Upload className="mr-2 h-4 w-4" />Dokument hochladen</Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        }
      />

      {anyError && (
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>Beim Laden ist ein Fehler aufgetreten. Bitte aktualisiere die Seite.</span>
        </div>
      )}

      {/* KPI cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <KpiCard icon={UserPlus} label="Neue Leads" value={kpis.data?.newLeads ?? 0} hint="Letzte 7 Tage" loading={kpis.isLoading} to="/leads" />
        <KpiCard icon={Users} label="Aktive Kunden" value={kpis.data?.clients ?? 0} loading={kpis.isLoading} to="/clients" />
        <KpiCard icon={Building2} label="Aktive Immobilien" value={kpis.data?.activeProps ?? 0} loading={kpis.isLoading} to="/properties" />
        <KpiCard icon={CheckSquare} label="Offene Aufgaben" value={kpis.data?.openTasks ?? 0} loading={kpis.isLoading} to="/tasks" />
        <KpiCard icon={CalendarDays} label="Termine heute" value={kpis.data?.todayAppts ?? 0} loading={kpis.isLoading} to="/appointments" />
        <KpiCard icon={FileSignature} label="Reservationen" value={kpis.data?.activeRes ?? 0} hint="Aktiv" loading={kpis.isLoading} to="/reservations" />
      </div>

      {/* Today panel */}
      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <TodayList
          title="Termine heute"
          icon={CalendarDays}
          loading={today.isLoading}
          empty="Keine Termine heute."
          items={today.data?.appts ?? []}
          render={(a: any) => (
            <Link key={a.id} to="/appointments" className="block rounded-lg border p-3 transition hover:bg-accent/40">
              <p className="truncate text-sm font-medium">{a.title}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {formatDateTime(a.starts_at)}{a.location ? ` · ${a.location}` : ""}
              </p>
            </Link>
          )}
        />
        <TodayList
          title="Überfällige Aufgaben"
          icon={Clock}
          loading={today.isLoading}
          empty="Keine überfälligen Aufgaben."
          items={today.data?.overdue ?? []}
          render={(t: any) => (
            <Link key={t.id} to="/tasks" className="block rounded-lg border p-3 transition hover:bg-accent/40">
              <div className="flex items-start justify-between gap-2">
                <p className="truncate text-sm font-medium">{t.title}</p>
                {t.priority && <Badge variant={t.priority === "high" || t.priority === "urgent" ? "destructive" : "secondary"} className="shrink-0 text-[10px]">{t.priority}</Badge>}
              </div>
              {t.due_date && <p className="mt-0.5 text-xs text-destructive">Fällig {formatDate(t.due_date)}</p>}
            </Link>
          )}
        />
        <TodayList
          title="Neue Leads"
          icon={UserPlus}
          loading={today.isLoading}
          empty="Noch keine Leads."
          items={today.data?.leads ?? []}
          render={(l: any) => (
            <Link key={l.id} to="/leads" className="block rounded-lg border p-3 transition hover:bg-accent/40">
              <div className="flex items-center justify-between gap-2">
                <p className="truncate text-sm font-medium">{l.full_name}</p>
                <Badge variant="secondary" className="shrink-0 text-[10px]">{leadStatusLabels[l.status as keyof typeof leadStatusLabels] ?? l.status}</Badge>
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">{l.source ?? "—"} · {formatDate(l.created_at)}</p>
            </Link>
          )}
        />
      </div>

      {/* Pipeline */}
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <PipelineCard
          title="Leads nach Status"
          to="/leads"
          loading={pipeline.isLoading}
          counts={pipeline.data?.leadCounts ?? {}}
          labels={leadStatusLabels as Record<string, string>}
          order={["new", "contacted", "qualified", "viewing_planned", "converted", "lost"]}
        />
        <PipelineCard
          title="Immobilien nach Status"
          to="/properties"
          loading={pipeline.isLoading}
          counts={pipeline.data?.propCounts ?? {}}
          labels={propertyStatusLabels as Record<string, string>}
          order={["draft", "preparation", "active", "available", "reserved", "sold", "rented", "archived"]}
        />
      </div>

      {/* Matching suggestions */}
      <Card className="mt-6">
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4 text-primary" />
            Matching-Vorschläge
          </CardTitle>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/matching" search={{ clientId: "" }}>Alle <ArrowRight className="ml-1 h-3 w-3" /></Link>
          </Button>
        </CardHeader>
        <CardContent>
          {matches.isLoading ? (
            <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
          ) : (matches.data ?? []).length === 0 ? (
            <EmptyState icon={Sparkles} text="Noch keine Matching-Vorschläge vorhanden." />
          ) : (
            <div className="divide-y">
              {(matches.data ?? []).map((m: any) => (
                <div key={m.id} className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">
                      {m.client?.full_name ?? "Unbekannter Kunde"}{" "}
                      <span className="text-muted-foreground">↔</span>{" "}
                      {m.property?.title ?? "Unbekannte Immobilie"}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {[m.property?.city, m.property?.price ? formatCurrency(Number(m.property.price)) : null].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="hidden w-24 sm:block">
                      <Progress value={Math.min(100, Math.round(Number(m.score) * (Number(m.score) > 1 ? 1 : 100)))} className="h-2" />
                    </div>
                    <Badge variant="secondary" className="shrink-0">
                      {Math.round(Number(m.score) * (Number(m.score) > 1 ? 1 : 100))}%
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}

// ---------- subcomponents ----------
function TodayList({ title, icon: Icon, items, render, loading, empty }: {
  title: string; icon: any; items: any[]; render: (i: any) => React.ReactNode;
  loading?: boolean; empty: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Icon className="h-4 w-4 text-primary" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)
        ) : items.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">{empty}</p>
        ) : (
          items.map(render)
        )}
      </CardContent>
    </Card>
  );
}

function PipelineCard({ title, to, counts, labels, order, loading }: {
  title: string; to: string; counts: Record<string, number>;
  labels: Record<string, string>; order: string[]; loading?: boolean;
}) {
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const rows = order.filter((k) => labels[k] !== undefined);
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-base">{title}</CardTitle>
        <Button variant="ghost" size="sm" asChild>
          <Link to={to}>Details <ArrowRight className="ml-1 h-3 w-3" /></Link>
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-6 w-full" />)
        ) : total === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Noch keine Daten vorhanden.</p>
        ) : (
          rows.map((key) => {
            const c = counts[key] ?? 0;
            const pct = total > 0 ? Math.round((c / total) * 100) : 0;
            return (
              <div key={key}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{labels[key]}</span>
                  <span className="font-medium tabular-nums">{c}</span>
                </div>
                <Progress value={pct} className="h-2" />
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}

function EmptyState({ icon: Icon, text }: { icon: any; text: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-accent text-muted-foreground">
        <Icon className="h-5 w-5" />
      </div>
      <p className="text-sm text-muted-foreground">{text}</p>
    </div>
  );
}
