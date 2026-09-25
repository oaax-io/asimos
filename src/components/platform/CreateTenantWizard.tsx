import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { InviteLinkBox } from "@/components/invitations/InvitationUI";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import {
  ALL_MODULES, CORE_MODULES, MODULE_LABEL, OWNER_STATUS_LABEL, checkSubdomain, checkOwnerEmail, createTenant, slugify,
  type SubdomainCheck, type CreateTenantResult,
} from "@/lib/platform-admin";

const ROOT = "immolia.ch";
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i;
const SLUG_MSG: Record<SubdomainCheck, string> = {
  available: "Adresse ist verfügbar", taken: "Adresse ist bereits vergeben",
  reserved: "Adresse ist reserviert", invalid: "Nur a–z, 0–9 und Bindestrich, 2–40 Zeichen, nicht mit Bindestrich beginnen/enden",
};
const ERR: Record<string, string> = {
  invalid_name: "Bitte gültigen Firmennamen eingeben.", invalid_owner: "Bitte Vor- und Nachname des Inhabers angeben.",
  invalid_email: "Bitte gültige E-Mail-Adresse eingeben.", slug_taken: "Die Immolia-Adresse ist bereits vergeben.",
  slug_reserved: "Die Immolia-Adresse ist reserviert.", slug_invalid: "Die Immolia-Adresse ist ungültig.",
};

