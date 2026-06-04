import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { EmptyState } from "@/components/EmptyState";
import { Plus, Search, Building2, User, Database, PencilLine, Trash2, UserPlus, FileText, X, ArrowRight, Calculator } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCurrency, formatDate } from "@/lib/format";
import {
  FINANCING_TYPE_LABELS, DOSSIER_STATUS_LABELS, QUICK_CHECK_LABELS,
  type FinancingType, type DossierStatus, type QuickCheckStatus,
} from "@/lib/financing";
import { FinancingQuickCheckWizard } from "@/components/financing/FinancingQuickCheckWizard";
import { HypoRechnerKosovoDialog } from "@/components/financing/HypoRechnerKosovoDialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/financing/")({ component: FinancingPage });

const ALL = "__all__";

function FinancingPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>(ALL);
  const [typeFilter, setTypeFilter] = useState<string>(ALL);
  const [qcFilter, setQcFilter] = useState<string>(ALL);
  const [bankFilter, setBankFilter] = useState<string>(ALL);
  const [sourceFilter, setSourceFilter] = useState<string>(ALL);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [hypoOpen, setHypoOpen] = useState(false);
  const [hypoCalcId, setHypoCalcId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const canDelete = useIsOwnerOrAdmin();

  const deleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase.from("financing_dossiers").delete().in("id", ids);
      if (error) throw error;
    },
    onSuccess: (_data, ids) => {
      toast.success(ids.length === 1 ? "Finanzierung gelöscht" : `${ids.length} Finanzierungen gelöscht`);
      setSelected(new Set());
      setConfirmDeleteOpen(false);
      qc.invalidateQueries({ queryKey: ["financing_dossiers"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Löschen fehlgeschlagen"),
  });

  const { data: dossiers = [], isLoading } = useQuery({
    queryKey: ["financing_dossiers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financing_dossiers")
        .select("*")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      const rows = data ?? [];
      const clientIds = Array.from(new Set(rows.map((r: any) => r.client_id).filter(Boolean)));
      const propIds = Array.from(new Set(rows.map((r: any) => r.property_id).filter(Boolean)));
      const [{ data: clients = [] }, { data: props = [] }] = await Promise.all([
        clientIds.length
          ? supabase.from("clients").select("id, full_name").in("id", clientIds)
          : Promise.resolve({ data: [] as any[] }),
        propIds.length
          ? supabase.from("properties").select("id, title, city").in("id", propIds)
          : Promise.resolve({ data: [] as any[] }),
      ]);
      const cMap = new Map((clients ?? []).map((c: any) => [c.id, c]));
      const pMap = new Map((props ?? []).map((p: any) => [p.id, p]));
      return rows.map((r: any) => ({ ...r, clients: cMap.get(r.client_id), properties: pMap.get(r.property_id) }));
    },
  });

  const { data: hypoCalcs = [] } = useQuery({
    queryKey: ["hypo_calculations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("hypo_calculations")
        .select("*, clients:client_id(id, full_name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return dossiers.filter((d: any) => {
      if (statusFilter !== ALL && d.dossier_status !== statusFilter) return false;
      if (typeFilter !== ALL && d.financing_type !== typeFilter) return false;
      if (qcFilter !== ALL && (d.quick_check_status ?? "incomplete") !== qcFilter) return false;
      if (bankFilter !== ALL && (d.bank_type ?? "none") !== bankFilter) return false;
      if (sourceFilter !== ALL && (d.data_source ?? "existing_property") !== sourceFilter) return false;
      if (!s) return true;
      const hay = [
        d.title, d.clients?.full_name, d.properties?.title, d.bank_name,
        (d.property_snapshot as any)?.title, (d.property_snapshot as any)?.address,
      ].filter(Boolean).join(" ").toLowerCase();
      return hay.includes(s);
    });
  }, [dossiers, search, statusFilter, typeFilter, qcFilter, bankFilter, sourceFilter]);

  const toggleOne = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });

  const allVisibleSelected = filtered.length > 0 && filtered.every((d: any) => selected.has(d.id));
  const toggleAllVisible = () =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) filtered.forEach((d: any) => next.delete(d.id));
      else filtered.forEach((d: any) => next.add(d.id));
      return next;
    });

  const selectionCount = selected.size;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Finanzierungen"
        description="Übersicht aller Finanzierungs-Dossiers"
        action={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setHypoOpen(true)}>
              <Calculator className="mr-2 h-4 w-4" /> Hyporechner Kosovo
            </Button>
            <Button onClick={() => setWizardOpen(true)}>
              <Plus className="mr-2 h-4 w-4" /> Quick Check starten
            </Button>
          </div>
        }
      />

      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Suchen…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Art" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Alle Arten</SelectItem>
            {Object.entries(FINANCING_TYPE_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={qcFilter} onValueChange={setQcFilter}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Quick Check" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Quick Check (alle)</SelectItem>
            {Object.entries(QUICK_CHECK_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Dossier-Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Status (alle)</SelectItem>
            {Object.entries(DOSSIER_STATUS_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={bankFilter} onValueChange={setBankFilter}>
          <SelectTrigger className="w-[150px]"><SelectValue placeholder="Banktyp" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Banktyp (alle)</SelectItem>
            <SelectItem value="ubs">UBS</SelectItem>
            <SelectItem value="other">Andere Bank</SelectItem>
            <SelectItem value="none">Keine Bank</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sourceFilter} onValueChange={setSourceFilter}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Datenbasis" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Datenbasis (alle)</SelectItem>
            <SelectItem value="existing_property">Bestehende Immobilie</SelectItem>
            <SelectItem value="quick_entry">Quick-Erfassung</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filtered.length > 0 && (
        <div className="flex items-center justify-between rounded-md border bg-card px-3 py-2 text-sm">
          <label className="inline-flex items-center gap-2 cursor-pointer select-none">
            <Checkbox
              checked={allVisibleSelected}
              onCheckedChange={toggleAllVisible}
              aria-label="Alle auswählen"
            />
            <span className="text-muted-foreground">
              {selectionCount > 0 ? `${selectionCount} ausgewählt` : "Alle auswählen"}
            </span>
          </label>
          {selectionCount > 0 && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => toast.info("Zuweisen kommt bald")}
              >
                <UserPlus className="mr-2 h-4 w-4" />Zuweisen
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => toast.info("Dokumentgenerierung kommt bald")}
              >
                <FileText className="mr-2 h-4 w-4" />Dokument generieren
              </Button>
              {canDelete && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setConfirmDeleteOpen(true)}
                  disabled={deleteMutation.isPending}
                >
                  <Trash2 className="mr-2 h-4 w-4" />Löschen
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelected(new Set())}
                aria-label="Auswahl aufheben"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      )}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Laden…</p>
      ) : filtered.length === 0 ? (
        <EmptyState
          title="Noch keine Finanzierung"
          description="Starte mit einem Quick Check für einen Kunden."
          action={<Button onClick={() => setWizardOpen(true)}><Plus className="mr-2 h-4 w-4" />Quick Check starten</Button>}
        />
      ) : (
        <div className="grid gap-3">
          {filtered.map((d: any) => (
            <DossierCard
              key={d.id}
              d={d}
              selected={selected.has(d.id)}
              onToggle={() => toggleOne(d.id)}
            />
          ))}
        </div>
      )}

      {/* Gespeicherte Hyporechner Kosovo */}
      {hypoCalcs.length > 0 && (
        <div className="space-y-3 pt-2">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Gespeicherte Hyporechner Kosovo
          </h3>
          <div className="grid gap-3">
            {hypoCalcs.map((h: any) => (
              <Card key={h.id} className="transition hover:shadow-md cursor-pointer" onClick={() => { setHypoCalcId(h.id); setHypoOpen(true); }}>
                <CardContent className="flex flex-wrap items-center gap-4 p-4">
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium truncate">{h.label || `Hyporechner ${h.term_years}J`}</p>
                      <Badge variant="outline">{h.term_years} Jahre</Badge>
                      <Badge variant="secondary">{h.interest_pct}% Zins</Badge>
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                      {h.clients?.full_name && (
                        <span className="inline-flex items-center gap-1"><User className="h-3.5 w-3.5" />{h.clients.full_name}</span>
                      )}
                      <span>Kaufpreis: {formatCurrency(Number(h.purchase_price))}</span>
                      <span>Rate: {formatCurrency(Number(h.monthly_payment))}/Mo</span>
                      <span>Erstellt {formatDate(h.created_at)}</span>
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      <FinancingQuickCheckWizard
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        onCreated={(id) => { setWizardOpen(false); navigate({ to: "/financing/$id", params: { id } }); }}
      />

      <HypoRechnerKosovoDialog
        open={hypoOpen}
        onOpenChange={(o) => { setHypoOpen(o); if (!o) setHypoCalcId(null); }}
        calculationId={hypoCalcId}
      />

      <AlertDialog open={confirmDeleteOpen} onOpenChange={setConfirmDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {selectionCount === 1 ? "Finanzierung löschen?" : `${selectionCount} Finanzierungen löschen?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              Diese Aktion kann nicht rückgängig gemacht werden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteMutation.mutate(Array.from(selected))}
              disabled={deleteMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function DossierCard({
  d, selected, onToggle,
}: {
  d: any;
  selected: boolean;
  onToggle: () => void;
}) {
  const ds = (d.data_source ?? "existing_property") as "existing_property" | "quick_entry";
  const snap = (d.property_snapshot as any) ?? {};
  const propertyLabel = d.properties?.title
    ?? snap.title
    ?? [snap.address, snap.city].filter(Boolean).join(", ")
    ?? null;

  const reasons: Array<{ key: string; label: string; tone: "ok" | "warn" | "bad" }> =
    Array.isArray(d.quick_check_reasons) ? d.quick_check_reasons : [];
  const qcStatus = d.quick_check_status as QuickCheckStatus | null;
  const dossierStatus = (d.dossier_status ?? "draft") as DossierStatus;
  const qcToneClass =
    qcStatus === "realistic" ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
    : qcStatus === "critical" ? "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400"
    : qcStatus === "not_financeable" ? "border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-400"
    : "border-border bg-muted/30 text-muted-foreground";

  return (
    <Card className={cn("transition hover:shadow-md", selected && "ring-2 ring-primary")}>
      <CardContent className="space-y-3 p-4">
        <div className="flex flex-wrap items-start gap-4">
          <div
            className="flex items-center pt-1"
            onClick={(e) => e.stopPropagation()}
          >
            <Checkbox
              checked={selected}
              onCheckedChange={onToggle}
              aria-label="Auswählen"
            />
          </div>
          <Link to="/financing/$id" params={{ id: d.id }} className="flex-1 min-w-0 space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-medium truncate">
                {d.title || FINANCING_TYPE_LABELS[d.financing_type as FinancingType] || "Finanzierung"}
              </p>
              <Badge variant="secondary">{FINANCING_TYPE_LABELS[d.financing_type as FinancingType] ?? "—"}</Badge>
              <Badge className={dossierTone(dossierStatus)}>
                {DOSSIER_STATUS_LABELS[dossierStatus] ?? "Entwurf"}
              </Badge>
              <Badge variant="outline" className={qcTone(d.quick_check_status ?? "incomplete")}>
                {QUICK_CHECK_LABELS[(d.quick_check_status ?? "incomplete") as QuickCheckStatus]}
              </Badge>
              <Badge variant="outline" className="gap-1">
                {ds === "existing_property"
                  ? <><Database className="h-3 w-3" />Bestehende Immobilie</>
                  : <><PencilLine className="h-3 w-3" />Quick-Erfassung</>}
              </Badge>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
              {d.clients?.full_name && (
                <span className="inline-flex items-center gap-1"><User className="h-3.5 w-3.5" />{d.clients.full_name}</span>
              )}
              {propertyLabel && (
                <span className="inline-flex items-center gap-1"><Building2 className="h-3.5 w-3.5" />{propertyLabel}</span>
              )}
              {d.bank_name && <span>Bank: {d.bank_name}{d.bank_type ? ` (${d.bank_type === "ubs" ? "UBS" : "andere"})` : ""}</span>}
              {!d.bank_name && d.bank_type && <span>Banktyp: {d.bank_type === "ubs" ? "UBS" : "andere"}</span>}
              <span>Aktualisiert {formatDate(d.updated_at)}</span>
            </div>
          </Link>
        </div>

        {/* Quick-Check Zusammenfassung — gleiche Optik wie im Kunden-Tab */}
        <Link to="/financing/$id" params={{ id: d.id }} className={`block rounded-lg border p-3 ${qcToneClass}`}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs font-semibold uppercase tracking-wide">
              Quick Check: {qcStatus ? (QUICK_CHECK_LABELS[qcStatus] ?? qcStatus) : "Noch nicht durchgeführt"}
            </div>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
            <KPI label="Tragbarkeit" value={d.affordability_ratio != null ? `${Number(d.affordability_ratio).toFixed(1)}%` : "—"} />
            <KPI label="Belehnung" value={d.loan_to_value_ratio != null ? `${Number(d.loan_to_value_ratio).toFixed(1)}%` : "—"} />
            <KPI label="Hypothek" value={d.requested_mortgage != null ? formatCurrency(Number(d.requested_mortgage)) : "—"} />
            <KPI label="Eigenmittel" value={d.own_funds_total != null ? formatCurrency(Number(d.own_funds_total)) : "—"} />
          </div>
          {reasons.length > 0 && (
            <ul className="mt-3 space-y-1 text-xs">
              {reasons.map((r, i) => (
                <li key={`${r.key}-${i}`} className="flex items-start gap-1.5">
                  <span className={
                    r.tone === "ok" ? "text-emerald-600 dark:text-emerald-400"
                    : r.tone === "warn" ? "text-amber-600 dark:text-amber-400"
                    : "text-red-600 dark:text-red-400"
                  }>
                    {r.tone === "ok" ? "✓" : r.tone === "warn" ? "!" : "✕"}
                  </span>
                  <span>{r.label}</span>
                </li>
              ))}
            </ul>
          )}
        </Link>
      </CardContent>
    </Card>
  );
}

function KPI({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-md bg-background/60 p-2">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="font-semibold text-foreground">{value}</p>
    </div>
  );
}

function qcTone(s: string) {
  if (s === "realistic") return "border-emerald-500 text-emerald-600";
  if (s === "critical") return "border-amber-500 text-amber-600";
  if (s === "not_financeable") return "border-red-500 text-red-600";
  return "border-muted text-muted-foreground";
}

function dossierTone(s: string | null | undefined): string {
  switch (s) {
    case "approved": return "bg-emerald-600 hover:bg-emerald-600";
    case "ready_for_bank": return "bg-emerald-500 hover:bg-emerald-500";
    case "submitted_to_bank": return "bg-blue-600 hover:bg-blue-600";
    case "documents_missing": return "bg-amber-500 hover:bg-amber-500";
    case "rejected": return "bg-red-600 hover:bg-red-600";
    case "cancelled": return "bg-muted text-muted-foreground hover:bg-muted";
    case "quick_check": return "bg-violet-600 hover:bg-violet-600";
    default: return "bg-secondary text-secondary-foreground hover:bg-secondary";
  }
}

function useIsOwnerOrAdmin(): boolean {
  const [allowed, setAllowed] = useState(false);
  useEffect(() => {
    let active = true;
    supabase.rpc("is_owner_or_admin").then(({ data }) => {
      if (active) setAllowed(!!data);
    });
    return () => { active = false; };
  }, []);
  return allowed;
}
