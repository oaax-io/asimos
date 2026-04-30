import { useState } from "react";
import Papa from "papaparse";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { Upload, Loader2 } from "lucide-react";
import { buildStagedProperty, type RawRow } from "@/lib/property-import";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported?: () => void;
};

type Result = { imported: number; skipped: number; errors: number };

export function PropertyImportDialog({ open, onOpenChange, onImported }: Props) {
  const { user } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  const reset = () => {
    setFile(null);
    setResult(null);
    setImporting(false);
  };

  const handleClose = (next: boolean) => {
    if (importing) return;
    if (!next) reset();
    onOpenChange(next);
  };

  const parseFile = (f: File): Promise<RawRow[]> =>
    new Promise((resolve, reject) => {
      Papa.parse<RawRow>(f, {
        header: true,
        skipEmptyLines: true,
        complete: (res) => resolve(res.data as RawRow[]),
        error: (err) => reject(err),
      });
    });

  const handleImport = async () => {
    if (!file) return;
    setImporting(true);
    try {
      const rows = await parseFile(file);
      if (rows.length === 0) {
        toast.error("CSV enthält keine Datenzeilen.");
        setImporting(false);
        return;
      }

      const batchId = crypto.randomUUID();
      const staged = rows.map((row, idx) => buildStagedProperty(idx, row, batchId));

      const toInsert = staged
        .filter((s) => s.insertable !== null)
        .map((s) => ({ ...(s.insertable as Record<string, unknown>), owner_id: user?.id }));
      const skipped = staged.filter((s) => s.insertable === null).length;

      let imported = 0;
      let errors = 0;

      // Insert in batches of 100 to stay safely within payload limits
      const CHUNK = 100;
      for (let i = 0; i < toInsert.length; i += CHUNK) {
        const chunk = toInsert.slice(i, i + CHUNK);
        const { error, count } = await supabase
          .from("properties")
          .insert(chunk as any, { count: "exact" });
        if (error) {
          console.error("Property import chunk error:", error);
          errors += chunk.length;
        } else {
          imported += count ?? chunk.length;
        }
      }

      setResult({ imported, skipped, errors });
      if (imported > 0) {
        toast.success(`${imported} Immobilien importiert.`);
        onImported?.();
      }
      if (errors > 0) toast.error(`${errors} Zeilen konnten nicht gespeichert werden.`);
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message ?? "Import fehlgeschlagen.");
    } finally {
      setImporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Immobilien importieren</DialogTitle>
          <DialogDescription>
            Lade eine CSV-Datei hoch (z. B. CasaOne-Export). Es werden ausschliesslich neue Datensätze angelegt.
          </DialogDescription>
        </DialogHeader>

        {!result ? (
          <div className="space-y-3">
            <Input
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              disabled={importing}
            />
            {file && (
              <p className="text-sm text-muted-foreground">
                Datei: <span className="font-medium text-foreground">{file.name}</span>
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-2 rounded-md border bg-muted/30 p-4 text-sm">
            <div className="flex justify-between"><span>Importiert</span><span className="font-semibold">{result.imported}</span></div>
            <div className="flex justify-between"><span>Übersprungen</span><span className="font-semibold">{result.skipped}</span></div>
            {result.errors > 0 && (
              <div className="flex justify-between text-destructive"><span>Fehler</span><span className="font-semibold">{result.errors}</span></div>
            )}
          </div>
        )}

        <DialogFooter>
          {!result ? (
            <>
              <Button variant="outline" onClick={() => handleClose(false)} disabled={importing}>Abbrechen</Button>
              <Button onClick={handleImport} disabled={!file || importing}>
                {importing ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Upload className="mr-1 h-4 w-4" />}
                Importieren
              </Button>
            </>
          ) : (
            <Button onClick={() => handleClose(false)}>Schliessen</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
