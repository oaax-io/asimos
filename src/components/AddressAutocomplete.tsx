import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { MapPin, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { searchAddress, type AddressSuggestion } from "@/lib/mapbox.functions";
import { cn } from "@/lib/utils";

interface Props {
  value: string;
  onChange: (v: string) => void;
  onSelect?: (s: AddressSuggestion) => void;
  placeholder?: string;
  country?: string; // ISO-2, lowercased; e.g. "ch,de,at"
  className?: string;
  id?: string;
}

export function AddressAutocomplete({
  value,
  onChange,
  onSelect,
  placeholder = "Strasse, PLZ oder Ort…",
  country = "ch,de,at,li",
  className,
  id,
}: Props) {
  const search = useServerFn(searchAddress);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<AddressSuggestion[]>([]);
  const [hi, setHi] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);
  const skipNext = useRef(false);

  useEffect(() => {
    if (skipNext.current) {
      skipNext.current = false;
      return;
    }
    if (!value || value.trim().length < 3) {
      setItems([]);
      setOpen(false);
      return;
    }
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await search({ data: { q: value, country } });
        setItems(res);
        setOpen(res.length > 0);
        setHi(0);
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [value, country, search]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const pick = (s: AddressSuggestion) => {
    skipNext.current = true;
    onChange(s.street || s.label);
    onSelect?.(s);
    setOpen(false);
  };

  return (
    <div ref={wrapRef} className="relative">
      <div className="relative">
        <MapPin className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => items.length > 0 && setOpen(true)}
          onKeyDown={(e) => {
            if (!open) return;
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setHi((h) => Math.min(h + 1, items.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setHi((h) => Math.max(h - 1, 0));
            } else if (e.key === "Enter" && items[hi]) {
              e.preventDefault();
              pick(items[hi]);
            } else if (e.key === "Escape") {
              setOpen(false);
            }
          }}
          placeholder={placeholder}
          className={cn("pl-8", className)}
          autoComplete="off"
        />
        {loading && (
          <Loader2 className="absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        )}
      </div>
      {open && items.length > 0 && (
        <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md">
          <ul className="max-h-72 overflow-y-auto py-1 text-sm">
            {items.map((it, i) => (
              <li
                key={it.id}
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(it);
                }}
                onMouseEnter={() => setHi(i)}
                className={cn(
                  "flex cursor-pointer items-start gap-2 px-3 py-2",
                  i === hi ? "bg-accent text-accent-foreground" : "hover:bg-accent/50",
                )}
              >
                <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span className="leading-snug">{it.label}</span>
              </li>
            ))}
          </ul>
          <div className="border-t px-3 py-1 text-[10px] text-muted-foreground">
            Powered by Mapbox
          </div>
        </div>
      )}
    </div>
  );
}
