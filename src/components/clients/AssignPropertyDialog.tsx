import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Building2, Plus } from "lucide-react";
import { toast } from "sonner";

const ROLE_OPTIONS = [
  { value: "owner", label: "Eigentümer" },
  { value: "buyer", label: "Kaufinteressent" },
  { value: "former_owner", label: "Ehemaliger Eigentümer" },
  { value: "seller", label: "Verkäufer" },
  { value: "tenant", label: "Mieter" },
  { value: "landlord", label: "Vermieter" },
  { value: "investor", label: "Investor" },
  { value: "contact_person", label: "Kontaktperson" },
  { value: "general_contact", label: "Allgemeiner Kontakt" },
] as const;

type RoleValue = (typeof ROLE_OPTIONS)[number]["value"];

interface Props {
  clientId: string;
  trigger?: React.ReactNode;
}

export function AssignPropertyDialog({ clientId, trigger }: Props) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [roleType, setRoleType] = useState<RoleValue>("owner");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [startDate, setStartDate] = useState("");

  const { data: properties = [] } = useQuery({
    queryKey: ["assign_property_search", search],
    enabled: open,
    queryFn: async () => {
      let q = supabase
        .from("properties")
        .select("id, title, city, status")
        .order("created_at", { ascending: false })
        .limit(25);
      if (search) q = q.or(`title.ilike.%${search}%,city.ilike.%${search}%`);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const assign = useMutation({
    mutationFn: async () => {
      if (!selectedId) throw new Error("Bitte eine Immobilie auswählen");
      const { error } = await supabase.from("client_roles").insert({
        client_id: clientId,
        role_type: roleType,
        related_type: "property",
        related_id: selectedId,
        start_date: startDate || null,
        notes: notes.trim() || null,
        status: "active",
      });
      if (error) throw error;

      // Bei Eigentümer-Rolle zusätzlich property_ownerships pflegen
      if (roleType === "owner") {
        await supabase.from("property_ownerships").insert({
          client_id: clientId,
          property_id: selectedId,
          start_date: startDate || null,
        });
      }
    },
    onSuccess: () => {
      toast.success("Immobilie zugewiesen");
      qc.invalidateQueries({ queryKey: ["client_roles", clientId] });
      qc.invalidateQueries({ queryKey: ["client_ownerships", clientId] });
      qc.invalidateQueries({ queryKey: ["client_properties_assigned", clientId] });
      setOpen(false);
      setSelectedId(null);
      setNotes("");
      setStartDate("");
      setSearch("");
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Konnte nicht zuweisen"),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm">
            <Plus className="mr-1.5 h-4 w-4" />Immobilie zuweisen
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Immobilie zuweisen</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="mb-1 block text-xs text-muted-foreground">Rolle / Beziehung</Label>
            <Select value={roleType} onValueChange={(v) => setRoleType(v as RoleValue)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLE_OPTIONS.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="mb-1 block text-xs text-muted-foreground">
              Immobilie suchen (Titel oder Ort)
            </Label>
            <Input
              placeholder="z. B. Wohnung Zürich…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="max-h-56 overflow-auto rounded-lg border">
            {properties.length === 0 ? (
              <p className="p-3 text-sm text-muted-foreground">Keine Treffer.</p>
            ) : (
              properties.map((p: any) => (
                <button
                  key={p.id}
                  onClick={() => setSelectedId(p.id)}
                  className={`flex w-full items-center justify-between border-b p-2.5 text-left text-sm last:border-0 hover:bg-muted/50 ${
                    selectedId === p.id ? "bg-primary/10" : ""
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                    {p.title}
                  </span>
                  <span className="text-xs text-muted-foreground">{p.city ?? ""}</span>
                </button>
              ))
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label className="mb-1 block text-xs text-muted-foreground">Startdatum (optional)</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
          </div>

          <div>
            <Label className="mb-1 block text-xs text-muted-foreground">Notiz (optional)</Label>
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Abbrechen
          </Button>
          <Button onClick={() => assign.mutate()} disabled={!selectedId || assign.isPending}>
            Zuweisen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
