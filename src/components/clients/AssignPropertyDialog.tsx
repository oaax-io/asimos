import { useEffect, useState } from "react";
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
import { Building2, Plus, AlertTriangle, Info } from "lucide-react";
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
  const [roleType, setRoleType] = useState<RoleValue>("buyer");
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

  // Bestehende Zuweisungen + Eigentümer der gewählten Immobilie
  const { data: existing } = useQuery({
    queryKey: ["assign_property_existing", selectedId],
    enabled: !!selectedId,
    queryFn: async () => {
      const [{ data: roles }, { data: own }] = await Promise.all([
        supabase
          .from("client_roles")
          .select("id, client_id, role_type, clients:clients!client_roles_client_id_fkey(full_name)")
          .eq("related_type", "property")
          .eq("related_id", selectedId!),
        supabase
          .from("property_ownerships")
          .select("id, client_id, clients:clients!property_ownerships_client_id_fkey(full_name)")
          .eq("property_id", selectedId!)
          .is("end_date", null),
      ]);
      return { roles: roles ?? [], ownerships: own ?? [] };
    },
  });

  const ownerInRoles = (existing?.roles ?? []).filter((r: any) => r.role_type === "owner");
  const ownerInOwnerships = existing?.ownerships ?? [];
  const allOwners = [
    ...ownerInRoles.map((r: any) => ({ client_id: r.client_id, name: r.clients?.full_name })),
    ...ownerInOwnerships.map((o: any) => ({ client_id: o.client_id, name: o.clients?.full_name })),
  ];
  const uniqueOwners = Array.from(new Map(allOwners.map((o) => [o.client_id, o])).values());
  const existingOwnerOther = uniqueOwners.find((o) => o.client_id !== clientId);
  const duplicateExact = (existing?.roles ?? []).some(
    (r: any) => r.client_id === clientId && r.role_type === roleType,
  );
  const otherAssignments = (existing?.roles ?? []).filter(
    (r: any) => r.client_id !== clientId,
  );

  const ownerBlocked = roleType === "owner" && !!existingOwnerOther;

  const assign = useMutation({
    mutationFn: async () => {
      if (!selectedId) throw new Error("Bitte eine Immobilie auswählen");
      if (ownerBlocked) {
        throw new Error(
          `Diese Immobilie hat bereits einen Eigentümer (${existingOwnerOther?.name ?? "unbekannt"}).`,
        );
      }
      if (duplicateExact) {
        throw new Error("Dieser Kunde ist mit dieser Rolle bereits zugewiesen.");
      }
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
    },
    onSuccess: () => {
      toast.success("Immobilie zugewiesen");
      qc.invalidateQueries({ queryKey: ["client_roles", clientId] });
      qc.invalidateQueries({ queryKey: ["client_assigned_properties", clientId] });
      qc.invalidateQueries({ queryKey: ["client_overview_props", clientId] });
      setOpen(false);
      setSelectedId(null);
      setNotes("");
      setStartDate("");
      setSearch("");
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Konnte nicht zuweisen"),
  });

  useEffect(() => {
    if (!open) setSelectedId(null);
  }, [open]);

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

          {selectedId && ownerBlocked && (
            <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p className="font-medium">Eigentümer-Rolle blockiert</p>
                <p>
                  {existingOwnerOther?.name ?? "Ein anderer Kunde"} ist bereits als Eigentümer
                  eingetragen. Pro Immobilie ist nur ein Eigentümer möglich.
                </p>
              </div>
            </div>
          )}

          {selectedId && !ownerBlocked && duplicateExact && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-400">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <p>Dieser Kunde ist mit der gewählten Rolle bereits zugewiesen.</p>
            </div>
          )}

          {selectedId && !ownerBlocked && !duplicateExact && otherAssignments.length > 0 && (
            <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-700 dark:text-amber-400">
              <Info className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p className="font-medium">Hinweis: Diese Immobilie ist bereits zugewiesen</p>
                <ul className="mt-1 space-y-0.5">
                  {otherAssignments.slice(0, 5).map((r: any) => (
                    <li key={r.id}>
                      • {r.clients?.full_name ?? "Kunde"} —{" "}
                      {ROLE_OPTIONS.find((o) => o.value === r.role_type)?.label ?? r.role_type}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

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
          <Button
            onClick={() => assign.mutate()}
            disabled={!selectedId || assign.isPending || ownerBlocked || duplicateExact}
          >
            Zuweisen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
