import { CANTONS } from "@/lib/swiss-holidays";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Flag } from "lucide-react";

export function HolidaySettings({
  canton, setCanton, showUnpaid, setShowUnpaid,
}: { canton: string; setCanton: (v: string) => void; showUnpaid: boolean; setShowUnpaid: (v: boolean) => void }) {
  return (
    <div className="flex items-center gap-2">
      <span className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-primary/80">
        <Flag className="h-3.5 w-3.5" /> Feiertage
      </span>
      <Select value={canton} onValueChange={setCanton}>
        <SelectTrigger className="h-7 w-[150px] border-primary/30 bg-primary/5 text-xs"><SelectValue /></SelectTrigger>
        <SelectContent className="max-h-72">
          {CANTONS.map((c) => <SelectItem key={c.code} value={c.code}>{c.code} – {c.name}</SelectItem>)}
        </SelectContent>
      </Select>
      <div className="flex items-center gap-1.5">
        <Switch id="unpaid" checked={showUnpaid} onCheckedChange={setShowUnpaid} className="scale-90" />
        <span className="text-[11px] text-muted-foreground">unbezahlt</span>
      </div>
    </div>
  );
}
