import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, ChevronDown, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

export type FilterOption = {
  value: string;
  label: string;
  avatar_url?: string | null;
  /** tailwind bg class for a colored dot */
  dot?: string;
};

function initialsOf(label: string) {
  return label
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("") || "?";
}

export function FilterMultiSelect({
  options,
  selected,
  onChange,
  placeholder,
  className,
}: {
  options: FilterOption[];
  selected: string[];
  onChange: (next: string[]) => void;
  placeholder: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const { t } = useTranslation();

  const toggle = (v: string) => {
    onChange(selected.includes(v) ? selected.filter((x) => x !== v) : [...selected, v]);
  };

  const filtered = options.filter((o) => o.label.toLowerCase().includes(query.trim().toLowerCase()));

  const label =
    selected.length === 0
      ? placeholder
      : selected.length === 1
        ? (options.find((o) => o.value === selected[0])?.label ?? selected[0])
        : `${selected.length} ${t("common.selected", { defaultValue: "ausgewählt" })}`;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-[190px] justify-between font-normal", className)}
        >
          <span className="truncate">{label}</span>
          <ChevronDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[240px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder={t("common.search", { defaultValue: "Suchen…" })}
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            <CommandEmpty>{t("common.noResults", { defaultValue: "Keine Treffer" })}</CommandEmpty>
            <CommandGroup>
              {filtered.map((o) => {
                const active = selected.includes(o.value);
                return (
                  <CommandItem key={o.value} value={o.value} onSelect={() => toggle(o.value)} className="gap-2">
                    <span
                      className={cn(
                        "flex h-4 w-4 items-center justify-center rounded-sm border",
                        active ? "border-primary bg-primary" : "opacity-50",
                      )}
                    >
                      {active && <Check className="h-3 w-3 text-primary-foreground" />}
                    </span>
                    {o.avatar_url !== undefined && (
                      <Avatar className="h-5 w-5 text-[9px]">
                        {o.avatar_url ? <AvatarImage src={o.avatar_url} alt={o.label} /> : null}
                        <AvatarFallback className="bg-primary/10 text-primary">{initialsOf(o.label)}</AvatarFallback>
                      </Avatar>
                    )}
                    {o.dot && <span className={cn("h-2.5 w-2.5 rounded-full", o.dot)} />}
                    <span className="truncate">{o.label}</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
        {selected.length > 0 && (
          <div className="border-t p-1">
            <Button variant="ghost" size="sm" className="w-full justify-center text-xs" onClick={() => onChange([])}>
              <X className="mr-1 h-3 w-3" />
              {t("common.clear", { defaultValue: "Leeren" })}
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
