import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { ASIMO_TEMPLATES } from "@/lib/document-templates";

/**
 * Seeds (idempotent) all ASIMO system templates and keeps their content
 * in sync with the source of truth in src/lib/document-templates.ts.
 *
 * - Identifies system templates by name (stable key).
 * - Inserts missing rows; updates existing rows so design changes propagate.
 * - When no default exists for a given type, marks the ASIMO template as default.
 */
export const seedAsimoTemplates = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  // Systemvorlagen sind heute global: nur Inhaber/Admin der eigenen Firma darf synchronisieren.
  const { data: allowed } = await (context as any).supabase.rpc("is_owner_or_admin");
  if (!allowed) throw new Error("Keine Berechtigung");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const results: Array<{ name: string; type: string; action: "inserted" | "updated" | "unchanged" }> = [];

  for (const tpl of ASIMO_TEMPLATES) {
    const { data: existing } = await supabaseAdmin
      .from("document_templates")
      .select("id, content, is_default")
      .eq("name", tpl.name)
      .maybeSingle();

    if (!existing) {
      const { data: inserted, error } = await supabaseAdmin
        .from("document_templates")
        .insert({
          name: tpl.name,
          type: tpl.type as never,
          category: tpl.category,
          description: tpl.description,
          content: tpl.content,
          layout_type: "contract",
          is_system: true,
          is_active: true,
          is_default: false,
          variables: {},
          default_variables: {},
        })
        .select("id")
        .single();
      if (error) throw new Error(`Seed insert failed for ${tpl.name}: ${error.message}`);

      // Promote to default only if no default exists for this type yet
      const { data: anyDefault } = await supabaseAdmin
        .from("document_templates")
        .select("id")
        .eq("type", tpl.type as never)
        .eq("is_default", true)
        .maybeSingle();
      if (!anyDefault && inserted) {
        await supabaseAdmin
          .from("document_templates")
          .update({ is_default: true })
          .eq("id", inserted.id);
      }
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
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ templateId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    // Als Benutzer aufrufen, damit die Rollenprüfung in set_default_template greift
    // (mit Vollzugriff wäre auth.uid() leer und die Prüfung wirkungslos).
    const { error } = await (context as any).supabase.rpc("set_default_template", { _template_id: data.templateId });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
