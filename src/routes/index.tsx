import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session) {
      const { data: isSuper } = await supabase.rpc("is_superadmin");
      throw redirect({ to: isSuper ? "/oaax" : "/dashboard" });
    }
    throw redirect({ to: "/auth", search: { mode: "signin" } });
  },
  component: () => null,
});
