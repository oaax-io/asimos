import "@/styles/fluent.css";
import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import {
  LayoutDashboard, Building2, Users, ShieldCheck, Settings,
  ChevronLeft, ChevronRight, Search, Bell, ChevronDown, LogOut,
  ExternalLink, Menu as MenuIcon, ArrowLeft,
} from "lucide-react";
import { useAuth } from "@/lib/auth";

interface OaaxLayoutProps {
  children: ReactNode;
  breadcrumb?: { label: string; href?: string }[];
}

type NavItem = { label: string; icon: typeof LayoutDashboard; to: "/superadmin" | "/settings"; hash?: string };
const NAV: { section: string; items: NavItem[] }[] = [
  {
    section: "Übersicht",
    items: [
      { label: "Dashboard", icon: LayoutDashboard, to: "/superadmin", hash: "overview" },
      { label: "Agenturen", icon: Building2,        to: "/superadmin", hash: "agencies" },
      { label: "Nutzer",    icon: Users,            to: "/superadmin", hash: "users" },
      { label: "Rollen",    icon: ShieldCheck,      to: "/superadmin", hash: "roles" },
    ],
  },
  {
    section: "System",
    items: [
      { label: "Einstellungen", icon: Settings, to: "/settings" },
    ],
  },
];

function EstatlyMark({ size = 18, white }: { size?: number; white?: boolean }) {
  return (
    <div
      style={{
        width: size, height: size, borderRadius: 5,
        background: white ? "#fff" : "linear-gradient(135deg,#1E9BCF,#3B387D)",
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        color: white ? "#3B387D" : "#fff", fontWeight: 800,
        fontSize: size * 0.55, fontFamily: "'Sora',sans-serif",
      }}
    >
      E
    </div>
  );
}

