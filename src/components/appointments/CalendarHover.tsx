import type { ReactNode } from "react";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { Badge } from "@/components/ui/badge";
import { Calendar as CalIcon, Clock, MapPin, Video, Link2, User, Building2, CheckSquare, Flag, FileText, AlertTriangle } from "lucide-react";
import { formatDateTime } from "@/lib/format";
import type { Holiday } from "@/lib/swiss-holidays";

const TYPE_LABEL: Record<string, string> = {
  viewing: "Besichtigung", meeting: "Meeting", call: "Telefon", other: "Sonstiges",
};
const STATUS_LABEL: Record<string, string> = {
  scheduled: "Geplant", completed: "Erledigt", cancelled: "Abgesagt",
};
const TASK_STATUS_LABEL: Record<string, string> = {
  open: "Offen", in_progress: "In Arbeit", waiting: "Pendent", done: "Erledigt", cancelled: "Abgebrochen",
};
const TASK_PRIO_LABEL: Record<string, string> = {
  low: "Tief", normal: "Normal", high: "Hoch", urgent: "Dringend",
};
const PRIO_CLASS: Record<string, string> = {
  low: "bg-slate-500/10 text-slate-600 dark:text-slate-300",
  normal: "bg-sky-500/10 text-sky-700 dark:text-sky-300",
  high: "bg-red-500/10 text-red-600 dark:text-red-400",
  urgent: "bg-red-600 text-white",
};

function Row({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
      <span className="mt-[1px] shrink-0 text-primary/70">{icon}</span>
      <span className="min-w-0 break-words">{children}</span>
    </p>
  );
}

function shellProps(className?: string) {
  return {
    className: `w-80 rounded-xl border-primary/15 p-4 shadow-lg ${className ?? ""}`,
    side: "top" as const,
    align: "start" as const,
  };
}

export function ApptHover({ appt: a, assignee, room, children }: { appt: any; assignee?: any; room?: string; children: ReactNode }) {
  return (
    <HoverCard openDelay={150} closeDelay={80}>
      <HoverCardTrigger asChild>{children}</HoverCardTrigger>
      <HoverCardContent {...shellProps()}>
        <div className="mb-2 flex flex-wrap items-center gap-1.5">
          <Badge variant="secondary">{TYPE_LABEL[a.appointment_type] ?? a.appointment_type}</Badge>
          {a.is_online && <Badge className="gap-1"><Video className="h-3 w-3" />Online</Badge>}
          <Badge variant="outline" className="ml-auto">{STATUS_LABEL[a.status] ?? a.status}</Badge>
        </div>
        <p className="mb-2 font-semibold leading-snug">{a.title}</p>
        <div className="space-y-1">
          <Row icon={<CalIcon className="h-3.5 w-3.5" />}>{formatDateTime(a.starts_at)}</Row>
          {a.ends_at && <Row icon={<Clock className="h-3.5 w-3.5" />}>bis {formatDateTime(a.ends_at)}</Row>}
          {a.location && !a.is_online && <Row icon={<MapPin className="h-3.5 w-3.5" />}>{a.location}</Row>}
          {a.is_online && <Row icon={<Link2 className="h-3.5 w-3.5" />}>Raum: {room ?? a.meeting_url}</Row>}
          {a.clients?.full_name && <Row icon={<User className="h-3.5 w-3.5" />}>Kunde: {a.clients.full_name}</Row>}
          {a.properties?.title && <Row icon={<Building2 className="h-3.5 w-3.5" />}>Objekt: {a.properties.title}</Row>}
          {assignee && <Row icon={<User className="h-3.5 w-3.5" />}>Zuständig: {assignee.full_name || assignee.email}</Row>}
          {a.notes && <Row icon={<FileText className="h-3.5 w-3.5" />}>{a.notes}</Row>}
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}

export function TaskHover({ task: tk, assignee, relatedLabel, children }: { task: any; assignee?: any; relatedLabel?: string; children: ReactNode }) {
  return (
    <HoverCard openDelay={150} closeDelay={80}>
      <HoverCardTrigger asChild>{children}</HoverCardTrigger>
      <HoverCardContent {...shellProps()}>
        <div className="mb-2 flex flex-wrap items-center gap-1.5">
          <Badge variant="secondary" className="gap-1"><CheckSquare className="h-3 w-3" />Aufgabe</Badge>
          {tk.priority && (
            <Badge className={`border-0 ${PRIO_CLASS[tk.priority] ?? ""}`}>
              {tk.priority === "urgent" && <AlertTriangle className="mr-1 h-3 w-3" />}
              {TASK_PRIO_LABEL[tk.priority] ?? tk.priority}
            </Badge>
          )}
          <Badge variant="outline" className="ml-auto">{TASK_STATUS_LABEL[tk.status] ?? tk.status}</Badge>
        </div>
        <p className="mb-2 font-semibold leading-snug">{tk.title}</p>
        <div className="space-y-1">
          <Row icon={<CalIcon className="h-3.5 w-3.5" />}>Fällig: {formatDateTime(tk.due_date)}</Row>
          {relatedLabel && <Row icon={<Building2 className="h-3.5 w-3.5" />}>{relatedLabel}</Row>}
          {assignee && <Row icon={<User className="h-3.5 w-3.5" />}>Zuständig: {assignee.full_name || assignee.email}</Row>}
          {tk.description && <Row icon={<FileText className="h-3.5 w-3.5" />}>{tk.description}</Row>}
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">Klicken öffnet die Aufgabenliste</p>
      </HoverCardContent>
    </HoverCard>
  );
}

export function HolidayHover({ holidays, children }: { holidays: Holiday[]; children: ReactNode }) {
  if (!holidays.length) return <>{children}</>;
  return (
    <HoverCard openDelay={150} closeDelay={80}>
      <HoverCardTrigger asChild>{children}</HoverCardTrigger>
      <HoverCardContent {...shellProps("w-72")}>
        <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold"><Flag className="h-4 w-4 text-rose-500" />Feiertag</p>
        <div className="space-y-2">
          {holidays.map((h) => (
            <div key={h.date + h.name} className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-medium">{h.name}</p>
                <p className="text-xs text-muted-foreground">
                  {new Intl.DateTimeFormat("de-CH", { weekday: "long", day: "2-digit", month: "long", year: "numeric" }).format(new Date(h.date))}
                </p>
              </div>
              <Badge variant={h.paid ? "default" : "outline"} className="shrink-0 text-[10px]">{h.paid ? "bezahlt" : "unbezahlt"}</Badge>
            </div>
          ))}
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}
