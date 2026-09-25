import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CreateTenantWizard } from "@/components/platform/CreateTenantWizard";
import { PlatformPage, QueryState } from "@/components/platform/PlatformLayout";
import { usePlatformTenants, TENANT_STATUS_LABEL, domainStatusLabel, fmtDate } from "@/lib/platform-admin";

export const Route = createFileRoute("/platform/tenants/")({ component: Tenants });

function Tenants() {
  const q = usePlatformTenants();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const rows = useMemo(() => {
    const s = search.trim().toLowerCase();
    return (q.data ?? []).filter((t) =>
      (status === "all" || t.status === status) &&
      (!s || [t.name, t.subdomain, t.custom_domain].some((v) => v?.toLowerCase().includes(s))));
  }, [q.data, search, status]);
  return (
    <PlatformPage title="Unternehmen" actions={<CreateTenantWizard />}>
      <div className="flex gap-3">
        <Input placeholder="Firmenname oder Domain suchen …" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-sm" />
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Status</SelectItem>
            <SelectItem value="active">Aktiv</SelectItem>
            <SelectItem value="suspended">Deaktiviert</SelectItem>
            <SelectItem value="archived">Archiviert</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <QueryState isLoading={q.isLoading} error={q.error} />
      <Card>
        <Table>
          <TableHeader><TableRow>
            <TableHead>Unternehmen</TableHead><TableHead>Status</TableHead><TableHead>Mitglieder</TableHead>
            <TableHead>Immolia-Adresse</TableHead><TableHead>Custom Domain</TableHead><TableHead>White Label</TableHead>
            <TableHead>Module</TableHead><TableHead>Erstellt</TableHead><TableHead>Aktion</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {rows.map((t) => (
              <TableRow key={t.id}>
                <TableCell className="font-medium">{t.name}</TableCell>
                <TableCell><Badge variant={t.status === "active" ? "default" : "secondary"}>{TENANT_STATUS_LABEL[t.status] ?? t.status}</Badge></TableCell>
                <TableCell>{t.members}</TableCell>
                <TableCell>{t.subdomain ?? "–"}</TableCell>
                <TableCell>{t.custom_domain ? `${t.custom_domain} · ${domainStatusLabel({ verification_status: t.custom_domain_status, activated_at: t.custom_domain_active ? "x" : null, domain_type: "custom" })}` : "–"}</TableCell>
                <TableCell>{t.has_branding ? "Ja" : "Nein"}</TableCell>
                <TableCell>{t.modules_active}</TableCell>
                <TableCell>{fmtDate(t.created_at)}</TableCell>
                <TableCell><Link to="/platform/tenants/$agencyId" params={{ agencyId: t.id }} className="text-primary hover:underline">Details</Link></TableCell>
              </TableRow>
            ))}
            {!q.isLoading && !rows.length && <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground">Keine Unternehmen gefunden.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </Card>
    </PlatformPage>
  );
}
