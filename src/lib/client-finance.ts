// Zusatzlogik für das Finanz-Cockpit im Kundenprofil.
// Additiv zur bestehenden Selbstauskunft-Logik (src/lib/self-disclosure.ts).

export type FinanceArea =
  | "income"
  | "expense"
  | "asset"
  | "liability"
  | "insurance"
  | "pension";

export type Periodicity = "monthly" | "yearly" | "once";
export type PersonScope = "main" | "partner" | "joint";
export type FinanceSource =
  | "manual"
  | "self_disclosure"
  | "pdf"
  | "financing"
  | "client";

export interface FinanceItem {
  id: string;
  client_id: string;
  person_client_id: string | null;
  area: FinanceArea;
  category: string;
  label: string | null;
  amount: number | string | null;
  periodicity: Periodicity;
  person_scope: PersonScope;
  available_as_equity: number | string | null;
  details: Record<string, any>;
  source: FinanceSource;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export const areaLabels: Record<FinanceArea, string> = {
  income: "Einkommen",
  expense: "Ausgaben & Budget",
  asset: "Vermögen & Eigenmittel",
  liability: "Verpflichtungen",
  insurance: "Versicherungen",
  pension: "Sparen & Vorsorge",
};

export const periodicityLabels: Record<Periodicity, string> = {
  monthly: "monatlich",
  yearly: "jährlich",
  once: "einmalig",
};

export const personScopeLabels: Record<PersonScope, string> = {
  main: "Hauptkunde",
  partner: "Partner/in",
  joint: "Gemeinsam",
};

export const sourceLabels: Record<FinanceSource, string> = {
  manual: "Manuell erfasst",
  self_disclosure: "Aus Selbstauskunft",
  pdf: "Aus PDF übernommen",
  financing: "Aus Finanzierung",
  client: "Vom Kunden angegeben",
};

export const categoryOptions: Record<FinanceArea, string[]> = {
  income: [
    "Haupteinkommen",
    "Nebeneinkommen",
    "Einkommen Partner",
    "Bonus",
    "Provision",
    "Mieteinnahmen",
    "Rente",
    "Unterhaltszahlungen",
    "Sonstiges Einkommen",
  ],
  expense: [
    "Miete",
    "Hypothek",
    "Nebenkosten",
    "Lebensmittel / Haushalt",
    "Kommunikation",
    "Fahrzeug",
    "Leasing",
    "ÖV",
    "Treibstoff",
    "Kinder / Betreuung",
    "Unterhalt",
    "Steuern",
    "Freizeit",
    "Abonnements",
    "Sonstige Ausgaben",
  ],
  asset: [
    "Bankkonto",
    "Sparkonto",
    "Bargeld",
    "Wertschriften",
    "Fonds",
    "Aktien",
    "Kryptowährungen",
    "Säule 3a",
    "Freizügigkeitsguthaben",
    "Pensionskasse",
    "Lebensversicherung (Rückkaufswert)",
    "Immobilie",
    "Beteiligung",
    "Sonstiges Vermögen",
  ],
  liability: [
    "Privatkredit",
    "Autokredit",
    "Leasing",
    "Kreditkarte",
    "Hypothek",
    "Privates Darlehen",
    "Geschäftsdarlehen",
    "Andere Verpflichtung",
  ],
  insurance: [
    "Krankenkasse",
    "Lebensversicherung",
    "Erwerbsunfähigkeit",
    "Todesfallversicherung",
    "Hausrat",
    "Privathaftpflicht",
    "Fahrzeugversicherung",
    "Gebäudeversicherung",
    "Rechtsschutz",
    "Weitere Versicherung",
  ],
  pension: [
    "Monatliches Sparen",
    "Säule 3a",
    "Pensionskasse",
    "Freizügigkeit",
    "Sparplan",
    "Wertschriftensparen",
    "Sonstige Vorsorge",
  ],
};

// Vermögenskategorien, die bereits als Vorsorge geführt werden – damit
// Vorsorgepositionen nicht doppelt zum Gesamtvermögen addiert werden.
export const pensionAssetCategories = new Set([
  "Säule 3a",
  "Freizügigkeitsguthaben",
  "Pensionskasse",
]);

export const numeric = (v: unknown): number => {
  if (v === null || v === undefined || v === "") return 0;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
};

/** Normalisiert einen Betrag auf einen Monatswert. */
export function monthlyAmount(item: Pick<FinanceItem, "amount" | "periodicity">): number {
  const a = numeric(item.amount);
  if (item.periodicity === "yearly") return a / 12;
  if (item.periodicity === "once") return 0;
  return a;
}

export function sumMonthly(items: FinanceItem[]): number {
  return items.reduce((s, i) => s + monthlyAmount(i), 0);
}

export function sumAmount(items: FinanceItem[]): number {
  return items.reduce((s, i) => s + numeric(i.amount), 0);
}

export function byArea(items: FinanceItem[], area: FinanceArea): FinanceItem[] {
  return items.filter((i) => i.area === area);
}

export function scopeBreakdown(items: FinanceItem[]) {
  const out: Record<PersonScope, number> = { main: 0, partner: 0, joint: 0 };
  for (const i of items) out[i.person_scope] += monthlyAmount(i);
  return out;
}

export interface CompletenessInput {
  income: boolean;
  expenses: boolean;
  assets: boolean;
  liabilities: boolean;
  insurances: boolean;
  pension: boolean;
}

export function completeness(input: CompletenessInput) {
  const entries = Object.entries(input) as [keyof CompletenessInput, boolean][];
  const done = entries.filter(([, v]) => v).length;
  return {
    percent: Math.round((done / entries.length) * 100),
    missing: entries.filter(([, v]) => !v).map(([k]) => k),
    done,
    total: entries.length,
  };
}

export const completenessLabels: Record<keyof CompletenessInput, string> = {
  income: "Einkommen",
  expenses: "Ausgaben",
  assets: "Vermögen",
  liabilities: "Verpflichtungen",
  insurances: "Versicherungen",
  pension: "Vorsorge",
};

export function formatDateCH(v: string | null | undefined): string {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("de-CH", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}
