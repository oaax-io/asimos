import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Plus, Search, Mail, Phone, Target } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { clientTypeLabels, formatCurrency, propertyTypeLabels } from "@/lib/format";
import { EmptyState } from "@/components/EmptyState";

export const Route = createFileRoute("/_app/clients")({ component: ClientsPage });

const TYPES = ["buyer","seller","tenant","landlord"] as const;
const PROP_TYPES = ["apartment","house","commercial","land","other"] as const;

function ClientsPage() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    full_name: "", email: "", phone: "", client_type: "buyer" as typeof TYPES[number],
    notes: "", budget_min: "", budget_max: "", rooms_min: "", area_min: "",
    preferred_cities: "", preferred_types: [] as string[], preferred_listing: "sale" as "sale" | "rent",
  });

  const { data: clients = [] } = useQuery({
    queryKey: ["clients"],
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const { data: profile } = await supabase.from("profiles").select("agency_id").eq("id", user!.id).single();
      const { error } = await supabase.from("clients").insert({
        agency_id: profile!.agency_id,
        owner_id: user!.id,
        full_name: form.full_name,
        email: form.email || null,
        phone: form.phone || null,
        client_type: form.client_type,
        notes: form.notes || null,
        budget_min: form.budget_min ? Number(form.budget_min) : null,
        budget_max: form.budget_max ? Number(form.budget_max) : null,
        rooms_min: form.rooms_min ? Number(form.rooms_min) : null,
        area_min: form.area_min ? Number(form.area_min) : null,
        preferred_cities: form.preferred_cities ? form.preferred_cities.split(",").map(s => s.trim()).filter(Boolean) : null,
        preferred_types: form.preferred_types.length ? (form.preferred_types as any) : null,
        preferred_listing: form.preferred_listing,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Kunde erstellt");
      qc.invalidateQueries({ queryKey: ["clients"] });
      setOpen(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const filtered = clients.filter(c =>
    !search || c.full_name.toLowerCase().includes(search.toLowerCase()) ||
    c.email?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
      <PageHeader
        title="Kunden"
        description="Alle Käufer, Verkäufer, Mieter und Vermieter"
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="mr-1 h-4 w-4" />Neuer Kunde</Button></DialogTrigger>
            <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
              <DialogHeader><DialogTitle>Neuer Kunde</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Name</Label><Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></div>
                  <div><Label>Typ</Label>
                    <Select value={form.client_type} onValueChange={(v: any) => setForm({ ...form, client_type: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>{TYPES.map(t => <SelectItem key={t} value={t}>{clientTypeLabels[t]}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div><Label>E-Mail</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
                  <div><Label>Telefon</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
                </div>

                <div className="rounded-xl border bg-muted/30 p-4">
                  <p className="mb-3 text-sm font-semibold">Suchprofil</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>Vermarktung</Label>
                      <Select value={form.preferred_listing} onValueChange={(v: any) => setForm({ ...form, preferred_listing: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent><SelectItem value="sale">Kauf</SelectItem><SelectItem value="rent">Miete</SelectItem></SelectContent>
                      </Select>
                    </div>
                    <div><Label>Städte (Komma-getrennt)</Label><Input placeholder="Berlin, Potsdam" value={form.preferred_cities} onChange={(e) => setForm({ ...form, preferred_cities: e.target.value })} /></div>
                    <div><Label>Budget min (€)</Label><Input type="number" value={form.budget_min} onChange={(e) => setForm({ ...form, budget_min: e.target.value })} /></div>
                    <div><Label>Budget max (€)</Label><Input type="number" value={form.budget_max} onChange={(e) => setForm({ ...form, budget_max: e.target.value })} /></div>
                    <div><Label>Zimmer min</Label><Input type="number" value={form.rooms_min} onChange={(e) => setForm({ ...form, rooms_min: e.target.value })} /></div>
                    <div><Label>Fläche min (m²)</Label><Input type="number" value={form.area_min} onChange={(e) => setForm({ ...form, area_min: e.target.value })} /></div>
                  </div>
                  <div className="mt-3">
                    <Label>Bevorzugte Objekttypen</Label>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {PROP_TYPES.map(t => {
                        const sel = form.preferred_types.includes(t);
                        return (
                          <button type="button" key={t} onClick={() => setForm({
                            ...form,
                            preferred_types: sel ? form.preferred_types.filter(x => x !== t) : [...form.preferred_types, t],
                          })} className={`rounded-full border px-3 py-1 text-xs transition ${sel ? "border-primary bg-primary text-primary-foreground" : "bg-background"}`}>
                            {propertyTypeLabels[t]}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div><Label>Notizen</Label><Textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
              </div>
              <DialogFooter>
                <Button onClick={() => create.mutate()} disabled={!form.full_name || create.isPending}>Speichern</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="mb-4 relative max-w-md">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input className="pl-9" placeholder="Kunden suchen…" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="Noch keine Kunden" description="Lege deinen ersten Kunden an, um Suchprofile zu erfassen und Matches zu erhalten." />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((c) => (
            <Card key={c.id} className="transition hover:shadow-glow">
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold">{c.full_name}</p>
                    <Badge variant="secondary" className="mt-1">{clientTypeLabels[c.client_type as keyof typeof clientTypeLabels]}</Badge>
                  </div>
                  <Link to="/matching" search={{ clientId: c.id }} className="rounded-lg border p-2 text-primary transition hover:bg-accent" title="Matching">
                    <Target className="h-4 w-4" />
                  </Link>
                </div>
                <div className="mt-3 space-y-1 text-sm text-muted-foreground">
                  {c.email && <p className="flex items-center gap-2"><Mail className="h-3.5 w-3.5" />{c.email}</p>}
                  {c.phone && <p className="flex items-center gap-2"><Phone className="h-3.5 w-3.5" />{c.phone}</p>}
                </div>
                {(c.budget_max || c.preferred_cities?.length) && (
                  <div className="mt-3 rounded-lg bg-muted/40 p-3 text-xs">
                    {c.budget_max && <p>Budget: bis {formatCurrency(Number(c.budget_max))}</p>}
                    {c.preferred_cities?.length ? <p>Städte: {c.preferred_cities.join(", ")}</p> : null}
                    {c.rooms_min ? <p>Zimmer ab: {c.rooms_min}</p> : null}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
