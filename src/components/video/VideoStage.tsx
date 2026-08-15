import { Suspense, lazy } from "react";
import { Loader2 } from "lucide-react";
import type { LivekitTokenState } from "@/components/video/useLivekitToken";

const VideoRoom = lazy(() => import("@/components/video/VideoRoom"));

export function VideoStage({
  state,
  onLeave,
}: {
  state: LivekitTokenState;
  onLeave: () => void;
}) {
  return (
    <div className="h-full w-full bg-muted/40">
      {(state.status === "loading" || state.status === "idle") && (
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
          <VideoRoom token={state.token} serverUrl={state.wsUrl} onLeave={onLeave} />
        </Suspense>
      )}
    </div>
  );
}
