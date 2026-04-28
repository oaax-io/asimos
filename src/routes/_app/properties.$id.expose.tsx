import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Printer, Building2 } from "lucide-react";
import { formatCurrency, formatArea, propertyTypeLabels, listingTypeLabels } from "@/lib/format";

export const Route = createFileRoute("/_app/properties/$id/expose")({ component: ExposePage });

function ExposePage() {
  const { id } = Route.useParams();
  const { data: p } = useQuery({
    queryKey: ["property-expose", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("properties").select("*").eq("id", id).single();
      if (error) throw error;
      return data;
    },
  });

  if (!p) return <div>Lädt…</div>;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between print:hidden">
        <Button variant="ghost" asChild><Link to="/properties/$id" params={{ id }}><ArrowLeft className="mr-1 h-4 w-4" />Zurück</Link></Button>
        <Button onClick={() => window.print()}><Printer className="mr-1 h-4 w-4" />Drucken / PDF</Button>
      </div>

      <div className="mx-auto max-w-3xl rounded-2xl border bg-card p-10 shadow-soft print:border-0 print:shadow-none">
        <header className="mb-8 flex items-center justify-between border-b pb-6">
          <div>
            <p className="font-display font-bold">ASIMO Real Estate</p>
            <p className="text-xs text-muted-foreground">Immobilienexposé</p>
          </div>
          <p className="text-xs text-muted-foreground">{new Date().toLocaleDateString("de-DE")}</p>
        </header>

        {p.images?.[0] && (
          <div className="mb-6 aspect-[16/9] overflow-hidden rounded-xl">
            <img src={p.images[0]} alt={p.title} className="h-full w-full object-cover" />
          </div>
        )}

        <h1 className="font-display text-3xl font-bold">{p.title}</h1>
        <p className="mt-2 text-muted-foreground">{[p.address, p.postal_code, p.city].filter(Boolean).join(", ")}</p>

        <div className="my-6 flex items-end justify-between border-y py-4">
          <div>
            <p className="text-xs uppercase text-muted-foreground">{listingTypeLabels[p.listing_type as keyof typeof listingTypeLabels]}preis</p>
            <p className="font-display text-3xl font-bold text-gradient-brand">{formatCurrency(p.price ? Number(p.price) : null)}</p>
          </div>
          <p className="text-sm text-muted-foreground">{propertyTypeLabels[p.property_type as keyof typeof propertyTypeLabels]}</p>
        </div>

        <div className="grid grid-cols-4 gap-4 text-center">
          <Spec label="Fläche" value={formatArea(p.area ? Number(p.area) : null)} />
          <Spec label="Zimmer" value={p.rooms ? String(p.rooms) : "—"} />
          <Spec label="Bäder" value={p.bathrooms ? String(p.bathrooms) : "—"} />
          <Spec label="Energie" value={p.energy_class ?? "—"} />
        </div>

        {p.description && (
          <section className="mt-8">
            <h2 className="mb-2 font-display text-xl font-bold">Objektbeschreibung</h2>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">{p.description}</p>
          </section>
        )}

        {p.features?.length ? (
          <section className="mt-8">
            <h2 className="mb-3 font-display text-xl font-bold">Ausstattung</h2>
            <ul className="grid grid-cols-2 gap-2 text-sm">
              {p.features.map(f => <li key={f} className="flex items-center gap-2 before:h-1.5 before:w-1.5 before:rounded-full before:bg-primary">{f}</li>)}
            </ul>
          </section>
        ) : null}

        <footer className="mt-10 border-t pt-6 text-center text-xs text-muted-foreground">
          Erstellt mit ASIMO Real Estate · Alle Angaben ohne Gewähr.
        </footer>
      </div>
    </div>
  );
}

function Spec({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-muted/40 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-semibold">{value}</p>
    </div>
  );
}
