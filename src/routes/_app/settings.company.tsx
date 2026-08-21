import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { CompanyProfileForm } from "@/components/settings/CompanyProfileForm";
import { SettingsPageShell } from "@/components/settings/SettingsPageShell";

export const Route = createFileRoute("/_app/settings/company")({ component: CompanySettings });

function CompanySettings() {
  const { t } = useTranslation();
  return (
    <SettingsPageShell title={t("settings.tabs.company")}>
      <div className="max-w-3xl"><CompanyProfileForm /></div>
    </SettingsPageShell>
  );
}
