import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent } from "@/components/ui/card";
import { PlatformPage, QueryState } from "@/components/platform/PlatformLayout";
import { ActivityList } from "@/components/platform/ActivityList";
import { usePlatformActivity } from "@/lib/platform-admin";

export const Route = createFileRoute("/platform/activity")({ component: () => {
  const q = usePlatformActivity(undefined, 200);
  return (
    <PlatformPage title="Aktivität" description="Plattform-Ereignisse: Unternehmen, Domains, Mitgliedschaften.">
      <QueryState isLoading={q.isLoading} error={q.error} />
      <Card><CardContent className="p-5"><ActivityList items={q.data ?? []} /></CardContent></Card>
    </PlatformPage>
  );
} });
