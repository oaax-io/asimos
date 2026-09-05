// Dialog "Deal erfassen / bearbeiten" – erfasst den kompletten Abschluss
// eines Objekts (Käufer, Verkaufspreis, Provision, Beteiligte, Finanzierung,
// Abschlussdatum) und kann bestehende Buchungen nachträglich korrigieren.
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Info, Percent, Banknote } from "lucide-react";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/format";
import { saveDeal } from "@/lib/commission.functions";
import { toastBooked } from "./commission-toast";
import { CommissionSplitEditor, useTeamProfiles, type SplitRow } from "./CommissionSplitEditor";
import { TypeCard } from "@/components/mandates/MandateWizard";

const ACTIVE_MANDATE = ["active", "signed", "sent"];
const today = () => new Date().toISOString().slice(0, 10);

export function DealDialog({
  open,
  onOpenChange,
  propertyId,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  propertyId: string;
  onSaved?: () => void;
}) {
  const qc = useQueryClient();
  const save = useServerFn(saveDeal);
  const { data: profiles = [] } = useTeamProfiles();

  const { data } = useQuery({
    queryKey: ["deal-basis", propertyId],
    enabled: open && !!propertyId,
    queryFn: async () => {
      const [
        { data: property },
        { data: mandates },
        { data: records },
        { data: reservations },
        { data: plannedSplits },
        { data: dossiers },
        { data: clients },
      ] = await Promise.all([
        supabase
          .from("properties")
          .select("id, title, price, rent, listing_type, status, assigned_to, seller_client_id")
          .eq("id", propertyId)
          .maybeSingle(),
        supabase
          .from("mandates")
          .select("id, status, commission_model, commission_value, client_id")
          .eq("property_id", propertyId)
          .order("created_at", { ascending: false }),
        supabase
          .from("commission_records")
          .select("*")
          .eq("property_id", propertyId)
          .neq("status", "void"),
        supabase
          .from("reservations")
          .select("id, client_id, reservation_fee, status")
          .eq("property_id", propertyId)
          .order("created_at", { ascending: false }),
        supabase
          .from("mandate_commission_splits")
          .select("user_id, role, split_percent")
          .eq("property_id", propertyId),
        supabase
          .from("financing_dossiers")
          .select("id, requested_mortgage, purchase_price, property_value, dossier_status, financing_type")
          .eq("property_id", propertyId),
        supabase.from("clients").select("id, full_name").order("full_name"),
      ]);

      const deal = (records ?? []).find((r: any) => r.record_type === "commission") ?? null;
      const reservationFee = (records ?? []).find((r: any) => r.record_type === "reservation_fee") ?? null;

      let dealSplits: SplitRow[] = [];
      if (deal) {
        const { data: rows } = await supabase
          .from("commission_record_splits")
          .select("user_id, role, split_percent")
          .eq("commission_record_id", (deal as any).id);
        dealSplits = (rows ?? []).map((r: any) => ({
          user_id: r.user_id,
          role: r.role ?? "other",
          split_percent: Number(r.split_percent) || 0,
        }));
      }

      return {
        property,
        mandate:
          (mandates ?? []).find((m: any) => ACTIVE_MANDATE.includes(String(m.status))) ??
          (mandates ?? [])[0] ??
          null,
        deal,
        dealSplits,
        reservation: (reservations ?? [])[0] ?? null,
        reservationFee: reservationFee ? Number((reservationFee as any).gross_amount) : null,
        plannedSplits: (plannedSplits ?? []).map((r: any) => ({
          user_id: r.user_id,
          role: r.role ?? "other",
          split_percent: Number(r.split_percent) || 0,
        })) as SplitRow[],
        dossiers: dossiers ?? [],
        clients: clients ?? [],
      };
    },
  });

  const isEdit = !!data?.deal;

  // ---- Formularstate ----
  const [clientId, setClientId] = useState("");
  const [salePrice, setSalePrice] = useState("");
  const [model, setModel] = useState<"percent" | "fixed">("percent");
  const [value, setValue] = useState("3");
  const [override, setOverride] = useState("");
  const [closedBy, setClosedBy] = useState("");
  const [splits, setSplits] = useState<SplitRow[]>([]);
  const [finMode, setFinMode] = useState<"none" | "dossier" | "manual">("none");
  const [dossierId, setDossierId] = useState("");
  const [finAmount, setFinAmount] = useState("");
  const [bookedAt, setBookedAt] = useState(today());
  const [notes, setNotes] = useState("");

  // Vorbelegung, sobald Daten geladen sind.
  useEffect(() => {
    if (!open || !data) return;
    const d: any = data.deal;
    const p: any = data.property;
    const m: any = data.mandate;
    setClientId(d?.client_id ?? data.reservation?.client_id ?? m?.client_id ?? "");
    const listPrice = p?.listing_type === "rent" ? p?.rent : p?.price;
    setSalePrice(String(d?.sale_price ?? listPrice ?? ""));
    setModel((m?.commission_model === "fixed" ? "fixed" : "percent") as "percent" | "fixed");
    setValue(String(m?.commission_value ?? (m?.commission_model === "fixed" ? "" : "3")));
    setOverride(d ? String(Number(d.gross_amount) || "") : "");
    setClosedBy(d?.closed_by ?? p?.assigned_to ?? "");
    setSplits(
      data.dealSplits.length
        ? data.dealSplits
        : data.plannedSplits.length
          ? data.plannedSplits
          : p?.assigned_to
            ? [{ user_id: p.assigned_to, role: "listing_agent", split_percent: 100 }]
            : [],
    );
    if (d?.financing_dossier_id) {
      setFinMode("dossier");
      setDossierId(d.financing_dossier_id);
      setFinAmount("");
    } else if (d?.financing_amount) {
      setFinMode("manual");
      setFinAmount(String(Number(d.financing_amount)));
    } else {
      setFinMode("none");
      setDossierId("");
      setFinAmount("");
    }
    setBookedAt((d?.booked_at ?? "").slice(0, 10) || today());
    setNotes(d?.description && d.description !== "Abschlussprovision" ? d.description : "");
  }, [open, data]);

  const computed = useMemo(() => {
    const price = Number(salePrice) || 0;
    const v = Number(value) || 0;
    return Math.round((model === "percent" ? (price * v) / 100 : v) * 100) / 100;
  }, [salePrice, value, model]);

  const names = new Map(profiles.map((p) => [p.id, p.full_name || p.email || "Unbekannt"]));

  const dossierAmount = (d: any) =>
    Number(d.requested_mortgage) || Number(d.purchase_price) || Number(d.property_value) || 0;

  const run = useMutation({
    mutationFn: async () => {
      const over = Number(override);
      const dossier = (data?.dossiers ?? []).find((d: any) => d.id === dossierId);
      return save({
        data: {
          propertyId,
          clientId: clientId || null,
          salePrice: Number(salePrice) || 0,
          commissionModel: model,
          commissionValue: Number(value) || 0,
          ...(over > 0 && over !== computed ? { finalCommissionAmount: over } : {}),
          financingAmount:
            finMode === "manual"
              ? Number(finAmount) || null
              : finMode === "dossier" && dossier
                ? dossierAmount(dossier) || null
                : null,
          financingDossierId: finMode === "dossier" && dossierId ? dossierId : null,
          closedBy: closedBy || null,
          splits: splits.filter((s) => s.user_id),
          bookedAt,
          notes: notes.trim() || undefined,
        },
      });
    },
    onSuccess: (record: any) => {
      toastBooked(record, names, isEdit ? "Deal aktualisiert" : "Deal erfasst", {
        salePrice: Number(salePrice) || null,
        financingAmount: record?.financing_amount != null ? Number(record.financing_amount) : null,
      });
      qc.invalidateQueries({ queryKey: ["commission-records"] });
      qc.invalidateQueries({ queryKey: ["commissions"] });
      qc.invalidateQueries({ queryKey: ["deal-basis", propertyId] });
      qc.invalidateQueries({ queryKey: ["property", propertyId] });
      qc.invalidateQueries({ queryKey: ["property_activities", propertyId] });
      qc.invalidateQueries({ queryKey: ["properties"] });
      onSaved?.();
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const gross = Number(override) > 0 ? Number(override) : computed;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Deal bearbeiten" : "Deal erfassen"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 text-sm">
          {isEdit && (data?.deal as any)?.updated_at ? (
            <p className="text-xs text-muted-foreground">
              Zuletzt aktualisiert am{" "}
              {new Date((data!.deal as any).updated_at).toLocaleDateString("de-CH")}
            </p>
          ) : null}

          <div>
            <Label>Käufer / Mieter</Label>
            <Select value={clientId} onValueChange={setClientId}>
              <SelectTrigger>
                <SelectValue placeholder="Kunde auswählen" />
              </SelectTrigger>
              <SelectContent>
                {(data?.clients ?? []).map((c: any) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Effektiver Verkaufs-/Mietpreis (CHF)</Label>
            <Input
              type="number"
              step="1000"
              value={salePrice}
              onChange={(e) => setSalePrice(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label>Provisionsmodell</Label>
            <div className="grid gap-3 sm:grid-cols-2">
              <TypeCard
                icon={<Percent className="size-6" />}
                title="Prozent"
                description="Provision als prozentualer Anteil vom Verkaufspreis."
                selected={model === "percent"}
                onClick={() => setModel("percent")}
                compact
              />
              <TypeCard
                icon={<Banknote />}
                title="Pauschal"
                description="Fester Betrag in CHF, unabhängig vom Verkaufspreis."
                selected={model === "fixed"}
                onClick={() => setModel("fixed")}
                compact
              />
            </div>
            <div>
              <Label>{model === "percent" ? "Provision (%)" : "Provision (CHF)"}</Label>
              <Input
                type="number"
                step={model === "percent" ? "0.1" : "100"}
                value={value}
                onChange={(e) => setValue(e.target.value)}
              />
            </div>
          </div>

          <div className="rounded-lg border bg-muted/20 p-3">
            <p className="text-muted-foreground">Berechnete Bruttoprovision</p>
            <p className="text-lg font-semibold">{formatCurrency(computed)}</p>
            <div className="mt-2">
              <Label>Abweichender Endbetrag (optional)</Label>
              <Input
                type="number"
                step="100"
                value={override}
                onChange={(e) => setOverride(e.target.value)}
              />
            </div>
          </div>

          <div>
            <Label>Wer hat den Deal abgeschlossen?</Label>
            <Select value={closedBy} onValueChange={setClosedBy}>
              <SelectTrigger>
                <SelectValue placeholder="Mitarbeiter auswählen" />
              </SelectTrigger>
              <SelectContent>
                {profiles.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.full_name || p.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <CommissionSplitEditor rows={splits} onChange={setSplits} />

          <div className="space-y-2">
            <Label>Finanzierung</Label>
            <Select value={finMode} onValueChange={(v) => setFinMode(v as any)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Keine Angabe</SelectItem>
                <SelectItem value="dossier">Bestehendes Dossier verknüpfen</SelectItem>
                <SelectItem value="manual">Manueller Betrag</SelectItem>
              </SelectContent>
            </Select>
            {finMode === "dossier" && (
              <Select value={dossierId} onValueChange={setDossierId}>
                <SelectTrigger>
                  <SelectValue placeholder="Dossier auswählen" />
                </SelectTrigger>
                <SelectContent>
                  {(data?.dossiers ?? []).map((d: any) => (
                    <SelectItem key={d.id} value={d.id}>
                      {formatCurrency(dossierAmount(d))} Hypothek — Status: {d.dossier_status ?? "—"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {finMode === "manual" && (
              <Input
                type="number"
                step="1000"
                placeholder="Finanzierungsbetrag (CHF)"
                value={finAmount}
                onChange={(e) => setFinAmount(e.target.value)}
              />
            )}
          </div>

          <div>
            <Label>Abschlussdatum</Label>
            <Input type="date" value={bookedAt} onChange={(e) => setBookedAt(e.target.value)} />
            <p className="mt-1 text-xs text-muted-foreground">
              Für rückwirkende Erfassung älterer Abschlüsse anpassbar.
            </p>
          </div>

          <div>
            <Label>Notizen</Label>
            <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>

          {data?.reservationFee ? (
            <p className="flex items-start gap-2 rounded-md bg-primary/10 p-2 text-xs text-primary">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              Für dieses Objekt wurde bereits eine Reservationsgebühr von{" "}
              {formatCurrency(data.reservationFee)} gebucht – sie wird angerechnet.
            </p>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Abbrechen
          </Button>
          <Button onClick={() => run.mutate()} disabled={run.isPending || gross <= 0}>
            {run.isPending ? "Wird gespeichert…" : isEdit ? "Deal aktualisieren" : "Deal speichern"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
