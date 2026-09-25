import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { PlatformLayout } from "@/components/platform/PlatformLayout";

/**
 * Immolia Platform Admin Center. Zugang nur für platform_admins mit
 * Rolle system_owner / platform_admin (is_platform_admin()).
 * Tenant-Rollen (inkl. Inhaber) gewähren keinen Zugang.
 */
export const Route = createFileRoute("/platform")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/auth", search: { mode: "signin" } });
    const { data: ok, error } = await supabase.rpc("is_platform_admin");
    if (error || !ok) throw redirect({ to: "/dashboard" });
  },
  head: () => ({
    meta: [
      { title: "Immolia Platform Admin" },
      { name: "description", content: "Betreiberbereich der Immolia-Plattform." },
      { property: "og:title", content: "Immolia Platform Admin" },
      { property: "og:description", content: "Betreiberbereich der Immolia-Plattform." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PlatformLayout,
});
