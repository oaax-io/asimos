import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { createLivekitToken } from "@/lib/livekit.functions";

export type LivekitTokenState =
  | { status: "idle" | "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; token: string; wsUrl: string };

export function useLivekitToken(room: string, active: boolean): LivekitTokenState {
  const getToken = useServerFn(createLivekitToken);
  const [state, setState] = useState<LivekitTokenState>({ status: "idle" });

  useEffect(() => {
    if (!active) {
      setState({ status: "idle" });
      return;
    }
    let cancelled = false;
    setState({ status: "loading" });
    getToken({ data: { room } })
      .then((res) => {
        if (cancelled) return;
        setState({ status: "ready", token: res.token, wsUrl: res.wsUrl });
      })
      .catch((e: any) => {
        if (cancelled) return;
        setState({ status: "error", message: e?.message ?? "Verbindung fehlgeschlagen" });
      });
    return () => {
      cancelled = true;
    };
  }, [active, room, getToken]);

  return state;
}
