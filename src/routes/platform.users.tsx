import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PlatformPage, QueryState } from "@/components/platform/PlatformLayout";
import { MembersTable } from "@/components/platform/tables";
import { usePlatformMembers, usePlatformAdmins, ROLE_LABEL, fmtDate } from "@/lib/platform-admin";

export const Route = createFileRoute("/platform/users")({ component: () => {
  const q = usePlatformMembers();
  const admins = usePlatformAdmins();
  const memberIds = new Set((q.data ?? []).map((m) => m.user_id));
  return (
    <PlatformPage title="Benutzer" description="Tenant-Mitgliedschaften und Plattformzugänge sind getrennte Konzepte.">
      <Card><CardHeader><CardTitle className="text-base">Plattformzugänge</CardTitle></CardHeader>
        <CardContent className="p-0">
          <QueryState isLoading={admins.isLoading} error={admins.error} />
          <Table>
            <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>E-Mail</TableHead><TableHead>Plattformrolle</TableHead><TableHead>Unternehmens-Mitgliedschaft</TableHead><TableHead>Seit</TableHead></TableRow></TableHeader>
            <TableBody>
              {(admins.data ?? []).map((a) => (
                <TableRow key={a.user_id}>
                  <TableCell className="font-medium">{a.full_name ?? "–"}</TableCell>
                  <TableCell>{a.email ?? "–"}</TableCell>
                  <TableCell>{ROLE_LABEL[a.platform_role] ?? a.platform_role}</TableCell>
                  <TableCell>{memberIds.has(a.user_id) ? "Ja (separat)" : "Keine"}</TableCell>
                  <TableCell>{fmtDate(a.created_at)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent></Card>
      <Card><CardHeader><CardTitle className="text-base">Tenant-Mitgliedschaften</CardTitle></CardHeader>
        <CardContent className="p-0"><QueryState isLoading={q.isLoading} error={q.error} /><MembersTable rows={q.data ?? []} showTenant /></CardContent></Card>
    </PlatformPage>
  );
} });
