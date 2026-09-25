import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent } from "@/components/ui/card";
import { PlatformPage } from "@/components/platform/PlatformLayout";

export const Route = createFileRoute("/platform/settings")({ component: () => (
  <PlatformPage title="Plattform" description="Grundeinstellungen der Immolia-Plattform (nur Ansicht).">
    <Card><CardContent className="space-y-2 p-5 text-sm">
      <div className="flex gap-4"><span className="w-48 text-muted-foreground">Produktname</span><span>Immolia</span></div>
      <div className="flex gap-4"><span className="w-48 text-muted-foreground">Subdomain-Basis</span><span>immolia.ch</span></div>
      <div className="flex gap-4"><span className="w-48 text-muted-foreground">Domain-Prüfung</span><span>DNS-TXT «_immolia-verify»</span></div>
      <div className="flex gap-4"><span className="w-48 text-muted-foreground">Unternehmens-Status</span><span>Aktiv · Deaktiviert · Archiviert (Sperrwirkung folgt später)</span></div>
    </CardContent></Card>
  </PlatformPage>
) });
