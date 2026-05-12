import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { BookOpen, Rocket, Sparkles, LifeBuoy, ChevronRight } from "lucide-react";

export const Route = createFileRoute("/_app/docs")({ component: DocsPage });

type ChangeType = "feature" | "improvement" | "fix";

interface ChangelogEntry {
  version: string;
  date: string;
  changes: { type: ChangeType; text: string }[];
}

const CHANGELOG: ChangelogEntry[] = [
  {
    version: "1.4.0",
    date: "12.05.2026",
    changes: [
      { type: "feature", text: "Drag-and-Drop Upload für Kunden-Dokumente" },
      { type: "feature", text: "Datei-Upload zusätzlich zu Link-Hinterlegung im Kunden-Tab" },
      { type: "improvement", text: "Nach Anlage eines Kunden direkt zum Kundenprofil statt Matching" },
      { type: "feature", text: "Dokumentation & Changelog unter Administration" },
    ],
  },
  {
    version: "1.3.0",
    date: "11.05.2026",
    changes: [
      { type: "feature", text: "Admin kann Benutzer direkt anlegen und Passwort vergeben (ohne Einladung)" },
      { type: "improvement", text: "E-Mail-Bestätigung für admin-erstellte Benutzer entfällt" },
      { type: "fix", text: "Berechtigungen für is_superadmin / has_role korrigiert (Kunden-Zuweisung)" },
    ],
  },
  {
    version: "1.2.0",
    date: "Frühjahr 2026",
    changes: [
      { type: "feature", text: "Finanzierungs-Quick-Check mit PDF-Export" },
      { type: "feature", text: "Selbstauskunft per Token-Link an Kunden" },
      { type: "feature", text: "Matching zwischen Suchprofilen und Immobilien" },
      { type: "improvement", text: "Generierte Dokumente pro Kunde / Immobilie auflistbar" },
    ],
  },
];

const ROADMAP = [
  { title: "Mehrsprachigkeit (FR / IT)", status: "geplant" },
  { title: "Kalender-Sync mit Outlook & Google", status: "in Arbeit" },
  { title: "Mobile-App (iOS / Android)", status: "Konzept" },
  { title: "KI-Assistent für E-Mail-Entwürfe", status: "geplant" },
  { title: "Digitale Signatur direkt im Dossier", status: "in Arbeit" },
];

const FAQS = [
  {
    q: "Wie lege ich einen neuen Mitarbeiter an?",
    a: "Administration → Mitarbeiter → „Mitarbeiter hinzufügen“. Du kannst direkt ein Passwort vergeben oder generieren — keine Einladung nötig.",
  },
  {
    q: "Warum kann sich ein Makler nicht einloggen?",
    a: "Meist falsches Passwort (Tippfehler, unsichtbare Leerzeichen beim Kopieren). Passwort im Mitarbeiter-Dialog im Tab „Passwort" neu setzen.",
  },
  {
    q: "Wie lade ich ein Dokument zu einem Kunden hoch?",
    a: "Kundenprofil → Tab „Dokumente" → Datei in die Dropzone ziehen oder „Dokument hinzufügen" klicken.",
  },
  {
    q: "PDF-Generierung funktioniert nicht (404)",
    a: "Der externe PDF-Service ist nicht erreichbar. Administrator muss die URL in den Cloud-Secrets prüfen.",
  },
];

const typeMeta: Record<ChangeType, { label: string; className: string }> = {
  feature:     { label: "Neu",         className: "bg-primary/10 text-primary border-primary/20" },
  improvement: { label: "Verbessert",  className: "bg-blue-500/10 text-blue-600 border-blue-500/20" },
  fix:         { label: "Behoben",     className: "bg-amber-500/10 text-amber-700 border-amber-500/20" },
};

