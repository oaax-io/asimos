import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

type CompanyForm = {
  name: string;
  legal_name: string;
  address: string;
  postal_code: string;
  city: string;
  country: string;
  phone: string;
  email: string;
  website: string;
  uid_number: string;
  commercial_register: string;
  logo_url: string;
  default_signatory_name: string;
  default_signatory_role: string;
  default_place: string;
};

const empty: CompanyForm = {
  name: "", legal_name: "", address: "", postal_code: "", city: "", country: "CH",
  phone: "", email: "", website: "", uid_number: "", commercial_register: "",
  logo_url: "", default_signatory_name: "", default_signatory_role: "", default_place: "",
};

export function CompanyProfileForm() {
  const qc = useQueryClient();
  const [form, setForm] = useState<CompanyForm>(empty);

  const { data } = useQuery({
    queryKey: ["company-full"],
    queryFn: async () => {
      const { data, error } = await supabase.from("company").select("*").limit(1).single();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (data) {
      setForm({
        name: data.name ?? "",
        legal_name: (data as any).legal_name ?? "",
        address: (data as any).address ?? "",
        postal_code: (data as any).postal_code ?? "",
        city: (data as any).city ?? "",
        country: (data as any).country ?? "CH",
        phone: (data as any).phone ?? "",
        email: (data as any).email ?? "",
        website: (data as any).website ?? "",
        uid_number: (data as any).uid_number ?? "",
        commercial_register: (data as any).commercial_register ?? "",
        logo_url: (data as any).logo_url ?? "",
        default_signatory_name: (data as any).default_signatory_name ?? "",
        default_signatory_role: (data as any).default_signatory_role ?? "",
        default_place: (data as any).default_place ?? "",
      });
    }
  }, [data]);

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("company").update(form as any).eq("id", true);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Firmenprofil gespeichert");
      qc.invalidateQueries({ queryKey: ["company-full"] });
      qc.invalidateQueries({ queryKey: ["company"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const set = <K extends keyof CompanyForm>(k: K, v: CompanyForm[K]) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <Card>
      <CardContent className="space-y-6 p-6">
        <div>
          <h2 className="text-lg font-semibold">Firmenprofil</h2>
          <p className="text-sm text-muted-foreground">Diese Daten werden in alle Verträge und Dokumente automatisch eingesetzt.</p>
        </div>

        <section className="grid gap-4 md:grid-cols-2">
          <div><Label>Anzeigename</Label><Input value={form.name} onChange={(e) => set("name", e.target.value)} /></div>
          <div><Label>Rechtlicher Name</Label><Input value={form.legal_name} onChange={(e) => set("legal_name", e.target.value)} placeholder="z.B. Muster Immobilien AG" /></div>
        </section>

        <section className="space-y-4">
          <h3 className="text-sm font-medium">Adresse</h3>
          <div className="grid gap-4 md:grid-cols-[2fr_1fr_2fr]">
            <div><Label>Strasse / Hausnummer</Label><Input value={form.address} onChange={(e) => set("address", e.target.value)} /></div>
            <div><Label>PLZ</Label><Input value={form.postal_code} onChange={(e) => set("postal_code", e.target.value)} /></div>
            <div><Label>Ort</Label><Input value={form.city} onChange={(e) => set("city", e.target.value)} /></div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div><Label>Land</Label><Input value={form.country} onChange={(e) => set("country", e.target.value)} /></div>
            <div><Label>Standardort für Verträge</Label><Input value={form.default_place} onChange={(e) => set("default_place", e.target.value)} placeholder="z.B. Zürich" /></div>
          </div>
        </section>

        <section className="space-y-4">
          <h3 className="text-sm font-medium">Kontakt</h3>
          <div className="grid gap-4 md:grid-cols-3">
            <div><Label>Telefon</Label><Input value={form.phone} onChange={(e) => set("phone", e.target.value)} /></div>
            <div><Label>E-Mail</Label><Input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} /></div>
            <div><Label>Webseite</Label><Input value={form.website} onChange={(e) => set("website", e.target.value)} /></div>
          </div>
        </section>

        <section className="space-y-4">
          <h3 className="text-sm font-medium">Rechtliches</h3>
          <div className="grid gap-4 md:grid-cols-2">
            <div><Label>UID-Nummer</Label><Input value={form.uid_number} onChange={(e) => set("uid_number", e.target.value)} placeholder="CHE-123.456.789" /></div>
            <div><Label>Handelsregister</Label><Input value={form.commercial_register} onChange={(e) => set("commercial_register", e.target.value)} /></div>
          </div>
        </section>

        <section className="space-y-4">
          <h3 className="text-sm font-medium">Standard-Unterzeichner</h3>
          <div className="grid gap-4 md:grid-cols-2">
            <div><Label>Name</Label><Input value={form.default_signatory_name} onChange={(e) => set("default_signatory_name", e.target.value)} /></div>
            <div><Label>Funktion</Label><Input value={form.default_signatory_role} onChange={(e) => set("default_signatory_role", e.target.value)} placeholder="z.B. Geschäftsführer" /></div>
          </div>
        </section>

        <section className="space-y-4">
          <h3 className="text-sm font-medium">Logo</h3>
          <div><Label>Logo-URL</Label><Input value={form.logo_url} onChange={(e) => set("logo_url", e.target.value)} placeholder="https://..." /></div>
          {form.logo_url ? (
            <img src={form.logo_url} alt="Firmenlogo" className="h-16 rounded border bg-muted/30 object-contain p-2" />
          ) : null}
        </section>

        <div className="flex justify-end pt-2">
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? "Wird gespeichert…" : "Speichern"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
