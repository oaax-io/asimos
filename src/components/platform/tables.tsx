import { Link } from "@tanstack/react-router";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ROLE_LABEL, domainStatusLabel, fmtDate, type PlatformDomain, type PlatformMember, type PlatformModule } from "@/lib/platform-admin";

function TenantLink({ id, name }: { id: string; name: string }) {
  return <Link to="/platform/tenants/$agencyId" params={{ agencyId: id }} className="text-primary hover:underline">{name}</Link>;
}
function Empty({ cols }: { cols: number }) {
  return <TableRow><TableCell colSpan={cols} className="text-center text-muted-foreground">Keine Einträge.</TableCell></TableRow>;
}

export function MembersTable({ rows, showTenant }: { rows: PlatformMember[]; showTenant?: boolean }) {
  return (
    <Table>
      <TableHeader><TableRow>
        <TableHead>Name</TableHead><TableHead>E-Mail</TableHead>{showTenant && <TableHead>Unternehmen</TableHead>}
        <TableHead>Tenant-Rolle</TableHead><TableHead>Mitgliedschaft</TableHead><TableHead>Plattformrolle</TableHead><TableHead>Seit</TableHead>
      </TableRow></TableHeader>
      <TableBody>
        {rows.map((m) => (
          <TableRow key={m.user_id + m.agency_id}>
            <TableCell className="font-medium">{m.full_name ?? "–"}</TableCell>
            <TableCell>{m.email ?? "–"}</TableCell>
            {showTenant && <TableCell><TenantLink id={m.agency_id} name={m.agency_name} /></TableCell>}
            <TableCell>{ROLE_LABEL[m.tenant_role] ?? m.tenant_role}</TableCell>
            <TableCell><Badge variant={m.is_active ? "default" : "secondary"}>{m.is_active ? "Aktiv" : "Inaktiv"}</Badge></TableCell>
            <TableCell>{m.platform_role ? ROLE_LABEL[m.platform_role] ?? m.platform_role : "–"}</TableCell>
            <TableCell>{fmtDate(m.created_at)}</TableCell>
          </TableRow>
        ))}
        {!rows.length && <Empty cols={showTenant ? 7 : 6} />}
      </TableBody>
    </Table>
  );
}

export function DomainsTable({ rows, showTenant }: { rows: PlatformDomain[]; showTenant?: boolean }) {
  return (
    <Table>
      <TableHeader><TableRow>
        <TableHead>Domain</TableHead>{showTenant && <TableHead>Unternehmen</TableHead>}<TableHead>Typ</TableHead>
        <TableHead>Status</TableHead><TableHead>Verifiziert</TableHead><TableHead>Aktiviert</TableHead>
      </TableRow></TableHeader>
      <TableBody>
        {rows.map((d) => (
          <TableRow key={d.id}>
            <TableCell className="font-medium">{d.domain}</TableCell>
            {showTenant && <TableCell><TenantLink id={d.agency_id} name={d.agency_name} /></TableCell>}
            <TableCell>{d.domain_type === "subdomain" ? "Immolia-Subdomain" : "Custom Domain"}</TableCell>
            <TableCell>{domainStatusLabel(d)}</TableCell>
            <TableCell>{fmtDate(d.verified_at)}</TableCell>
            <TableCell>{d.domain_type === "subdomain" ? "–" : fmtDate(d.activated_at)}</TableCell>
          </TableRow>
        ))}
        {!rows.length && <Empty cols={showTenant ? 6 : 5} />}
      </TableBody>
    </Table>
  );
}

export function ModulesTable({ rows, showTenant }: { rows: PlatformModule[]; showTenant?: boolean }) {
  return (
    <Table>
      <TableHeader><TableRow>
        {showTenant && <TableHead>Unternehmen</TableHead>}<TableHead>Modul</TableHead><TableHead>Freigeschaltet</TableHead><TableHead>Aktiviert</TableHead>
      </TableRow></TableHeader>
      <TableBody>
        {rows.map((m) => (
          <TableRow key={m.agency_id + m.module}>
            {showTenant && <TableCell><TenantLink id={m.agency_id} name={m.agency_name} /></TableCell>}
            <TableCell className="font-medium">{m.module}</TableCell>
            <TableCell>{m.is_entitled ? "Ja" : "Nein"}</TableCell>
            <TableCell>{m.is_enabled ? "Ja" : "Nein"}</TableCell>
          </TableRow>
        ))}
        {!rows.length && <Empty cols={showTenant ? 4 : 3} />}
      </TableBody>
    </Table>
  );
}
