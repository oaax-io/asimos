// Definition der öffentlich sichtbaren Sektionen (1-8) inkl. Pflichtfeldern für Fortschritt.
// Sektionen 9 + 10 sind intern und werden hier NICHT abgebildet.

export type FieldType =
  | "text" | "email" | "tel" | "date" | "number" | "textarea"
  | "select" | "toggle" | "checkbox";

export type FieldDef = {
  key: string;
  label: string;
  type: FieldType;
  options?: { value: string; label: string }[];
  placeholder?: string;
  required?: boolean;
  hint?: string;
};

export type SectionKey =
  | "section_customer"
  | "section_financing"
  | "section_property_docs"
  | "section_income"
  | "section_tax"
  | "section_self_employed"
  | "section_affordability"
  | "section_additional";

export type SectionDef = {
  key: SectionKey;
  number: number;
  title: string;
  hint?: string;
  fields?: FieldDef[];
  // Spezielle Renderer (Tabellen / Berechnungen)
  custom?: "financing" | "affordability";
  // Checklisten-Items: jeweils Vorhanden + Bemerkung
  checklist?: { key: string; label: string; commentKey?: string }[];
};

export const PUBLIC_SECTIONS: SectionDef[] = [
  {
    key: "section_customer",
    number: 1,
    title: "Kundendossier",
    hint: "Probezeit muss bestanden sein. Ungekündigtes Arbeitsverhältnis zwingend. Bei 50+: PK-Ausweis vom aktuellen Jahr erforderlich.",
    fields: [
      { key: "lastName", label: "Name", type: "text", required: true },
      { key: "firstName", label: "Vorname", type: "text", required: true },
      { key: "birthDate", label: "Geburtsdatum", type: "date", required: true },
      { key: "maritalStatus", label: "Zivilstand", type: "select", required: true, options: [
        { value: "ledig", label: "Ledig" },
        { value: "verheiratet", label: "Verheiratet" },
        { value: "getrennt", label: "Getrennt" },
        { value: "geschieden", label: "Geschieden" },
        { value: "verwitwet", label: "Verwitwet" },
      ]},
      { key: "residenceStatus", label: "Wohnsitz / Aufenthaltsstatus", type: "text", required: true },
      { key: "profession", label: "Beruf / Funktion", type: "text", required: true },
      { key: "employer", label: "Arbeitgeber", type: "text", required: true },
      { key: "employmentDuration", label: "Anstellungsdauer", type: "text", placeholder: "z.B. 3 Jahre 4 Monate", required: true },
      { key: "phone", label: "Telefon", type: "tel", required: true },
      { key: "email", label: "E-Mail", type: "email", required: true },
    ],
  },
  {
    key: "section_financing",
    number: 2,
    title: "Finanzierungsstruktur",
    hint: "Mindestens 10% der Eigenmittel dürfen nicht aus der Pensionskasse stammen. Schenkung oder Erbvorbezug: Vertrag zwingend beilegen. Zinsloses Darlehen ist nicht rückzahlungspflichtig (UBS-konform).",
    custom: "financing",
  },
  {
    key: "section_property_docs",
    number: 3,
    title: "Objektdokumentation",
    hint: "Grundbuchauszug und Gebäudeversicherungspolice dürfen max. 3 Monate alt sein. Garage/Parkplatz: prüfen ob im Gebäudevolumen inkludiert. Bei Stockwerkeigentum: Reglement + Verwaltungsabrechnung idealerweise.",
    checklist: [
      { key: "exposeDoc", label: "Verkaufsdokumentation / Exposé" },
      { key: "landRegister", label: "Grundbuchauszug (max. 3 Monate alt)" },
      { key: "buildingInsurance", label: "Gebäudeversicherung" },
      { key: "floorPlans", label: "Grundrisspläne" },
      { key: "buildingDescription", label: "Baubeschrieb" },
      { key: "livingArea", label: "Wohnfläche (m²)" },
      { key: "renovations", label: "Renovationen (Details + Kosten)" },
      { key: "specialEquipment", label: "Spezielle Ausstattung (Pool, Sauna, Cheminée …)" },
      { key: "garageParking", label: "Garage / Parkplätze (inkl. Bewertung)" },
      { key: "stwRegulation", label: "Reglement (bei Stockwerkeigentum)" },
      { key: "stwAccounts", label: "Nebenkostenabrechnungen (Stockwerkeigentum, aktuell)" },
    ],
  },
  {
    key: "section_income",
    number: 4,
    title: "Einkommen & Anstellung",
    hint: "Steuererklärung: Im ersten Halbjahr gilt Vorjahr (z.B. 2026 → STE 2024). Lohnausweis 2025 zwingend. Probezeit muss bestanden sein.",
    checklist: [
      { key: "salaryStatement", label: "Lohnausweis (aktuell — 2025)" },
      { key: "payslips", label: "Lohnabrechnungen (letzte 3 Monate)" },
      { key: "employmentContract", label: "Arbeitsvertrag" },
      { key: "pkStatement", label: "Aktueller PK-Ausweis (ab 50 Jahren)" },
    ],
    fields: [
      { key: "probationCompleted", label: "Probezeit abgeschlossen", type: "toggle", required: true },
      { key: "employmentActive", label: "Ungekündigtes Arbeitsverhältnis", type: "toggle", required: true },
    ],
  },
  {
    key: "section_tax",
    number: 5,
    title: "Steuerunterlagen",
    checklist: [
      { key: "taxLast", label: "Letzte definitive Steuererklärung" },
      { key: "taxPrior", label: "Vorjahr (zur Plausibilisierung)" },
    ],
  },
  {
    key: "section_self_employed",
    number: 6,
    title: "Selbstständige / Unternehmer",
    hint: "Letzte 3 Jahre Bilanz und Erfolgsrechnung vollständig. Falls letztes Jahr noch nicht erledigt: Zwischenabschluss genügt. HR-Eintrag zwingend beilegen.",
    fields: [
      { key: "isSelfEmployed", label: "Bin selbstständig / Unternehmer", type: "toggle" },
    ],
    checklist: [
      { key: "balanceSheets", label: "Jahresabschlüsse 3 Jahre — Bilanz" },
      { key: "incomeStatements", label: "Jahresabschlüsse 3 Jahre — Erfolgsrechnung" },
      { key: "interimReport", label: "Aktueller Zwischenabschluss (falls nötig)" },
      { key: "commercialRegister", label: "Handelsregisterauszug" },
    ],
  },
  {
    key: "section_affordability",
    number: 7,
    title: "Tragbarkeitsprüfung (UBS-konform)",
    custom: "affordability",
  },
  {
    key: "section_additional",
    number: 8,
    title: "Zusätzliche Prüfung",
    fields: [
      { key: "obligationsAmount", label: "Bestehende Verpflichtungen (Kredite, Leasing) CHF/Jahr", type: "number" },
      { key: "obligationsNote", label: "Bemerkung Verpflichtungen", type: "text" },
      { key: "alimonyAmount", label: "Unterhaltszahlungen CHF/Jahr", type: "number" },
      { key: "assets", label: "Vermögensübersicht", type: "textarea" },
      { key: "futurePerspectives", label: "Zukunftsperspektiven (Karriere, Familie etc.)", type: "textarea" },
    ],
  },
];

