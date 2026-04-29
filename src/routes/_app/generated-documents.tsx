import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/PageHeader";
import { GeneratedDocumentsTable } from "@/components/documents/GeneratedDocumentsTable";

// Diese Route bleibt fuer Direktlinks erhalten, ist aber nicht mehr in der Sidebar.
// Der zentrale Einstieg ist /documents.
export const Route = createFileRoute("/_app/generated-documents")({
  component: GeneratedDocumentsPage,
});

function GeneratedDocumentsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Generierte Dokumente"
        description="Alle aus Vorlagen erstellten Dokumente. Tipp: Im Dokumentencenter findest du auch hochgeladene Dateien."
      />
      <GeneratedDocumentsTable />
    </div>
  );
}
