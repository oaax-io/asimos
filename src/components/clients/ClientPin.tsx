import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Pin, PinOff } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const PIN_COLORS = [
  { key: "fuchsia", label: "Fuchsia", dot: "bg-fuchsia-500", text: "text-fuchsia-500" },
  { key: "cyan", label: "Cyan", dot: "bg-cyan-500", text: "text-cyan-500" },
  { key: "lime", label: "Lime", dot: "bg-lime-500", text: "text-lime-500" },
  { key: "orange", label: "Orange", dot: "bg-orange-500", text: "text-orange-500" },
  { key: "brown", label: "Braun", dot: "bg-amber-800", text: "text-amber-800" },
] as const;

export function pinTextClass(color?: string | null) {
  return PIN_COLORS.find((c) => c.key === color)?.text ?? PIN_COLORS[0].text;
}

export function useClientPins() {
  const { user } = useAuth();
  const query = useQuery({
    queryKey: ["client_pins", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("client_pins")
        .select("client_id, color")
        .eq("user_id", user!.id);
      return data ?? [];
    },
  });
  const map = new Map<string, string>();
  (query.data ?? []).forEach((p: any) => map.set(p.client_id, p.color));
  return map;
}

export function ClientPinButton({
  clientId,
  color,
  size = "sm",
}: {
  clientId: string;
  color?: string | null;
  size?: "sm" | "xs";
}) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const pinned = !!color;

  const refresh = () => qc.invalidateQueries({ queryKey: ["client_pins"] });

  const setColor = async (key: string) => {
    if (!user?.id) return;
    const { error } = await supabase
      .from("client_pins")
      .upsert({ client_id: clientId, user_id: user.id, color: key }, { onConflict: "client_id,user_id" });
    if (error) { toast.error(error.message); return; }
    refresh();
    toast.success("Kunde angeheftet");
  };

  const unpin = async () => {
    if (!user?.id) return;
    const { error } = await supabase
      .from("client_pins")
      .delete()
      .eq("client_id", clientId)
      .eq("user_id", user.id);
    if (error) { toast.error(error.message); return; }
    refresh();
    toast.success("Pin entfernt");
  };

  const iconSize = size === "xs" ? "h-3.5 w-3.5" : "h-4 w-4";

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          title={pinned ? "Pin ändern" : "Kunde anheften"}
          className={`rounded-md p-1 transition hover:bg-accent ${pinned ? pinTextClass(color) : "text-muted-foreground/50 hover:text-muted-foreground"}`}
        >
          <Pin className={`${iconSize} ${pinned ? "fill-current" : ""}`} />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-2" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-1.5">
          {PIN_COLORS.map((c) => (
            <button
              key={c.key}
              type="button"
              title={c.label}
              onClick={() => setColor(c.key)}
              className={`h-6 w-6 rounded-full ring-offset-2 transition ${c.dot} ${color === c.key ? "ring-2 ring-foreground/40" : "hover:scale-110"}`}
            />
          ))}
          {pinned && (
            <Button variant="ghost" size="sm" className="ml-1 h-7 px-2 text-xs" onClick={unpin}>
              <PinOff className="mr-1 h-3.5 w-3.5" />
              Lösen
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
