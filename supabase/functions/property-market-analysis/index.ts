// Marktanalyse via Lovable AI Gateway - strukturierte Ausgabe via Tool Calling
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const tool = {
  type: "function",
  function: {
    name: "submit_market_analysis",
    description: "Strukturierte Marktanalyse für eine Immobilie",
    parameters: {
      type: "object",
      properties: {
        location: {
          type: "object",
          properties: {
            summary: { type: "string", description: "2-3 Sätze zur Mikrolage, Infrastruktur, Nachfrage" },
            score: { type: "integer", minimum: 1, maximum: 10, description: "Lagebewertung 1-10" },
            highlights: { type: "array", items: { type: "string" }, description: "3-5 kurze Stichpunkte" },
          },
          required: ["summary", "score", "highlights"],
        },
        purchase_price: {
          type: "object",
          properties: {
            price_per_sqm_min: { type: "number" },
            price_per_sqm_max: { type: "number" },
            estimated_value_min: { type: "number" },
            estimated_value_max: { type: "number" },
            currency: { type: "string", enum: ["CHF", "EUR"] },
            comparison: { type: "string", enum: ["below_market", "at_market", "above_market", "unknown"] },
            comment: { type: "string", description: "1-2 Sätze Begründung" },
          },
          required: ["currency", "comparison", "comment"],
        },
        rental: {
          type: "object",
          properties: {
            rent_per_sqm_min: { type: "number" },
            rent_per_sqm_max: { type: "number" },
            monthly_rent_min: { type: "number" },
            monthly_rent_max: { type: "number" },
            gross_yield_min: { type: "number", description: "in %" },
            gross_yield_max: { type: "number", description: "in %" },
            comment: { type: "string" },
          },
          required: ["comment"],
        },
        trend: {
          type: "object",
          properties: {
            direction: { type: "string", enum: ["rising", "stable", "declining", "mixed"] },
            outlook: { type: "string", description: "12-24 Monate Aussicht, 2-3 Sätze" },
          },
          required: ["direction", "outlook"],
        },
        opportunities: { type: "array", items: { type: "string" }, description: "2-4 Chancen" },
        risks: { type: "array", items: { type: "string" }, description: "2-4 Risiken" },
        recommendation: {
          type: "object",
          properties: {
            verdict: { type: "string", enum: ["strong_buy", "buy", "hold", "caution", "avoid"] },
            summary: { type: "string", description: "1-2 Sätze klare Empfehlung" },
          },
          required: ["verdict", "summary"],
        },
      },
      required: ["location", "purchase_price", "rental", "trend", "opportunities", "risks", "recommendation"],
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
      Titel: property.title,
      Typ: property.property_type,
      Vermarktungsart: property.listing_type,
      Status: property.status,
      Adresse: [property.address, property.postal_code, property.city, property.country].filter(Boolean).join(", "),
      Wohnfläche_m2: property.living_area,
      Grundstück_m2: property.plot_area ?? property.land_area,
      Zimmer: property.rooms,
      Badezimmer: property.bathrooms,
      Baujahr: property.year_built,
      Renovierungsjahr: property.renovated_at,
      Etage: property.floor,
      Energieklasse: property.energy_class,
      Heizung: property.heating_type,
      Zustand: property.condition,
      Aktueller_Kaufpreis: property.price,
      Aktueller_Mietpreis: property.rent,
      Ausstattung: property.features,
      Beschreibung: property.description?.slice(0, 1500),
    };

    const systemPrompt = `Du bist ein erfahrener Immobilien-Marktanalyst für den DACH-Raum (Schweiz, Deutschland, Österreich). Du erstellst fundierte, realistische Marktbeobachtungen. Antworten in Deutsch. Nutze realistische Marktwerte für die genannte Region. Gib klare Spannweiten und ehrliche Einschätzungen. Wenn Adresse/Region fehlt, gib trotzdem eine Schätzung basierend auf typischen Werten ab.`;

    const userPrompt = `Analysiere folgende Immobilie und rufe submit_market_analysis mit strukturierten Werten auf:\n\n${JSON.stringify(facts, null, 2)}`;

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
        tool_choice: { type: "function", function: { name: "submit_market_analysis" } },
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

    let sections: any;
    try {
      sections = JSON.parse(toolCall.function.arguments);
    } catch (e) {
      console.error("JSON parse failed:", toolCall.function.arguments);
      return new Response(JSON.stringify({ error: "Antwort konnte nicht verarbeitet werden" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Speichern in DB
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("Authorization");
    const supabase = createClient(supabaseUrl, serviceKey);

    let userId: string | null = null;
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { data: u } = await supabase.auth.getUser(token);
      userId = u?.user?.id ?? null;
    }

    const { data: saved, error: saveErr } = await supabase
      .from("property_market_analyses")
      .insert({
        property_id: property.id,
        created_by: userId,
        sections,
        model,
      })
      .select()
      .single();

    if (saveErr) {
      console.error("Save error:", saveErr);
      // trotzdem Ergebnis zurückgeben
      return new Response(JSON.stringify({ sections, generated_at: new Date().toISOString(), saved: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ id: saved.id, sections, generated_at: saved.created_at, saved: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("market-analysis error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
