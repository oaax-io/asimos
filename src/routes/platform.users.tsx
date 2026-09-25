import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { PlatformPage, QueryState } from "@/components/platform/PlatformLayout";
import { MembersTable } from "@/components/platform/tables";
import { useAuth } from "@/lib/auth";
import {
  usePlatformMembers, usePlatformUsers, useMyPlatformRole, ROLE_LABEL, PLATFORM_ROLES, fmtDate,
  findPlatformUserByEmail, setPlatformUserRole, removePlatformUserAccess,
  type PlatformUser, type FoundUser,
} from "@/lib/platform-admin";

type Pending =
  | { kind: "role"; user: PlatformUser; role: string }
  | { kind: "remove"; user: PlatformUser }
  | null;

export const Route = createFileRoute("/platform/users")({
  head: () => ({ meta: [{ title: "Benutzer – Immolia Platform Admin" }] }),
  component: PlatformUsersPage,
});

function PlatformUsersPage() {
  const members = usePlatformMembers();
  const users = usePlatformUsers();
  const myRole = useMyPlatformRole();
  const { user } = useAuth();
  const qc = useQueryClient();
  const isOwner = myRole.data === "system_owner";
  const ownerCount = (users.data ?? []).filter((u) => u.platform_role === "system_owner").length;
  const [pending, setPending] = useState<Pending>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["platform", "platform-users"] });
    qc.invalidateQueries({ queryKey: ["platform", "members"] });
    qc.invalidateQueries({ queryKey: ["platform", "audit"] });
    qc.invalidateQueries({ queryKey: ["platform", "my-role"] });
  };

  const confirm = async () => {
    if (!pending) return;
    setBusy(true);
    try {
      if (pending.kind === "role") await setPlatformUserRole(pending.user.user_id, pending.role);
      else await removePlatformUserAccess(pending.user.user_id);
      toast.success(pending.kind === "role" ? "Plattformrolle geändert" : "Plattformzugang entfernt");
      refresh();
    } catch (e: any) {
      toast.error(e?.message ?? "Aktion nicht möglich");
    } finally {
      setBusy(false);
      setPending(null);
    }
  };

  return (
    <PlatformPage
      title="Benutzer"
      description="Plattformzugänge und Unternehmens-Mitgliedschaften sind getrennte Systeme. Eine Plattformrolle gibt keinen Zugriff auf Firmendaten."
      actions={isOwner ? <Button onClick={() => setAddOpen(true)}>Plattformzugang hinzufügen</Button> : undefined}
    >
      <Card>
        <CardHeader>
          <CardTitle className="text-base">A) Plattformzugänge</CardTitle>
          <CardDescription>
            {isOwner ? "Nur der System Owner kann Plattformrollen vergeben, ändern oder entfernen." : "Nur Ansicht. Plattformrollen verwaltet ausschliesslich der System Owner."}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <QueryState isLoading={users.isLoading} error={users.error} />
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead><TableHead>E-Mail</TableHead><TableHead>Plattformrolle</TableHead>
                <TableHead>Status</TableHead><TableHead>Erstellt</TableHead><TableHead>Letzte Änderung</TableHead>
                {isOwner && <TableHead className="text-right">Aktionen</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {(users.data ?? []).map((u) => {
                const lastOwner = u.platform_role === "system_owner" && ownerCount <= 1;
                const self = u.user_id === user?.id;
                return (
                  <TableRow key={u.user_id}>
                    <TableCell className="font-medium">{u.full_name ?? "–"}{self && <span className="ml-2 text-xs text-muted-foreground">(Sie)</span>}</TableCell>
                    <TableCell>{u.email ?? "–"}</TableCell>
                    <TableCell>
                      {isOwner && !lastOwner ? (
                        <Select value={u.platform_role} onValueChange={(role) => role !== u.platform_role && setPending({ kind: "role", user: u, role })}>
                          <SelectTrigger className="h-8 w-44"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {PLATFORM_ROLES.map((r) => <SelectItem key={r} value={r}>{ROLE_LABEL[r]}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Badge variant="secondary">{ROLE_LABEL[u.platform_role] ?? u.platform_role}</Badge>
                      )}
                    </TableCell>
                    <TableCell><Badge variant="outline">Aktiv</Badge></TableCell>
                    <TableCell>{fmtDate(u.created_at)}</TableCell>
                    <TableCell>{fmtDate(u.updated_at ?? u.created_at)}</TableCell>
                    {isOwner && (
                      <TableCell className="text-right">
                        <Button
                          variant="ghost" size="sm" disabled={lastOwner}
                          title={lastOwner ? "Der letzte System Owner kann nicht entfernt werden" : undefined}
                          onClick={() => setPending({ kind: "remove", user: u })}
                        >
                          Zugang entfernen
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">B) Unternehmens-Mitgliedschaften</CardTitle>
          <CardDescription>Nur Ansicht. Rollen in Unternehmen werden hier nicht geändert.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <QueryState isLoading={members.isLoading} error={members.error} />
          <MembersTable rows={members.data ?? []} showTenant />
        </CardContent>
      </Card>

      <AlertDialog open={!!pending} onOpenChange={(o) => !o && !busy && setPending(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{pending?.kind === "remove" ? "Plattformzugang entfernen?" : "Plattformrolle ändern?"}</AlertDialogTitle>
            <AlertDialogDescription>
              {pending?.kind === "remove"
                ? `${pending.user.full_name ?? pending.user.email} verliert den Zugang zum Platform Admin. Konto, Unternehmens-Mitgliedschaften und Daten bleiben unverändert.`
                : pending
                  ? `${pending.user.full_name ?? pending.user.email}: ${ROLE_LABEL[pending.user.platform_role]} → ${ROLE_LABEL[pending.role]}. Unternehmens-Mitgliedschaften bleiben unverändert.`
                  : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Abbrechen</AlertDialogCancel>
            <AlertDialogAction disabled={busy} onClick={(e) => { e.preventDefault(); confirm(); }}>Bestätigen</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {isOwner && <AddPlatformUserDialog open={addOpen} onOpenChange={setAddOpen} onDone={refresh} />}
    </PlatformPage>
  );
}

function AddPlatformUserDialog({ open, onOpenChange, onDone }: { open: boolean; onOpenChange: (o: boolean) => void; onDone: () => void }) {
  const [email, setEmail] = useState("");
  const [found, setFound] = useState<FoundUser | null>(null);
  const [role, setRole] = useState("platform_admin");
  const [busy, setBusy] = useState(false);
  const reset = () => { setEmail(""); setFound(null); setRole("platform_admin"); };

  const search = async () => {
    setBusy(true);
    try { setFound(await findPlatformUserByEmail(email)); }
    catch (e: any) { toast.error(e?.message ?? "Suche nicht möglich"); }
    finally { setBusy(false); }
  };
  const save = async () => {
    if (!found?.user_id) return;
    setBusy(true);
    try {
      await setPlatformUserRole(found.user_id, role);
      toast.success("Plattformrolle vergeben");
      onDone(); reset(); onOpenChange(false);
    } catch (e: any) { toast.error(e?.message ?? "Aktion nicht möglich"); }
    finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Plattformzugang hinzufügen</DialogTitle>
          <DialogDescription>Nur für bestehende Benutzerkonten. Es wird kein Zugriff auf Unternehmen erteilt.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex gap-2">
            <Input type="email" placeholder="E-Mail-Adresse" value={email} onChange={(e) => { setEmail(e.target.value); setFound(null); }}
              onKeyDown={(e) => e.key === "Enter" && email && search()} />
            <Button variant="outline" disabled={!email || busy} onClick={search}>Suchen</Button>
          </div>
          {found && !found.exists && (
            <p className="rounded-md border bg-muted/40 p-3 text-sm">Für diese E-Mail besteht noch kein Benutzerkonto.</p>
          )}
          {found?.exists && (
            <div className="space-y-3 rounded-md border p-3 text-sm">
              <div><span className="font-medium">{found.name ?? "–"}</span> · {found.email}</div>
              {found.platform_role && (
                <p className="text-muted-foreground">Hat bereits die Plattformrolle {ROLE_LABEL[found.platform_role]}. Ändern Sie diese in der Liste.</p>
              )}
              {!found.platform_role && (
                <Select value={role} onValueChange={setRole}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PLATFORM_ROLES.map((r) => <SelectItem key={r} value={r}>{ROLE_LABEL[r]}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Abbrechen</Button>
          <Button disabled={!found?.exists || !!found.platform_role || busy} onClick={save}>Rolle vergeben</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
