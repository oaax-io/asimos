// Dialog zum Bearbeiten der geplanten Provisions-Aufteilung eines Mandats.
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { CommissionSplitEditor, saveMandateSplits, type SplitRow } from "./CommissionSplitEditor";

export function MandateSplitDialog({
  open,
  onOpenChange,
  propertyId,
  mandateId,
  title,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  propertyId: string;
  mandateId: string | null;
  title?: string;
}) {
  const qc = useQueryClient();
  const [rows, setRows] = useState<SplitRow[]>([]);

  const { data: existing } = useQuery({
    queryKey: ["mandate-splits", propertyId],
    enabled: open && !!propertyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mandate_commission_splits")
        .select("user_id, role, split_percent")
        .eq("property_id", propertyId);
      if (error) throw error;
      return data ?? [];
    },
  });

  useEffect(() => {
    if (open && existing) {
      setRows(
        existing.map((e: any) => ({
          user_id: e.user_id,
          role: e.role ?? "other",
          split_percent: Number(e.split_percent) || 0,
        })),
      );
    }
  }, [open, existing]);

  const save = useMutation({
    mutationFn: () => saveMandateSplits(propertyId, mandateId, rows),
    onSuccess: () => {
      toast.success("Aufteilung gespeichert");
      qc.invalidateQueries({ queryKey: ["mandate-splits", propertyId] });
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Provisions-Aufteilung{title ? ` – ${title}` : ""}</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground">
          Dies ist die <strong>Planung</strong>. Bereits gebuchte Provisionen bleiben unverändert.
        </p>
        <CommissionSplitEditor rows={rows} onChange={setRows} />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Abbrechen
          </Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? "Speichern…" : "Speichern"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
