import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/EmptyState";
import { Plus, Search, Building2, User, Database, PencilLine } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCurrency, formatDate } from "@/lib/format";
import {
  FINANCING_TYPE_LABELS, DOSSIER_STATUS_LABELS, QUICK_CHECK_LABELS,
  type FinancingType, type DossierStatus, type QuickCheckStatus,
} from "@/lib/financing";
import { FinancingQuickCheckWizard } from "@/components/financing/FinancingQuickCheckWizard";

export const Route = createFileRoute("/_app/financing/")({ component: FinancingPage });

const ALL = "__all__";

function FinancingPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>(ALL);
  const [typeFilter, setTypeFilter] = useState<string>(ALL);
  const [qcFilter, setQcFilter] = useState<string>(ALL);
  const [bankFilter, setBankFilter] = useState<string>(ALL);
  const [sourceFilter, setSourceFilter] = useState<string>(ALL);
  const [wizardOpen, setWizardOpen] = useState(false);

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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Finanzierungen"
        description="Übersicht aller Finanzierungs-Dossiers"
        action={
          <Button onClick={() => setWizardOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> Quick Check starten
          </Button>
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
          {filtered.map((d: any) => <DossierCard key={d.id} d={d} />)}
        </div>
      )}

      <FinancingQuickCheckWizard
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        onCreated={(id) => { setWizardOpen(false); navigate({ to: "/financing/$id", params: { id } }); }}
      />
    </div>
  );
}

function DossierCard({ d }: { d: any }) {
  const ds = (d.data_source ?? "existing_property") as "existing_property" | "quick_entry";
  const snap = (d.property_snapshot as any) ?? {};
  const propertyLabel = d.properties?.title
    ?? snap.title
    ?? [snap.address, snap.city].filter(Boolean).join(", ")
    ?? null;

  return (
    <Link to="/financing/$id" params={{ id: d.id }}>
      <Card className="transition hover:shadow-md">
        <CardContent className="flex flex-wrap items-start gap-4 p-4">
          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-medium truncate">
                {d.title || FINANCING_TYPE_LABELS[d.financing_type as FinancingType] || "Finanzierung"}
              </p>
              <Badge variant="secondary">{FINANCING_TYPE_LABELS[d.financing_type as FinancingType] ?? "—"}</Badge>
              <Badge className={dossierTone(d.dossier_status)}>
                {DOSSIER_STATUS_LABELS[d.dossier_status as DossierStatus] ?? "Entwurf"}
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
          </div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-right text-xs">
            <KV label="Hypothek" value={d.requested_mortgage ? formatCurrency(Number(d.requested_mortgage)) : "—"} />
            <KV label="Investition" value={d.total_investment ? formatCurrency(Number(d.total_investment)) : "—"} />
            <KV label="Belehnung" value={d.loan_to_value_ratio != null ? `${Number(d.loan_to_value_ratio).toFixed(1)}%` : "—"} />
            <KV label="Tragbarkeit" value={d.affordability_ratio != null ? `${Number(d.affordability_ratio).toFixed(1)}%` : "—"} />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function KV({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-muted-foreground">{label}</p>
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
