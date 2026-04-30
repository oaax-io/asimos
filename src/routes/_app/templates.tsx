import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/PageHeader";
import { DocumentTemplatesManager } from "@/components/settings/DocumentTemplatesManager";

export const Route = createFileRoute("/_app/templates")({ component: TemplatesPage });

function TemplatesPage() {
  return (
    <>
      <PageHeader
        title="Dokumentvorlagen"
        description="Vorlagen für Mandate, Reservationen und weitere Verträge mit dynamischen Variablen"
      />
      <DocumentTemplatesManager />
    </>
  );
}
