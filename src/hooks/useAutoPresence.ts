import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

const IDLE_MS = 10 * 60 * 1000; // 10 Minuten Inaktivität -> Abwesend
const AUTO_AWAY_KEY = "presence:auto-away";

/**
 * Automatische Status-Pflege:
 * - App-Start / Login: "away" oder "offline" wird auf "available" zurückgesetzt
 * - 10 Min Inaktivität: "available" -> "away" (automatisch markiert)
 * - Aktivität danach: automatisches "away" -> "available"
 * - Tab schliessen: "offline" (best effort)
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

    const write = async (value: string) => {
      const { error } = await supabase
        .from("profiles")
        .update({ presence_status: value, presence_updated_at: new Date().toISOString() })
        .eq("id", userId);
      if (error) return;
      qc.invalidateQueries({ queryKey: ["my-presence"] });
      qc.invalidateQueries({ queryKey: ["team-members"] });
      qc.invalidateQueries({ queryKey: ["chat-member"] });
    };

    const currentStatus = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("presence_status")
        .eq("id", userId)
        .maybeSingle();
      return (data?.presence_status ?? "available") as string;
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
      }
      resetTimer();
    })();

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
      if (document.visibilityState === "visible") resetTimer();
    };
    document.addEventListener("visibilitychange", onVisibility);

    const onUnload = () => {
      localStorage.setItem(AUTO_AWAY_KEY, "1");
      void write("offline");
    };
    window.addEventListener("beforeunload", onUnload);

    return () => {
      cancelled = true;
      if (timerRef.current) clearTimeout(timerRef.current);
      events.forEach((e) => window.removeEventListener(e, resetTimer));
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("beforeunload", onUnload);
    };
  }, [user?.id, qc]);
}
