# ASIMOS Changelog

Alle nennenswerten Änderungen an diesem Projekt werden hier dokumentiert.

## [1.13.0] – 04.06.2026 – Smart Matching

### Hinzugefügt
- **Smart-Matching mit Finanzkapazität**: Das Matching berechnet jetzt aus der Selbstauskunft (inkl. Ehepartner / Mitantragsteller) automatisch Tragbarkeit (≤ 38 %) und Belehnung (≤ 80 %) gegen jedes verfügbare Objekt — Käufer ohne Budget oder Stadtpräferenz erscheinen jetzt trotzdem im Matching, sofern die Finanzlage passt.
- **Finanzierungs-Übersicht im Kacheldesign**: Die Dossier-Karte zeigt jetzt die farbcodierte Quick-Check-Kachel (Tragbarkeit, Belehnung, Hypothek, Eigenmittel) plus Begründungsliste – konsistent zum Kunden-Finanzierungstab.

### Geändert
- **Matching-Property-Filter erweitert**: Status `active` und `preparation` werden zusätzlich zu `available` / `draft` als matchbar gezählt.

---

## [1.12.0] – 03.06.2026 – Einheitliche Bestätigungs-Dialoge

### Hinzugefügt
- **In-App-Confirm-Provider**: Globaler `useConfirm`-Hook (`AlertDialog`) ersetzt alle nativen `window.confirm()`-Aufrufe. Eingebunden in Bank-Paket-Historie, Bankkonten, Agenturen, Aufgaben, Leads, Termine, Properties, Marktanalysen, Medien, Kunden-Profile, Beziehungen und Kunden-Dokumenten.
- **Bank-Paket-Versionen löschbar**: Einzelne Versionen in der Bank-Paket-Historie können gelöscht werden – inkl. Bereinigung der Storage-Datei.

### Geändert
- **Zeitstempel in Europe/Zurich**: Bank-Paket-Historie zeigt Datum & Uhrzeit konsistent in der Schweizer Zeitzone (`formatZurich`).

---

## [1.11.0] – 01.06.2026 – Bank-Paket Master-Dossier

### Hinzugefügt
- **Quick-Check-Grafiken im Master-Dossier**: Tragbarkeit, Belehnung, Eigenmittel & Co. werden farbgetreu (Grün / Gelb / Rot) aus der Vorprüfung übernommen, inkl. vollständiger Detailrechnung.
- **Selbstauskunft vollständig im Master-Dossier**: Hauptantragsteller und Mitantragsteller / Ehepartner werden nebeneinander dargestellt, alle Felder konsistent untereinander.

### Geändert
- **Kompaktes Seitenlayout**: Selbstauskunft, Tragbarkeit und Detailrechnung passen jetzt auf 1–2 zusammenhängende Seiten.

### Behoben
- **Falsche Farbgebung** für Belehnung & Tragbarkeit im PDF (war orange statt grün) behoben.
- **Englische Restbegriffe** im Master-Dossier vollständig auf Deutsch übersetzt.

---

## [1.10.0] – 28.05.2026 – Kunden-Gruppierung & Status-Workflow

### Hinzugefügt
- **Kunden-Status-Workflow**: 7 farblich kodierte Stufen (Entwurf, Pendent, Vollständig, Finanzierung, Abgeschlossen, Abgelehnt, Storniert) mit Filter und Inline-Bearbeitung im Kunden-Modal.
- **Bidirektionale Kundenbeziehungen** mit eindeutigem DB-Constraint.
- **Dokumentenverwaltung im Kundenprofil**: Modal-Vorschau, Download, Umbenennen, automatische Dokumententyp-Erkennung.
- **Immobilien-Zuweisung mit Rollen**: Eigentümer, Kaufinteressent, Mieter, Investor — mit Doppelbelegungs-Warnung.
- **Mapbox-Kartenansicht** für Immobilien mit Preis-Labels und Klick-zu-Detail.
- **KI-Auto-Fill der Selbstauskunft** im Kunden-Wizard (Antragsteller 1 + 2 inkl. Beziehung).
- **Finanzierungs-Quick-Check-Wizard** direkt aus dem Kundenprofil.

### Geändert
- **Kunden-Typ-Farben** von Status-Farben entkoppelt (Cyan, Teal, Indigo, Orange, Pink, Rose, Stone).
- **Kunden-Gruppierung**: Verknüpfte Partner werden eingerückt unter dem Hauptkunden dargestellt (CornerDownRight-Indikator).
- **Sortierung** standardmäßig nach `created_at` absteigend.
- **Medien-Ansicht** an Kunden-Kacheldesign angeglichen.

