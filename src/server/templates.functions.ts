import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { ASIMO_TEMPLATES } from "@/lib/document-templates";

/**
 * Seeds (idempotent) all ASIMO system templates and keeps their content
 * in sync with the source of truth in src/lib/document-templates.ts.
 *
 * - Identifies system templates by name (stable key).
 * - Inserts missing rows; updates existing rows so design changes propagate.
 * - When no default exists for a given type, marks the ASIMO template as default.
 */
export const seedAsimoTemplates = createServerFn({ method: "POST" }).handler(async () => {
  const results: Array<{ name: string; type: string; action: "inserted" | "updated" | "unchanged" }> = [];

  for (const tpl of ASIMO_TEMPLATES) {
    const { data: existing } = await supabaseAdmin
      .from("document_templates")
      .select("id, content, is_default")
      .eq("name", tpl.name)
      .maybeSingle();

    if (!existing) {
      // Check if any default already exists for this type
      const { data: anyDefault } = await supabaseAdmin
        .from("document_templates")
        .select("id")
        .eq("type", tpl.type as never)
        .eq("is_default", true)
        .maybeSingle();

      const { error } = await supabaseAdmin.from("document_templates").insert({
        name: tpl.name,
        type: tpl.type as never,
        category: tpl.category,
        description: tpl.description,
        content: tpl.content,
        layout_type: "contract",
        is_system: true,
        is_active: true,
        is_default: !anyDefault,
        variables: {},
        default_variables: {},
      });
      if (error) throw new Error(`Seed insert failed for ${tpl.name}: ${error.message}`);
      results.push({ name: tpl.name, type: tpl.type, action: "inserted" });
    } else if (existing.content !== tpl.content) {
      const { error } = await supabaseAdmin
        .from("document_templates")
        .update({ content: tpl.content, description: tpl.description, updated_at: new Date().toISOString() })
        .eq("id", existing.id);
      if (error) throw new Error(`Seed update failed for ${tpl.name}: ${error.message}`);
      results.push({ name: tpl.name, type: tpl.type, action: "updated" });
    } else {
      results.push({ name: tpl.name, type: tpl.type, action: "unchanged" });
    }
  }

  return { ok: true, results };
});

/**
 * Sets a given template as default for its type. Atomically clears the
 * previous default via the SQL helper `set_default_template`.
 */
export const setDefaultTemplate = createServerFn({ method: "POST" })
  .inputValidator((data) => z.object({ templateId: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    const { error } = await supabaseAdmin.rpc("set_default_template", { _template_id: data.templateId });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
