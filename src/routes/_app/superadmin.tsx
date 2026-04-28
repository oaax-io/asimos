import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Shield, Building2, Users, UserPlus, Trash2, Search, ShieldCheck, ShieldOff, RefreshCcw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { PageHeader } from "@/components/PageHeader";
import { formatDate } from "@/lib/format";

export const Route = createFileRoute("/_app/superadmin")({
  component: SuperadminPage,
});

type Agency = { id: string; name: string; slug: string | null; created_at: string };
type Profile = { id: string; agency_id: string; full_name: string | null; email: string | null; role: string; created_at: string };
type RoleRow = { id: string; user_id: string; role: string; created_at: string };

function SuperadminPage() {
  const { isSuperadmin, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !isSuperadmin) navigate({ to: "/dashboard" });
  }, [isSuperadmin, loading, navigate]);

  if (loading || !isSuperadmin) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Superadmin"
        description="Verwalte alle Agenturen, Nutzer und Rollen der Plattform."
        icon={<Shield className="h-6 w-6" />}
      />
      <StatsGrid />
      <Tabs defaultValue="agencies" className="space-y-4">
        <TabsList>
          <TabsTrigger value="agencies"><Building2 className="mr-2 h-4 w-4" />Agenturen</TabsTrigger>
          <TabsTrigger value="users"><Users className="mr-2 h-4 w-4" />Nutzer</TabsTrigger>
          <TabsTrigger value="roles"><ShieldCheck className="mr-2 h-4 w-4" />Rollen</TabsTrigger>
        </TabsList>
        <TabsContent value="agencies"><AgenciesTab /></TabsContent>
        <TabsContent value="users"><UsersTab /></TabsContent>
        <TabsContent value="roles"><RolesTab /></TabsContent>
      </Tabs>
    </div>
  );
}

