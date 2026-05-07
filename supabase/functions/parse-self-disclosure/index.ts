// Parses an uploaded ASIMO Selbstauskunft PDF using Lovable AI Gateway (Gemini)
// and returns structured field values matching the client_self_disclosures schema.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const FIELD_SCHEMA = {
  type: "object",
  properties: {
    salutation: { type: "string", description: "Anrede: Herr, Frau, Divers" },
    title: { type: "string" },
    first_name: { type: "string" },
    last_name: { type: "string" },
    birth_name: { type: "string", description: "Ledigname" },
    street: { type: "string" },
    street_number: { type: "string" },
    postal_code: { type: "string" },
    city: { type: "string" },
    country: { type: "string", description: "Ländercode, z.B. CH" },
    resident_since: { type: "string", description: "ISO date YYYY-MM-DD oder YYYY" },
    phone: { type: "string" },
    mobile: { type: "string" },
    email: { type: "string" },
    birth_date: { type: "string", description: "ISO date YYYY-MM-DD" },
    nationality: { type: "string" },
    birth_place: { type: "string" },
    birth_country: { type: "string" },
    marital_status: { type: "string" },
    tax_id_ch: { type: "string" },
    employment_status: { type: "string" },
    employer_name: { type: "string" },
    employer_address: { type: "string" },
    employer_phone: { type: "string" },
    employed_as: { type: "string" },
    employed_since: { type: "string", description: "ISO date oder Jahr" },
    salary_type: { type: "string", description: "Fixum / Provision / Fixum + Provision" },
    annual_net_salary: { type: "number" },
    salary_net_monthly: { type: "number" },
    additional_income: { type: "number" },
    income_job_two: { type: "number" },
    income_rental: { type: "number" },
    mortgage_expense: { type: "number" },
    rent_expense: { type: "number" },
    leasing_expense: { type: "number" },
    credit_expense: { type: "number" },
    life_insurance_expense: { type: "number" },
    alimony_expense: { type: "number" },
    health_insurance_expense: { type: "number" },
    property_insurance_expense: { type: "number" },
    utilities_expense: { type: "number" },
    telecom_expense: { type: "number" },
    living_costs_expense: { type: "number" },
    taxes_expense: { type: "number" },
    miscellaneous_expense: { type: "number" },
    disclosure_date: { type: "string", description: "ISO date" },
    disclosure_place: { type: "string" },
    advisor_id: { type: "string", description: "Beratername wie im Dokument" },
  },
  additionalProperties: false,
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY missing");

    const { pdf_base64, mime_type } = await req.json();
    if (!pdf_base64 || typeof pdf_base64 !== "string") {
      return new Response(JSON.stringify({ error: "pdf_base64 required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemPrompt = `Du bist ein präziser Datenextraktor für die ASIMO-Selbstauskunft (Schweiz).
Extrahiere ausschliesslich Felder aus der "Selbstauskunft"-Seite (NICHT aus der Investment-Checkliste).
Mitantragsteller ignorieren – nur Antragsteller (linke Spalte).
CHF-Beträge als reine Zahlen ohne Tausender-Trennzeichen, ohne Währung.
Datumsangaben als ISO YYYY-MM-DD wenn möglich, sonst Jahr als YYYY.
Lasse Felder weg, die im Dokument nicht stehen. Keine Halluzinationen.`;

    const aiResp = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: systemPrompt },
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: "Extrahiere die Selbstauskunfts-Felder aus diesem PDF.",
                },
                {
                  type: "image_url",
                  image_url: {
                    url: `data:${mime_type ?? "application/pdf"};base64,${pdf_base64}`,
                  },
                },
              ],
            },
          ],
          tools: [
            {
              type: "function",
              function: {
                name: "extract_self_disclosure",
                description: "Extrahierte Felder aus der Selbstauskunft",
                parameters: FIELD_SCHEMA,
              },
            },
          ],
          tool_choice: {
            type: "function",
            function: { name: "extract_self_disclosure" },
          },
        }),
      },
    );

    if (!aiResp.ok) {
      const txt = await aiResp.text();
      console.error("AI error", aiResp.status, txt);
      if (aiResp.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit erreicht – bitte gleich nochmals." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      if (aiResp.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI-Guthaben aufgebraucht." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      return new Response(JSON.stringify({ error: "AI Gateway Fehler" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const json = await aiResp.json();
    const toolCall = json.choices?.[0]?.message?.tool_calls?.[0];
    const args = toolCall?.function?.arguments
      ? JSON.parse(toolCall.function.arguments)
      : {};

    return new Response(JSON.stringify({ fields: args }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("parse-self-disclosure error", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "unknown" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
