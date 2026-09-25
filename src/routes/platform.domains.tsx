import { createFileRoute } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { PlatformPage, QueryState } from "@/components/platform/PlatformLayout";
import { DomainsTable } from "@/components/platform/tables";
import { usePlatformDomains } from "@/lib/platform-admin";

export const Route = createFileRoute("/platform/domains")({ component: () => {
  const q = usePlatformDomains();
  return (
    <PlatformPage title="Domains" description="Immolia-Subdomains und Custom Domains aller Unternehmen.">
      <QueryState isLoading={q.isLoading} error={q.error} />
      <Card><DomainsTable rows={q.data ?? []} showTenant /></Card>
    </PlatformPage>
  );
} });
