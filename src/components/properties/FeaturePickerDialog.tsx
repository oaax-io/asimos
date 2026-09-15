import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { featureIcon } from "./feature-icons";
import { Plus, Search } from "lucide-react";

export type FeatureOption = { key: string; label_de: string };

export function useFeatureOptions() {
  return useQuery({
    queryKey: ["property-feature-options"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("property_feature_options")
        .select("key,label_de,sort_order,is_active")
        .eq("is_active", true)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Array<FeatureOption & { sort_order: number }>;
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function FeaturePickerDialog({
  open,
  onOpenChange,
  selected,
  onSave,
  hiddenLabels = [],
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  selected: string[];
  onSave: (labels: string[]) => void;
  hiddenLabels?: string[];
}) {
  const { data: options = [], isLoading } = useFeatureOptions();
  const [draft, setDraft] = useState<string[]>(selected);
  const [search, setSearch] = useState("");
  const [custom, setCustom] = useState("");

  // Beim Öffnen aktuellen Stand übernehmen
  const [lastOpen, setLastOpen] = useState(open);
  if (open !== lastOpen) {
    setLastOpen(open);
    if (open) {
      setDraft(selected);
      setSearch("");
      setCustom("");
    }
  }

  const hidden = useMemo(() => new Set(hiddenLabels.map((l) => l.toLowerCase())), [hiddenLabels]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return options.filter((o) => !hidden.has(o.label_de.toLowerCase()) && (!q || o.label_de.toLowerCase().includes(q)));
  }, [options, hidden, search]);

  const extraCustom = useMemo(() => {
    const known = new Set(options.map((o) => o.label_de.toLowerCase()));
    return draft.filter((l) => !known.has(l.toLowerCase()));
  }, [draft, options]);

  const toggle = (label: string) =>
    setDraft((prev) => (prev.some((l) => l.toLowerCase() === label.toLowerCase())
      ? prev.filter((l) => l.toLowerCase() !== label.toLowerCase())
      : [...prev, label]));

  const addCustom = () => {
    const v = custom.trim();
    if (!v) return;
    if (!draft.some((l) => l.toLowerCase() === v.toLowerCase())) setDraft((p) => [...p, v]);
    setCustom("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] max-w-3xl flex-col gap-4">
        <DialogHeader>
          <DialogTitle>Weitere Ausstattungen</DialogTitle>
          <DialogDescription>Mehrere Merkmale auswählen. Eigene Einträge sind ebenfalls möglich.</DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Ausstattung suchen …" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>

        <div className="-mx-1 flex-1 overflow-y-auto px-1">
          {isLoading ? (
            <p className="p-4 text-sm text-muted-foreground">Wird geladen …</p>
          ) : visible.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">Keine Treffer.</p>
          ) : (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {visible.map((o) => {
                const Icon = featureIcon(o.key, o.label_de);
                const active = draft.some((l) => l.toLowerCase() === o.label_de.toLowerCase());
                return (
                  <label
                    key={o.key}
                    className={cn(
                      "flex cursor-pointer items-center gap-2 rounded-lg border p-2.5 text-sm transition-colors hover:bg-accent",
                      active && "border-primary bg-primary/5",
                    )}
                  >
                    <Checkbox checked={active} onCheckedChange={() => toggle(o.label_de)} />
                    <Icon className={cn("h-4 w-4 shrink-0", active ? "text-primary" : "text-muted-foreground")} />
                    <span className="truncate">{o.label_de}</span>
                  </label>
                );
              })}
            </div>
          )}

          {extraCustom.length > 0 && (
            <div className="mt-4">
              <p className="mb-2 text-xs font-medium text-muted-foreground">Eigene Einträge</p>
              <div className="flex flex-wrap gap-2">
                {extraCustom.map((l) => (
                  <Badge key={l} variant="secondary" className="cursor-pointer" onClick={() => toggle(l)}>
                    {l} ×
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-2">
          <Input
            placeholder="Eigene Ausstattung hinzufügen"
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addCustom();
              }
            }}
          />
          <Button type="button" variant="outline" onClick={addCustom}><Plus className="mr-1 h-4 w-4" />Hinzufügen</Button>
        </div>

        <DialogFooter className="flex-row items-center justify-between sm:justify-between">
          <span className="text-sm text-muted-foreground">{draft.length} ausgewählt</span>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Abbrechen</Button>
            <Button type="button" onClick={() => { onSave(draft); onOpenChange(false); }}>Übernehmen</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
