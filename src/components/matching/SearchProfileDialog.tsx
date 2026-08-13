import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { propertyTypeLabels } from "@/lib/format";
import type { Tables } from "@/integrations/supabase/types";

export type SearchProfile = Tables<"client_search_profiles">;

const PROPERTY_TYPES = Object.keys(propertyTypeLabels) as (keyof typeof propertyTypeLabels)[];

type FormState = {
  client_id: string;
  listing_type: "sale" | "rent";
  preferred_cities: string;
  preferred_property_types: string[];
  budget_min: string;
  budget_max: string;
  rooms_min: string;
  area_min: string;
  area_max: string;
  notes: string;
  is_active: boolean;
  duration: string;
};

const DURATIONS = [
  { value: "0", label: "Unbegrenzt" },
  { value: "1", label: "1 Monat" },
  { value: "3", label: "3 Monate" },
  { value: "6", label: "6 Monate" },
  { value: "12", label: "12 Monate" },
];

function addMonths(months: number) {
  const d = new Date();
  d.setMonth(d.getMonth() + months);
  return d.toISOString();
}

const EMPTY: FormState = {
  client_id: "",
  listing_type: "sale",
  preferred_cities: "",
  preferred_property_types: [],
  budget_min: "",
  budget_max: "",
  rooms_min: "",
  area_min: "",
  area_max: "",
  notes: "",
  is_active: true,
  duration: "0",
};

function num(v: string) {
  const n = Number(v.replace(/'/g, "").replace(/,/g, "."));
  return v.trim() === "" || Number.isNaN(n) ? null : n;
}


export function SearchProfileDialog({
  open,
  onOpenChange,
  profile,
  defaultClientId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  profile?: SearchProfile | null;
  defaultClientId?: string;
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState<FormState>(EMPTY);

  const { data: clients = [] } = useQuery({
    queryKey: ["clients-min-search-profile"],
    enabled: open,
    queryFn: async () =>
      (await supabase.from("clients").select("id,full_name").order("full_name")).data ?? [],
  });

  useEffect(() => {
    if (!open) return;
    if (profile) {
      setForm({
        client_id: profile.client_id,
        listing_type: (profile.listing_type ?? "sale") as "sale" | "rent",
        preferred_cities: (profile.preferred_cities ?? []).join(", "),
        preferred_property_types: profile.preferred_property_types ?? [],
        budget_min: profile.budget_min != null ? String(profile.budget_min) : "",
        budget_max: profile.budget_max != null ? String(profile.budget_max) : "",
        rooms_min: profile.rooms_min != null ? String(profile.rooms_min) : "",
        area_min: profile.area_min != null ? String(profile.area_min) : "",
        area_max: profile.area_max != null ? String(profile.area_max) : "",
        notes: profile.notes ?? "",
        is_active: profile.is_active,
        duration: profile.expires_at ? "keep" : "0",


      });
    } else {
      setForm({ ...EMPTY, client_id: defaultClientId ?? "" });
    }
  }, [open, profile, defaultClientId]);

  const save = useMutation({
    mutationFn: async () => {
      if (!form.client_id) throw new Error("Bitte einen Kunden zuweisen");
      const payload = {
        client_id: form.client_id,
        role_type: "buyer" as const,
        listing_type: form.listing_type,
        preferred_cities: form.preferred_cities
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        preferred_property_types: form.preferred_property_types as SearchProfile["preferred_property_types"],
        budget_min: num(form.budget_min),
        budget_max: num(form.budget_max),
        rooms_min: num(form.rooms_min),
        area_min: num(form.area_min),
        area_max: num(form.area_max),
        notes: form.notes.trim() || null,
        is_active: form.is_active,

        expires_at:
          form.duration === "keep"
            ? (profile?.expires_at ?? null)
            : form.duration === "0"
              ? null
              : addMonths(Number(form.duration)),
      };

      if (profile) {
        const { error } = await supabase.from("client_search_profiles").update(payload).eq("id", profile.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("client_search_profiles").insert([payload]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(profile ? "Suchprofil aktualisiert" : "Suchprofil erstellt");
      qc.invalidateQueries({ queryKey: ["search_profiles"] });
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const toggleType = (t: string) =>
    setForm((f) => ({
      ...f,
      preferred_property_types: f.preferred_property_types.includes(t)
        ? f.preferred_property_types.filter((x) => x !== t)
        : [...f.preferred_property_types, t],
    }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{profile ? "Suchprofil bearbeiten" : "Suchprofil erstellen"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Kunde *</Label>
              <Select value={form.client_id} onValueChange={(v) => setForm((f) => ({ ...f, client_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Kunde auswählen" /></SelectTrigger>
                <SelectContent>
                  {clients.map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Vermarktungsart</Label>
              <Select
                value={form.listing_type}
                onValueChange={(v) => setForm((f) => ({ ...f, listing_type: v as "sale" | "rent" }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="sale">Kauf</SelectItem>
                  <SelectItem value="rent">Miete</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Wunschorte (mit Komma getrennt)</Label>
            <Input
              value={form.preferred_cities}
              onChange={(e) => setForm((f) => ({ ...f, preferred_cities: e.target.value }))}
              placeholder="Zürich, Winterthur, Zug"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Objekttypen</Label>
            <div className="flex flex-wrap gap-2">
              {PROPERTY_TYPES.map((t) => {
                const active = form.preferred_property_types.includes(t);
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => toggleType(t)}
                    className={`rounded-full px-3 py-1 text-xs font-medium ring-1 transition ${
                      active
                        ? "bg-primary text-primary-foreground ring-primary"
                        : "bg-muted/60 text-muted-foreground ring-border hover:bg-accent"
                    }`}
                  >
                    {propertyTypeLabels[t]}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Budget von (CHF)</Label>
              <Input inputMode="numeric" value={form.budget_min} onChange={(e) => setForm((f) => ({ ...f, budget_min: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Budget bis (CHF)</Label>
              <Input inputMode="numeric" value={form.budget_max} onChange={(e) => setForm((f) => ({ ...f, budget_max: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Zimmer ab</Label>
              <Input inputMode="decimal" value={form.rooms_min} onChange={(e) => setForm((f) => ({ ...f, rooms_min: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Fläche ab (m²)</Label>
                <Input inputMode="numeric" value={form.area_min} onChange={(e) => setForm((f) => ({ ...f, area_min: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Fläche bis (m²)</Label>
                <Input inputMode="numeric" value={form.area_max} onChange={(e) => setForm((f) => ({ ...f, area_max: e.target.value }))} />
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Notizen</Label>
            <Textarea
              rows={3}
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              placeholder="Besondere Wünsche, Ausstattung, Timing …"
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border bg-muted/40 px-3 py-2">
            <div>
              <p className="text-sm font-medium">Suchprofil aktiv</p>
              <p className="text-xs text-muted-foreground">Aktive Profile werden im Matching laufend abgeglichen.</p>
            </div>
            <Switch checked={form.is_active} onCheckedChange={(v) => setForm((f) => ({ ...f, is_active: v }))} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Abbrechen</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? "Speichern…" : "Speichern"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
