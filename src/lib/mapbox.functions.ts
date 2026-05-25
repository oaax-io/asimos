import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export type AddressSuggestion = {
  id: string;
  label: string;
  street: string;
  postal_code: string;
  city: string;
  country: string;
  country_code: string;
  longitude: number | null;
  latitude: number | null;
};

export const getMapboxToken = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ token: string | null }> => {
    return { token: process.env.MAPBOX_PUBLIC_TOKEN ?? null };
  },
);

export type GeocodedPoint = {
  id: string;
  longitude: number;
  latitude: number;
};

export const geocodeAddresses = createServerFn({ method: "POST" })
  .inputValidator((data) =>
    z
      .object({
        items: z
          .array(
            z.object({
              id: z.string(),
              query: z.string().min(2),
              country: z.string().optional(),
            }),
          )
          .max(200),
      })
      .parse(data),
  )
  .handler(async ({ data }): Promise<GeocodedPoint[]> => {
    const token = process.env.MAPBOX_PUBLIC_TOKEN;
    if (!token) return [];

    const out: GeocodedPoint[] = [];
    await Promise.all(
      data.items.map(async (it) => {
        const params = new URLSearchParams({
          access_token: token,
          limit: "1",
          language: "de",
          types: "address,place,postcode,locality",
        });
        if (it.country) params.set("country", it.country);
        const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
          it.query,
        )}.json?${params.toString()}`;
        try {
          const res = await fetch(url);
          if (!res.ok) return;
          const json = (await res.json()) as any;
          const f = json.features?.[0];
          if (!f?.center) return;
          out.push({ id: it.id, longitude: f.center[0], latitude: f.center[1] });
        } catch {
          /* ignore */
        }
      }),
    );
    return out;
  });

export const searchAddress = createServerFn({ method: "GET" })
  .inputValidator((data) =>
    z
      .object({
        q: z.string().min(2),
        country: z.string().optional(),
        language: z.string().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }): Promise<AddressSuggestion[]> => {
    const token = process.env.MAPBOX_PUBLIC_TOKEN;
    if (!token) return [];

    const params = new URLSearchParams({
      access_token: token,
      autocomplete: "true",
      limit: "6",
      language: data.language ?? "de",
      types: "address,place,postcode,locality,neighborhood",
    });
    if (data.country) params.set("country", data.country);

    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
      data.q,
    )}.json?${params.toString()}`;

    const res = await fetch(url);
    if (!res.ok) return [];
    const json = (await res.json()) as any;

    return (json.features ?? []).map((f: any): AddressSuggestion => {
      const ctx: any[] = f.context ?? [];
      const find = (prefix: string) =>
        ctx.find((c) => typeof c.id === "string" && c.id.startsWith(prefix));
      const postcode = find("postcode")?.text ?? "";
      const place = find("place")?.text ?? find("locality")?.text ?? "";
      const country = find("country");
      const street =
        f.place_type?.[0] === "address"
          ? `${f.text ?? ""}${f.address ? " " + f.address : ""}`.trim()
          : f.text ?? "";
      const [lng, lat] = f.center ?? [null, null];
      return {
        id: f.id,
        label: f.place_name,
        street,
        postal_code: postcode,
        city: place,
        country: country?.text ?? "",
        country_code: (country?.short_code ?? "").toUpperCase(),
        longitude: lng,
        latitude: lat,
      };
    });
  });
