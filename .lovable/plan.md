
# Dossier komplett an die Bank einreichen

Status: Damiano Guarino steht auf "Bereit für Bank". Heute gibt es zwar einen Tab "Bank-Einreichung" (Bankdaten + Status + Notizen), aber **kein Mechanismus, der das gesamte Dossier in einem Schritt bündelt und versendet**. Quick-Check-PDF, Selbstauskünfte (Kunde + Ehepartner), hochgeladene Dokumente, UBS-Checkliste, Notizen — alles liegt verstreut.

Ich schlage 3 Lösungsstufen vor — du wählst die Tiefe. Sie bauen aufeinander auf.

## Stufe 1 — "Bank-Paket generieren" (sofort umsetzbar, ohne externe Dienste)

Im Tab **Bank-Einreichung** ein neuer Button **"Bank-Paket erstellen"**, der:

1. Ein **Dossier-PDF** zusammenstellt aus:
   - Deckblatt (Kunde + Ehepartner/Mitantragsteller, Objekt, Finanzierungssumme)
   - Quick-Check Resultat (Tragbarkeit, Belehnung, EK-Aufteilung inkl. PK / Freizügigkeit / Eigenleistung)
   - Selbstauskunft Kunde + Selbstauskunft Ehepartner (aus `client_self_disclosures`)
   - UBS-Checkliste (Status pro Position)
   - Interne Notizen + Bank-Notizen
   - Liste aller beigelegten Dokumente (Inventar)
2. Erzeugt ein **ZIP** mit:
   - `00_Dossier_<Kunde>.pdf` (das obige Master-PDF)
   - `Unterlagen/` → alle Dateien aus `documents` (Kunde, Ehepartner, Objekt, Finanzierung)
   - `Generiert/` → alle Einträge aus `generated_documents`
3. Speichert das Paket in Cloud Storage (Bucket `bank-packages`) und legt einen Eintrag in `generated_documents` an (Typ `bank_package`) → erscheint im Dokumente-Tab und ist via Link teilbar.

Tab zeigt Historie aller erstellten Pakete (Datum, Ersteller, Download-Link).

## Stufe 2 — Versand an die Bank

Auf dem erzeugten Paket zwei Versand-Optionen:

- **E-Mail an Bankkontakt** (`bank_email` aus Dossier): vorgefertigter Text mit sicherem Download-Link (signed URL, 14 Tage gültig). Status springt automatisch auf `submitted_to_bank`, `submitted_to_bank_at` wird gesetzt, Activity-Log-Eintrag.
- **Sicherer Sharing-Link** (falls Bank kein E-Mail möchte): kopierbarer Link mit Ablaufdatum + Passwortschutz optional.

## Stufe 3 — UBS-Direkteinreichung (später)

Für UBS-Dossiers (`bank_type = ubs`) Adapter vorbereiten, der das gleiche Paket in das UBS-Format mappt (KeyPlan / strukturiertes JSON). Heute Stub, später API-Anbindung. Andere Banken bleiben bei E-Mail.

## Technische Details

- **PDF**: serverseitig im bestehenden `pdf-service` (Puppeteer) — HTML-Template `bank-dossier.html` mit Sections, Brand-Settings, Print-CSS. Server-Funktion `buildBankPackage` (`createServerFn`, `requireSupabaseAuth`).
- **ZIP**: `archiver` im pdf-service (Node), streamt direkt nach Storage.
- **Storage**: privater Bucket `bank-packages`, signed URLs.
- **Ehepartner**: aus `financing_dossiers.co_applicant_client_id` → Selbstauskunft + Dokumente automatisch mitziehen.
- **Status-Flow**: `ready_for_bank` → "Paket erstellt" (intern) → `submitted_to_bank` (nach Versand) → `documents_missing` / `approved` / `rejected` (manuell wie heute).
- **Audit**: jeder Paket-Build und Versand in `activity_logs`.

## Was ich von dir brauche

1. Welche Stufe(n) soll ich bauen — nur Stufe 1, oder Stufe 1 + 2 zusammen?
2. Versand bei Stufe 2: **E-Mail-Versand direkt aus Lovable** (via Resend/Lovable Mail) oder reicht ein **kopierbarer Download-Link**, den du selbst per Outlook/Bank-Portal versendest?
3. PDF-Sprache: nur Deutsch, oder auch FR/IT vorbereiten?
