import { createFileRoute } from "@tanstack/react-router";
import { LivekitSettingsForm } from "@/components/settings/LivekitSettingsForm";
import { SettingsPageShell } from "@/components/settings/SettingsPageShell";

export const Route = createFileRoute("/_app/settings/video")({ component: VideoSettings });

function VideoSettings() {
  return (
    <SettingsPageShell title="Video" description="LiveKit-Zugangsdaten für Video-Meetings">
      <LivekitSettingsForm />
    </SettingsPageShell>
  );
}
