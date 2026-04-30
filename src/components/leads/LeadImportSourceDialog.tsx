import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FileSpreadsheet, Building2 } from "lucide-react";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onPick: (variant: "csv" | "casaone") => void;
};

export function LeadImportSourceDialog({ open, onOpenChange, onPick }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Leads importieren</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 md:grid-cols-2 pt-2">
          <button
            type="button"
            onClick={() => onPick("csv")}
            className="group rounded-xl border bg-card p-5 text-left transition hover:border-primary hover:shadow-glow"
          >
            <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
            <h3 className="font-semibold">CSV Import</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Eigene CSV-Datei hochladen und Felder manuell oder automatisch zuordnen.
            </p>
          </button>

          <button
            type="button"
            onClick={() => onPick("casaone")}
            className="group rounded-xl border bg-card p-5 text-left transition hover:border-primary hover:shadow-glow"
          >
            <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Building2 className="h-5 w-5" />
            </div>
            <h3 className="font-semibold">Import aus CasaOne</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              CasaOne Exportdatei hochladen. ASIMOS erkennt Felder, Personen, Firmen und Kontaktpersonen automatisch.
            </p>
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
