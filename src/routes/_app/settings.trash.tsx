import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, RotateCcw, Trash2, Search } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { TRASH_LABELS, purgeTrashItem, restoreFromTrash, type TrashTable } from "@/lib/trash";

export const Route = createFileRoute("/_app/settings/trash")({
  component: TrashPage,
  head: () => ({
    meta: [
      { title: "Papierkorb – Einstellungen | ASIMO CRM" },
      { name: "description", content: "Gelöschte Immobilien, Kunden, Aufgaben und Dokumente ansehen und wiederherstellen." },
      { property: "og:title", content: "Papierkorb – Einstellungen | ASIMO CRM" },
      { property: "og:description", content: "Gelöschte Einträge ansehen und wiederherstellen." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type TrashRow = {
  id: string;
  table_name: string;
  label: string | null;
  subtitle: string | null;
  deleted_at: string;
};

function TrashPage() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [type, setType] = useState<string>("all");
  const [purgeId, setPurgeId] = useState<string | null>(null);

  const { data = [], isLoading } = useQuery({
    queryKey: ["trash-items"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trash_items")
        .select("id, table_name, label, subtitle, deleted_at")
        .order("deleted_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as TrashRow[];
    },
  });

  const restore = useMutation({
    mutationFn: (id: string) => restoreFromTrash(id),
    onSuccess: () => {
      toast.success("Eintrag wiederhergestellt");
      qc.invalidateQueries();
    },
    onError: (e: any) => toast.error(e.message ?? "Wiederherstellen fehlgeschlagen"),
  });

  const purge = useMutation({
    mutationFn: (id: string) => purgeTrashItem(id),
    onSuccess: () => {
      toast.success("Endgültig gelöscht");
      setPurgeId(null);
      qc.invalidateQueries({ queryKey: ["trash-items"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Löschen fehlgeschlagen"),
  });

  const types = useMemo(
    () => Array.from(new Set(data.map((d) => d.table_name))),
    [data],
  );

  const filtered = data.filter((row) => {
    if (type !== "all" && row.table_name !== type) return false;
    if (!q.trim()) return true;
    const needle = q.toLowerCase();
    return `${row.label ?? ""} ${row.subtitle ?? ""}`.toLowerCase().includes(needle);
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link to="/settings"><ArrowLeft className="mr-1 h-4 w-4" /> Einstellungen</Link>
        </Button>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Trash2 className="h-7 w-7 text-primary" /> Papierkorb
        </h1>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Suchen…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Select value={type} onValueChange={setType}>
          <SelectTrigger className="w-[220px]"><SelectValue placeholder="Typ" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Typen</SelectItem>
            {types.map((t) => (
              <SelectItem key={t} value={t}>{TRASH_LABELS[t as TrashTable] ?? t}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <p className="p-6 text-sm text-muted-foreground">Wird geladen…</p>
          ) : filtered.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">Der Papierkorb ist leer.</p>
          ) : (
            <ul className="divide-y">
              {filtered.map((row) => (
                <li key={row.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <Badge variant="secondary">{TRASH_LABELS[row.table_name as TrashTable] ?? row.table_name}</Badge>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{row.label ?? "Eintrag"}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {row.subtitle ? `${row.subtitle} · ` : ""}
                      gelöscht am {new Date(row.deleted_at).toLocaleString("de-CH")}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={restore.isPending}
                    onClick={() => restore.mutate(row.id)}
                  >
                    <RotateCcw className="mr-1 h-4 w-4" /> Wiederherstellen
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setPurgeId(row.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!purgeId} onOpenChange={(o) => !o && setPurgeId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Endgültig löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Dieser Eintrag kann danach nicht mehr wiederhergestellt werden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction onClick={() => purgeId && purge.mutate(purgeId)}>
              Endgültig löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
