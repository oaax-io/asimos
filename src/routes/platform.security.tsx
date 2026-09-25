import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PlatformPage, QueryState } from "@/components/platform/PlatformLayout";
import { usePlatformAdmins, ROLE_LABEL, fmtDate } from "@/lib/platform-admin";

export const Route = createFileRoute("/platform/security")({ component: () => {
  const q = usePlatformAdmins();
  return (
    <PlatformPage title="Sicherheit" description="Plattformrollen sind strikt von Tenant-Rollen getrennt.">
      <Card>
        <CardHeader><CardTitle className="text-base">Plattformrollen</CardTitle></CardHeader>
        <CardContent>
          <QueryState isLoading={q.isLoading} error={q.error} />
          <Table>
            <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>E-Mail</TableHead><TableHead>Rolle</TableHead><TableHead>Seit</TableHead></TableRow></TableHeader>
            <TableBody>
              {(q.data ?? []).map((a) => (
                <TableRow key={a.user_id}>
                  <TableCell className="font-medium">{a.full_name ?? "–"}</TableCell><TableCell>{a.email ?? "–"}</TableCell>
                  <TableCell>{ROLE_LABEL[a.platform_role] ?? a.platform_role}</TableCell><TableCell>{fmtDate(a.created_at)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <Card><CardContent className="space-y-1 p-5 text-sm text-muted-foreground">
        <p>Zugriffsregel für Firmendaten: Anmeldung → aktive Mitgliedschaft → aktuelle Firma → Zugriffsregeln der Datenbank.</p>
        <p>Plattformrollen gewähren keinen Zugriff auf Leads, Kunden, Objekte, Dokumente, Finanzierungen oder Provisionen.</p>
        <p>Support-Zugriff und «Als Kunde anmelden» gibt es bewusst noch nicht.</p>
      </CardContent></Card>
    </PlatformPage>
  );
} });
