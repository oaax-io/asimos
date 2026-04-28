import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  benchmarkColors,
  benchmarkDescriptions,
  benchmarkLabels,
  formatCHF,
  type BenchmarkResult,
} from "@/lib/self-disclosure";
import { cn } from "@/lib/utils";
import { TrendingDown, TrendingUp, Wallet, Gauge } from "lucide-react";

interface Props {
  benchmark: BenchmarkResult;
  variant?: "full" | "compact";
  className?: string;
}

export function BenchmarkCard({ benchmark, variant = "full", className }: Props) {
  const c = benchmarkColors[benchmark.status];
  const ratio = Math.max(0, Math.min(100, Math.round(benchmark.reserveRatio)));

  if (variant === "compact") {
    return (
      <div
        className={cn(
          "flex items-center gap-3 rounded-xl border p-3",
          c.ring,
          className,
        )}
      >
        <span className={cn("h-2.5 w-2.5 rounded-full", c.dot)} />
        <div className="min-w-0 flex-1">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Finanz-Benchmark
          </p>
          <p className={cn("font-semibold", c.text)}>
            {benchmarkLabels[benchmark.status]} · {ratio}%
          </p>
        </div>
        <div className="text-right text-xs text-muted-foreground">
          <div>Reserve</div>
          <div className="font-medium text-foreground">
            {formatCHF(benchmark.reserveTotal)}
          </div>
        </div>
      </div>
    );
  }

  return (
    <Card
      className={cn(
        "overflow-hidden border bg-gradient-to-br",
        c.bg,
        c.ring,
        className,
      )}
    >
      <CardContent className="space-y-5 p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Finanz-Benchmark
            </p>
            <h3 className="mt-1 font-display text-xl font-semibold">
              {benchmarkLabels[benchmark.status]}
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {benchmarkDescriptions[benchmark.status]}
            </p>
          </div>
          <span
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium",
              c.badge,
            )}
          >
            {ratio}% Reservequote
          </span>
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between text-xs text-muted-foreground">
            <span>Reservequote</span>
            <span className={cn("font-medium", c.text)}>{ratio}%</span>
          </div>
          <Progress value={ratio} className="h-2" />
        </div>

        <div className="grid grid-cols-3 gap-3 text-sm">
          <BenchStat
            icon={<TrendingUp className="h-4 w-4 text-emerald-500" />}
            label="Einnahmen"
            value={formatCHF(benchmark.totalIncome)}
          />
          <BenchStat
            icon={<TrendingDown className="h-4 w-4 text-rose-500" />}
            label="Ausgaben"
            value={formatCHF(benchmark.totalExpenses)}
          />
          <BenchStat
            icon={<Wallet className={cn("h-4 w-4", c.text)} />}
            label="Reserve"
            value={formatCHF(benchmark.reserveTotal)}
            highlight={c.text}
          />
        </div>
      </CardContent>
    </Card>
  );
}

function BenchStat({
  icon,
  label,
  value,
  highlight,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  highlight?: string;
}) {
  return (
    <div className="rounded-lg border bg-card/60 p-3">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className={cn("mt-1 font-display text-base font-semibold", highlight)}>
        {value}
      </div>
    </div>
  );
}

export function BenchmarkPlaceholder({ className }: { className?: string }) {
  return (
    <Card className={cn("border-dashed", className)}>
      <CardContent className="flex flex-col items-start gap-2 p-6 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <Gauge className="h-4 w-4" />
          <span className="font-medium text-foreground">Finanz-Benchmark</span>
        </div>
        <p>
          Noch keine Selbstauskunft erfasst. Über den Tab «Selbstauskunft»
          können Einnahmen und Ausgaben gepflegt werden – die Reservequote und
          Bewertung wird live berechnet.
        </p>
      </CardContent>
    </Card>
  );
}
