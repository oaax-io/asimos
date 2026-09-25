import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { QueryState } from "@/components/platform/PlatformLayout";
import {
  useDomainCenter, useDomainDnsRecord, usePlatformBranding, usePlatformTenants, addCustomDomain, setDomainActive, setPrimaryDomain, removeDomain,
  domainActive, domainErrorText, VERIFICATION_LABEL, IMMOLIA_WILDCARD_READY, fmtDate, fmtDateTime, type DomainCenterRow,
} from "@/lib/platform-admin";
import { platformVerifyDomain } from "@/lib/platform-domains.functions";

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return <div className="flex gap-4 border-b py-2 text-sm last:border-0"><span className="w-40 shrink-0 text-muted-foreground">{k}</span><span className="min-w-0 break-all">{v}</span></div>;
}

function VerBadge({ s }: { s: string }) {
  return <Badge variant={s === "verified" ? "default" : s === "failed" ? "destructive" : "secondary"}>{VERIFICATION_LABEL[s] ?? s}</Badge>;
}

function ActiveCell({ d }: { d: DomainCenterRow }) {
  if (d.domain_type === "subdomain") {
    return <div className="text-xs"><div>Registriert</div>{!IMMOLIA_WILDCARD_READY && <div className="text-muted-foreground">Hosting: Wildcard noch nicht eingerichtet</div>}</div>;
  }
  return domainActive(d) ? <Badge>Aktiv</Badge> : <span className="text-muted-foreground">Inaktiv</span>;
}

type Confirm = { title: string; text: string; run: () => Promise<unknown> } | null;

