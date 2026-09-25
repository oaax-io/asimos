import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useIsMasterDataAdmin } from "@/hooks/useIsMasterDataAdmin";
import { useTenantBranding } from "@/lib/tenant-branding";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Upload, Trash2 } from "lucide-react";
import { toast } from "sonner";

type Form = {
  company_name: string;
  logo_url: string;
  logo_alt_url: string;
  favicon_url: string;
  app_primary_color: string;
  app_secondary_color: string;
  app_accent_color: string;
  login_title: string;
  login_subtitle: string;
};
const KEYS: (keyof Form)[] = [
  "company_name", "logo_url", "logo_alt_url", "favicon_url",
  "app_primary_color", "app_secondary_color", "app_accent_color", "login_title", "login_subtitle",
];
const empty = Object.fromEntries(KEYS.map((k) => [k, ""])) as Form;

type Domain = { id: string; domain: string; domain_type: string; verification_status: string; activated_at: string | null; verification_token: string | null; verification_error: string | null };

function statusOf(d?: Domain | null): { label: string; variant: "default" | "secondary" | "destructive" | "outline" } {
  if (!d) return { label: "Nicht eingerichtet", variant: "outline" };
  if (d.verification_status === "failed") return { label: "Fehler", variant: "destructive" };
  if (d.verification_status === "verified") return d.activated_at || d.domain_type === "subdomain"
    ? { label: "Aktiv", variant: "default" } : { label: "Verifiziert", variant: "secondary" };
  return { label: "Ausstehend", variant: "secondary" };
}

