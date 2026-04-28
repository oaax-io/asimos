import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import {
  renderTemplate,
  wrapHtmlDocument,
  type TemplateContext,
} from "@/lib/document-templates";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentType: "mandate" | "reservation";
  context: TemplateContext;
  relatedId: string; // mandate.id or reservation.id
  onGenerated?: (generatedDocId: string) => void;
};

export function GenerateDocumentDialog({
  open,
  onOpenChange,
  documentType,
  context,
  relatedId,
  onGenerated,
}: Props) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [templateId, setTemplateId] = useState<string>("");

  const { data: templates = [] } = useQuery({
    queryKey: ["document-templates", documentType],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("document_templates")
        .select("*")
        .eq("type", documentType)
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  useEffect(() => {
    if (open && templates.length > 0 && !templateId) {
      setTemplateId(templates[0].id);
    }
  }, [open, templates, templateId]);

  const selected = templates.find((t) => t.id === templateId);
  const html = useMemo(() => {
    if (!selected) return "";
    return renderTemplate(selected.content, context);
  }, [selected, context]);

  const generate = useMutation({
    mutationFn: async () => {
      if (!selected) throw new Error("Bitte Vorlage wählen");
      const fullHtml = wrapHtmlDocument(selected.name, html);
      const insertPayload = {
        template_id: selected.id,
        related_type: documentType,
        related_id: relatedId,
        html_content: fullHtml,
        variables: JSON.parse(JSON.stringify(context)),
        created_by: user?.id ?? null,
      };
      const { data, error } = await supabase
        .from("generated_documents")
        .insert(insertPayload)
        .select("id")
        .single();
      if (error) throw error;

      const targetTable = documentType === "mandate" ? "mandates" : "reservations";
      await supabase
        .from(targetTable)
        .update({ generated_document_id: data.id })
        .eq("id", relatedId);

      return data.id as string;
    },
    onSuccess: (id) => {
      toast.success("Dokument generiert");
      qc.invalidateQueries({ queryKey: ["mandates"] });
      qc.invalidateQueries({ queryKey: ["reservations"] });
      qc.invalidateQueries({ queryKey: ["generated-documents"] });
      onOpenChange(false);
      onGenerated?.(id);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Dokument generieren</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Vorlage</Label>
            <Select value={templateId} onValueChange={setTemplateId}>
              <SelectTrigger>
                <SelectValue placeholder={templates.length === 0 ? "Keine Vorlagen vorhanden" : "Vorlage wählen"} />
              </SelectTrigger>
              <SelectContent>
                {templates.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Vorschau</Label>
            <div className="mt-1 max-h-[55vh] overflow-auto rounded-md border bg-white p-4">
              {html ? (
                <div dangerouslySetInnerHTML={{ __html: html }} />
              ) : (
                <p className="text-sm text-muted-foreground">Wähle eine Vorlage, um die Vorschau zu sehen.</p>
              )}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Abbrechen
          </Button>
          <Button onClick={() => generate.mutate()} disabled={!selected || generate.isPending}>
            {generate.isPending ? "Wird erstellt…" : "Dokument speichern"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
