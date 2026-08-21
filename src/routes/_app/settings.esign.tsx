import { createFileRoute } from "@tanstack/react-router";
import { FileSignature } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Card, CardContent } from "@/components/ui/card";
import { SettingsPageShell } from "@/components/settings/SettingsPageShell";

export const Route = createFileRoute("/_app/settings/esign")({ component: ESignSettings });

function ESignSettings() {
  const { t } = useTranslation();
  return (
    <SettingsPageShell title={t("settings.tabs.esign")}>
      <Card className="max-w-3xl">
        <CardContent className="space-y-3 p-6">
          <div className="flex items-center gap-3">
            <FileSignature className="h-5 w-5 text-primary" />
            <div>
              <h2 className="text-lg font-semibold">PDF / E-Sign</h2>
              <p className="text-sm text-muted-foreground">
                Status der Dokumentauslieferung und elektronischen Signatur.
              </p>
            </div>
          </div>
          <div className="rounded-md border bg-muted/30 p-3 text-sm">
            <p><strong>PDF-Export:</strong> Browser-Print aktiv. Server-PDF-Funktion vorbereitet (Stub).</p>
            <p className="mt-2"><strong>E-Sign:</strong> Architektur bereit für Skribble und DocuSign. Noch kein Anbieter aktiv.</p>
            <p className="mt-2 text-xs text-muted-foreground">
              Sobald ein Anbieter ausgewählt ist, werden API-Keys über die Lovable Cloud Secrets verwaltet.
            </p>
          </div>
        </CardContent>
      </Card>
    </SettingsPageShell>
  );
}
