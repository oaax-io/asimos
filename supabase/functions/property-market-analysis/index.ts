// Marktanalyse via Lovable AI Gateway
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const { property } = await req.json();
    if (!property) {
      return new Response(JSON.stringify({ error: "property required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const facts = {
      Titel: property.title,
      Typ: property.property_type,
      Vermarktungsart: property.listing_type,
      Status: property.status,
      Adresse: [property.address, property.zip, property.city, property.country].filter(Boolean).join(", "),
      Region: property.region,
      Wohnfläche_m2: property.living_area,
      Grundstück_m2: property.land_area,
      Zimmer: property.rooms,
      Schlafzimmer: property.bedrooms,
      Badezimmer: property.bathrooms,
      Baujahr: property.year_built,
      Renovierungsjahr: property.year_renovated,
      Etage: property.floor,
      Energieklasse: property.energy_class,
      Heizung: property.heating_type,
      Zustand: property.condition,
      Aktueller_Kaufpreis: property.price,
      Aktueller_Mietpreis: property.rent,
      Nebenkosten: property.additional_costs,
      Ausstattung: property.features,
      Beschreibung: property.description?.slice(0, 1500),
    };

    const systemPrompt = `Du bist ein erfahrener Immobilien-Marktanalyst für den DACH-Raum (Schweiz, Deutschland, Österreich). Du erstellst fundierte, realistische Marktbeobachtungen basierend auf Objektdaten und Lage. Antworte präzise, datenbasiert und in strukturierter Form. Nutze ausschließlich Deutsch. Wenn Daten fehlen, weise darauf hin. Gib keine Garantie, sondern Einschätzungen mit Spannweiten.`;

    const userPrompt = `Erstelle eine Marktanalyse für folgende Immobilie:\n\n${JSON.stringify(facts, null, 2)}\n\nGib zurück (in Markdown):\n\n## 📍 Lageanalyse\nKurze Einschätzung der Region/Mikrolage, Infrastruktur, Nachfrage.\n\n## 💰 Kaufpreiseinschätzung\n- Marktüblicher Preis pro m² (Spannweite)\n- Geschätzter Verkehrswert (Spannweite in CHF/EUR)\n- Vergleich zum aktuellen Preis (falls angegeben): unter / im / über Marktwert\n\n## 🏠 Vermietungspotenzial\n- Marktübliche Miete pro m² (Spannweite)\n- Geschätzte Monatsmiete (Spannweite)\n- Bruttorendite-Schätzung\n\n## 📈 Markttrend\nKurzfristige Aussichten (12-24 Monate) für diese Region und Objektart.\n\n## ⚠️ Chancen & Risiken\nStichpunktartig 2-4 Punkte je Seite.\n\n## 🎯 Empfehlung\n1-2 Sätze klare Handlungsempfehlung.`;

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
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
    const analysis = data.choices?.[0]?.message?.content ?? "";

    return new Response(JSON.stringify({ analysis, generated_at: new Date().toISOString() }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("market-analysis error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
