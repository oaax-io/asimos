/**
 * Exposé HTML generator.
 * Produces a self-contained, print/PDF-ready HTML document with inline styles.
 * Architecture: pure function so it can be reused later by a server-side
 * PDF renderer (e.g. Puppeteer/Playwright) without React dependencies.
 */

export interface ExposeData {
  // Property
  title: string;
  description?: string | null;
  address?: string | null;
  postal_code?: string | null;
  city?: string | null;
  property_type_label?: string | null;
  listing_type_label?: string | null;
  price?: number | null;
  rent?: number | null;
  features?: string[] | null;

  // Selected facts (only those marked visible are rendered)
  facts: Array<{ label: string; value: string }>;

  // Media
  cover_url?: string | null;
  gallery_urls: string[];

  // Branding / contact
  agency_name?: string | null;
  contact_name?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;

  // Meta
  generated_on?: string;
}

const fmtCHF = (v: number) =>
  new Intl.NumberFormat("de-CH", { style: "currency", currency: "CHF", maximumFractionDigits: 0 }).format(v);

function escape(str: string | null | undefined): string {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function renderExposeHTML(d: ExposeData): string {
  const priceLine = d.price
    ? `<div><div class="kicker">${escape(d.listing_type_label ?? "")}preis</div><div class="price">${fmtCHF(d.price)}</div></div>`
    : d.rent
    ? `<div><div class="kicker">Miete</div><div class="price">${fmtCHF(d.rent)} / Mt.</div></div>`
    : "";

  const addressLine = [d.address, [d.postal_code, d.city].filter(Boolean).join(" ")]
    .filter((p) => p && String(p).trim())
    .join(", ");

  const factCards = d.facts
    .filter((f) => f.value && f.value !== "—")
    .map(
      (f) => `
      <div class="fact">
        <div class="fact-label">${escape(f.label)}</div>
        <div class="fact-value">${escape(f.value)}</div>
      </div>`,
    )
    .join("");

  const galleryHTML = d.gallery_urls
    .map(
      (url) => `
      <div class="gallery-item"><img src="${escape(url)}" alt="" /></div>`,
    )
    .join("");

  const featuresHTML = (d.features ?? [])
    .map((f) => `<li>${escape(f)}</li>`)
    .join("");

  const contactHTML =
    d.contact_name || d.contact_email || d.contact_phone
      ? `
    <section class="contact">
      <h2>Kontakt</h2>
      <div class="contact-card">
        ${d.agency_name ? `<div class="contact-agency">${escape(d.agency_name)}</div>` : ""}
        ${d.contact_name ? `<div class="contact-name">${escape(d.contact_name)}</div>` : ""}
        <div class="contact-meta">
          ${d.contact_email ? `<span>✉ ${escape(d.contact_email)}</span>` : ""}
          ${d.contact_phone ? `<span>☎ ${escape(d.contact_phone)}</span>` : ""}
        </div>
      </div>
    </section>`
      : "";

  return `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8" />
<title>${escape(d.title)} – Exposé</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { background: #f5f3ef; color: #14110f; font-family: 'Helvetica Neue', Arial, sans-serif; line-height: 1.55; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .page { max-width: 880px; margin: 0 auto; padding: 56px 64px; background: #ffffff; }
  .header { display: flex; align-items: center; justify-content: space-between; padding-bottom: 24px; border-bottom: 1px solid #e5e1d8; margin-bottom: 40px; }
  .brand { font-family: Georgia, 'Times New Roman', serif; font-size: 20px; font-weight: 700; letter-spacing: 0.02em; }
  .brand-sub { font-size: 11px; color: #8a857c; text-transform: uppercase; letter-spacing: 0.18em; margin-top: 2px; }
  .meta { font-size: 11px; color: #8a857c; text-transform: uppercase; letter-spacing: 0.16em; }
  .cover { width: 100%; aspect-ratio: 16 / 10; overflow: hidden; border-radius: 4px; background: #ece9e2; margin-bottom: 36px; }
  .cover img { width: 100%; height: 100%; object-fit: cover; display: block; }
  h1.title { font-family: Georgia, 'Times New Roman', serif; font-size: 40px; line-height: 1.1; font-weight: 700; letter-spacing: -0.01em; }
  .address { margin-top: 10px; color: #6e6a62; font-size: 15px; }
  .price-row { display: flex; align-items: flex-end; justify-content: space-between; margin: 32px 0; padding: 24px 0; border-top: 1px solid #e5e1d8; border-bottom: 1px solid #e5e1d8; }
  .kicker { font-size: 10px; text-transform: uppercase; letter-spacing: 0.2em; color: #8a857c; margin-bottom: 6px; }
  .price { font-family: Georgia, 'Times New Roman', serif; font-size: 32px; font-weight: 700; }
  .type-badge { font-size: 12px; color: #14110f; padding: 6px 14px; border: 1px solid #14110f; border-radius: 999px; }
  .facts { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 40px; }
  .fact { background: #f5f3ef; padding: 16px; border-radius: 4px; }
  .fact-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.16em; color: #8a857c; margin-bottom: 4px; }
  .fact-value { font-size: 16px; font-weight: 600; }
  section { margin-bottom: 40px; page-break-inside: avoid; }
  h2 { font-family: Georgia, 'Times New Roman', serif; font-size: 22px; font-weight: 700; margin-bottom: 14px; padding-bottom: 8px; border-bottom: 1px solid #e5e1d8; }
  .description { font-size: 14px; color: #36322c; white-space: pre-wrap; }
  .features { columns: 2; column-gap: 32px; list-style: none; font-size: 14px; }
  .features li { padding: 6px 0 6px 18px; position: relative; break-inside: avoid; }
  .features li::before { content: ""; position: absolute; left: 0; top: 14px; width: 6px; height: 6px; background: #14110f; border-radius: 999px; }
  .gallery { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .gallery-item { aspect-ratio: 4 / 3; overflow: hidden; border-radius: 4px; background: #ece9e2; }
  .gallery-item img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .contact-card { background: #14110f; color: #f5f3ef; padding: 28px; border-radius: 4px; }
  .contact-agency { font-size: 11px; text-transform: uppercase; letter-spacing: 0.2em; color: #b3aea4; margin-bottom: 8px; }
  .contact-name { font-family: Georgia, serif; font-size: 22px; font-weight: 700; margin-bottom: 14px; }
  .contact-meta { display: flex; gap: 24px; font-size: 14px; flex-wrap: wrap; }
  .footer { margin-top: 48px; padding-top: 18px; border-top: 1px solid #e5e1d8; text-align: center; font-size: 11px; color: #8a857c; letter-spacing: 0.06em; }
  @page { size: A4; margin: 16mm; }
  @media print { body { background: #fff; } .page { padding: 0; max-width: none; } }
</style>
</head>
<body>
  <div class="page">
    <header class="header">
      <div>
        <div class="brand">${escape(d.agency_name ?? "ASIMO Real Estate")}</div>
        <div class="brand-sub">Immobilienexposé</div>
      </div>
      <div class="meta">${escape(d.generated_on ?? new Date().toLocaleDateString("de-CH"))}</div>
    </header>

    ${d.cover_url ? `<div class="cover"><img src="${escape(d.cover_url)}" alt="${escape(d.title)}" /></div>` : ""}

    <h1 class="title">${escape(d.title)}</h1>
    ${addressLine ? `<p class="address">${escape(addressLine)}</p>` : ""}

    <div class="price-row">
      ${priceLine}
      ${d.property_type_label ? `<div class="type-badge">${escape(d.property_type_label)}</div>` : ""}
    </div>

    ${factCards ? `<div class="facts">${factCards}</div>` : ""}

    ${d.description ? `<section><h2>Objektbeschreibung</h2><p class="description">${escape(d.description)}</p></section>` : ""}

    ${featuresHTML ? `<section><h2>Ausstattung</h2><ul class="features">${featuresHTML}</ul></section>` : ""}

    ${galleryHTML ? `<section><h2>Galerie</h2><div class="gallery">${galleryHTML}</div></section>` : ""}

    ${addressLine ? `<section><h2>Lage</h2><p class="description">${escape(addressLine)}</p></section>` : ""}

    ${contactHTML}

    <div class="footer">Erstellt mit ASIMO Real Estate · Alle Angaben ohne Gewähr.</div>
  </div>
</body>
</html>`;
}
