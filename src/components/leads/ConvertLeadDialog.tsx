import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

type Lead = Database["public"]["Tables"]["leads"]["Row"];
type ClientType = Database["public"]["Enums"]["client_type"];
type RoleType = Database["public"]["Enums"]["client_role_type"];

interface RoleOption {
  value: RoleType;
  label: string;
  description: string;
  clientType: ClientType;
}

const ROLE_OPTIONS: RoleOption[] = [
  { value: "buyer", label: "Käufer / Suchkunde", description: "Sucht eine Immobilie zum Kauf", clientType: "buyer" },
  { value: "seller", label: "Verkäufer / Eigentümer", description: "Möchte eine Immobilie verkaufen", clientType: "seller" },
  { value: "tenant", label: "Mieter", description: "Sucht eine Mietwohnung", clientType: "tenant" },
  { value: "landlord", label: "Vermieter", description: "Vermietet eine Immobilie", clientType: "landlord" },
  { value: "financing_applicant", label: "Finanzierungskunde", description: "Benötigt eine Finanzierung", clientType: "buyer" },
  { value: "general_contact", label: "Allgemeiner Kontakt", description: "Sonstiger Kontakt ohne feste Rolle", clientType: "other" },
];

interface Props {
  lead: Lead;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConverted: (clientId: string) => void;
}

export function ConvertLeadDialog({ lead, open, onOpenChange, onConverted }: Props) {
  const { user } = useAuth();
  const [selectedRole, setSelectedRole] = useState<RoleType>(() => {
    // Vorbelegung anhand interest_type
    const map: Record<string, RoleType> = {
      kauf: "buyer", buy: "buyer", kaufen: "buyer",
      miete: "tenant", mieten: "tenant", rent: "tenant",
      verkauf: "seller", verkaufen: "seller", sell: "seller",
      vermietung: "landlord", vermieten: "landlord",
      finanzierung: "financing_applicant", financing: "financing_applicant",
    };
    return map[(lead.interest_type ?? "").toLowerCase().trim()] ?? "buyer";
  });

  const convert = useMutation({
    mutationFn: async () => {
      const opt = ROLE_OPTIONS.find((o) => o.value === selectedRole)!;

      const noteParts: string[] = [];
      if (lead.notes) noteParts.push(lead.notes);
      if (lead.source) noteParts.push(`Quelle: ${lead.source}`);
      const mergedNotes = noteParts.join("\n\n") || null;

      const { data: created, error } = await supabase
        .from("clients")
        .insert({
          owner_id: user!.id,
          assigned_to: lead.assigned_to,
          full_name: lead.full_name,
          email: lead.email,
          phone: lead.phone,
          notes: mergedNotes,
          client_type: opt.clientType,
          budget_min: lead.budget_min ?? null,
          budget_max: lead.budget_max ?? null,
          preferred_cities: lead.preferred_location ? [lead.preferred_location] : null,
        })
        .select("id")
        .single();
      if (error) throw error;

      // client_roles: kontextlose Rolle (kein related)
      const { error: roleErr } = await supabase.from("client_roles").insert({
        client_id: created.id,
        role_type: selectedRole,
        status: "active",
      });
      if (roleErr) throw roleErr;

      await supabase
        .from("leads")
        .update({ status: "converted", converted_client_id: created.id })
        .eq("id", lead.id);

      await supabase.from("activity_logs").insert({
        actor_id: user?.id ?? null,
        action: "Zu Kunde konvertiert",
        related_type: "lead",
        related_id: lead.id,
        metadata: { client_id: created.id, role_type: selectedRole },
      });

      return created;
    },
    onSuccess: (created) => {
      toast.success("Zu Kunde konvertiert");
      onOpenChange(false);
      onConverted(created.id);
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Konvertierung fehlgeschlagen"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Lead zu Kunde konvertieren</DialogTitle>
          <DialogDescription>
            Welche Rolle soll {lead.full_name} als Kunde erhalten? Die Rolle kann später erweitert werden.
          </DialogDescription>
        </DialogHeader>

        <RadioGroup
          value={selectedRole}
          onValueChange={(v) => setSelectedRole(v as RoleType)}
          className="gap-2"
        >
          {ROLE_OPTIONS.map((opt) => (
            <Label
              key={opt.value}
              htmlFor={`role-${opt.value}`}
              className="flex cursor-pointer items-start gap-3 rounded-xl border p-3 hover:bg-muted/50 has-[:checked]:border-primary has-[:checked]:bg-primary/5"
            >
              <RadioGroupItem value={opt.value} id={`role-${opt.value}`} className="mt-0.5" />
              <div className="flex-1">
                <div className="font-medium">{opt.label}</div>
                <div className="text-xs text-muted-foreground">{opt.description}</div>
              </div>
            </Label>
          ))}
        </RadioGroup>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Abbrechen
          </Button>
          <Button onClick={() => convert.mutate()} disabled={convert.isPending}>
            Konvertieren
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
