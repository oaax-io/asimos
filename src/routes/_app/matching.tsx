import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { matchClientToProperties, scoreMatch, type ScoreBreakdown, type FinancialCapacity } from "@/lib/matching";
import { formatCurrency, clientTypeLabels, propertyTypeLabels } from "@/lib/format";
import { Sparkles, ExternalLink, Users, Search } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/EmptyState";
import type { Tables } from "@/integrations/supabase/types";

type Client = Tables<"clients">;
type Property = Tables<"properties">;

export const Route = createFileRoute("/_app/matching")({
  validateSearch: (s: Record<string, unknown>) => ({
    clientId: (s.clientId as string) || "",
    view: ((s.view as string) === "client" ? "client" : "all") as "all" | "client",
  }),
  component: MatchingPage,
});

interface GlobalMatch extends ScoreBreakdown {
  client: Client;
  property: Property;
}

function MatchingPage() {
  const { clientId, view } = Route.useSearch();
  const navigate = Route.useNavigate();
  const qc = useQueryClient();
  const [query, setQuery] = useState("");
  const [minScore, setMinScore] = useState(60);

  const { data: clients = [] } = useQuery({
    queryKey: ["clients"],
    queryFn: async () => (await supabase.from("clients").select("*").order("full_name")).data ?? [],
  });
  const { data: properties = [] } = useQuery({
    queryKey: ["properties"],
    queryFn: async () => (await supabase.from("properties").select("*")).data ?? [],
  });

  // Global matches: alle Kunde × Immobilie Paare, gefiltert + sortiert
  const globalMatches = useMemo<GlobalMatch[]>(() => {
    const seekers = clients.filter((c) => c.client_type === "buyer" || c.client_type === "tenant");
    const available = properties.filter((p) => p.status === "available" || p.status === "draft");
    const out: GlobalMatch[] = [];
    for (const c of seekers) {
      for (const p of available) {
        const r = scoreMatch(c, p);
        if (r.score >= minScore) out.push({ client: c, property: p, ...r });
      }
    }
    return out.sort((a, b) => b.score - a.score);
  }, [clients, properties, minScore]);

  const filteredGlobal = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return globalMatches;
    return globalMatches.filter(
      (m) =>
        m.client.full_name?.toLowerCase().includes(q) ||
        m.property.title?.toLowerCase().includes(q) ||
        m.property.city?.toLowerCase().includes(q),
    );
  }, [globalMatches, query]);

  // Pro-Kunde Ansicht (alte Logik)
  const selected = clients.find((c) => c.id === clientId) ?? clients[0];
  const clientMatches = useMemo(
    () => (selected ? matchClientToProperties(selected, properties) : []),
    [selected, properties],
  );

  // Top-Kunden mit den meisten guten Matches (für die Sidebar-Liste)
  const clientLeaderboard = useMemo(() => {
    const map = new Map<string, { client: Client; count: number; best: number }>();
    for (const m of globalMatches) {
      const cur = map.get(m.client.id) ?? { client: m.client, count: 0, best: 0 };
      cur.count++;
      cur.best = Math.max(cur.best, m.score);
      map.set(m.client.id, cur);
    }
    return [...map.values()].sort((a, b) => b.best - a.best || b.count - a.count).slice(0, 8);
  }, [globalMatches]);

  const save = useMutation({
    mutationFn: async (m: { client_id: string; property_id: string; score: number; reasons: string[] }) => {
      const { error } = await supabase.from("matches").upsert(
        {
          client_id: m.client_id,
          property_id: m.property_id,
          score: m.score,
          reasons: m.reasons,
          status: "shortlisted",
        },
        { onConflict: "client_id,property_id" },
      );
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Match gespeichert");
      qc.invalidateQueries({ queryKey: ["matches"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const setView = (v: "all" | "client") => navigate({ search: { clientId, view: v } });

  return (
    <>
      <PageHeader
        title="Matching"
        description="Übersicht aller passenden Kunde–Immobilie Paare"
      />

      {clients.length === 0 ? (
        <EmptyState
          title="Noch keine Kunden"
          description="Erstelle zuerst einen Kunden mit Suchprofil."
          action={<Button asChild><Link to="/clients">Zu Kunden</Link></Button>}
        />
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <Tabs value={view} onValueChange={(v) => setView(v as "all" | "client")}>
              <TabsList>
                <TabsTrigger value="all">Alle Matches</TabsTrigger>
                <TabsTrigger value="client">Pro Kunde</TabsTrigger>
              </TabsList>
            </Tabs>

            {view === "all" ? (
              <>
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Kunde, Objekt oder Stadt suchen…"
                    className="h-9 w-72 pl-8"
                  />
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground">Min. Score</span>
                  <Select value={String(minScore)} onValueChange={(v) => setMinScore(Number(v))}>
                    <SelectTrigger className="h-9 w-24"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {[40, 50, 60, 70, 80, 90].map((n) => (
                        <SelectItem key={n} value={String(n)}>{n}%</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Badge variant="secondary" className="ml-auto">{filteredGlobal.length} Treffer</Badge>
              </>
            ) : (
              <>
                <span className="text-sm text-muted-foreground">Kunde:</span>
                <Select
                  value={selected?.id ?? ""}
                  onValueChange={(v) => navigate({ search: { clientId: v, view: "client" } })}
                >
                  <SelectTrigger className="h-9 w-72"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {clients.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.full_name} · {clientTypeLabels[c.client_type as keyof typeof clientTypeLabels]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selected && (
                  <div className="flex flex-wrap gap-2 text-xs">
                    {selected.budget_max && <Badge variant="secondary">bis {formatCurrency(Number(selected.budget_max))}</Badge>}
                    {selected.preferred_cities?.map((c) => <Badge key={c} variant="secondary">{c}</Badge>)}
                    {selected.rooms_min && <Badge variant="secondary">≥ {selected.rooms_min} Zi</Badge>}
                  </div>
                )}
              </>
            )}
          </div>

          {view === "all" ? (
            <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
              <div>
                {filteredGlobal.length === 0 ? (
                  <EmptyState
                    title="Keine Matches gefunden"
                    description="Senke den Mindest-Score oder erfasse mehr Kunden / Immobilien mit Suchprofil."
                  />
                ) : (
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {filteredGlobal.slice(0, 60).map((m) => (
                      <MatchCard
                        key={`${m.client.id}_${m.property.id}`}
                        client={m.client}
                        property={m.property}
                        score={m.score}
                        reasons={m.reasons}
                        onSave={() => save.mutate({ client_id: m.client.id, property_id: m.property.id, score: m.score, reasons: m.reasons })}
                      />
                    ))}
                  </div>
                )}
              </div>

              <aside className="space-y-4">
                <Card>
                  <CardContent className="p-4">
                    <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
                      <Users className="h-4 w-4 text-primary" />
                      Top Kunden
                    </h3>
                    {clientLeaderboard.length === 0 ? (
                      <p className="text-xs text-muted-foreground">Noch keine Matches.</p>
                    ) : (
                      <ul className="space-y-1.5">
                        {clientLeaderboard.map((l) => (
                          <li key={l.client.id}>
                            <button
                              onClick={() => navigate({ search: { clientId: l.client.id, view: "client" } })}
                              className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent/60"
                            >
                              <span className="truncate">{l.client.full_name}</span>
                              <span className="flex shrink-0 items-center gap-1.5">
                                <span className="text-[10px] text-muted-foreground">{l.count}×</span>
                                <Badge variant="secondary" className="font-mono tabular-nums text-[10px]">{l.best}%</Badge>
                              </span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </CardContent>
                </Card>
              </aside>
            </div>
          ) : clientMatches.length === 0 ? (
            <EmptyState title="Keine passenden Immobilien" description="Erfasse mehr Objekte oder verfeinere das Suchprofil." />
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {clientMatches.map(({ property: p, score, reasons }) => (
                <MatchCard
                  key={p.id}
                  property={p}
                  score={score}
                  reasons={reasons}
                  onSave={() => save.mutate({ client_id: selected!.id, property_id: p.id, score, reasons })}
                />
              ))}
            </div>
          )}
        </>
      )}
    </>
  );
}

function MatchCard({
  client,
  property: p,
  score,
  reasons,
  onSave,
}: {
  client?: Client;
  property: Property;
  score: number;
  reasons: string[];
  onSave: () => void;
}) {
  return (
    <Card className="overflow-hidden transition hover:shadow-glow">
      <div className="aspect-[16/10] overflow-hidden bg-muted">
        {p.images?.[0]
          ? <img src={p.images[0]} alt={p.title} className="h-full w-full object-cover" />
          : <div className="flex h-full w-full items-center justify-center bg-gradient-soft text-muted-foreground">Kein Bild</div>}
      </div>
      <CardContent className="p-4">
        {client && (
          <p className="mb-1 truncate text-xs font-medium text-primary">
            <Users className="mr-1 inline h-3 w-3" />
            {client.full_name}
          </p>
        )}
        <div className="flex items-start justify-between gap-2">
          <h3 className="line-clamp-1 font-semibold">{p.title}</h3>
          <div className="flex shrink-0 items-center gap-1 rounded-full bg-gradient-brand px-2.5 py-1 text-xs font-bold text-primary-foreground">
            <Sparkles className="h-3 w-3" />{score}%
          </div>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          {[p.city, propertyTypeLabels[p.property_type as keyof typeof propertyTypeLabels]].filter(Boolean).join(" · ")}
        </p>
        <p className="mt-1.5 font-display text-base font-bold">{formatCurrency(p.price ? Number(p.price) : null)}</p>
        <div className="mt-2 flex flex-wrap gap-1">
          {reasons.slice(0, 4).map((r) => (
            <span key={r} className="rounded-full bg-accent/60 px-2 py-0.5 text-[10px] text-accent-foreground">{r}</span>
          ))}
        </div>
        <div className="mt-3 flex gap-2">
          <Button size="sm" className="flex-1" onClick={onSave}>Vormerken</Button>
          <Button size="sm" variant="outline" asChild>
            <Link to="/properties/$id" params={{ id: p.id }}><ExternalLink className="h-4 w-4" /></Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
