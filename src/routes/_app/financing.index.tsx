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
import { Plus, Search, Banknote, Building2, User } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCurrency } from "@/lib/format";
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
  const [wizardOpen, setWizardOpen] = useState(false);

  const { data: dossiers = [], isLoading } = useQuery({
    queryKey: ["financing_dossiers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financing_dossiers")
        .select("*, clients:client_id(id, full_name), properties:property_id(id, title, city)")
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
      if (!s) return true;
      const hay = [
        d.title, d.clients?.full_name, d.properties?.title, d.bank_name,
      ].filter(Boolean).join(" ").toLowerCase();
      return hay.includes(s);
    });
  }, [dossiers, search, statusFilter, typeFilter]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Finanzierungen"
        description="Übersicht aller Finanzierungs-Dossiers"
        actions={
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
          <SelectTrigger className="w-[200px]"><SelectValue placeholder="Art" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Alle Arten</SelectItem>
            {Object.entries(FINANCING_TYPE_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[200px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Alle Status</SelectItem>
            {Object.entries(DOSSIER_STATUS_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Laden…</p>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Banknote}
          title="Noch keine Finanzierung"
          description="Starte mit einem Quick Check für einen Kunden."
          action={<Button onClick={() => setWizardOpen(true)}><Plus className="mr-2 h-4 w-4" />Quick Check starten</Button>}
        />
      ) : (
        <div className="grid gap-3">
          {filtered.map((d: any) => (
            <Link key={d.id} to="/financing/$id" params={{ id: d.id }}>
              <Card className="transition hover:shadow-md">
                <CardContent className="flex flex-wrap items-center gap-4 p-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium truncate">
                        {d.title || FINANCING_TYPE_LABELS[d.financing_type as FinancingType] || "Finanzierung"}
                      </p>
                      <Badge variant="secondary">{FINANCING_TYPE_LABELS[d.financing_type as FinancingType] ?? "—"}</Badge>
                      <Badge>{DOSSIER_STATUS_LABELS[d.dossier_status as DossierStatus] ?? "Entwurf"}</Badge>
                      {d.quick_check_status && (
                        <Badge variant="outline" className={qcTone(d.quick_check_status)}>
                          {QUICK_CHECK_LABELS[d.quick_check_status as QuickCheckStatus]}
                        </Badge>
                      )}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-3 text-sm text-muted-foreground">
                      {d.clients?.full_name && (
                        <span className="inline-flex items-center gap-1"><User className="h-3.5 w-3.5" />{d.clients.full_name}</span>
                      )}
                      {d.properties?.title && (
                        <span className="inline-flex items-center gap-1"><Building2 className="h-3.5 w-3.5" />{d.properties.title}</span>
                      )}
                      {d.bank_name && <span>Bank: {d.bank_name}</span>}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Hypothek</p>
                    <p className="font-semibold">{d.requested_mortgage ? formatCurrency(Number(d.requested_mortgage)) : "—"}</p>
                    {d.loan_to_value_ratio != null && (
                      <p className="text-xs text-muted-foreground">Belehnung {Number(d.loan_to_value_ratio).toFixed(1)}%</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
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

function qcTone(s: string) {
  if (s === "realistic") return "border-emerald-500 text-emerald-600";
  if (s === "critical") return "border-amber-500 text-amber-600";
  if (s === "not_financeable") return "border-red-500 text-red-600";
  return "border-muted text-muted-foreground";
}
