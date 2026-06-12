import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Check, Eye, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { TEMPLATES, TemplatePreview, type TemplateMeta, type ExposeSections } from "@/components/expose/TemplatePreview";
import { ExposeGeneratorDialog } from "@/components/expose/ExposeGeneratorDialog";

export const Route = createFileRoute("/_app/exposes")({ component: ExposesPage });

const DEFAULT_SECTIONS: Required<ExposeSections> = {
  beschreibung: true, mikrolage: true, einheiten: true, grundriss: true,
  kontakt: true, galerie: true, galerieLayout: "grid4", energieausweis: true,
};

function ExposesPage() {
  const [previewTemplate, setPreviewTemplate] = useState<TemplateMeta | null>(null);
  const [generatorTemplate, setGeneratorTemplate] = useState<TemplateMeta | null>(null);

  return (
    <>
      <PageHeader
        title="Exposés"
        description="Wähle eine Vorlage – im nächsten Schritt wählst du Objekt, Inhalte, Galerie und Anhänge."
      />

      <Card>
        <CardContent className="space-y-4 p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold">Templates</h2>
            <Badge variant="outline" className="text-xs">{TEMPLATES.length} Vorlagen</Badge>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {TEMPLATES.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setPreviewTemplate(t)}
                className={cn(
                  "group relative flex flex-col rounded-lg border border-border bg-card p-2 text-left transition hover:border-primary/50",
                )}
              >
                <div className="relative w-full overflow-hidden rounded">
                  <TemplatePreview template={t} sections={DEFAULT_SECTIONS} scale="thumbnail" />
                  <div className="pointer-events-none absolute inset-0 flex items-end justify-center bg-gradient-to-t from-black/50 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100">
                    <span className="mb-2 flex items-center gap-1.5 rounded-full bg-background px-2.5 py-1 text-[11px] font-semibold shadow">
                      <Eye className="h-3 w-3" /> Vorschau
                    </span>
                  </div>
                </div>
                <div className="mt-2">
                  <div className="truncate text-sm font-semibold">{t.label}</div>
                  <div className="truncate text-[11px] text-muted-foreground">{t.description}</div>
                  <div className="mt-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                    {t.orientation === "landscape" ? "Querformat" : "Hochformat"} · {t.family}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Template preview dialog */}
      <Dialog open={!!previewTemplate} onOpenChange={(o) => { if (!o) setPreviewTemplate(null); }}>
        <DialogContent className="max-h-[92vh] max-w-5xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              Template: {previewTemplate?.label}
              <Badge variant="secondary" className="ml-2 gap-1 border-0 bg-emerald-100 text-emerald-800">
                <Check className="h-3 w-3" /> Verfügbar
              </Badge>
            </DialogTitle>
            <DialogDescription>
              {previewTemplate?.description} · {previewTemplate?.orientation === "landscape" ? "Querformat" : "Hochformat"} · {previewTemplate?.family}
            </DialogDescription>
          </DialogHeader>

          {previewTemplate && (
            <div className="space-y-3 py-2">
              <TemplatePreview template={previewTemplate} sections={DEFAULT_SECTIONS} scale="stack" />
              <p className="text-center text-[11px] text-muted-foreground">Schematische Vorschau · scrollen für alle Seiten</p>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => setPreviewTemplate(null)}>Schliessen</Button>
            <Button
              onClick={() => {
                if (previewTemplate) {
                  setGeneratorTemplate(previewTemplate);
                  setPreviewTemplate(null);
                }
              }}
              className="gap-2"
            >
              <Sparkles className="h-4 w-4" /> Diese Vorlage verwenden
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Multi-step generator */}
      <ExposeGeneratorDialog
        open={!!generatorTemplate}
        template={generatorTemplate}
        onOpenChange={(o) => { if (!o) setGeneratorTemplate(null); }}
      />
    </>
  );
}
