import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { isBackendUnavailableError } from "@/lib/backend-errors";

export const Route = createFileRoute("/")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session) {
      // Phase 4.8: kein Legacy-Superadmin-Ziel mehr; Plattform-Admin über das Kontomenü (/platform).
      void isBackendUnavailableError;
      throw redirect({ to: "/dashboard" });
    }
    throw redirect({ to: "/auth", search: { mode: "signin" } });
  },
  component: () => null,
});
