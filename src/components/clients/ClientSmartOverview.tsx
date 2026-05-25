import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Heart, Building2, Calendar, CheckSquare, FileSignature, ClipboardList,
  AlertCircle, ArrowRight, Plus, Sparkles, Clock, CheckCircle2,
} from "lucide-react";
import { formatCurrency, formatDateTime, formatDate, propertyStatusLabels } from "@/lib/format";

interface Props {
  clientId: string;
  client: any;
  onJumpTab: (tab: string) => void;
}

export function ClientSmartOverview({ clientId, client, onJumpTab }: Props) {
  const { data: relationships = [] } = useQuery({
    queryKey: ["client_overview_rel", clientId],
    queryFn: async () => {
      const { data } = await supabase
        .from("client_relationships")
        .select("id, relationship_type, related:clients!client_relationships_related_client_id_fkey(id, full_name)")
        .eq("client_id", clientId);
      return data ?? [];
    },
  });

  const { data: properties = [] } = useQuery({
    queryKey: ["client_overview_props", clientId],
    queryFn: async () => {
      const [own, ownerships] = await Promise.all([
        supabase.from("properties").select("id,title,city,status,price").eq("seller_client_id", clientId),
        supabase.from("property_ownerships")
          .select("id, property:properties(id,title,city,status,price)")
          .eq("client_id", clientId).is("end_date", null),
      ]);
      const list: any[] = [];
      (own.data ?? []).forEach((p) => list.push({ ...p, _kind: "Eigene" }));
      (ownerships.data ?? []).forEach((o: any) => o.property && list.push({ ...o.property, _kind: "Eigentum" }));
      // dedupe
      const seen = new Set<string>();
      return list.filter((p) => p.id && !seen.has(p.id) && seen.add(p.id));
    },
  });

  const { data: appointments = [] } = useQuery({
    queryKey: ["client_overview_appts", clientId],
    queryFn: async () => {
      const { data } = await supabase.from("appointments").select("id,title,starts_at,status,location")
        .eq("client_id", clientId).order("starts_at", { ascending: true });
      return data ?? [];
    },
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ["client_overview_tasks", clientId],
    queryFn: async () => {
      const { data } = await supabase.from("tasks").select("id,title,status,due_date,priority")
        .eq("related_type", "client").eq("related_id", clientId)
        .order("due_date", { ascending: true, nullsFirst: false });
      return data ?? [];
    },
  });

  const { data: dossiers = [] } = useQuery({
    queryKey: ["client_overview_dossiers", clientId],
    queryFn: async () => {
      const { data } = await supabase.from("financing_dossiers")
        .select("id,title,completion_percent,dossier_status,quick_check_status,requested_mortgage,bank_name,updated_at")
        .eq("client_id", clientId).order("updated_at", { ascending: false });
      return data ?? [];
    },
  });

  const { data: disclosure } = useQuery({
    queryKey: ["client_overview_disc", clientId],
    queryFn: async () => {
      const { data } = await supabase.from("client_self_disclosures")
        .select("status,submitted_at,reviewed_at").eq("client_id", clientId).maybeSingle();
      return data;
    },
  });

  const now = new Date();
  const upcoming = appointments.filter((a: any) => new Date(a.starts_at) >= now);
  const openTasks = tasks.filter((t: any) => t.status !== "done");
  const overdueTasks = openTasks.filter((t: any) => t.due_date && new Date(t.due_date) < now);
  const dossier = dossiers[0] ?? null;

  // ---------- Smart Action Items ----------
  const actions: Array<{ icon: any; label: string; tone: "warn" | "info" | "good"; tab?: string; cta?: string }> = [];

  if (!client.email && !client.phone) {
    actions.push({ icon: AlertCircle, tone: "warn", label: "Keine Kontaktdaten – E-Mail oder Telefon erfassen", cta: "Stammdaten bearbeiten" });
  }
  if (overdueTasks.length > 0) {
    actions.push({ icon: AlertCircle, tone: "warn", label: `${overdueTasks.length} überfällige Aufgabe${overdueTasks.length > 1 ? "n" : ""}`, tab: "consulting", cta: "Aufgaben öffnen" });
  }
  if (!disclosure || disclosure.status === "draft") {
    actions.push({ icon: ClipboardList, tone: "info", label: "Selbstauskunft noch nicht versendet", tab: "disclosure", cta: "Link senden" });
  } else if (disclosure.status === "submitted" && !disclosure.reviewed_at) {
    actions.push({ icon: ClipboardList, tone: "info", label: "Selbstauskunft eingereicht – prüfen", tab: "disclosure", cta: "Prüfen" });
  }
  if (dossiers.length === 0) {
    actions.push({ icon: FileSignature, tone: "info", label: "Noch kein Finanzierungsdossier", tab: "financing", cta: "Dossier anlegen" });
  } else if (dossier && dossier.completion_percent < 80) {
    actions.push({ icon: FileSignature, tone: "info", label: `Finanzierungsdossier nur zu ${dossier.completion_percent}% vollständig`, tab: "financing", cta: "Fortsetzen" });
  }
  if (properties.length === 0 && (client.client_type === "seller" || client.client_type === "landlord")) {
    actions.push({ icon: Building2, tone: "info", label: "Verkäufer ohne zugewiesene Immobilie", tab: "properties", cta: "Immobilie hinzufügen" });
  }
  if (upcoming.length === 0 && appointments.length === 0) {
    actions.push({ icon: Calendar, tone: "info", label: "Noch kein Termin geplant", tab: "consulting", cta: "Termin anlegen" });
  }
  if (actions.length === 0) {
    actions.push({ icon: CheckCircle2, tone: "good", label: "Alles im grünen Bereich – keine offenen To-Dos." });
  }

  return (
    <div className="space-y-4">
      {/* Smart action panel */}
      <Card className="border-primary/30 bg-gradient-to-br from-primary/5 via-background to-background">
        <CardContent className="p-5">
          <div className="mb-3 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <h3 className="font-display text-lg font-semibold">Nächste Schritte</h3>
          </div>
          <div className="space-y-2">
            {actions.map((a, i) => {
              const Icon = a.icon;
              const toneCls =
                a.tone === "warn" ? "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400"
                : a.tone === "good" ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                : "border-border bg-background";
              return (
                <div key={i} className={`flex flex-wrap items-center justify-between gap-2 rounded-xl border p-3 ${toneCls}`}>
                  <div className="flex items-center gap-2 text-sm">
                    <Icon className="h-4 w-4 shrink-0" />
                    <span>{a.label}</span>
                  </div>
                  {a.tab && a.cta && (
                    <Button size="sm" variant="outline" onClick={() => onJumpTab(a.tab!)}>
                      {a.cta}<ArrowRight className="ml-1 h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Insight grid */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Beziehungen */}
        <SummaryCard
          icon={<Heart className="h-4 w-4" />}
          title="Beziehungen"
          count={relationships.length}
          empty="Keine verknüpften Personen"
          onOpen={() => onJumpTab("disclosure")}
        >
          {relationships.slice(0, 3).map((r: any) => (
            <Row key={r.id} primary={r.related?.full_name ?? "Unbekannt"} secondary={r.relationship_type} />
          ))}
        </SummaryCard>

        {/* Immobilien */}
        <SummaryCard
          icon={<Building2 className="h-4 w-4" />}
          title="Immobilien"
          count={properties.length}
          empty="Noch keine zugewiesene Immobilie"
          emptyAction={
            <Button size="sm" variant="outline" asChild>
              <Link to="/properties" search={{ sellerClientId: clientId }}>
                <Plus className="mr-1 h-3.5 w-3.5" />Hinzufügen
              </Link>
            </Button>
          }
          onOpen={() => onJumpTab("properties")}
        >
          {properties.slice(0, 3).map((p: any) => (
            <Row
              key={p.id}
              primary={p.title}
              secondary={`${p._kind} · ${p.city ?? "—"}${p.price ? " · " + formatCurrency(Number(p.price)) : ""}`}
              badge={propertyStatusLabels[p.status as keyof typeof propertyStatusLabels]}
            />
          ))}
        </SummaryCard>

        {/* Termine */}
        <SummaryCard
          icon={<Calendar className="h-4 w-4" />}
          title="Termine"
          count={upcoming.length}
          subtitle={appointments.length > 0 ? `${appointments.length} insgesamt` : undefined}
          empty="Kein Termin geplant"
          onOpen={() => onJumpTab("consulting")}
        >
          {upcoming.slice(0, 3).map((a: any) => (
            <Row
              key={a.id}
              primary={a.title}
              secondary={`${formatDateTime(a.starts_at)}${a.location ? " · " + a.location : ""}`}
              icon={<Clock className="h-3 w-3" />}
            />
          ))}
        </SummaryCard>

        {/* Aufgaben */}
        <SummaryCard
          icon={<CheckSquare className="h-4 w-4" />}
          title="Aufgaben"
          count={openTasks.length}
          subtitle={overdueTasks.length > 0 ? `${overdueTasks.length} überfällig` : undefined}
          subtitleTone={overdueTasks.length > 0 ? "warn" : undefined}
          empty="Keine offenen Aufgaben"
          onOpen={() => onJumpTab("consulting")}
        >
          {openTasks.slice(0, 3).map((t: any) => {
            const overdue = t.due_date && new Date(t.due_date) < now;
            return (
              <Row
                key={t.id}
                primary={t.title}
                secondary={t.due_date ? `Fällig ${formatDate(t.due_date)}` : "Ohne Fälligkeit"}
                badge={overdue ? "Überfällig" : undefined}
                badgeTone="warn"
              />
            );
          })}
        </SummaryCard>

        {/* Finanzierung */}
        <SummaryCard
          icon={<FileSignature className="h-4 w-4" />}
          title="Finanzierung"
          count={dossiers.length}
          subtitle={dossier ? `${dossier.completion_percent}% komplett` : undefined}
          empty="Kein Dossier vorhanden"
          onOpen={() => onJumpTab("financing")}
        >
          {dossiers.slice(0, 3).map((d: any) => (
            <Row
              key={d.id}
              primary={d.title || `Dossier ${formatDate(d.updated_at)}`}
              secondary={`${d.requested_mortgage ? formatCurrency(Number(d.requested_mortgage)) : "—"}${d.bank_name ? " · " + d.bank_name : ""}`}
              badge={`${d.completion_percent}%`}
            />
          ))}
        </SummaryCard>

        {/* Selbstauskunft */}
        <SummaryCard
          icon={<ClipboardList className="h-4 w-4" />}
          title="Selbstauskunft"
          count={disclosure ? 1 : 0}
          subtitle={
            disclosure
              ? disclosure.reviewed_at ? "Geprüft"
              : disclosure.submitted_at ? "Eingereicht"
              : disclosure.status
              : undefined
          }
          empty="Noch nicht versendet"
          onOpen={() => onJumpTab("disclosure")}
        >
          {disclosure && (
            <Row
              primary={
                disclosure.reviewed_at
                  ? `Geprüft am ${formatDate(disclosure.reviewed_at)}`
                  : disclosure.submitted_at
                  ? `Eingereicht am ${formatDate(disclosure.submitted_at)}`
                  : `Status: ${disclosure.status}`
              }
              secondary=""
            />
          )}
        </SummaryCard>
      </div>
    </div>
  );
}

function SummaryCard({
  icon, title, count, subtitle, subtitleTone, empty, emptyAction, children, onOpen,
}: {
  icon: React.ReactNode;
  title: string;
  count: number;
  subtitle?: string;
  subtitleTone?: "warn";
  empty: string;
  emptyAction?: React.ReactNode;
  children?: React.ReactNode;
  onOpen?: () => void;
}) {
  return (
    <Card className="transition hover:border-primary/50">
      <CardContent className="p-5">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-muted-foreground">
            {icon}
            <h4 className="font-display text-sm font-semibold uppercase tracking-wide">{title}</h4>
            <Badge variant="secondary">{count}</Badge>
            {subtitle && (
              <span className={`text-xs ${subtitleTone === "warn" ? "text-amber-600 dark:text-amber-400 font-medium" : "text-muted-foreground"}`}>
                · {subtitle}
              </span>
            )}
          </div>
          {onOpen && count > 0 && (
            <Button size="sm" variant="ghost" onClick={onOpen} className="h-7 px-2 text-xs">
              Öffnen<ArrowRight className="ml-1 h-3 w-3" />
            </Button>
          )}
        </div>
        {count === 0 ? (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-dashed p-3">
            <p className="text-sm text-muted-foreground">{empty}</p>
            {emptyAction}
          </div>
        ) : (
          <div className="space-y-1.5">{children}</div>
        )}
      </CardContent>
    </Card>
  );
}

function Row({
  primary, secondary, badge, badgeTone, icon,
}: {
  primary: string;
  secondary?: string;
  badge?: string;
  badgeTone?: "warn";
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg border bg-background/50 px-3 py-2 text-sm">
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{primary}</p>
        {secondary && (
          <p className="flex items-center gap-1 truncate text-xs text-muted-foreground">
            {icon}{secondary}
          </p>
        )}
      </div>
      {badge && (
        <Badge
          variant={badgeTone === "warn" ? "destructive" : "outline"}
          className="shrink-0 text-[10px]"
        >
          {badge}
        </Badge>
      )}
    </div>
  );
}
