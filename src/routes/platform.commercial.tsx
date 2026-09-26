import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PlatformPage, QueryState } from "@/components/platform/PlatformLayout";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

/**
 * Phase 5.1 – Commercial Foundation (nur Ansicht).
 * Pläne, Credit-Pakete, Credit-Aktionen und Add-ons werden ausschliesslich über
 * platform_* RPCs gepflegt. Noch keine Preise/Werte definiert; kein Stripe.
 */
export const Route = createFileRoute("/platform/commercial")({
  head: () => ({ meta: [{ title: "Commercial – Immolia Platform Admin" }, { name: "robots", content: "noindex" }] }),
  component: CommercialPage,
});

type Row = Record<string, unknown> & { id: string; key?: string; action_key?: string; name: string; status?: string; active?: boolean };

function useList(table: "plans" | "credit_packages" | "credit_action_costs" | "addons") {
  return useQuery({
    queryKey: ["platform-commercial", table],
    queryFn: async () => {
      const { data, error } = await (supabase.from(table as never) as any).select("*").order("name");
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });
}

function Section({ title, hint, q, render }: { title: string; hint: string; q: ReturnType<typeof useList>; render: (r: Row) => React.ReactNode }) {
  return (
    <Card className="p-5">
      <div className="mb-3">
        <h2 className="font-medium">{title}</h2>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
      <QueryState isLoading={q.isLoading} error={q.error} />
      {q.data && q.data.length === 0 && <p className="text-sm text-muted-foreground">Noch nichts definiert.</p>}
      {q.data && q.data.length > 0 && (
        <div className="divide-y">{q.data.map((r) => <div key={r.id} className="flex items-center justify-between gap-4 py-2 text-sm">{render(r)}</div>)}</div>
      )}
    </Card>
  );
}

function CommercialPage() {
  const plans = useList("plans");
  const packs = useList("credit_packages");
  const actions = useList("credit_action_costs");
  const addons = useList("addons");
  return (
    <PlatformPage title="Commercial" description="Grundlage für Pläne, Freischaltungen, Limits, Credits und Add-ons. Noch keine Preise festgelegt, keine Zahlungen. Bestehende Module der Unternehmen bleiben massgeblich.">
      <div className="grid gap-4 md:grid-cols-2">
        <Section title="Pläne" hint="Produktpakete mit Freischaltungen und Limits." q={plans}
          render={(r) => (<><span>{r.name} <span className="text-muted-foreground">({r.key})</span></span><Badge variant="outline">{r.status}</Badge></>)} />
        <Section title="Add-ons" hint="Dauerhafte Zusatzleistungen, erweitern Limits oder Freischaltungen." q={addons}
          render={(r) => (<><span>{r.name}</span><Badge variant="outline">{r.status}</Badge></>)} />
        <Section title="Credit-Pakete" hint="Kaufbare Credits (CHF). Stripe folgt später." q={packs}
          render={(r) => (<><span>{r.name}</span><span className="text-muted-foreground">{r.credits != null ? `${r.credits} Credits` : "–"}</span></>)} />
        <Section title="Creditpflichtige Aktionen" hint="Ohne aktiven Wert grösser 0 ist eine Aktion kostenlos." q={actions}
          render={(r) => (<><span>{r.name} <span className="text-muted-foreground">({r.action_key})</span></span><span className="text-muted-foreground">{r.active && Number(r.credit_cost) > 0 ? `${r.credit_cost} Credits` : "kostenlos"}</span></>)} />
      </div>
    </PlatformPage>
  );
}
