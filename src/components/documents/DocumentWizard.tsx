import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { GeneratePdfButton } from "@/components/documents/GeneratePdfButton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Check, ChevronLeft, ChevronRight, Eye, FileText, Send } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import {
  defaultTemplateForType,
  findMissingVariables,
  renderTemplate,
  wrapHtmlDocument,
  type TemplateContext,
} from "@/lib/document-templates";
import { resolveDocumentContext, labelForVariable } from "@/lib/document-context";
import { cn } from "@/lib/utils";

type DocumentKind = "reservation" | "mandate" | "mandate_partial" | "reservation_receipt" | "nda";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kind: DocumentKind;
  // Optional preselections – wizard will skip those steps
  defaultClientId?: string;
  defaultPropertyId?: string;
  // The DB record this generated_document is attached to
  relatedType: "reservation" | "mandate" | "nda";
  relatedId: string;
  // Extra static data the user already filled (commission, fee, dates, …)
  extraContext?: Partial<TemplateContext>;
  onCompleted?: (generatedDocId: string) => void;
};

const KIND_LABELS: Record<DocumentKind, string> = {
  reservation: "Reservationsvereinbarung",
  reservation_receipt: "Reservations-Quittung",
  mandate: "Maklermandat (exklusiv)",
  mandate_partial: "Maklermandat (teilexklusiv)",
  nda: "Vertraulichkeitsvereinbarung (NDA)",
};

const STEPS = ["Vorlage", "Daten prüfen", "Vorschau & speichern"] as const;

