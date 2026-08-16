import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { getBackendErrorMessage } from "@/lib/backend-errors";
import { AssigneeAvatars, initials, type EmployeeLite } from "@/components/clients/ClientAssignees";

export function usePropertyAssignees() {
  return useQuery({
    queryKey: ["property_assignees"],
    queryFn: async () => {
      const { data, error } = await supabase.from("property_assignees").select("property_id,user_id");
      if (error) throw error;
      return (data ?? []) as { property_id: string; user_id: string }[];
    },
  });
}

export function PropertyAssigneePicker({
  propertyId,
  assignedIds,
  employees,
  employeeMap,
  size = "sm",
}: {
  propertyId: string;
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
          .from("property_assignees")
          .delete()
          .eq("property_id", propertyId)
          .eq("user_id", userId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("property_assignees").insert({ property_id: propertyId, user_id: userId });
        if (error) throw error;
      }
      const next = new Set(selected);
      if (next.has(userId)) next.delete(userId); else next.add(userId);
      await supabase.from("properties").update({ assigned_to: Array.from(next)[0] ?? null }).eq("id", propertyId);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["property_assignees"] });
      qc.invalidateQueries({ queryKey: ["properties"] });
    },
    onError: (e: unknown) => toast.error(getBackendErrorMessage(e)),
  });

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-1 rounded-full p-0.5 transition hover:bg-accent"
          onClick={(e) => { e.stopPropagation(); e.preventDefault(); }}
          title="Mitarbeitende zuweisen"
        >
          <AssigneeAvatars ids={assignedIds} employeeMap={employeeMap} size={size} />
          <span className="flex h-5 w-5 items-center justify-center rounded-full border border-dashed text-muted-foreground">
            <Plus className="h-3 w-3" />
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64 p-0" onClick={(e) => { e.stopPropagation(); e.preventDefault(); }}>
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
