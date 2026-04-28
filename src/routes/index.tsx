import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { isBackendUnavailableError } from "@/lib/backend-errors";

export const Route = createFileRoute("/")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session) {
      const { data: isSuper, error } = await supabase.rpc("is_superadmin");
      if (error && !isBackendUnavailableError(error)) {
        throw error;
      }
      throw redirect({ to: isSuper ? "/oaax" : "/dashboard" });
    }
    throw redirect({ to: "/auth", search: { mode: "signin" } });
  },
  component: () => null,
});