function OaaxSidebar({ collapsed, setCollapsed, activeTab, activeHash }: { collapsed: boolean; setCollapsed: (v: boolean) => void; activeTab: string; activeHash: string }) {
  const width = collapsed ? 56 : 228;
  return (
    <aside
      style={{
        width, minWidth: width, background: "#3B387D",
        display: "flex", flexDirection: "column", height: "100%",
        transition: "width 0.2s cubic-bezier(0.4,0,0.2,1), min-width 0.2s cubic-bezier(0.4,0,0.2,1)",
        overflow: "hidden", fontFamily: "'Sora',sans-serif",
      }}
    >
      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center",
        gap: collapsed ? 0 : 10,
        padding: collapsed ? "0 10px" : "0 16px",
        height: 52, minHeight: 52,
        borderBottom: "1px solid rgba(255,255,255,0.1)",
        justifyContent: collapsed ? "center" : "flex-start",
      }}>
        {!collapsed && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1, minWidth: 0 }}>
            <EstatlyMark size={20} white />
            <span style={{ fontSize: 14.5, fontWeight: 700, color: "#fff", letterSpacing: -0.3 }}>
              ESTATLY
            </span>
            <span style={{
              fontSize: 9.5, fontFamily: "'JetBrains Mono',monospace",
              color: "rgba(255,255,255,0.5)", background: "rgba(255,255,255,0.08)",
              padding: "1px 6px", borderRadius: 3, fontWeight: 600,
              textTransform: "uppercase", letterSpacing: "0.06em",
            }}>
              ADMIN
            </span>
          </div>
        )}
        {collapsed && <EstatlyMark size={20} white />}
        {!collapsed && (
          <button
            onClick={() => setCollapsed(true)}
            title="Sidebar schließen"
            style={{
              width: 24, height: 24, borderRadius: 4,
              background: "rgba(255,255,255,0.08)",
              border: "1px solid rgba(255,255,255,0.12)",
              color: "rgba(255,255,255,0.5)",
              display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer",
            }}
          >
            <ChevronLeft size={13} />
          </button>
        )}
      </div>

      {collapsed && (
        <button
          onClick={() => setCollapsed(false)}
          style={{
            margin: "8px auto", width: 32, height: 24, borderRadius: 4,
            background: "rgba(255,255,255,0.08)",
            border: "1px solid rgba(255,255,255,0.12)",
            color: "rgba(255,255,255,0.6)", cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          <ChevronRight size={13} />
        </button>
      )}

      {/* Nav */}
      <nav style={{ flex: 1, overflowY: "auto", padding: collapsed ? "8px 6px" : "12px 10px" }}>
        {NAV.map((group, gi) => (
          <div key={gi} style={{ marginBottom: 18 }}>
            {!collapsed && (
              <div style={{
                fontSize: 9.5, fontWeight: 600,
                fontFamily: "'JetBrains Mono',monospace",
                color: "rgba(255,255,255,0.35)",
                letterSpacing: "0.12em", textTransform: "uppercase",
                padding: "0 10px 8px",
              }}>
                {group.section}
              </div>
            )}
            {group.items.map((item) => {
              const isActive = item.hash
                ? activeTab === item.to && activeHash === item.hash
                : activeTab === item.to;
              const Icon = item.icon;
              return (
                <Link
                  key={`${item.to}-${item.hash ?? ""}`}
                  to={item.to}
                  hash={item.hash}
                  title={collapsed ? item.label : undefined}
                  style={{
                    display: "flex", alignItems: "center",
                    gap: collapsed ? 0 : 10,
                    justifyContent: collapsed ? "center" : "flex-start",
                    padding: collapsed ? "8px 0" : "8px 10px",
                    borderRadius: 6, marginBottom: 2,
                    background: isActive ? "rgba(255,255,255,0.12)" : "transparent",
                    color: isActive ? "#fff" : "rgba(255,255,255,0.7)",
                    fontSize: 12.5, fontWeight: isActive ? 600 : 500,
                    textDecoration: "none", transition: "all 0.13s",
                    borderLeft: !collapsed && isActive ? "2px solid #1E9BCF" : "2px solid transparent",
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.background = "rgba(255,255,255,0.06)";
                      e.currentTarget.style.color = "#fff";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.background = "transparent";
                      e.currentTarget.style.color = "rgba(255,255,255,0.7)";
                    }
                  }}
                >
                  <Icon size={15} style={{ flexShrink: 0 }} />
                  {!collapsed && <span style={{ whiteSpace: "nowrap" }}>{item.label}</span>}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Footer */}
      {!collapsed && (
        <div style={{
          padding: "12px 14px", borderTop: "1px solid rgba(255,255,255,0.1)",
          fontSize: 10.5, color: "rgba(255,255,255,0.4)",
          fontFamily: "'JetBrains Mono',monospace",
        }}>
          <span style={{
            display: "inline-block", width: 6, height: 6, borderRadius: "50%",
            background: "#107C41", marginRight: 6, verticalAlign: "middle",
          }} />
          v1.0 · system aktiv
        </div>
      )}
    </aside>
  );
}

function OaaxTopbar({ breadcrumb }: { breadcrumb?: { label: string; href?: string }[] }) {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [userOpen, setUserOpen] = useState(false);

  useEffect(() => {
    const close = () => setUserOpen(false);
    if (userOpen) {
      document.addEventListener("mousedown", close);
      return () => document.removeEventListener("mousedown", close);
    }
  }, [userOpen]);

  const initials = (user?.user_metadata?.full_name || user?.email || "SA")
    .split(" ").map((s: string) => s[0]).slice(0, 2).join("").toUpperCase();
  const displayName = user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Super Admin";

  return (
    <header style={{
      height: 52, minHeight: 52,
      borderBottom: "1px solid rgba(0,0,0,0.08)",
      background: "#fff", display: "flex", alignItems: "center",
      padding: "0 16px", gap: 12, fontFamily: "'Sora',sans-serif",
    }}>
      {/* Back to app */}
      <button
        onClick={() => navigate({ to: "/dashboard" })}
        title="Zurück zur App"
        style={{
          width: 32, height: 32, borderRadius: 6,
          border: "1px solid rgba(0,0,0,0.10)", background: "#fff",
          display: "flex", alignItems: "center", justifyContent: "center",
          cursor: "pointer", boxShadow: "0 1px 2px rgba(0,0,0,0.06)",
        }}
      >
        <ArrowLeft size={14} color="#50505C" />
      </button>

      {/* Breadcrumb */}
      <nav style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
        <span style={{ color: "#9898A6" }}>Estatly</span>
        <span style={{ color: "#C2C2CC" }}>/</span>
        <span style={{ color: breadcrumb?.length ? "#9898A6" : "#0F0F12", fontWeight: breadcrumb?.length ? 400 : 600 }}>
          Admin
        </span>
        {breadcrumb?.map((c, i) => (
          <span key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ color: "#C2C2CC" }}>/</span>
            <span style={{
              color: i === (breadcrumb!.length - 1) ? "#0F0F12" : "#9898A6",
              fontWeight: i === (breadcrumb!.length - 1) ? 600 : 400,
            }}>
              {c.label}
            </span>
          </span>
        ))}
      </nav>

      {/* Right side */}
      <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ position: "relative", display: "none" }} className="md:!block">
          <Search size={13} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#9898A6" }} />
          <input
            placeholder="Suchen…"
            style={{
              width: 240, height: 32, paddingLeft: 30, paddingRight: 10,
              border: "1px solid rgba(0,0,0,0.10)", borderRadius: 6,
              background: "#F7F7F9", fontSize: 12, outline: "none",
              fontFamily: "'Sora',sans-serif",
            }}
          />
        </div>

        <button style={{
          width: 32, height: 32, borderRadius: 6,
          border: "1px solid rgba(0,0,0,0.10)", background: "#fff",
          display: "flex", alignItems: "center", justifyContent: "center",
          cursor: "pointer", boxShadow: "0 1px 2px rgba(0,0,0,0.06)",
        }}>
          <Bell size={14} color="#50505C" />
        </button>

        {/* User dropdown */}
        <div style={{ position: "relative" }} onMouseDown={(e) => e.stopPropagation()}>
          <button
            onClick={() => setUserOpen((o) => !o)}
            style={{
              display: "flex", alignItems: "center", gap: 7,
              padding: "4px 8px 4px 4px", borderRadius: 8,
              border: `1px solid ${userOpen ? "rgba(59,56,125,0.25)" : "rgba(0,0,0,0.10)"}`,
              background: userOpen ? "rgba(59,56,125,0.06)" : "#fff",
              cursor: "pointer", boxShadow: "0 1px 2px rgba(0,0,0,0.06)",
              fontFamily: "'Sora',sans-serif",
            }}
          >
            <div style={{
              width: 28, height: 28, borderRadius: 6,
              background: "#3B387D", color: "#fff",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 10.5, fontWeight: 700,
            }}>
              {initials}
            </div>
            <ChevronDown size={12} color="#9898A6" />
          </button>

          {userOpen && (
            <div style={{
              position: "absolute", top: "calc(100% + 8px)", right: 0, zIndex: 100,
              width: 260, background: "#fff",
              border: "1px solid rgba(0,0,0,0.1)", borderRadius: 12,
              boxShadow: "0 12px 40px rgba(0,0,0,0.14)", overflow: "hidden",
              fontFamily: "'Sora',sans-serif",
            }}>
              <div style={{ padding: "14px 14px 10px", borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: "#0F0F12", margin: 0 }}>{displayName}</p>
                <p style={{ fontSize: 11, color: "#9898A6", margin: "2px 0 0" }}>{user?.email}</p>
              </div>
              <div style={{ padding: "2px 6px 6px" }}>
                <div style={{ padding: "8px 10px 4px" }}>
                  <span style={{
                    fontSize: 9.5, fontWeight: 600, color: "#9898A6",
                    letterSpacing: "0.08em", textTransform: "uppercase",
                  }}>
                    Wechseln zu
                  </span>
                </div>
                {[
                  { label: "Admin Center", to: "/superadmin", color: "#3B387D" },
                  { label: "App",          to: "/dashboard",  color: "#1E9BCF" },
                  { label: "Einstellungen",to: "/settings",   color: "#107C41" },
                ].map((item) => (
                  <button
                    key={item.label}
                    onClick={() => { navigate({ to: item.to }); setUserOpen(false); }}
                    style={{
                      width: "100%", display: "flex", alignItems: "center", gap: 9,
                      padding: "8px 10px", borderRadius: 6,
                      border: "none", background: "transparent", cursor: "pointer",
                      textAlign: "left", fontSize: 12, color: "#0F0F12",
                      fontFamily: "'Sora',sans-serif",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "#F3F3F5")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: item.color, flexShrink: 0 }} />
                    {item.label}
                    <ExternalLink size={11} color="#C2C2CC" style={{ marginLeft: "auto" }} />
                  </button>
                ))}
              </div>
              <div style={{ padding: 6, borderTop: "1px solid rgba(0,0,0,0.06)" }}>
                <button
                  onClick={async () => { await signOut(); navigate({ to: "/" }); }}
                  style={{
                    width: "100%", display: "flex", alignItems: "center", gap: 9,
                    padding: "9px 10px", borderRadius: 6,
                    border: "none", background: "transparent", cursor: "pointer",
                    textAlign: "left", fontSize: 12, color: "#D13438",
                    fontFamily: "'Sora',sans-serif",
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "#FDE7E9"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                >
                  <LogOut size={14} />
                  Abmelden
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

export function OaaxLayout({ children, breadcrumb }: OaaxLayoutProps) {
  const { pathname, hash } = useLocation();
  const activeHash = (hash || "overview").replace(/^#/, "") || "overview";
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem("oaax_sidebar_collapsed") === "true"; } catch { return false; }
  });

  useEffect(() => {
    try { localStorage.setItem("oaax_sidebar_collapsed", String(collapsed)); } catch {}
  }, [collapsed]);

  return (
    <div className="fluent-scope flex h-screen overflow-hidden" style={{ background: "#F3F3F5" }}>
      {/* Desktop sidebar */}
      <div className="hidden lg:flex h-full shrink-0">
        <OaaxSidebar collapsed={collapsed} setCollapsed={setCollapsed} activeTab={pathname} activeHash={activeHash} />
      </div>

      {/* Mobile sidebar */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <div className="relative z-10 h-full w-[228px]">
            <OaaxSidebar collapsed={false} setCollapsed={() => setMobileOpen(false)} activeTab={pathname} activeHash={activeHash} />
          </div>
        </div>
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex items-center">
          <button
            className="lg:hidden flex items-center justify-center border-b"
            onClick={() => setMobileOpen(true)}
            style={{ width: 52, height: 52, borderColor: "rgba(0,0,0,0.08)" }}
            aria-label="Menü öffnen"
          >
            <MenuIcon size={20} color="#50505C" />
          </button>
          <div className="flex-1">
            <OaaxTopbar breadcrumb={breadcrumb} />
          </div>
        </div>

        <main className="flex-1 overflow-auto p-5 md:p-6 lg:p-8 fl-fade-up">
          {children}
        </main>
      </div>
    </div>
  );
}

export default OaaxLayout;
