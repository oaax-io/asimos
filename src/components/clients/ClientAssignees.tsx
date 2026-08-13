import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { getBackendErrorMessage } from "@/lib/backend-errors";

export type EmployeeLite = { id: string; full_name: string | null; email: string | null; avatar_url?: string | null };

export function useClientAssignees() {
  return useQuery({
    queryKey: ["client_assignees"],
    queryFn: async () => {
      const { data, error } = await supabase.from("client_assignees").select("client_id,user_id");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function initials(e?: EmployeeLite | null) {
  const src = e?.full_name || e?.email || "?";
  return src
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

export function AssigneeAvatars({
  ids,
  employeeMap,
  size = "sm",
  max = 3,
}: {
  ids: string[];
  employeeMap: Map<string, EmployeeLite>;
  size?: "sm" | "xs";
  max?: number;
}) {
  const people = ids.map((id) => employeeMap.get(id)).filter(Boolean) as EmployeeLite[];
  if (!people.length) return <span className="text-muted-foreground">—</span>;
  const shown = people.slice(0, max);
  const rest = people.length - shown.length;
  const cls = size === "xs" ? "h-6 w-6 text-[10px]" : "h-7 w-7 text-[11px]";
  return (
    <div className="flex items-center -space-x-2">
      {shown.map((p) => (
        <HoverCard key={p.id} openDelay={120} closeDelay={60}>
          <HoverCardTrigger asChild>
            <Avatar className={`${cls} ring-2 ring-background`}>
              {p.avatar_url ? <AvatarImage src={p.avatar_url} alt={p.full_name ?? ""} /> : null}
              <AvatarFallback className="bg-primary/10 text-primary">{initials(p)}</AvatarFallback>
            </Avatar>
          </HoverCardTrigger>
          <HoverCardContent className="w-auto px-3 py-2 text-sm">
            <p className="font-medium">{p.full_name ?? p.email}</p>
            {p.full_name && p.email && <p className="text-xs text-muted-foreground">{p.email}</p>}
          </HoverCardContent>
        </HoverCard>
      ))}
      {rest > 0 && (
        <Avatar className={`${cls} ring-2 ring-background`}>
          <AvatarFallback className="bg-muted text-muted-foreground">+{rest}</AvatarFallback>
        </Avatar>
      )}
    </div>
  );
}

export function AssigneePicker({
  clientId,
  assignedIds,
  employees,
  employeeMap,
  size = "sm",
}: {
  clientId: string;
  assignedIds: string[];
  employees: EmployeeLite[];
  employeeMap: Map<string, EmployeeLite>;
  size?: "sm" | "xs";
}) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const selected = useMemo(() => new Set(assignedIds), [assignedIds]);

  const toggle = useMutation({
    mutationFn: async (userId: string) => {
      if (selected.has(userId)) {
        const { error } = await supabase
          .from("client_assignees")
          .delete()
          .eq("client_id", clientId)
          .eq("user_id", userId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("client_assignees").insert({ client_id: clientId, user_id: userId });
        if (error) throw error;
      }
      // keep legacy single field in sync with the first assignee
      const next = new Set(selected);
      if (next.has(userId)) next.delete(userId); else next.add(userId);
      await supabase.from("clients").update({ assigned_to: Array.from(next)[0] ?? null }).eq("id", clientId);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["client_assignees"] });
      qc.invalidateQueries({ queryKey: ["clients"] });
    },
    onError: (e: unknown) => toast.error(getBackendErrorMessage(e)),
  });

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-1 rounded-full p-0.5 transition hover:bg-accent"
          onClick={(e) => e.stopPropagation()}
          title="Mitarbeitende zuweisen"
        >
          <AssigneeAvatars ids={assignedIds} employeeMap={employeeMap} size={size} />
          <span className="flex h-5 w-5 items-center justify-center rounded-full border border-dashed text-muted-foreground">
            <Plus className="h-3 w-3" />
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-0" onClick={(e) => e.stopPropagation()}>
        <div className="max-h-72 overflow-auto p-1">
          {employees.map((emp) => (
            <button
              key={emp.id}
              type="button"
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent"
              onClick={() => toggle.mutate(emp.id)}
            >
              <Checkbox checked={selected.has(emp.id)} className="pointer-events-none" />
              <Avatar className="h-6 w-6 text-[10px]">
                {emp.avatar_url ? <AvatarImage src={emp.avatar_url} alt={emp.full_name ?? ""} /> : null}
                <AvatarFallback className="bg-primary/10 text-primary">{initials(emp)}</AvatarFallback>
              </Avatar>
              <span className="truncate">{emp.full_name ?? emp.email}</span>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
