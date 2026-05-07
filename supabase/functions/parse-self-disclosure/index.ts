// Parses an uploaded ASIMO Selbstauskunft PDF and returns structured field values
// matching the client_self_disclosures schema.
//
// Strategy:
//   1) Extract AcroForm field values directly from the PDF (deterministic, exact).
//      ASIMO PDFs are interactive forms — Vision-only OCR misses these because
//      the values are stored in form objects, not rendered as glyphs.
//   2) Send the raw form-field map + extracted text to Gemini with the target
//      schema, so the LLM does the mapping (label codes -> our DB columns).
//   3) Fallback to pure vision if the PDF has no AcroForm.

import { PDFDocument } from "https://esm.sh/pdf-lib@1.17.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const FIELD_SCHEMA = {
  type: "object",
  properties: {
    salutation: { type: "string" },
    title: { type: "string" },
    first_name: { type: "string" },
    last_name: { type: "string" },
    birth_name: { type: "string" },
    street: { type: "string" },
    street_number: { type: "string" },
    postal_code: { type: "string" },
    city: { type: "string" },
    country: { type: "string" },
    resident_since: { type: "string", description: "ISO YYYY-MM-DD oder YYYY" },
    phone: { type: "string" },
    mobile: { type: "string" },
    email: { type: "string" },
    birth_date: { type: "string", description: "ISO YYYY-MM-DD (von DD.MM.YYYY konvertieren)" },
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
    employed_since: { type: "string" },
    salary_type: { type: "string" },
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
    advisor_id: { type: "string" },
  },
  required: [
    "first_name",
    "last_name",
    "city",
    "employer_name",
    "salary_net_monthly",
    "rent_expense",
    "disclosure_date",
  ],
  additionalProperties: false,
};

async function extractFormFields(
  pdfBytes: Uint8Array,
): Promise<Record<string, string>> {
  try {
    const pdf = await PDFDocument.load(pdfBytes, {
      ignoreEncryption: true,
      updateMetadata: false,
    });
    const form = pdf.getForm();
    const fields = form.getFields();
    const out: Record<string, string> = {};
    for (const f of fields) {
      const name = f.getName();
      // pdf-lib: only TextField and Dropdown have getText/getSelected
      // deno-lint-ignore no-explicit-any
      const anyF = f as any;
      let val: string | undefined;
      if (typeof anyF.getText === "function") {
        val = anyF.getText();
      } else if (typeof anyF.getSelected === "function") {
        const sel = anyF.getSelected();
        if (Array.isArray(sel) && sel.length) val = sel.join(", ");
      } else if (typeof anyF.isChecked === "function") {
        val = anyF.isChecked() ? "true" : "";
      }
      if (val && val.trim() !== "") out[name] = val.trim();
    }
    return out;
  } catch (e) {
    console.warn("extractFormFields failed", e);
    return {};
  }
}

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

    // Decode base64 -> bytes
    const binary = atob(pdf_base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

    // 1) Extract AcroForm fields deterministically.
    const formFields = await extractFormFields(bytes);
    const formFieldsCount = Object.keys(formFields).length;
    console.log("form fields extracted:", formFieldsCount);

    const systemPrompt = `Du bist ein präziser Datenextraktor für die ASIMO-Selbstauskunft (Schweiz).
Du erhältst (a) die rohen AcroForm-Feldwerte des PDFs als JSON und (b) zusätzlich die PDF-Datei.

WICHTIG – Feld-Kodierung der ASIMO-Selbstauskunft:
- Felder mit Präfix "AN" gehören zum ANTRAGSTELLER → diese extrahieren.
- Felder mit Präfix "MI" gehören zum MITANTRAGSTELLER → IGNORIEREN.
- Investment-Checkliste (Seite 1) ignorieren – nur Selbstauskunft (Seite 2).

Mapping-Hinweise (typische ASIMO-Codes, nutze die Werte falls vorhanden):
- AN02 → first_name | AN03 → last_name (kann auch Ledigname enthalten)
- AN04 → street | AN04x → street_number
- AN05plz → postal_code | AN05ort → city
- AN06 → resident_since (Jahr) | Land falls separat, sonst "CH"
- AN07 → phone | AN07x → mobile
- AN08 → email
- AN09 → birth_date (DD.MM.YYYY → YYYY-MM-DD) | AN09x → nationality
- AN10 → birth_place | AN10x → birth_country
- AN11 → marital_status | AN12 → tax_id_ch
- AN13 → employment_status | AN14 → employer_name
- AN15plz/AN15ort → employer_address (Ort) | AN16/AN16x → employer street+nr
  Kombiniere AN16 + " " + AN16x + ", " + AN15plz + " " + AN15ort zu employer_address.
- AN17 → employer_phone | AN18 → employed_as | AN18x → employed_since
- AN19 → salary_net_monthly | AN20 → additional_income
- AN21 → annual_net_salary | AN22 → total_income_monthly (NICHT setzen, wird berechnet)
- Ausgaben AN23–AN30 (in PDF-Reihenfolge): typischerweise
  AN23=mortgage_expense, AN24=rent_expense, AN25=leasing_expense,
  AN26=credit_expense, AN27=life_insurance_expense, AN28=alimony_expense,
  AN29=health_insurance_expense, AN30=property_insurance_expense.
  Wenn Reihenfolge im Originaldokument abweicht, korrigiere anhand der visuellen Labels.
- "Datum" → disclosure_date (DD.MM.YYYY → YYYY-MM-DD) | "Ort1" → disclosure_place
- "Berater" → advisor_id (Name als String)

CHF-Beträge: nur Zahlen, ohne Tausender, ohne Währung.
Lasse Felder weg, die leer/nicht vorhanden sind. Keine Halluzinationen.`;

    const userParts: Array<Record<string, unknown>> = [
      {
        type: "text",
        text:
          formFieldsCount > 0
            ? `AcroForm-Feldwerte aus dem PDF (autoritativ):\n\`\`\`json\n${JSON.stringify(
                formFields,
                null,
                2,
              )}\n\`\`\`\n\nMappe diese Werte gemäss Schema und Hinweisen. Nutze die PDF-Vorlage zur visuellen Kontrolle der Label-Reihenfolge.`
            : "Keine AcroForm-Felder gefunden. Extrahiere alle Felder visuell aus der PDF.",
      },
      {
        type: "image_url",
        image_url: {
          url: `data:${mime_type ?? "application/pdf"};base64,${pdf_base64}`,
        },
      },
    ];

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
            { role: "user", content: userParts },
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

    return new Response(
      JSON.stringify({ fields: args, form_fields_count: formFieldsCount }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("parse-self-disclosure error", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "unknown" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
