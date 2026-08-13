import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Inbox, Send, Search, ArrowLeft, Maximize2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Member = { id: string; full_name: string | null; email: string | null; avatar_url: string | null };
type Message = {
  id: string;
  sender_id: string;
  recipient_id: string;
  body: string;
  read_at: string | null;
  created_at: string;
};

function initialsOf(m?: Member | null) {
  const src = m?.full_name || m?.email || "?";
  return src.split(" ").map((s) => s[0]).slice(0, 2).join("").toUpperCase();
}

function timeLabel(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  return sameDay
    ? d.toLocaleTimeString("de-CH", { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString("de-CH", { day: "2-digit", month: "2-digit" }) +
        " " +
        d.toLocaleTimeString("de-CH", { hour: "2-digit", minute: "2-digit" });
}

export function TeamInbox() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data: members = [] } = useQuery({
    queryKey: ["inbox-members"],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email, avatar_url")
        .eq("is_active", true)
        .order("full_name");
      if (error) throw error;
      return (data ?? []).filter((m) => m.id !== user!.id) as Member[];
    },
  });

  const { data: messages = [] } = useQuery({
    queryKey: ["direct-messages", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("direct_messages")
        .select("*")
        .or(`sender_id.eq.${user!.id},recipient_id.eq.${user!.id}`)
        .order("created_at", { ascending: true })
        .limit(1000);
      if (error) throw error;
      return (data ?? []) as Message[];
    },
  });

  // Realtime
  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel("direct-messages-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "direct_messages" },
        (payload) => {
          const row = payload.new as Message | undefined;
          qc.invalidateQueries({ queryKey: ["direct-messages", user.id] });
          if (
            payload.eventType === "INSERT" &&
            row?.recipient_id === user.id &&
            row.sender_id !== activeId
          ) {
            const from = members.find((m) => m.id === row.sender_id);
            toast.message(`Neue Nachricht von ${from?.full_name ?? "Kollege"}`, {
              description: row.body.slice(0, 80),
            });
          }
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, activeId, members, qc]);

  const unreadTotal = useMemo(
    () => messages.filter((m) => m.recipient_id === user?.id && !m.read_at).length,
    [messages, user?.id],
  );

  const threads = useMemo(() => {
    const map = new Map<string, { last: Message; unread: number }>();
    for (const m of messages) {
      const other = m.sender_id === user?.id ? m.recipient_id : m.sender_id;
      const entry = map.get(other) ?? { last: m, unread: 0 };
      entry.last = m;
      if (m.recipient_id === user?.id && !m.read_at) entry.unread += 1;
      map.set(other, entry);
    }
    return Array.from(map.entries())
      .map(([id, v]) => ({ member: members.find((m) => m.id === id), ...v, id }))
      .sort((a, b) => (a.last.created_at < b.last.created_at ? 1 : -1));
  }, [messages, members, user?.id]);

  const activeMember = members.find((m) => m.id === activeId) ?? null;
  const thread = useMemo(
    () =>
      messages.filter(
        (m) =>
          (m.sender_id === activeId && m.recipient_id === user?.id) ||
          (m.recipient_id === activeId && m.sender_id === user?.id),
      ),
    [messages, activeId, user?.id],
  );

  const markRead = useMutation({
    mutationFn: async (otherId: string) => {
      const ids = messages
        .filter((m) => m.sender_id === otherId && m.recipient_id === user?.id && !m.read_at)
        .map((m) => m.id);
      if (!ids.length) return;
      const { error } = await supabase
        .from("direct_messages")
        .update({ read_at: new Date().toISOString() })
        .in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["direct-messages", user?.id] }),
  });

  useEffect(() => {
    if (open && activeId) markRead.mutate(activeId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, activeId, messages.length]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [thread.length, activeId]);

  const send = useMutation({
    mutationFn: async () => {
      const body = draft.trim();
      if (!body || !activeId) return;
      const { error } = await supabase
        .from("direct_messages")
        .insert({ sender_id: user!.id, recipient_id: activeId, body });
      if (error) throw error;
    },
    onSuccess: () => {
      setDraft("");
      qc.invalidateQueries({ queryKey: ["direct-messages", user?.id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filteredMembers = members.filter((m) =>
    (m.full_name || m.email || "").toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" title="Postfach">
          <Inbox className="h-5 w-5" />
          {unreadTotal > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
              {unreadTotal > 9 ? "9+" : unreadTotal}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[380px] p-0">
        {!activeId ? (
          <div className="flex h-[460px] flex-col">
            <div className="border-b p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-semibold">Postfach</span>
                {unreadTotal > 0 && <Badge variant="secondary">{unreadTotal} neu</Badge>}
              </div>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Mitarbeitende suchen…"
                  className="pl-8"
                />
              </div>
            </div>
            <ScrollArea className="flex-1">
              <div className="p-2">
                {!search && threads.length > 0 && (
                  <div className="mb-2">
                    <p className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Unterhaltungen
                    </p>
                    {threads.map((t) => (
                      <button
                        key={t.id}
                        onClick={() => setActiveId(t.id)}
                        className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-left transition hover:bg-muted"
                      >
                        <Avatar className="h-9 w-9">
                          <AvatarImage src={t.member?.avatar_url ?? undefined} />
                          <AvatarFallback className="text-xs">{initialsOf(t.member)}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <span className="truncate text-sm font-medium">
                              {t.member?.full_name ?? t.member?.email ?? "Unbekannt"}
                            </span>
                            <span className="shrink-0 text-[10px] text-muted-foreground">
                              {timeLabel(t.last.created_at)}
                            </span>
                          </div>
                          <p className={cn("truncate text-xs", t.unread ? "font-semibold text-foreground" : "text-muted-foreground")}>
                            {t.last.sender_id === user?.id ? "Du: " : ""}
                            {t.last.body}
                          </p>
                        </div>
                        {t.unread > 0 && (
                          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                            {t.unread}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
                <p className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Mitarbeitende
                </p>
                {filteredMembers.length === 0 && (
                  <p className="px-2 py-4 text-center text-sm text-muted-foreground">
                    Keine Mitarbeitenden gefunden
                  </p>
                )}
                {filteredMembers.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setActiveId(m.id)}
                    className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-left transition hover:bg-muted"
                  >
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={m.avatar_url ?? undefined} />
                      <AvatarFallback className="text-xs">{initialsOf(m)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="truncate text-sm">{m.full_name ?? m.email}</p>
                      {m.full_name && m.email && (
                        <p className="truncate text-[11px] text-muted-foreground">{m.email}</p>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </ScrollArea>
          </div>
        ) : (
          <div className="flex h-[460px] flex-col">
            <div className="flex items-center gap-2 border-b p-3">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setActiveId(null)}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <Avatar className="h-8 w-8">
                <AvatarImage src={activeMember?.avatar_url ?? undefined} />
                <AvatarFallback className="text-xs">{initialsOf(activeMember)}</AvatarFallback>
              </Avatar>
              <span className="truncate text-sm font-semibold">
                {activeMember?.full_name ?? activeMember?.email ?? "Unterhaltung"}
              </span>
            </div>
            <ScrollArea className="flex-1">
              <div className="space-y-2 p-3">
                {thread.length === 0 && (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    Noch keine Nachrichten — schreib die erste!
                  </p>
                )}
                {thread.map((m) => {
                  const mine = m.sender_id === user?.id;
                  return (
                    <div key={m.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
                      <div
                        className={cn(
                          "max-w-[80%] rounded-lg px-3 py-2 text-sm",
                          mine ? "bg-primary text-primary-foreground" : "bg-muted text-foreground",
                        )}
                      >
                        <p className="whitespace-pre-wrap break-words">{m.body}</p>
                        <p className={cn("mt-1 text-[10px]", mine ? "text-primary-foreground/70" : "text-muted-foreground")}>
                          {timeLabel(m.created_at)}
                        </p>
                      </div>
                    </div>
                  );
                })}
                <div ref={bottomRef} />
              </div>
            </ScrollArea>
            <div className="flex items-end gap-2 border-t p-2">
              <Textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send.mutate();
                  }
                }}
                placeholder="Nachricht schreiben…"
                className="min-h-[40px] max-h-28 resize-none"
              />
              <Button
                size="icon"
                onClick={() => send.mutate()}
                disabled={!draft.trim() || send.isPending}
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
