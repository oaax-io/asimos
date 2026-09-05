// Wiederverwendbarer Zeilen-Editor für die Provisions-Aufteilung.
// Wird sowohl im Mandat-Assistenten (Planung vor dem Speichern) als auch im
// Split-Dialog der Mandatsübersicht verwendet.
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, AlertTriangle, Users } from "lucide-react";

export type SplitRow = { user_id: string; role: string; split_percent: number };

export const SPLIT_ROLE_LABELS: Record<string, string> = {
  listing_agent: "Listing-Agent",
  selling_agent: "Verkaufs-Agent",
  referrer: "Tippgeber",
  team_lead: "Teamleitung",
  other: "Andere",
};

export function useTeamProfiles() {
  return useQuery({
    queryKey: ["profiles-for-splits"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email, avatar_url, commission_tier, commission_payout_rate")
        .order("full_name");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function CommissionSplitEditor({
  rows,
  onChange,
}: {
  rows: SplitRow[];
  onChange: (rows: SplitRow[]) => void;
}) {
  const { data: profiles = [] } = useTeamProfiles();
  const total = rows.reduce((s, r) => s + (Number(r.split_percent) || 0), 0);

  const update = (i: number, patch: Partial<SplitRow>) =>
    onChange(rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="flex items-center gap-2">
          <Users className="h-4 w-4" /> Beteiligte &amp; Aufteilung
        </Label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() =>
            onChange([...rows, { user_id: "", role: "selling_agent", split_percent: 0 }])
          }
        >
          <Plus className="mr-1 h-3.5 w-3.5" /> Zeile
        </Button>
      </div>

      {rows.length === 0 && (
        <p className="rounded-md border border-dashed bg-muted/20 p-3 text-sm text-muted-foreground">
          Noch keine Beteiligten erfasst.
        </p>
      )}

      <div className="space-y-2">
        {rows.map((r, i) => {
          const prof = profiles.find((p) => p.id === r.user_id);
          return (
            <div key={i} className="flex flex-wrap items-center gap-2 rounded-lg border bg-card p-2">
              <Avatar className="h-8 w-8">
                {prof?.avatar_url ? <AvatarImage src={prof.avatar_url} alt={prof.full_name ?? ""} /> : null}
                <AvatarFallback className="bg-primary text-[10px] text-primary-foreground">
                  {(prof?.full_name || prof?.email || "?").slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <Select value={r.user_id} onValueChange={(v) => update(i, { user_id: v })}>
                <SelectTrigger className="min-w-[10rem] flex-1">
                  <SelectValue placeholder="Mitarbeiter" />
                </SelectTrigger>
                <SelectContent>
                  {profiles.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.full_name || p.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={r.role} onValueChange={(v) => update(i, { role: v })}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(SPLIT_ROLE_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>
                      {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex items-center gap-1">
                <Input
                  type="number"
                  min={0}
                  max={100}
                  step="0.5"
                  className="w-24"
                  value={String(r.split_percent)}
                  onChange={(e) => update(i, { split_percent: Number(e.target.value) || 0 })}
                />
                <span className="text-sm text-muted-foreground">%</span>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => onChange(rows.filter((_, idx) => idx !== i))}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">Summe</span>
        <span className="font-medium">{total.toFixed(1)} %</span>
      </div>
      {rows.length > 0 && Math.abs(total - 100) > 0.01 && (
        <p className="flex items-center gap-2 rounded-md bg-amber-500/10 p-2 text-xs text-amber-700">
          <AlertTriangle className="h-3.5 w-3.5" />
          Die Summe der Anteile beträgt {total.toFixed(1)} % statt 100 %. Das ist erlaubt, prüfe es aber kurz.
        </p>
      )}
    </div>
  );
}

/** Speichert die Planung: alte Zeilen der Immobilie löschen, neue einfügen. */
export async function saveMandateSplits(
  propertyId: string,
  mandateId: string | null,
  rows: SplitRow[],
) {
  const clean = rows.filter((r) => r.user_id);
  const { error: delErr } = await supabase
    .from("mandate_commission_splits")
    .delete()
    .eq("property_id", propertyId);
  if (delErr) throw delErr;
  if (!clean.length) return;
  const { error } = await supabase.from("mandate_commission_splits").insert(
    clean.map((r) => ({
      property_id: propertyId,
      mandate_id: mandateId,
      user_id: r.user_id,
      role: r.role,
      split_percent: r.split_percent,
    })) as any,
  );
  if (error) throw error;
}
