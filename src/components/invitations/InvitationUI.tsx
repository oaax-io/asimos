import { useState } from "react";
import { toast } from "sonner";
import { Copy, RefreshCw, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  INVITATION_STATUS_LABEL, INVITE_ROLE_LABEL, inviteLink, resendInvitation, revokeInvitation, type InvitationRow,
} from "@/lib/invitations";

const fmt = (d: string | null) => (d ? new Date(d).toLocaleDateString("de-CH") : "–");

/** Zeigt den Einladungslink genau einmal an (kein E-Mail-Versand eingerichtet). */
export function InviteLinkBox({ token }: { token: string }) {
  const link = inviteLink(token);
  return (
    <div className="space-y-2 rounded-md border bg-muted/40 p-3 text-sm">
      <p className="font-medium">Einladungslink</p>
      <p className="text-muted-foreground">
        Der E-Mail-Versand ist noch nicht eingerichtet – es wurde keine E-Mail gesendet. Bitte den Link selbst an die eingeladene Person weitergeben.
        Er wird nur jetzt angezeigt und ist 7 Tage gültig.
      </p>
      <div className="flex gap-2">
        <Input readOnly value={link} onFocus={(e) => e.currentTarget.select()} className="font-mono text-xs" />
        <Button type="button" variant="outline" size="icon" aria-label="Link kopieren"
          onClick={() => { void navigator.clipboard.writeText(link); toast.success("Link kopiert"); }}>
          <Copy className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

export function InvitationStatusBadge({ status }: { status: string }) {
  const v = status === "pending" ? "default" : status === "accepted" ? "secondary" : "outline";
  return <Badge variant={v}>{INVITATION_STATUS_LABEL[status] ?? status}</Badge>;
}

export function InvitationTable({ rows, canManage, onChanged, showCompany }: {
  rows: InvitationRow[]; canManage: (r: InvitationRow) => boolean; onChanged: () => void; showCompany?: boolean;
}) {
  const [revoke, setRevoke] = useState<InvitationRow | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const doResend = async (r: InvitationRow) => {
    setBusy(true);
    try { const res = await resendInvitation(r.id); setLink(res.token); toast.success("Neue Einladung erstellt, alter Link ungültig"); onChanged(); }
    catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); }
  };
  const doRevoke = async () => {
    if (!revoke) return;
    setBusy(true);
    try { await revokeInvitation(revoke.id); toast.success("Einladung widerrufen"); onChanged(); }
    catch (e) { toast.error((e as Error).message); }
    finally { setBusy(false); setRevoke(null); }
  };

  if (rows.length === 0) return <p className="p-4 text-sm text-muted-foreground">Keine Einladungen.</p>;
  return (
    <div className="space-y-3">
      {link && <div className="px-4 pt-3"><InviteLinkBox token={link} /></div>}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>E-Mail</TableHead>
            {showCompany && <TableHead>Unternehmen</TableHead>}
            <TableHead>Rolle</TableHead>
            <TableHead>Erstellt</TableHead>
            <TableHead>Läuft ab</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>E-Mail-Versand</TableHead>
            <TableHead className="text-right">Aktionen</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => {
            const role = r.role ?? r.tenant_role ?? "";
            const open = r.status === "pending" || r.status === "expired";
            return (
              <TableRow key={r.id}>
                <TableCell>{r.email}</TableCell>
                {showCompany && <TableCell>{r.invitation_type === "platform_user" ? "Immolia Platform" : r.agency_name ?? "–"}</TableCell>}
                <TableCell>{INVITE_ROLE_LABEL[role] ?? role}</TableCell>
                <TableCell>{fmt(r.created_at)}</TableCell>
                <TableCell>{fmt(r.expires_at)}</TableCell>
                <TableCell><InvitationStatusBadge status={r.status} /></TableCell>
                <TableCell className="text-xs text-muted-foreground">{r.email_delivery_status === "sent" ? "Gesendet" : "Nicht eingerichtet"}</TableCell>
                <TableCell className="text-right">
                  {canManage(r) && open && (
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="ghost" disabled={busy} onClick={() => doResend(r)}><RefreshCw className="mr-1 h-3.5 w-3.5" />Neu senden</Button>
                      {r.status === "pending" && (
                        <Button size="sm" variant="ghost" disabled={busy} onClick={() => setRevoke(r)}><XCircle className="mr-1 h-3.5 w-3.5" />Widerrufen</Button>
                      )}
                    </div>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      <AlertDialog open={!!revoke} onOpenChange={(o) => !o && setRevoke(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Einladung widerrufen?</AlertDialogTitle>
            <AlertDialogDescription>
              Der Link für {revoke?.email} wird sofort ungültig. Bestehende Konten, Mitgliedschaften und Daten bleiben unverändert.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Abbrechen</AlertDialogCancel>
            <AlertDialogAction disabled={busy} onClick={(e) => { e.preventDefault(); void doRevoke(); }}>Widerrufen</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
