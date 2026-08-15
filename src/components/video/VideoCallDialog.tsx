import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Copy, Maximize2, Minimize2, Minus, Video, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useLivekitToken } from "@/components/video/useLivekitToken";
import { VideoStage } from "@/components/video/VideoStage";

type Mode = "minimized" | "normal" | "maximized";

/** Kompaktes, frei skalierbares Videoanruf-Fenster (kein modaler Dialog). */
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
  const [mode, setMode] = useState<Mode>("normal");
  const state = useLivekitToken(room, open);

  useEffect(() => {
    if (open) setMode("normal");
  }, [open]);

  if (!open) return null;

  const shareLink = `${typeof window !== "undefined" ? window.location.origin : ""}/meet/${encodeURIComponent(room)}`;

  const shell =
    mode === "maximized"
      ? "inset-4 md:inset-10"
      : mode === "minimized"
        ? "bottom-4 right-4 w-[280px]"
        : "bottom-4 right-4 w-[420px] h-[320px] md:w-[560px] md:h-[380px]";

  return (
    <div
      className={cn(
        "fixed z-50 flex flex-col overflow-hidden rounded-xl border bg-background shadow-2xl",
        shell,
      )}
    >
      <div
        className="flex shrink-0 items-center gap-2 border-b bg-muted/60 px-3 py-2"
        onDoubleClick={() => setMode(mode === "minimized" ? "normal" : "minimized")}
      >
        <Video className="h-4 w-4 shrink-0 text-primary" />
        <span className="min-w-0 flex-1 truncate text-sm font-semibold">
          {title || "Videoanruf"}
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          title="Link kopieren"
          onClick={() => {
            navigator.clipboard.writeText(shareLink);
            toast.success("Link kopiert");
          }}
        >
          <Copy className="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          title={mode === "minimized" ? "Öffnen" : "Minimieren"}
          onClick={() => setMode(mode === "minimized" ? "normal" : "minimized")}
        >
          <Minus className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          title={mode === "maximized" ? "Verkleinern" : "Vergrössern"}
          onClick={() => setMode(mode === "maximized" ? "normal" : "maximized")}
        >
          {mode === "maximized" ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          title="Anruf beenden"
          onClick={() => onOpenChange(false)}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className={cn("min-h-0 flex-1", mode === "minimized" && "hidden")}>
        <VideoStage state={state} onLeave={() => onOpenChange(false)} />
      </div>
    </div>
  );
}
