import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Upload, Image as ImageIcon, Trash2, Palette } from "lucide-react";
import { toast } from "sonner";
import { DEFAULT_BRAND } from "@/lib/document-templates";

type BrandForm = {
  id?: string;
  company_name: string;
  company_address: string;
  company_email: string;
  company_website: string;
  logo_url: string;
  primary_color: string;
  secondary_color: string;
  font_family: string;
};

const empty: BrandForm = {
  company_name: DEFAULT_BRAND.company_name,
  company_address: "",
  company_email: "",
  company_website: "",
  logo_url: "",
  primary_color: DEFAULT_BRAND.primary_color,
  secondary_color: DEFAULT_BRAND.secondary_color,
  font_family: DEFAULT_BRAND.font_family,
};

export function BrandkitForm() {
  const qc = useQueryClient();
  const [form, setForm] = useState<BrandForm>(empty);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data } = useQuery({
    queryKey: ["brand-settings"],
    queryFn: async () => {
      const { data } = await supabase
        .from("brand_settings" as any)
        .select("*")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return (data as any) ?? null;
    },
  });

  useEffect(() => {
    if (data) {
      setForm({
        id: data.id,
        company_name: data.company_name ?? "",
        company_address: data.company_address ?? "",
        company_email: data.company_email ?? "",
        company_website: data.company_website ?? "",
        logo_url: data.logo_url ?? "",
        primary_color: data.primary_color ?? DEFAULT_BRAND.primary_color,
        secondary_color: data.secondary_color ?? DEFAULT_BRAND.secondary_color,
        font_family: data.font_family ?? DEFAULT_BRAND.font_family,
      });
    }
  }, [data]);

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        company_name: form.company_name || null,
        company_address: form.company_address || null,
        company_email: form.company_email || null,
        company_website: form.company_website || null,
        logo_url: form.logo_url || null,
        primary_color: form.primary_color || null,
        secondary_color: form.secondary_color || null,
        font_family: form.font_family || null,
      };
      if (form.id) {
        const { error } = await supabase.from("brand_settings" as any).update(payload).eq("id", form.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("brand_settings" as any).insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Brandkit gespeichert");
      qc.invalidateQueries({ queryKey: ["brand-settings"] });
      qc.invalidateQueries({ queryKey: ["doc-ctx"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const onLogoChange = async (file: File) => {
    setUploading(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "png";
      const path = `logo-${Date.now()}.${ext}`;
      const { error } = await supabase.storage
        .from("brand-assets")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (error) throw error;
      const { data: pub } = supabase.storage.from("brand-assets").getPublicUrl(path);
      setForm((f) => ({ ...f, logo_url: pub.publicUrl }));
      toast.success("Logo hochgeladen");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      {/* Form */}
      <Card>
        <CardContent className="space-y-5 p-6">
          <div>
            <h2 className="text-lg font-semibold">Brandkit</h2>
            <p className="text-sm text-muted-foreground">
              Zentrales Branding für alle generierten Dokumente (Mandate, Reservationen, NDAs).
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Firmenname">
              <Input
                value={form.company_name}
                onChange={(e) => setForm({ ...form, company_name: e.target.value })}
                placeholder="ASIMO"
              />
            </Field>
            <Field label="E-Mail">
              <Input
                type="email"
                value={form.company_email}
                onChange={(e) => setForm({ ...form, company_email: e.target.value })}
                placeholder="kontakt@asimo.ch"
              />
            </Field>
            <Field label="Adresse" full>
              <Input
                value={form.company_address}
                onChange={(e) => setForm({ ...form, company_address: e.target.value })}
                placeholder="Bahnhofstrasse 10, 8001 Zürich"
              />
            </Field>
            <Field label="Webseite" full>
              <Input
                value={form.company_website}
                onChange={(e) => setForm({ ...form, company_website: e.target.value })}
                placeholder="https://asimo.ch"
              />
            </Field>
          </div>

          {/* Logo */}
          <div>
            <Label>Logo</Label>
            <div className="mt-2 flex items-center gap-4">
              <div className="flex size-20 items-center justify-center overflow-hidden rounded-lg border bg-muted/30">
                {form.logo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={form.logo_url} alt="Logo" className="max-h-full max-w-full object-contain" />
                ) : (
                  <ImageIcon className="size-6 text-muted-foreground" />
                )}
              </div>
              <div className="flex flex-col gap-2">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/png,image/jpeg,image/svg+xml,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) onLogoChange(f);
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                >
                  <Upload className="mr-2 size-4" />
                  {uploading ? "Wird hochgeladen…" : form.logo_url ? "Logo ersetzen" : "Logo hochladen"}
                </Button>
                {form.logo_url && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setForm({ ...form, logo_url: "" })}
                  >
                    <Trash2 className="mr-2 size-4" /> Entfernen
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Colors */}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Primärfarbe">
              <ColorPicker
                value={form.primary_color}
                onChange={(v) => setForm({ ...form, primary_color: v })}
              />
            </Field>
            <Field label="Sekundärfarbe">
              <ColorPicker
                value={form.secondary_color}
                onChange={(v) => setForm({ ...form, secondary_color: v })}
              />
            </Field>
          </div>

          <Field label="Schriftart (CSS font-family)">
            <Input
              value={form.font_family}
              onChange={(e) => setForm({ ...form, font_family: e.target.value })}
              placeholder={DEFAULT_BRAND.font_family}
            />
          </Field>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => data && setForm({ ...form, ...data })}>
              Zurücksetzen
            </Button>
            <Button onClick={() => save.mutate()} disabled={save.isPending}>
              {save.isPending ? "Wird gespeichert…" : "Speichern"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Live preview */}
      <Card className="h-fit">
        <CardContent className="space-y-3 p-6">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Palette className="size-4" /> Live-Vorschau
          </div>
          <BrandPreview brand={form} />
        </CardContent>
      </Card>
    </div>
  );
}

function Field({
  label,
  children,
  full,
}: {
  label: string;
  children: React.ReactNode;
  full?: boolean;
}) {
  return (
    <div className={full ? "sm:col-span-2" : ""}>
      <Label>{label}</Label>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}

function ColorPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="color"
        value={value || "#000000"}
        onChange={(e) => onChange(e.target.value)}
        className="size-9 cursor-pointer rounded-md border bg-transparent"
      />
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="#324642"
        className="font-mono text-sm"
      />
    </div>
  );
}

