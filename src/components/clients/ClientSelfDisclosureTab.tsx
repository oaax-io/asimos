import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Pencil, Upload, FilePlus, FileText } from "lucide-react";
import {
  calculateBenchmark,
  expenseFields,
  expenseLabels,
  formatCHF,
  incomeFields,
  incomeLabels,
} from "@/lib/self-disclosure";
import { BenchmarkCard } from "@/components/clients/BenchmarkCard";
import { ClientSelfDisclosureWizard } from "@/components/clients/ClientSelfDisclosureWizard";

type DisclosureRow = Record<string, unknown> & { id?: string };

interface Props {
  clientId: string;
}

export function ClientSelfDisclosureTab({ clientId }: Props) {
  const [wizardOpen, setWizardOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["client_self_disclosure", clientId],
    queryFn: async () => {
      const { data: disc, error } = await supabase
        .from("client_self_disclosures")
        .select("*")
        .eq("client_id", clientId)
        .maybeSingle();
      if (error) throw error;

      if (!disc) {
        const { data: client } = await supabase
          .from("clients")
          .select("full_name, email, phone, address, postal_code, city, country")
          .eq("id", clientId)
          .maybeSingle();
        if (client) {
          const parts = (client.full_name ?? "").trim().split(/\s+/);
          const first = parts.length > 1 ? parts.slice(0, -1).join(" ") : (parts[0] ?? "");
          const last = parts.length > 1 ? parts[parts.length - 1] : "";
          const addr = (client.address ?? "").trim();
          const m = addr.match(/^(.*?)(\s+\d+\w?)$/);
          const street = m ? m[1].trim() : addr;
          const street_number = m ? m[2].trim() : "";
          return {
            first_name: first,
            last_name: last,
            email: client.email ?? "",
            phone: client.phone ?? "",
            street,
            street_number,
            postal_code: client.postal_code ?? "",
            city: client.city ?? "",
            country: client.country ?? "CH",
          } as DisclosureRow;
        }
      }
      return (disc ?? null) as DisclosureRow | null;
    },
  });

  const benchmark = useMemo(
    () => calculateBenchmark((data ?? {}) as Record<string, number | string | null>),
    [data],
  );

  const hasSaved = !!data && !!data.id;

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Lädt…</div>;
  }

  if (!hasSaved) {
    return (
      <>
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center gap-4 p-10 text-center">
            <div className="rounded-full bg-primary/10 p-4">
              <FileText className="h-7 w-7 text-primary" />
            </div>
            <div>
              <h3 className="font-display text-xl font-semibold">
                Noch keine Selbstauskunft
              </h3>
              <p className="mt-1 max-w-md text-sm text-muted-foreground">
                Erfasse die Selbstauskunft im Wizard – oder lade ein bestehendes
                ASIMO-PDF hoch und lass die Felder automatisch erkennen.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => setWizardOpen(true)}>
                <FilePlus className="mr-2 h-4 w-4" />
                Wizard starten
              </Button>
              <Button variant="outline" onClick={() => setWizardOpen(true)}>
                <Upload className="mr-2 h-4 w-4" />
                PDF hochladen
              </Button>
            </div>
          </CardContent>
        </Card>
        <ClientSelfDisclosureWizard
          clientId={clientId}
          open={wizardOpen}
          onOpenChange={setWizardOpen}
          initial={data}
        />
      </>
    );
  }

  return (
    <>
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-2xl font-semibold">Selbstauskunft</h2>
            <p className="text-sm text-muted-foreground">
              Übersicht der erfassten finanziellen Situation
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setWizardOpen(true)}>
              <Upload className="mr-2 h-4 w-4" />
              PDF hochladen
            </Button>
            <Button onClick={() => setWizardOpen(true)}>
              <Pencil className="mr-2 h-4 w-4" />
              Bearbeiten
            </Button>
          </div>
        </div>

        <BenchmarkCard benchmark={benchmark} />

        <SummaryCard title="Personendaten">
          <SummaryGrid>
            <SummaryItem label="Name" value={
              `${(data?.salutation as string) ?? ""} ${(data?.first_name as string) ?? ""} ${(data?.last_name as string) ?? ""}`.trim()
            } />
            <SummaryItem label="Geburtsdatum" value={data?.birth_date as string} />
            <SummaryItem label="Staatsbürgerschaft" value={data?.nationality as string} />
            <SummaryItem label="Familienstand" value={data?.marital_status as string} />
            <SummaryItem
              label="Adresse"
              value={[
                `${(data?.street as string) ?? ""} ${(data?.street_number as string) ?? ""}`.trim(),
                `${(data?.postal_code as string) ?? ""} ${(data?.city as string) ?? ""}`.trim(),
                data?.country as string,
              ]
                .filter(Boolean)
                .join(", ")}
            />
            <SummaryItem label="E-Mail" value={data?.email as string} />
            <SummaryItem label="Telefon" value={(data?.phone as string) || (data?.mobile as string)} />
            <SummaryItem label="Steuer-ID CH" value={data?.tax_id_ch as string} />
          </SummaryGrid>
        </SummaryCard>

        <SummaryCard title="Beruf">
          <SummaryGrid>
            <SummaryItem label="Status" value={data?.employment_status as string} />
            <SummaryItem label="Arbeitgeber" value={data?.employer_name as string} />
            <SummaryItem label="Position" value={data?.employed_as as string} />
            <SummaryItem label="Beschäftigt seit" value={data?.employed_since as string} />
            <SummaryItem
              label="Jahresgehalt netto"
              value={formatCHF(data?.annual_net_salary as number)}
            />
          </SummaryGrid>
        </SummaryCard>

        <SummaryCard
          title="Einnahmen monatlich"
          right={<TotalBadge value={benchmark.totalIncome} />}
        >
          <SummaryGrid>
            {incomeFields.map((f) => (
              <SummaryItem
                key={f}
                label={incomeLabels[f]}
                value={formatCHF(data?.[f] as number)}
              />
            ))}
          </SummaryGrid>
        </SummaryCard>

        <SummaryCard
          title="Ausgaben monatlich"
          right={<TotalBadge value={benchmark.totalExpenses} />}
        >
          <SummaryGrid>
            {expenseFields.map((f) => (
              <SummaryItem
                key={f}
                label={expenseLabels[f]}
                value={formatCHF(data?.[f] as number)}
              />
            ))}
          </SummaryGrid>
        </SummaryCard>

        {Boolean(data?.internal_notes || data?.advisor_id || data?.disclosure_date) && (
          <SummaryCard title="Abschluss">
            <SummaryGrid>
              <SummaryItem label="Berater" value={data?.advisor_id as string} />
              <SummaryItem label="Datum" value={data?.disclosure_date as string} />
              <SummaryItem label="Ort" value={data?.disclosure_place as string} />
            </SummaryGrid>
            {data?.internal_notes ? (
              <div className="mt-4">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">
                  Interne Notizen
                </div>
                <p className="mt-1 whitespace-pre-wrap text-sm">
                  {String(data.internal_notes)}
                </p>
              </div>
            ) : null}
          </SummaryCard>
        )}
      </div>

      <ClientSelfDisclosureWizard
        clientId={clientId}
        open={wizardOpen}
        onOpenChange={setWizardOpen}
        initial={data}
      />
    </>
  );
}

function SummaryCard({
  title,
  right,
  children,
}: {
  title: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="mb-4 flex items-center justify-between gap-2">
          <h3 className="font-display text-lg font-semibold">{title}</h3>
          {right}
        </div>
        {children}
      </CardContent>
    </Card>
  );
}

function SummaryGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{children}</div>;
}

function SummaryItem({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  return (
    <div>
      <div className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="mt-0.5 text-sm font-medium">
        {value && String(value).trim() !== "" ? value : "—"}
      </div>
    </div>
  );
}

function TotalBadge({ value }: { value: number }) {
  return (
    <span className="text-sm text-muted-foreground">
      Total: <strong className="text-foreground">{formatCHF(value)}</strong>
    </span>
  );
}