export function DocumentWizard({
  open,
  onOpenChange,
  kind,
  defaultClientId,
  defaultPropertyId,
  relatedType,
  relatedId,
  extraContext,
  onCompleted,
}: Props) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [step, setStep] = useState(0);
  const [templateId, setTemplateId] = useState<string>("");
  const [bankAccountId, setBankAccountId] = useState<string>("");
  const [partnerClientId, setPartnerClientId] = useState<string>("");
  const [missingValues, setMissingValues] = useState<Record<string, string>>({});

  // Map kind -> document_type stored on templates
  const dbType = kind;

  const { data: templates = [] } = useQuery({
    queryKey: ["templates-by-kind", dbType],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("document_templates")
        .select("*")
        .eq("type", dbType as any)
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: banks = [] } = useQuery({
    queryKey: ["bank-accounts-active"],
    enabled: open && (kind === "reservation" || kind === "reservation_receipt"),
    queryFn: async () => {
      const { data } = await supabase
        .from("bank_accounts" as any)
        .select("id, label, bank_name, iban, is_default")
        .eq("is_active", true)
        .order("is_default", { ascending: false });
      return (data as any[]) ?? [];
    },
  });

  const { data: relationCandidates = [] } = useQuery({
    queryKey: ["client-rels", defaultClientId],
    enabled: open && !!defaultClientId,
    queryFn: async () => {
      const { data } = await supabase
        .from("client_relationships")
        .select("related_client_id, relationship_type, clients:related_client_id(full_name)")
        .eq("client_id", defaultClientId!);
      return (data as any[]) ?? [];
    },
  });

  // Reset on open
  useEffect(() => {
    if (open) {
      setStep(0);
      setMissingValues({});
      setPartnerClientId("");
      const def = banks.find((b) => b.is_default);
      setBankAccountId(def?.id ?? "");
    }
  }, [open, banks]);

  // Auto-select first template
  useEffect(() => {
    if (open && templates.length > 0 && !templateId) {
      setTemplateId(templates[0].id);
    }
  }, [open, templates, templateId]);

  const selectedTemplate = templates.find((t) => t.id === templateId);
  const templateContent = selectedTemplate?.content ?? defaultTemplateForType(kind);

  // Build context from CRM
  const { data: ctx, isLoading: ctxLoading, refetch: refetchCtx } = useQuery({
    queryKey: ["doc-ctx", kind, defaultClientId, defaultPropertyId, bankAccountId, partnerClientId, JSON.stringify(extraContext ?? {})],
    enabled: open && step >= 1,
    queryFn: () =>
      resolveDocumentContext({
        clientId: defaultClientId,
        propertyId: defaultPropertyId,
        bankAccountId: bankAccountId || undefined,
        partnerClientId: partnerClientId || undefined,
        overrides: extraContext,
      }),
  });

  const missing = useMemo(() => {
    if (!ctx) return [];
    // Apply user-supplied missing values to context for re-checking
    const merged = applyMissingToContext(ctx, missingValues);
    return findMissingVariables(templateContent, merged);
  }, [ctx, templateContent, missingValues]);

  const finalContext = useMemo(() => {
    if (!ctx) return null;
    return applyMissingToContext(ctx, missingValues);
  }, [ctx, missingValues]);

  const previewHtml = useMemo(() => {
    if (!finalContext) return "";
    return wrapHtmlDocument(KIND_LABELS[kind], renderTemplate(templateContent, finalContext), finalContext.brand);
  }, [finalContext, templateContent, kind]);

  const save = useMutation({
    mutationFn: async () => {
      if (!selectedTemplate || !finalContext) throw new Error("Bitte Vorlage und Daten wählen");
      const { data: doc, error } = await supabase
        .from("generated_documents")
        .insert({
          template_id: selectedTemplate.id,
          related_type: relatedType,
          related_id: relatedId,
          html_content: previewHtml,
          variables: JSON.parse(JSON.stringify(finalContext)),
          created_by: user?.id ?? null,
          title: KIND_LABELS[kind],
          document_type: kind,
          status: "ready",
        } as any)
        .select("id")
        .single();
      if (error) throw error;

      // Link back to source record
      const targetTable =
        relatedType === "reservation" ? "reservations" : relatedType === "mandate" ? "mandates" : "nda_agreements";
      await supabase.from(targetTable as any).update({ generated_document_id: doc.id }).eq("id", relatedId);
      return doc.id as string;
    },
    onSuccess: (id) => {
      toast.success("Dokument gespeichert");
      qc.invalidateQueries({ queryKey: ["mandates"] });
      qc.invalidateQueries({ queryKey: ["reservations"] });
      qc.invalidateQueries({ queryKey: ["nda-agreements"] });
      qc.invalidateQueries({ queryKey: ["generated-documents"] });
      onCompleted?.(id);
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const printPreview = () => {
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(previewHtml);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 300);
  };

  const next = () => setStep((s) => Math.min(s + 1, STEPS.length - 1));
  const back = () => setStep((s) => Math.max(s - 1, 0));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="size-5" /> {KIND_LABELS[kind]}
          </DialogTitle>
        </DialogHeader>

        {/* Stepper */}
        <ol className="flex items-center gap-2">
          {STEPS.map((label, i) => (
            <li key={label} className="flex items-center gap-2">
              <span
                className={cn(
                  "flex size-7 items-center justify-center rounded-full border text-xs font-medium",
                  i < step && "border-primary bg-primary text-primary-foreground",
                  i === step && "border-primary text-primary",
                  i > step && "border-muted-foreground/30 text-muted-foreground",
                )}
              >
                {i < step ? <Check className="size-3.5" /> : i + 1}
              </span>
              <span className={cn("text-sm", i === step ? "font-medium" : "text-muted-foreground")}>{label}</span>
              {i < STEPS.length - 1 && <ChevronRight className="size-4 text-muted-foreground" />}
            </li>
          ))}
        </ol>

        <div className="min-h-[420px] py-2">
          {/* STEP 0: Template + bank + partner */}
          {step === 0 && (
            <div className="space-y-4">
              <div>
                <Label>Vorlage</Label>
                <Select value={templateId} onValueChange={setTemplateId}>
                  <SelectTrigger>
                    <SelectValue placeholder={templates.length === 0 ? "Keine passende Vorlage – Standard wird genutzt" : "Vorlage wählen"} />
                  </SelectTrigger>
                  <SelectContent>
                    {templates.map((t) => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {templates.length === 0 && (
                  <p className="mt-1 text-xs text-muted-foreground">Es ist keine aktive Vorlage für diesen Typ vorhanden. Es wird eine eingebaute Standardvorlage verwendet.</p>
                )}
              </div>

              {(kind === "reservation" || kind === "reservation_receipt") && (
                <div>
                  <Label>Bankkonto für Zahlungsangaben</Label>
                  <Select value={bankAccountId} onValueChange={setBankAccountId}>
                    <SelectTrigger>
                      <SelectValue placeholder={banks.length === 0 ? "Keine Bankkonten erfasst" : "Bankkonto wählen"} />
                    </SelectTrigger>
                    <SelectContent>
                      {banks.map((b) => (
                        <SelectItem key={b.id} value={b.id}>
                          {b.label} {b.is_default ? "· Standard" : ""} {b.iban ? `· ${b.iban}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {relationCandidates.length > 0 && (
                <div>
                  <Label>Mitunterzeichner aus Beziehungen (optional)</Label>
                  <Select value={partnerClientId} onValueChange={setPartnerClientId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Keiner" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Keiner</SelectItem>
                      {relationCandidates.map((r) => (
                        <SelectItem key={r.related_client_id} value={r.related_client_id}>
                          {r.clients?.full_name ?? "—"} ({r.relationship_type})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          )}

          {/* STEP 1: missing fields */}
          {step === 1 && (
            <div className="space-y-3">
              {ctxLoading ? (
                <p className="text-sm text-muted-foreground">Daten werden zusammengeführt…</p>
              ) : missing.length === 0 ? (
                <div className="rounded-lg border border-emerald-300/50 bg-emerald-50 p-4 text-sm text-emerald-900 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-200">
                  <Check className="mr-2 inline size-4" />
                  Alle benötigten Daten sind vorhanden. Du kannst direkt zur Vorschau wechseln.
                </div>
              ) : (
                <>
                  <div className="rounded-md border bg-muted/30 p-3 text-sm">
                    <p className="font-medium">Fehlende Angaben für diese Vorlage</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Nur diese Felder fehlen noch im CRM. Sie werden direkt ins Dokument übernommen.
                    </p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {missing.map((path) => (
                      <div key={path}>
                        <Label className="text-xs">{labelForVariable(path)}</Label>
                        <Input
                          value={missingValues[path] ?? ""}
                          onChange={(e) => setMissingValues((m) => ({ ...m, [path]: e.target.value }))}
                          placeholder={path}
                        />
                      </div>
                    ))}
                  </div>
                </>
              )}
              <div className="rounded-md border p-3 text-xs text-muted-foreground">
                <p className="font-medium text-foreground">Geladene CRM-Daten</p>
                <ContextSummary ctx={finalContext} />
              </div>
            </div>
          )}

          {/* STEP 2: preview */}
          {step === 2 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Eye className="size-4" /> Vorschau
                </div>
                <GeneratePdfButton
                  html={previewHtml}
                  title={KIND_LABELS[kind]}
                  documentType={kind}
                  clientName={finalContext?.client?.full_name ?? null}
                  propertyTitle={finalContext?.property?.title ?? null}
                  companyName={finalContext?.company?.name ?? finalContext?.brand?.company_name ?? null}
                  onPrintFallback={printPreview}
                  variant="outline"
                />
              </div>
              <iframe
                title="Vorschau"
                srcDoc={previewHtml}
                className="h-[55vh] w-full rounded-md border bg-white"
              />
              {missing.length > 0 && (
                <div className="rounded-md border border-amber-300/60 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
                  <Badge variant="outline" className="mr-2">{missing.length}</Badge>
                  Es fehlen noch Angaben. Du kannst trotzdem speichern – Lücken bleiben dann leer.
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t pt-3">
          <Button variant="ghost" onClick={back} disabled={step === 0}>
            <ChevronLeft className="mr-1 size-4" /> Zurück
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Abbrechen</Button>
            {step < STEPS.length - 1 ? (
              <Button onClick={next}>
                Weiter <ChevronRight className="ml-1 size-4" />
              </Button>
            ) : (
              <Button onClick={() => save.mutate()} disabled={save.isPending}>
                <Send className="mr-2 size-4" />
                {save.isPending ? "Wird gespeichert…" : "Dokument speichern"}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function applyMissingToContext(ctx: TemplateContext, values: Record<string, string>): TemplateContext {
  const result: TemplateContext = JSON.parse(JSON.stringify(ctx));
  for (const [path, value] of Object.entries(values)) {
    if (!value) continue;
    const parts = path.split(".");
    let cur: any = result;
    for (let i = 0; i < parts.length - 1; i++) {
      if (!cur[parts[i]] || typeof cur[parts[i]] !== "object") cur[parts[i]] = {};
      cur = cur[parts[i]];
    }
    cur[parts[parts.length - 1]] = value;
  }
  return result;
}

function ContextSummary({ ctx }: { ctx: TemplateContext | null }) {
  if (!ctx) return null;
  const groups: Array<[string, string | null | undefined]> = [
    ["Kunde", ctx.client?.full_name],
    ["Objekt", ctx.property?.title],
    ["Eigentümer", ctx.owner?.full_name],
    ["Mitunterzeichner", ctx.partner?.full_name],
    ["Bank", ctx.bank?.bank_name ? `${ctx.bank.bank_name}${ctx.bank.iban ? ` · ${ctx.bank.iban}` : ""}` : null],
    ["Firma", ctx.company?.name],
  ];
  return (
    <ul className="mt-1 grid gap-0.5 sm:grid-cols-2">
      {groups.map(([k, v]) => (
        <li key={k} className="flex justify-between gap-3">
          <span>{k}</span>
          <span className={v ? "text-foreground" : "text-muted-foreground"}>{v || "—"}</span>
        </li>
      ))}
    </ul>
  );
}
