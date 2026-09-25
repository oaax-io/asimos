import { createFileRoute } from "@tanstack/react-router";
import { SettingsPageShell } from "@/components/settings/SettingsPageShell";
import { WhiteLabelSettings } from "@/components/settings/WhiteLabelSettings";

export const Route = createFileRoute("/_app/settings/white-label")({
  head: () => ({
    meta: [
      { title: "White Label – Einstellungen" },
      { name: "description", content: "Branding, Anmeldeseite und Domain des Unternehmens." },
    ],
  }),
  component: () => (
    <SettingsPageShell title="White Label">
      <WhiteLabelSettings />
    </SettingsPageShell>
  ),
});
