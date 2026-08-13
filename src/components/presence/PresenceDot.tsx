import { cn } from "@/lib/utils";
import { presenceMeta } from "@/lib/presence";

export function PresenceDot({
  status,
  className,
  ring = true,
}: {
  status?: string | null;
  className?: string;
  ring?: boolean;
}) {
  const meta = presenceMeta(status);
  return (
    <span
      title={meta.label}
      className={cn(
        "inline-block h-2.5 w-2.5 shrink-0 rounded-full",
        meta.dot,
        ring && "ring-2 ring-background",
        className,
      )}
    />
  );
}

export function PresenceLabel({ status, className }: { status?: string | null; className?: string }) {
  const meta = presenceMeta(status);
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs", meta.text, className)}>
      <PresenceDot status={status} ring={false} />
      {meta.label}
    </span>
  );
}
