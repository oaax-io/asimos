import { Link, useLocation, useNavigate, Outlet } from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import {
  LayoutDashboard, Users, UserPlus, Building2, Calendar, Target,
  Settings, LogOut, Search, Shield, Users2, CheckSquare, FileText,
  Image as ImageIcon, ListChecks, FileSignature, FileCheck2, FileBadge, FileCode2, FileLock2,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarHeader, SidebarFooter,
  SidebarProvider, SidebarTrigger, SidebarInset, useSidebar,
} from "@/components/ui/sidebar";
import logoAsimo from "@/assets/logo-asimo-real-estate.png";

const NAV_GROUPS = [
  {
    label: "Hauptbereich",
    items: [
      { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { to: "/leads", label: "Leads", icon: UserPlus },
      { to: "/clients", label: "Kunden", icon: Users },
      { to: "/properties", label: "Immobilien", icon: Building2 },
      { to: "/matching", label: "Matching", icon: Target },
      { to: "/appointments", label: "Termine", icon: Calendar },
      { to: "/tasks", label: "Aufgaben", icon: CheckSquare },
    ],
  },
  {
    label: "Verwaltung",
    items: [
      { to: "/documents", label: "Dokumente", icon: FileText },
      { to: "/media", label: "Mediathek", icon: ImageIcon },
      { to: "/checklists", label: "Checklisten", icon: ListChecks },
      { to: "/mandates", label: "Mandate", icon: FileSignature },
      { to: "/reservations", label: "Reservationen", icon: FileCheck2 },
      { to: "/ndas", label: "NDAs", icon: FileLock2 },
      { to: "/exposes", label: "Exposés", icon: FileBadge },
      { to: "/templates", label: "Vorlagen", icon: FileCode2 },
    ],
  },
  {
    label: "Administration",
    items: [
      { to: "/team", label: "Mitarbeiter", icon: Users2 },
      { to: "/settings", label: "Einstellungen", icon: Settings },
    ],
  },
] as const;

function AppSidebar() {
  const { pathname } = useLocation();
  const { state } = useSidebar();
  const collapsed = state === "collapsed";

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader className="border-b border-sidebar-border">
        <Link to="/dashboard" className="flex items-center justify-center px-2 py-3">
          <img
            src={logoAsimo}
            alt="ASIMO"
            className={collapsed ? "h-7 w-auto" : "h-9 w-auto"}
          />
        </Link>
      </SidebarHeader>

      <SidebarContent className="gap-0">
        {NAV_GROUPS.map((group) => (
          <SidebarGroup key={group.label}>
            {!collapsed && (
              <SidebarGroupLabel className="text-[10px] font-semibold uppercase tracking-wider text-sidebar-foreground/50">
                {group.label}
              </SidebarGroupLabel>
            )}
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => {
                  const active =
                    item.to === "/dashboard"
                      ? pathname === "/dashboard"
                      : pathname.startsWith(item.to);
                  return (
                    <SidebarMenuItem key={item.to}>
                      <SidebarMenuButton
                        asChild
                        isActive={active}
                        tooltip={item.label}
                        className="data-[active=true]:bg-sidebar-primary/15 data-[active=true]:text-sidebar-primary"
                      >
                        <Link to={item.to}>
                          <item.icon className="h-4 w-4" />
                          <span>{item.label}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-2">
        {!collapsed && (
          <p className="px-2 py-1 text-[10px] uppercase tracking-wider text-sidebar-foreground/40">
            ASIMO CRM
          </p>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}

export default function AppLayout({ children }: { children?: ReactNode }) {
  const { user, loading, signOut, isSuperadmin } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth", search: { mode: "signin" } });
  }, [user, loading, navigate]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-soft">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  const initials = (user.user_metadata?.full_name || user.email || "U")
    .split(" ").map((s: string) => s[0]).slice(0, 2).join("").toUpperCase();

  return (
    <SidebarProvider defaultOpen>
      <div className="flex min-h-screen w-full bg-background">
        <AppSidebar />
        <SidebarInset className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b bg-background/80 px-4 backdrop-blur lg:px-6">
            <SidebarTrigger />

            <div className="relative hidden max-w-md flex-1 md:block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-9" placeholder="Suchen…" />
            </div>

            <div className="ml-auto flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="gap-2 px-2">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    <span className="hidden text-sm font-medium md:block">
                      {user.user_metadata?.full_name || user.email}
                    </span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>Mein Konto</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {user.email && (
                    <div className="px-2 pb-1 text-xs text-muted-foreground truncate">
                      {user.email}
                    </div>
                  )}
                  {isSuperadmin && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuLabel className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                        Wechseln zu
                      </DropdownMenuLabel>
                      <DropdownMenuItem onClick={() => navigate({ to: "/oaax" })}>
                        <Shield className="mr-2 h-4 w-4 text-primary" />
                        <span className="flex-1">OAAX Admin Center</span>
                        <span className="ml-2 rounded bg-primary/10 px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-wider text-primary">
                          Admin
                        </span>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                    </>
                  )}
                  <DropdownMenuItem onClick={() => navigate({ to: "/settings" })}>
                    <Settings className="mr-2 h-4 w-4" />Einstellungen
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={async () => { await signOut(); navigate({ to: "/" }); }}>
                    <LogOut className="mr-2 h-4 w-4" />Abmelden
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </header>

          <main className="flex-1 p-4 lg:p-8">{children ?? <Outlet />}</main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
