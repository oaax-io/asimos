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
    version: "1.8.0",
    date: "26.05.2026",
    changes: [
      { type: "feature", text: "Dokumentenverwaltung im Kundenprofil: Modal-Vorschau, Herunterladen, Umbenennen, Dokumententyp-Erkennung beim Upload, Anzahl im Tab-Badge" },
      { type: "feature", text: "Immobilien-Zuweisung mit Rollen: Kunden können Immobilien als Eigentümer, Kaufinteressent, Mieter, Investor etc. zugewiesen werden — mit Doppelbelegungs-Warnung" },
      { type: "feature", text: "Bidirektionale Kundenbeziehungen: Verknüpfungen (z. B. Ehepartner) sind jetzt von beiden Seiten sichtbar und lassen sich zentral verwalten" },
      { type: "improvement", text: "Smart-Übersicht im Kunden-Modal erweitert: zeigt jetzt auch zugewiesene Immobilien (nicht nur Eigentum) und Beziehungen" },
      { type: "improvement", text: "Immobilien-Tab im Kundenprofil zeigt eigene und zugewiesene Objekte getrennt mit Rollen-Label" },
      { type: "fix", text: "Mediathek: Hover-Buttons über Bildern wieder korrekt sichtbar" },
      { type: "fix", text: "Dokumente nach Umbenennung konnten nicht mehr angezeigt werden — Storage-Pfad-Logik korrigiert" },
    ],
  },
  {
    version: "1.7.0",
    date: "25.05.2026",
    changes: [
      { type: "feature", text: "Immobilien-Karten-Ansicht (Mapbox): alle Immobilien auf der Schweizer Karte, Klick zoomt zum Detail" },
      { type: "feature", text: "Neuer Kunden-Wizard Schritt 2: manuelle Eingabe oder Selbstauskunft hochladen (KI füllt restliche Schritte automatisch)" },
      { type: "improvement", text: "Kundenübersicht aufgeräumt: «Eigentum» unter Immobilien, «Suchprofile» unter Matching, «Rollen» unter Aktivitäten — Profil-Details-Accordion entfernt" },
      { type: "improvement", text: "Sicherheits-Härtung: 18+ Tabellen mit striktem RLS (Besitzer/Admin), Storage-Bucket «feedback» privat, Funktionsrechte für anon/PUBLIC entzogen" },
      { type: "improvement", text: "Neue Sicherheits-Helper: can_access_property() und vereinheitlichte is_owner_or_admin() auf Basis von user_roles" },
      { type: "improvement", text: "README & CHANGELOG im Repository ergänzt" },
      { type: "fix", text: "«Muster-Kunde» Button aus der Kundenliste entfernt" },
    ],
  },
  {
    version: "1.6.0",
    date: "25.05.2026",
    changes: [
      { type: "feature", text: "Globale Suche in der Topbar: vergrößertes Overlay mit Hintergrund-Blur, durchsucht Kunden, Leads, Immobilien, Finanzierungen, Termine, Aufgaben, Dokumente & Mitarbeiter (⌘K)" },
      { type: "feature", text: "Immobilien-Tab im Kunden-Modal mit Leerstands-Hinweis und «Immobilie hinzufügen»-Button" },
      { type: "improvement", text: "Konsolidierung: nur noch ein einziger Matching-Tab im Kunden-Modal (Button oben & Duplikat in Immobilien-Tab entfernt)" },
      { type: "improvement", text: "Drag-&-Drop-Upload als alleiniger Weg im Dokumente-Tab – manueller «Dokument hinzufügen»-Dialog entfernt" },
      { type: "improvement", text: "Animiertes Drag-&-Drop-Feedback (Skalierung, Puls, Bounce-Icon) beim Datei-Upload" },
      { type: "improvement", text: "Kunden-Liste: separate Spalten für Telefon, E-Mail und PLZ/Ort statt vermischter Kontakt-Spalte" },
      { type: "improvement", text: "Farbige Badges für Kunden-Typen (Käufer, Verkäufer, Sonstige …)" },
      { type: "improvement", text: "Kontakt-Tab zeigt jetzt die Angaben aus der Selbstauskunft" },
      { type: "feature", text: "Ansprechpartner im Kunden-Modal sichtbar; Ersteller wird automatisch als Betreuer zugewiesen und in der Aktivität protokolliert" },
    ],
  },
  {
    version: "1.5.0",
    date: "12.05.2026",
    changes: [
      { type: "feature", text: "Dokumentations-Bereich mit Changelog, Roadmap, Anleitung & Support" },
      { type: "improvement", text: "Vollständige historische Übersicht aller Releases ergänzt" },
    ],
  },
  {
    version: "1.4.0",
    date: "12.05.2026",
    changes: [
      { type: "feature", text: "Drag-and-Drop Upload für Kunden-Dokumente" },
      { type: "feature", text: "Datei-Upload zusätzlich zu Link-Hinterlegung im Kunden-Tab" },
      { type: "improvement", text: "Nach Anlage eines Kunden direkt zum Kundenprofil statt Matching-Seite" },
      { type: "fix", text: "PDF-Generierung: Browser-Druck-Fallback bei Service-Ausfall (404)" },
    ],
  },
  {
    version: "1.3.0",
    date: "11.05.2026",
    changes: [
      { type: "feature", text: "Admin kann Mitarbeiter direkt anlegen und Passwort vergeben (ohne E-Mail-Einladung)" },
      { type: "improvement", text: "E-Mail-Bestätigung für admin-erstellte Benutzer entfällt" },
      { type: "fix", text: "Berechtigungen für is_superadmin / has_role korrigiert (Kunden-Zuweisung)" },
    ],
  },
  {
    version: "1.2.0",
    date: "05.05.2026",
    changes: [
      { type: "feature", text: "UBS-Checkliste & Bank-Submission-Tab in der Finanzierung" },
      { type: "feature", text: "Dossier-Qualitäts-Score für Finanzierungsanfragen" },
      { type: "improvement", text: "Generierte Dokumente pro Kunde & Immobilie auflistbar" },
      { type: "improvement", text: "Verbessertes Matching mit Benchmark-Karten" },
    ],
  },
  {
    version: "1.1.0",
    date: "20.04.2026",
    changes: [
      { type: "feature", text: "Finanzierungs-Quick-Check mit PDF-Export" },
      { type: "feature", text: "Selbstauskunft per Token-Link an Kunden senden" },
      { type: "feature", text: "Parsen hochgeladener Selbstauskunfts-PDFs via KI" },
      { type: "feature", text: "Matching zwischen Suchprofilen und Immobilien" },
    ],
  },
  {
    version: "1.0.0",
    date: "01.04.2026",
    changes: [
      { type: "feature", text: "Kunden-, Lead-, Immobilien- & Mandatsverwaltung" },
      { type: "feature", text: "Mandate, Reservationen, NDAs, Exposés" },
      { type: "feature", text: "Termine, Aufgaben, Checklisten & Aktivitäten-Tracking" },
      { type: "feature", text: "Dokumentvorlagen mit Rich-Text-Editor & Generator" },
      { type: "feature", text: "Mehrere Bankkonten & Brandkit pro Firma" },
      { type: "feature", text: "Marktanalyse für Immobilien (KI-gestützt)" },
      { type: "feature", text: "Mehrbenutzer-Support mit Rollen & Rechten" },
      { type: "feature", text: "Lead-Import aus externen Quellen" },
      { type: "feature", text: "Property-Import & Owners-Tab" },
      { type: "feature", text: "Analytics-Dashboard mit Kennzahlen" },
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
    a: "Meist falsches Passwort (Tippfehler, unsichtbare Leerzeichen beim Kopieren). Passwort im Mitarbeiter-Dialog im Tab „Passwort“ neu setzen.",
  },
  {
    q: "Wie lade ich ein Dokument zu einem Kunden hoch?",
    a: "Kundenprofil → Tab „Dokumente“ → Datei in die Dropzone ziehen oder „Dokument hinzufügen“ klicken.",
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
