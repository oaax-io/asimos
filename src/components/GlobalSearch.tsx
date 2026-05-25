import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import {
  Search, X, Users, UserPlus, Building2, FileSignature, Calendar,
  CheckSquare, FileText, ScrollText, BookmarkCheck, UserCog, Loader2,
} from "lucide-react";

type Hit = {
  id: string;
  group: string;
  title: string;
  subtitle?: string;
  icon: React.ReactNode;
  to: string;
  params?: Record<string, string>;
  search?: Record<string, unknown>;
};

interface Props {
  open: boolean;
  onClose: () => void;
}

export function GlobalSearch({ open, onClose }: Props) {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQ("");
      setHits([]);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const term = q.trim();
    if (term.length < 2) {
      setHits([]);
      return;
    }
    setLoading(true);
    const t = setTimeout(async () => {
      const like = `%${term}%`;
      const [
        clients, leads, properties, dossiers, appts, tasks, docs, mandates, profiles, reservations,
      ] = await Promise.all([
        supabase.from("clients").select("id, full_name, email, city").or(`full_name.ilike.${like},email.ilike.${like},phone.ilike.${like},city.ilike.${like}`).limit(6),
        supabase.from("leads").select("id, full_name, email, city").or(`full_name.ilike.${like},email.ilike.${like},phone.ilike.${like}`).limit(6),
        supabase.from("properties").select("id, title, city, postal_code").or(`title.ilike.${like},city.ilike.${like},postal_code.ilike.${like}`).limit(6),
        supabase.from("financing_dossiers").select("id, title, bank_name").or(`title.ilike.${like},bank_name.ilike.${like}`).limit(6),
        supabase.from("appointments").select("id, title, location, starts_at").or(`title.ilike.${like},location.ilike.${like}`).limit(6),
        supabase.from("tasks").select("id, title, status").or(`title.ilike.${like}`).limit(6),
        supabase.from("documents").select("id, file_name, document_type").or(`file_name.ilike.${like}`).limit(6),
        supabase.from("mandates").select("id, mandate_type, status").limit(0),
        supabase.from("profiles").select("id, full_name, email, role").or(`full_name.ilike.${like},email.ilike.${like}`).limit(6),
        supabase.from("reservations").select("id, status, properties(title)").limit(0),
      ]);

      const all: Hit[] = [];
      clients.data?.forEach((r: any) => all.push({
        id: r.id, group: "Kunden", title: r.full_name, subtitle: r.email ?? r.city ?? "",
        icon: <Users className="h-4 w-4" />, to: "/clients/$id", params: { id: r.id },
      }));
      leads.data?.forEach((r: any) => all.push({
        id: r.id, group: "Leads", title: r.full_name, subtitle: r.email ?? r.city ?? "",
        icon: <UserPlus className="h-4 w-4" />, to: "/leads/$id", params: { id: r.id },
      }));
      properties.data?.forEach((r: any) => all.push({
        id: r.id, group: "Immobilien", title: r.title, subtitle: [r.postal_code, r.city].filter(Boolean).join(" "),
        icon: <Building2 className="h-4 w-4" />, to: "/properties/$id", params: { id: r.id },
      }));
      dossiers.data?.forEach((r: any) => all.push({
        id: r.id, group: "Finanzierung", title: r.title || "Dossier", subtitle: r.bank_name ?? "",
        icon: <FileSignature className="h-4 w-4" />, to: "/financing/$id", params: { id: r.id },
      }));
      appts.data?.forEach((r: any) => all.push({
        id: r.id, group: "Termine", title: r.title, subtitle: r.location ?? "",
        icon: <Calendar className="h-4 w-4" />, to: "/appointments",
      }));
      tasks.data?.forEach((r: any) => all.push({
        id: r.id, group: "Aufgaben", title: r.title, subtitle: r.status ?? "",
        icon: <CheckSquare className="h-4 w-4" />, to: "/tasks",
      }));
      docs.data?.forEach((r: any) => all.push({
        id: r.id, group: "Dokumente", title: r.file_name ?? "Dokument", subtitle: r.document_type ?? "",
        icon: <FileText className="h-4 w-4" />, to: "/documents",
      }));
      profiles.data?.forEach((r: any) => all.push({
        id: r.id, group: "Mitarbeiter", title: r.full_name ?? r.email, subtitle: r.role ?? "",
        icon: <UserCog className="h-4 w-4" />, to: "/team",
      }));

      setHits(all);
      setLoading(false);
    }, 220);
    return () => clearTimeout(t);
  }, [q, open]);

  const grouped = useMemo(() => {
    const m = new Map<string, Hit[]>();
    hits.forEach(h => {
      if (!m.has(h.group)) m.set(h.group, []);
      m.get(h.group)!.push(h);
    });
    return Array.from(m.entries());
  }, [hits]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] animate-fade-in">
      <div
        className="absolute inset-0 bg-background/60 backdrop-blur-xl"
        onClick={onClose}
      />
      <div className="relative mx-auto mt-[10vh] w-full max-w-2xl px-4 animate-scale-in">
        <div className="overflow-hidden rounded-2xl border bg-background/95 shadow-2xl ring-1 ring-border">
          <div className="flex items-center gap-3 border-b px-5 py-4">
            <Search className="h-5 w-5 text-muted-foreground" />
            <input
              ref={inputRef}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Suche Kunden, Immobilien, Finanzierung, Termine, Aufgaben, Dokumente, Mitarbeiter…"
              className="flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground"
            />
            {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
            <button
              onClick={onClose}
              className="rounded-md p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground"
              aria-label="Schließen"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="max-h-[60vh] overflow-y-auto p-2">
            {q.trim().length < 2 && (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                Tippe mindestens 2 Zeichen, um zu suchen…
              </p>
            )}
            {q.trim().length >= 2 && !loading && hits.length === 0 && (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                Keine Treffer für „{q}"
              </p>
            )}
            {grouped.map(([group, items]) => (
              <div key={group} className="mb-2">
                <div className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {group}
                </div>
                {items.map(h => (
                  <button
                    key={`${group}-${h.id}`}
                    onClick={() => {
                      onClose();
                      navigate({ to: h.to as any, params: h.params as any });
                    }}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition hover:bg-muted"
                  >
                    <span className="flex h-8 w-8 items-center justify-center rounded-md bg-muted text-muted-foreground">
                      {h.icon}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{h.title}</span>
                      {h.subtitle && (
                        <span className="block truncate text-xs text-muted-foreground">{h.subtitle}</span>
                      )}
                    </span>
                  </button>
                ))}
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between border-t bg-muted/30 px-4 py-2 text-[11px] text-muted-foreground">
            <span>↵ öffnen · Esc schließen</span>
            <span>Globale Suche</span>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
