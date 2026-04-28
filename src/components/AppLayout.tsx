import { Link, useLocation, useNavigate, Outlet } from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import {
  LayoutDashboard, Users, UserPlus, Building2, Calendar, Target, Settings, LogOut, Menu, Search, Shield,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import logoAsimo from "@/assets/logo-asimo-real-estate.png";

const baseNav = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/leads", label: "Leads", icon: UserPlus },
  { to: "/clients", label: "Kunden", icon: Users },
  { to: "/properties", label: "Immobilien", icon: Building2 },
  { to: "/matching", label: "Matching", icon: Target },
  { to: "/appointments", label: "Termine", icon: Calendar },
] as const;

function NavList({ onClick }: { onClick?: () => void }) {
  const { pathname } = useLocation();
  const { isSuperadmin } = useAuth();
  const items = isSuperadmin
    ? [...baseNav, { to: "/oaax", label: "OAAX Admin", icon: Shield } as const]
    : baseNav;
  return (
    <nav className="flex flex-col gap-1 p-3">
      {items.map((n) => {
        const active = pathname.startsWith(n.to);
        return (
          <Link
            key={n.to}
            to={n.to}
            onClick={onClick}
            className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
              active
                ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-soft"
                : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
            }`}
          >
            <n.icon className="h-4 w-4" />
            {n.label}
          </Link>
        );
      })}
    </nav>
  );
}

function SidebarBrand() {
  return (
    <Link to="/dashboard" className="flex items-center justify-center px-5 py-6">
      <img src={logoAsimo} alt="ASIMO Real Estate" className="h-10 w-auto" />
    </Link>
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
    <div className="flex min-h-screen bg-background">
      {/* Desktop sidebar */}
      <aside className="hidden w-64 shrink-0 border-r bg-sidebar lg:block">
        <SidebarBrand />
        <NavList />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Topbar */}
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b bg-background/80 px-4 backdrop-blur lg:px-6">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden"><Menu className="h-5 w-5" /></Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 bg-sidebar p-0">
              <SidebarBrand />
              <NavList />
            </SheetContent>
          </Sheet>

          <div className="relative hidden max-w-md flex-1 md:block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input className="pl-9" placeholder="Suchen…" />
          </div>

          <div className="ml-auto flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="gap-2 px-2">
                  <Avatar className="h-8 w-8"><AvatarFallback className="bg-primary text-primary-foreground text-xs">{initials}</AvatarFallback></Avatar>
                  <span className="hidden text-sm font-medium md:block">{user.user_metadata?.full_name || user.email}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Mein Konto</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {user.email && <div className="px-2 pb-1 text-xs text-muted-foreground truncate">{user.email}</div>}
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
                <DropdownMenuItem onClick={() => navigate({ to: "/settings" })}><Settings className="mr-2 h-4 w-4" />Einstellungen</DropdownMenuItem>
                <DropdownMenuItem onClick={async () => { await signOut(); navigate({ to: "/" }); }}>
                  <LogOut className="mr-2 h-4 w-4" />Abmelden
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main className="flex-1 p-4 lg:p-8">{children ?? <Outlet />}</main>
      </div>
    </div>
  );
}
