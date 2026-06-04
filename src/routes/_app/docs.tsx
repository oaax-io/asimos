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
    version: "1.13.0",
    date: "04.06.2026",
    changes: [
      { type: "feature", text: "Smart-Matching: berechnet automatisch Tragbarkeit & Belehnung aus der Selbstauskunft (inkl. Ehepartner / Mitantragsteller) und matcht passende Immobilien — auch wenn Budget oder Stadt im Profil leer sind" },
      { type: "improvement", text: "Matching beruecksichtigt jetzt auch Immobilien mit Status 'aktiv' und 'in Vorbereitung' (vorher nur 'verfuegbar' / 'Entwurf')" },
      { type: "improvement", text: "Finanzierungs-Uebersicht im gleichen Look wie der Kunden-Finanzierungstab: farbcodierte Quick-Check-Kachel (Tragbarkeit, Belehnung, Hypothek, Eigenmittel) plus Begruendungsliste" },
    ],
  },
  {
    version: "1.12.0",
    date: "03.06.2026",
    changes: [
      { type: "feature", text: "Einheitliches In-App-Bestaetigungs-Modal fuer alle Loeschvorgaenge (Kunden, Leads, Termine, Aufgaben, Properties, Medien, Beziehungen, Dokumente, Bankkonten, Agenturen, Bank-Paket-Versionen) — keine Browser-Popups mehr" },
      { type: "feature", text: "Bank-Paket-Historie: einzelne Versionen koennen geloescht werden (inkl. Storage-Bereinigung)" },
      { type: "improvement", text: "Bank-Paket-Historie zeigt Datum & Uhrzeit konsistent in Europe/Zurich" },
    ],
  },
  {
    version: "1.11.0",
    date: "01.06.2026",
    changes: [
      { type: "feature", text: "Bank-Paket Master-Dossier: Quick-Check-Grafiken werden farbgetreu (gruen/gelb/rot) aus der Vorpruefung uebernommen, inkl. vollstaendiger Detailrechnung" },
      { type: "feature", text: "Selbstauskunft im Master-Dossier wird komplett uebernommen — Hauptantragsteller und Mitantragsteller / Ehepartner stehen nebeneinander, alle Felder untereinander" },
      { type: "improvement", text: "Selbstauskunft, Tragbarkeit und Detailrechnung passen jetzt auf 1-2 zusammenhaengende Seiten" },
      { type: "fix", text: "Belehnung & Tragbarkeit werden im PDF korrekt gruen dargestellt (statt faelschlich orange)" },
      { type: "fix", text: "Englische Restbegriffe im Master-Dossier vollstaendig auf Deutsch uebersetzt" },
    ],
  },
  {
    version: "1.10.0",
    date: "28.05.2026",
    changes: [
      { type: "feature", text: "Kunden-Liste gruppiert verknuepfte Partner (z. B. Ehepaare) visuell zusammen: Hauptkunde oben, Partner direkt darunter eingerueckt mit Pfeil-Symbol" },
      { type: "improvement", text: "Kunden-Liste sortiert standardmaessig nach Erstellungsdatum absteigend — neueste Kunden zuoberst" },
      { type: "improvement", text: "Medien-Ordner und Kacheln-Ansicht im Design an Kunden-Kacheln angeglichen (einheitlicher Look)" },
      { type: "fix", text: "Doppelte Ehepartner-Badges entfernt (doppelter Kunden-Datensatz Gjyle Krasniqi bereinigt)" },
      { type: "fix", text: "DB-Constraint hinzugefuegt: Kundenbeziehungen koennen nicht mehr doppelt angelegt werden (richtungsunabhaengig eindeutig)" },
    ],
  },

  {
    version: "1.9.0",
    date: "26.05.2026",
    changes: [
      { type: "feature", text: "Kunden-Status-Workflow mit 7 farbcodierten Stufen: Entwurf (Grau), Pendent (Gelb), Vollstaendig (Blau), Finanzierung (Indigo), Abgeschlossen (Gruen), Abgelehnt (Rot), Storniert (Orange)" },
      { type: "feature", text: "Status-Filter in der Kundenuebersicht" },
      { type: "feature", text: "Status direkt im Kunden-Modal aenderbar (oben rechts neben den Pfeilen, mit farbigem Punkt)" },
      { type: "improvement", text: "Kunden-Typ-Farben (Kaeufer, Verkaeufer, Eigentuemer, Mieter, Vermieter, Investor, Sonstige) klar von Status-Farben getrennt (Cyan, Teal, Indigo, Orange, Pink, Rose, Stone)" },
      { type: "improvement", text: "Kundenuebersicht aufgeraeumt: Spalte 'Finanzierung' und Filter 'Alle Finanzierungen' entfernt" },
      { type: "fix", text: "Doppelter Farb-Punkt im Status-Button des Kunden-Modals behoben" },
    ],
  },
  {
    version: "1.8.0",
    date: "26.05.2026",
    changes: [
      { type: "feature", text: "Dokumentenverwaltung im Kundenprofil: Modal-Vorschau, Herunterladen, Umbenennen, Dokumententyp-Erkennung beim Upload, Anzahl im Tab-Badge" },
      { type: "feature", text: "Immobilien-Zuweisung mit Rollen: Kunden koennen Immobilien als Eigentuemer, Kaufinteressent, Mieter, Investor etc. zugewiesen werden — mit Doppelbelegungs-Warnung" },
      { type: "feature", text: "Bidirektionale Kundenbeziehungen: Verknuepfungen (z. B. Ehepartner) sind jetzt von beiden Seiten sichtbar und lassen sich zentral verwalten" },
      { type: "improvement", text: "Smart-Uebersicht im Kunden-Modal erweitert: zeigt jetzt auch zugewiesene Immobilien (nicht nur Eigentum) und Beziehungen" },
      { type: "improvement", text: "Immobilien-Tab im Kundenprofil zeigt eigene und zugewiesene Objekte getrennt mit Rollen-Label" },
      { type: "fix", text: "Mediathek: Hover-Buttons ueber Bildern wieder korrekt sichtbar" },
      { type: "fix", text: "Dokumente nach Umbenennung konnten nicht mehr angezeigt werden — Storage-Pfad-Logik korrigiert" },
    ],
  },
  {
    version: "1.7.0",
    date: "25.05.2026",
    changes: [
      { type: "feature", text: "Immobilien-Karten-Ansicht (Mapbox): alle Immobilien auf der Schweizer Karte, Klick zoomt zum Detail" },
      { type: "feature", text: "Neuer Kunden-Wizard Schritt 2: manuelle Eingabe oder Selbstauskunft hochladen (KI fuellt restliche Schritte automatisch)" },
      { type: "improvement", text: "Kundenuebersicht aufgeraeumt: Eigentum unter Immobilien, Suchprofile unter Matching, Rollen unter Aktivitaeten — Profil-Details-Accordion entfernt" },
      { type: "improvement", text: "Sicherheits-Haertung: 18+ Tabellen mit striktem RLS (Besitzer/Admin), Storage-Bucket feedback privat, Funktionsrechte fuer anon/PUBLIC entzogen" },
      { type: "improvement", text: "Neue Sicherheits-Helper: can_access_property() und vereinheitlichte is_owner_or_admin() auf Basis von user_roles" },
      { type: "improvement", text: "README & CHANGELOG im Repository ergaenzt" },
      { type: "fix", text: "Muster-Kunde Button aus der Kundenliste entfernt" },
    ],
  },
  {
    version: "1.6.0",
    date: "25.05.2026",
    changes: [
      { type: "feature", text: "Globale Suche in der Topbar: vergroesserteres Overlay mit Hintergrund-Blur, durchsucht Kunden, Leads, Immobilien, Finanzierungen, Termine, Aufgaben, Dokumente & Mitarbeiter (⌘K)" },
      { type: "feature", text: "Immobilien-Tab im Kunden-Modal mit Leerstands-Hinweis und Immobilie hinzufuegen-Button" },
      { type: "improvement", text: "Konsolidierung: nur noch ein einziger Matching-Tab im Kunden-Modal (Button oben & Duplikat in Immobilien-Tab entfernt)" },
      { type: "improvement", text: "Drag-&-Drop-Upload als alleiniger Weg im Dokumente-Tab – manueller Dokument hinzufuegen-Dialog entfernt" },
      { type: "improvement", text: "Animiertes Drag-&-Drop-Feedback (Skalierung, Puls, Bounce-Icon) beim Datei-Upload" },
      { type: "improvement", text: "Kunden-Liste: separate Spalten fuer Telefon, E-Mail und PLZ/Ort statt vermischter Kontakt-Spalte" },
      { type: "improvement", text: "Farbige Badges fuer Kunden-Typen (Kaeufer, Verkaeufer, Sonstige …)" },
      { type: "improvement", text: "Kontakt-Tab zeigt jetzt die Angaben aus der Selbstauskunft" },
      { type: "feature", text: "Ansprechpartner im Kunden-Modal sichtbar; Ersteller wird automatisch als Betreuer zugewiesen und in der Aktivitaet protokolliert" },
    ],
  },
  {
    version: "1.5.0",
    date: "12.05.2026",
    changes: [
      { type: "feature", text: "Dokumentations-Bereich mit Changelog, Roadmap, Anleitung & Support" },
      { type: "improvement", text: "Vollstaendige historische Uebersicht aller Releases ergaenzt" },
    ],
  },
  {
    version: "1.4.0",
    date: "12.05.2026",
    changes: [
      { type: "feature", text: "Drag-and-Drop Upload fuer Kunden-Dokumente" },
      { type: "feature", text: "Datei-Upload zusatzlich zu Link-Hinterlegung im Kunden-Tab" },
      { type: "improvement", text: "Nach Anlage eines Kunden direkt zum Kundenprofil statt Matching-Seite" },
      { type: "fix", text: "PDF-Generierung: Browser-Druck-Fallback bei Service-Ausfall (404)" },
    ],
  },
  {
    version: "1.3.0",
    date: "11.05.2026",
    changes: [
      { type: "feature", text: "Admin kann Mitarbeiter direkt anlegen und Passwort vergeben (ohne E-Mail-Einladung)" },
      { type: "improvement", text: "E-Mail-Bestaetigung fuer admin-erstellte Benutzer entfaellt" },
      { type: "fix", text: "Berechtigungen fuer is_superadmin / has_role korrigiert (Kunden-Zuweisung)" },
    ],
  },
  {
    version: "1.2.0",
    date: "05.05.2026",
    changes: [
      { type: "feature", text: "UBS-Checkliste & Bank-Submission-Tab in der Finanzierung" },
      { type: "feature", text: "Dossier-Qualitaets-Score fuer Finanzierungsanfragen" },
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
      { type: "feature", text: "Mandate, Reservationen, NDAs, Exposees" },
      { type: "feature", text: "Termine, Aufgaben, Checklisten & Aktivitaeten-Tracking" },
      { type: "feature", text: "Dokumentvorlagen mit Rich-Text-Editor & Generator" },
      { type: "feature", text: "Mehrere Bankkonten & Brandkit pro Firma" },
      { type: "feature", text: "Marktanalyse fuer Immobilien (KI-gestuetzt)" },
      { type: "feature", text: "Mehrbenutzer-Support mit Rollen & Rechten" },
      { type: "feature", text: "Lead-Import aus externen Quellen" },
      { type: "feature", text: "Property-Import & Owners-Tab" },
      { type: "feature", text: "Analytics-Dashboard mit Kennzahlen" },
      { type: "feature", text: "Activity-Tracking: Vollstaendiger Aktivitaetslog fuer Audit-Trail" },
    ],
  },
];

