import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { BrandkitForm } from "@/components/settings/BrandkitForm";
import { SettingsPageShell } from "@/components/settings/SettingsPageShell";

export const Route = createFileRoute("/_app/settings/brandkit")({ component: BrandkitSettings });

function BrandkitSettings() {
  const { t } = useTranslation();
  return (
    <SettingsPageShell title={t("settings.tabs.brand")}>
      <BrandkitForm />
    </SettingsPageShell>
  );
}
