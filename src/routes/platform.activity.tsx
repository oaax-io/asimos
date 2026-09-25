import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PlatformPage, QueryState } from "@/components/platform/PlatformLayout";
import { ActivityList } from "@/components/platform/ActivityList";
import { AuditLogList } from "@/components/platform/AuditLogList";
import { usePlatformActivity, usePlatformAuditLogs } from "@/lib/platform-admin";

export const Route = createFileRoute("/platform/activity")({ component: () => {
  const audit = usePlatformAuditLogs(undefined, 200);
  const q = usePlatformActivity(undefined, 200);
  return (
    <PlatformPage title="Aktivität" description="Audit-Aktionen des Platform Admin Centers und Systemereignisse.">
      <Card><CardHeader><CardTitle className="text-base">Audit-Aktionen</CardTitle></CardHeader>
        <CardContent><QueryState isLoading={audit.isLoading} error={audit.error} /><AuditLogList items={audit.data ?? []} /></CardContent></Card>
      <Card><CardHeader><CardTitle className="text-base">Systemereignisse</CardTitle></CardHeader>
        <CardContent><QueryState isLoading={q.isLoading} error={q.error} /><ActivityList items={q.data ?? []} /></CardContent></Card>
    </PlatformPage>
  );
} });
