import type { ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { checkDomainAccess } from "@/lib/public-domain-branding.functions";
import { Button } from "@/components/ui/button";

export function useDomainAccess(enabled: boolean) {
  const { user } = useAuth();
  const fn = useServerFn(checkDomainAccess);
  const host = typeof window !== "undefined" ? window.location.hostname : "";
  return useQuery({
    queryKey: ["domain-access", host, user?.id],
    queryFn: () => fn(),
    enabled: enabled && !!user,
    staleTime: 5 * 60_000,
  });
}

export function NoAccessMessage() {
  const { signOut } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="max-w-md rounded-2xl border bg-card p-8 text-center shadow-soft">
        <h1 className="text-lg font-semibold">Kein Zugriff</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Dein Benutzerkonto hat keinen Zugriff auf diesen Bereich.
        </p>
        <Button
          className="mt-6"
          onClick={async () => {
            await qc.cancelQueries();
            qc.clear();
            await signOut();
            navigate({ to: "/auth", search: { mode: "signin" }, replace: true });
          }}
        >
          Abmelden
        </Button>
      </div>
    </div>
  );
}

/** Zeigt die App nur, wenn die Domain keine andere Firma darstellt als die eigene. */
export function DomainAccessGate({ children }: { children: ReactNode }) {
  const q = useDomainAccess(true);
  if (q.isLoading) return null;
  if (q.data && !q.data.allowed) return <NoAccessMessage />;
  return <>{children}</>;
}
