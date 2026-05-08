import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { toast } from "sonner";

type ActorMap = Record<string, { full_name: string | null; email: string | null }>;

type Props = {
  /** e.g. "financing_dossier", "client", "lead", "property" */
  relatedType: string;
  relatedId: string;
  /** Optional: hide the manual note input. */
  readOnly?: boolean;
};

function formatDateTime(v: string): string {
  const d = new Date(v);
  return isNaN(d.getTime()) ? v : d.toLocaleString("de-CH", { dateStyle: "medium", timeStyle: "short" });
}

export function ActivityTab({ relatedType, relatedId, readOnly = false }: Props) {
  const qc = useQueryClient();
  const [note, setNote] = useState("");

  const { data: activity = [], isLoading } = useQuery({
    queryKey: ["activity_logs", relatedType, relatedId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("activity_logs")
        .select("*")
        .eq("related_type", relatedType)
        .eq("related_id", relatedId)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });

  // Resolve actor names in one query
  const actorIds = Array.from(new Set((activity as any[]).map((a) => a.actor_id).filter(Boolean))) as string[];
  const { data: actors = {} } = useQuery({
    queryKey: ["activity_actors", actorIds.sort().join(",")],
    enabled: actorIds.length > 0,
    queryFn: async (): Promise<ActorMap> => {
      const { data } = await supabase.from("profiles").select("id, full_name, email").in("id", actorIds);
      const map: ActorMap = {};
      for (const p of data ?? []) map[p.id] = { full_name: p.full_name, email: p.email };
      return map;
    },
  });

  const addNote = useMutation({
    mutationFn: async () => {
      if (!note.trim()) throw new Error("Notiz darf nicht leer sein");
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase.from("activity_logs").insert({
        actor_id: u?.user?.id ?? null,
        action: note.trim(),
        related_type: relatedType,
        related_id: relatedId,
        metadata: { type: "note" },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Notiz hinzugefügt");
      setNote("");
      qc.invalidateQueries({ queryKey: ["activity_logs", relatedType, relatedId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      {!readOnly && (
        <Card>
          <CardContent className="p-6">
            <h3 className="mb-3 font-semibold">Notiz hinzufügen</h3>
            <Textarea
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Was ist passiert? (z. B. Kunde kontaktiert, Bank-Feedback, …)"
            />
            <div className="mt-3 flex justify-end">
              <Button size="sm" onClick={() => addNote.mutate()} disabled={!note.trim() || addNote.isPending}>
                <Plus className="mr-1.5 h-4 w-4" />
                Speichern
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-6">
          <h3 className="mb-4 font-semibold">Aktivitätsverlauf</h3>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Lädt…</p>
          ) : activity.length === 0 ? (
            <p className="text-sm text-muted-foreground">Noch keine Aktivität.</p>
          ) : (
            <div className="space-y-3">
              {(activity as any[]).map((a) => {
                const actor = a.actor_id ? actors[a.actor_id] : null;
                const actorLabel = actor?.full_name || actor?.email || "System";
                const meta = (a.metadata ?? {}) as Record<string, unknown>;
                const type = typeof meta.type === "string" ? meta.type : null;
                return (
                  <div key={a.id} className="flex items-start gap-3 rounded-xl border p-3">
                    <div
                      className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                        type === "note"
                          ? "bg-amber-500"
                          : type === "system"
                          ? "bg-muted-foreground"
                          : "bg-primary"
                      }`}
                    />
                    <div className="flex-1">
                      <p className="text-sm">{a.action}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {formatDateTime(a.created_at)} · {actorLabel}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/** Helper to log an event from anywhere in the app. Silently ignores errors. */
export async function logActivity(params: {
  relatedType: string;
  relatedId: string;
  action: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    const { data: u } = await supabase.auth.getUser();
    await supabase.from("activity_logs").insert({
      actor_id: u?.user?.id ?? null,
      action: params.action,
      related_type: params.relatedType,
      related_id: params.relatedId,
      metadata: { type: "system", ...(params.metadata ?? {}) },
    });
  } catch (err) {
    console.warn("[activity] log failed", err);
  }
}
