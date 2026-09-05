// ---------------------------------------------------------------------------
// Provisions-Modul – Etappe 3: Auswertung.
// Zeigt reale, gebuchte Provisionen (aus `commission_records` /
// `commission_record_splits`) getrennt vom weiterhin live berechneten
// "Provisionspotenzial" (Pipeline aus aktiven Objekten × Mandatssatz).
// ---------------------------------------------------------------------------
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Percent, Coins, FileCheck2, Ban, TrendingUp, AlertTriangle } from "lucide-react";
import { formatCurrency, formatDate, propertyStatusLabels } from "@/lib/format";
import { SPLIT_ROLE_LABELS } from "@/components/commission/CommissionSplitEditor";
import { useIsCommissionAdmin } from "@/hooks/useIsCommissionAdmin";

export const Route = createFileRoute("/_app/commissions")({ component: CommissionsPage });

// ----- Zeitraum-Filter (gleiches Muster wie Analytics) -----
type Period = "all" | "year" | "quarter" | "month";

function periodStart(p: Period): Date | null {
  const now = new Date();
  if (p === "year") return new Date(now.getFullYear(), 0, 1);
  if (p === "month") return new Date(now.getFullYear(), now.getMonth(), 1);
  if (p === "quarter") return new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
  return null;
}

const ACTIVE_MANDATE_STATUS = ["active", "signed", "sent"];

function useCommissionData() {
  return useQuery({
    queryKey: ["commissions", "all"],
    queryFn: async () => {
      const [records, splits, properties, mandates, planSplits, profiles, targets, clients] =
        await Promise.all([
          supabase
            .from("commission_records")
            .select("id,property_id,mandate_id,reservation_id,client_id,record_type,status,gross_amount,credited_reservation_record_id,booked_at,description")
            .order("booked_at", { ascending: false })
            .limit(5000),
          supabase
            .from("commission_record_splits")
            .select("id,commission_record_id,user_id,role,split_percent,gross_share,payout_rate,payout_amount")
            .limit(20000),
          supabase
            .from("properties")
            .select("id,title,status,listing_type,price,assigned_to,owner_id")
            .limit(5000),
          supabase
            .from("mandates")
            .select("id,property_id,client_id,status,commission_model,commission_value,cancellation_fee")
            .limit(5000),
          supabase
            .from("mandate_commission_splits")
            .select("id,property_id,mandate_id,user_id,role,split_percent")
            .limit(20000),
          supabase
            .from("profiles")
            .select("id,full_name,email,commission_tier,commission_payout_rate,is_active")
            .limit(1000),
          supabase
            .from("commission_targets")
            .select("id,user_id,period_type,period_start,period_end,target_amount,target_deals")
            .limit(5000),
          supabase.from("clients").select("id,full_name").limit(5000),
        ]);
      return {
        records: (records.data ?? []) as any[],
        splits: (splits.data ?? []) as any[],
        properties: (properties.data ?? []) as any[],
        mandates: (mandates.data ?? []) as any[],
        planSplits: (planSplits.data ?? []) as any[],
        profiles: (profiles.data ?? []) as any[],
        targets: (targets.data ?? []) as any[],
        clients: (clients.data ?? []) as any[],
      };
    },
  });
}

/** Live-Potenzial eines Objekts (Pipeline) – nur aktive, nicht abgeschlossene Objekte. */
function potentialForProperty(p: any, mandates: any[]): number {
  if (p.listing_type !== "sale" || !p.price) return 0;
  if (["archived", "sold", "rented"].includes(p.status)) return 0;
  const m = mandates.find((x) => x.property_id === p.id && x.commission_value != null);
  if (m) {
    if (m.commission_model === "fixed") return Number(m.commission_value) || 0;
    if (m.commission_model === "percent") return (Number(p.price) * Number(m.commission_value)) / 100;
  }
  return Number(p.price) * 0.03;
}

