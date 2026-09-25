import { createFileRoute } from "@tanstack/react-router";
import { PlatformPage } from "@/components/platform/PlatformLayout";
import { ModuleMatrix } from "@/components/platform/ModuleCenter";

export const Route = createFileRoute("/platform/modules")({ component: () => (
  <PlatformPage title="Module Center" description="Freischaltung und Aktivierung aller Module pro Unternehmen. Keine CRM-Daten.">
    <ModuleMatrix />
  </PlatformPage>
) });
