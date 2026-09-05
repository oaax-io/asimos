// Einheitliche Erfolgsmeldung nach einer Provisionsbuchung.
import { toast } from "sonner";
import { formatCurrency } from "@/lib/format";
import type { CommissionRecordResult } from "@/lib/commission.functions";

export function toastBooked(
  record: CommissionRecordResult,
  names: Map<string, string>,
  label = "Provision",
) {
  const parts = record.splits.map(
    (s) => `${names.get(s.user_id) ?? "Unbekannt"} (${formatCurrency(s.payout_amount)})`,
  );
  toast.success(`${label}: ${formatCurrency(record.gross_amount)} verbucht`, {
    description: parts.length ? `Aufgeteilt auf: ${parts.join(", ")}` : "Keine Aufteilung hinterlegt.",
  });
}
