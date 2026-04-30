import { useMemo, useRef, useState } from "react";
import Papa from "papaparse";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2, ChevronRight, ChevronLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import {
  applyMapping,
  autoDetectMapping,
  buildStagedLead,
  LEAD_FIELD_LABELS,
  type LeadField,
  type StagedLead,
} from "@/lib/lead-import";

type Variant = "csv" | "casaone";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  variant: Variant;
};

type Step = "upload" | "mapping" | "preview" | "result";

const TITLES: Record<Variant, string> = {
  csv: "CSV Import",
  casaone: "Import aus CasaOne",
};

const SOURCE_FOR_VARIANT: Record<Variant, { source: string; import_source: string }> = {
  csv: { source: "Import", import_source: "CSV Import" },
  casaone: { source: "CasaOne", import_source: "CasaOne CRM" },
};

export function LeadImportWizard({ open, onOpenChange, variant }: Props) {
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<Step>("upload");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [mapping, setMapping] = useState<Record<number, LeadField>>({});
  const [staged, setStaged] = useState<StagedLead[]>([]);
  const [importedCount, setImportedCount] = useState(0);
  const [skippedCount, setSkippedCount] = useState(0);
  const [updatedCount, setUpdatedCount] = useState(0);
  const [batchId, setBatchId] = useState<string | null>(null);

  const reset = () => {
    setStep("upload");
    setHeaders([]);
    setRows([]);
    setMapping({});
    setStaged([]);
    setImportedCount(0);
    setSkippedCount(0);
    setUpdatedCount(0);
    setBatchId(null);
  };

  const handleClose = (v: boolean) => {
    if (!v) reset();
    onOpenChange(v);
  };

  const handleFile = (file: File) => {
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        if (result.errors.length > 0 && result.data.length === 0) {
          toast.error(`CSV konnte nicht gelesen werden: ${result.errors[0].message}`);
          return;
        }
        const fields = (result.meta.fields ?? []).filter(Boolean);
        if (fields.length === 0) {
          toast.error("Keine Spalten in der Datei gefunden.");
          return;
        }
        setHeaders(fields);
        setRows(result.data);
        const auto = autoDetectMapping(fields);
        setMapping(auto);
        // CasaOne springt direkt zur Vorschau (Auto-Mapping vertrauen)
        if (variant === "casaone") {
          buildPreviewWith(fields, auto, result.data);
          setStep("preview");
        } else {
          setStep("mapping");
        }
      },
      error: (err) => {
        toast.error(`CSV konnte nicht gelesen werden: ${err.message}`);
      },
    });
  };

  const buildPreviewWith = async (
    hdrs: string[],
    map: Record<number, LeadField>,
    rs: Record<string, string>[],
  ) => {
    const items = rs.map((raw, i) => buildStagedLead(i, applyMapping(raw, hdrs, map)));

    // Dublettencheck nach E-Mail oder old_crm_id
    const emails = items.map((x) => x.email?.toLowerCase()).filter(Boolean) as string[];
    const oldIds = items.map((x) => x.old_crm_id).filter(Boolean) as string[];

    const dupMap = new Map<string, string>(); // key -> existing lead id
    if (emails.length > 0) {
      const { data } = await supabase
        .from("leads")
        .select("id, email")
        .in("email", emails);
      data?.forEach((r) => {
        if (r.email) dupMap.set(`email:${r.email.toLowerCase()}`, r.id);
      });
    }
    if (oldIds.length > 0) {
      const { data } = await supabase
        .from("leads")
        .select("id, old_crm_id")
        .in("old_crm_id", oldIds);
      data?.forEach((r) => {
        if (r.old_crm_id) dupMap.set(`old:${r.old_crm_id}`, r.id);
      });
    }

    items.forEach((it) => {
      const k1 = it.email ? `email:${it.email.toLowerCase()}` : null;
      const k2 = it.old_crm_id ? `old:${it.old_crm_id}` : null;
      const dup = (k2 && dupMap.get(k2)) || (k1 && dupMap.get(k1)) || null;
      it.duplicate_of = dup;
      if (dup) it.decision = "skip";
      if (it.errors.length > 0) it.decision = "skip";
    });
    setStaged(items);
  };

  const goToPreview = async () => {
    await buildPreviewWith(headers, mapping, rows);
    setStep("preview");
  };

  const importMutation = useMutation({
    mutationFn: async () => {
      const sourceCfg = SOURCE_FOR_VARIANT[variant];
      const newBatchId = crypto.randomUUID();
      setBatchId(newBatchId);

      const toInsert = staged
        .filter((s) => s.decision === "create")
        .map((s) => ({
          full_name: s.full_name,
          email: s.email,
          phone: s.phone,
          source: sourceCfg.source,
          notes: s.notes,
          status: (s.status ?? "new") as "new",
          entity_type: s.entity_type,
          company_name: s.company_name,
          contact_first_name: s.contact_first_name,
          contact_last_name: s.contact_last_name,
          secondary_email: s.secondary_email,
          phone_direct: s.phone_direct,
          mobile: s.mobile,
          address: s.address,
          postal_code: s.postal_code,
          city: s.city,
          country: s.country,
          website: s.website,
          language: s.language,
          tags: s.tags,
          internal_notes: s.internal_notes,
          old_crm_id: s.old_crm_id,
          old_crm_created_at: s.old_crm_created_at,
          old_crm_updated_at: s.old_crm_updated_at,
          import_source: sourceCfg.import_source,
          import_batch_id: newBatchId,
        }));

      let inserted = 0;
      if (toInsert.length > 0) {
        // Chunked insert (in Schüben à 200, falls große Dateien)
        for (let i = 0; i < toInsert.length; i += 200) {
          const chunk = toInsert.slice(i, i + 200);
          const { error, count } = await supabase
            .from("leads")
            .insert(chunk, { count: "exact" });
          if (error) throw error;
          inserted += count ?? chunk.length;
        }
      }

      // Updates für Dubletten mit decision=update
      let updated = 0;
      const toUpdate = staged.filter((s) => s.decision === "update" && s.duplicate_of);
      for (const s of toUpdate) {
        const { error } = await supabase
          .from("leads")
          .update({
            full_name: s.full_name,
            email: s.email ?? undefined,
            phone: s.phone ?? undefined,
            company_name: s.company_name,
            contact_first_name: s.contact_first_name,
            contact_last_name: s.contact_last_name,
            secondary_email: s.secondary_email,
            phone_direct: s.phone_direct,
            mobile: s.mobile,
            address: s.address,
            postal_code: s.postal_code,
            city: s.city,
            country: s.country,
            website: s.website,
            language: s.language,
            tags: s.tags,
            notes: s.notes,
            internal_notes: s.internal_notes,
            entity_type: s.entity_type,
            import_source: sourceCfg.import_source,
            import_batch_id: newBatchId,
            old_crm_updated_at: s.old_crm_updated_at,
          })
          .eq("id", s.duplicate_of!);
        if (error) throw error;
        updated++;
      }

      const skipped = staged.filter((s) => s.decision === "skip").length;
      return { inserted, updated, skipped };
    },
    onSuccess: ({ inserted, updated, skipped }) => {
      setImportedCount(inserted);
      setUpdatedCount(updated);
      setSkippedCount(skipped);
      setStep("result");
      qc.invalidateQueries({ queryKey: ["leads"] });
      toast.success(
        `${inserted} importiert, ${updated} aktualisiert, ${skipped} übersprungen.`,
      );
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const stats = useMemo(() => {
    const total = staged.length;
    const persons = staged.filter((s) => s.entity_type === "person").length;
    const companies = staged.filter((s) => s.entity_type === "company").length;
    const companiesWithContact = staged.filter(
      (s) => s.entity_type === "company" && (s.contact_first_name || s.contact_last_name),
    ).length;
    const dups = staged.filter((s) => s.duplicate_of).length;
    const noEmail = staged.filter((s) => !s.email).length;
    const noPhone = staged.filter((s) => !s.phone && !s.mobile).length;
    const errors = staged.filter((s) => s.errors.length > 0).length;
    return { total, persons, companies, companiesWithContact, dups, noEmail, noPhone, errors };
  }, [staged]);

  const allMappedFields = useMemo(() => Object.values(mapping), [mapping]);
  const hasName = allMappedFields.some((f) =>
    ["full_name", "contact_first_name", "contact_last_name", "company_name"].includes(f),
  );

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            {TITLES[variant]}
          </DialogTitle>
        </DialogHeader>

        {/* STEP: UPLOAD */}
        {step === "upload" && (
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              {variant === "casaone"
                ? "Lade deine CasaOne-Exportdatei (.csv) hoch. ASIMOS erkennt Felder, Personen, Firmen und Kontaktpersonen automatisch."
                : "Lade deine CSV-Datei hoch. Im nächsten Schritt kannst du die Spalten manuell zuordnen."}
            </p>
            <div
              className="rounded-xl border-2 border-dashed border-muted-foreground/30 bg-muted/20 p-12 text-center cursor-pointer hover:bg-muted/30 transition"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="mx-auto h-10 w-10 text-muted-foreground" />
              <p className="mt-2 font-medium">CSV-Datei auswählen</p>
              <p className="text-xs text-muted-foreground">oder hierher ziehen</p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFile(file);
                }}
              />
            </div>
          </div>
        )}

        {/* STEP: MAPPING */}
        {step === "mapping" && (
          <div className="space-y-4 overflow-y-auto py-2">
            <p className="text-sm text-muted-foreground">
              Ordne jede CSV-Spalte einem Lead-Feld zu. Spalten die nicht benötigt werden, kannst du auf "ignorieren" setzen.
            </p>
            {!hasName && (
              <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-400 flex items-start gap-2">
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                <span>Mindestens eines dieser Felder sollte zugeordnet sein: Name, Vorname/Nachname oder Firma.</span>
              </div>
            )}
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-1/3">CSV-Spalte</TableHead>
                    <TableHead className="w-1/3">Beispielwert</TableHead>
                    <TableHead className="w-1/3">Lead-Feld</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {headers.map((h, idx) => (
                    <TableRow key={`${h}-${idx}`}>
                      <TableCell className="font-medium">{h}</TableCell>
                      <TableCell className="text-xs text-muted-foreground truncate max-w-[200px]">
                        {rows[0]?.[h] ?? "—"}
                      </TableCell>
                      <TableCell>
                        <Select
                          value={mapping[idx] ?? "skip"}
                          onValueChange={(v) =>
                            setMapping((prev) => ({ ...prev, [idx]: v as LeadField }))
                          }
                        >
                          <SelectTrigger className="h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {(Object.keys(LEAD_FIELD_LABELS) as LeadField[]).map((f) => (
                              <SelectItem key={f} value={f}>
                                {LEAD_FIELD_LABELS[f]}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        {/* STEP: PREVIEW */}
        {step === "preview" && (
          <div className="space-y-4 overflow-y-auto py-2">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <StatCard label="Zeilen gesamt" value={stats.total} />
              <StatCard label="Personen" value={stats.persons} />
              <StatCard label="Firmen" value={stats.companies} />
              <StatCard label="Firmen mit Kontakt" value={stats.companiesWithContact} />
              <StatCard label="Mögliche Dubletten" value={stats.dups} tone={stats.dups > 0 ? "warn" : undefined} />
              <StatCard label="Ohne E-Mail" value={stats.noEmail} tone={stats.noEmail > 0 ? "muted" : undefined} />
              <StatCard label="Ohne Telefon" value={stats.noPhone} tone={stats.noPhone > 0 ? "muted" : undefined} />
              <StatCard label="Fehlerhafte Zeilen" value={stats.errors} tone={stats.errors > 0 ? "error" : undefined} />
            </div>

            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>Typ</TableHead>
                    <TableHead>Name / Firma</TableHead>
                    <TableHead>E-Mail</TableHead>
                    <TableHead>Telefon</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Aktion</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {staged.slice(0, 200).map((s) => (
                    <TableRow key={s.row_index} className={cn(s.errors.length > 0 && "bg-destructive/5")}>
                      <TableCell className="text-xs text-muted-foreground">{s.row_index + 1}</TableCell>
                      <TableCell>
                        <Badge variant={s.entity_type === "company" ? "default" : "secondary"} className="text-[10px]">
                          {s.entity_type === "company" ? "Firma" : "Person"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        <div className="font-medium">{s.full_name}</div>
                        {s.errors.length > 0 && (
                          <div className="text-xs text-destructive flex items-center gap-1">
                            <AlertCircle className="h-3 w-3" />
                            {s.errors[0]}
                          </div>
                        )}
                        {s.duplicate_of && (
                          <div className="text-xs text-amber-600 dark:text-amber-400">
                            Mögliche Dublette
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-xs">{s.email ?? "—"}</TableCell>
                      <TableCell className="text-xs">{s.phone ?? s.mobile ?? "—"}</TableCell>
                      <TableCell className="text-xs">{s.status ?? "new"}</TableCell>
                      <TableCell>
                        <Select
                          value={s.decision}
                          onValueChange={(v) =>
                            setStaged((prev) =>
                              prev.map((x) =>
                                x.row_index === s.row_index
                                  ? { ...x, decision: v as StagedLead["decision"] }
                                  : x,
                              ),
                            )
                          }
                          disabled={s.errors.length > 0}
                        >
                          <SelectTrigger className="h-7 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="create">Neu anlegen</SelectItem>
                            {s.duplicate_of && <SelectItem value="update">Bestehenden updaten</SelectItem>}
                            <SelectItem value="skip">Überspringen</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {staged.length > 200 && (
                <div className="p-2 text-center text-xs text-muted-foreground border-t">
                  Zeige die ersten 200 von {staged.length} Zeilen. Beim Import werden alle verarbeitet.
                </div>
              )}
            </div>
          </div>
        )}

        {/* STEP: RESULT */}
        {step === "result" && (
          <div className="space-y-4 py-6 text-center">
            <CheckCircle2 className="mx-auto h-12 w-12 text-green-500" />
            <h3 className="text-xl font-semibold">Import abgeschlossen</h3>
            <div className="grid grid-cols-3 gap-2 max-w-md mx-auto">
              <StatCard label="Neu" value={importedCount} tone="success" />
              <StatCard label="Aktualisiert" value={updatedCount} />
              <StatCard label="Übersprungen" value={skippedCount} tone="muted" />
            </div>
            {batchId && (
              <p className="text-xs text-muted-foreground">
                Batch-ID: <code className="font-mono">{batchId.slice(0, 8)}…</code>
              </p>
            )}
          </div>
        )}

        <DialogFooter className="border-t pt-3">
          {step === "upload" && (
            <Button variant="outline" onClick={() => handleClose(false)}>
              Abbrechen
            </Button>
          )}
          {step === "mapping" && (
            <>
              <Button variant="outline" onClick={() => setStep("upload")}>
                <ChevronLeft className="mr-1 h-4 w-4" />
                Zurück
              </Button>
              <Button onClick={goToPreview} disabled={!hasName}>
                Weiter zur Vorschau
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </>
          )}
          {step === "preview" && (
            <>
              <Button
                variant="outline"
                onClick={() => setStep(variant === "casaone" ? "upload" : "mapping")}
              >
                <ChevronLeft className="mr-1 h-4 w-4" />
                Zurück
              </Button>
              <Button
                onClick={() => importMutation.mutate()}
                disabled={importMutation.isPending || staged.filter((s) => s.decision !== "skip").length === 0}
              >
                {importMutation.isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
                {staged.filter((s) => s.decision === "create").length} importieren
                {staged.filter((s) => s.decision === "update").length > 0 &&
                  ` · ${staged.filter((s) => s.decision === "update").length} updaten`}
              </Button>
            </>
          )}
          {step === "result" && (
            <Button onClick={() => handleClose(false)}>Fertig</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "warn" | "error" | "success" | "muted";
}) {
  return (
    <div
      className={cn(
        "rounded-md border bg-card p-2 text-center",
        tone === "warn" && "border-amber-500/40 bg-amber-500/5",
        tone === "error" && "border-destructive/40 bg-destructive/5",
        tone === "success" && "border-green-500/40 bg-green-500/5",
      )}
    >
      <div className={cn("text-lg font-semibold", tone === "error" && "text-destructive", tone === "muted" && "text-muted-foreground")}>
        {value}
      </div>
      <div className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</div>
    </div>
  );
}
