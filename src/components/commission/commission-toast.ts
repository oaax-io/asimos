// Einheitliche Erfolgsmeldung nach einer Provisionsbuchung.
import { toast } from "sonner";
import { formatCurrency } from "@/lib/format";
import type { CommissionRecordResult } from "@/lib/commission.functions";

export function toastBooked(
  record: CommissionRecordResult,
  names: Map<string, string>,
  label = "Provision",
  extra?: { salePrice?: number | null; financingAmount?: number | null },
) {
  const parts = record.splits.map(
    (s) => `${names.get(s.user_id) ?? "Unbekannt"} (${formatCurrency(s.payout_amount)})`,
  );
  const lines: string[] = [];
  if (extra?.salePrice) lines.push(`Verkaufspreis: ${formatCurrency(extra.salePrice)}`);
  if (extra?.financingAmount) lines.push(`Finanzierung: ${formatCurrency(extra.financingAmount)}`);
  lines.push(parts.length ? `Aufgeteilt auf: ${parts.join(", ")}` : "Keine Aufteilung hinterlegt.");

  toast.success(`${label}: ${formatCurrency(record.gross_amount)} verbucht`, {
    description: lines.join(" · "),
  });
}
