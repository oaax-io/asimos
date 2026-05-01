import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Pencil, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";

type EntityType = "person" | "company";

interface Props {
  client: any;
  onSaved: () => void;
  trigger?: React.ReactNode;
}

interface FormState {
  entity_type: EntityType;
  full_name: string;
  company_name: string;
  contact_first_name: string;
  contact_last_name: string;
  email: string;
  phone: string;
  address: string;
  postal_code: string;
  city: string;
  country: string;
  notes: string;
  is_archived: boolean;
}

function buildInitial(client: any): FormState {
  return {
    entity_type: (client.entity_type ?? "person") as EntityType,
    full_name: client.full_name ?? "",
    company_name: client.company_name ?? "",
    contact_first_name: client.contact_first_name ?? "",
    contact_last_name: client.contact_last_name ?? "",
    email: client.email ?? "",
    phone: client.phone ?? "",
    address: client.address ?? "",
    postal_code: client.postal_code ?? "",
    city: client.city ?? "",
    country: client.country ?? "CH",
    notes: client.notes ?? "",
    is_archived: !!client.is_archived,
  };
}

export function ClientEditDialog({ client, onSaved, trigger }: Props) {
  const [open, setOpen] = useState(false);
  const [advanced, setAdvanced] = useState(false);
  const [form, setForm] = useState<FormState>(buildInitial(client));

  useEffect(() => {
    if (open) {
      setForm(buildInitial(client));
      setAdvanced(false);
    }
  }, [open, client]);

  const originalEntity = (client.entity_type ?? "person") as EntityType;
  const entityChanged = form.entity_type !== originalEntity;

  const save = useMutation({
    mutationFn: async () => {
      // Validierung
      if (form.entity_type === "person") {
        const hasName =
          form.full_name.trim().length > 0 ||
          (form.contact_first_name.trim().length > 0 && form.contact_last_name.trim().length > 0);
        if (!hasName) throw new Error("Name oder Vor-/Nachname erforderlich");
      } else {
        if (!form.company_name.trim() && !form.full_name.trim()) {
          throw new Error("Firmenname erforderlich");
        }
      }

      // full_name ableiten falls leer
      let fullName = form.full_name.trim();
      if (!fullName) {
        if (form.entity_type === "company") {
          fullName = form.company_name.trim();
        } else {
          fullName = `${form.contact_first_name} ${form.contact_last_name}`.trim();
        }
      }

      const payload = {
        entity_type: form.entity_type,
        full_name: fullName,
        company_name: form.entity_type === "company" ? form.company_name.trim() || null : null,
        contact_first_name: form.contact_first_name.trim() || null,
        contact_last_name: form.contact_last_name.trim() || null,
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        address: form.address.trim() || null,
        postal_code: form.postal_code.trim() || null,
        city: form.city.trim() || null,
        country: form.country.trim() || null,
        notes: form.notes.trim() || null,
        is_archived: form.is_archived,
        archived_at: form.is_archived ? client.archived_at ?? new Date().toISOString() : null,
      };

      const { error } = await supabase.from("clients").update(payload).eq("id", client.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Stammdaten gespeichert");
      setOpen(false);
      onSaved();
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger ? (
        <span onClick={() => setOpen(true)}>{trigger}</span>
      ) : (
        <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
          <Pencil className="mr-1.5 h-4 w-4" />Stammdaten bearbeiten
        </Button>
      )}
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Stammdaten bearbeiten</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Entität */}
          <div className="rounded-xl border bg-muted/30 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">Entität</p>
                <div className="mt-1 flex items-center gap-2">
                  <Badge variant="secondary">
                    {originalEntity === "company" ? "Unternehmen" : "Privatperson"}
                  </Badge>
                  {entityChanged && (
                    <Badge variant="destructive">
                      Geändert zu {form.entity_type === "company" ? "Unternehmen" : "Privatperson"}
                    </Badge>
                  )}
                </div>
              </div>
              {!advanced ? (
                <Button variant="outline" size="sm" onClick={() => setAdvanced(true)}>
                  Erweitert
                </Button>
              ) : (
                <div className="flex gap-2">
                  <Button
                    variant={form.entity_type === "person" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setForm({ ...form, entity_type: "person" })}
                  >
                    Privatperson
                  </Button>
                  <Button
                    variant={form.entity_type === "company" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setForm({ ...form, entity_type: "company" })}
                  >
                    Unternehmen
                  </Button>
                </div>
              )}
            </div>
            {advanced && entityChanged && (
              <Alert variant="destructive" className="mt-3">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Die Entität zu ändern kann bestehende Rollen und Verknüpfungen beeinflussen.
                </AlertDescription>
              </Alert>
            )}
          </div>

          {/* Namensfelder */}
          {form.entity_type === "company" ? (
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label>Firmenname</Label>
                <Input
                  value={form.company_name}
                  onChange={(e) => setForm({ ...form, company_name: e.target.value })}
                />
              </div>
              <div>
                <Label>Kontakt Vorname</Label>
                <Input
                  value={form.contact_first_name}
                  onChange={(e) => setForm({ ...form, contact_first_name: e.target.value })}
                />
              </div>
              <div>
                <Label>Kontakt Nachname</Label>
                <Input
                  value={form.contact_last_name}
                  onChange={(e) => setForm({ ...form, contact_last_name: e.target.value })}
                />
              </div>
              <div className="col-span-2">
                <Label>Anzeigename (optional)</Label>
                <Input
                  value={form.full_name}
                  onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                  placeholder="Wird automatisch aus Firmenname abgeleitet"
                />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Vorname</Label>
                <Input
                  value={form.contact_first_name}
                  onChange={(e) => setForm({ ...form, contact_first_name: e.target.value })}
                />
              </div>
              <div>
                <Label>Nachname</Label>
                <Input
                  value={form.contact_last_name}
                  onChange={(e) => setForm({ ...form, contact_last_name: e.target.value })}
                />
              </div>
              <div className="col-span-2">
                <Label>Anzeigename</Label>
                <Input
                  value={form.full_name}
                  onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                  placeholder="Wird automatisch aus Vor-/Nachname abgeleitet"
                />
              </div>
            </div>
          )}

          {/* Kontakt */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>E-Mail</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
            <div>
              <Label>Telefon</Label>
              <Input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
              />
            </div>
          </div>

          {/* Adresse */}
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label>Adresse</Label>
              <Input
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
              />
            </div>
            <div>
              <Label>PLZ</Label>
              <Input
                value={form.postal_code}
                onChange={(e) => setForm({ ...form, postal_code: e.target.value })}
              />
            </div>
            <div>
              <Label>Ort</Label>
              <Input
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
              />
            </div>
            <div>
              <Label>Land</Label>
              <Input
                value={form.country}
                onChange={(e) => setForm({ ...form, country: e.target.value })}
              />
            </div>
          </div>

          <div>
            <Label>Notizen</Label>
            <Textarea
              rows={3}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </div>

          <div className="flex items-center gap-2 rounded-lg border p-3">
            <Checkbox
              id="is_archived"
              checked={form.is_archived}
              onCheckedChange={(v) => setForm({ ...form, is_archived: !!v })}
            />
            <Label htmlFor="is_archived" className="cursor-pointer">
              Kunde archivieren
            </Label>
          </div>

          <Alert>
            <AlertDescription className="text-xs">
              Rollen, Suchprofile, Eigentümerverknüpfungen, Finanzierungen und Selbstauskunft
              werden hier nicht verändert. Diese werden in den jeweiligen Tabs gepflegt.
            </AlertDescription>
          </Alert>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Abbrechen
          </Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            Speichern
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
