import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { NotificationPreferencesForm } from "@/components/settings/NotificationPreferencesForm";
import { SettingsPageShell } from "@/components/settings/SettingsPageShell";

export const Route = createFileRoute("/_app/settings/notifications")({ component: NotificationSettings });

function NotificationSettings() {
  const { t } = useTranslation();
  return (
    <SettingsPageShell title={t("settings.tabs.notifications")}>
      <NotificationPreferencesForm />
    </SettingsPageShell>
  );
}
