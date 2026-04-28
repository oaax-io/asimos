import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { EmptyState } from "@/components/EmptyState";
import { formatCurrency, propertyTypeLabels, clientTypeLabels } from "@/lib/format";
import {
  matchClientToProperties,
  matchPropertyToClients,
  type PropertyMatch,
  type ClientMatch,
} from "@/lib/matching";
import {
  Sparkles, ExternalLink, Star, Mail, Phone, X, ArrowRightLeft, Check,
} from "lucide-react";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

type MatchStatus = "suggested" | "shortlisted" | "contacted" | "interested" | "rejected" | "converted";

const statusLabels: Record<MatchStatus, string> = {
  suggested: "Vorgeschlagen",
  shortlisted: "Shortlist",
  contacted: "Kontaktiert",
  interested: "Interessiert",
  rejected: "Abgelehnt",
  converted: "Konvertiert",
};

const statusVariant: Record<MatchStatus, "default" | "secondary" | "outline" | "destructive"> = {
  suggested: "outline",
  shortlisted: "secondary",
  contacted: "secondary",
  interested: "default",
  rejected: "destructive",
  converted: "default",
};

interface StoredMatch {
  id: string;
  client_id: string;
  property_id: string;
  score: number;
  status: MatchStatus;
  reasons: any;
}

function normalizeStoredScore(s: number): number {
  // legacy rows might store 0..1
  return s > 1 ? Math.round(s) : Math.round(s * 100);
}

interface PanelProps {
  /** Side currently being viewed; the *other* side is the row in the panel. */
  direction: "client-to-property" | "property-to-client";
  client?: Tables<"clients">;
  property?: Tables<"properties">;
}