export function WhiteLabelSettings() {
  const qc = useQueryClient();
  const { canEdit, loading: roleLoading } = useIsMasterDataAdmin();
  const { agencyId } = useTenantBranding() as { agencyId: string | null };
  const [form, setForm] = useState<Form>(empty);
  const [rowId, setRowId] = useState<string | null>(null);
  const [newDomain, setNewDomain] = useState("");

  const brand = useQuery({
    queryKey: ["brand-settings", "white-label", agencyId],
    enabled: !!agencyId,
    queryFn: async () => {
      const { data } = await supabase.from("brand_settings" as any).select("*").eq("agency_id", agencyId!).maybeSingle();
      return (data as any) ?? null;
    },
  });
  const domains = useQuery({
    queryKey: ["tenant-domains", agencyId],
    enabled: !!agencyId,
    queryFn: async () => {
      const { data } = await supabase.from("tenant_domains" as any)
        .select("id, domain, domain_type, verification_status, activated_at, verification_token, verification_error").eq("agency_id", agencyId!);
      return ((data as any[]) ?? []) as Domain[];
    },
  });

  useEffect(() => {
    const d = brand.data;
    if (!d) return;
    setRowId(d.id);
    setForm(Object.fromEntries(KEYS.map((k) => [k, d[k] ?? ""])) as Form);
  }, [brand.data]);

  const save = useMutation({
    mutationFn: async () => {
      const payload = Object.fromEntries(KEYS.map((k) => [k, form[k].trim() || null]));
      const q = rowId
        ? supabase.from("brand_settings" as any).update(payload).eq("id", rowId)
        : supabase.from("brand_settings" as any).insert({ ...payload, agency_id: agencyId });
      const { error } = await q;
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("White-Label-Einstellungen gespeichert");
      qc.invalidateQueries({ queryKey: ["brand-settings"] });
      qc.invalidateQueries({ queryKey: ["tenant-config"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const domainAction = useMutation({
    mutationFn: async (a: { fn: string; args?: Record<string, unknown> }) => {
      const { error } = await supabase.rpc(a.fn as never, (a.args ?? {}) as never);
      if (error) throw error;
    },
    onSuccess: () => { setNewDomain(""); qc.invalidateQueries({ queryKey: ["tenant-domains"] }); toast.success("Domain aktualisiert"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const verifyFn = useServerFn(verifyCustomDomain);
  const verify = useMutation({
    mutationFn: () => verifyFn(),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["tenant-domains"] });
      if (r.status === "verified") toast.success(r.message); else toast.error(r.message);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const upload = async (key: keyof Form, file: File) => {
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "png";
      const path = `agency/${agencyId}/${key}-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("brand-assets").upload(path, file, { upsert: true, contentType: file.type });
      if (error) throw error;
      const { data } = supabase.storage.from("brand-assets").getPublicUrl(path);
      setForm((f) => ({ ...f, [key]: data.publicUrl }));
    } catch (e) { toast.error((e as Error).message); }
  };

  if (roleLoading) return <p className="text-sm text-muted-foreground">Einen Moment …</p>;
  if (!agencyId || !canEdit) {
    return <Card><CardContent className="p-6 text-sm text-muted-foreground">
      Nur Inhaber und Admins des Unternehmens können die White-Label-Einstellungen bearbeiten.
    </CardContent></Card>;
  }

  const sub = domains.data?.find((d) => d.domain_type === "subdomain");
  const custom = domains.data?.find((d) => d.domain_type === "custom");
  const cs = statusOf(custom);
  const disabled = save.isPending;

  const colorField = (key: keyof Form, label: string) => (
    <div>
      <Label>{label}</Label>
      <div className="mt-1 flex gap-2">
        <input type="color" aria-label={label} value={form[key] || "#000000"} disabled={disabled}
          onChange={(e) => setForm({ ...form, [key]: e.target.value })} className="h-10 w-12 rounded border bg-transparent" />
        <Input value={form[key]} placeholder="z. B. #336699" onChange={(e) => setForm({ ...form, [key]: e.target.value })} />
      </div>
    </div>
  );
  const imageField = (key: keyof Form, label: string) => (
    <div>
      <Label>{label}</Label>
      <div className="mt-1 flex items-center gap-3">
        <div className="flex h-12 w-24 items-center justify-center rounded border bg-muted">
          {form[key] ? <img src={form[key]} alt={label} className="max-h-10 max-w-20 object-contain" /> : <span className="text-xs text-muted-foreground">—</span>}
        </div>
        <Button asChild variant="outline" size="sm"><label className="cursor-pointer">
          <Upload className="mr-1 h-4 w-4" />Hochladen
          <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && upload(key, e.target.files[0])} />
        </label></Button>
        {form[key] && <Button variant="ghost" size="sm" onClick={() => setForm({ ...form, [key]: "" })}><Trash2 className="h-4 w-4" /></Button>}
      </div>
    </div>
  );

  const p = form.app_primary_color || "#334155";
  const s = form.app_secondary_color || "#64748b";
  const a = form.app_accent_color || "#0ea5e9";

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="space-y-6">
        <Card>
          <CardHeader><CardTitle>Branding</CardTitle><CardDescription>Name, Logos und Farben der App für Ihr Unternehmen.</CardDescription></CardHeader>
          <CardContent className="space-y-4">
            <div><Label>Unternehmensname</Label><Input value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} /></div>
            {imageField("logo_url", "Logo")}
            {imageField("logo_alt_url", "Alternatives Logo (hell, für dunkle Flächen)")}
            {imageField("favicon_url", "Favicon (Browser-Tab)")}
            <div className="grid gap-4 sm:grid-cols-3">
              {colorField("app_primary_color", "App Primärfarbe")}
              {colorField("app_secondary_color", "App Sekundärfarbe")}
              {colorField("app_accent_color", "Akzentfarbe")}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Anmeldeseite</CardTitle><CardDescription>Wird auf Ihrer verifizierten Domain angezeigt. Logo und Farben stammen aus dem Branding.</CardDescription></CardHeader>
          <CardContent className="space-y-4">
            <div><Label>Titel (optional)</Label><Input value={form.login_title} placeholder="z. B. Willkommen zurück" onChange={(e) => setForm({ ...form, login_title: e.target.value })} /></div>
            <div><Label>Untertitel (optional)</Label><Input value={form.login_subtitle} onChange={(e) => setForm({ ...form, login_subtitle: e.target.value })} /></div>
          </CardContent>
        </Card>

        <div className="flex justify-end"><Button onClick={() => save.mutate()} disabled={disabled}>{disabled ? "Speichern …" : "Speichern"}</Button></div>

        <Card>
          <CardHeader><CardTitle>Immolia-Adresse</CardTitle></CardHeader>
          <CardContent className="flex items-center justify-between gap-3">
            <span className="font-mono text-sm">{sub?.domain ?? "Noch keine Adresse zugewiesen"}</span>
            <Badge variant={statusOf(sub).variant}>{statusOf(sub).label}</Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Eigene Domain</CardTitle>
            <CardDescription>Zum Beispiel crm.ihrefirma.ch. Nach dem Erfassen setzen Sie einen DNS-Eintrag, damit wir prüfen können, dass die Domain Ihnen gehört. Aktivieren können Sie sie erst nach der Verifikation. Die technische Verbindung der Domain richtet unser Support ein.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <span className="font-mono text-sm">{custom?.domain ?? "—"}</span>
              <Badge variant={cs.variant}>{cs.label}</Badge>
            </div>
            {custom && custom.verification_status !== "verified" && custom.verification_token && (
              <div className="space-y-2 rounded-md border bg-muted/40 p-3 text-sm">
                <p>Legen Sie bei Ihrem Domain-Anbieter diesen TXT-Eintrag an:</p>
                <div className="grid grid-cols-[80px_1fr] gap-1 font-mono text-xs">
                  <span className="text-muted-foreground">Typ</span><span>TXT</span>
                  <span className="text-muted-foreground">Name</span><span className="break-all">_immolia-verify.{custom.domain}</span>
                  <span className="text-muted-foreground">Wert</span><span className="break-all">{custom.verification_token}</span>
                </div>
                {custom.verification_error && <p className="text-destructive">Letzte Prüfung: {custom.verification_error}</p>}
                <Button size="sm" onClick={() => verify.mutate()} disabled={verify.isPending}>
                  {verify.isPending ? "Wird geprüft …" : "Jetzt prüfen"}
                </Button>
              </div>
            )}
            {custom?.verification_status === "verified" && !custom.activated_at && (
              <Button onClick={() => domainAction.mutate({ fn: "tenant_custom_domain_activate" })} disabled={domainAction.isPending}>Domain aktivieren</Button>
            )}
            {custom && custom.verification_status !== "verified" && (
              <Button variant="outline" onClick={() => domainAction.mutate({ fn: "tenant_custom_domain_remove" })} disabled={domainAction.isPending}>Domain entfernen</Button>
            )}
            {custom?.verification_status !== "verified" && (
              <div className="flex gap-2">
                <Input value={newDomain} placeholder="crm.ihrefirma.ch" onChange={(e) => setNewDomain(e.target.value)} />
                <Button disabled={!newDomain.trim() || domainAction.isPending}
                  onClick={() => domainAction.mutate({ fn: "tenant_custom_domain_request", args: { _domain: newDomain } })}>
                  {custom ? "Ersetzen" : "Erfassen"}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="h-fit lg:sticky lg:top-4">
        <CardHeader><CardTitle>Vorschau</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-hidden rounded-lg border">
            <div className="flex items-center gap-2 p-3" style={{ background: p }}>
              {form.logo_alt_url || form.logo_url
                ? <img src={form.logo_alt_url || form.logo_url} alt="" className="h-6 max-w-32 object-contain" />
                : <span className="text-sm font-semibold" style={{ color: "#fff" }}>{form.company_name || "Unternehmen"}</span>}
            </div>
            <div className="space-y-2 p-3">
              <div className="h-2 w-3/4 rounded" style={{ background: s, opacity: 0.4 }} />
              <div className="h-2 w-1/2 rounded" style={{ background: s, opacity: 0.4 }} />
              <button className="mt-2 rounded px-3 py-1 text-xs" style={{ background: a, color: "#fff" }}>Aktion</button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
