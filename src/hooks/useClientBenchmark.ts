import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { calculateBenchmark, type BenchmarkResult } from "@/lib/self-disclosure";

export function useClientBenchmark(clientId: string) {
  return useQuery<{ disclosure: Record<string, unknown> | null; benchmark: BenchmarkResult | null }>({
    queryKey: ["client_benchmark", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_self_disclosures")
        .select("*")
        .eq("client_id", clientId)
        .maybeSingle();
      if (error) throw error;
      if (!data) return { disclosure: null, benchmark: null };
      const benchmark = calculateBenchmark(data as Record<string, number | string | null>);
      return { disclosure: data as Record<string, unknown>, benchmark };
    },
  });
}
