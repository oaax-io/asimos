import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Pin, PinOff } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

// Bewusst andere Farbfamilien als die Status-Badges (slate/orange/green/emerald/amber/blue/indigo/zinc)
export const PROPERTY_PIN_COLORS = [
  { key: "fuchsia", label: "Fuchsia", dot: "bg-fuchsia-500", text: "text-fuchsia-500", row: "bg-fuchsia-500/10 hover:bg-fuchsia-500/15", border: "border-l-fuchsia-500" },
  { key: "cyan", label: "Cyan", dot: "bg-cyan-500", text: "text-cyan-500", row: "bg-cyan-500/10 hover:bg-cyan-500/15", border: "border-l-cyan-500" },
  { key: "lime", label: "Lime", dot: "bg-lime-500", text: "text-lime-600", row: "bg-lime-500/10 hover:bg-lime-500/15", border: "border-l-lime-500" },
  { key: "rose", label: "Rosé", dot: "bg-rose-500", text: "text-rose-500", row: "bg-rose-500/10 hover:bg-rose-500/15", border: "border-l-rose-500" },
  { key: "violet", label: "Violett", dot: "bg-violet-500", text: "text-violet-500", row: "bg-violet-500/10 hover:bg-violet-500/15", border: "border-l-violet-500" },
] as const;

function entry(color?: string | null) {
  return PROPERTY_PIN_COLORS.find((c) => c.key === color);
}

export function propertyPinTextClass(color?: string | null) {
  return entry(color)?.text ?? PROPERTY_PIN_COLORS[0].text;
}

export function propertyPinRowClass(color?: string | null) {
  const e = entry(color);
  return e ? `${e.row} border-l-4 ${e.border}` : "";
}

export function usePropertyPins() {
  const { user } = useAuth();
  const query = useQuery({
    queryKey: ["property_pins", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("property_pins")
        .select("property_id, color")
        .eq("user_id", user!.id);
      return data ?? [];
    },
  });
  const map = new Map<string, string>();
  (query.data ?? []).forEach((p: any) => map.set(p.property_id, p.color));
  return map;
}

export function PropertyPinButton({
  propertyId,
  color,
  size = "sm",
}: {
  propertyId: string;
  color?: string | null;
  size?: "sm" | "xs";
}) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const pinned = !!color;

  const refresh = () => qc.invalidateQueries({ queryKey: ["property_pins"] });

  const setColor = async (key: string) => {
    if (!user?.id) return;
    const { error } = await supabase
      .from("property_pins")
      .upsert({ property_id: propertyId, user_id: user.id, color: key }, { onConflict: "property_id,user_id" });
    if (error) { toast.error(error.message); return; }
    refresh();
    toast.success("Immobilie angeheftet");
  };

  const unpin = async () => {
    if (!user?.id) return;
    const { error } = await supabase
      .from("property_pins")
      .delete()
      .eq("property_id", propertyId)
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
          onClick={(e) => { e.stopPropagation(); }}
          title={pinned ? "Pin ändern" : "Immobilie anheften"}
          className={`rounded-md p-1 transition hover:bg-accent ${pinned ? propertyPinTextClass(color) : "text-muted-foreground/50 hover:text-muted-foreground"}`}
        >
          <Pin className={`${iconSize} ${pinned ? "fill-current" : ""}`} />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-2" onClick={(e) => { e.stopPropagation(); }}>
        <div className="flex items-center gap-1.5">
          {PROPERTY_PIN_COLORS.map((c) => (
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
