import { CANTONS } from "@/lib/swiss-holidays";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Flag } from "lucide-react";

export function HolidaySettings({
  canton, setCanton, showUnpaid, setShowUnpaid,
}: { canton: string; setCanton: (v: string) => void; showUnpaid: boolean; setShowUnpaid: (v: boolean) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-muted/30 px-3 py-2">
      <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <Flag className="h-3.5 w-3.5" /> Feiertage
      </span>
      <Select value={canton} onValueChange={setCanton}>
        <SelectTrigger className="h-8 w-[200px] text-xs"><SelectValue /></SelectTrigger>
        <SelectContent className="max-h-72">
          {CANTONS.map((c) => <SelectItem key={c.code} value={c.code}>{c.code} – {c.name}</SelectItem>)}
        </SelectContent>
      </Select>
      <div className="flex items-center gap-2">
        <Switch id="unpaid" checked={showUnpaid} onCheckedChange={setShowUnpaid} />
        <Label htmlFor="unpaid" className="text-xs text-muted-foreground">unbezahlte Tage anzeigen</Label>
      </div>
      <div className="ml-auto flex items-center gap-3 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-rose-500" /> bezahlt</span>
        <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-slate-400" /> unbezahlt</span>
      </div>
    </div>
  );
}
