import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, AlertTriangle, Shield, Clock, FileArchive, Loader2 } from "lucide-react";

export const Route = createFileRoute("/bank-paket/$token")({
  component: BankPackageDownloadPage,
});

type ShareInfo = {
  status: "ok" | "expired" | "invalid";
  client_name: string | null;
  package_title: string | null;
  size_bytes: number | null;
  attachment_count: number | null;
  expires_at: string | null;
  company_name: string | null;
  logo_url: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  company_email: string | null;
  company_website: string | null;
};

function formatBytes(n: number | null): string {
  if (!n) return "—";
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function BankPackageDownloadPage() {
  const { token } = Route.useParams();

  const { data, isLoading, error } = useQuery({
    queryKey: ["bank_package_share", token],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("bank_package_share_resolve", { _token: token });
      if (error) throw error;
      return (data?.[0] as ShareInfo | undefined) ?? null;
    },
  });

  const companyName = data?.company_name ?? "ASIMO";
  const primary = data?.primary_color ?? "#324642";
  const logoUrl = data?.logo_url ?? "";

  if (isLoading) {
    return (
      <Shell primary={primary}>
        <div className="text-center py-16">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </Shell>
    );
  }

  if (error || !data || data.status === "invalid") {
    return (
      <Shell primary={primary} companyName={companyName} logoUrl={logoUrl}>
        <Card>
          <CardContent className="p-8 text-center space-y-4">
            <AlertTriangle className="mx-auto h-12 w-12 text-orange-500" />
            <h1 className="text-2xl font-bold">Link nicht verfügbar</h1>
            <p className="text-muted-foreground">
              Dieser Download-Link ist ungültig. Bitte fordern Sie einen neuen Link an.
            </p>
          </CardContent>
        </Card>
      </Shell>
    );
  }

  if (data.status === "expired") {
    return (
      <Shell primary={primary} companyName={companyName} logoUrl={logoUrl}>
        <Card>
          <CardContent className="p-8 text-center space-y-4">
            <Clock className="mx-auto h-12 w-12 text-orange-500" />
            <h1 className="text-2xl font-bold">Link abgelaufen</h1>
            <p className="text-muted-foreground">
              Aus Sicherheitsgründen sind diese Download-Links nur 7 Tage gültig.
              Bitte kontaktieren Sie {companyName} für einen neuen Link.
            </p>
            {data.company_email && (
              <a
                href={`mailto:${data.company_email}`}
                className="text-sm underline"
                style={{ color: primary }}
              >
                {data.company_email}
              </a>
            )}
          </CardContent>
        </Card>
      </Shell>
    );
  }

  const expires = data.expires_at ? new Date(data.expires_at) : null;
  const daysLeft = expires
    ? Math.max(0, Math.ceil((expires.getTime() - Date.now()) / (24 * 60 * 60 * 1000)))
    : 0;

  return (
    <Shell primary={primary} companyName={companyName} logoUrl={logoUrl}>
      <Card className="overflow-hidden">
        <div
          className="px-8 pt-8 pb-6 text-white"
          style={{ background: `linear-gradient(135deg, ${primary}, ${primary}cc)` }}
        >
          <div className="flex items-center gap-3 mb-2 text-white/80 text-sm">
            <Shield className="h-4 w-4" />
            <span>Vertrauliches Finanzierungsdossier</span>
          </div>
          <h1 className="text-3xl font-bold">
            Finanzierungsdossier{data.client_name ? ` – ${data.client_name}` : ""}
          </h1>
          <p className="text-white/85 mt-2">
            Bereitgestellt von {companyName} zur Vorlage bei der finanzierenden Bank.
          </p>
        </div>

        <CardContent className="p-8 space-y-6">
          <div className="rounded-lg border bg-muted/30 p-4 flex items-start gap-3">
            <FileArchive className="h-5 w-5 mt-0.5 shrink-0" style={{ color: primary }} />
            <div className="flex-1 text-sm">
              <div className="font-medium">{data.package_title ?? "Bank-Paket"}</div>
              <div className="text-muted-foreground mt-0.5">
                ZIP-Archiv ({formatBytes(data.size_bytes)})
                {data.attachment_count != null && ` · ${data.attachment_count} Anhänge`} · Master-PDF
                inkl. Selbstauskünfte, Objekt-, Einkommens- und Finanzierungsunterlagen
              </div>
            </div>
          </div>

          <div className="text-center py-2">
            <Button
              asChild
              size="lg"
              className="text-white text-base h-12 px-8"
              style={{ backgroundColor: primary }}
            >
              <a href={`/api/public/bank-paket/${token}`} download>
                <Download className="mr-2 h-5 w-5" />
                Gesamtes Dossier herunterladen
              </a>
            </Button>
            <p className="text-xs text-muted-foreground mt-3 flex items-center justify-center gap-1.5">
              <Clock className="h-3.5 w-3.5" />
              Dieser Link ist noch {daysLeft} {daysLeft === 1 ? "Tag" : "Tage"} gültig
              {expires && ` (bis ${expires.toLocaleDateString("de-CH")})`}
            </p>
          </div>

          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900 space-y-2">
            <div className="font-semibold flex items-center gap-1.5">
              <Shield className="h-4 w-4" />
              Vertraulichkeitshinweis
            </div>
            <p>
              Dieses Dossier enthält besonders schützenswerte Personendaten gemäss
              schweizerischem Datenschutzgesetz (DSG). Die Inhalte sind ausschliesslich
              für den vorgesehenen Empfänger (kreditgebende Bank) bestimmt.
            </p>
            <p>
              Weitergabe, Vervielfältigung oder Speicherung über die Dauer der
              Kreditprüfung hinaus ist nur mit ausdrücklicher Zustimmung der
              betroffenen Personen zulässig. Bei irrtümlichem Empfang bitten wir um
              umgehende Benachrichtigung und Löschung der Daten.
            </p>
          </div>

          <div className="text-xs text-muted-foreground border-t pt-4 flex flex-wrap items-center justify-between gap-2">
            <div>
              Bereitgestellt von <span className="font-medium">{companyName}</span>
              {data.company_email && (
                <>
                  {" · "}
                  <a
                    href={`mailto:${data.company_email}`}
                    className="underline"
                    style={{ color: primary }}
                  >
                    {data.company_email}
                  </a>
                </>
              )}
            </div>
            {data.company_website && (
              <a
                href={data.company_website}
                target="_blank"
                rel="noreferrer noopener"
                className="underline"
                style={{ color: primary }}
              >
                {data.company_website.replace(/^https?:\/\//, "")}
              </a>
            )}
          </div>
        </CardContent>
      </Card>
    </Shell>
  );
}

function Shell({
  children,
  primary = "#324642",
  companyName = "ASIMO",
  logoUrl = "",
}: {
  children: React.ReactNode;
  primary?: string;
  companyName?: string;
  logoUrl?: string;
}) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100">
      <header className="border-b bg-white/80 backdrop-blur">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center gap-3">
          {logoUrl ? (
            <img src={logoUrl} alt={companyName} className="h-8 object-contain" />
          ) : (
            <div className="font-bold tracking-wide" style={{ color: primary }}>
              {companyName}
            </div>
          )}
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-6 py-10">{children}</main>
      <footer className="max-w-3xl mx-auto px-6 py-8 text-xs text-muted-foreground text-center">
        © {new Date().getFullYear()} {companyName} · Sichere Dossier-Übergabe
      </footer>
    </div>
  );
}
