import { createFileRoute } from "@tanstack/react-router";
import { Info, Tags } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SettingsPageShell } from "@/components/settings/SettingsPageShell";
import { MasterListManager } from "@/components/settings/MasterListManager";
import { FeatureOptionsManager } from "@/components/settings/FeatureOptionsManager";
import { useIsMasterDataAdmin } from "@/hooks/useIsMasterDataAdmin";

export const Route = createFileRoute("/_app/settings/categories")({ component: CategorySettings });

const DOCUMENT_CATEGORIES = [
  "Vertrag",
  "Exposé",
  "Ausweis",
  "Rechnung",
  "Energieausweis",
  "Grundriss",
  "Kontoauszug",
  "Steuerunterlage",
  "Sonstiges",
];

const LISTS: { key: string; tab: string; title: string; description: string }[] = [
  {
    key: "condition",
    tab: "Zustand",
    title: "Zustand",
    description: "Auswahlwerte für den Zustand einer Immobilie.",
  },
  {
    key: "marketing_type",
    tab: "Vermarktung",
    title: "Vermarktungsart",
    description: "Auswahlwerte für die Vermarktungsart (z. B. Kaufen, Mieten).",
  },
  {
    key: "vat_status",
    tab: "MWST",
    title: "MWST",
    description: "Auswahlwerte für den Mehrwertsteuer-Status.",
  },
  {
    key: "sale_procedure",
    tab: "Verkaufsverfahren",
    title: "Verkaufsverfahren",
    description: "Auswahlwerte für das Verkaufsverfahren.",
  },
  {
    key: "deal_type",
    tab: "Abschlussart",
    title: "Abschlussart",
    description: "Auswahlwerte für die Abschlussart (Asset Deal / Share Deal).",
  },
];

function CategorySettings() {
  const { t } = useTranslation();
  const { canEdit } = useIsMasterDataAdmin();

  return (
    <SettingsPageShell title={t("settings.tabs.categories")}>
      <div className="space-y-4">
        <div className="flex items-start gap-2 rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <p>
            Objektart und Status sind feste Systemwerte und werden nicht hier, sondern direkt in der
            Immobilienverwaltung genutzt – sie lassen sich daher auf dieser Seite nicht ändern.
            {!canEdit && " Zum Bearbeiten dieser Listen sind Inhaber- oder Admin-Rechte nötig."}
          </p>
        </div>

        <Card>
          <CardContent className="p-4 sm:p-6">
            <Tabs defaultValue="features">
              <TabsList className="flex h-auto flex-wrap justify-start gap-1">
                <TabsTrigger value="features">Objekt-Eigenschaften</TabsTrigger>
                {LISTS.map((l) => (
                  <TabsTrigger key={l.key} value={l.key}>
                    {l.tab}
                  </TabsTrigger>
                ))}
                <TabsTrigger value="documents">Dokumentkategorien</TabsTrigger>
              </TabsList>

              <TabsContent value="features" className="mt-6">
                <FeatureOptionsManager canEdit={canEdit} />
              </TabsContent>

              {LISTS.map((l) => (
                <TabsContent key={l.key} value={l.key} className="mt-6">
                  <MasterListManager listKey={l.key} description={l.description} canEdit={canEdit} />
                </TabsContent>
              ))}

              <TabsContent value="documents" className="mt-6 space-y-3">
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
                  {DOCUMENT_CATEGORIES.map((c) => (
                    <li key={c}>• {c}</li>
                  ))}
                </ul>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </SettingsPageShell>
  );
}
