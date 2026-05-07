# Selbstauskunft Wizard + PDF-Auto-Fill

## Ziel
Die heutige lange Single-Page-Selbstauskunft wird ersetzt durch:
1. Eine **Detail-/Übersichtsansicht** auf der Kundenseite (nach Speichern bleibt sie sichtbar, wie heute aber kompakt).
2. Einen **Wizard** in 5 Schritten zum Ausfüllen/Bearbeiten – mit **Live-Benchmark** in der Sidebar.
3. Eine **PDF-Upload-Funktion**: bestehende ASIMO-Selbstauskunft hochladen → Felder werden via KI automatisch erkannt und ins Wizard-Formular vorbefüllt.

## Wizard-Struktur (5 Steps)

```
┌────────────────────────────┬───────────────────────┐
│ Step-Indikator + Inhalt    │ Live-Benchmark Karte  │
│                            │ • Einnahmen-Total     │
│ [Schritt-Felder]           │ • Ausgaben-Total      │
│                            │ • Reserve / Quote     │
│ [Zurück] [Weiter/Speichern]│ • Status-Badge        │
└────────────────────────────┴───────────────────────┘
```

Steps:
1. **Personendaten** (Anrede, Name, Adresse, Geburtsdatum, Steuer-ID …)
2. **Beruf** (Status, Arbeitgeber, Position, Gehaltstyp, Jahresgehalt)
3. **Einnahmen monatlich** (4 Felder → Live-Total)
4. **Ausgaben monatlich** (13 Felder → Live-Total + Live-Benchmark)
5. **Abschluss** (Berater, Datum, Ort, interne Notizen)

Oben im Wizard ein Drop-Bereich **„Bestehende Selbstauskunft hochladen (PDF)"**, der das Formular vorbefüllt.

## PDF-Auto-Fill

- **Edge Function** `parse-self-disclosure` (Supabase Edge Function, da Lovable AI Gateway-fähig):
  - Empfängt PDF als Base64.
  - Ruft `google/gemini-2.5-flash` über Lovable AI Gateway (`LOVABLE_API_KEY`) mit dem PDF als `inline_data` auf.
  - Strikter JSON-Schema-Prompt mit allen Selbstauskunfts-Feldnamen (gleiche Keys wie DB-Spalten).
  - Antwort: JSON mit erkannten Feldern. Frontend mergt in den Wizard-State (User kann anschliessend prüfen/korrigieren).
- Im Wizard: Toast „X Felder erkannt – bitte prüfen". Checkliste im PDF wird ignoriert.

## Detail-Ansicht (nach Abschluss)

`ClientSelfDisclosureTab` zeigt nach gespeicherten Daten eine **kompakte, gruppierte Übersicht** (ähnlich PDF-Layout) mit Benchmark-Karte oben. Buttons: „Bearbeiten" (öffnet Wizard) · „PDF hochladen" (öffnet Wizard mit Drop-Bereich) · „Neue erfassen" (wenn leer).

## Technische Details

- **Neue Datei** `src/components/clients/ClientSelfDisclosureWizard.tsx` — Dialog mit Steps, lokalem Form-State, Live-`calculateBenchmark`, PDF-Upload-Bereich, finalem Upsert in `client_self_disclosures`.
- **Neue Edge Function** `supabase/functions/parse-self-disclosure/index.ts` — `verify_jwt = false`, ruft Gemini via Lovable AI Gateway, gibt strukturiertes JSON zurück. Nutzt vorhandenes `LOVABLE_API_KEY`-Secret.
- **Refactor** `ClientSelfDisclosureTab.tsx` — alte Single-Page-Form entfernen, durch Summary + Wizard-Trigger ersetzen.
- Wiederverwendung: `calculateBenchmark`, `BenchmarkCard`, alle Field-Konstanten aus `src/lib/self-disclosure.ts` — keine Logik-Änderungen.
- Keine DB-Schema-Änderungen nötig (Spalten existieren bereits).
- Keine neuen npm-Pakete.

## Out of scope
- Checkliste aus dem PDF (explizit ignoriert).
- Mitantragsteller (heute auch nicht im Form).
- Signatur-Bilder.

Nach deiner Bestätigung lege ich los.