import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Bell, Calendar, CheckSquare, UserPlus, Mail } from "lucide-react";
import { toast } from "sonner";

type Prefs = {
  appointments_enabled: boolean;
  appointment_reminder_minutes: number;
  tasks_enabled: boolean;
  task_due_reminder: boolean;
  task_overdue_reminder: boolean;
  leads_enabled: boolean;
  email_enabled: boolean;
  in_app_enabled: boolean;
};

const DEFAULTS: Prefs = {
  appointments_enabled: true,
  appointment_reminder_minutes: 60,
  tasks_enabled: true,
  task_due_reminder: true,
  task_overdue_reminder: true,
  leads_enabled: true,
  email_enabled: false,
  in_app_enabled: true,
};

export function NotificationPreferencesForm() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [prefs, setPrefs] = useState<Prefs>(DEFAULTS);

  const { data } = useQuery({
    queryKey: ["notification-prefs"],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("notification_preferences").select("*").eq("user_id", user!.id).maybeSingle();
      return data;
    },
  });

  useEffect(() => {
    if (data) setPrefs({ ...DEFAULTS, ...data });
  }, [data]);

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("notification_preferences")
        .upsert({ user_id: user!.id, ...prefs }, { onConflict: "user_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Einstellungen gespeichert");
      qc.invalidateQueries({ queryKey: ["notification-prefs"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const update = <K extends keyof Prefs>(key: K, value: Prefs[K]) => setPrefs((p) => ({ ...p, [key]: value }));

  return (
    <Card className="max-w-3xl">
      <CardContent className="space-y-6 p-6">
        <div className="flex items-center gap-3">
          <Bell className="h-5 w-5 text-primary" />
          <div>
            <h2 className="text-lg font-semibold">Benachrichtigungen</h2>
            <p className="text-sm text-muted-foreground">Lege fest, worüber und wie du informiert wirst.</p>
          </div>
        </div>

        <Separator />

        <section className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Kanäle</h3>
          <Row icon={<Bell className="h-4 w-4" />} label="In-App Benachrichtigungen" description="Über die Glocke in der Topbar"
            checked={prefs.in_app_enabled} onChange={(v) => update("in_app_enabled", v)} />
          <Row icon={<Mail className="h-4 w-4" />} label="E-Mail Benachrichtigungen" description="Per E-Mail (vorläufig deaktiviert)"
            checked={prefs.email_enabled} onChange={(v) => update("email_enabled", v)} />
        </section>

        <Separator />

        <section className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Termine</h3>
          <Row icon={<Calendar className="h-4 w-4" />} label="Termin-Benachrichtigungen" description="Erinnerungen vor anstehenden Terminen"
            checked={prefs.appointments_enabled} onChange={(v) => update("appointments_enabled", v)} />
          {prefs.appointments_enabled && (
            <div className="ml-7 flex items-center gap-3">
              <Label className="text-sm">Erinnerung</Label>
              <Select value={String(prefs.appointment_reminder_minutes)} onValueChange={(v) => update("appointment_reminder_minutes", Number(v))}>
                <SelectTrigger className="h-8 w-44"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="15">15 Minuten vorher</SelectItem>
                  <SelectItem value="30">30 Minuten vorher</SelectItem>
                  <SelectItem value="60">1 Stunde vorher</SelectItem>
                  <SelectItem value="180">3 Stunden vorher</SelectItem>
                  <SelectItem value="1440">1 Tag vorher</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </section>

        <Separator />

        <section className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Aufgaben</h3>
          <Row icon={<CheckSquare className="h-4 w-4" />} label="Aufgaben-Benachrichtigungen" description="Allgemein für Aufgaben aktivieren"
            checked={prefs.tasks_enabled} onChange={(v) => update("tasks_enabled", v)} />
          {prefs.tasks_enabled && (
            <div className="ml-7 space-y-2">
              <Row compact label="Fälligkeit erreicht" description="Wenn eine Aufgabe heute fällig wird"
                checked={prefs.task_due_reminder} onChange={(v) => update("task_due_reminder", v)} />
              <Row compact label="Überfällige Aufgaben" description="Tägliche Erinnerung an überfällige Aufgaben"
                checked={prefs.task_overdue_reminder} onChange={(v) => update("task_overdue_reminder", v)} />
            </div>
          )}
        </section>

        <Separator />

        <section className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Leads</h3>
          <Row icon={<UserPlus className="h-4 w-4" />} label="Neue Leads" description="Benachrichtigung bei neu eingegangenen Leads"
            checked={prefs.leads_enabled} onChange={(v) => update("leads_enabled", v)} />
        </section>

        <div className="flex justify-end pt-2">
          <Button onClick={() => save.mutate()} disabled={save.isPending}>Speichern</Button>
        </div>
      </CardContent>
    </Card>
  );
}

function Row({
  icon, label, description, checked, onChange, compact,
}: {
  icon?: React.ReactNode;
  label: string;
  description?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  compact?: boolean;
}) {
  return (
    <div className={`flex items-center justify-between gap-4 ${compact ? "" : "rounded-md border p-3"}`}>
      <div className="flex items-start gap-3">
        {icon && <div className="mt-0.5 text-muted-foreground">{icon}</div>}
        <div>
          <p className="text-sm font-medium">{label}</p>
          {description && <p className="text-xs text-muted-foreground">{description}</p>}
        </div>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