const ROADMAP = [
  { title: "Mehrsprachigkeit (FR / IT)", status: "geplant" },
  { title: "Kalender-Sync mit Outlook & Google", status: "in Arbeit" },
  { title: "Mobile-App (iOS / Android)", status: "Konzept" },
  { title: "KI-Assistent fuer E-Mail-Entwuerfe", status: "geplant" },
  { title: "Digitale Signatur direkt im Dossier", status: "in Arbeit" },
];

const FAQS = [
  {
    q: "Wie lege ich einen neuen Mitarbeiter an?",
    a: "Administration → Mitarbeiter → 'Mitarbeiter hinzufuegen'. Du kannst direkt ein Passwort vergeben oder generieren — keine Einladung noetig.",
  },
  {
    q: "Warum kann sich ein Makler nicht einloggen?",
    a: "Meist falsches Passwort (Tippfehler, unsichtbare Leerzeichen beim Kopieren). Passwort im Mitarbeiter-Dialog im Tab 'Passwort' neu setzen.",
  },
  {
    q: "Wie lade ich ein Dokument zu einem Kunden hoch?",
    a: "Kundenprofil → Tab 'Dokumente' → Datei in die Dropzone ziehen. Der Typ wird automatisch erkannt (z. B. Selbstauskunft, Vertrag, Pass).",
  },
  {
    q: "Wie verknuepfe ich zwei Kunden (z. B. Ehepaar)?",
    a: "Kundenprofil → Tab 'Beziehungen' → 'Beziehung hinzufuegen'. Die Verknuepfung ist automatisch bidirektional — beide Kontakte sehen einander.",
  },
  {
    q: "Wie weise ich einem Kunden eine Immobilie zu?",
    a: "Kundenprofil → Tab 'Immobilien' → 'Immobilie zuweisen'. Waehle die Immobilie und die Rolle (Eigentuemer, Kaufinteressent, Mieter etc.). Bereits als Eigentuemer zugewiesene Objekte werden blockiert.",
  },
  {
    q: "PDF-Generierung funktioniert nicht (404)",
    a: "Der externe PDF-Service ist nicht erreichbar. Administrator muss die URL in den Cloud-Secrets pruefen.",
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
                  Lege Kunden mit Rolle (Kaeufer, Verkaeufer, Mieter, Vermieter, Finanzierungskunde)
                  an. Kaeufer erhalten ein Suchprofil — Matching findet passende Immobilien automatisch.
                  Verknuepfe Kunden ueber den Tab <strong>Beziehungen</strong> (z. B. Ehepaar, Familie).
                </p>
              </section>
              <section>
                <h3 className="mb-2 font-display text-base font-semibold">Immobilien-Zuweisung</h3>
                <p className="text-muted-foreground">
                  Im Kundenprofil unter <strong>Immobilien → Immobilie zuweisen</strong> kannst du
                  Objekte mit einer Rolle verknuepfen: Eigentuemer, Kaufinteressent, Mieter, Investor
                  etc. Doppelbelegungen als Eigentuemer werden automatisch verhindert.
                </p>
              </section>
              <section>
                <h3 className="mb-2 font-display text-base font-semibold">Dokumente</h3>
                <p className="text-muted-foreground">
                  Im Kunden-Tab <strong>Dokumente</strong> per Drag-and-Drop hochladen. ASIMO erkennt
                  den Dokumententyp automatisch. Dateien lassen sich umbenennen, in einer Vorschau
                  ansehen und herunterladen.
                </p>
              </section>
              <section>
                <h3 className="mb-2 font-display text-base font-semibold">Finanzierung</h3>
                <p className="text-muted-foreground">
                  Quick-Check direkt im Kundenprofil starten, Selbstauskunft per Link einholen,
                  PDF-Dossier fuer Banken generieren.
                </p>
              </section>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="support">
          <Card>
            <CardContent className="space-y-5 p-6">
              <div>
                <h3 className="mb-3 font-display text-base font-semibold">Haeufige Fragen</h3>
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
                <p className="font-medium">Weitere Hilfe noetig?</p>
                <p className="mt-1 text-muted-foreground">
                  Ueber <strong>Administration → Feedback</strong> kannst du Wuensche, Bugs und Fragen direkt einreichen.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
