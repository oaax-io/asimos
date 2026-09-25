import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { readPendingInvite } from "@/lib/invitations";

// Rückkehrpunkt nach E-Mail-Bestätigung: gemerkte Einladung fortsetzen.
export const Route = createFileRoute("/invite/")({
  ssr: false,
  head: () => ({ meta: [
    { title: "Einladung – Immolia" }, { name: "description", content: "Einladung fortsetzen." },
    { name: "robots", content: "noindex, nofollow" },
    { property: "og:title", content: "Einladung – Immolia" }, { property: "og:description", content: "Einladung fortsetzen." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }),
  component: Resume,
});

function Resume() {
  const navigate = useNavigate();
  useEffect(() => {
    const t = readPendingInvite();
    if (t) navigate({ to: "/invite/$token", params: { token: t }, replace: true });
    else navigate({ to: "/auth", search: { mode: "signin" }, replace: true });
  }, [navigate]);
  return <div className="p-8 text-center text-sm text-muted-foreground">Einen Moment …</div>;
}
