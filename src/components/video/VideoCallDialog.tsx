import { Suspense, lazy, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2, Copy, Video } from "lucide-react";
import { toast } from "sonner";
import { createLivekitToken } from "@/lib/livekit.functions";
const VideoRoom = lazy(() => import("@/components/video/VideoRoom"));

export function VideoCallDialog({
  open,
  onOpenChange,
  room,
  title,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  room: string;
  title?: string;
}) {
  const getToken = useServerFn(createLivekitToken);
  const [state, setState] = useState<
    | { status: "idle" | "loading" }
    | { status: "error"; message: string }
    | { status: "ready"; token: string; wsUrl: string }
  >({ status: "idle" });

  useEffect(() => {
    if (!open) {
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
        setState({
          status: "error",
          message: e?.message ?? "Verbindung fehlgeschlagen",
        });
      });
    return () => {
      cancelled = true;
    };
  }, [open, room, getToken]);

  const shareLink = `${typeof window !== "undefined" ? window.location.origin : ""}/meet/${encodeURIComponent(room)}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl p-0 overflow-hidden">
        <DialogHeader className="px-5 pt-5">
          <DialogTitle className="flex items-center gap-2">
            <Video className="h-4 w-4" />
            {title || "Videoanruf"}
          </DialogTitle>
          <DialogDescription className="flex flex-wrap items-center gap-2">
            <span className="truncate text-xs">Raum: {room}</span>
            <Button
              size="sm"
              variant="outline"
              className="h-7"
              onClick={() => {
                navigator.clipboard.writeText(shareLink);
                toast.success("Link kopiert");
              }}
            >
              <Copy className="mr-1 h-3 w-3" /> Link kopieren
            </Button>
          </DialogDescription>
        </DialogHeader>

        <div className="h-[70vh] w-full bg-muted/40">
          {state.status === "loading" && (
            <div className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Verbinde…
            </div>
          )}
          {state.status === "error" && (
            <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
              <p className="text-sm text-destructive">{state.message}</p>
              <p className="text-xs text-muted-foreground">
                Einstellungen → Video: LiveKit-Server, API Key und Secret hinterlegen.
              </p>
            </div>
          )}
          {state.status === "ready" && (
            <Suspense
              fallback={
                <div className="flex h-full items-center justify-center">
                  <Loader2 className="h-4 w-4 animate-spin" />
                </div>
              }
            >
              <VideoRoom
                token={state.token}
                serverUrl={state.wsUrl}
                onLeave={() => onOpenChange(false)}
              />
            </Suspense>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
