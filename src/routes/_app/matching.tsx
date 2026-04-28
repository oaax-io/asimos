import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { matchClientToProperties } from "@/lib/matching";
import { formatCurrency, clientTypeLabels, propertyTypeLabels } from "@/lib/format";
import { useAuth } from "@/lib/auth";
import { Sparkles, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/EmptyState";

export const Route = createFileRoute("/_app/matching")({
  validateSearch: (s: Record<string, unknown>) => ({ clientId: (s.clientId as string) || "" }),
  component: MatchingPage,
});

function MatchingPage() {
  const { clientId } = Route.useSearch();
  const navigate = Route.useNavigate();
  const qc = useQueryClient();
  const { user } = useAuth();

  const { data: clients = [] } = useQuery({
    queryKey: ["clients"],
    queryFn: async () => (await supabase.from("clients").select("*").order("full_name")).data ?? [],
  });
  const { data: properties = [] } = useQuery({
    queryKey: ["properties"],
    queryFn: async () => (await supabase.from("properties").select("*")).data ?? [],
  });

  const selected = clients.find(c => c.id === clientId) ?? clients[0];
  const matches = useMemo(() => selected ? matchClientToProperties(selected, properties) : [], [selected, properties]);

  const save = useMutation({
    mutationFn: async (m: { property_id: string; score: number; reasons: string[] }) => {
      const { data: profile } = await supabase.from("profiles").select("agency_id").eq("id", user!.id).single();
      const { error } = await supabase.from("matches").upsert({
        agency_id: profile!.agency_id, client_id: selected!.id, property_id: m.property_id, score: m.score, reasons: m.reasons, status: "shortlisted",
      }, { onConflict: "client_id,property_id" });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Match gespeichert"); qc.invalidateQueries({ queryKey: ["matches"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <>
      <PageHeader title="Matching" description="Finde die passende Immobilie zu jedem Kunden" />

      {clients.length === 0 ? (
        <EmptyState title="Noch keine Kunden" description="Erstelle zuerst einen Kunden mit Suchprofil." action={<Button asChild><Link to="/clients">Zu Kunden</Link></Button>} />
      ) : (
        <>
          <div className="mb-6 flex flex-wrap items-center gap-3">
            <span className="text-sm text-muted-foreground">Kunde:</span>
            <Select value={selected?.id ?? ""} onValueChange={(v) => navigate({ search: { clientId: v } })}>
              <SelectTrigger className="w-72"><SelectValue /></SelectTrigger>
              <SelectContent>
                {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.full_name} · {clientTypeLabels[c.client_type as keyof typeof clientTypeLabels]}</SelectItem>)}
              </SelectContent>
            </Select>
            {selected && (
              <div className="flex flex-wrap gap-2 text-xs">
                {selected.budget_max && <Badge variant="secondary">bis {formatCurrency(Number(selected.budget_max))}</Badge>}
                {selected.preferred_cities?.map(c => <Badge key={c} variant="secondary">{c}</Badge>)}
                {selected.rooms_min && <Badge variant="secondary">≥ {selected.rooms_min} Zi</Badge>}
              </div>
            )}
          </div>

          {matches.length === 0 ? (
            <EmptyState title="Keine passenden Immobilien" description="Erfasse mehr Objekte oder verfeinere das Suchprofil." />
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {matches.map(({ property: p, score, reasons }) => (
                <Card key={p.id} className="overflow-hidden transition hover:shadow-glow">
                  <div className="aspect-[16/10] overflow-hidden bg-muted">
                    {p.images?.[0]
                      ? <img src={p.images[0]} alt={p.title} className="h-full w-full object-cover" />
                      : <div className="flex h-full w-full items-center justify-center bg-gradient-soft text-muted-foreground">Kein Bild</div>}
                  </div>
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="line-clamp-1 font-semibold">{p.title}</h3>
                      <div className="flex shrink-0 items-center gap-1 rounded-full bg-gradient-brand px-2.5 py-1 text-xs font-bold text-primary-foreground">
                        <Sparkles className="h-3 w-3" />{score}%
                      </div>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">{[p.city, propertyTypeLabels[p.property_type as keyof typeof propertyTypeLabels]].filter(Boolean).join(" · ")}</p>
                    <p className="mt-2 font-display text-lg font-bold">{formatCurrency(p.price ? Number(p.price) : null)}</p>
                    <div className="mt-3 flex flex-wrap gap-1">
                      {reasons.map(r => <span key={r} className="rounded-full bg-accent/60 px-2 py-0.5 text-[11px] text-accent-foreground">{r}</span>)}
                    </div>
                    <div className="mt-4 flex gap-2">
                      <Button size="sm" className="flex-1" onClick={() => save.mutate({ property_id: p.id, score, reasons })}>Vormerken</Button>
                      <Button size="sm" variant="outline" asChild><Link to="/properties/$id" params={{ id: p.id }}><ExternalLink className="h-4 w-4" /></Link></Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      )}
    </>
  );
}
