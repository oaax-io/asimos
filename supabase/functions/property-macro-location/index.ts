// Macro Location (Makrolage) Analyse via Lovable AI Gateway
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ICON_KEYS = [
  "transport", "education", "shopping", "healthcare",
  "leisure", "safety", "economy", "demographics", "nature", "culture",
] as const;

const tool = {
  type: "function",
  function: {
    name: "submit_macro_location",
    description: "Strukturierte Makrolage-Analyse (Region, Gemeinde, Umfeld) mit Icons & Beschreibung",
    parameters: {
      type: "object",
      properties: {
        region: { type: "string", description: "Region/Kanton/Bundesland" },
        municipality: { type: "string", description: "Gemeinde / Stadt / Ort" },
        summary: { type: "string", description: "4-6 Sätze Gesamtbeschreibung der Makrolage" },
        score: { type: "integer", minimum: 1, maximum: 10, description: "Gesamtbewertung 1-10" },
        categories: {
          type: "array",
          description: "8-10 Kategorien zur Makrolage mit Icon, Bewertung und Beschreibung",
          items: {
            type: "object",
            properties: {
              key: { type: "string", enum: ICON_KEYS as unknown as string[] },
              title: { type: "string", description: "Kurzer Titel der Kategorie auf Deutsch" },
              rating: { type: "integer", minimum: 1, maximum: 5, description: "Bewertung 1-5" },
              description: { type: "string", description: "1-2 Sätze Erklärung mit konkreten Angaben" },
              highlights: { type: "array", items: { type: "string" }, description: "2-4 kurze Stichpunkte mit Zahlen/Namen" },
            },
            required: ["key", "title", "rating", "description", "highlights"],
          },
        },
        connectivity: {
          type: "object",
          description: "Erreichbarkeit & Verkehrsanbindung",
          properties: {
            public_transport: { type: "string", description: "ÖV-Anbindung mit konkreten Linien/Stationen" },
            highway: { type: "string", description: "Autobahnanschluss & Distanz" },
            airport: { type: "string", description: "Nächster Flughafen & Distanz" },
            city_center: { type: "string", description: "Distanz zum nächsten Stadtzentrum" },
          },
        },
        demographics: {
          type: "object",
          properties: {
            population: { type: "string", description: "Einwohnerzahl der Gemeinde" },
            tax_rate: { type: "string", description: "Steuerfuss / Steuerbelastung wenn relevant" },
            income_level: { type: "string", enum: ["niedrig", "mittel", "gehoben", "hoch", "unbekannt"] },
            development: { type: "string", description: "Bevölkerungs- & Wirtschaftsentwicklung" },
          },
        },
        strengths: { type: "array", items: { type: "string" }, description: "3-5 Stärken der Makrolage" },
        weaknesses: { type: "array", items: { type: "string" }, description: "2-4 Schwächen / Risiken" },
      },
      required: ["region", "municipality", "summary", "score", "categories", "connectivity", "demographics", "strengths", "weaknesses"],
      additionalProperties: false,
    },
  },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const { property } = await req.json();
    if (!property?.id) {
      return new Response(JSON.stringify({ error: "property required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const facts = {
      Adresse: [property.address, property.postal_code, property.city, property.country].filter(Boolean).join(", "),
      Stadt: property.city,
      PLZ: property.postal_code,
      Land: property.country,
      Typ: property.property_type,
    };

    const systemPrompt = `Du bist ein erfahrener Immobilien- und Standortanalyst für den DACH-Raum (Schweiz, Deutschland, Österreich). Du erstellst fundierte Makrolage-Analysen mit konkreten, realistischen Angaben (Distanzen, Linien, Einwohnerzahlen, Steuerfuss). Antworte ausschliesslich auf Deutsch. Nutze die ICON-Keys exakt: transport, education, shopping, healthcare, leisure, safety, economy, demographics, nature, culture. Decke mindestens 8 dieser Kategorien ab.`;

    const userPrompt = `Erstelle eine vollständige Makrolage-Analyse für folgende Immobilie und rufe submit_macro_location auf:\n\n${JSON.stringify(facts, null, 2)}`;

    const model = "google/gemini-2.5-pro";
    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [tool],
        tool_choice: { type: "function", function: { name: "submit_macro_location" } },
      }),
    });

    if (!aiResp.ok) {
      if (aiResp.status === 429) {
        return new Response(JSON.stringify({ error: "Rate Limit erreicht. Bitte später erneut versuchen." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResp.status === 402) {
        return new Response(JSON.stringify({ error: "AI-Guthaben aufgebraucht. Bitte Workspace aufladen." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await aiResp.text();
      console.error("AI gateway error:", aiResp.status, t);
      return new Response(JSON.stringify({ error: "AI-Dienst nicht erreichbar" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await aiResp.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      console.error("No tool call in response:", JSON.stringify(data));
      return new Response(JSON.stringify({ error: "KI hat keine strukturierte Analyse zurückgegeben" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let macro: any;
    try {
      macro = JSON.parse(toolCall.function.arguments);
    } catch (e) {
      console.error("JSON parse failed:", toolCall.function.arguments);
      return new Response(JSON.stringify({ error: "Antwort konnte nicht verarbeitet werden" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const payload = { ...macro, model, generated_at: new Date().toISOString() };

    const { error: saveErr } = await supabase
      .from("properties")
      .update({ macro_location: payload })
      .eq("id", property.id);

    if (saveErr) {
      console.error("Save error:", saveErr);
      return new Response(JSON.stringify({ macro_location: payload, saved: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ macro_location: payload, saved: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("macro-location error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
