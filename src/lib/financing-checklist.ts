// UBS-Einreichungs-Checkliste – Vorlage und Helpers
// Schweizer Rechtschreibung, kein ß.

export type ChecklistSection =
  | "customer"
  | "financing_structure"
  | "property_docs"
  | "income_employment"
  | "tax"
  | "self_employed"
  | "affordability"
  | "additional_check"
  | "submission_quality"
  | "rejection_reasons";

export type ChecklistItemStatus = "open" | "present" | "missing" | "not_relevant";

export const SECTION_LABELS: Record<ChecklistSection, string> = {
  customer: "Kundendossier",
  financing_structure: "Finanzierungsstruktur",
  property_docs: "Objektdokumentation",
  income_employment: "Einkommen & Anstellung",
  tax: "Steuerunterlagen",
  self_employed: "Selbständige / Unternehmer",
  affordability: "Tragbarkeit",
  additional_check: "Zusätzliche Prüfung",
  submission_quality: "Einreichungsqualität",
  rejection_reasons: "Häufige Ablehnungsgründe",
};

export const STATUS_LABELS: Record<ChecklistItemStatus, string> = {
  open: "Offen",
  present: "Vorhanden",
  missing: "Fehlt",
  not_relevant: "Nicht relevant",
};

export type TemplateItem = { key: string; label: string; required?: boolean };

export const CHECKLIST_TEMPLATE: Record<ChecklistSection, TemplateItem[]> = {
  customer: [
    { key: "id_document", label: "Identifikationsdokument (ID/Pass)", required: true },
    { key: "residence_permit", label: "Wohnsitz / Aufenthaltsbewilligung", required: true },
    { key: "civil_status_proof", label: "Nachweis Zivilstand (falls relevant)" },
    { key: "client_overview", label: "Kundenübersicht / Profil komplett", required: true },
  ],
  financing_structure: [
    { key: "purchase_price_doc", label: "Kaufpreis dokumentiert", required: true },
    { key: "renovation_costs_doc", label: "Renovationskosten dokumentiert" },
    { key: "equity_proof", label: "Eigenmittelnachweis (Kontoauszug)", required: true },
    { key: "pillar_3a_proof", label: "Säule 3a Nachweis" },
    { key: "pension_fund_proof", label: "Pensionskasse Vorbezugsbestätigung" },
    { key: "vested_benefits_proof", label: "Freizügigkeitskonto Nachweis" },
    { key: "gift_contract", label: "Schenkungsvertrag (falls Schenkung)" },
    { key: "inheritance_doc", label: "Erbvorbezug Vertrag (falls Erbschaft)" },
    { key: "private_loan_contract", label: "Privates Darlehen Vertrag (zinslos)" },
    { key: "hard_equity_check", label: "Min. 10% harte Eigenmittel ausserhalb PK", required: true },
  ],
  property_docs: [
    { key: "expose", label: "Verkaufsdokumentation / Exposé", required: true },
    { key: "land_register", label: "Grundbuchauszug (max. 3 Monate alt)", required: true },
    { key: "building_insurance", label: "Gebäudeversicherungspolice (max. 3 Monate)", required: true },
    { key: "floor_plans", label: "Grundrisspläne", required: true },
    { key: "building_description", label: "Baubeschrieb" },
    { key: "renovations_list", label: "Renovationen (Details + Kosten)" },
    { key: "garage_parking", label: "Garage / Parkplätze (Bewertung)" },
    { key: "stw_regulation", label: "Reglement (bei Stockwerkeigentum)" },
    { key: "stw_accounts", label: "Nebenkostenabrechnungen (STWE, aktuell)" },
  ],
  income_employment: [
    { key: "salary_statement", label: "Lohnausweis (aktuelles Jahr)", required: true },
    { key: "payslips", label: "Lohnabrechnungen letzte 3 Monate", required: true },
    { key: "employment_contract", label: "Arbeitsvertrag", required: true },
    { key: "probation_passed", label: "Probezeit bestanden", required: true },
    { key: "employment_active", label: "Ungekündigtes Arbeitsverhältnis", required: true },
    { key: "pk_statement", label: "Aktueller PK-Ausweis (ab 50 Jahren)" },
  ],
  tax: [
    { key: "tax_last", label: "Letzte definitive Steuererklärung", required: true },
    { key: "tax_prior", label: "Vorjahres-Steuererklärung (Plausibilisierung)" },
  ],
  self_employed: [
    { key: "balance_sheets_3y", label: "Bilanzen letzte 3 Jahre" },
    { key: "income_statements_3y", label: "Erfolgsrechnungen letzte 3 Jahre" },
    { key: "interim_report", label: "Aktueller Zwischenabschluss" },
    { key: "commercial_register", label: "Handelsregisterauszug" },
  ],
  affordability: [
    { key: "calc_complete", label: "Tragbarkeitsberechnung vollständig", required: true },
    { key: "ratio_under_33", label: "Tragbarkeit ≤ 33%", required: true },
    { key: "ltv_under_80", label: "Belehnung ≤ 80%", required: true },
    { key: "amortisation_plan", label: "Amortisationsplan (2. Hypothek in 15 Jahren)" },
  ],
  additional_check: [
    { key: "obligations_listed", label: "Bestehende Verpflichtungen aufgeführt" },
    { key: "alimony_listed", label: "Unterhaltszahlungen aufgeführt" },
    { key: "assets_overview", label: "Vermögensübersicht" },
    { key: "future_perspectives", label: "Zukunftsperspektiven dokumentiert" },
  ],
  submission_quality: [
    { key: "all_docs_complete", label: "Alle Pflichtdokumente vollständig", required: true },
    { key: "docs_legible", label: "Dokumente lesbar und vollständig" },
    { key: "self_disclosure_signed", label: "Selbstauskunft unterschrieben", required: true },
    { key: "cover_letter", label: "Einreichungs-Anschreiben vorhanden" },
  ],
  rejection_reasons: [
    { key: "no_probation_issue", label: "Kein laufendes Probezeit-Risiko" },
    { key: "no_recent_job_change", label: "Kein kürzlicher Stellenwechsel" },
    { key: "no_negative_credit", label: "Keine negativen Bonitäts-Einträge" },
    { key: "no_excessive_obligations", label: "Keine übermässigen Verpflichtungen" },
    { key: "stable_income", label: "Einkommen stabil und nachweisbar" },
  ],
};

