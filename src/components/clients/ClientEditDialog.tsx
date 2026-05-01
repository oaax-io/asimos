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
      <DialogContent className="max-w-4xl p-5">
        <DialogHeader className="space-y-1">
          <DialogTitle>Stammdaten bearbeiten</DialogTitle>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-xs">
              {originalEntity === "company" ? "Unternehmen" : "Privatperson"}
            </Badge>
            {entityChanged && (
              <Badge variant="destructive" className="text-xs">
                → {form.entity_type === "company" ? "Unternehmen" : "Privatperson"}
              </Badge>
            )}
            {!advanced ? (
              <Button
                variant="ghost"
                size="sm"
                className="ml-auto h-6 px-2 text-xs"
                onClick={() => setAdvanced(true)}
              >
                Entität ändern
              </Button>
            ) : (
              <div className="ml-auto flex gap-1">
                <Button
                  variant={form.entity_type === "person" ? "default" : "outline"}
                  size="sm"
                  className="h-6 px-2 text-xs"
                  onClick={() => setForm({ ...form, entity_type: "person" })}
                >
                  Privat
                </Button>
                <Button
                  variant={form.entity_type === "company" ? "default" : "outline"}
                  size="sm"
                  className="h-6 px-2 text-xs"
                  onClick={() => setForm({ ...form, entity_type: "company" })}
                >
                  Firma
                </Button>
              </div>
            )}
          </div>
        </DialogHeader>

        {advanced && entityChanged && (
          <Alert variant="destructive" className="py-2">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="text-xs">
              Die Entität zu ändern kann bestehende Rollen und Verknüpfungen beeinflussen.
            </AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-2 gap-x-4 gap-y-3">
          {/* Linke Spalte: Namensfelder + Notizen */}
          <div className="space-y-3">
            {form.entity_type === "company" ? (
              <>
                <Field label="Firmenname">
                  <Input
                    value={form.company_name}
                    onChange={(e) => setForm({ ...form, company_name: e.target.value })}
                  />
                </Field>
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Kontakt Vorname">
                    <Input
                      value={form.contact_first_name}
                      onChange={(e) => setForm({ ...form, contact_first_name: e.target.value })}
                    />
                  </Field>
                  <Field label="Kontakt Nachname">
                    <Input
                      value={form.contact_last_name}
                      onChange={(e) => setForm({ ...form, contact_last_name: e.target.value })}
                    />
                  </Field>
                </div>
                <Field label="Anzeigename (optional)">
                  <Input
                    value={form.full_name}
                    onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                    placeholder="aus Firmenname"
                  />
                </Field>
              </>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Vorname">
                    <Input
                      value={form.contact_first_name}
                      onChange={(e) => setForm({ ...form, contact_first_name: e.target.value })}
                    />
                  </Field>
                  <Field label="Nachname">
                    <Input
                      value={form.contact_last_name}
                      onChange={(e) => setForm({ ...form, contact_last_name: e.target.value })}
                    />
                  </Field>
                </div>
                <Field label="Anzeigename">
                  <Input
                    value={form.full_name}
                    onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                    placeholder="aus Vor-/Nachname"
                  />
                </Field>
              </>
            )}

            <Field label="Notizen">
              <Textarea
                rows={3}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </Field>
          </div>

          {/* Rechte Spalte: Kontakt + Adresse */}
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <Field label="E-Mail">
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </Field>
              <Field label="Telefon">
                <Input
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </Field>
            </div>
            <Field label="Adresse">
              <Input
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
              />
            </Field>
            <div className="grid grid-cols-3 gap-2">
              <Field label="PLZ">
                <Input
                  value={form.postal_code}
                  onChange={(e) => setForm({ ...form, postal_code: e.target.value })}
                />
              </Field>
              <Field label="Ort">
                <Input
                  value={form.city}
                  onChange={(e) => setForm({ ...form, city: e.target.value })}
                />
              </Field>
              <Field label="Land">
                <Input
                  value={form.country}
                  onChange={(e) => setForm({ ...form, country: e.target.value })}
                />
              </Field>
            </div>
            <div className="flex items-center gap-2 rounded-lg border p-2">
              <Checkbox
                id="is_archived"
                checked={form.is_archived}
                onCheckedChange={(v) => setForm({ ...form, is_archived: !!v })}
              />
              <Label htmlFor="is_archived" className="cursor-pointer text-sm">
                Kunde archivieren
              </Label>
            </div>
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          Rollen, Suchprofile, Eigentum, Finanzierungen und Selbstauskunft werden in den jeweiligen Tabs gepflegt.
        </p>

        <DialogFooter className="mt-1">
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}