function DocsPage() {
  return (
    <div className="container mx-auto max-w-5xl space-y-6 p-6">
      <div>
        <h1 className="font-display text-3xl font-semibold tracking-tight">Dokumentation</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Changelog, Roadmap, FAQ und Hilfe rund um ASIMO.
        </p>
      </div>

      <Tabs defaultValue="changelog" className="space-y-4">
        <TabsList>
          <TabsTrigger value="changelog"><Sparkles className="mr-1.5 h-4 w-4" />Changelog</TabsTrigger>
          <TabsTrigger value="roadmap"><Rocket className="mr-1.5 h-4 w-4" />Roadmap</TabsTrigger>
          <TabsTrigger value="guide"><BookOpen className="mr-1.5 h-4 w-4" />Anleitung</TabsTrigger>
          <TabsTrigger value="support"><LifeBuoy className="mr-1.5 h-4 w-4" />Support</TabsTrigger>
        </TabsList>

        <TabsContent value="changelog" className="space-y-4">
          {CHANGELOG.map((entry) => (
            <Card key={entry.version}>
              <CardContent className="p-6">
                <div className="mb-4 flex items-baseline justify-between">
                  <div className="flex items-baseline gap-3">
                    <h2 className="font-display text-xl font-semibold">v{entry.version}</h2>
                    <Badge variant="secondary" className="text-xs">{entry.date}</Badge>
                  </div>
                </div>
                <ul className="space-y-2">
                  {entry.changes.map((c, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <Badge variant="outline" className={`shrink-0 text-[10px] ${typeMeta[c.type].className}`}>
                        {typeMeta[c.type].label}
                      </Badge>
                      <span className="text-sm">{c.text}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="roadmap">
          <Card>
            <CardContent className="p-6">
              <h2 className="mb-4 font-display text-lg font-semibold">Geplante Funktionen</h2>
              <ul className="space-y-3">
                {ROADMAP.map((r, i) => (
                  <li key={i} className="flex items-center justify-between gap-3 rounded-xl border p-3">
                    <div className="flex items-center gap-3">
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">{r.title}</span>
                    </div>
                    <Badge variant="secondary" className="text-xs">{r.status}</Badge>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="guide">
          <Card>
            <CardContent className="space-y-6 p-6 text-sm">
              <section>
                <h3 className="mb-2 font-display text-base font-semibold">Erste Schritte</h3>
                <ol className="ml-5 list-decimal space-y-1 text-muted-foreground">
                  <li>Firmenprofil und Brandkit unter <strong>Einstellungen</strong> hinterlegen.</li>
                  <li>Mitarbeiter unter <strong>Administration → Mitarbeiter</strong> anlegen.</li>
                  <li>Bankkonten und Dokumentvorlagen konfigurieren.</li>
                  <li>Erste Leads / Kunden erfassen und Suchprofile pflegen.</li>
                </ol>
              </section>
              <section>
                <h3 className="mb-2 font-display text-base font-semibold">Kunden & Matching</h3>
                <p className="text-muted-foreground">
                  Lege Kunden mit Rolle (Käufer, Verkäufer, Mieter, Vermieter, Finanzierungskunde)
                  an. Käufer erhalten ein Suchprofil — Matching findet passende Immobilien automatisch.
                </p>
              </section>
              <section>
                <h3 className="mb-2 font-display text-base font-semibold">Finanzierung</h3>
                <p className="text-muted-foreground">
                  Quick-Check direkt im Kundenprofil starten, Selbstauskunft per Link einholen,
                  PDF-Dossier für Banken generieren.
                </p>
              </section>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="support">
          <Card>
            <CardContent className="space-y-5 p-6">
              <div>
                <h3 className="mb-3 font-display text-base font-semibold">Häufige Fragen</h3>
                <div className="space-y-3">
                  {FAQS.map((f, i) => (
                    <div key={i} className="rounded-xl border p-3">
                      <p className="text-sm font-medium">{f.q}</p>
                      <p className="mt-1 text-sm text-muted-foreground">{f.a}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="rounded-xl border bg-muted/30 p-4 text-sm">
                <p className="font-medium">Weitere Hilfe nötig?</p>
                <p className="mt-1 text-muted-foreground">
                  Über <strong>Administration → Feedback</strong> kannst du Wünsche, Bugs und Fragen direkt einreichen.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
