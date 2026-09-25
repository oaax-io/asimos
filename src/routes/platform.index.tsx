import { createFileRoute, Link } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PlatformPage, QueryState } from "@/components/platform/PlatformLayout";
import { ActivityList } from "@/components/platform/ActivityList";
import { usePlatformOverview, usePlatformActivity } from "@/lib/platform-admin";

export const Route = createFileRoute("/platform/")({ component: Overview });

function Overview() {
  const o = usePlatformOverview();
  const a = usePlatformActivity(undefined, 10);
  const cards = o.data ? [
    ["Unternehmen", o.data.tenants], ["Benutzer", o.data.users], ["Aktive Domains", o.data.active_domains],
    ["Immolia-Subdomains", o.data.subdomains], ["Custom Domains", o.data.custom_domains], ["Aktive Module", o.data.active_modules],
  ] as const : [];
  return (
    <PlatformPage title="Übersicht" description="Plattform-Metadaten. Keine Geschäftsdaten der Unternehmen.">
      <QueryState isLoading={o.isLoading} error={o.error} />
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        {cards.map(([l, v]) => (
          <Card key={l}><CardContent className="p-5">
            <div className="text-xs text-muted-foreground">{l}</div>
            <div className="mt-1 text-3xl font-semibold">{v}</div>
          </CardContent></Card>
        ))}
      </div>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Letzte Plattformaktivitäten</CardTitle>
          <Link to="/platform/activity" className="text-sm text-primary hover:underline">Alle anzeigen</Link>
        </CardHeader>
        <CardContent><QueryState isLoading={a.isLoading} error={a.error} /><ActivityList items={a.data ?? []} /></CardContent>
      </Card>
    </PlatformPage>
  );
}
