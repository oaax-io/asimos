import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Star } from "lucide-react";
import { toast } from "sonner";

type BankAccount = {
  id: string;
  label: string;
  bank_name: string | null;
  account_holder: string | null;
  iban: string | null;
  bic: string | null;
  purpose: string | null;
  is_default: boolean;
  is_active: boolean;
  notes: string | null;
};

const emptyAccount: Omit<BankAccount, "id"> = {
  label: "", bank_name: "", account_holder: "", iban: "", bic: "",
  purpose: "Reservationsgebühren", is_default: false, is_active: true, notes: "",
};

export function BankAccountsManager() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<BankAccount | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Omit<BankAccount, "id">>(emptyAccount);

  const { data: accounts = [], isLoading } = useQuery({
    queryKey: ["bank-accounts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bank_accounts" as any)
        .select("*")
        .order("is_default", { ascending: false })
        .order("label");
      if (error) throw error;
      return (data ?? []) as BankAccount[];
    },
  });

  const openNew = () => {
    setEditing(null);
    setForm(emptyAccount);
    setOpen(true);
  };
  const openEdit = (a: BankAccount) => {
    setEditing(a);
    const { id: _id, ...rest } = a;
    setForm(rest);
    setOpen(true);
  };

  const save = useMutation({
    mutationFn: async () => {
      // If setting as default, unset others first
      if (form.is_default) {
        await supabase.from("bank_accounts" as any).update({ is_default: false }).neq("id", editing?.id ?? "00000000-0000-0000-0000-000000000000");
      }
      if (editing) {
        const { error } = await supabase.from("bank_accounts" as any).update(form).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("bank_accounts" as any).insert(form);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editing ? "Bankkonto aktualisiert" : "Bankkonto angelegt");
      qc.invalidateQueries({ queryKey: ["bank-accounts"] });
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("bank_accounts" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Bankkonto gelöscht");
      qc.invalidateQueries({ queryKey: ["bank-accounts"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const setDefault = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from("bank_accounts" as any).update({ is_default: false }).neq("id", id);
      const { error } = await supabase.from("bank_accounts" as any).update({ is_default: true }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Standardkonto gesetzt");
      qc.invalidateQueries({ queryKey: ["bank-accounts"] });
    },
  });

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <Card>
      <CardContent className="space-y-4 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Bankkonten</h2>
            <p className="text-sm text-muted-foreground">Werden in Reservationen, Mandaten und weiteren Verträgen verwendet.</p>
          </div>
          <Button onClick={openNew}><Plus className="mr-2 size-4" /> Neues Konto</Button>
        </div>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Wird geladen…</p>
        ) : accounts.length === 0 ? (
          <div className="rounded-lg border border-dashed p-8 text-center">
            <p className="text-sm text-muted-foreground">Noch keine Bankkonten erfasst.</p>
            <Button variant="outline" className="mt-3" onClick={openNew}>Erstes Konto anlegen</Button>
          </div>
        ) : (
          <div className="space-y-2">
            {accounts.map((a) => (
              <div key={a.id} className="flex items-start justify-between gap-4 rounded-lg border p-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{a.label}</span>
                    {a.is_default ? <Badge variant="secondary"><Star className="mr-1 size-3" /> Standard</Badge> : null}
                    {!a.is_active ? <Badge variant="outline">Inaktiv</Badge> : null}
                  </div>
                  <div className="mt-1 grid gap-1 text-sm text-muted-foreground sm:grid-cols-2">
                    {a.bank_name ? <span>{a.bank_name}</span> : null}
                    {a.account_holder ? <span>Inhaber: {a.account_holder}</span> : null}
                    {a.iban ? <span className="font-mono">{a.iban}</span> : null}
                    {a.bic ? <span className="font-mono">BIC: {a.bic}</span> : null}
                    {a.purpose ? <span>Zweck: {a.purpose}</span> : null}
                  </div>
                </div>
                <div className="flex shrink-0 gap-1">
                  {!a.is_default ? (
                    <Button variant="ghost" size="sm" onClick={() => setDefault.mutate(a.id)} title="Als Standard setzen">
                      <Star className="size-4" />
                    </Button>
                  ) : null}
                  <Button variant="ghost" size="sm" onClick={() => openEdit(a)}><Pencil className="size-4" /></Button>
                  <Button variant="ghost" size="sm" onClick={() => { if (confirm("Bankkonto wirklich löschen?")) remove.mutate(a.id); }}>
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>{editing ? "Bankkonto bearbeiten" : "Neues Bankkonto"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div><Label>Bezeichnung *</Label><Input value={form.label} onChange={(e) => set("label", e.target.value)} placeholder="z.B. Hauptkonto Reservationen" /></div>
              <div className="grid gap-4 md:grid-cols-2">
                <div><Label>Bank</Label><Input value={form.bank_name ?? ""} onChange={(e) => set("bank_name", e.target.value)} /></div>
                <div><Label>Kontoinhaber</Label><Input value={form.account_holder ?? ""} onChange={(e) => set("account_holder", e.target.value)} /></div>
              </div>
              <div className="grid gap-4 md:grid-cols-[2fr_1fr]">
                <div><Label>IBAN</Label><Input value={form.iban ?? ""} onChange={(e) => set("iban", e.target.value)} placeholder="CH00 0000 0000 0000 0000 0" /></div>
                <div><Label>BIC / SWIFT</Label><Input value={form.bic ?? ""} onChange={(e) => set("bic", e.target.value)} /></div>
              </div>
              <div><Label>Verwendungszweck</Label><Input value={form.purpose ?? ""} onChange={(e) => set("purpose", e.target.value)} /></div>
              <div><Label>Notizen</Label><Textarea value={form.notes ?? ""} onChange={(e) => set("notes", e.target.value)} rows={2} /></div>
              <div className="flex items-center justify-between rounded-md border p-3">
                <div>
                  <Label>Standardkonto</Label>
                  <p className="text-xs text-muted-foreground">Wird automatisch in neuen Verträgen vorausgewählt.</p>
                </div>
                <Switch checked={form.is_default} onCheckedChange={(v) => set("is_default", v)} />
              </div>
              <div className="flex items-center justify-between rounded-md border p-3">
                <Label>Aktiv</Label>
                <Switch checked={form.is_active} onCheckedChange={(v) => set("is_active", v)} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Abbrechen</Button>
              <Button onClick={() => save.mutate()} disabled={save.isPending || !form.label}>
                {save.isPending ? "Wird gespeichert…" : "Speichern"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
