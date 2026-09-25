import { createFileRoute } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { PlatformPage, QueryState } from "@/components/platform/PlatformLayout";
import { ModulesTable } from "@/components/platform/tables";
import { usePlatformModules } from "@/lib/platform-admin";

export const Route = createFileRoute("/platform/modules")({ component: () => {
  const q = usePlatformModules();
  return (
    <PlatformPage title="Module" description="Freischaltung und Aktivierung pro Unternehmen (nur Ansicht).">
      <QueryState isLoading={q.isLoading} error={q.error} />
      <Card><ModulesTable rows={q.data ?? []} showTenant /></Card>
    </PlatformPage>
  );
} });
