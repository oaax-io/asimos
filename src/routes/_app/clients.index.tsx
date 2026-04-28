import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Plus, Search, Mail, Phone, Target } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth";
import { getBackendErrorMessage, isBackendUnavailableError, unwrapServerResult } from "@/lib/backend-errors";
import { toast } from "sonner";
import { clientTypeLabels, formatCurrency, propertyTypeLabels } from "@/lib/format";
import { EmptyState } from "@/components/EmptyState";
import { addClient, getClients } from "@/server/crm.functions";
import { ClientWizard } from "@/components/clients/ClientWizard";

export const Route = createFileRoute("/_app/clients/")({ component: ClientsPage });

const TYPES = ["buyer","seller","tenant","landlord","investor","other"] as const;
const PROP_TYPES = ["apartment","house","commercial","land","other"] as const;
const FINANCING_OPTIONS = ["unklar", "in Prüfung", "Vorabbestätigung", "bestätigt", "abgelehnt"];
const ALL = "__all__";
const UNASSIGNED = "__unassigned__";
const NO_FIN = "__none__";

function ClientsPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>(ALL);
  const [assignedFilter, setAssignedFilter] = useState<string>(ALL);
  const [financingFilter, setFinancingFilter] = useState<string>(ALL);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    full_name: "", email: "", phone: "", client_type: "buyer" as typeof TYPES[number],
    notes: "", budget_min: "", budget_max: "", rooms_min: "", area_min: "",
    preferred_cities: "", preferred_types: [] as string[], preferred_listing: "sale" as "sale" | "rent",
    assigned_to: "", financing_status: "",
  });

  const clientsQuery = useQuery({
    queryKey: ["clients"],
    queryFn: async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) throw new Error("Nicht angemeldet");
      const result = await getClients({ headers: { authorization: `Bearer ${accessToken}` } });
      // Wirft bei Backend-Unavailable -> globaler Retry mit Backoff greift.
      return unwrapServerResult(result);
    },
  });

  const employeesQuery = useQuery({
    queryKey: ["employees"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("id, full_name, email").eq("is_active", true).order("full_name");
      return data ?? [];
    },
  });

  const clients = clientsQuery.data ?? [];
  const employees = employeesQuery.data ?? [];
  const employeeMap = useMemo(() => new Map(employees.map((e: any) => [e.id, e])), [employees]);

  // Banner nur bei "echten" Fehlern – Backend-Unavailable wird automatisch retryed.
  const showError = clientsQuery.error && !isBackendUnavailableError(clientsQuery.error);
  const queryErrorMessage = showError ? getBackendErrorMessage(clientsQuery.error) : null;

  const create = useMutation({
    mutationFn: async () => {
      if (!form.full_name.trim()) throw new Error("Name ist erforderlich");
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) throw new Error("Nicht angemeldet");
      const result = await addClient({
        headers: { authorization: `Bearer ${accessToken}` },
        data: {
          full_name: form.full_name,
          email: form.email || null,
          phone: form.phone || null,
          client_type: form.client_type,
          notes: form.notes || null,
          budget_min: form.budget_min ? Number(form.budget_min) : null,
          budget_max: form.budget_max ? Number(form.budget_max) : null,
          rooms_min: form.rooms_min ? Number(form.rooms_min) : null,
          area_min: form.area_min ? Number(form.area_min) : null,
          preferred_cities: form.preferred_cities ? form.preferred_cities.split(",").map(s => s.trim()).filter(Boolean) : null,
          preferred_types: form.preferred_types.length ? form.preferred_types : null,
          preferred_listing: form.preferred_listing,
        },
      });

      if (result.error || !result.data) {
        const mutationError = new Error(result.error ?? "Es ist ein unerwarteter Fehler aufgetreten.");
        if (result.unavailable) {
          (mutationError as Error & { status?: number }).status = 503;
        }
        throw mutationError;
      }

      // Apply employee assignment / financing status post-create
      if ((form.assigned_to || form.financing_status) && result.data?.id) {
        await supabase.from("clients").update({
          assigned_to: form.assigned_to || null,
          financing_status: form.financing_status || null,
        }).eq("id", result.data.id);
      }

      return result.data;
    },
    onSuccess: () => {
      toast.success("Kunde erstellt");
      qc.invalidateQueries({ queryKey: ["clients"] });
      setOpen(false);
    },
    onError: (e: unknown) => toast.error(getBackendErrorMessage(e)),
  });

  const filtered = useMemo(() => clients.filter((c: any) => {
    if (typeFilter !== ALL && c.client_type !== typeFilter) return false;
    if (assignedFilter !== ALL) {
      if (assignedFilter === UNASSIGNED && c.assigned_to) return false;
      if (assignedFilter !== UNASSIGNED && c.assigned_to !== assignedFilter) return false;
    }
    if (financingFilter !== ALL) {
      if (financingFilter === NO_FIN && c.financing_status) return false;
      if (financingFilter !== NO_FIN && c.financing_status !== financingFilter) return false;
    }
    if (search) {
      const q = search.toLowerCase();
      if (!c.full_name?.toLowerCase().includes(q) && !c.email?.toLowerCase().includes(q)) return false;
    }
    return true;
  }), [clients, typeFilter, assignedFilter, financingFilter, search]);

  return (
    <>
      <PageHeader
        title="Kunden"
        description="Alle Käufer, Verkäufer, Mieter und Vermieter"
        action={
          <Button onClick={() => setOpen(true)}>
            <Plus className="mr-1 h-4 w-4" />Neuer Kunde
          </Button>
        }
      />

      <ClientWizard open={open} onOpenChange={setOpen} />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] max-w-xs flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Kunden suchen…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[150px]"><SelectValue placeholder="Typ" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Alle Typen</SelectItem>
            {TYPES.map((t) => <SelectItem key={t} value={t}>{clientTypeLabels[t]}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={assignedFilter} onValueChange={setAssignedFilter}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Zugewiesen" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Alle Mitarbeitenden</SelectItem>
            <SelectItem value={UNASSIGNED}>Nicht zugewiesen</SelectItem>
            {employees.map((e: any) => <SelectItem key={e.id} value={e.id}>{e.full_name ?? e.email}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={financingFilter} onValueChange={setFinancingFilter}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Finanzierung" /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Alle Finanzierungen</SelectItem>
            <SelectItem value={NO_FIN}>Keine Angabe</SelectItem>
            {FINANCING_OPTIONS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        {(typeFilter !== ALL || assignedFilter !== ALL || financingFilter !== ALL || search) && (
          <Button variant="ghost" size="sm" onClick={() => { setSearch(""); setTypeFilter(ALL); setAssignedFilter(ALL); setFinancingFilter(ALL); }}>
            Zurücksetzen
          </Button>
        )}
        <span className="ml-auto text-sm text-muted-foreground">{filtered.length} von {clients.length}</span>
      </div>

      {showError ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {queryErrorMessage}
        </div>
      ) : null}

      {!clientsQuery.error && clientsQuery.isLoading ? (
        <div className="rounded-xl border bg-muted/20 p-4 text-sm text-muted-foreground">Kunden werden geladen…</div>
      ) : null}

      {filtered.length === 0 && !clientsQuery.error && !clientsQuery.isLoading ? (
        <EmptyState title="Noch keine Kunden" description="Lege deinen ersten Kunden an, um Suchprofile zu erfassen und Matches zu erhalten." />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((c) => (
            <Card key={c.id} className="transition hover:shadow-glow">
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <Link to="/clients/$id" params={{ id: c.id }} className="flex-1">
                    <p className="font-semibold hover:text-primary">{c.full_name}</p>
                    <Badge variant="secondary" className="mt-1">{clientTypeLabels[c.client_type as keyof typeof clientTypeLabels]}</Badge>
                  </Link>
                  <Link to="/matching" search={{ clientId: c.id }} className="rounded-lg border p-2 text-primary transition hover:bg-accent" title="Matching">
                    <Target className="h-4 w-4" />
                  </Link>
                </div>
                <Link to="/clients/$id" params={{ id: c.id }} className="block">
                  <div className="mt-3 space-y-1 text-sm text-muted-foreground">
                    {c.email && <p className="flex items-center gap-2"><Mail className="h-3.5 w-3.5" />{c.email}</p>}
                    {c.phone && <p className="flex items-center gap-2"><Phone className="h-3.5 w-3.5" />{c.phone}</p>}
                  </div>
                  {(c.budget_max || c.preferred_cities?.length) && (
                    <div className="mt-3 rounded-lg bg-muted/40 p-3 text-xs">
                      {c.budget_max && <p>Budget: bis {formatCurrency(Number(c.budget_max))}</p>}
                      {c.preferred_cities?.length ? <p>Städte: {c.preferred_cities.join(", ")}</p> : null}
                      {c.rooms_min ? <p>Zimmer ab: {c.rooms_min}</p> : null}
                    </div>
                  )}
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
