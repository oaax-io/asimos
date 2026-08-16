import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const InputSchema = z.object({
  property: z.record(z.string(), z.any()),
  tone: z.enum(["sachlich", "emotional", "premium"]).default("sachlich"),
  extra: z.string().max(2000).optional(),
});

export const generatePropertyDescription = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => InputSchema.parse(data))
  .handler(async ({ data }): Promise<{ text: string }> => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("KI ist nicht konfiguriert (LOVABLE_API_KEY fehlt).");

    const p = data.property;
    const facts = Object.entries(p)
      .filter(([, v]) => v !== null && v !== undefined && v !== "" && !(Array.isArray(v) && v.length === 0))
      .map(([k, v]) => `- ${k}: ${Array.isArray(v) ? v.join(", ") : String(v)}`)
      .join("\n");

    const prompt = `Du bist ein erfahrener Schweizer Immobilienmakler. Schreibe einen ansprechenden Exposé-Beschreibungstext auf Deutsch (Schweizer Rechtschreibung, kein "ß").

Stil: ${data.tone}.
Regeln:
- 150-250 Wörter, 3-4 kurze Absätze (Einleitung, Objekt & Ausstattung, Lage, Abschluss).
- Nur vorhandene Angaben verwenden, nichts erfinden, keine Preisversprechen.
- Keine Aufzählungszeichen, keine Überschriften, nur Fliesstext.
- Gib ausschliesslich den fertigen Text zurück.

Objektdaten:
${facts}
${data.extra ? `\nZusätzliche Hinweise des Maklers:\n${data.extra}` : ""}`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Lovable-API-Key": apiKey,
        "X-Lovable-AIG-SDK": "fetch",
      },
      body: JSON.stringify({
        model: "openai/gpt-5.6-sol",
        input: prompt,
        stream: true,
        store: false,
        reasoning: { effort: "low", summary: "auto" },
      }),
    });

    if (!res.ok || !res.body) {
      if (res.status === 429) throw new Error("KI-Limit erreicht – bitte später erneut versuchen.");
      if (res.status === 402) throw new Error("KI-Guthaben aufgebraucht.");
      throw new Error(`KI-Fehler (${res.status}): ${await res.text().catch(() => "")}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let text = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.startsWith("data:")) continue;
        const payload = line.slice(5).trim();
        if (!payload || payload === "[DONE]") continue;
        try {
          const evt = JSON.parse(payload);
          if (evt.type === "response.output_text.delta" && typeof evt.delta === "string") text += evt.delta;
          if (evt.type === "response.completed" && !text && evt.response?.output_text) {
            text = Array.isArray(evt.response.output_text) ? evt.response.output_text.join("") : String(evt.response.output_text);
          }
        } catch {
          /* ignore keep-alive fragments */
        }
      }
    }

    if (!text.trim()) throw new Error("Die KI hat keinen Text zurückgegeben. Bitte erneut versuchen.");
    return { text: text.trim() };
  });
