import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { PRESENCE_HEARTBEAT_MS } from "@/lib/presence";

const IDLE_MS = 10 * 60 * 1000; // 10 Minuten Inaktivität -> Abwesend
const AUTO_AWAY_KEY = "presence:auto-away";

/**
 * Echtzeit-Präsenz:
 * - Heartbeat alle 45s (presence_updated_at) — ohne Heartbeat gilt ein User als offline
 * - App-Start / Login: "away" oder "offline" wird auf "available" zurückgesetzt
 * - 10 Min Inaktivität: "available" -> "away" (automatisch markiert)
 * - Beim Schliessen des Tabs: "offline"
 * - Realtime-Subscription auf profiles: Statusänderungen anderer User erscheinen sofort
 * Manuell gesetzte Status (Beschäftigt / Im Termin) werden nie überschrieben.
 */
export function useAutoPresence() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    const userId = user.id;
    let cancelled = false;

    const invalidate = () => {
      qc.invalidateQueries({ queryKey: ["my-presence"] });
      qc.invalidateQueries({ queryKey: ["team-members"] });
      qc.invalidateQueries({ queryKey: ["chat-member"] });
    };

    const write = async (value: string) => {
      const { error } = await supabase
        .from("profiles")
        .update({ presence_status: value, presence_updated_at: new Date().toISOString() })
        .eq("id", userId);
      if (error) return;
      invalidate();
    };

    const currentStatus = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("presence_status")
        .eq("id", userId)
        .maybeSingle();
      return (data?.presence_status ?? "available") as string;
    };

    const heartbeat = async () => {
      await supabase
        .from("profiles")
        .update({ presence_updated_at: new Date().toISOString() })
        .eq("id", userId);
    };

    const goAway = async () => {
      const status = await currentStatus();
      if (status !== "available") return;
      localStorage.setItem(AUTO_AWAY_KEY, "1");
      await write("away");
    };

    const goBack = async () => {
      if (localStorage.getItem(AUTO_AWAY_KEY) !== "1") return;
      localStorage.removeItem(AUTO_AWAY_KEY);
      await write("available");
    };

    const resetTimer = () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(goAway, IDLE_MS);
      void goBack();
    };

    // Beim Start: away/offline zurücksetzen
    (async () => {
      const status = await currentStatus();
      if (cancelled) return;
      if (status === "away" || status === "offline") {
        localStorage.removeItem(AUTO_AWAY_KEY);
        await write("available");
      } else {
        await heartbeat();
      }
      resetTimer();
    })();

    const heartbeatId = setInterval(() => {
      if (document.visibilityState === "visible") void heartbeat();
    }, PRESENCE_HEARTBEAT_MS);

    const events: (keyof WindowEventMap)[] = [
      "mousemove",
      "mousedown",
      "keydown",
      "scroll",
      "touchstart",
      "focus",
    ];
    events.forEach((e) => window.addEventListener(e, resetTimer, { passive: true }));

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        void heartbeat();
        resetTimer();
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    // Tab wird geschlossen -> sofort offline melden
    const onLeave = () => {
      const url = `${import.meta.env['VITE_SUPABASE_URL']}/rest/v1/profiles?id=eq.${userId}`;
      const key = import.meta.env['VITE_SUPABASE_PUBLISHABLE_KEY'] as string | undefined;
      void supabase.auth.getSession().then(({ data }) => {
        const token = data.session?.access_token;
        if (!key || !token) return;
        void fetch(url, {
          method: "PATCH",
          keepalive: true,
          headers: {
            apikey: key,
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
            Prefer: "return=minimal",
          },
          body: JSON.stringify({
            presence_status: "offline",
            presence_updated_at: new Date().toISOString(),
          }),
        });
      });
    };
    window.addEventListener("pagehide", onLeave);

    // Realtime: Statusänderungen aller Profile sofort übernehmen
    const channel = supabase
      .channel("presence-profiles")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "profiles" }, () => {
        invalidate();
      })
      .subscribe();

    return () => {
      cancelled = true;
      if (timerRef.current) clearTimeout(timerRef.current);
      clearInterval(heartbeatId);
      events.forEach((e) => window.removeEventListener(e, resetTimer));
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onLeave);
      supabase.removeChannel(channel);
    };
  }, [user?.id, qc]);
}