// Pflichtfelder zur Berechnung der Vollständigkeit
export type CompletionInput = Record<SectionKey, any>;

export function computeCompletion(data: CompletionInput): {
  percent: number;
  perSection: Record<SectionKey, boolean>;
} {
  const perSection = {} as Record<SectionKey, boolean>;
  for (const s of PUBLIC_SECTIONS) {
    const sec = data[s.key] || {};
    let ok = true;

    if (s.fields) {
      for (const f of s.fields) {
        if (!f.required) continue;
        const v = sec[f.key];
        if (f.type === "toggle") {
          if (v !== true && v !== false) ok = false;
        } else if (v === undefined || v === null || v === "") {
          ok = false;
        }
      }
    }

    if (s.checklist) {
      // mindestens ein Eintrag angekreuzt zählt als "begonnen", aber für Vollständigkeit
      // verlangen wir, dass mindestens 50% angekreuzt sind
      const total = s.checklist.length;
      const checked = s.checklist.filter(c => sec[c.key] === true).length;
      if (total > 0 && checked / total < 0.5) ok = false;
    }

    if (s.custom === "financing") {
      const required = ["purchasePrice", "desiredMortgage"];
      for (const k of required) {
        if (!sec[k] || Number(sec[k]) <= 0) ok = false;
      }
    }

    if (s.custom === "affordability") {
      if (!sec.grossIncomeYearly || Number(sec.grossIncomeYearly) <= 0) ok = false;
    }

    perSection[s.key] = ok;
  }

  const total = PUBLIC_SECTIONS.length;
  const completed = Object.values(perSection).filter(Boolean).length;
  return { percent: Math.round((completed / total) * 100), perSection };
}

// ────────────────────────────── Berechnungen Sektion 2 ──────────────────────────────
export function calcFinancing(s: any) {
  const purchasePrice = Number(s.purchasePrice) || 0;
  const renovationCosts = Number(s.renovationCosts) || 0;
  const totalInvestment = purchasePrice + renovationCosts;
  const desiredMortgage = Number(s.desiredMortgage) || 0;
  const ltv = totalInvestment > 0 ? (desiredMortgage / totalInvestment) * 100 : 0;
  const minEquity = totalInvestment * 0.2;

  const equity = {
    liquid: Number(s.equityLiquid) || 0,
    pillar3a: Number(s.equityPillar3a) || 0,
    pensionFund: Number(s.equityPensionFund) || 0,
    vestedAccount: Number(s.equityVestedAccount) || 0,
    gift: Number(s.equityGift) || 0,
    privateLoan: Number(s.equityPrivateLoan) || 0,
  };
  const equityTotal = Object.values(equity).reduce((a, b) => a + b, 0);
  const pct = (v: number) => equityTotal > 0 ? (v / equityTotal) * 100 : 0;

  const pensionShare = pct(equity.pensionFund);
  const pkWarning = pensionShare > 90;

  return { purchasePrice, renovationCosts, totalInvestment, desiredMortgage, ltv, minEquity, equity, equityTotal, pct, pkWarning };
}

// ────────────────────────────── Berechnungen Sektion 7 ──────────────────────────────
export function calcAffordability(sFin: any, sAff: any) {
  const fin = calcFinancing(sFin || {});
  const grossIncome = Number(sAff?.grossIncomeYearly) || 0;
  const interestRate = 0.05; // 5% kalkulatorisch
  const interestCost = fin.desiredMortgage * interestRate;
  const sideCosts = fin.purchasePrice * 0.01;
  const amortization = fin.desiredMortgage * 0.01;
  const totalCosts = interestCost + sideCosts + amortization;
  const ratio = grossIncome > 0 ? (totalCosts / grossIncome) * 100 : 0;
  const traffic: "green" | "orange" | "red" = ratio <= 33 ? "green" : ratio <= 38 ? "orange" : "red";
  return { grossIncome, interestCost, sideCosts, amortization, totalCosts, ratio, traffic };
}