export function MatchPanel(props: PanelProps) {
  const { user } = useAuth();
  const qc = useQueryClient();

  const isClientView = props.direction === "client-to-property";
  const anchorId = isClientView ? props.client!.id : props.property!.id;

  // Load all candidates of opposite type
  const candidates = useQuery({
    queryKey: ["match-candidates", props.direction, anchorId],
    queryFn: async () => {
      if (isClientView) {
        const { data } = await supabase.from("properties").select("*");
        return data ?? [];
      }
      const { data } = await supabase.from("clients").select("*");
      return data ?? [];
    },
  });

  // Load stored matches for this anchor
  const stored = useQuery({
    queryKey: ["matches", props.direction, anchorId],
    queryFn: async () => {
      const col = isClientView ? "client_id" : "property_id";
      const { data } = await supabase.from("matches").select("*").eq(col, anchorId);
      return (data ?? []) as StoredMatch[];
    },
  });

  const computed = (() => {
    if (!candidates.data) return [];
    if (isClientView) {
      return matchClientToProperties(props.client!, candidates.data as Tables<"properties">[], 0);
    }
    return matchPropertyToClients(props.property!, candidates.data as Tables<"clients">[], 0);
  })();

  // Merge: include all stored (manual overrides) plus computed >= 40
  const storedMap = new Map<string, StoredMatch>();
  stored.data?.forEach((m) => {
    const otherId = isClientView ? m.property_id : m.client_id;
    storedMap.set(otherId, m);
  });

  type Row = {
    otherId: string;
    score: number;
    reasons: string[];
    misses: string[];
    stored?: StoredMatch;
    entity: any;
  };

  const rows: Row[] = computed
    .filter((c: any) => {
      const id = isClientView ? c.property.id : c.client.id;
      return c.score >= 40 || storedMap.has(id);
    })
    .map((c: any) => {
      const entity = isClientView ? c.property : c.client;
      return {
        otherId: entity.id,
        score: c.score,
        reasons: c.reasons,
        misses: c.misses,
        stored: storedMap.get(entity.id),
        entity,
      };
    });

  // Add stored-only rows (entity removed from candidates list shouldn't happen often, skip)
  const sorted = rows.sort((a, b) => {
    const sa = a.stored ? normalizeStoredScore(a.stored.score) : a.score;
    const sb = b.stored ? normalizeStoredScore(b.stored.score) : b.score;
    return sb - sa;
  });

  const upsert = useMutation({
    mutationFn: async (input: { otherId: string; score: number; reasons: string[]; status: MatchStatus }) => {
      const { data: profile } = await supabase
        .from("profiles").select("agency_id").eq("id", user!.id).single();
      const payload = {
        agency_id: profile!.agency_id,
        client_id: isClientView ? props.client!.id : input.otherId,
        property_id: isClientView ? input.otherId : props.property!.id,
        score: input.score,
        reasons: input.reasons,
        status: input.status,
      };
      const { error } = await supabase
        .from("matches")
        .upsert(payload, { onConflict: "client_id,property_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["matches"] });
      qc.invalidateQueries({ queryKey: ["matches", props.direction, anchorId] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const setStatus = (row: Row, status: MatchStatus, msg: string) => {
    upsert.mutate(
      { otherId: row.otherId, score: row.score, reasons: row.reasons, status },
      { onSuccess: () => toast.success(msg) },
    );
  };

  if (candidates.isLoading || stored.isLoading) {
    return <p className="text-sm text-muted-foreground">Matching wird berechnet…</p>;
  }

  if (sorted.length === 0) {
    return (
      <EmptyState
        title="Keine passenden Treffer"
        description={
          isClientView
            ? "Erfasse mehr Objekte oder verfeinere das Suchprofil."
            : "Erfasse mehr Kunden mit Suchprofil oder erweitere die Eckdaten der Immobilie."
        }
      />
    );
  }

  return (
    <div className="space-y-3">
      {sorted.map((row) => {
        const score = row.stored ? normalizeStoredScore(row.stored.score) : row.score;
        const status: MatchStatus = row.stored?.status ?? "suggested";
        const isClosed = status === "rejected" || status === "converted";
        return (
          <Card key={row.otherId} className={isClosed ? "opacity-70" : ""}>
            <CardContent className="p-5">
              <div className="flex flex-wrap items-start gap-4">
                <div className="flex shrink-0 flex-col items-center gap-1">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-brand text-sm font-bold text-primary-foreground">
                    {score}%
                  </div>
                  <Progress value={score} className="h-1.5 w-14" />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    {isClientView ? (
                      <>
                        <h4 className="truncate font-semibold">{row.entity.title}</h4>
                        {row.entity.city && (
                          <span className="text-xs text-muted-foreground">· {row.entity.city}</span>
                        )}
                        <Badge variant="outline" className="text-[10px]">
                          {propertyTypeLabels[row.entity.property_type as keyof typeof propertyTypeLabels]}
                        </Badge>
                      </>
                    ) : (
                      <>
                        <h4 className="truncate font-semibold">{row.entity.full_name}</h4>
                        <Badge variant="outline" className="text-[10px]">
                          {clientTypeLabels[row.entity.client_type as keyof typeof clientTypeLabels]}
                        </Badge>
                      </>
                    )}
                    <Badge variant={statusVariant[status]} className="ml-auto text-[10px]">
                      {statusLabels[status]}
                    </Badge>
                  </div>

                  <p className="mt-1 text-sm font-medium">
                    {isClientView
                      ? formatCurrency(row.entity.price ? Number(row.entity.price) : row.entity.rent ? Number(row.entity.rent) : null)
                      : row.entity.budget_max
                      ? `bis ${formatCurrency(Number(row.entity.budget_max))}`
                      : "—"}
                  </p>

                  <div className="mt-2 flex flex-wrap gap-1">
                    {row.reasons.map((r) => (
                      <span key={r} className="rounded-full bg-accent/60 px-2 py-0.5 text-[11px] text-accent-foreground">
                        ✓ {r}
                      </span>
                    ))}
                    {row.misses.map((r) => (
                      <span key={r} className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                        ✗ {r}
                      </span>
                    ))}
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button size="sm" variant="outline" asChild>
                      <Link
                        to={isClientView ? "/properties/$id" : "/clients/$id"}
                        params={{ id: row.otherId }}
                      >
                        <ExternalLink className="mr-1 h-3 w-3" />
                        Öffnen
                      </Link>
                    </Button>

                    <Button
                      size="sm"
                      variant={status === "shortlisted" ? "default" : "outline"}
                      onClick={() => setStatus(row, "shortlisted", "Auf Shortlist gesetzt")}
                      disabled={upsert.isPending}
                    >
                      <Star className="mr-1 h-3 w-3" />
                      Shortlist
                    </Button>

                    {!isClientView && (row.entity.email || row.entity.phone) && (
                      <Button
                        size="sm"
                        variant="outline"
                        asChild
                        onClick={() => setStatus(row, "contacted", "Als kontaktiert markiert")}
                      >
                        <a href={row.entity.email ? `mailto:${row.entity.email}` : `tel:${row.entity.phone}`}>
                          {row.entity.email ? <Mail className="mr-1 h-3 w-3" /> : <Phone className="mr-1 h-3 w-3" />}
                          Kontaktieren
                        </a>
                      </Button>
                    )}
                    {isClientView && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setStatus(row, "contacted", "Als kontaktiert markiert")}
                        disabled={upsert.isPending}
                      >
                        <ArrowRightLeft className="mr-1 h-3 w-3" />
                        Kontaktiert
                      </Button>
                    )}

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setStatus(row, "converted", "Match konvertiert")}
                      disabled={upsert.isPending}
                    >
                      <Check className="mr-1 h-3 w-3" />
                      Konvertieren
                    </Button>

                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setStatus(row, "rejected", "Match abgelehnt")}
                      disabled={upsert.isPending}
                    >
                      <X className="mr-1 h-3 w-3" />
                      Ablehnen
                    </Button>

                    {!row.stored && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setStatus(row, "suggested", "Match gespeichert")}
                        disabled={upsert.isPending}
                      >
                        <Sparkles className="mr-1 h-3 w-3" />
                        Speichern
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