export function CreateTenantWizard() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [slugState, setSlugState] = useState<SubdomainCheck | "checking" | null>(null);
  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [email, setEmail] = useState("");
  const [ownerExists, setOwnerExists] = useState<boolean | null>(null);
  const [modules, setModules] = useState<string[]>(CORE_MODULES);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CreateTenantResult | null>(null);

  const reset = () => {
    setStep(1); setName(""); setSlug(""); setSlugTouched(false); setSlugState(null); setFirst(""); setLast(""); setEmail("");
    setOwnerExists(null); setModules(CORE_MODULES); setError(null); setResult(null);
  };

  useEffect(() => { if (!slugTouched) setSlug(slugify(name)); }, [name, slugTouched]);
  useEffect(() => {
    if (!slug) { setSlugState(null); return; }
    setSlugState("checking");
    const t = setTimeout(() => { checkSubdomain(slug).then(setSlugState).catch(() => setSlugState(null)); }, 350);
    return () => clearTimeout(t);
  }, [slug]);

  const step1Ok = name.trim().length > 0 && slugState === "available";
  const step2Ok = first.trim() && last.trim() && EMAIL_RE.test(email.trim());

  const goStep3 = async () => {
    setError(null); setBusy(true);
    try { setOwnerExists(await checkOwnerEmail(email.trim())); setStep(3); }
    catch { setError("Prüfung fehlgeschlagen."); } finally { setBusy(false); }
  };

  const submit = async () => {
    setError(null); setBusy(true);
    try {
      const r = await createTenant({ name: name.trim(), slug, firstName: first.trim(), lastName: last.trim(), email: email.trim(), modules });
      setResult(r);
      qc.invalidateQueries({ queryKey: ["platform"] });
    } catch (e) {
      const msg = (e as { message?: string })?.message ?? "";
      setError(ERR[msg] ?? "Unternehmen konnte nicht erstellt werden. Es wurde nichts gespeichert.");
    } finally { setBusy(false); }
  };

  const domain = `${slug || "…"}.${ROOT}`;
  const ownerStatus = ownerExists ? "active" : "pending_invitation";

  return (
    <>
      <Button onClick={() => { reset(); setOpen(true); }}><Plus className="mr-1 h-4 w-4" />Neues Unternehmen</Button>
      <Dialog open={open} onOpenChange={(o) => { if (!busy) setOpen(o); }}>
        <DialogContent className="max-w-lg">
          {result ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2"><CheckCircle2 className="h-5 w-5 text-primary" />Unternehmen erstellt</DialogTitle>
              </DialogHeader>
              <Summary rows={[
                ["Firmenname", result.name], ["Tenant-ID", <code key="id" className="text-xs">{result.agency_id}</code>],
                ["Immolia-Adresse", result.domain], ["Owner", `${first} ${last} · ${email}`],
                ["Owner-Status", OWNER_STATUS_LABEL[result.owner_status] ?? result.owner_status],
                ["Module", result.modules.map((m) => MODULE_LABEL[m] ?? m).join(", ") || "–"],
              ]} />
              {result.invitation_token && <InviteLinkBox token={result.invitation_token} />}
              <DomainNote />
              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => setOpen(false)}>Zur Unternehmensliste</Button>
                <Button asChild><Link to="/platform/tenants/$agencyId" params={{ agencyId: result.agency_id }}>Unternehmen öffnen</Link></Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle>{step === 1 ? "Unternehmen erstellen" : step === 2 ? "Inhaber" : step === 3 ? "Grundeinstellungen" : "Zusammenfassung"}</DialogTitle>
                <DialogDescription>Schritt {step} von 4 · Es werden keine Daten anderer Unternehmen übernommen.</DialogDescription>
              </DialogHeader>

              {step === 1 && (
                <div className="space-y-4">
                  <div className="space-y-1.5"><Label>Firmenname *</Label><Input value={name} maxLength={120} onChange={(e) => setName(e.target.value)} placeholder="Bergblick Immobilien AG" /></div>
                  <div className="space-y-1.5">
                    <Label>Immolia-Adresse *</Label>
                    <Input value={slug} maxLength={40} onChange={(e) => { setSlugTouched(true); setSlug(e.target.value.toLowerCase().replace(/\s/g, "")); }} placeholder="bergblick" />
                    <div className="text-sm font-medium">{domain}</div>
                    {slugState && <div className={`text-xs ${slugState === "available" ? "text-primary" : "text-destructive"}`}>
                      {slugState === "checking" ? "Prüfe Verfügbarkeit …" : SLUG_MSG[slugState]}
                    </div>}
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5"><Label>Vorname *</Label><Input value={first} maxLength={80} onChange={(e) => setFirst(e.target.value)} /></div>
                    <div className="space-y-1.5"><Label>Nachname *</Label><Input value={last} maxLength={80} onChange={(e) => setLast(e.target.value)} /></div>
                  </div>
                  <div className="space-y-1.5"><Label>E-Mail *</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                    {email && !EMAIL_RE.test(email.trim()) && <div className="text-xs text-destructive">Ungültige E-Mail-Adresse</div>}</div>
                  <p className="text-xs text-muted-foreground">Es wird kein Passwort vergeben und noch keine Einladung versendet.</p>
                </div>
              )}

              {step === 3 && (
                <div className="space-y-4">
                  <Summary rows={[["Status", "Aktiv"], ["Immolia-Adresse", domain], ["Owner", `${first} ${last} · ${email}`],
                    ["Owner-Status", OWNER_STATUS_LABEL[ownerStatus]]]} />
                  <div>
                    <div className="mb-2 text-sm font-medium">Freigeschaltete Module</div>
                    <div className="grid max-h-56 grid-cols-2 gap-2 overflow-y-auto">
                      {ALL_MODULES.map((m) => (
                        <label key={m} className="flex items-center gap-2 text-sm">
                          <Checkbox checked={m === "dashboard" || modules.includes(m)} disabled={m === "dashboard"} onCheckedChange={(c) => setModules((x) => c ? [...x, m] : x.filter((y) => y !== m))} />
                          {MODULE_LABEL[m]}{m === "dashboard" && <span className="text-xs text-muted-foreground">(Kernmodul)</span>}
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {step === 4 && (
                <>
                  <Summary rows={[["Unternehmen", name.trim()], ["Immolia-Adresse", domain], ["Owner", `${first} ${last} · ${email}`],
                    ["Owner-Status", OWNER_STATUS_LABEL[ownerStatus]], ["Status", "Aktiv"],
                    ["Module", modules.map((m) => MODULE_LABEL[m]).join(", ") || "–"]]} />
                  <DomainNote />
                </>
              )}

              {error && <div className="text-sm text-destructive">{error}</div>}
              <DialogFooter className="gap-2">
                {step > 1 && <Button variant="outline" disabled={busy} onClick={() => setStep(step - 1)}>Zurück</Button>}
                {step === 1 && <Button disabled={!step1Ok} onClick={() => setStep(2)}>Weiter</Button>}
                {step === 2 && <Button disabled={!step2Ok || busy} onClick={goStep3}>{busy && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}Weiter</Button>}
                {step === 3 && <Button onClick={() => setStep(4)}>Weiter</Button>}
                {step === 4 && <Button disabled={busy} onClick={submit}>{busy && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}Unternehmen erstellen</Button>}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function Summary({ rows }: { rows: Array<[string, React.ReactNode]> }) {
  return (
    <div className="rounded-md border">
      {rows.map(([k, v]) => (
        <div key={k} className="flex gap-3 border-b px-3 py-2 text-sm last:border-0">
          <span className="w-32 shrink-0 text-muted-foreground">{k}</span><span className="min-w-0 break-words">{v}</span>
        </div>
      ))}
    </div>
  );
}

export function DomainNote() {
  return (
    <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
      Domain technisch noch nicht verbunden: Die Immolia-Adresse ist erfasst, wird aber erst erreichbar, wenn *.immolia.ch
      beim Hosting eingerichtet ist.
    </p>
  );
}
