import { createFileRoute } from "@tanstack/react-router";
import { Suspense, lazy, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { createLivekitToken } from "@/lib/livekit.functions";

const VideoRoom = lazy(() => import("@/components/video/VideoRoom"));

export const Route = createFileRoute("/_app/meet/$room")({
  component: MeetPage,
  head: () => ({
    meta: [
      { title: "Videoanruf – ASIMO CRM" },
      {
        name: "description",
        content: "Sicherer Videoanruf mit Kunden und Team direkt im ASIMO CRM.",
      },
      { property: "og:title", content: "Videoanruf – ASIMO CRM" },
      {
        property: "og:description",
        content: "Sicherer Videoanruf mit Kunden und Team direkt im ASIMO CRM.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function MeetPage() {
  const { room } = Route.useParams();
  const getToken = useServerFn(createLivekitToken);
  const [state, setState] = useState<
    | { status: "loading" }
    | { status: "error"; message: string }
    | { status: "ready"; token: string; wsUrl: string }
  >({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    getToken({ data: { room } })
      .then((res) => {
        if (!cancelled) setState({ status: "ready", token: res.token, wsUrl: res.wsUrl });
      })
      .catch((e: any) => {
        if (!cancelled)
          setState({ status: "error", message: e?.message ?? "Verbindung fehlgeschlagen" });
      });
    return () => {
      cancelled = true;
    };
  }, [room, getToken]);

  return (
    <>
      <PageHeader title="Videoanruf" description={`Raum: ${room}`} />
      <Card className="overflow-hidden">
        <CardContent className="h-[75vh] p-0">
          {state.status === "loading" && (
            <div className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Verbinde…
            </div>
          )}
          {state.status === "error" && (
            <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center">
              <p className="text-sm text-destructive">{state.message}</p>
              <p className="text-xs text-muted-foreground">
                Einstellungen → Video: LiveKit-Zugangsdaten hinterlegen.
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
                onLeave={() => history.back()}
              />
            </Suspense>
          )}
        </CardContent>
      </Card>
    </>
  );
}
