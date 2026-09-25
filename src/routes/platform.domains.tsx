import { createFileRoute } from "@tanstack/react-router";
import { PlatformPage } from "@/components/platform/PlatformLayout";
import { DomainCenter } from "@/components/platform/DomainCenter";

export const Route = createFileRoute("/platform/domains")({ component: () => (
  <PlatformPage title="Domain Center" description="Immolia-Adressen und Custom Domains aller Unternehmen. Keine CRM-Daten.">
    <DomainCenter />
  </PlatformPage>
) });