const KPI_TONES: Record<string, { card: string; icon: string; value: string }> = {
  primary: { card: "border-primary/30 bg-primary/5", icon: "bg-primary/15 text-primary", value: "text-primary" },
  emerald: { card: "border-emerald-500/30 bg-emerald-500/5", icon: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400", value: "text-emerald-600 dark:text-emerald-400" },
  rose: { card: "border-rose-500/30 bg-rose-500/5", icon: "bg-rose-500/15 text-rose-600 dark:text-rose-400", value: "text-rose-600 dark:text-rose-400" },
  sky: { card: "border-sky-500/30 bg-sky-500/5", icon: "bg-sky-500/15 text-sky-600 dark:text-sky-400", value: "text-sky-600 dark:text-sky-400" },
  amber: { card: "border-amber-500/40 bg-amber-500/10", icon: "bg-amber-500/15 text-amber-600 dark:text-amber-400", value: "text-amber-600 dark:text-amber-400" },
};

function KpiCard({ icon: Icon, label, value, hint, loading, tone = "primary" }: {
  icon: any; label: string; value: string | number; hint?: string; loading?: boolean;
  tone?: keyof typeof KPI_TONES;
}) {
  const t = KPI_TONES[tone] ?? KPI_TONES.primary;
  return (
    <Card className={`overflow-hidden shadow-sm transition-shadow hover:shadow-md ${t.card}`}>
      <CardContent className="p-3 sm:p-4">
        <div className="flex items-start justify-between gap-2">
          <div className={`shrink-0 rounded-lg p-2 ${t.icon}`}>
            <Icon className="h-4 w-4" />
          </div>
        </div>
        <p className="mt-2 text-[11px] font-semibold uppercase leading-tight tracking-wider text-muted-foreground sm:text-xs">
          {label}
        </p>
        {loading ? (
          <Skeleton className="mt-2 h-7 w-24" />
        ) : (
          <p className={`mt-1 break-words text-xl font-bold tabular-nums sm:text-2xl ${t.value}`}>{value}</p>
        )}
        {hint && <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}


function CommissionsPage() {
  const [period, setPeriod] = useState<Period>("all");
  const [employee, setEmployee] = useState<string>("all");
  const { isCommissionAdmin, userId: myUserId } = useIsCommissionAdmin();
  const { data, isLoading } = useCommissionData();


  const since = periodStart(period);
  const nameOf = (id: string | null) =>
    data?.profiles.find((p: any) => p.id === id)?.full_name ||
    data?.profiles.find((p: any) => p.id === id)?.email ||
    "Unbekannt";

  // Buchungen im gewählten Zeitraum (nach booked_at) und ohne stornierte
  const records = useMemo(() => {
    if (!data) return [];
    return data.records.filter(
      (r) => r.status !== "void" && (!since || (r.booked_at && new Date(r.booked_at) >= since)),
    );
  }, [data, since]);

  const recById = useMemo(() => new Map(records.map((r) => [r.id, r])), [records]);

  const splitsInPeriod = useMemo(
    () => (data?.splits ?? []).filter((s: any) => recById.has(s.commission_record_id)),
    [data, recById],
  );

  const sumBy = (type: string) =>
    records.filter((r) => r.record_type === type).reduce((s, r) => s + (Number(r.gross_amount) || 0), 0);

  // ---- KPIs ----
  const kpis = useMemo(() => {
    if (!data) return null;
    const potential = data.properties.reduce((s, p) => s + potentialForProperty(p, data.mandates), 0);
    const closedIds = new Set(
      data.records.filter((r) => r.record_type === "commission" && r.status !== "void").map((r) => r.property_id),
    );
    const missing = data.properties.filter(
      (p) => ["sold", "rented"].includes(p.status) && !closedIds.has(p.id),
    );
    return {
      commission: sumBy("commission"),
      reservation: sumBy("reservation_fee"),
      cancellation: sumBy("cancellation_fee"),
      potential,
      missing,
    };
  }, [data, records]);

  // ---- Tab: Pro Mitarbeiter ----
  const employeeRows = useMemo(() => {
    if (!data) return [];
    const map = new Map<string, any>();
    const ensure = (id: string) => {
      if (!map.has(id)) {
        const prof = data.profiles.find((p: any) => p.id === id);
        map.set(id, {
          id,
          name: prof?.full_name || prof?.email || "Unbekannt",
          tier: prof?.commission_tier || "—",
          commission: 0,
          reservation: 0,
          cancellation: 0,
          payout: 0,
          potential: 0,
          deals: 0,
        });
      }
      return map.get(id);
    };

    // Reale Buchungen
    splitsInPeriod.forEach((s: any) => {
      const rec = recById.get(s.commission_record_id);
      if (!rec) return;
      const row = ensure(s.user_id);
      const share = Number(s.gross_share) || 0;
      if (rec.record_type === "commission") {
        row.commission += share;
        row.deals += 1;
      }
      if (rec.record_type === "reservation_fee") row.reservation += share;
      if (rec.record_type === "cancellation_fee") row.cancellation += share;
      row.payout += Number(s.payout_amount) || 0;
    });

    // Pipeline-Potenzial (live), anteilig nach Planung, sonst assigned_to
    data.properties.forEach((p: any) => {
      const pot = potentialForProperty(p, data.mandates);
      if (!pot) return;
      const plan = data.planSplits.filter((s: any) => s.property_id === p.id && s.user_id);
      if (plan.length) {
        plan.forEach((s: any) => {
          ensure(s.user_id).potential += (pot * (Number(s.split_percent) || 0)) / 100;
        });
      } else {
        const id = p.assigned_to || p.owner_id;
        if (id) ensure(id).potential += pot;
      }
    });

    // Ziele der aktuellen Periode
    const today = new Date().toISOString().slice(0, 10);
    map.forEach((row, id) => {
      const target = data.targets.find(
        (t: any) => t.user_id === id && t.period_start <= today && t.period_end >= today,
      );
      if (!target) return;
      // gebuchte Provision im Ziel-Zeitraum (unabhängig vom Filter oben)
      let achieved = 0;
      let deals = 0;
      data.splits.forEach((s: any) => {
        if (s.user_id !== id) return;
        const rec = data.records.find((r: any) => r.id === s.commission_record_id);
        if (!rec || rec.status === "void" || rec.record_type !== "commission" || !rec.booked_at) return;
        const d = rec.booked_at.slice(0, 10);
        if (d < target.period_start || d > target.period_end) return;
        achieved += Number(s.gross_share) || 0;
        deals += 1;
      });
      row.target = target;
      row.achieved = achieved;
      row.targetDeals = deals;
    });

    let rows = Array.from(map.values());
    // Nicht-Admins sehen ausschliesslich ihre eigene Zeile.
    if (!isCommissionAdmin) rows = rows.filter((r) => r.id === myUserId);
    else if (employee !== "all") rows = rows.filter((r) => r.id === employee);
    return rows.sort((a, b) => b.commission - a.commission);
  }, [data, splitsInPeriod, recById, employee, isCommissionAdmin, myUserId]);

  // ---- Tab: Pro Objekt ----
  const propertyRows = useMemo(() => {
    if (!data) return [];
    const ids = new Set<string>([
      ...data.records.map((r: any) => r.property_id).filter(Boolean),
      ...data.mandates.map((m: any) => m.property_id).filter(Boolean),
    ]);
    return Array.from(ids).map((pid) => {
      const prop = data.properties.find((p: any) => p.id === pid);
      const mandate =
        data.mandates.find((m: any) => m.property_id === pid && ACTIVE_MANDATE_STATUS.includes(m.status)) ||
        data.mandates.find((m: any) => m.property_id === pid);
      const recs = data.records.filter((r: any) => r.property_id === pid && r.status !== "void");
      const commission = recs.find((r: any) => r.record_type === "commission");
      const reservation = recs.find((r: any) => r.record_type === "reservation_fee");
      const cancellation = recs.find((r: any) => r.record_type === "cancellation_fee");
      const planned = data.planSplits.filter((s: any) => s.property_id === pid && s.user_id);
      const bookedSplits = commission
        ? data.splits.filter((s: any) => s.commission_record_id === commission.id)
        : [];
      return {
        id: pid,
        title: prop?.title || "Unbekanntes Objekt",
        status: prop?.status,
        mandate,
        commission,
        reservation,
        cancellation,
        credited: !!(commission && reservation && commission.credited_reservation_record_id === reservation.id),
        splits: (bookedSplits.length ? bookedSplits : planned).map((s: any) => ({
          name: nameOf(s.user_id),
          percent: Number(s.split_percent) || 0,
        })),
      };
    }).sort((a, b) => Number(!!b.commission) - Number(!!a.commission));
  }, [data]);

  // ---- Tab: Rücktritte ----
  const cancellations = useMemo(
    () => records.filter((r) => r.record_type === "cancellation_fee"),
    [records],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        i18nKey="commissions"
        title={
          <span className="inline-flex items-center gap-2.5">
            <Percent className="h-8 w-8 text-[#6F6B94]" />
            Provisionen
          </span>
        }
      />

      {/* Filter */}
      <Card>
        <CardContent className="flex flex-wrap items-end gap-3 p-4">
          <div className="min-w-[160px]">
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Zeitraum</label>
            <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle</SelectItem>
                <SelectItem value="year">Dieses Jahr</SelectItem>
                <SelectItem value="quarter">Dieses Quartal</SelectItem>
                <SelectItem value="month">Dieser Monat</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {isCommissionAdmin && (
          <div className="min-w-[200px]">
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Mitarbeiter</label>
            <Select value={employee} onValueChange={setEmployee}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle</SelectItem>
                {(data?.profiles ?? []).map((p: any) => (
                  <SelectItem key={p.id} value={p.id}>{p.full_name || p.email}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          )}
        </CardContent>
      </Card>

      {/* KPIs */}
      <div className={`grid grid-cols-2 gap-3 md:grid-cols-3 ${isCommissionAdmin ? "lg:grid-cols-5" : "lg:grid-cols-4"}`}>
        <KpiCard icon={Coins} label="Gebuchte Provision" value={formatCurrency(kpis?.commission ?? 0)} hint="real verbucht" loading={isLoading} />
        <KpiCard icon={FileCheck2} label="Reservationsgebühren" value={formatCurrency(kpis?.reservation ?? 0)} hint="gebucht" loading={isLoading} />
        <KpiCard icon={Ban} label="Rücktrittsentschädigungen" value={formatCurrency(kpis?.cancellation ?? 0)} hint="gebucht" loading={isLoading} />
        <KpiCard icon={TrendingUp} label="Provisionspotenzial" value={formatCurrency(kpis?.potential ?? 0)} hint="Potenzial, noch nicht gebucht" loading={isLoading} />
        {isCommissionAdmin && (
          <KpiCard
            icon={AlertTriangle}
            label="Ohne gebuchte Provision"
            value={kpis?.missing.length ?? 0}
            hint="verkauft / vermietet"
            loading={isLoading}
            tone={(kpis?.missing.length ?? 0) > 0 ? "warn" : undefined}
          />
        )}
      </div>

      <Tabs defaultValue="employees">
        <TabsList>
          <TabsTrigger value="employees">{isCommissionAdmin ? "Pro Mitarbeiter" : "Meine Provision"}</TabsTrigger>
          <TabsTrigger value="properties">{isCommissionAdmin ? "Pro Objekt" : "Meine Objekte"}</TabsTrigger>
          <TabsTrigger value="cancellations">{isCommissionAdmin ? "Rücktritte & Stornierungen" : "Meine Rücktrittsfälle"}</TabsTrigger>
        </TabsList>

        {/* ---- Pro Mitarbeiter ---- */}
        <TabsContent value="employees">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{isCommissionAdmin ? "Mitarbeiter" : "Meine Provision"}</TableHead>
                    <TableHead>Stufe</TableHead>
                    <TableHead className="text-right">Provision generiert</TableHead>
                    <TableHead className="text-right">davon Reservation</TableHead>
                    <TableHead className="text-right">davon Rücktritt</TableHead>
                    <TableHead className="text-right">Persönliche Auszahlung</TableHead>
                    <TableHead className="text-right">Potenzial</TableHead>
                    <TableHead className="min-w-[200px]">Ziel</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {employeeRows.length === 0 ? (
                    <TableRow><TableCell colSpan={8} className="py-8 text-center text-sm text-muted-foreground">Keine Daten</TableCell></TableRow>
                  ) : employeeRows.map((r) => {
                    const pct = r.target?.target_amount
                      ? Math.min(100, Math.round((r.achieved / Number(r.target.target_amount)) * 100))
                      : null;
                    return (
                      <TableRow key={r.id}>
                        <TableCell className="font-medium">{r.name}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{r.tier}</TableCell>
                        <TableCell className="text-right tabular-nums font-semibold">{formatCurrency(r.commission)}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatCurrency(r.reservation)}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatCurrency(r.cancellation)}</TableCell>
                        <TableCell className="text-right tabular-nums font-semibold text-primary">{formatCurrency(r.payout)}</TableCell>
                        <TableCell className="text-right tabular-nums text-muted-foreground">{formatCurrency(r.potential)}</TableCell>
                        <TableCell>
                          {!r.target ? (
                            <span className="text-xs text-muted-foreground">Kein Ziel erfasst</span>
                          ) : (
                            <div className="space-y-1">
                              <div className="flex items-center justify-between text-xs">
                                <span className="tabular-nums">{formatCurrency(r.achieved)} / {formatCurrency(Number(r.target.target_amount) || 0)}</span>
                                <span className="font-medium">{pct ?? 0} %</span>
                              </div>
                              <Progress value={pct ?? 0} className="h-1.5" />
                              {r.target.target_deals ? (
                                <p className="text-xs text-muted-foreground">
                                  Abschlüsse: {r.targetDeals} / {r.target.target_deals}
                                </p>
                              ) : null}
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ---- Pro Objekt ---- */}
        <TabsContent value="properties">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Objekt</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Mandat</TableHead>
                    <TableHead className="text-right">Gebuchte Provision</TableHead>
                    <TableHead className="text-right">Reservationsgebühr</TableHead>
                    <TableHead className="text-right">Rücktritt</TableHead>
                    <TableHead>Beteiligte</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {propertyRows.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">Keine Daten</TableCell></TableRow>
                  ) : propertyRows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">
                        <Link to="/properties/$id" params={{ id: r.id }} className="hover:underline">{r.title}</Link>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{(propertyStatusLabels as any)[r.status ?? ""] || r.status || "—"}</Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {r.mandate
                          ? r.mandate.commission_model === "percent"
                            ? `${r.mandate.commission_value ?? 0} %`
                            : formatCurrency(Number(r.mandate.commission_value) || 0)
                          : "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {r.commission ? (
                          formatCurrency(Number(r.commission.gross_amount) || 0)
                        ) : ["sold", "rented"].includes(r.status ?? "") ? (
                          <span className="text-xs text-amber-600">noch nicht verbucht</span>
                        ) : "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {r.reservation ? (
                          <span>
                            {formatCurrency(Number(r.reservation.gross_amount) || 0)}
                            {r.credited && <span className="ml-1 text-xs text-muted-foreground">(angerechnet)</span>}
                          </span>
                        ) : "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {r.cancellation ? formatCurrency(Number(r.cancellation.gross_amount) || 0) : "—"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {r.splits.length
                          ? r.splits.map((s: any) => `${s.name} ${s.percent} %`).join(" / ")
                          : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ---- Rücktritte ---- */}
        <TabsContent value="cancellations">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Rücktritts- und Kündigungsentschädigungen</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Kunde</TableHead>
                    <TableHead>Objekt</TableHead>
                    <TableHead className="text-right">Betrag</TableHead>
                    <TableHead>Datum</TableHead>
                    <TableHead>Mandat</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cancellations.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">Keine Rücktritte verbucht</TableCell></TableRow>
                  ) : cancellations.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">
                        {data?.clients.find((c: any) => c.id === r.client_id)?.full_name || "—"}
                      </TableCell>
                      <TableCell>
                        {data?.properties.find((p: any) => p.id === r.property_id)?.title || "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-semibold">
                        {formatCurrency(Number(r.gross_amount) || 0)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{formatDate(r.booked_at)}</TableCell>
                      <TableCell>
                        <Link to="/mandates" className="text-sm text-primary hover:underline">Mandate öffnen</Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Legende Rollen */}
      <p className="text-xs text-muted-foreground">
        Rollen in der Aufteilung: {Object.values(SPLIT_ROLE_LABELS).join(", ")}.
      </p>
    </div>
  );
}