### Behoben
- Mediathek: Hover-Buttons über Bildern wieder sichtbar.
- Storage-Pfad-Logik bei umbenannten Dokumenten korrigiert.
- Doppelte Ehepartner-Badges dedupliziert.

### Entfernt
- "Finanzierung"-Spalte und "Muster-Kunde"-Button aus der Kundenübersicht.


---

## [1.0.0] – Security-Hardening & Foundation

### Sicherheit
- **RLS-Policies überarbeitet**: 18+ Tabellen erhalten strikte, rollen- bzw. eigentümerbasierte RLS-Policies. Entfernung aller `USING (true)`-Regeln.
- **Neue Sicherheitshelfer**: `can_access_property()` für objektbezogenen Zugriff, `is_owner_or_admin()` nutzt nun zentral `public.user_roles`.
- **Funktions-Rechte**: `EXECUTE` wurde für interne `SECURITY DEFINER`-Funktionen (`is_admin`, `can_access_client`, `has_role` etc.) von `anon` und `PUBLIC` entzogen.
- **Storage-Härtung**: `feedback`-Bucket auf privat umgestellt, Upload-Policies auf Uploader/Admin beschränkt.
- **Auth-Middleware**: `attachSupabaseAuth` als globales `functionMiddleware` in `src/start.ts` registriert, damit alle geschützten Server Functions das Bearer-Token erhalten.

### Hinzugefügt
- **Rollen-System**: `app_role`-Enum (`admin`, `moderator`, `user`) und `user_roles`-Tabelle mit `has_role()`-Funktion (`SECURITY DEFINER`).
- **Lead-Import-Wizard**: Massenimport von Leads aus verschiedenen Quellen mit Mapping-Dialog.
- **Mandats-Wizard**: Digitaler Mandatserfassungs-Workflow.
- **Finanzierungs-Modul**: Vollständiges Finanzierungsdossier mit Bank-Submission, UBS-Checkliste und Dossier-Qualitätsprüfung.
- **Dokumenten-System**: Template-basierte Dokumentgenerierung mit TipTap, Platzhalter-Engine, PDF-Rendering über externen Puppeteer-Service.
- **Selbstauskunft-Wizard**: 5-Schritt-Formular (Personendaten → Beruf → Einnahmen → Ausgaben → Abschluss) mit Live-Benchmark-Karte.
- **Mapbox-Integration**: `getMapboxToken` und `geocodeAddresses` Server Functions für Adress-Geocoding.
- **Exposé-Generator**: Automatisches PDF-Exposé aus Objektdaten.
- **Matching-Engine**: Kunden-Suchprofile mit verfügbaren Objekten abgleichen.
- **Medien-Management**: Upload, Konvertierung (HEIC→JPEG) und Verwaltung von Bildern und Videos.
- **NDA-Verwaltung**: Nicht-Offenlegungs-Vereinbarungen für Objektbesichtigungen.
- **Reservierungen**: Objekt-Reservierungs-Workflow.
- **Team-Verwaltung**: Benutzer, Rollen und Berechtigungen.
- **Einstellungen**: Unternehmensprofil, Bankkonten, Brandkit, Dokumenten-Templates.
- **Global Search**: Schnellsuche über Kunden, Objekte, Leads und Dokumente.
- **Analytics-Dashboard**: Kennzahlen und Visualisierungen für das Makler-Business.
- **Activity-Tracking**: Vollständiger Aktivitätslog für Audit-Trail.

---

## [0.9.0] – Core Modules

### Hinzugefügt
- **Kundenverwaltung**: CRUD für Personen und Firmen, Beziehungen, Rollen, Suchprofile.
- **Immobilienverwaltung**: Objekt-CRUD, Eigentümer-Verknüpfung, Status-Workflow, Merkmale.
- **Termin- & Aufgabenverwaltung**: Kalender, Aufgaben mit Status-Tracking.
- **Dokumentenverwaltung**: Upload, Kategorisierung, Vorschau, Versand.
- **Authentifizierung**: Supabase Auth mit Email/Passwort und Google OAuth.
- **Grund-Layout**: App-Layout mit Sidebar, Navigation, Breadcrumbs.
- **Design-System**: Tailwind CSS v4 mit shadcn/ui Komponenten, semantische Farb-Tokens.

---

## Konventionen

- Versionsnummern folgen [SemVer](https://semver.org/lang/de/).
- `Added` – Neue Features.
- `Changed` – Änderungen an bestehenden Features.
- `Deprecated` – Features, die in zukünftigen Versionen entfernt werden.
- `Removed` – Entfernte Features.
- `Fixed` – Bugfixes.
- `Security` – Sicherheitsrelevante Änderungen.
