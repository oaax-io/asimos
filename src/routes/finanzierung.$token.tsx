import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { FileSignature, AlertTriangle, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/finanzierung/$token")({ component: PublicFinancingForm });

function PublicFinancingForm() {
  const { token } = Route.useParams();

  const { data, isLoading, error } = useQuery({
    queryKey: ["financing_link", token],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("financing_link_resolve", { _token: token });
      if (error) throw error;
      return data?.[0] ?? null;
    },
  });

  if (isLoading) {
    return <Shell><p className="text-sm text-muted-foreground">Lädt…</p></Shell>;
  }

  if (error || !data || data.status === "invalid" || data.status === "expired") {
    return (
      <Shell>
        <div className="text-center">
          <AlertTriangle className="mx-auto h-12 w-12 text-orange-500" />
          <h1 className="mt-4 font-display text-2xl font-bold">Link nicht verfügbar</h1>
          <p className="mt-2 text-muted-foreground">Dieser Link ist ungültig oder abgelaufen.</p>
        </div>
      </Shell>
    );
  }

  if (data.status === "submitted") {
    return (
      <Shell>
        <div className="text-center">
          <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-600" />
          <h1 className="mt-4 font-display text-2xl font-bold">Bereits eingereicht</h1>
          <p className="mt-2 text-muted-foreground">Diese Finanzierungsangaben wurden bereits eingereicht.</p>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="mb-8 text-center">
        <FileSignature className="mx-auto h-10 w-10 text-primary" />
        <h1 className="mt-3 font-display text-3xl font-bold">Finanzierungsangaben</h1>
        {data.client_name && (
          <p className="mt-2 text-muted-foreground">für {data.client_name}</p>
        )}
      </div>

      <Card><CardContent className="p-8 text-center">
        <p className="text-sm text-muted-foreground">
          Die zehn Formularsektionen folgen in Schritt 2.
        </p>
      </CardContent></Card>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-soft py-12">
      <div className="mx-auto max-w-2xl px-4">{children}</div>
    </div>
  );
}
