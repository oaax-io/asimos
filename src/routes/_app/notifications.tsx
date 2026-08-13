import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Bell,
  Check,
  CheckCheck,
  Calendar,
  CheckSquare,
  UserPlus,
  Info,
  Target,
  ArrowLeft,
  Filter,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { format, formatDistanceToNow } from "date-fns";
import { de } from "date-fns/locale";

type Notification = {
  id: string;
  type: string;
  title: string;
  message: string | null;
  link: string | null;
  is_read: boolean;
  created_at: string;
};

const TYPE_ICONS: Record<string, typeof Bell> = {
  appointment: Calendar,
  task: CheckSquare,
  lead: UserPlus,
  match: Target,
};

const TYPE_STYLES: Record<
  string,
  { icon: string; iconUnread: string; accent: string; unreadBg: string; label: string }
> = {
  appointment: {
    icon: "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300",
    iconUnread: "bg-sky-500 text-white",
    accent: "border-l-sky-500",
    unreadBg: "bg-sky-50/70 dark:bg-sky-950/20",
    label: "Termine",
  },
  task: {
    icon: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
    iconUnread: "bg-amber-500 text-white",
    accent: "border-l-amber-500",
    unreadBg: "bg-amber-50/70 dark:bg-amber-950/20",
    label: "Aufgaben",
  },
  match: {
    icon: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300",
    iconUnread: "bg-violet-500 text-white",
    accent: "border-l-violet-500",
    unreadBg: "bg-violet-50/70 dark:bg-violet-950/20",
    label: "Matches",
  },
  lead: {
    icon: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
    iconUnread: "bg-emerald-500 text-white",
    accent: "border-l-emerald-500",
    unreadBg: "bg-emerald-50/70 dark:bg-emerald-950/20",
    label: "Leads",
  },
};
const DEFAULT_TYPE_STYLE = {
  icon: "bg-muted text-muted-foreground",
  iconUnread: "bg-primary text-primary-foreground",
  accent: "border-l-primary",
  unreadBg: "bg-primary/5",
  label: "Allgemein",
};

const FILTERS = [
  { key: "all", label: "Alle" },
  { key: "unread", label: "Ungelesen" },
  { key: "appointment", label: "Termine" },
  { key: "task", label: "Aufgaben" },
  { key: "match", label: "Matches" },
  { key: "lead", label: "Leads" },
] as const;

export const Route = createFileRoute("/_app/notifications")({
  head: () => ({
    titles: ["Benachrichtigungen", "ASIMO CRM"],
    meta: [
      { name: "description", content: "Alle Benachrichtigungen im Überblick – ASIMO CRM." },
    ],
  }),
  component: NotificationsPage,
});

function NotificationsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["key"]>("all");

  const { data: notifications = [] } = useQuery({
    queryKey: ["notifications", "all"],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as Notification[];
    },
  });

  const markRead = useMutation({
    mutationFn: async (id: string) => {
      await supabase
        .from("notifications")
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq("id", id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const markAllRead = useMutation({
    mutationFn: async () => {
      if (!user) return;
      await supabase
        .from("notifications")
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq("user_id", user.id)
        .eq("is_read", false);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const filtered =
    filter === "all"
      ? notifications
      : filter === "unread"
        ? notifications.filter((n) => !n.is_read)
        : notifications.filter((n) => n.type === filter);

  // group by day
  const groups: Record<string, Notification[]> = {};
  for (const n of filtered) {
    const day = format(new Date(n.created_at), "EEEE, d. MMMM yyyy", { locale: de });
    (groups[day] ??= []).push(n);
  }
  const dayKeys = Object.keys(groups);

  const handleClick = (n: Notification) => {
    if (!n.is_read) markRead.mutate(n.id);
    if (n.link) {
      // navigate via location href since link may be an internal path
      window.location.assign(n.link);
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild className="h-9 w-9">
            <Link to="/dashboard">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Benachrichtigungen</h1>
            <p className="text-sm text-muted-foreground">
              {unreadCount > 0 ? `${unreadCount} ungelesene` : "Alle gelesen"}
            </p>
          </div>
        </div>
        {unreadCount > 0 && (
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => markAllRead.mutate()}>
            <CheckCheck className="h-4 w-4" /> Alle als gelesen markieren
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <Filter className="h-4 w-4 text-muted-foreground" />
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-medium transition",
              filter === f.key
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/70",
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed py-16 text-center text-sm text-muted-foreground">
          <Bell className="h-8 w-8 opacity-30" />
          <p>Keine Benachrichtigungen</p>
        </div>
      ) : (
        <ScrollArea className="h-[calc(100vh-280px)] min-h-[300px]">
          <div className="space-y-6">
            {dayKeys.map((day) => (
              <div key={day} className="space-y-1.5">
                <p className="px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {day}
                </p>
                <ul className="overflow-hidden rounded-xl border">
                  {groups[day].map((n) => {
                    const Icon = TYPE_ICONS[n.type] ?? Info;
                    const style = TYPE_STYLES[n.type] ?? DEFAULT_TYPE_STYLE;
                    return (
                      <li
                        key={n.id}
                        onClick={() => handleClick(n)}
                        className={cn(
                          "flex cursor-pointer gap-3 border-l-4 px-4 py-3 transition hover:bg-muted/50",
                          !n.is_read ? `${style.accent} ${style.unreadBg}` : "border-l-transparent",
                        )}
                      >
                        <div
                          className={cn(
                            "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md",
                            !n.is_read ? style.iconUnread : style.icon,
                          )}
                        >
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <p className={cn("text-sm", !n.is_read ? "font-semibold" : "font-medium")}>
                              {n.title}
                            </p>
                            <div className="flex items-center gap-1">
                              {!n.is_read && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    markRead.mutate(n.id);
                                  }}
                                  className="shrink-0 rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                                  title="Als gelesen markieren"
                                >
                                  <Check className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </div>
                          </div>
                          {n.message && <p className="mt-0.5 text-sm text-muted-foreground">{n.message}</p>}
                          <div className="mt-1 flex items-center gap-2">
                            <Badge variant="outline" className="h-5 text-[10px] font-normal">
                              {style.label}
                            </Badge>
                            <p className="text-[10px] text-muted-foreground">
                              {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: de })}
                            </p>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
