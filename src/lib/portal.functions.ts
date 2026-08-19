import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const InputSchema = z.object({
  propertyId: z.string().uuid(),
  unpublish: z.boolean().optional(),
});

export const publishPropertyToPortal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => InputSchema.parse(data))
  .handler(async ({ data }): Promise<{ ok: true; published: boolean; portalPropertyId: string | null }> => {
    const baseUrl = process.env["PORTAL_API_BASE_URL"];
    const inboundKey = process.env["PORTAL_INBOUND_API_KEY"];
    if (!baseUrl || !inboundKey) throw new Error("Portal-Anbindung ist nicht konfiguriert.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const sb = supabaseAdmin as any;

    const { data: property, error } = await sb
      .from("properties")
      .select("*")
      .eq("id", data.propertyId)
      .single();
    if (error || !property) throw new Error("Immobilie nicht gefunden.");

    const endpoint = `${baseUrl.replace(/\/$/, "")}/api/public/asimo/properties`;

    if (data.unpublish) {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-asimo-key": inboundKey },
        body: JSON.stringify({ source_app_id: property.id, action: "unpublish" }),
      });
      if (!res.ok) throw new Error(`Portal antwortete mit ${res.status}: ${(await res.text().catch(() => "")).slice(0, 200)}`);

      await sb
        .from("properties")
        .update({ portal_published: false, portal_property_id: null })
        .eq("id", property.id);
      return { ok: true, published: false, portalPropertyId: null };
    }

    const statusMap: Record<string, string> = {
      available: "verfügbar",
      active: "verfügbar",
      reserved: "reserviert",
      sold: "verkauft",
      rented: "vermietet",
    };
    const portalStatus = statusMap[property.status as string];
    if (!portalStatus) {
      throw new Error("Objekt muss zuerst aktiv geschaltet werden, bevor es veröffentlicht werden kann");
    }

    const typeMap: Record<string, string> = {
      apartment: "Wohnung",
      house: "Haus",
      commercial: "Gewerbe",
      land: "Bauland",
      parking: "Parkplatz",
      mixed_use: "Mischnutzung",
      other: "Sonstiges",
    };

    const { data: media } = await sb
      .from("property_media")
      .select("file_url, file_type, is_cover, sort_order")
      .eq("property_id", property.id)
      .order("sort_order", { ascending: true });

    const supabaseUrl = (process.env["SUPABASE_URL"] ?? "").replace(/\/$/, "");
    const toUrl = (path?: string | null) => {
      if (!path) return null;
      if (path.startsWith("http")) return path;
      return `${supabaseUrl}/storage/v1/object/public/media/${path}`;
    };

    const imageRows = (media ?? []).filter((m: any) => {
      const t = (m.file_type ?? "").toLowerCase();
      return !!m.file_url && (!t || t === "image" || t.startsWith("image/"));
    });
    const images = imageRows.map((m: any) => toUrl(m.file_url)).filter(Boolean) as string[];
    const coverRow = imageRows.find((m: any) => m.is_cover);
    const coverImage = toUrl(coverRow?.file_url) ?? images[0] ?? toUrl(property.images?.[0]) ?? null;

    const description: string = property.description ?? "";
    const summary = description.length > 200 ? `${description.slice(0, 197).trimEnd()}…` : description;

    const payload = {
      source_app_id: property.id,
      action: "upsert",
      title: property.title,
      summary,
      description,
      price: property.price ?? property.rent ?? null,
      currency: "CHF",
      location: property.address ? `${property.address}, ${property.city ?? ""}`.replace(/,\s*$/, "") : property.city ?? null,
      country: property.country ?? "CH",
      property_type: typeMap[property.property_type as string] ?? "Sonstiges",
      rooms: property.rooms ?? null,
      living_area: property.living_area ?? property.area ?? null,
      status: portalStatus,
      cover_image: coverImage,
      images,
    };

    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-asimo-key": inboundKey },
      body: JSON.stringify(payload),
    });
    const text = await res.text().catch(() => "");
    if (!res.ok) throw new Error(`Portal antwortete mit ${res.status}: ${text.slice(0, 200)}`);

    let portalId: string | null = null;
    try {
      const json = JSON.parse(text);
      portalId = json?.id ?? json?.property_id ?? json?.data?.id ?? null;
    } catch {
      portalId = null;
    }

    await sb
      .from("properties")
      .update({
        portal_published: true,
        portal_published_at: new Date().toISOString(),
        ...(portalId ? { portal_property_id: portalId } : {}),
      })
      .eq("id", property.id);

    return { ok: true, published: true, portalPropertyId: portalId };
  });
