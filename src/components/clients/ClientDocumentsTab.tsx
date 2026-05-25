import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  FileText, Upload, Eye, Download, Pencil, Trash2, ChevronLeft, ChevronRight, X, Check,
} from "lucide-react";
import { toast } from "sonner";
import { formatDate } from "@/lib/format";
import { GeneratedDocumentsTable } from "@/components/documents/GeneratedDocumentsTable";

const DOC_TYPES = [
  "client_document", "property_document", "contract", "mandate", "mandate_partial",
  "reservation", "reservation_receipt", "financing", "nda", "media", "other",
] as const;

const TYPE_LABELS: Record<string, string> = {
  client_document: "Kundendokument",
  property_document: "Immobiliendokument",
  contract: "Vertrag",
  mandate: "Mandat (exklusiv)",
  mandate_partial: "Mandat (teilexklusiv)",
  reservation: "Reservation",
  reservation_receipt: "Reservations-Quittung",
  financing: "Finanzierung",
  nda: "NDA",
  media: "Medien",
  other: "Sonstiges",
};

function detectType(filename: string, mime?: string): string {
  const n = filename.toLowerCase();
  if (mime?.startsWith("image/")) return "media";
  if (/(mandat|maklervertrag).*teil|teil.*mandat/.test(n)) return "mandate_partial";
  if (/mandat|maklervertrag/.test(n)) return "mandate";
  if (/(reservation|reservierung).*(quittung|receipt|beleg)/.test(n)) return "reservation_receipt";
  if (/reservation|reservierung/.test(n)) return "reservation";
  if (/nda|vertraulich|geheimhaltung/.test(n)) return "nda";
  if (/finanzier|hypothek|kredit|tragbarkeit|selbstauskunft/.test(n)) return "financing";
  if (/vertrag|contract|kaufvertrag/.test(n)) return "contract";
  if (/ausweis|pass|id\b/.test(n)) return "client_document";
  if (/expose|grundbuch|plan|katast/.test(n)) return "property_document";
  return "other";
}

type Doc = {
  id: string;
  file_url: string;
  file_name: string | null;
  document_type: string;
  mime_type: string | null;
  size_bytes: number | null;
  created_at: string;
};

