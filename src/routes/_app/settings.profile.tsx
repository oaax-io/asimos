import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SUPPORTED_LANGUAGES, type SupportedLanguage } from "@/i18n";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { SettingsPageShell } from "@/components/settings/SettingsPageShell";

export const Route = createFileRoute("/_app/settings/profile")({ component: ProfileSettings });

function ProfileSettings() {
  const { user } = useAuth();
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const [profile, setProfile] = useState({ full_name: "", phone: "" });
  const [lang, setLang] = useState<SupportedLanguage>(
    ((i18n.language?.slice(0, 2) as SupportedLanguage) ?? "de")
  );

  const { data } = useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      const { data: p } = await supabase.from("profiles").select("*").eq("id", user!.id).single();
      return p;
    },
  });

  useEffect(() => {
    if (data) {
      setProfile({ full_name: data.full_name ?? "", phone: data.phone ?? "" });
      const l = data.language as SupportedLanguage | null;
      if (l && SUPPORTED_LANGUAGES.includes(l)) setLang(l);
    }
  }, [data]);

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("profiles").update({ ...profile, language: lang }).eq("id", user!.id);
      if (error) throw error;
    },
    onSuccess: async () => {
      await i18n.changeLanguage(lang);
      try { localStorage.setItem("asimo.lang", lang); } catch {}
      qc.setQueryData(["profile-language", user?.id], { language: lang });
      toast.success(t("settings.profile.saved"));
      qc.invalidateQueries({ queryKey: ["me"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <SettingsPageShell title={t("settings.tabs.profile")}>
      <Card className="max-w-2xl">
        <CardContent className="space-y-4 p-6">
          <h2 className="text-lg font-semibold">{t("settings.profile.title")}</h2>
          <div><Label>{t("settings.profile.email")}</Label><Input value={user?.email ?? ""} disabled /></div>
          <div><Label>{t("settings.profile.name")}</Label><Input value={profile.full_name} onChange={(e) => setProfile({ ...profile, full_name: e.target.value })} /></div>
          <div><Label>{t("settings.profile.phone")}</Label><Input value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} /></div>
          <div>
            <Label>{t("common.language", "Sprache")}</Label>
            <Select value={lang} onValueChange={(v) => setLang(v as SupportedLanguage)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {SUPPORTED_LANGUAGES.map((lng) => (
                  <SelectItem key={lng} value={lng}>{t(`languages.${lng}`)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex justify-end pt-2">
            <Button onClick={() => save.mutate()} disabled={save.isPending}>{t("common.save")}</Button>
          </div>
        </CardContent>
      </Card>
    </SettingsPageShell>
  );
}
