import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
import {
  Plus,
  Trash2,
  UserPlus,
  Baby,
  ExternalLink,
  Heart,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import {
  relationshipTypeLabels,
  relationshipTypes,
  type RelationshipType,
} from "@/lib/self-disclosure";
import { formatDate } from "@/lib/format";

type Relationship = {
  id: string;
  related_client_id: string;
  relationship_type: RelationshipType;
  notes: string | null;
  related?: { id: string; full_name: string; email: string | null } | null;
};

type Child = {
  id: string;
  full_name: string | null;
  birth_date: string | null;
  gender: string | null;
  is_shared_child: boolean;
};

interface Props {
  clientId: string;
}

export function ClientRelationshipsTab({ clientId }: Props) {
  const qc = useQueryClient();

  const { data: relationships = [] } = useQuery({
    queryKey: ["client_relationships", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_relationships")
        .select("id, related_client_id, relationship_type, notes, related:clients!client_relationships_related_client_id_fkey(id, full_name, email)")
        .eq("client_id", clientId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as Relationship[];
    },
  });

  const { data: children = [] } = useQuery({
    queryKey: ["client_children", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_children")
        .select("*")
        .eq("client_id", clientId)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Child[];
    },
  });

  const removeRel = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("client_relationships").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Beziehung entfernt");
      qc.invalidateQueries({ queryKey: ["client_relationships", clientId] });
    },
  });

  const removeChild = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("client_children").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Kind entfernt");
      qc.invalidateQueries({ queryKey: ["client_children", clientId] });
    },
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="p-6">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Heart className="h-4 w-4 text-muted-foreground" />
              <h3 className="font-display text-lg font-semibold">Beziehungen</h3>
            </div>
            <AddRelationshipDialog clientId={clientId} />
          </div>

          {relationships.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Noch keine verknüpften Personen. Füge Ehepartner, Mitantragsteller
              oder Mitinvestoren hinzu.
            </p>
          ) : (
            <div className="space-y-2">
              {relationships.map((r) => (
                <div
                  key={r.id}
                  className="flex items-center justify-between rounded-xl border p-3"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">
                        {relationshipTypeLabels[r.relationship_type]}
                      </Badge>
                      {r.related ? (
                        <Link
                          to="/clients/$id"
                          params={{ id: r.related.id }}
                          className="font-medium hover:text-primary"
                        >
                          {r.related.full_name}
                        </Link>
                      ) : (
                        <span className="text-sm text-muted-foreground">Unbekannt</span>
                      )}
                    </div>
                    {r.notes && (
                      <p className="mt-1 text-xs text-muted-foreground">{r.notes}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    {r.related && (
                      <Button asChild variant="ghost" size="icon">
                        <Link to="/clients/$id" params={{ id: r.related.id }}>
                          <ExternalLink className="h-4 w-4" />
                        </Link>
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        if (confirm("Beziehung wirklich entfernen?")) removeRel.mutate(r.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Baby className="h-4 w-4 text-muted-foreground" />
              <h3 className="font-display text-lg font-semibold">Kinder</h3>
            </div>
            <AddChildDialog clientId={clientId} disabled={children.length >= 4} />
          </div>

          {children.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Noch keine Kinder erfasst (max. 4).
            </p>
          ) : (
            <div className="grid gap-2 md:grid-cols-2">
              {children.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between rounded-xl border p-3"
                >
                  <div>
                    <p className="font-medium">{c.full_name ?? "Unbenannt"}</p>
                    <p className="text-xs text-muted-foreground">
                      {c.birth_date ? formatDate(c.birth_date) : "Geburtsdatum —"}
                      {c.gender ? ` · ${c.gender}` : ""}
                      {c.is_shared_child ? " · gemeinsam" : ""}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeChild.mutate(c.id)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function AddRelationshipDialog({ clientId }: { clientId: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<RelationshipType>("spouse");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [notes, setNotes] = useState("");

  const { data: candidates = [] } = useQuery({
    queryKey: ["client_relationship_candidates", clientId, search],
    enabled: open,
    queryFn: async () => {
      let q = supabase
        .from("clients")
        .select("id, full_name, email")
        .neq("id", clientId)
        .order("full_name")
        .limit(20);
      if (search) q = q.ilike("full_name", `%${search}%`);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const add = useMutation({
    mutationFn: async () => {
      if (!selectedId) throw new Error("Bitte einen Kunden auswählen");
      const { error } = await supabase.from("client_relationships").insert({
        client_id: clientId,
        related_client_id: selectedId,
        relationship_type: type,
        notes: notes.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Beziehung hinzugefügt");
      qc.invalidateQueries({ queryKey: ["client_relationships", clientId] });
      setOpen(false);
      setSelectedId(null);
      setNotes("");
      setSearch("");
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Konnte Beziehung nicht speichern"),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <UserPlus className="mr-1.5 h-4 w-4" />
          Person verknüpfen
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Person verknüpfen</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="mb-1 block text-xs text-muted-foreground">Beziehungstyp</Label>
            <Select value={type} onValueChange={(v) => setType(v as RelationshipType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {relationshipTypes.map((t) => (
                  <SelectItem key={t} value={t}>
                    {relationshipTypeLabels[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="mb-1 block text-xs text-muted-foreground">
              Bestehenden Kunden suchen
            </Label>
            <Input
              placeholder="Nach Name suchen…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="max-h-56 overflow-auto rounded-lg border">
            {candidates.length === 0 ? (
              <p className="p-3 text-sm text-muted-foreground">Keine Treffer.</p>
            ) : (
              candidates.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setSelectedId(c.id)}
                  className={`flex w-full items-center justify-between border-b p-2.5 text-left text-sm last:border-0 hover:bg-muted/50 ${
                    selectedId === c.id ? "bg-primary/10" : ""
                  }`}
                >
                  <span>{c.full_name}</span>
                  <span className="text-xs text-muted-foreground">{c.email ?? ""}</span>
                </button>
              ))
            )}
          </div>
          <div>
            <Label className="mb-1 block text-xs text-muted-foreground">Notiz (optional)</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <p className="flex items-start gap-1 text-xs text-muted-foreground">
            <Users className="mt-0.5 h-3 w-3 shrink-0" />
            Tipp: Falls die Person noch nicht existiert, lege sie zuerst als Kunde an
            und verknüpfe sie hier.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Abbrechen
          </Button>
          <Button onClick={() => add.mutate()} disabled={!selectedId || add.isPending}>
            Verknüpfen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AddChildDialog({ clientId, disabled }: { clientId: string; disabled?: boolean }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    full_name: "",
    birth_date: "",
    gender: "",
    is_shared_child: true,
  });

  const add = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("client_children").insert({
        client_id: clientId,
        full_name: form.full_name.trim() || null,
        birth_date: form.birth_date || null,
        gender: form.gender || null,
        is_shared_child: form.is_shared_child,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Kind hinzugefügt");
      qc.invalidateQueries({ queryKey: ["client_children", clientId] });
      setOpen(false);
      setForm({ full_name: "", birth_date: "", gender: "", is_shared_child: true });
    },
    onError: (e: unknown) =>
      toast.error(e instanceof Error ? e.message : "Konnte Kind nicht speichern"),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" disabled={disabled}>
          <Plus className="mr-1.5 h-4 w-4" />
          Kind hinzufügen
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Kind hinzufügen</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label className="mb-1 block text-xs text-muted-foreground">Vor- und Nachname</Label>
            <Input
              value={form.full_name}
              onChange={(e) => setForm({ ...form, full_name: e.target.value })}
            />
          </div>
          <div>
            <Label className="mb-1 block text-xs text-muted-foreground">Geburtsdatum</Label>
            <Input
              type="date"
              value={form.birth_date}
              onChange={(e) => setForm({ ...form, birth_date: e.target.value })}
            />
          </div>
          <div>
            <Label className="mb-1 block text-xs text-muted-foreground">Geschlecht</Label>
            <Select
              value={form.gender}
              onValueChange={(v) => setForm({ ...form, gender: v })}
            >
              <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="männlich">männlich</SelectItem>
                <SelectItem value="weiblich">weiblich</SelectItem>
                <SelectItem value="divers">divers</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="sm:col-span-2 flex items-center gap-2">
            <input
              id="is_shared"
              type="checkbox"
              checked={form.is_shared_child}
              onChange={(e) => setForm({ ...form, is_shared_child: e.target.checked })}
              className="h-4 w-4 rounded border"
            />
            <Label htmlFor="is_shared" className="text-sm">Gemeinsames Kind</Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Abbrechen
          </Button>
          <Button onClick={() => add.mutate()} disabled={add.isPending}>
            Speichern
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
