// Dialog "Abschluss verbuchen" – erscheint beim Statuswechsel auf Verkauft/Vermietet.
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Info } from "lucide-react";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/format";
import { bookClosingCommission } from "@/lib/commission.functions";
import { toastBooked } from "./commission-toast";
import { useTeamProfiles } from "./CommissionSplitEditor";

const ACTIVE = ["active", "signed", "sent"];

export function BookClosingCommissionDialog({
  open,
  onOpenChange,
  propertyId,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  propertyId: string;
}) {
  const qc = useQueryClient();
  const book = useServerFn(bookClosingCommission);
  const { data: profiles = [] } = useTeamProfiles();
  const [amount, setAmount] = useState("");

  // Berechnungsgrundlage laden: Objektpreis, aktives Mandat, bereits gebuchte Gebühr.
  const { data: basis } = useQuery({
    queryKey: ["closing-basis", propertyId],
    enabled: open && !!propertyId,
    queryFn: async () => {
      const [{ data: prop }, { data: mandates }, { data: records }] = await Promise.all([
        supabase.from("properties").select("id, price, title").eq("id", propertyId).maybeSingle(),
        supabase
          .from("mandates")
          .select("id, status, commission_model, commission_value")
          .eq("property_id", propertyId)
          .order("created_at", { ascending: false }),
        supabase
          .from("commission_records")
          .select("id, record_type, gross_amount")
          .eq("property_id", propertyId)
          .neq("status", "void"),
      ]);
      const mandate =
        (mandates ?? []).find((m: any) => ACTIVE.includes(String(m.status))) ?? (mandates ?? [])[0] ?? null;
      const price = Number(prop?.price) || 0;
      let computed = 0;
      if (mandate) {
        const val = Number(mandate.commission_value) || 0;
        computed = mandate.commission_model === "percent" ? (price * val) / 100 : val;
      }
      const reservationFee = (records ?? []).find((r: any) => r.record_type === "reservation_fee");
      const alreadyBooked = (records ?? []).some((r: any) => r.record_type === "commission");
      return {
        title: prop?.title ?? "",
        price,
        mandate,
        computed: Math.round(computed * 100) / 100,
        reservationFee: reservationFee ? Number(reservationFee.gross_amount) : null,
        alreadyBooked,
      };
    },
  });

  useEffect(() => {
    if (open && basis) setAmount(basis.computed ? String(basis.computed) : "");
  }, [open, basis]);

  const names = new Map(profiles.map((p) => [p.id, p.full_name || p.email || "Unbekannt"]));

  const run = useMutation({
    mutationFn: async () => {
      const value = Number(amount);
      return book({
        data: {
          propertyId,
          ...(value > 0 && value !== basis?.computed ? { finalCommissionAmount: value } : {}),
        },
      });
    },
    onSuccess: (record) => {
      toastBooked(record as any, names, "Abschlussprovision");
      qc.invalidateQueries({ queryKey: ["commission-records"] });
      qc.invalidateQueries({ queryKey: ["closing-basis", propertyId] });
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Abschluss verbuchen</DialogTitle>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          <div className="rounded-lg border bg-muted/20 p-3">
            <p className="text-muted-foreground">Objektpreis</p>
            <p className="font-medium">{formatCurrency(basis?.price ?? null)}</p>
            <p className="mt-2 text-muted-foreground">Berechnete Provision aus Mandat</p>
            <p className="font-medium">
              {basis?.mandate
                ? `${formatCurrency(basis.computed)} (${basis.mandate.commission_value}${
                    basis.mandate.commission_model === "percent" ? " %" : " CHF"
                  })`
                : "Kein Mandat gefunden – bitte Betrag manuell erfassen."}
            </p>
          </div>

          <div>
            <Label>Effektiver Provisionsbetrag (CHF)</Label>
            <Input type="number" step="100" value={amount} onChange={(e) => setAmount(e.target.value)} />
            <p className="mt-1 text-xs text-muted-foreground">
              Anpassen, falls der tatsächliche Verkaufspreis abwich.
            </p>
          </div>

          {basis?.reservationFee ? (
            <p className="flex items-start gap-2 rounded-md bg-primary/10 p-2 text-xs text-primary">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Für dieses Objekt wurde bereits eine Reservationsgebühr von{" "}
              {formatCurrency(basis.reservationFee)} gebucht – sie wird angerechnet.
            </p>
          ) : null}

          {basis?.alreadyBooked && (
            <p className="rounded-md bg-amber-500/10 p-2 text-xs text-amber-700">
              Für dieses Objekt wurde die Abschlussprovision bereits gebucht.
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Später verbuchen
          </Button>
          <Button
            onClick={() => run.mutate()}
            disabled={run.isPending || !Number(amount) || !!basis?.alreadyBooked}
          >
            {run.isPending ? "Wird gebucht…" : "Provision verbuchen"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
