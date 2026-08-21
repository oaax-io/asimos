import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { BankAccountsManager } from "@/components/settings/BankAccountsManager";
import { SettingsPageShell } from "@/components/settings/SettingsPageShell";

export const Route = createFileRoute("/_app/settings/banks")({ component: BankSettings });

function BankSettings() {
  const { t } = useTranslation();
  return (
    <SettingsPageShell title={t("settings.tabs.banks")}>
      <div className="max-w-3xl"><BankAccountsManager /></div>
    </SettingsPageShell>
  );
}
