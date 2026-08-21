import { createFileRoute } from "@tanstack/react-router";
import { Tags } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Card, CardContent } from "@/components/ui/card";
import { SettingsPageShell } from "@/components/settings/SettingsPageShell";

export const Route = createFileRoute("/_app/settings/categories")({ component: CategorySettings });

function CategorySettings() {
  const { t } = useTranslation();
  return (
    <SettingsPageShell title={t("settings.tabs.categories")}>
      <Card className="max-w-3xl">
        <CardContent className="space-y-3 p-6">
          <div className="flex items-center gap-3">
            <Tags className="h-5 w-5 text-primary" />
            <div>
              <h2 className="text-lg font-semibold">Dokumentkategorien</h2>
              <p className="text-sm text-muted-foreground">
                Vordefinierte Typen im Dokumentencenter:
              </p>
            </div>
          </div>
          <ul className="grid grid-cols-2 gap-2 text-sm text-muted-foreground">
            <li>• Vertrag</li>
            <li>• Exposé</li>
            <li>• Ausweis</li>
            <li>• Rechnung</li>
            <li>• Energieausweis</li>
            <li>• Grundriss</li>
            <li>• Kontoauszug</li>
            <li>• Steuerunterlage</li>
            <li>• Sonstiges</li>
          </ul>
          <p className="text-xs text-muted-foreground">
            Eigene Kategorien können später ergänzt werden, sobald wir das Schema dafür öffnen.
          </p>
        </CardContent>
      </Card>
    </SettingsPageShell>
  );
}
