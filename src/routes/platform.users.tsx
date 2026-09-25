import { createFileRoute } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { PlatformPage, QueryState } from "@/components/platform/PlatformLayout";
import { MembersTable } from "@/components/platform/tables";
import { usePlatformMembers } from "@/lib/platform-admin";

export const Route = createFileRoute("/platform/users")({ component: () => {
  const q = usePlatformMembers();
  return (
    <PlatformPage title="Benutzer" description="Mitgliedschaften aller Unternehmen (nur Metadaten).">
      <QueryState isLoading={q.isLoading} error={q.error} />
      <Card><MembersTable rows={q.data ?? []} showTenant /></Card>
    </PlatformPage>
  );
} });
