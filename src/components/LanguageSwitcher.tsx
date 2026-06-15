import { useTranslation } from "react-i18next";
import { Globe, Check } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { SUPPORTED_LANGUAGES, type SupportedLanguage } from "@/i18n";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

export function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const { i18n, t } = useTranslation();
  const { user } = useAuth();
  const qc = useQueryClient();
  const current = (i18n.language?.slice(0, 2) ?? "de") as SupportedLanguage;

  const change = async (lng: SupportedLanguage) => {
    await i18n.changeLanguage(lng);
    try { localStorage.setItem("asimo.lang", lng); } catch {}
    // Update the cached profile language so LanguageBootstrap does not revert it
    if (user?.id) {
      qc.setQueryData(["profile-language", user.id], { language: lng });
      const { error } = await supabase.from("profiles").update({ language: lng }).eq("id", user.id);
      if (error) {
        toast.error(error.message);
        return;
      }
    }
    toast.success(t("settings.language.updated", "Sprache aktualisiert"));
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size={compact ? "icon" : "sm"} className="gap-2" title={t("common.language")}>
          <Globe className="h-4 w-4" />
          {!compact && <span className="text-xs font-semibold uppercase">{current}</span>}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {SUPPORTED_LANGUAGES.map((lng) => (
          <DropdownMenuItem key={lng} onClick={() => change(lng)} className="gap-2">
            <span className="w-4">{current === lng ? <Check className="h-3.5 w-3.5" /> : null}</span>
            <span className="font-mono text-xs uppercase">{lng}</span>
            <span>{t(`languages.${lng}`)}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