function BrandPreview({ brand }: { brand: BrandForm }) {
  const primary = brand.primary_color || DEFAULT_BRAND.primary_color;
  const secondary = brand.secondary_color || DEFAULT_BRAND.secondary_color;
  return (
    <div
      className="overflow-hidden rounded-lg border bg-white"
      style={{ fontFamily: brand.font_family || DEFAULT_BRAND.font_family }}
    >
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{ borderBottom: `2px solid ${primary}` }}
      >
        {brand.logo_url ? (
          <img src={brand.logo_url} alt="" className="h-8 w-auto object-contain" />
        ) : (
          <div className="text-sm font-bold" style={{ color: primary }}>
            {brand.company_name || "Firmenname"}
          </div>
        )}
        <div className="text-right text-[10px] leading-tight text-gray-500">
          {brand.company_address}
          <br />
          {brand.company_email} {brand.company_website ? `· ${brand.company_website}` : ""}
        </div>
      </div>
      <div className="space-y-2 p-4">
        <h3 className="text-base font-semibold" style={{ color: primary }}>
          Maklermandat
        </h3>
        <h4
          className="border-l-2 pl-2 text-sm font-medium"
          style={{ color: primary, borderColor: secondary }}
        >
          Auftraggeber
        </h4>
        <p className="text-xs text-gray-700">
          Beispiel-Kunde<br />
          Musterstrasse 12, 8000 Zürich
        </p>
        <h4
          className="border-l-2 pl-2 text-sm font-medium"
          style={{ color: primary, borderColor: secondary }}
        >
          Provision
        </h4>
        <p className="text-xs text-gray-700">
          <span className="font-semibold" style={{ color: primary }}>3 %</span> vom Verkaufspreis
        </p>
      </div>
      <div
        className="px-4 py-2 text-center text-[10px] text-gray-500"
        style={{ borderTop: `1px solid ${secondary}66` }}
      >
        {brand.company_name || "ASIMO"}
        {brand.company_address ? ` · ${brand.company_address}` : ""}
      </div>
    </div>
  );
}
