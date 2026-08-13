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
import { Sparkles, ExternalLink, Users, Search, Target, Plus, Pencil } from "lucide-react";
import { SearchProfileDialog, type SearchProfile } from "@/components/matching/SearchProfileDialog";
import { toast } from "sonner";
import { EmptyState } from "@/components/EmptyState";
import type { Tables } from "@/integrations/supabase/types";

type Client = Tables<"clients">;
type Property = Tables<"properties">;

export const Route = createFileRoute("/_app/matching")({
  validateSearch: (s: Record<string, unknown>) => ({
    clientId: (s.clientId as string) || "",
    view: (["client", "profile"].includes(s.view as string) ? (s.view as string) : "all") as
      | "all"
      | "client"
      | "profile",
    profileId: (s.profileId as string) || "",
  }),
  component: MatchingPage,
});

interface GlobalMatch extends ScoreBreakdown {
  client: Client;
  property: Property;
}

function MatchingPage() {
  const { clientId, view, profileId } = Route.useSearch();
  const navigate = Route.useNavigate();
  const qc = useQueryClient();
  const [query, setQuery] = useState("");
  const [minScore, setMinScore] = useState(60);
  const [profileDialogOpen, setProfileDialogOpen] = useState(false);
  const [editProfile, setEditProfile] = useState<SearchProfile | null>(null);

  const { data: clients = [] } = useQuery({
    queryKey: ["clients"],
    queryFn: async () => (await supabase.from("clients").select("*").order("full_name")).data ?? [],
  });
  const { data: properties = [] } = useQuery({
    queryKey: ["properties"],
    queryFn: async () => (await supabase.from("properties").select("*")).data ?? [],
  });
  const { data: searchProfiles = [] } = useQuery({
    queryKey: ["search_profiles"],
    queryFn: async () =>
      (await supabase
        .from("client_search_profiles")
        .select("*")
        .order("created_at", { ascending: false })
      ).data ?? [],
  });
  const { data: media = [] } = useQuery({
    queryKey: ["property_media_min"],
    queryFn: async () =>
      (await supabase
        .from("property_media")
        .select("property_id,file_url,is_cover,sort_order")
        .order("is_cover", { ascending: false })
        .order("sort_order", { ascending: true })
      ).data ?? [],
  });
  const coverByProperty = useMemo(() => {
    const map = new Map<string, string>();
    for (const m of media as any[]) {
      if (!m.file_url) continue;
      if (!map.has(m.property_id)) map.set(m.property_id, m.file_url);
    }
    return map;
  }, [media]);
  const { data: disclosures = [] } = useQuery({
    queryKey: ["self_disclosures_all"],
    queryFn: async () =>
      (await supabase
        .from("client_self_disclosures")
        .select("client_id,total_income_monthly,salary_net_monthly,additional_income,income_job_two,income_rental,annual_net_salary")
      ).data ?? [],
  });
  const { data: relationships = [] } = useQuery({
    queryKey: ["client_relationships_all"],
    queryFn: async () =>
      (await supabase
        .from("client_relationships")
        .select("client_id,related_client_id,relationship_type")
        .in("relationship_type", ["spouse", "co_applicant"])
      ).data ?? [],
  });

  // Map: clientId → finanzielle Tragfähigkeit (inkl. Ehepartner/Mitantragsteller)
  const capacityMap = useMemo(() => {
    const incomeYearly = new Map<string, number>();
    for (const d of disclosures as any[]) {
      const monthly =
        Number(d.total_income_monthly ?? 0) ||
        (Number(d.salary_net_monthly ?? 0) +
          Number(d.additional_income ?? 0) +
          Number(d.income_job_two ?? 0) +
          Number(d.income_rental ?? 0));
      const yearly = monthly > 0 ? monthly * 12 : Number(d.annual_net_salary ?? 0);
      if (yearly > 0) incomeYearly.set(d.client_id as string, (incomeYearly.get(d.client_id as string) ?? 0) + yearly);
    }
    const equityById = new Map<string, number>();
    for (const c of clients) {
      const eq = Number((c as any).equity ?? 0);
      if (eq > 0) equityById.set(c.id, eq);
    }
    // Partner-Links beide Richtungen
    const partnersOf = new Map<string, string[]>();
    for (const r of relationships as any[]) {
      const a = r.client_id as string;
      const b = r.related_client_id as string;
      partnersOf.set(a, [...(partnersOf.get(a) ?? []), b]);
      partnersOf.set(b, [...(partnersOf.get(b) ?? []), a]);
    }

    const out = new Map<string, FinancialCapacity>();
    for (const c of clients) {
      const partners = partnersOf.get(c.id) ?? [];
      const ownIncome = incomeYearly.get(c.id) ?? 0;
      const ownEquity = equityById.get(c.id) ?? 0;
      const partnerIncome = partners.reduce((s, pid) => s + (incomeYearly.get(pid) ?? 0), 0);
      const partnerEquity = partners.reduce((s, pid) => s + (equityById.get(pid) ?? 0), 0);
      const gross = ownIncome + partnerIncome;
      const equity = ownEquity + partnerEquity;
      if (gross > 0 || equity > 0) {
        out.set(c.id, {
          grossIncomeYearly: gross,
          equity,
          hasPartner: partners.length > 0 && partnerIncome > 0,
        });
      }
    }
    return out;
  }, [disclosures, relationships, clients]);

  // Global matches: alle Kunde × Immobilie Paare, gefiltert + sortiert
  const globalMatches = useMemo<GlobalMatch[]>(() => {
    const seekers = clients.filter((c) => c.client_type === "buyer" || c.client_type === "tenant");
    const available = properties.filter(
      (p) => p.status === "available" || p.status === "draft" || p.status === "active" || p.status === "preparation",
    );
    const out: GlobalMatch[] = [];
    for (const c of seekers) {
      for (const p of available) {
        const r = scoreMatch(c, p, capacityMap.get(c.id) ?? null);
        if (r.score >= minScore) out.push({ client: c, property: p, ...r });
      }
    }
    return out.sort((a, b) => b.score - a.score);
  }, [clients, properties, minScore, capacityMap]);

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
    () => (selected ? matchClientToProperties(selected, properties, 40, capacityMap.get(selected.id) ?? null) : []),
    [selected, properties, capacityMap],
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

  const setView = (v: "all" | "client" | "profile") =>
    navigate({ search: { clientId, view: v, profileId } });

  const activeProfiles = useMemo(
    () => (searchProfiles as SearchProfile[]).filter((p) => p.is_active),
    [searchProfiles],
  );
  const clientNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of clients) m.set(c.id, c.full_name ?? "");
    return m;
  }, [clients]);

  /** Suchprofil → Pseudo-Kunde für den bestehenden Scoring-Algorithmus */
  const profileAsClient = (p: SearchProfile): Client => {
    const base = clients.find((c) => c.id === p.client_id);
    return {
      ...(base as Client),
      budget_min: p.budget_min,
      budget_max: p.budget_max,
      rooms_min: p.rooms_min,
      area_min: p.area_min,
      area_max: p.area_max,
      preferred_cities: p.preferred_cities,
      preferred_types: (p.preferred_property_types ?? []) as Client["preferred_types"],
      preferred_listing: p.preferred_listing ?? p.listing_type,
    } as Client;
  };

  const profileMatchCount = (p: SearchProfile) => {
    const pseudo = profileAsClient(p);
    if (!pseudo?.id) return 0;
    return matchClientToProperties(pseudo, properties, 60, capacityMap.get(p.client_id) ?? null).length;
  };

  const selectedProfile = (searchProfiles as SearchProfile[]).find((p) => p.id === profileId) ?? null;
  const profileMatches = useMemo(() => {
    if (!selectedProfile) return [];
    const pseudo = profileAsClient(selectedProfile);
    if (!pseudo?.id) return [];
    return matchClientToProperties(pseudo, properties, 40, capacityMap.get(selectedProfile.client_id) ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProfile, properties, capacityMap, clients]);

  return (
    <>
      <PageHeader
        i18nKey="matching"
        action={
          <Button
            onClick={() => {
              setEditProfile(null);
              setProfileDialogOpen(true);
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            Suchprofil erstellen
          </Button>
        }
      />

      <SearchProfileDialog
        open={profileDialogOpen}
        onOpenChange={setProfileDialogOpen}
        profile={editProfile}
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
                <TabsTrigger value="profile">Suchprofile</TabsTrigger>
              </TabsList>
            </Tabs>

            {view === "profile" ? (
              <>
                <span className="text-sm text-muted-foreground">Suchprofil:</span>
                <Select
                  value={selectedProfile?.id ?? ""}
                  onValueChange={(v) => navigate({ search: { clientId, view: "profile", profileId: v } })}
                >
                  <SelectTrigger className="h-9 w-80"><SelectValue placeholder="Suchprofil wählen" /></SelectTrigger>
                  <SelectContent>
                    {activeProfiles.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {clientNameById.get(p.client_id) || "Kunde"} · {p.listing_type === "rent" ? "Miete" : "Kauf"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedProfile && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setEditProfile(selectedProfile);
                      setProfileDialogOpen(true);
                    }}
                  >
                    <Pencil className="mr-2 h-3.5 w-3.5" />
                    Bearbeiten
                  </Button>
                )}
                <Badge variant="secondary" className="ml-auto">{profileMatches.length} Treffer</Badge>
              </>
            ) : view === "all" ? (
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
                  onValueChange={(v) => navigate({ search: { clientId: v, view: "client", profileId } })}
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
                        coverUrl={coverByProperty.get(m.property.id)}
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
                              onClick={() => navigate({ search: { clientId: l.client.id, view: "client", profileId } })}
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

                <Card>
                  <CardContent className="p-4">
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <h3 className="flex items-center gap-2 text-sm font-semibold">
                        <Target className="h-4 w-4 text-primary" />
                        Aktive Suchprofile
                      </h3>
                      <Badge variant="secondary" className="text-[10px]">{activeProfiles.length}</Badge>
                    </div>
                    {activeProfiles.length === 0 ? (
                      <p className="text-xs text-muted-foreground">
                        Noch keine Suchprofile. Erstelle oben rechts ein Suchprofil.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {activeProfiles.slice(0, 8).map((p) => (
                          <button
                            key={p.id}
                            onClick={() => navigate({ search: { clientId: p.client_id, view: "profile", profileId: p.id } })}
                            className="w-full rounded-lg border bg-muted/40 p-2.5 text-left transition hover:bg-accent/60"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="truncate text-sm font-medium">
                                {clientNameById.get(p.client_id) || "Kunde"}
                              </span>
                              <Badge variant="secondary" className="shrink-0 font-mono text-[10px]">
                                {profileMatchCount(p)} Objekte
                              </Badge>
                            </div>
                            <p className="mt-1 truncate text-[11px] text-muted-foreground">
                              {[
                                p.listing_type === "rent" ? "Miete" : "Kauf",
                                p.budget_max ? `bis ${formatCurrency(Number(p.budget_max))}` : null,
                                p.rooms_min ? `≥ ${p.rooms_min} Zi` : null,
                                p.preferred_cities?.length ? p.preferred_cities.join(", ") : null,
                              ].filter(Boolean).join(" · ")}
                            </p>
                          </button>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </aside>
            </div>
          ) : view === "profile" ? (
            !selectedProfile ? (
              <EmptyState
                title="Kein Suchprofil ausgewählt"
                description="Wähle ein Suchprofil oder erstelle oben rechts ein neues."
              />
            ) : profileMatches.length === 0 ? (
              <EmptyState
                title="Keine passenden Immobilien"
                description="Verfeinere das Suchprofil oder erfasse weitere Objekte."
              />
            ) : (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {profileMatches.map(({ property: p, score, reasons }) => (
                  <MatchCard
                    key={p.id}
                    property={p}
                    coverUrl={coverByProperty.get(p.id)}
                    score={score}
                    reasons={reasons}
                    onSave={() => save.mutate({ client_id: selectedProfile.client_id, property_id: p.id, score, reasons })}
                  />
                ))}
              </div>
            )
          ) : clientMatches.length === 0 ? (
            <EmptyState title="Keine passenden Immobilien" description="Erfasse mehr Objekte oder verfeinere das Suchprofil." />
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {clientMatches.map(({ property: p, score, reasons }) => (
                <MatchCard
                  key={p.id}
                  property={p}
                  coverUrl={coverByProperty.get(p.id)}
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

function affordabilityChipClass(ratio: number): string {
  if (ratio <= 28) return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 ring-1 ring-emerald-500/30";
  if (ratio <= 33) return "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 ring-1 ring-emerald-500/20";
  if (ratio <= 38) return "bg-amber-500/15 text-amber-700 dark:text-amber-400 ring-1 ring-amber-500/30";
  return "bg-destructive/15 text-destructive ring-1 ring-destructive/30";
}

function MatchCard({
  client,
  property: p,
  coverUrl,
  score,
  reasons,
  onSave,
}: {
  client?: Client;
  property: Property;
  coverUrl?: string;
  score: number;
  reasons: string[];
  onSave: () => void;
}) {
  const cover = coverUrl ?? p.images?.[0];
  return (
    <Card className="overflow-hidden transition hover:shadow-glow">
      <div className="aspect-[16/10] overflow-hidden bg-muted">
        {cover
          ? <img src={cover} alt={p.title} className="h-full w-full object-cover" loading="lazy" />
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
          {reasons.slice(0, 4).map((r) => {
            const m = r.match(/Tragbarkeit\s+(\d+(?:\.\d+)?)%/i);
            if (m) {
              const ratio = Number(m[1]);
              return (
                <span
                  key={r}
                  className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${affordabilityChipClass(ratio)}`}
                  title="Kalkulatorische Tragbarkeit (Richtwert max. 33 %)"
                >
                  {r}
                </span>
              );
            }
            return (
              <span key={r} className="rounded-full bg-accent/60 px-2 py-0.5 text-[10px] text-accent-foreground">{r}</span>
            );
          })}
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
