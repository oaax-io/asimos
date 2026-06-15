import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { SUPPORTED_LANGUAGES, type SupportedLanguage } from "@/i18n";

/**
 * Loads the user's preferred language from their profile and syncs it with i18next.
 * Mounted once at the root of the authenticated layout.
 */
export function LanguageBootstrap() {
  const { i18n } = useTranslation();
  const { user } = useAuth();

  const { data } = useQuery({
    queryKey: ["profile-language", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("language").eq("id", user!.id).maybeSingle();
      return data;
    },
  });

  useEffect(() => {
    const lng = data?.language as SupportedLanguage | undefined;
    if (lng && SUPPORTED_LANGUAGES.includes(lng) && i18n.language !== lng) {
      i18n.changeLanguage(lng);
      try { localStorage.setItem("asimo.lang", lng); } catch {}
    }
  }, [data?.language, i18n]);

  return null;
}
