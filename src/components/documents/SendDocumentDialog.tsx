import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Send, Trash2, Mail, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

type Recipient = { name: string; email: string; role?: string };

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  generatedDocumentId: string;
  documentTitle?: string | null;
  initialRecipients?: Recipient[];
};

const ESIGN_PROVIDERS = [
  { value: "none", label: "Kein E-Sign (manuell unterzeichnen)" },
  { value: "skribble", label: "Skribble (Schweiz, QES) – geplant" },
  { value: "docusign", label: "DocuSign – geplant" },
];

export function SendDocumentDialog({
  open,
  onOpenChange,
  generatedDocumentId,
  documentTitle,
  initialRecipients,
}: Props) {
  const qc = useQueryClient();
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [message, setMessage] = useState("");
  const [esignProvider, setEsignProvider] = useState<string>("none");

  useEffect(() => {
    if (open) {
      setRecipients(initialRecipients?.length ? initialRecipients : [{ name: "", email: "", role: "Unterzeichner" }]);
      setMessage("");
      setEsignProvider("none");
    }
  }, [open, initialRecipients]);

  const addRow = () => setRecipients((r) => [...r, { name: "", email: "", role: "Unterzeichner" }]);
  const removeRow = (i: number) => setRecipients((r) => r.filter((_, idx) => idx !== i));
  const updateRow = (i: number, key: keyof Recipient, value: string) =>
    setRecipients((r) => r.map((row, idx) => (idx === i ? { ...row, [key]: value } : row)));

  const valid = recipients.some((r) => r.email && r.name);

  const send = useMutation({
    mutationFn: async () => {
      const cleaned = recipients.filter((r) => r.email && r.name);
      const useEsign = esignProvider !== "none";

      const update: Record<string, unknown> = {
        recipients: cleaned,
        sent_at: new Date().toISOString(),
        status: useEsign ? "sent_for_signature" : "sent",
      };
      if (useEsign) {
        update.esign_provider = esignProvider;
        update.esign_status = "pending";
        update.esign_envelope_id = `stub_${Date.now()}`;
      }

      const { error } = await supabase
        .from("generated_documents")
        .update(update as never)
        .eq("id", generatedDocumentId);
      if (error) throw error;
      return { useEsign, count: cleaned.length };
    },
    onSuccess: ({ useEsign, count }) => {
      toast.success(
        useEsign
          ? `Dokument an ${count} Empfänger zur E-Signatur vorbereitet (Stub)`
          : `Dokument als versendet markiert (${count} Empfänger)`,
      );
      qc.invalidateQueries({ queryKey: ["generated-documents"] });
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="size-5" /> Dokument senden
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {documentTitle && (
            <div className="rounded-md border bg-muted/30 p-2 text-sm">
              <span className="text-muted-foreground">Dokument:</span>{" "}
              <span className="font-medium">{documentTitle}</span>
            </div>
          )}

          <div>
            <Label>Empfänger</Label>
            <div className="mt-2 space-y-2">
              {recipients.map((r, i) => (
                <div key={i} className="grid grid-cols-12 gap-2">
                  <Input
                    className="col-span-4"
                    placeholder="Name"
                    value={r.name}
                    onChange={(e) => updateRow(i, "name", e.target.value)}
                  />
                  <Input
                    className="col-span-5"
                    placeholder="E-Mail"
                    type="email"
                    value={r.email}
                    onChange={(e) => updateRow(i, "email", e.target.value)}
                  />
                  <Input
                    className="col-span-2"
                    placeholder="Rolle"
                    value={r.role ?? ""}
                    onChange={(e) => updateRow(i, "role", e.target.value)}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="col-span-1"
                    onClick={() => removeRow(i)}
                    disabled={recipients.length === 1}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={addRow}>
                <Plus className="mr-1 size-4" /> Empfänger hinzufügen
              </Button>
            </div>
          </div>

          <div>
            <Label>E-Signatur-Anbieter</Label>
            <Select value={esignProvider} onValueChange={setEsignProvider}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ESIGN_PROVIDERS.map((p) => (
                  <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {esignProvider !== "none" && (
              <div className="mt-2 flex items-start gap-2 rounded-md border border-amber-300/60 bg-amber-50 p-2 text-xs text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
                <ShieldCheck className="mt-0.5 size-4 shrink-0" />
                <span>
                  Architektur ist vorbereitet. Der eigentliche API-Call zum Anbieter wird in einem späteren Schritt
                  angeschlossen. Aktuell wird der Status nur intern auf <Badge variant="outline" className="mx-1">pending</Badge>
                  gesetzt.
                </span>
              </div>
            )}
          </div>

          <div>
            <Label>Notiz / Begleittext (optional)</Label>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              placeholder="Wird beim Versand an den Anbieter mitgegeben."
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Abbrechen</Button>
          <Button onClick={() => send.mutate()} disabled={!valid || send.isPending}>
            <Mail className="mr-2 size-4" />
            {send.isPending ? "Wird verarbeitet…" : esignProvider === "none" ? "Als versendet markieren" : "Zur E-Signatur vorbereiten"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