async function getSignedUrl(path: string) {
  if (/^https?:\/\//i.test(path)) return path;
  const { data, error } = await supabase.storage.from("documents").createSignedUrl(path, 60 * 10);
  if (error || !data?.signedUrl) throw error ?? new Error("URL konnte nicht erstellt werden");
  return data.signedUrl;
}

export function ClientDocumentsTab({ clientId, userId }: { clientId: string; userId: string }) {
  const qc = useQueryClient();
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [previewIdx, setPreviewIdx] = useState<number | null>(null);
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const { data: docs = [], isLoading } = useQuery({
    queryKey: ["client_documents", clientId],
    queryFn: async (): Promise<Doc[]> => {
      const { data } = await supabase.from("documents").select("*")
        .eq("related_type", "client").eq("related_id", clientId)
        .order("created_at", { ascending: false });
      return (data ?? []) as any;
    },
  });

  const uploadFiles = async (files: File[]) => {
    if (files.length === 0) return;
    setUploading(true);
    try {
      for (const f of files) {
        const safe = f.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const path = `clients/${clientId}/${Date.now()}-${safe}`;
        const { error: upErr } = await supabase.storage.from("documents").upload(path, f, {
          contentType: f.type || undefined, upsert: false,
        });
        if (upErr) throw upErr;
        const docType = detectType(f.name, f.type);
        const { error } = await supabase.from("documents").insert({
          file_url: path, file_name: f.name,
          document_type: docType as any,
          mime_type: f.type || null,
          size_bytes: f.size,
          related_type: "client", related_id: clientId, uploaded_by: userId,
        });
        if (error) throw error;
      }
      toast.success(files.length > 1 ? `${files.length} Dokumente hochgeladen` : "Dokument hochgeladen");
      qc.invalidateQueries({ queryKey: ["client_documents", clientId] });
      qc.invalidateQueries({ queryKey: ["client_documents_count", clientId] });
    } catch (err: any) {
      toast.error(err.message ?? "Upload fehlgeschlagen");
    } finally {
      setUploading(false);
    }
  };

  const downloadDoc = async (d: Doc) => {
    try {
      const url = await getSignedUrl(d.file_url);
      const res = await fetch(url);
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = d.file_name ?? "dokument";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    } catch (e: any) {
      toast.error(e?.message ?? "Download fehlgeschlagen");
    }
  };

  const deleteDoc = async (d: Doc) => {
    if (!confirm(`Dokument "${d.file_name}" wirklich löschen?`)) return;
    try {
      if (!/^https?:\/\//i.test(d.file_url)) {
        await supabase.storage.from("documents").remove([d.file_url]);
      }
      const { error } = await supabase.from("documents").delete().eq("id", d.id);
      if (error) throw error;
      toast.success("Dokument gelöscht");
      qc.invalidateQueries({ queryKey: ["client_documents", clientId] });
      qc.invalidateQueries({ queryKey: ["client_documents_count", clientId] });
      setPreviewIdx(null);
    } catch (e: any) {
      toast.error(e?.message ?? "Löschen fehlgeschlagen");
    }
  };

  const preserveExt = (oldName: string | null, fileUrl: string, newName: string) => {
    const sourceExt = (oldName ?? fileUrl).split(".").pop()?.toLowerCase() ?? "";
    if (!sourceExt || sourceExt.length > 5) return newName;
    const hasExt = newName.toLowerCase().endsWith(`.${sourceExt}`);
    return hasExt ? newName : `${newName}.${sourceExt}`;
  };

  const saveRename = async (d: Doc) => {
    if (!renameValue.trim()) return;
    try {
      const finalName = preserveExt(d.file_name, d.file_url, renameValue.trim());
      const { error } = await supabase.from("documents")
        .update({ file_name: finalName }).eq("id", d.id);
      if (error) throw error;
      toast.success("Umbenannt");
      setRenameId(null);
      qc.invalidateQueries({ queryKey: ["client_documents", clientId] });
    } catch (e: any) {
      toast.error(e?.message ?? "Umbenennen fehlgeschlagen");
    }
  };

  const updateType = async (d: Doc, newType: string) => {
    try {
      const { error } = await supabase.from("documents")
        .update({ document_type: newType as any }).eq("id", d.id);
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ["client_documents", clientId] });
    } catch (e: any) {
      toast.error(e?.message ?? "Aktualisieren fehlgeschlagen");
    }
  };

  return (
    <Card><CardContent className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-display text-lg font-semibold">Dokumente</h3>
        <span className="text-xs text-muted-foreground">{docs.length} Dokument{docs.length === 1 ? "" : "e"}</span>
      </div>

      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragEnter={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={(e) => { if (e.currentTarget === e.target) setDragOver(false); }}
        onDrop={async (e) => {
          e.preventDefault();
          setDragOver(false);
          await uploadFiles(Array.from(e.dataTransfer.files ?? []));
        }}
        className="space-y-3"
      >
        <label
          className={`relative block cursor-pointer overflow-hidden rounded-xl border-2 border-dashed p-8 text-center transition-all duration-300 ${
            dragOver
              ? "scale-[1.02] border-primary bg-primary/10 shadow-lg shadow-primary/20"
              : "border-muted-foreground/30 hover:border-primary/60 hover:bg-accent/20"
          }`}
        >
          <input
            type="file"
            multiple
            className="hidden"
            onChange={(e) => uploadFiles(Array.from(e.target.files ?? []))}
          />
          <div className={`pointer-events-none flex flex-col items-center gap-2 transition-transform duration-300 ${dragOver ? "scale-110" : ""}`}>
            <div className={`rounded-full bg-primary/10 p-3 ${dragOver ? "animate-bounce bg-primary/20" : ""}`}>
              <Upload className={`h-6 w-6 ${dragOver ? "text-primary" : "text-muted-foreground"}`} />
            </div>
            <p className={`text-sm font-semibold ${dragOver ? "text-primary" : ""}`}>
              {uploading ? "Lädt hoch…" : dragOver ? "Jetzt loslassen zum Hochladen" : "Drag & Drop oder klicken – Dateien hierher"}
            </p>
            <p className="text-xs text-muted-foreground">Dokumenttyp wird automatisch erkannt</p>
          </div>
        </label>

        {isLoading ? <p className="text-sm text-muted-foreground">Lädt…</p>
          : docs.length === 0 ? (
              <p className="py-2 text-center text-xs text-muted-foreground">Noch keine Dokumente vorhanden.</p>
            )
          : <div className="space-y-2">
              {docs.map((d, idx) => (
                <div key={d.id}
                  className="group flex items-center justify-between gap-3 rounded-xl border p-3 transition hover:border-primary hover:bg-accent/20">
                  <button type="button" onClick={() => setPreviewIdx(idx)}
                    className="flex flex-1 items-center gap-3 min-w-0 text-left">
                    <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      {renameId === d.id ? (
                        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                          <Input
                            value={renameValue}
                            onChange={(e) => setRenameValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") saveRename(d);
                              if (e.key === "Escape") setRenameId(null);
                            }}
                            className="h-7 text-sm"
                            autoFocus
                          />
                          <Button size="icon" variant="ghost" className="h-7 w-7"
                            onClick={(e) => { e.stopPropagation(); saveRename(d); }}><Check className="h-3.5 w-3.5" /></Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7"
                            onClick={(e) => { e.stopPropagation(); setRenameId(null); }}><X className="h-3.5 w-3.5" /></Button>
                        </div>
                      ) : (
                        <p className="truncate text-sm font-medium">{d.file_name ?? d.file_url}</p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {TYPE_LABELS[d.document_type] ?? d.document_type} · {formatDate(d.created_at)}
                      </p>
                    </div>
                  </button>
                  <div className="flex items-center gap-1 opacity-70 group-hover:opacity-100">
                    <Button size="icon" variant="ghost" className="h-8 w-8" title="Vorschau"
                      onClick={() => setPreviewIdx(idx)}><Eye className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8" title="Umbenennen"
                      onClick={() => { setRenameId(d.id); setRenameValue(d.file_name ?? ""); }}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8" title="Herunterladen"
                      onClick={() => downloadDoc(d)}><Download className="h-4 w-4" /></Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8 hover:bg-destructive hover:text-destructive-foreground" title="Löschen"
                      onClick={() => deleteDoc(d)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                </div>
              ))}
            </div>}
      </div>

      <div className="mt-8">
        <h3 className="mb-3 font-display text-lg font-semibold">Generierte Dokumente</h3>
        <GeneratedDocumentsTable filterRelatedType="client" filterRelatedId={clientId} />
      </div>

      <DocumentPreviewModal
        docs={docs}
        index={previewIdx}
        onIndexChange={setPreviewIdx}
        onClose={() => setPreviewIdx(null)}
        onDownload={downloadDoc}
        onDelete={deleteDoc}
        onTypeChange={updateType}
        onRename={async (d, newName) => {
          const { error } = await supabase.from("documents").update({ file_name: newName }).eq("id", d.id);
          if (error) { toast.error(error.message); return; }
          toast.success("Umbenannt");
          qc.invalidateQueries({ queryKey: ["client_documents", clientId] });
        }}
      />
    </CardContent></Card>
  );
}

function DocumentPreviewModal({
  docs, index, onIndexChange, onClose, onDownload, onDelete, onTypeChange, onRename,
}: {
  docs: Doc[];
  index: number | null;
  onIndexChange: (i: number) => void;
  onClose: () => void;
  onDownload: (d: Doc) => void;
  onDelete: (d: Doc) => void;
  onTypeChange: (d: Doc, t: string) => void;
  onRename: (d: Doc, name: string) => Promise<void>;
}) {
  const open = index !== null && index >= 0 && index < docs.length;
  const d = open ? docs[index!] : null;
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loadingUrl, setLoadingUrl] = useState(false);
  const [editingName, setEditingName] = useState<string | null>(null);

  useEffect(() => {
    if (!d) { setPreviewUrl(null); return; }
    setLoadingUrl(true);
    setPreviewUrl(null);
    setEditingName(null);
    getSignedUrl(d.file_url)
      .then(async (signed) => {
        // Fetch as blob and use object URL so the Supabase URL is never visible
        try {
          const res = await fetch(signed);
          const blob = await res.blob();
          setPreviewUrl(URL.createObjectURL(blob));
        } catch {
          setPreviewUrl(null);
        }
      })
      .catch(() => setPreviewUrl(null))
      .finally(() => setLoadingUrl(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [d?.id]);

  if (!d) return (
    <Dialog open={false} onOpenChange={(o) => !o && onClose()}><DialogContent /></Dialog>
  );

  const mime = d.mime_type ?? "";
  // Endung IMMER aus dem Storage-Pfad ableiten — file_name kann nach Umbenennen ohne Endung sein
  const extFromUrl = d.file_url.split("?")[0].split("#")[0].split(".").pop()?.toLowerCase() ?? "";
  const extFromName = (d.file_name ?? "").split(".").pop()?.toLowerCase() ?? "";
  const ext = ["pdf","png","jpg","jpeg","gif","webp","svg"].includes(extFromName) ? extFromName : extFromUrl;
  const isImage = mime.startsWith("image/") || ["png","jpg","jpeg","gif","webp","svg"].includes(ext);
  const isPdf = mime === "application/pdf" || ext === "pdf";
  const canPreview = isImage || isPdf;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <div className="flex items-center justify-between gap-3 pr-8">
            <div className="min-w-0 flex-1">
              {editingName !== null ? (
                <div className="flex items-center gap-2">
                  <Input
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    className="h-8"
                    autoFocus
                    onKeyDown={(e) => { if (e.key === "Escape") setEditingName(null); }}
                  />
                  <Button size="sm" onClick={async () => {
                    if (editingName.trim()) await onRename(d, editingName.trim());
                    setEditingName(null);
                  }}><Check className="h-4 w-4" /></Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditingName(null)}><X className="h-4 w-4" /></Button>
                </div>
              ) : (
                <DialogTitle className="flex items-center gap-2">
                  <span className="truncate">{d.file_name ?? "Dokument"}</span>
                  <Button size="icon" variant="ghost" className="h-7 w-7"
                    onClick={() => setEditingName(d.file_name ?? "")}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                </DialogTitle>
              )}
              <p className="mt-1 text-xs text-muted-foreground">
                Dokument {index! + 1} von {docs.length} · {formatDate(d.created_at)}
              </p>
            </div>
          </div>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-2">
          <Label className="text-xs">Typ:</Label>
          <Select value={d.document_type} onValueChange={(v) => onTypeChange(d, v)}>
            <SelectTrigger className="h-8 w-[200px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              {DOC_TYPES.map((t) => (
                <SelectItem key={t} value={t}>{TYPE_LABELS[t]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="ml-auto flex items-center gap-1">
            <Button size="sm" variant="outline" onClick={() => onDownload(d)}>
              <Download className="mr-1.5 h-4 w-4" />Download
            </Button>
            <Button size="sm" variant="ghost" className="hover:bg-destructive hover:text-destructive-foreground"
              onClick={() => onDelete(d)}>
              <Trash2 className="mr-1.5 h-4 w-4" />Löschen
            </Button>
          </div>
        </div>

        <div className="relative h-[65vh] w-full overflow-hidden rounded-md border bg-muted">
          {loadingUrl ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Lädt…</div>
          ) : !previewUrl ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              Vorschau nicht verfügbar
            </div>
          ) : isImage ? (
            <div className="flex h-full w-full items-center justify-center bg-white">
              <img src={previewUrl} alt={d.file_name ?? ""} className="max-h-full max-w-full object-contain" />
            </div>
          ) : isPdf ? (
            <iframe src={previewUrl} title="Vorschau" className="h-full w-full bg-white" />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
              <p>Vorschau für diesen Dateityp nicht verfügbar.</p>
              <Button size="sm" onClick={() => onDownload(d)}>
                <Download className="mr-1.5 h-4 w-4" />Herunterladen
              </Button>
            </div>
          )}

          {docs.length > 1 && (
            <>
              <Button
                size="icon" variant="secondary"
                className="absolute left-2 top-1/2 -translate-y-1/2 shadow-md"
                disabled={index === 0}
                onClick={() => onIndexChange(Math.max(0, (index ?? 0) - 1))}
              ><ChevronLeft className="h-5 w-5" /></Button>
              <Button
                size="icon" variant="secondary"
                className="absolute right-2 top-1/2 -translate-y-1/2 shadow-md"
                disabled={index === docs.length - 1}
                onClick={() => onIndexChange(Math.min(docs.length - 1, (index ?? 0) + 1))}
              ><ChevronRight className="h-5 w-5" /></Button>
            </>
          )}
        </div>
        {canPreview ? null : null}
      </DialogContent>
    </Dialog>
  );
}
