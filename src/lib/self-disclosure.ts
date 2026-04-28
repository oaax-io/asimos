// Reine Berechnungs- und Bewertungslogik für die ASIMO-Selbstauskunft.
// Wird vom Detailseiten-Tab und (später) vom Wizard verwendet.

export type BenchmarkStatus = "strong" | "solid" | "tight" | "critical";

export const benchmarkLabels: Record<BenchmarkStatus, string> = {
  strong: "Stark",
  solid: "Solide",
  tight: "Knapp",
  critical: "Kritisch",
};

export const benchmarkDescriptions: Record<BenchmarkStatus, string> = {
  strong: "Reservequote von 30% oder mehr – sehr komfortable finanzielle Lage.",
  solid: "Reservequote zwischen 15% und 29% – tragfähig.",
  tight: "Reservequote zwischen 5% und 14% – wenig Spielraum.",
  critical: "Reservequote unter 5% – kritisch, sorgfältig prüfen.",
};

// Tailwind-Klassen pro Status (Karte / Badge / Dot).
export const benchmarkColors: Record<
  BenchmarkStatus,
  { badge: string; dot: string; ring: string; bg: string; text: string }
> = {
  strong: {
    badge: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30 dark:text-emerald-400",
    dot: "bg-emerald-500",
    ring: "border-emerald-500/40",
    bg: "from-emerald-500/10 via-background to-background",
    text: "text-emerald-600 dark:text-emerald-400",
  },
  solid: {
    badge: "bg-blue-500/15 text-blue-600 border-blue-500/30 dark:text-blue-400",
    dot: "bg-blue-500",
    ring: "border-blue-500/40",
    bg: "from-blue-500/10 via-background to-background",
    text: "text-blue-600 dark:text-blue-400",
  },
  tight: {
    badge: "bg-amber-500/15 text-amber-600 border-amber-500/30 dark:text-amber-400",
    dot: "bg-amber-500",
    ring: "border-amber-500/40",
    bg: "from-amber-500/10 via-background to-background",
    text: "text-amber-600 dark:text-amber-400",
  },
  critical: {
    badge: "bg-rose-500/15 text-rose-600 border-rose-500/30 dark:text-rose-400",
    dot: "bg-rose-500",
    ring: "border-rose-500/40",
    bg: "from-rose-500/10 via-background to-background",
    text: "text-rose-600 dark:text-rose-400",
  },
};

const num = (v: unknown): number => {
  if (v === null || v === undefined || v === "") return 0;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
};

export const incomeFields = [
  "salary_net_monthly",
  "additional_income",
  "income_job_two",
  "income_rental",
] as const;

export const expenseFields = [
  "mortgage_expense",
  "rent_expense",
  "leasing_expense",
  "credit_expense",
  "life_insurance_expense",
  "alimony_expense",
  "health_insurance_expense",
  "property_insurance_expense",
  "utilities_expense",
  "telecom_expense",
  "living_costs_expense",
  "taxes_expense",
  "miscellaneous_expense",
] as const;

export type IncomeField = (typeof incomeFields)[number];
export type ExpenseField = (typeof expenseFields)[number];

export const incomeLabels: Record<IncomeField, string> = {
  salary_net_monthly: "Gehalt Netto / Monat",
  additional_income: "Zusatzeinnahmen",
  income_job_two: "Job II",
  income_rental: "Vermietung",
};

export const expenseLabels: Record<ExpenseField, string> = {
  mortgage_expense: "Hypothek",
  rent_expense: "Miete inkl. NK",
  leasing_expense: "Leasing",
  credit_expense: "Kredit",
  life_insurance_expense: "Lebensversicherung",
  alimony_expense: "Alimente",
  health_insurance_expense: "Krankenversicherung",
  property_insurance_expense: "Sachversicherungen",
  utilities_expense: "Strom / Wasser / Abfall",
  telecom_expense: "Telefon / Internet / Radio-TV",
  living_costs_expense: "Lebenserhaltungskosten",
  taxes_expense: "Steuern",
  miscellaneous_expense: "Diverses",
};

export type DisclosureFinanceInput = Partial<
  Record<IncomeField | ExpenseField, number | string | null>
>;

export interface BenchmarkResult {
  totalIncome: number;
  totalExpenses: number;
  reserveTotal: number;
  reserveRatio: number; // %
  status: BenchmarkStatus;
}

export function calculateBenchmark(d: DisclosureFinanceInput): BenchmarkResult {
  const totalIncome = incomeFields.reduce((sum, f) => sum + num(d[f]), 0);
  const totalExpenses = expenseFields.reduce((sum, f) => sum + num(d[f]), 0);
  const reserveTotal = totalIncome - totalExpenses;
  const reserveRatio = totalIncome > 0 ? (reserveTotal / totalIncome) * 100 : 0;

  let status: BenchmarkStatus;
  if (reserveRatio >= 30) status = "strong";
  else if (reserveRatio >= 15) status = "solid";
  else if (reserveRatio >= 5) status = "tight";
  else status = "critical";

  return { totalIncome, totalExpenses, reserveTotal, reserveRatio, status };
}

export const relationshipTypeLabels = {
  spouse: "Ehepartner",
  co_applicant: "Mitantragsteller",
  co_investor: "Mitinvestor",
  other: "Sonstige Verbindung",
} as const;

export type RelationshipType = keyof typeof relationshipTypeLabels;
export const relationshipTypes = Object.keys(relationshipTypeLabels) as RelationshipType[];

export const maritalStatusOptions = [
  "ledig",
  "verheiratet",
  "eingetragene Partnerschaft",
  "getrennt",
  "geschieden",
  "verwitwet",
] as const;

export const employmentStatusOptions = [
  "Angestellt",
  "Selbständig",
  "Beamter",
  "Rentner / Pensioniert",
  "Student / Lehre",
  "Arbeitssuchend",
  "Hausfrau / Hausmann",
  "Sonstige",
] as const;

export const salutationOptions = ["Herr", "Frau", "Divers"] as const;

export function formatCHF(v: number | null | undefined): string {
  if (v === null || v === undefined || !Number.isFinite(Number(v))) return "—";
  return new Intl.NumberFormat("de-CH", {
    style: "currency",
    currency: "CHF",
    maximumFractionDigits: 0,
  }).format(Number(v));
}
