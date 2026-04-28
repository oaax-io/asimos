import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Search, FileBadge, ExternalLink, MapPin } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/EmptyState";
import { formatCurrency, formatArea, propertyTypeLabels, propertyStatusLabels } from "@/lib/format";

export const Route = createFileRoute("/_app/exposes")({ component: ExposesPage });

function ExposesPage() {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  const { data: properties = [], isLoading } = useQuery({
    queryKey: ["exposes-properties"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("properties")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const filtered = useMemo(() => properties.filter((p) => {
    if (typeFilter !== "all" && p.property_type !== typeFilter) return false;
    if (search) {
      const s = search.toLowerCase();
      if (!p.title?.toLowerCase().includes(s) && !p.city?.toLowerCase().includes(s)) return false;
    }
    return true;
  }), [properties, typeFilter, search]);

  return (
    <>
      <PageHeader
        title="Exposés"
        description="Präsentationsfertige Objektunterlagen für deine Kunden"
      />

      <div className="mb-4 flex flex-wrap gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Objekte suchen…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Typ" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Typen</SelectItem>
            {Object.entries(propertyTypeLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="rounded-xl border bg-muted/20 p-4 text-sm text-muted-foreground">Wird geladen…</div>
      ) : filtered.length === 0 ? (
        <EmptyState
          title="Keine Exposés verfügbar"
          description="Sobald du Immobilien erfasst hast, kannst du hier auf Knopfdruck Exposés generieren."
          action={<Button asChild><Link to="/properties">Zu den Immobilien</Link></Button>}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((p) => (
            <Card key={p.id} className="overflow-hidden transition hover:shadow-soft">
              <div className="aspect-[16/10] overflow-hidden bg-muted">
                {p.images?.[0] ? (
                  <img src={p.images[0]} alt={p.title} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-gradient-soft">
                    <FileBadge className="h-12 w-12 text-muted-foreground/40" />
                  </div>
                )}
              </div>
              <CardContent className="p-4">
                <div className="flex items-center justify-between gap-2">
                  <Badge variant="secondary" className="text-xs">{propertyStatusLabels[p.status as keyof typeof propertyStatusLabels]}</Badge>
                  <span className="text-xs text-muted-foreground">{propertyTypeLabels[p.property_type as keyof typeof propertyTypeLabels]}</span>
                </div>
                <h3 className="mt-2 line-clamp-1 font-semibold">{p.title}</h3>
                <p className="mt-1 line-clamp-1 flex items-center gap-1 text-xs text-muted-foreground">
                  <MapPin className="h-3 w-3" />
                  {[p.address, p.city].filter(Boolean).join(", ") || "—"}
                </p>
                <div className="mt-3 flex items-center justify-between">
                  <div>
                    <p className="font-display text-lg font-bold">{formatCurrency(p.price ? Number(p.price) : null)}</p>
                    <p className="text-xs text-muted-foreground">{formatArea(p.area ? Number(p.area) : null)}</p>
                  </div>
                  <Button size="sm" asChild>
                    <Link to="/properties/$id/expose" params={{ id: p.id }}>
                      <ExternalLink className="mr-1 h-3 w-3" />
                      Exposé
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
