// Verwaltung der persönlichen Provisionsziele (commission_targets).
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Target } from "lucide-react";
import { toast } from "sonner";
import { formatCurrency, formatDate } from "@/lib/format";

const PERIOD_LABELS: Record<string, string> = { month: "Monat", quarter: "Quartal", year: "Jahr" };

export function CommissionTargetsDialog({
  open,
  onOpenChange,
  userId,
  userName,
  canManage,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  userId: string;
  userName: string;
  canManage: boolean;
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    period_type: "year",
    period_start: "",
    period_end: "",
    target_amount: "",
    target_deals: "",
    notes: "",
  });

  const { data: targets = [] } = useQuery({
    queryKey: ["commission-targets", userId],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("commission_targets")
        .select("*")
        .eq("user_id", userId)
        .order("period_start", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      if (!form.period_start || !form.period_end) throw new Error("Start und Ende sind erforderlich");
      const { error } = await supabase.from("commission_targets").insert({
        user_id: userId,
        period_type: form.period_type,
        period_start: form.period_start,
        period_end: form.period_end,
        target_amount: form.target_amount ? Number(form.target_amount) : null,
        target_deals: form.target_deals ? Number(form.target_deals) : null,
        notes: form.notes.trim() || null,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Ziel gespeichert");
      setForm({ period_type: "year", period_start: "", period_end: "", target_amount: "", target_deals: "", notes: "" });
      qc.invalidateQueries({ queryKey: ["commission-targets", userId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("commission_targets").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["commission-targets", userId] }),
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" /> Provisionsziele – {userName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-2">
          {targets.length === 0 && (
            <p className="rounded-md border border-dashed bg-muted/20 p-3 text-sm text-muted-foreground">
              Noch keine Ziele erfasst.
            </p>
          )}
          {targets.map((t: any) => (
            <div key={t.id} className="flex items-center gap-3 rounded-lg border bg-card p-3 text-sm">
              <div className="flex-1">
                <p className="font-medium">
                  {PERIOD_LABELS[t.period_type] ?? t.period_type}: {formatDate(t.period_start)} – {formatDate(t.period_end)}
                </p>
                <p className="text-muted-foreground">
                  {t.target_amount != null ? formatCurrency(Number(t.target_amount)) : "—"}
                  {t.target_deals != null ? ` · ${t.target_deals} Abschlüsse` : ""}
                  {t.notes ? ` · ${t.notes}` : ""}
                </p>
              </div>
              {canManage && (
                <Button variant="ghost" size="icon" onClick={() => remove.mutate(t.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
        </div>

        {canManage && (
          <div className="space-y-3 rounded-lg border bg-muted/20 p-3">
            <p className="text-sm font-medium">Neues Ziel</p>
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <Label>Zeitraum</Label>
                <Select value={form.period_type} onValueChange={(v) => setForm({ ...form, period_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(PERIOD_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Start</Label>
                <Input type="date" value={form.period_start} onChange={(e) => setForm({ ...form, period_start: e.target.value })} />
              </div>
              <div>
                <Label>Ende</Label>
                <Input type="date" value={form.period_end} onChange={(e) => setForm({ ...form, period_end: e.target.value })} />
              </div>
              <div>
                <Label>Zielbetrag (CHF)</Label>
                <Input type="number" value={form.target_amount} onChange={(e) => setForm({ ...form, target_amount: e.target.value })} />
              </div>
              <div>
                <Label>Ziel-Abschlüsse</Label>
                <Input type="number" value={form.target_deals} onChange={(e) => setForm({ ...form, target_deals: e.target.value })} />
              </div>
              <div>
                <Label>Notizen</Label>
                <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              </div>
            </div>
            <Button onClick={() => create.mutate()} disabled={create.isPending}>
              {create.isPending ? "Speichern…" : "Ziel hinzufügen"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