export const SECTION_ORDER: ChecklistSection[] = [
  "customer", "financing_structure", "property_docs", "income_employment",
  "tax", "self_employed", "affordability", "additional_check",
  "submission_quality", "rejection_reasons",
];

export type ChecklistRow = {
  id?: string;
  dossier_id?: string;
  section: ChecklistSection;
  item_key: string;
  label: string;
  status: ChecklistItemStatus;
  is_present: boolean;
  note?: string | null;
  document_id?: string | null;
  sort_order: number;
};

export function buildDefaultChecklist(dossierId: string): Omit<ChecklistRow, "id">[] {
  const rows: Omit<ChecklistRow, "id">[] = [];
  SECTION_ORDER.forEach((section) => {
    CHECKLIST_TEMPLATE[section].forEach((it, idx) => {
      rows.push({
        dossier_id: dossierId,
        section,
        item_key: it.key,
        label: it.label,
        status: "open",
        is_present: false,
        note: null,
        document_id: null,
        sort_order: idx,
      });
    });
  });
  return rows;
}

export function checklistStats(rows: ChecklistRow[]) {
  const required = new Set<string>();
  SECTION_ORDER.forEach((sec) =>
    CHECKLIST_TEMPLATE[sec].forEach((it) => {
      if (it.required) required.add(`${sec}:${it.key}`);
    })
  );

  const total = rows.filter((r) => r.status !== "not_relevant").length;
  const present = rows.filter((r) => r.is_present || r.status === "present").length;
  const missing = rows.filter((r) => r.status === "missing").length;

  const requiredRows = rows.filter((r) => required.has(`${r.section}:${r.item_key}`));
  const requiredPresent = requiredRows.filter((r) => r.is_present || r.status === "present").length;
  const requiredTotal = requiredRows.length;

  const completionPercent = total > 0 ? Math.round((present / total) * 100) : 0;
  const requiredPercent = requiredTotal > 0 ? Math.round((requiredPresent / requiredTotal) * 100) : 0;

  return { total, present, missing, completionPercent, requiredTotal, requiredPresent, requiredPercent };
}