function StatsGrid() {
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_get_stats");
      if (error) throw error;
      return data?.[0] ?? null;
    },
  });

  const items = [
    { label: "Agenturen", value: data?.agencies_count, icon: Building2 },
    { label: "Nutzer", value: data?.users_count, icon: Users },
    { label: "Leads", value: data?.leads_count, icon: UserPlus },
    { label: "Kunden", value: data?.clients_count, icon: Users },
    { label: "Immobilien", value: data?.properties_count, icon: Building2 },
    { label: "Termine", value: data?.appointments_count, icon: Shield },
  ];

  return (
    <div>
      <div className="mb-3 flex items-center justify-end">
        <Button variant="ghost" size="sm" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCcw className={`mr-2 h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />Aktualisieren
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        {items.map((s) => (
          <Card key={s.label} className="border-0 bg-gradient-soft shadow-soft">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-muted-foreground">{s.label}</p>
                <s.icon className="h-4 w-4 text-primary" />
              </div>
              <p className="mt-2 font-display text-2xl font-bold">
                {isLoading ? "—" : (s.value ?? 0).toLocaleString("de-DE")}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function AgenciesTab() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const { data: agencies, isLoading } = useQuery({
    queryKey: ["admin-agencies"],
    queryFn: async () => {
      const { data, error } = await supabase.from("agencies").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data as Agency[];
    },
  });
  const { data: counts } = useQuery({
    queryKey: ["admin-agency-counts"],
    queryFn: async () => {
      const [profiles, props, leads] = await Promise.all([
        supabase.from("profiles").select("agency_id"),
        supabase.from("properties").select("agency_id"),
        supabase.from("leads").select("agency_id"),
      ]);
      const tally = (rows: { agency_id: string }[] | null) => {
        const m: Record<string, number> = {};
        rows?.forEach((r) => { m[r.agency_id] = (m[r.agency_id] ?? 0) + 1; });
        return m;
      };
      return {
        users: tally(profiles.data as { agency_id: string }[] | null),
        properties: tally(props.data as { agency_id: string }[] | null),
        leads: tally(leads.data as { agency_id: string }[] | null),
      };
    },
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("agencies").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Agentur gelöscht");
      qc.invalidateQueries({ queryKey: ["admin-agencies"] });
      qc.invalidateQueries({ queryKey: ["admin-stats"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = useMemo(
    () => (agencies ?? []).filter((a) => a.name.toLowerCase().includes(search.toLowerCase())),
    [agencies, search],
  );

  return (
    <Card className="border-0 shadow-soft">
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle className="text-base">Alle Agenturen</CardTitle>
        <div className="relative w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Suchen…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Nutzer</TableHead>
              <TableHead>Immobilien</TableHead>
              <TableHead>Leads</TableHead>
              <TableHead>Erstellt</TableHead>
              <TableHead className="w-20" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Lädt…</TableCell></TableRow>}
            {!isLoading && filtered.length === 0 && <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Keine Agenturen gefunden</TableCell></TableRow>}
            {filtered.map((a) => (
              <TableRow key={a.id}>
                <TableCell className="font-medium">{a.name}</TableCell>
                <TableCell>{counts?.users[a.id] ?? 0}</TableCell>
                <TableCell>{counts?.properties[a.id] ?? 0}</TableCell>
                <TableCell>{counts?.leads[a.id] ?? 0}</TableCell>
                <TableCell className="text-muted-foreground">{formatDate(a.created_at)}</TableCell>
                <TableCell>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Agentur löschen?</AlertDialogTitle>
                        <AlertDialogDescription>
                          „{a.name}" wird endgültig gelöscht. Verknüpfte Daten in der Datenbank bleiben bestehen, sind aber ohne Agentur nicht mehr zugänglich.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                        <AlertDialogAction onClick={() => del.mutate(a.id)}>Löschen</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function UsersTab() {
  const [search, setSearch] = useState("");
  const { data: profiles, isLoading } = useQuery({
    queryKey: ["admin-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data as Profile[];
    },
  });
  const { data: agencies } = useQuery({
    queryKey: ["admin-agencies-min"],
    queryFn: async () => {
      const { data, error } = await supabase.from("agencies").select("id,name");
      if (error) throw error;
      return data as { id: string; name: string }[];
    },
  });
  const { data: roles } = useQuery({
    queryKey: ["admin-roles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("user_roles").select("*");
      if (error) throw error;
      return data as RoleRow[];
    },
  });

  const agencyMap = useMemo(() => Object.fromEntries((agencies ?? []).map((a) => [a.id, a.name])), [agencies]);
  const rolesByUser = useMemo(() => {
    const m: Record<string, string[]> = {};
    (roles ?? []).forEach((r) => { (m[r.user_id] ??= []).push(r.role); });
    return m;
  }, [roles]);

  const filtered = useMemo(
    () => (profiles ?? []).filter((p) => {
      const q = search.toLowerCase();
      return (p.full_name ?? "").toLowerCase().includes(q) || (p.email ?? "").toLowerCase().includes(q);
    }),
    [profiles, search],
  );

  return (
    <Card className="border-0 shadow-soft">
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle className="text-base">Alle Nutzer</CardTitle>
        <div className="relative w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Name oder E-Mail…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>E-Mail</TableHead>
              <TableHead>Agentur</TableHead>
              <TableHead>Rollen</TableHead>
              <TableHead>Erstellt</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Lädt…</TableCell></TableRow>}
            {!isLoading && filtered.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Keine Nutzer gefunden</TableCell></TableRow>}
            {filtered.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="font-medium">{p.full_name ?? "—"}</TableCell>
                <TableCell className="text-muted-foreground">{p.email ?? "—"}</TableCell>
                <TableCell>{agencyMap[p.agency_id] ?? "—"}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    <Badge variant="secondary">{p.role}</Badge>
                    {(rolesByUser[p.id] ?? []).map((r) => (
                      <Badge key={r} className={r === "superadmin" ? "bg-gradient-brand text-primary-foreground" : ""}>
                        {r}
                      </Badge>
                    ))}
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">{formatDate(p.created_at)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function RolesTab() {
  const qc = useQueryClient();
  const { data: profiles } = useQuery({
    queryKey: ["admin-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data as Profile[];
    },
  });
  const { data: roles } = useQuery({
    queryKey: ["admin-roles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("user_roles").select("*");
      if (error) throw error;
      return data as RoleRow[];
    },
  });

  const setRole = useMutation({
    mutationFn: async ({ userId, role, grant }: { userId: string; role: "superadmin" | "agent" | "owner" | "assistant"; grant: boolean }) => {
      const { error } = await supabase.rpc("admin_set_user_role", { _user_id: userId, _role: role, _grant: grant });
      if (error) throw error;
    },
    onSuccess: (_d, v) => {
      toast.success(v.grant ? "Rolle vergeben" : "Rolle entfernt");
      qc.invalidateQueries({ queryKey: ["admin-roles"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const has = (uid: string, role: string) => (roles ?? []).some((r) => r.user_id === uid && r.role === role);

  return (
    <Card className="border-0 shadow-soft">
      <CardHeader>
        <CardTitle className="text-base">Rollen verwalten</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nutzer</TableHead>
              <TableHead>E-Mail</TableHead>
              <TableHead className="text-center">Superadmin</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(profiles ?? []).map((p) => {
              const isSuper = has(p.id, "superadmin");
              return (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.full_name ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{p.email ?? "—"}</TableCell>
                  <TableCell className="text-center">
                    <Button
                      variant={isSuper ? "destructive" : "default"}
                      size="sm"
                      disabled={setRole.isPending}
                      onClick={() => setRole.mutate({ userId: p.id, role: "superadmin", grant: !isSuper })}
                    >
                      {isSuper ? <><ShieldOff className="mr-2 h-4 w-4" />Entziehen</> : <><ShieldCheck className="mr-2 h-4 w-4" />Vergeben</>}
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
