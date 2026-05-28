# ASIMOS Changelog

Alle nennenswerten Änderungen an diesem Projekt werden hier dokumentiert.

## [Unreleased]

### Hinzugefügt
- **Kunden-Status-Workflow**: Neue `status`-Spalte auf der Kunden-Tabelle mit 7 farblich kodierten Stufen: Entwurf (Grau), Pendet (Gelb), Vollständig (Blau), Finanzierung (Indigo), Abgeschlossen (Grün), Abgelehnt (Rot), Storniert (Orange).
- **Status-Filter in Kundenübersicht**: Dropdown-Filter mit farbigen Punkten zum schnellen Filtern nach Kundenstatus.
- **Status-Bearbeitung im Kunden-Modal**: Direkt im Kunden-Detail (oben rechts neben den Navigationspfeilen) lässt sich der Status per Dropdown ändern — mit farblicher Kennzeichnung und verbesserter Lesbarkeit.
- **Dokumentenverwaltung im Kundenprofil**: Modal-Vorschau, Herunterladen, Umbenennen, Dokumententyp-Erkennung beim Upload, Anzahl-Anzeige im Tab-Badge.
- **Immobilien-Zuweisung mit Rollen**: Kunden können Immobilien als Eigentümer, Kaufinteressent, Mieter, Investor etc. zugewiesen werden — mit Doppelbelegungs-Warnung.
- **Bidirektionale Kundenbeziehungen**: Verknüpfungen (z. B. Ehepartner) sind jetzt von beiden Seiten sichtbar.
- **Kartenansicht für Immobilien**: Neue "Karten"-Ansicht im Immobilien-Modul mit Mapbox-Integration. Objekte werden auf der Schweizerkarte als Marker angezeigt, inklusive Preis-Labels und Klick-zu-Detail-Funktion.
- **KI-gestützte Selbstauskunft-Auto-Fill**: Beim Kunden-Wizard (Schritt 2) kann nun eine bestehende Selbstauskunft hochgeladen werden. Die Felder werden automatisch via Gemini (Lovable AI Gateway) erkannt und vorbefüllt – inkl. Antragsteller 1 + 2 und Beziehungsverknüpfung.
- **Intelligente Kunden-Übersicht**: Das Kunden-Modal zeigt nun eine Smart-Übersicht mit den für den Makler relevantesten Informationen: Beziehungen, Immobilien, Termine, Aufgaben, offene Finanzierung etc.
- **Finanzierungs-Quick-Check**: Neuer Wizard für schnelle Finanzierungs-Prüfung direkt aus der Kundenseite.
- **DB-Constraint für eindeutige Beziehungen**: `UNIQUE INDEX` auf `client_relationships` (gerichtetes Paar + Typ) verhindert doppelte Verknüpfungen zwischen denselben Kontakten.

### Geändert
- **Kunden-Typ-Farben neu abgestuft**: Die Farben für Kundentypen (Käufer, Verkäufer, Eigentümer, Mieter, Vermieter, Investor, Sonstige) wurden von den Status-Farben entkoppelt und erhalten nun eine eigene, deutlich unterscheidbare Palette (Cyan, Teal, Indigo, Orange, Pink, Rose, Stone).
- **Kunden-Wizard restrukturiert**: Schritt 2 bietet nun die Wahl zwischen "Manuell erfassen" und "Selbstauskunft hochladen".
- **Objekt-Import-Dialog**: Verbesserte UX für den Massenimport von Immobilien.
- **Profil-Details verschoben**: Suchprofile → Matching, Rollen → Aktivitäten, Eigentum → Immobilien. Das zuklappbare Accordion "Profil-Details" entfällt somit aus der Kunden-Übersicht.
- **Kachel-Layout**: Kacheln verwenden nun konsistente Bild-Höhen und elegantere Hover-Zustände.
- **Kunden-Gruppierung in Listenansicht**: Verknüpfte Partner (z. B. Ehepartner) werden unter dem Hauptkunden mit Einrückung und Pfeil-Indikator (`CornerDownRight`) dargestellt. Gruppenmitglieder stehen immer zusammen und werden nicht mehr über die gesamte Liste verteilt.
- **Kunden-Sortierung**: Die Kundenübersicht sortiert jetzt standardmäßig nach `created_at` absteigend — der zuletzt hinzugefügte Kunde steht immer zuoberst.
- **Medien-Ordner-Ansicht**: Ordner und Kacheln-Ansicht wurden an das Design der Kunden-Kacheln angeglichen. Die Kacheln-Ansicht ist jetzt der Standard; beim Öffnen eines Ordners werden die enthaltenen Bilder direkt in Kacheln dargestellt.

### Behoben
- Mediathek: Hover-Buttons über Bildern wieder korrekt sichtbar.
- Dokumente nach Umbenennung konnten nicht mehr angezeigt werden — Storage-Pfad-Logik korrigiert.
- **Doppelte Ehepartner-Badges**: Durch das neue DB-Constraint und Bereinigung identischer Datensätze (z. B. doppelte "Gjyle Krasniqi") werden Beziehungen jetzt korrekt dedupliziert.

### Entfernt
- **"Finanzierung"-Spalte aus Kundenübersicht**: Die separate Finanzierungsspalte und der zugehörige Filter "Alle Finanzierungen" wurden entfernt — der Status-Workflow ersetzt diese Darstellung.
- **"Muster-Kunde"-Button**: Der Button zum Erstellen eines Demo-Kunden wurde aus der Kundenübersicht entfernt.

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
