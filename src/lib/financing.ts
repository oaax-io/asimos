// Finanzierungs-Helpers: Berechnungen + Bewertung Quick Check
// Schweizer Rechtschreibung, kein ß.

export type FinancingType =
  | "purchase"
  | "renovation"
  | "increase"
  | "refinance"
  | "new_build"
  | "mortgage_increase";

export type QuickCheckStatus = "realistic" | "critical" | "not_financeable" | "incomplete";

export type DossierStatus =
  | "draft"
  | "quick_check"
  | "documents_missing"
  | "ready_for_bank"
  | "submitted_to_bank"
  | "approved"
  | "rejected"
  | "cancelled";

export const FINANCING_TYPE_LABELS: Record<FinancingType, string> = {
  purchase: "Immobilienkauf",
  renovation: "Renovation",
  increase: "Aufstockung",
  refinance: "Refinanzierung",
  new_build: "Neubau",
  mortgage_increase: "Hypothekenerhöhung",
};

export const FINANCING_TYPE_DESCRIPTIONS: Record<FinancingType, string> = {
  purchase: "Finanzierung für den Kauf einer Immobilie",
  renovation: "Finanzierung von Renovationsarbeiten",
  increase: "Aufstockung einer bestehenden Hypothek",
  refinance: "Refinanzierung / Bankwechsel",
  new_build: "Finanzierung eines Neubaus",
  mortgage_increase: "Erhöhung der Hypothek bei gleicher Bank",
};

export const QUICK_CHECK_LABELS: Record<QuickCheckStatus, string> = {
  realistic: "Realistisch",
  critical: "Kritisch",
  not_financeable: "Nicht finanzierbar",
  incomplete: "Unvollständig",
};

export const DOSSIER_STATUS_LABELS: Record<DossierStatus, string> = {
  draft: "Entwurf",
  quick_check: "Quick Check",
  documents_missing: "Unterlagen fehlen",
  ready_for_bank: "Bereit für Bank",
  submitted_to_bank: "Bei Bank eingereicht",
  approved: "Genehmigt",
  rejected: "Abgelehnt",
  cancelled: "Storniert",
};

export type QuickCheckInput = {
  purchase_price?: number | null;
  renovation_costs?: number | null;
  requested_mortgage?: number | null;
  own_funds_total?: number | null;
  own_funds_pension_fund?: number | null;
  own_funds_vested_benefits?: number | null;
  gross_income_yearly?: number | null;
  calculated_interest_rate?: number | null;
  ancillary_costs_yearly?: number | null;
  amortisation_yearly?: number | null;
};

export type QuickCheckResult = {
  total_investment: number;
  loan_to_value_ratio: number;
  yearly_costs: number;
  affordability_ratio: number;
  hard_equity: number;
  hard_equity_ratio: number;
  status: QuickCheckStatus;
  reasons: { key: string; label: string; tone: "ok" | "warn" | "bad" }[];
};

export function calcQuickCheck(input: QuickCheckInput): QuickCheckResult {
  const purchase = num(input.purchase_price);
  const reno = num(input.renovation_costs);
  const total = purchase + reno;
  const mortgage = num(input.requested_mortgage);
  const equity = num(input.own_funds_total);
  const pensionRelated = num(input.own_funds_pension_fund) + num(input.own_funds_vested_benefits);
  const hardEquity = Math.max(0, equity - pensionRelated);
  const income = num(input.gross_income_yearly);
  const rate = num(input.calculated_interest_rate, 5);
  const ancillary = input.ancillary_costs_yearly != null
    ? num(input.ancillary_costs_yearly)
    : total * 0.01;
  const amort = num(input.amortisation_yearly);

  const ltv = total > 0 ? (mortgage / total) * 100 : 0;
  const yearly = mortgage * (rate / 100) + ancillary + amort;
  const affordability = income > 0 ? (yearly / income) * 100 : 0;
  const equityRatio = total > 0 ? (equity / total) * 100 : 0;
  const hardRatio = total > 0 ? (hardEquity / total) * 100 : 0;

  const reasons: QuickCheckResult["reasons"] = [];
  let status: QuickCheckStatus = "realistic";

  // Pflichtdaten
  if (total <= 0 || mortgage <= 0 || income <= 0) {
    return {
      total_investment: total,
      loan_to_value_ratio: ltv,
      yearly_costs: yearly,
      affordability_ratio: affordability,
      hard_equity: hardEquity,
      hard_equity_ratio: hardRatio,
      status: "incomplete",
      reasons: [{ key: "missing", label: "Pflichtdaten fehlen (Kaufpreis, Hypothek, Einkommen)", tone: "warn" }],
    };
  }

  // Eigenmittel
  if (equityRatio >= 20) {
    reasons.push({ key: "equity", label: `Eigenmittel ausreichend (${equityRatio.toFixed(1)}%)`, tone: "ok" });
  } else if (equityRatio >= 15) {
    reasons.push({ key: "equity", label: `Eigenmittel knapp (${equityRatio.toFixed(1)}%)`, tone: "warn" });
    status = worse(status, "critical");
  } else {
    reasons.push({ key: "equity", label: `Eigenmittel ungenügend (${equityRatio.toFixed(1)}%)`, tone: "bad" });
    status = worse(status, "not_financeable");
  }

  // Harte Eigenmittel
  if (hardRatio >= 10) {
    reasons.push({ key: "hard", label: `Harte Eigenmittel ausreichend (${hardRatio.toFixed(1)}%)`, tone: "ok" });
  } else if (hardRatio >= 7) {
    reasons.push({ key: "hard", label: `Harte Eigenmittel knapp (${hardRatio.toFixed(1)}%)`, tone: "warn" });
    status = worse(status, "critical");
  } else {
    reasons.push({ key: "hard", label: `Harte Eigenmittel ungenügend (${hardRatio.toFixed(1)}%)`, tone: "bad" });
    status = worse(status, "not_financeable");
  }

  // Tragbarkeit
  if (affordability <= 33) {
    reasons.push({ key: "afford", label: `Tragbarkeit gut (${affordability.toFixed(1)}%)`, tone: "ok" });
  } else if (affordability <= 38) {
    reasons.push({ key: "afford", label: `Tragbarkeit kritisch (${affordability.toFixed(1)}%)`, tone: "warn" });
    status = worse(status, "critical");
  } else {
    reasons.push({ key: "afford", label: `Tragbarkeit zu hoch (${affordability.toFixed(1)}%)`, tone: "bad" });
    status = worse(status, "not_financeable");
  }

  return {
    total_investment: total,
    loan_to_value_ratio: ltv,
    yearly_costs: yearly,
    affordability_ratio: affordability,
    hard_equity: hardEquity,
    hard_equity_ratio: hardRatio,
    status,
    reasons,
  };
}

function num(v: unknown, fallback = 0): number {
  const n = typeof v === "string" ? parseFloat(v) : (v as number);
  return Number.isFinite(n) ? n : fallback;
}

function worse(a: QuickCheckStatus, b: QuickCheckStatus): QuickCheckStatus {
  const order: QuickCheckStatus[] = ["realistic", "critical", "not_financeable", "incomplete"];
  return order.indexOf(b) > order.indexOf(a) ? b : a;
}
