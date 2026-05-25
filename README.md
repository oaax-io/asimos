# ASIMOS – Immobilienmakler-Software

**ASIMOS** ist eine moderne, webbasierte All-in-One-Software für Immobilienmakler, gebaut mit [TanStack Start](https://tanstack.com/start) (React 19 + Vite) und angebunden an Lovable Cloud (Supabase). Die App ist für den Schweizer Markt optimiert und deckt das komplette Makler-Geschäft ab – von der Kundengewinnung bis zur Objektübergabe.

---

## Tech Stack

| Ebene | Technologie |
|-------|-------------|
| Framework | TanStack Start v1 (SSR/SSG, Edge-optimiert) |
| UI Library | React 19 |
| Styling | Tailwind CSS v4 + shadcn/ui |
| State & Data | TanStack Query |
| Backend | Lovable Cloud (Supabase: Postgres, Auth, Storage, Realtime) |
| Server Functions | `createServerFn` (TanStack Start) |
| Karten | Mapbox GL JS |
| Charts | Recharts |
| Rich Text | TipTap |
| PDF-Rendering | Externer Puppeteer-Service (siehe `pdf-service/`) |

---

## Projektstruktur

```
src/
├── routes/_app/          # Geschützte App-Routen (Dashboard, Kunden, Objekte, …)
├── components/             # Wiederverwendbare Komponenten & Feature-Module
│   ├── clients/            # Kunden-Dialoge, Wizard, Selbstauskunft
│   ├── properties/         # Objekt-Formulare, Kartenansicht
│   ├── financing/          # Finanzierungs-Module
│   ├── documents/          # Dokumenten-Generierung & Versand
│   └── ui/                 # shadcn/ui Primitive
├── lib/                    # Business-Logik, Hilfsfunktionen, Server Functions
├── integrations/supabase/  # Auto-generierte Supabase-Clients & Types
├── server/                 # Server-seitige Hilfsmittel (Wird NICHT vom Client importiert!)
├── types/                  # Globale TypeScript-Typen
└── assets/                 # Statische Assets

pdf-service/                # Externer Puppeteer-Microservice für PDF-Rendering
supabase/
├── migrations/             # Datenbank-Migrationen
├── functions/              # Edge Functions (z. B. PDF-Parsing)
└── config.toml             # Supabase-Projektkonfiguration
```

---

## Kern-Module

### Kunden (`/clients`)
- **Kundenverwaltung** mit Personen- und Firmendatensätzen
- **Kunden-Wizard**: Schritt-für-Schritt-Erfassung mit Wahl zwischen manuellem Eintragen oder **Selbstauskunft-Upload** (KI-gestütztes Auto-Fill via Gemini)
- **Intelligente Übersicht** beim Öffnen eines Kunden: Beziehungen, Immobilien, Termine, Aufgaben, offene Finanzierung, Bankkonten
- **Selbstauskunft-Wizard**: 5-Schritt-Formular mit Live-Benchmark (Einnahmen vs. Ausgaben, Reserve/Quote)
- **Finanzierungs-Quick-Check**: Direkt aus der Kundenseite heraus auslösbar
- **Beziehungen, Rollen, Suchprofile**: Verknüpfungen zwischen Kontakten

### Immobilien (`/properties`)
- **Objektverwaltung** mit vollständigem Datenmodell (Adresse, Merkmale, Preis, Zustand, Energieausweis etc.)
- **Drei Ansichten**: Kacheln (Grid), Liste und **Kartenansicht** (Mapbox – Schweizerkarte mit Objekt-Markern)
- **Eigentümer-Verknüpfung**: Objekte sind mit Kunden verknüpft (Eigentümer-Tabelle)
- **Exposé-Generator**: Automatisches Erstellen von PDF-Exposés
- **Objekt-Wizard** zum schnellen Erfassen

### Finanzierung (`/financing`)
- **Finanzierungsdossiers** pro Kunde
- **Bank-Submission**: Dossier-Qualitätsprüfung und Bank-Einreichung
- **UBS-Checkliste**: Vollständige Checkliste für UBS-Standards
- **Dokumenten-Management** innerhalb des Finanzierungs-Workflows
- **Selbstauskunft-Integration**: Direkter Zugriff auf die Kunden-Selbstauskunft

### Leads (`/leads`)
- **Lead-Pipeline** mit Status-Tracking
- **Lead-Import**: Massen-Import aus verschiedenen Quellen
- **Konvertierung zu Kunden**: Ein-Klick-Überführung in die Kundendatenbank

### Termine & Aufgaben (`/appointments`, `/tasks`)
- **Kalender-Übersicht** und Aufgabenverwaltung
- Verknüpfung mit Kunden und Objekten
- Status-Tracking (offen, erledigt, überfällig)

### Dokumente (`/documents`, `/generated-documents`)
- **Dokumenten-Wizard**: Schrittweises Erstellen von Briefen, Verträgen etc.
- **Template-Engine**: TipTap-basierte Rich-Text-Templates mit Platzhaltern
- **PDF-Generierung**: Externer Puppeteer-Service für hochwertiges PDF-Rendering
- **Versand-Logik**: E-Mail-Versand mit Tracking

### Mandate (`/mandates`)
- **Mandatsverwaltung** mit digitaler Erfassung

### Matching (`/matching`)
- **Suchprofil-Matching**: Automatisches Zusammenführen von Kunden-Suchprofilen mit verfügbaren Objekten

### Medien (`/media`)
- **Medienverwaltung** (Bilder, Videos, Dokumente)

### Analytik (`/analytics`)
- **Dashboards und Kennzahlen** für das Makler-Business

### Team & Einstellungen (`/team`, `/settings`)
- **Benutzerverwaltung** mit Rollen und Berechtigungen
- **Unternehmensprofil**, Bankkonten, Brandkit
- **Dokumenten-Templates** verwalten

---

## Sicherheit

- **Row-Level Security (RLS)** auf allen kritischen Tabellen
- **Rollenbasierte Zugriffskontrolle** (`user_roles`-Tabelle + `has_role()`-Funktion)
- **Auth-Middleware** für geschützte Server Functions
- **Service-Role-Client** nur auf dem Server, nie im Browser
- **Input-Validierung** mit Zod auf allen Server Functions und API-Routen

---

## Umgebungsvariablen

Die folgenden Variablen werden automatisch von Lovable Cloud bereitgestellt:

| Variable | Zweck |
|----------|-------|
| `VITE_SUPABASE_URL` | Supabase-Projekt-URL (Browser) |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Anonymer Supabase-Key (Browser) |
| `SUPABASE_SERVICE_ROLE_KEY` | Service-Role-Key (Server only) |
| `MAPBOX_PUBLIC_TOKEN` | Mapbox-API-Token für Karten |
| `PDF_SERVICE_URL` | URL des externen PDF-Services |
| `PDF_SERVICE_TOKEN` | API-Key für den PDF-Service |

---

## Lokale Entwicklung

```bash
# Abhängigkeiten installieren
bun install

# Dev-Server starten
bun run dev

# Build (inkl. TypeScript-Check)
bun run build

# Linting
bun run lint

# Formatieren
bun run format
```

---

## PDF-Service (extern)

Der PDF-Microservice lebt in `pdf-service/` und wird separat deployt:

```bash
cd pdf-service
docker build -t asimos-pdf .
docker run -e PDF_SERVICE_TOKEN=<secret> -p 8080:8080 asimos-pdf
```

Siehe `pdf-service/README.md` für Details.

---

## Lizenz

Privat. Alle Rechte vorbehalten.
