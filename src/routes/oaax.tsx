import { createFileRoute, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Building2, Users, UserPlus, Trash2, Search, ShieldCheck, ShieldOff,
  RefreshCcw, Home, Calendar, Plus, X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { OaaxLayout } from "@/components/oaax/OaaxLayout";
import { toast } from "sonner";
import { formatDate } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

export const Route = createFileRoute("/oaax")({
  component: SuperadminPage,
});

type Agency = { id: string; name: string; slug: string | null; created_at: string };
type Profile = { id: string; agency_id: string; full_name: string | null; email: string | null; role: string; created_at: string };
type RoleRow = { id: string; user_id: string; role: string; created_at: string };

type Tab = "overview" | "agencies" | "users" | "roles";

function SuperadminPage() {
  const { isSuperadmin, loading, user, superadminStatus, refreshSuperadmin } = useAuth();
  const navigate = useNavigate();
  const { hash } = useLocation();
  const tabFromHash = ((hash || "").replace(/^#/, "") || "overview") as Tab;
  const tab: Tab = (["overview","agencies","users","roles"] as Tab[]).includes(tabFromHash) ? tabFromHash : "overview";
  const setTab = (t: Tab) => navigate({ to: "/oaax", hash: t });

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth", search: { mode: "signin" } });
    else if (!loading && user && superadminStatus === "denied" && !isSuperadmin) navigate({ to: "/dashboard" });
  }, [user, isSuperadmin, superadminStatus, loading, navigate]);

  useEffect(() => {
    if (user && superadminStatus === "unknown") {
      void refreshSuperadmin();
    }
  }, [user, superadminStatus, refreshSuperadmin]);

  if (loading || !user || superadminStatus === "unknown") {
    return (
      <div className="fluent-scope flex h-screen items-center justify-center" style={{ background: "#F3F3F5" }}>
        <div className="h-8 w-8 animate-spin rounded-full border-2" style={{ borderColor: "#3B387D", borderTopColor: "transparent" }} />
      </div>
    );
  }

  if (!isSuperadmin) {
    return null;
  }

  const breadcrumb = [{ label: tab === "overview" ? "Dashboard" : tab === "agencies" ? "Agenturen" : tab === "users" ? "Nutzer" : "Rollen" }];

  return (
    <OaaxLayout breadcrumb={breadcrumb}>
      {/* Header */}
      <div style={{ marginBottom: 22 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.4px", color: "#0F0F12", margin: 0 }}>
            Admin Center
          </h1>
          <span className="fl-label-mono">Plattform · Multi-Tenant</span>
        </div>
        <p style={{ fontSize: 13, color: "#50505C", margin: "4px 0 0" }}>
          Verwalte alle Agenturen, Nutzer und Rollen der Estatly-Plattform.
        </p>
      </div>

      {/* Tabs */}
      <div style={{ marginBottom: 18, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div className="fl-tabs">
          {([
            { id: "overview", label: "Dashboard", icon: Home },
            { id: "agencies", label: "Agenturen", icon: Building2 },
            { id: "users", label: "Nutzer", icon: Users },
            { id: "roles", label: "Rollen", icon: ShieldCheck },
          ] as const).map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                className="fl-tab"
                data-active={tab === t.id}
                onClick={() => setTab(t.id)}
              >
                <Icon size={13} /> {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {tab === "overview" && <OverviewTab />}
      {tab === "agencies" && <AgenciesTab />}
      {tab === "users" && <UsersTab />}
      {tab === "roles" && <RolesTab />}
    </OaaxLayout>
  );
}

// ─── Overview / Stats ───────────────────────────
function StatCard({
  label, value, sub, accent, icon: Icon, loading,
}: {
  label: string; value: number | string | undefined; sub?: string;
  accent: "blue" | "purple" | "green" | "gold" | "danger";
  icon: React.ComponentType<{ size?: number; color?: string }>;
  loading?: boolean;
}) {
  const colors: Record<string, { bar: string; bg: string; text: string; border: string }> = {
    blue:   { bar: "#1E9BCF", bg: "#EAF5FB", text: "#0E6A8E", border: "rgba(30,155,207,0.2)" },
    purple: { bar: "#3B387D", bg: "#EEEDF8", text: "#3B387D", border: "rgba(59,56,125,0.2)" },
    green:  { bar: "#107C41", bg: "#E8F5EE", text: "#107C41", border: "rgba(16,124,65,0.2)" },
    gold:   { bar: "#B58800", bg: "#FDF5DC", text: "#B58800", border: "rgba(181,136,0,0.2)" },
    danger: { bar: "#D13438", bg: "#FDE7E9", text: "#D13438", border: "rgba(209,52,56,0.2)" },
  };
  const c = colors[accent];
  return (
    <div className="fl-stat-card">
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: c.bar }} />
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 8,
          background: c.bg, color: c.text, border: `1px solid ${c.border}`,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <Icon size={16} color={c.text} />
        </div>
      </div>
      <p style={{
        fontSize: 26, fontWeight: 700, color: "#0F0F12",
        margin: 0, fontFamily: "'JetBrains Mono',monospace",
        letterSpacing: "-0.5px",
      }}>
        {loading ? "—" : (value ?? 0).toLocaleString("de-DE")}
      </p>
      <p style={{ fontSize: 12, color: "#50505C", margin: "2px 0 0" }}>{label}</p>
      {sub && <p style={{ fontSize: 10.5, color: "#9898A6", margin: "4px 0 0", fontFamily: "'JetBrains Mono',monospace" }}>{sub}</p>}
    </div>
  );
}

function OverviewTab() {
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_get_stats");
      if (error) throw error;
      return data?.[0] ?? null;
    },
  });

  const { data: recent } = useQuery({
    queryKey: ["admin-recent-agencies"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("agencies")
        .select("id,name,created_at")
        .order("created_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return data;
    },
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span className="fl-label-mono">Plattform-Übersicht</span>
        <button className="fl-btn fl-btn-ghost" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCcw size={12} className={isFetching ? "animate-spin" : ""} /> Aktualisieren
        </button>
      </div>

      <div style={{ display: "grid", gap: 14, gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
        <StatCard label="Agenturen"   value={data?.agencies_count}     accent="purple" icon={Building2} loading={isLoading} sub="aktive Tenants" />
        <StatCard label="Nutzer"       value={data?.users_count}        accent="blue"   icon={Users}     loading={isLoading} sub="registriert" />
        <StatCard label="Leads"        value={data?.leads_count}        accent="gold"   icon={UserPlus}  loading={isLoading} sub="im Funnel" />
        <StatCard label="Kunden"       value={data?.clients_count}      accent="green"  icon={Users}     loading={isLoading} sub="qualifiziert" />
        <StatCard label="Immobilien"   value={data?.properties_count}   accent="blue"   icon={Home}      loading={isLoading} sub="im Bestand" />
        <StatCard label="Termine"      value={data?.appointments_count} accent="danger" icon={Calendar}  loading={isLoading} sub="geplant" />
      </div>

      {/* Recent agencies panel */}
      <div className="fluent-card">
        <div className="fl-panel-head">
          <div>
            <div className="fl-panel-title">Neueste Agenturen</div>
            <div className="fl-panel-sub">Letzte 5 Registrierungen</div>
          </div>
          <span className="fl-badge fl-badge-blue">
            <span className="fl-live-dot" style={{ marginRight: 6 }} /> LIVE
          </span>
        </div>
        <div>
          <table className="fl-table">
            <thead>
              <tr>
                <th>Agentur</th>
                <th>ID</th>
                <th style={{ textAlign: "right" }}>Erstellt</th>
              </tr>
            </thead>
            <tbody>
              {(recent ?? []).map((a) => (
                <tr key={a.id}>
                  <td style={{ fontWeight: 600 }}>{a.name}</td>
                  <td style={{ fontFamily: "'JetBrains Mono',monospace", color: "#9898A6", fontSize: 11 }}>
                    {a.id.slice(0, 8)}…
                  </td>
                  <td style={{ textAlign: "right", color: "#50505C" }}>{formatDate(a.created_at)}</td>
                </tr>
              ))}
              {(!recent || recent.length === 0) && (
                <tr><td colSpan={3} style={{ textAlign: "center", color: "#9898A6", padding: 24 }}>Noch keine Agenturen</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Agencies ───────────────────────────────────
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
    <div className="fluent-card">
      <div className="fl-panel-head">
        <div>
          <div className="fl-panel-title">Alle Agenturen</div>
          <div className="fl-panel-sub">{filtered.length} Einträge</div>
        </div>
        <div style={{ position: "relative", width: 240 }}>
          <Search size={13} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#9898A6" }} />
          <input
            className="fl-input"
            style={{ paddingLeft: 30, height: 32 }}
            placeholder="Suchen…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>
      <div style={{ overflowX: "auto" }}>
        <table className="fl-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Nutzer</th>
              <th>Immobilien</th>
              <th>Leads</th>
              <th>Erstellt</th>
              <th style={{ width: 60 }} />
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={6} style={{ textAlign: "center", color: "#9898A6", padding: 24 }}>Lädt…</td></tr>}
            {!isLoading && filtered.length === 0 && <tr><td colSpan={6} style={{ textAlign: "center", color: "#9898A6", padding: 24 }}>Keine Agenturen gefunden</td></tr>}
            {filtered.map((a) => (
              <tr key={a.id}>
                <td style={{ fontWeight: 600 }}>{a.name}</td>
                <td className="fl-tabular">{counts?.users[a.id] ?? 0}</td>
                <td className="fl-tabular">{counts?.properties[a.id] ?? 0}</td>
                <td className="fl-tabular">{counts?.leads[a.id] ?? 0}</td>
                <td style={{ color: "#50505C" }}>{formatDate(a.created_at)}</td>
                <td>
                  <button
                    className="fl-btn fl-btn-ghost"
                    style={{ padding: "5px 8px", color: "#D13438", borderColor: "rgba(209,52,56,0.25)" }}
                    onClick={() => {
                      if (confirm(`Agentur „${a.name}" wirklich löschen?`)) del.mutate(a.id);
                    }}
                  >
                    <Trash2 size={13} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Users ──────────────────────────────────────
function UsersTab() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ email: "", password: "", full_name: "", agency_name: "" });

  const { data: profiles, isLoading } = useQuery({
    queryKey: ["admin-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data as Profile[];
    },
  });

  const submitCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.email || form.password.length < 6) {
      toast.error("E-Mail und Passwort (min. 6 Zeichen) erforderlich");
      return;
    }
    setCreating(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-create-user", { body: form });
      if (error) throw error;
      if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
      toast.success("Nutzer angelegt");
      setCreateOpen(false);
      setForm({ email: "", password: "", full_name: "", agency_name: "" });
      qc.invalidateQueries({ queryKey: ["admin-profiles"] });
      qc.invalidateQueries({ queryKey: ["admin-stats"] });
      qc.invalidateQueries({ queryKey: ["admin-agencies"] });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setCreating(false);
    }
  };
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
    <div className="fluent-card">
      <div className="fl-panel-head">
        <div>
          <div className="fl-panel-title">Alle Nutzer</div>
          <div className="fl-panel-sub">{filtered.length} registriert</div>
        </div>
        <div style={{ position: "relative", width: 260 }}>
          <Search size={13} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#9898A6" }} />
          <input
            className="fl-input"
            style={{ paddingLeft: 30, height: 32 }}
            placeholder="Name oder E-Mail…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>
      <div style={{ overflowX: "auto" }}>
        <table className="fl-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>E-Mail</th>
              <th>Agentur</th>
              <th>Rollen</th>
              <th>Erstellt</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={5} style={{ textAlign: "center", color: "#9898A6", padding: 24 }}>Lädt…</td></tr>}
            {!isLoading && filtered.length === 0 && <tr><td colSpan={5} style={{ textAlign: "center", color: "#9898A6", padding: 24 }}>Keine Nutzer gefunden</td></tr>}
            {filtered.map((p) => (
              <tr key={p.id}>
                <td style={{ fontWeight: 600 }}>{p.full_name ?? "—"}</td>
                <td style={{ color: "#50505C" }}>{p.email ?? "—"}</td>
                <td>{agencyMap[p.agency_id] ?? "—"}</td>
                <td>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                    <span className="fl-badge fl-badge-inactive">{p.role}</span>
                    {(rolesByUser[p.id] ?? []).map((r) => (
                      <span key={r} className={`fl-badge ${r === "superadmin" ? "fl-badge-purple" : "fl-badge-blue"}`}>
                        {r}
                      </span>
                    ))}
                  </div>
                </td>
                <td style={{ color: "#50505C" }}>{formatDate(p.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Roles ──────────────────────────────────────
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
    <div className="fluent-card">
      <div className="fl-panel-head">
        <div>
          <div className="fl-panel-title">Rollen verwalten</div>
          <div className="fl-panel-sub">Superadmin-Rechte zuweisen oder entziehen</div>
        </div>
      </div>
      <div style={{ overflowX: "auto" }}>
        <table className="fl-table">
          <thead>
            <tr>
              <th>Nutzer</th>
              <th>E-Mail</th>
              <th style={{ textAlign: "center" }}>Superadmin</th>
            </tr>
          </thead>
          <tbody>
            {(profiles ?? []).map((p) => {
              const isSuper = has(p.id, "superadmin");
              return (
                <tr key={p.id}>
                  <td style={{ fontWeight: 600 }}>{p.full_name ?? "—"}</td>
                  <td style={{ color: "#50505C" }}>{p.email ?? "—"}</td>
                  <td style={{ textAlign: "center" }}>
                    <button
                      className={`fl-btn ${isSuper ? "fl-btn-danger" : "fl-btn-primary"}`}
                      style={{ padding: "5px 11px", fontSize: 11.5 }}
                      disabled={setRole.isPending}
                      onClick={() => setRole.mutate({ userId: p.id, role: "superadmin", grant: !isSuper })}
                    >
                      {isSuper ? <><ShieldOff size={12} /> Entziehen</> : <><ShieldCheck size={12} /> Vergeben</>}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