function DomainDetail({ d, onClose }: { d: DomainCenterRow; onClose: () => void }) {
  const qc = useQueryClient();
  const branding = usePlatformBranding(d.agency_id);
  const dns = useDomainDnsRecord(d.domain_type === "custom" ? d.id : null);
  const verify = useServerFn(platformVerifyDomain);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<Confirm>(null);
  const refresh = () => qc.invalidateQueries({ queryKey: ["platform"] });
  const act = async (fn: () => Promise<unknown>, ok: string, close = false) => {
    setBusy(true);
    try { await fn(); toast.success(ok); await refresh(); if (close) onClose(); }
    catch (e) { toast.error(domainErrorText(e)); }
    finally { setBusy(false); }
  };
  const b = branding.data;
  const custom = d.domain_type === "custom";

  return (
    <div className="space-y-6 py-4">
      <div>
        <Row k="Domain" v={d.domain} />
        <Row k="Unternehmen" v={d.agency_name} />
        <Row k="Tenant-ID" v={<code className="text-xs">{d.agency_id}</code>} />
        <Row k="Typ" v={custom ? "Custom Domain" : "Immolia-Adresse"} />
        <Row k="Bevorzugte Domain" v={d.is_primary ? "Ja" : "Nein"} />
        <Row k="Verifizierung" v={<VerBadge s={d.verification_status} />} />
        <Row k="Bestätigt am" v={fmtDateTime(d.verified_at)} />
        <Row k="Aktiviert am" v={custom ? fmtDateTime(d.activated_at) : "–"} />
        <Row k="Erstellt am" v={fmtDateTime(d.created_at)} />
        {!custom && <Row k="Hosting" v={IMMOLIA_WILDCARD_READY ? "Eingerichtet" : "Wildcard *.immolia.ch noch nicht eingerichtet – Adresse ist registriert, aber noch nicht erreichbar."} />}
        {custom && d.verification_error && <Row k="Letzter Fehler" v={d.verification_error} />}
        {custom && <Row k="Zuletzt geprüft" v={fmtDateTime(d.verification_checked_at)} />}
      </div>

      {custom && d.verification_status !== "verified" && dns.data && (
        <div className="rounded-md border p-3 text-sm">
          <div className="mb-2 font-medium">Benötigter DNS-Eintrag</div>
          <Row k="Typ" v="TXT" /><Row k="Name" v={<code className="text-xs">{dns.data.name}</code>} /><Row k="Wert" v={<code className="text-xs">{dns.data.value}</code>} />
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {custom && d.verification_status !== "verified" && (
          <Button size="sm" disabled={busy} onClick={() => act(async () => {
            const r = await verify({ data: { id: d.id } });
            if (r.status !== "verified") throw new Error(r.message);
          }, "Domain bestätigt")}>DNS prüfen</Button>
        )}
        {custom && d.verification_status === "verified" && !d.activated_at && (
          <Button size="sm" disabled={busy} onClick={() => act(() => setDomainActive(d.id, true), "Domain aktiviert", true)}>Aktivieren</Button>
        )}
        {custom && d.activated_at && (
          <Button size="sm" variant="outline" disabled={busy || d.is_primary} onClick={() => setConfirm({
            title: "Domain deaktivieren?", text: "Die Domain bleibt gespeichert, zeigt aber kein Firmen-Branding mehr. Firmendaten bleiben unverändert.",
            run: () => setDomainActive(d.id, false),
          })}>Deaktivieren</Button>
        )}
        {!d.is_primary && domainActive(d) && (
          <Button size="sm" variant="outline" disabled={busy} onClick={() => setConfirm({
            title: "Als bevorzugte Domain festlegen?", text: "Bevorzugte Adresse innerhalb Immolia. Ändert keine Hosting-Weiterleitungen.",
            run: () => setPrimaryDomain(d.id),
          })}>Als bevorzugt festlegen</Button>
        )}
        {custom && (
          <Button size="sm" variant="destructive" disabled={busy || d.is_primary} onClick={() => setConfirm({
            title: "Custom Domain entfernen?", text: `${d.domain} wird entfernt. Firmendaten und Branding bleiben erhalten.`,
            run: async () => { await removeDomain(d.id); onClose(); },
          })}>Entfernen</Button>
        )}
      </div>
      {d.is_primary && custom && <p className="text-xs text-muted-foreground">Bevorzugte Domain kann nicht deaktiviert oder entfernt werden – zuerst eine andere Domain bevorzugen.</p>}

      <div>
        <div className="mb-2 text-sm font-semibold">Branding-Vorschau (öffentliche Metadaten)</div>
        <QueryState isLoading={branding.isLoading} error={branding.error} />
        {b ? (
          <div className="space-y-2 rounded-md border p-3">
            <Row k="Firmenname" v={b.company_name ?? "–"} />
            <Row k="Logo" v={b.logo_url ? <img src={b.logo_url} alt="Logo" className="h-8 w-auto" /> : "–"} />
            <Row k="Favicon" v={b.favicon_url ? <img src={b.favicon_url} alt="Favicon" className="h-6 w-6" /> : "–"} />
            {(["primary", "accent"] as const).map((k) => {
              const c = b[`app_${k}_color`] ?? b[`${k}_color`];
              return <Row key={k} k={k === "primary" ? "Primary Color" : "Accent Color"} v={c ? <span className="inline-flex items-center gap-2"><span className="h-4 w-4 rounded border" style={{ background: c }} />{c}</span> : "–"} />;
            })}
          </div>
        ) : !branding.isLoading && <div className="text-sm text-muted-foreground">Kein Branding hinterlegt.</div>}
      </div>

      <AlertDialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>{confirm?.title}</AlertDialogTitle><AlertDialogDescription>{confirm?.text}</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={() => { const c = confirm; setConfirm(null); if (c) act(c.run, "Gespeichert"); }}>Bestätigen</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function AddDomainDialog({ open, onOpenChange, agencyId }: { open: boolean; onOpenChange: (o: boolean) => void; agencyId?: string }) {
  const tenants = usePlatformTenants();
  const qc = useQueryClient();
  const [tenant, setTenant] = useState(agencyId ?? "");
  const [domain, setDomain] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    try {
      await addCustomDomain(tenant, domain);
      toast.success("Domain hinzugefügt – Status «Ausstehend»");
      await qc.invalidateQueries({ queryKey: ["platform"] });
      setDomain(""); onOpenChange(false);
    } catch (e) { toast.error(domainErrorText(e)); } finally { setBusy(false); }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Custom Domain hinzufügen</DialogTitle><DialogDescription>Die Domain startet als «Ausstehend» und muss per DNS bestätigt werden.</DialogDescription></DialogHeader>
        <div className="space-y-4">
          {!agencyId && (
            <div className="space-y-1"><Label>Unternehmen</Label>
              <Select value={tenant} onValueChange={setTenant}>
                <SelectTrigger><SelectValue placeholder="Unternehmen wählen" /></SelectTrigger>
                <SelectContent>{(tenants.data ?? []).map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          )}
          <div className="space-y-1"><Label>Domain</Label><Input placeholder="crm.kunde.ch" value={domain} onChange={(e) => setDomain(e.target.value)} /></div>
        </div>
        <DialogFooter><Button disabled={busy || !tenant || !domain.trim()} onClick={submit}>Hinzufügen</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function DomainCenter({ agencyId }: { agencyId?: string }) {
  const q = useDomainCenter(agencyId);
  const [selId, setSelId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const rows = q.data ?? [];
  const sel = rows.find((r) => r.id === selId) ?? null;
  const stats = [
    ["Gesamt", rows.length], ["Immolia-Adressen", rows.filter((r) => r.domain_type === "subdomain").length],
    ["Custom Domains", rows.filter((r) => r.domain_type === "custom").length], ["Aktiv", rows.filter((r) => r.domain_type === "custom" && domainActive(r)).length],
    ["Ausstehend", rows.filter((r) => r.verification_status === "pending").length], ["Fehler", rows.filter((r) => r.verification_status === "failed").length],
  ] as const;
  const showTenant = !agencyId;

  return (
    <div className="space-y-4">
      {showTenant && (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
          {stats.map(([k, v]) => <Card key={k}><CardContent className="p-4"><div className="text-xs text-muted-foreground">{k}</div><div className="text-2xl font-semibold">{v}</div></CardContent></Card>)}
        </div>
      )}
      {!IMMOLIA_WILDCARD_READY && <p className="text-xs text-muted-foreground">Hinweis: *.immolia.ch ist technisch noch nicht eingerichtet. Immolia-Adressen sind registriert, aber noch nicht erreichbar. «Aktiv» zählt nur Custom Domains.</p>}
      <div className="flex justify-end"><Button size="sm" onClick={() => setAdding(true)}>Custom Domain hinzufügen</Button></div>
      <QueryState isLoading={q.isLoading} error={q.error} />
      <Card>
        <Table>
          <TableHeader><TableRow>
            {showTenant && <TableHead>Unternehmen</TableHead>}<TableHead>Domain</TableHead><TableHead>Typ</TableHead><TableHead>Bevorzugt</TableHead>
            <TableHead>Verifizierung</TableHead><TableHead>Aktiv</TableHead><TableHead>Branding</TableHead><TableHead>Erstellt</TableHead><TableHead />
          </TableRow></TableHeader>
          <TableBody>
            {rows.map((d) => (
              <TableRow key={d.id} className="cursor-pointer" onClick={() => setSelId(d.id)}>
                {showTenant && <TableCell>{d.agency_name}</TableCell>}
                <TableCell className="font-medium">{d.domain}</TableCell>
                <TableCell>{d.domain_type === "subdomain" ? "Immolia-Adresse" : "Custom Domain"}</TableCell>
                <TableCell>{d.is_primary ? "Ja" : "Nein"}</TableCell>
                <TableCell><VerBadge s={d.verification_status} /></TableCell>
                <TableCell><ActiveCell d={d} /></TableCell>
                <TableCell>{d.has_branding ? "Konfiguriert" : "Standard"}</TableCell>
                <TableCell>{fmtDate(d.created_at)}</TableCell>
                <TableCell><Button size="sm" variant="ghost">Details</Button></TableCell>
              </TableRow>
            ))}
            {!rows.length && !q.isLoading && <TableRow><TableCell colSpan={9} className="text-center text-sm text-muted-foreground">Keine Domains.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </Card>
      <Sheet open={!!sel} onOpenChange={(o) => !o && setSelId(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          <SheetHeader><SheetTitle>{sel?.domain}</SheetTitle><SheetDescription>Domain-Metadaten. Keine CRM-Daten.</SheetDescription></SheetHeader>
          {sel && <DomainDetail key={sel.id} d={sel} onClose={() => setSelId(null)} />}
        </SheetContent>
      </Sheet>
      <AddDomainDialog open={adding} onOpenChange={setAdding} agencyId={agencyId} />
    </div>
  );
}

/** White-Label-Übersicht für /platform/tenants/$agencyId (nur Lesen). */
export function WhiteLabelSummary({ agencyId }: { agencyId: string }) {
  const b = usePlatformBranding(agencyId);
  const d = useDomainCenter(agencyId);
  const x = b.data;
  const rows = d.data ?? [];
  const sub = rows.find((r) => r.domain_type === "subdomain");
  const customs = rows.filter((r) => r.domain_type === "custom");
  const pref = rows.find((r) => r.is_primary);
  const yn = (v: unknown) => (v ? "Ja" : "Nein");
  return (
    <div>
      <QueryState isLoading={b.isLoading || d.isLoading} error={b.error ?? d.error} />
      <Row k="Firmenname" v={x?.company_name ?? "–"} />
      <Row k="Logo vorhanden" v={yn(x?.logo_url)} />
      <Row k="Favicon vorhanden" v={yn(x?.favicon_url)} />
      <Row k="Farben konfiguriert" v={yn(x?.app_primary_color || x?.primary_color)} />
      <Row k="Login-Branding konfiguriert" v={yn(x?.login_title)} />
      <Row k="Immolia-Adresse" v={sub ? `${sub.domain}${IMMOLIA_WILDCARD_READY ? "" : " (registriert, Wildcard noch nicht eingerichtet)"}` : "–"} />
      <Row k="Custom Domains" v={customs.length ? customs.map((c) => `${c.domain} (${VERIFICATION_LABEL[c.verification_status]}${domainActive(c) ? ", aktiv" : ""})`).join(", ") : "–"} />
      <Row k="Bevorzugte Domain" v={pref?.domain ?? "–"} />
      <p className="mt-3 text-xs text-muted-foreground">Branding wird vom Inhaber/Admin des Unternehmens gepflegt. Hier nur Ansicht.</p>
    </div>
  );
}
