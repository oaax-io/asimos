import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowRightLeft,
  ExternalLink,
  History,
  Plus,
  User as UserIcon,
} from "lucide-react";
import { toast } from "sonner";
import { formatDate, formatCurrency } from "@/lib/format";

type Ownership = {
  id: string;
  property_id: string;
  client_id: string;
  ownership_type: "owner" | "co_owner" | "former_owner";
  share_percent: number | null;
  start_date: string | null;
  end_date: string | null;
  acquisition_type: string | null;
  acquisition_price: number | null;
  sale_price: number | null;
  source: string | null;
  notes: string | null;
  is_primary_contact: boolean;
  created_at: string;
  client?: { id: string; full_name: string; email: string | null; phone: string | null } | null;
};

const sourceLabels: Record<string, string> = {
  manual: "Manuell",
  mandate: "Mandat",
  sale: "Verkauf",
};

interface Props {
  propertyId: string;
  legacyOwnerClientId?: string | null;
}

export function PropertyOwnersTab({ propertyId, legacyOwnerClientId }: Props) {
  const qc = useQueryClient();
  const [transferOpen, setTransferOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);

  const { data: ownerships = [], isLoading } = useQuery({
    queryKey: ["property_ownerships", propertyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("property_ownerships")
        .select(
          "*, client:clients!property_ownerships_client_id_fkey(id, full_name, email, phone)",
        )
        .eq("property_id", propertyId)
        .order("start_date", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Ownership[];
    },
  });

  const current = useMemo(
    () => ownerships.filter((o) => !o.end_date),
    [ownerships],
  );
  const history = useMemo(
    () => ownerships.filter((o) => o.end_date),
    [ownerships],
  );

  if (isLoading) {
    return <div className="p-6 text-sm text-muted-foreground">Lädt…</div>;
  }

  const hasNoData = ownerships.length === 0;

  return (
    <div className="space-y-6">
      {/* Aktueller Eigentümer */}
      <Card>
        <CardContent className="space-y-4 p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <UserIcon className="h-4 w-4 text-muted-foreground" />
              <h3 className="font-display text-lg font-semibold">
                Aktuelle Eigentümer
              </h3>
            </div>
            <div className="flex gap-2">
              {current.length > 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setTransferOpen(true)}
                >
                  <ArrowRightLeft className="mr-1.5 h-4 w-4" />
                  Eigentümer wechseln
                </Button>
              )}
              <Button size="sm" onClick={() => setAddOpen(true)}>
                <Plus className="mr-1.5 h-4 w-4" />
                {current.length === 0 ? "Eigentümer setzen" : "Miteigentümer hinzufügen"}
              </Button>
            </div>
          </div>

          {current.length === 0 ? (
            <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
              {hasNoData
                ? "Noch keine Eigentümer-Einträge vorhanden."
                : "Aktuell kein aktiver Eigentümer hinterlegt."}
              {legacyOwnerClientId && (
                <p className="mt-2 text-xs">
                  Hinweis: Es ist ein Legacy-Eigentümer am Objekt verknüpft.
                  Setze ihn hier als ersten Eintrag, um die Historie zu starten.
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {current.map((o) => (
                <OwnershipRow key={o.id} ownership={o} highlight />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Historie */}
      {history.length > 0 && (
        <Card>
          <CardContent className="space-y-4 p-6">
            <div className="flex items-center gap-2">
              <History className="h-4 w-4 text-muted-foreground" />
              <h3 className="font-display text-lg font-semibold">Historie</h3>
            </div>
            <ol className="relative space-y-4 border-l pl-6">
              {history.map((o) => (
                <li key={o.id} className="relative">
                  <span className="absolute -left-[31px] mt-1.5 inline-block h-3 w-3 rounded-full border-2 border-background bg-muted-foreground" />
                  <OwnershipRow ownership={o} />
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      )}

      <AddOwnerDialog
        propertyId={propertyId}
        open={addOpen}
        onOpenChange={setAddOpen}
        onSaved={() => qc.invalidateQueries({ queryKey: ["property_ownerships", propertyId] })}
        existing={current}
      />
      <TransferOwnerDialog
        propertyId={propertyId}
        open={transferOpen}
        onOpenChange={setTransferOpen}
        currentOwners={current}
        onSaved={() => qc.invalidateQueries({ queryKey: ["property_ownerships", propertyId] })}
      />
    </div>
  );
}

function OwnershipRow({ ownership, highlight }: { ownership: Ownership; highlight?: boolean }) {
  const typeLabel =
    ownership.ownership_type === "owner"
      ? "Eigentümer"
      : ownership.ownership_type === "co_owner"
        ? "Miteigentümer"
        : "Ehemalig";

  return (
    <div
      className={`rounded-xl border p-4 ${highlight ? "border-primary/40 bg-primary/5" : ""}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={highlight ? "default" : "secondary"}>{typeLabel}</Badge>
            {ownership.share_percent != null && (
              <Badge variant="outline">{ownership.share_percent}%</Badge>
            )}
            {ownership.source && ownership.source !== "manual" && (
              <Badge variant="outline">{sourceLabels[ownership.source] ?? ownership.source}</Badge>
            )}
            {ownership.is_primary_contact && (
              <Badge variant="outline">Hauptansprechpartner</Badge>
            )}
          </div>
          {ownership.client ? (
            <Link
              to="/clients/$id"
              params={{ id: ownership.client.id }}
              className="mt-1.5 block font-medium hover:text-primary"
            >
              {ownership.client.full_name}
            </Link>
          ) : (
            <p className="mt-1.5 font-medium text-muted-foreground">Unbekannt</p>
          )}
          <p className="text-xs text-muted-foreground">
            {ownership.client?.email || "—"}
            {ownership.client?.phone ? ` · ${ownership.client.phone}` : ""}
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            {ownership.start_date ? `Seit ${formatDate(ownership.start_date)}` : "Startdatum —"}
            {ownership.end_date ? ` · bis ${formatDate(ownership.end_date)}` : ""}
            {ownership.sale_price != null
              ? ` · Verkaufspreis ${formatCurrency(ownership.sale_price)}`
              : ""}
            {ownership.acquisition_price != null
              ? ` · Erwerb ${formatCurrency(ownership.acquisition_price)}`
              : ""}
          </p>
          {ownership.notes && (
            <p className="mt-2 whitespace-pre-wrap text-xs text-muted-foreground">
              {ownership.notes}
            </p>
          )}
        </div>
        {ownership.client && (
          <Button asChild size="sm" variant="ghost">
            <Link to="/clients/$id" params={{ id: ownership.client.id }}>
              <ExternalLink className="h-4 w-4" />
            </Link>
          </Button>
        )}
      </div>
    </div>
  );
}

/* ---------------- Add Owner Dialog ---------------- */
function AddOwnerDialog({
  propertyId,
  open,
  onOpenChange,
  onSaved,
  existing,
}: {
  propertyId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved: () => void;
  existing: Ownership[];
}) {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [clientId, setClientId] = useState<string | null>(null);
  const [ownershipType, setOwnershipType] = useState<"owner" | "co_owner">(
    existing.length === 0 ? "owner" : "co_owner",
  );
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [acquisitionType, setAcquisitionType] = useState("");
  const [acquisitionPrice, setAcquisitionPrice] = useState("");
  const [share, setShare] = useState("");
  const [notes, setNotes] = useState("");

  const { data: candidates = [] } = useQuery({
    queryKey: ["client_candidates", search, open],
    enabled: open,
    queryFn: async () => {
      let q = supabase
        .from("clients")
        .select("id, full_name, email")
        .order("full_name")
        .limit(20);
      if (search) q = q.ilike("full_name", `%${search}%`);
      const { data } = await q;
      return data ?? [];
    },
  });

  const reset = () => {
    setSearch("");
    setClientId(null);
    setAcquisitionType("");
    setAcquisitionPrice("");
    setShare("");
    setNotes("");
  };

  const save = useMutation({
    mutationFn: async () => {
      if (!clientId) throw new Error("Bitte einen Kunden auswählen");
      const { error } = await supabase.from("property_ownerships").insert({
        property_id: propertyId,
        client_id: clientId,
        ownership_type: ownershipType,
        start_date: startDate || null,
        acquisition_type: acquisitionType.trim() || null,
        acquisition_price: acquisitionPrice ? Number(acquisitionPrice) : null,
        share_percent: share ? Number(share) : null,
        notes: notes.trim() || null,
        source: "manual",
        is_primary_contact: existing.length === 0,
      });
      if (error) throw error;

      await supabase.from("client_roles").insert({
        client_id: clientId,
        role_type: "owner",
        related_type: "property",
        related_id: propertyId,
        status: "active",
        start_date: startDate || null,
      });

      await supabase.from("activity_logs").insert({
        actor_id: user?.id ?? null,
        action: existing.length === 0 ? "Eigentümer gesetzt" : "Miteigentümer hinzugefügt",
        related_type: "property",
        related_id: propertyId,
        metadata: { client_id: clientId, ownership_type: ownershipType },
      });
    },
    onSuccess: () => {
      toast.success("Eigentümer gespeichert");
      onOpenChange(false);
      reset();
      onSaved();
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Konnte nicht speichern"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {existing.length === 0 ? "Eigentümer setzen" : "Miteigentümer hinzufügen"}
          </DialogTitle>
          <DialogDescription>
            Verknüpfe einen bestehenden Kunden als Eigentümer dieser Immobilie.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="mb-1 block text-xs text-muted-foreground">Kunde suchen</Label>
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Nach Name suchen…"
            />
          </div>
          <div className="max-h-44 overflow-auto rounded-lg border">
            {candidates.length === 0 ? (
              <p className="p-3 text-sm text-muted-foreground">Keine Treffer.</p>
            ) : (
              candidates.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setClientId(c.id)}
                  className={`flex w-full items-center justify-between border-b p-2.5 text-left text-sm last:border-0 hover:bg-muted/50 ${
                    clientId === c.id ? "bg-primary/10" : ""
                  }`}
                >
                  <span>{c.full_name}</span>
                  <span className="text-xs text-muted-foreground">{c.email ?? ""}</span>
                </button>
              ))
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="mb-1 block text-xs text-muted-foreground">Rolle</Label>
              <Select
                value={ownershipType}
                onValueChange={(v) => setOwnershipType(v as "owner" | "co_owner")}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="owner">Eigentümer</SelectItem>
                  <SelectItem value="co_owner">Miteigentümer</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="mb-1 block text-xs text-muted-foreground">Seit</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div>
              <Label className="mb-1 block text-xs text-muted-foreground">Anteil (%)</Label>
              <Input
                type="number"
                value={share}
                onChange={(e) => setShare(e.target.value)}
                placeholder="z. B. 50"
              />
            </div>
            <div>
              <Label className="mb-1 block text-xs text-muted-foreground">Erwerbsart</Label>
              <Input
                value={acquisitionType}
                onChange={(e) => setAcquisitionType(e.target.value)}
                placeholder="Kauf / Erbe / Schenkung"
              />
            </div>
            <div className="col-span-2">
              <Label className="mb-1 block text-xs text-muted-foreground">Erwerbspreis (CHF)</Label>
              <Input
                type="number"
                value={acquisitionPrice}
                onChange={(e) => setAcquisitionPrice(e.target.value)}
              />
            </div>
            <div className="col-span-2">
              <Label className="mb-1 block text-xs text-muted-foreground">Notizen</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Abbrechen</Button>
          <Button onClick={() => save.mutate()} disabled={!clientId || save.isPending}>
            Speichern
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------- Transfer Owner Dialog ---------------- */
function TransferOwnerDialog({
  propertyId,
  open,
  onOpenChange,
  currentOwners,
  onSaved,
}: {
  propertyId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  currentOwners: Ownership[];
  onSaved: () => void;
}) {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [newClientId, setNewClientId] = useState<string | null>(null);
  const [transferDate, setTransferDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [salePrice, setSalePrice] = useState("");
  const [notes, setNotes] = useState("");

  const { data: candidates = [] } = useQuery({
    queryKey: ["client_candidates_transfer", search, open],
    enabled: open,
    queryFn: async () => {
      let q = supabase.from("clients").select("id, full_name, email").order("full_name").limit(20);
      if (search) q = q.ilike("full_name", `%${search}%`);
      const { data } = await q;
      return data ?? [];
    },
  });

  const transfer = useMutation({
    mutationFn: async () => {
      if (!newClientId) throw new Error("Bitte neuen Eigentümer wählen");
      if (!transferDate) throw new Error("Bitte Datum wählen");

      const oldNames = currentOwners
        .map((o) => o.client?.full_name)
        .filter(Boolean)
        .join(", ");

      // Aktuelle Eigentümer beenden + Verkaufspreis setzen
      for (const o of currentOwners) {
        const { error } = await supabase
          .from("property_ownerships")
          .update({
            end_date: transferDate,
            sale_price: salePrice ? Number(salePrice) : o.sale_price,
            ownership_type: "former_owner",
          })
          .eq("id", o.id);
        if (error) throw error;

        // bestehende client_roles(owner) für diese Immobilie schließen
        await supabase
          .from("client_roles")
          .update({ status: "completed", end_date: transferDate, role_type: "former_owner" })
          .eq("client_id", o.client_id)
          .eq("related_type", "property")
          .eq("related_id", propertyId)
          .eq("role_type", "owner");
      }

      // Neuen Eigentümer anlegen
      const { error: insErr } = await supabase.from("property_ownerships").insert({
        property_id: propertyId,
        client_id: newClientId,
        ownership_type: "owner",
        start_date: transferDate,
        source: "sale",
        acquisition_type: "Kauf",
        acquisition_price: salePrice ? Number(salePrice) : null,
        notes: notes.trim() || null,
        is_primary_contact: true,
      });
      if (insErr) throw insErr;

      await supabase.from("client_roles").insert({
        client_id: newClientId,
        role_type: "owner",
        related_type: "property",
        related_id: propertyId,
        status: "active",
        start_date: transferDate,
      });

      // Neuen Namen für Activity-Log holen
      const { data: newClient } = await supabase
        .from("clients")
        .select("full_name")
        .eq("id", newClientId)
        .single();

      await supabase.from("activity_logs").insert({
        actor_id: user?.id ?? null,
        action: `Eigentümer gewechselt von ${oldNames || "—"} zu ${newClient?.full_name ?? "—"}`,
        related_type: "property",
        related_id: propertyId,
        metadata: {
          old_client_ids: currentOwners.map((o) => o.client_id),
          new_client_id: newClientId,
          sale_price: salePrice ? Number(salePrice) : null,
          transfer_date: transferDate,
        },
      });
    },
    onSuccess: () => {
      toast.success("Eigentümerwechsel gespeichert");
      onOpenChange(false);
      setNewClientId(null);
      setSalePrice("");
      setNotes("");
      setSearch("");
      onSaved();
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Wechsel fehlgeschlagen"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Eigentümer wechseln</DialogTitle>
          <DialogDescription>
            Beendet alle aktuellen Eigentumsverhältnisse zum gewählten Datum und legt einen neuen
            Eigentümer an. Die Historie bleibt erhalten.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="rounded-xl border bg-muted/30 p-3 text-xs">
            <p className="font-medium">Aktuell:</p>
            <p className="text-muted-foreground">
              {currentOwners.map((o) => o.client?.full_name ?? "—").join(", ") || "—"}
            </p>
          </div>
          <div>
            <Label className="mb-1 block text-xs text-muted-foreground">
              Neuen Eigentümer suchen
            </Label>
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Nach Name suchen…"
            />
          </div>
          <div className="max-h-44 overflow-auto rounded-lg border">
            {candidates.length === 0 ? (
              <p className="p-3 text-sm text-muted-foreground">Keine Treffer.</p>
            ) : (
              candidates.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setNewClientId(c.id)}
                  className={`flex w-full items-center justify-between border-b p-2.5 text-left text-sm last:border-0 hover:bg-muted/50 ${
                    newClientId === c.id ? "bg-primary/10" : ""
                  }`}
                >
                  <span>{c.full_name}</span>
                  <span className="text-xs text-muted-foreground">{c.email ?? ""}</span>
                </button>
              ))
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="mb-1 block text-xs text-muted-foreground">Datum des Wechsels</Label>
              <Input
                type="date"
                value={transferDate}
                onChange={(e) => setTransferDate(e.target.value)}
              />
            </div>
            <div>
              <Label className="mb-1 block text-xs text-muted-foreground">Verkaufspreis (CHF)</Label>
              <Input
                type="number"
                value={salePrice}
                onChange={(e) => setSalePrice(e.target.value)}
              />
            </div>
            <div className="col-span-2">
              <Label className="mb-1 block text-xs text-muted-foreground">Notizen</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Abbrechen</Button>
          <Button onClick={() => transfer.mutate()} disabled={!newClientId || transfer.isPending}>
            Wechsel speichern
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
