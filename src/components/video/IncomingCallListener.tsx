import { useCallback, useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Phone, PhoneOff, Video } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { CALL_RING_MS, createRingtone, setCallStatus, type CallRow } from "@/lib/calls";
import { toast } from "sonner";

type Caller = { full_name: string | null; email: string | null; avatar_url: string | null };

/**
 * Zeigt eingehende Videoanrufe an (klingeln, annehmen, ablehnen, verpasst).
 * Wird einmal global im Chat-Dock gerendert.
 */
export function IncomingCallListener({
  onAccept,
}: {
  onAccept: (callerId: string, callId: string) => void;
}) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [call, setCall] = useState<CallRow | null>(null);
  const [caller, setCaller] = useState<Caller | null>(null);
  const ringRef = useRef<ReturnType<typeof createRingtone> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clear = useCallback(() => {
    ringRef.current?.stop();
    ringRef.current = null;
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = null;
    setCall(null);
    setCaller(null);
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    const ch = supabase
      .channel("incoming-calls")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "video_calls" },
        async (payload) => {
          const row = payload.new as CallRow;
          if (row.status !== "ringing") return;
          if (row.created_by === user.id) return;
          if (!(row.participants ?? []).includes(user.id)) return;
          if (Date.now() - new Date(row.started_at).getTime() > CALL_RING_MS) return;

          const { data } = await supabase
            .from("profiles")
            .select("full_name, email, avatar_url")
            .eq("id", row.created_by)
            .maybeSingle();
          setCaller((data as Caller | null) ?? null);
          setCall(row);

          ringRef.current = createRingtone();
          ringRef.current.start();
          timeoutRef.current = setTimeout(() => {
            void setCallStatus(row.id, "missed").catch(() => {});
            clear();
            toast.error(`Verpasster Anruf von ${data?.full_name ?? data?.email ?? "Kollege"}`);
            qc.invalidateQueries({ queryKey: ["notifications"] });
          }, CALL_RING_MS);
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "video_calls" },
        (payload) => {
          const row = payload.new as CallRow;
          setCall((cur) => {
            if (!cur || cur.id !== row.id) return cur;
            if (row.status !== "ringing") {
              ringRef.current?.stop();
              ringRef.current = null;
              if (timeoutRef.current) clearTimeout(timeoutRef.current);
              timeoutRef.current = null;
              return null;
            }
            return cur;
          });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
      ringRef.current?.stop();
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [user?.id, qc, clear]);

  if (!call) return null;

  const name = caller?.full_name ?? caller?.email ?? "Kollege";

  return (
    <div className="fixed bottom-4 left-4 z-[60] w-[320px] overflow-hidden rounded-xl border bg-background shadow-2xl">
      <div className="flex items-center gap-2 border-b bg-primary/10 px-3 py-2">
        <Video className="h-4 w-4 text-primary" />
        <span className="text-sm font-semibold">Eingehender Videoanruf</span>
      </div>
      <div className="flex items-center gap-3 p-4">
        <Avatar className="h-11 w-11">
          <AvatarImage src={caller?.avatar_url ?? undefined} />
          <AvatarFallback className="text-xs">
            {name.split(" ").map((s) => s[0]).slice(0, 2).join("").toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{name}</p>
          <p className="animate-pulse text-xs text-muted-foreground">ruft an…</p>
        </div>
      </div>
      <div className="flex gap-2 border-t p-3">
        <Button
          variant="outline"
          className="flex-1 gap-1.5"
          onClick={async () => {
            const id = call.id;
            clear();
            await setCallStatus(id, "declined").catch(() => {});
          }}
        >
          <PhoneOff className="h-4 w-4 text-destructive" /> Ablehnen
        </Button>
        <Button
          className="flex-1 gap-1.5"
          onClick={async () => {
            const id = call.id;
            const from = call.created_by;
            clear();
            await setCallStatus(id, "accepted").catch(() => {});
            onAccept(from, id);
          }}
        >
          <Phone className="h-4 w-4" /> Annehmen
        </Button>
      </div>
    </div>
  );
}
