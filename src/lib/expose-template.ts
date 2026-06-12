/**
 * Exposé HTML generator.
 * Produces a self-contained, print/PDF-ready HTML document with inline styles.
 *
 * Each "family" (classic / modern / luxury) has its own multi-page layout:
 *   - classic       → half-page hero, striped tables, conservative typography
 *   - modern        → full-bleed hero, large KPI grid, minimal lines
 *   - luxury        → editorial magazine, serif, gold double-lines, cream paper
 *
 * Landscape templates (panorama, editorial-land, urban-land) reuse the family
 * renderer but in 297×210 page geometry with reflowed grids.
 *
 * Pure function: no React. Reusable by server-side PDF renderers.
 */

export type ExposeFamily = "classic" | "modern" | "luxury";

export interface ExposeData {
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
  facts: Array<{ label: string; value: string }>;
  cover_url?: string | null;
  gallery_urls: string[];
  gallery_cols?: number;
  static_map_url?: string | null;
  pois?: Array<{ name: string; category: string; distance_m: number }>;
  attachment_image_urls?: string[];
  attachment_doc_names?: string[];
  agency_name?: string | null;
  contact_name?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  generated_on?: string;
}

export interface ExposeTheme {
  primary: string;
  accent: string;
  pageBg: string;
  titleFont: string;
  bodyFont: string;
  orientation?: "portrait" | "landscape";
  templateLabel?: string;
  family?: ExposeFamily;
}


const fmtCHF = (v: number) =>
  new Intl.NumberFormat("de-CH", { style: "currency", currency: "CHF", maximumFractionDigits: 0 }).format(v);

function esc(str: string | null | undefined): string {
  if (str == null) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function priceBlock(d: ExposeData) {
  if (d.price) return { kicker: `${d.listing_type_label ?? ""}preis`, value: fmtCHF(d.price) };
  if (d.rent) return { kicker: "Miete", value: `${fmtCHF(d.rent)} / Mt.` };
  return null;
}

function addressLine(d: ExposeData) {
  return [d.address, [d.postal_code, d.city].filter(Boolean).join(" ")]
    .filter((p) => p && String(p).trim())
    .join(", ");
}

function pageWrapStart(t: ExposeTheme): string {
  const orient = t.orientation ?? "portrait";
  return `
  @page { size: A4 ${orient}; margin: 0; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { background: ${t.pageBg}; color: ${t.primary}; font-family: ${t.bodyFont}; line-height: 1.55;
    -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  img { display: block; max-width: 100%; }
  .page { width: ${orient === "landscape" ? "297mm" : "210mm"};
          min-height: ${orient === "landscape" ? "210mm" : "297mm"};
          background: ${t.pageBg}; padding: 14mm 16mm; page-break-after: always;
          position: relative; overflow: hidden; }
  .page:last-child { page-break-after: auto; }
  h1, h2, h3 { font-family: ${t.titleFont}; color: ${t.primary}; font-weight: 700; }
  .muted { opacity: 0.65; }
  .footer { position: absolute; left: 16mm; right: 16mm; bottom: 8mm;
            display: flex; justify-content: space-between; font-size: 9px;
            opacity: 0.55; letter-spacing: 0.12em; text-transform: uppercase; }
  `;
}

function footer(d: ExposeData, t: ExposeTheme, page: number, total: number): string {
  return `<div class="footer">
    <span>${esc(d.agency_name ?? "ASIMO Real Estate")} · ${esc(t.templateLabel ?? "")}</span>
    <span>${esc(d.title)}</span>
    <span>${page} / ${total}</span>
  </div>`;
}

const POI_ICONS: Record<string, string> = {
  transit: "🚆", school: "🎓", shop: "🛒", restaurant: "🍽",
  park: "🌳", health: "➕", other: "📍",
};

function locationBlockHtml(d: ExposeData, t: ExposeTheme): string {
  const addr = addressLine(d);
  const hasMap = !!d.static_map_url;
  const pois = d.pois ?? [];
  if (!hasMap && !pois.length && !addr) return "";
  const mapImg = hasMap
    ? `<div class="loc-map"><img src="${esc(d.static_map_url!)}" alt="Karte"/></div>`
    : "";
  const poiList = pois.length
    ? `<ul class="loc-pois">${pois
        .map(
          (p) => `<li><span class="poi-ic">${POI_ICONS[p.category] ?? "📍"}</span>
        <span class="poi-name">${esc(p.name)}</span>
        <span class="poi-dist">${p.distance_m < 1000 ? `${p.distance_m} m` : `${(p.distance_m / 1000).toFixed(1)} km`}</span></li>`,
        )
        .join("")}</ul>`
    : "";
  return `
    ${addr ? `<p class="loc-addr">${esc(addr)}</p>` : ""}
    <div class="loc-grid">
      ${mapImg}
      <div class="loc-side">
        ${pois.length ? `<h3 class="loc-h3">In der Nähe</h3>${poiList}` : ""}
      </div>
    </div>
  `;
}

const LOCATION_CSS = (t: ExposeTheme) => `
  .loc-addr { font-size: 12pt; margin: 0 0 6mm; opacity: 0.85; }
  .loc-grid { display: grid; grid-template-columns: 1.4fr 1fr; gap: 6mm; align-items: start; }
  .loc-map { aspect-ratio: 5 / 3; overflow: hidden; border-radius: 3px; border: 1px solid ${t.primary}22; background: ${t.accent}10; }
  .loc-map img { width: 100%; height: 100%; object-fit: cover; }
  .loc-h3 { font-size: 10pt; letter-spacing: 0.22em; text-transform: uppercase; color: ${t.accent}; margin-bottom: 4mm; }
  .loc-pois { list-style: none; padding: 0; margin: 0; font-size: 11pt; }
  .loc-pois li { display: grid; grid-template-columns: 18px 1fr auto; gap: 6px; align-items: baseline;
    padding: 4px 0; border-bottom: 1px dotted ${t.primary}30; }
  .poi-dist { font-weight: 700; color: ${t.accent}; font-size: 10pt; }
  .attach-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 4mm; }
  .attach-cell { aspect-ratio: 4 / 3; overflow: hidden; background: ${t.accent}10; border-radius: 2px; }
  .attach-cell img { width: 100%; height: 100%; object-fit: cover; }
  .attach-list { list-style: none; padding: 0; font-size: 11pt; }
  .attach-list li { padding: 6px 0; border-bottom: 1px solid ${t.primary}22; display: flex; gap: 8px; align-items: center; }
  .attach-list li::before { content: "📎"; }
`;

function attachmentsPages(d: ExposeData, t: ExposeTheme, headerHtml: (label: string) => string, startPage: number): string[] {
  const imgs = d.attachment_image_urls ?? [];
  const docs = d.attachment_doc_names ?? [];
  const out: string[] = [];
  for (let i = 0; i < imgs.length; i += 4) {
    const slice = imgs.slice(i, i + 4);
    out.push(`
    <div class="page">
      ${headerHtml("Anhänge · Fotos")}
      <div class="attach-grid">
        ${slice.map((u) => `<div class="attach-cell"><img src="${esc(u)}" alt=""/></div>`).join("")}
      </div>
      ${footer(d, t, startPage + out.length, 0)}
    </div>`);
  }
  if (docs.length) {
    out.push(`
    <div class="page">
      ${headerHtml("Anhänge · Dokumente")}
      <ul class="attach-list">
        ${docs.map((n) => `<li>${esc(n)}</li>`).join("")}
      </ul>
      ${footer(d, t, startPage + out.length, 0)}
    </div>`);
  }
  return out;
}



/* ============================================================
   CLASSIC family
   Half-page hero, striped tables, blue accent rules.
   ============================================================ */
function renderClassic(d: ExposeData, t: ExposeTheme): string {
  const pb = priceBlock(d);
  const addr = addressLine(d);
  const facts = d.facts.filter((f) => f.value && f.value !== "—");
  const orient = t.orientation ?? "portrait";
  const galleryCols = d.gallery_cols ?? (orient === "landscape" ? 3 : 2);
  const galleryUrls = d.gallery_urls;


  const pages: string[] = [];

  // Page 1: cover
  pages.push(`
  <div class="page cover">
    <div class="cover-hero">
      ${d.cover_url ? `<img src="${esc(d.cover_url)}" alt="" />` : `<div class="hero-fallback"></div>`}
      <div class="hero-tint"></div>
      <div class="hero-meta">
        <div class="brand-mark">${esc(d.agency_name ?? "ASIMO")}</div>
        <div class="kicker">${esc(t.templateLabel ?? "Exposé")}</div>
      </div>
    </div>
    <div class="cover-body">
      <div class="cover-badges">
        ${d.property_type_label ? `<span class="badge">${esc(d.property_type_label)}</span>` : ""}
        ${d.listing_type_label ? `<span class="badge ghost">${esc(d.listing_type_label)}</span>` : ""}
      </div>
      <h1 class="cover-title">${esc(d.title)}</h1>
      ${addr ? `<div class="cover-address">${esc(addr)}</div>` : ""}
      ${pb ? `<div class="cover-price"><span class="kicker">${esc(pb.kicker)}</span><span class="price-value">${esc(pb.value)}</span></div>` : ""}
    </div>
    ${footer(d, t, 1, 0)}
  </div>`);

  // Page 2: facts + description
  pages.push(`
  <div class="page">
    <header class="ph">
      <div class="ph-l">${esc(d.title)}</div>
      <div class="ph-r">${esc(d.generated_on ?? "")}</div>
    </header>
    <h2 class="section-title">Eckdaten</h2>
    <table class="facts-table">
      <tbody>
        ${facts.map((f, i) => `<tr class="${i % 2 ? "alt" : ""}"><td class="lbl">${esc(f.label)}</td><td class="val">${esc(f.value)}</td></tr>`).join("")}
      </tbody>
    </table>
    ${d.description ? `<h2 class="section-title mt">Objektbeschreibung</h2><p class="prose">${esc(d.description)}</p>` : ""}
    ${(d.features ?? []).length ? `<h2 class="section-title mt">Ausstattung</h2><ul class="bullets">${(d.features ?? []).map((f) => `<li>${esc(f)}</li>`).join("")}</ul>` : ""}
    ${footer(d, t, 2, 0)}
  </div>`);

  // Page 3+: gallery (paginated by chosen layout)
  if (galleryUrls.length) {
    const perPage = galleryCols * (galleryCols >= 3 ? 3 : 2);
    for (let i = 0; i < galleryUrls.length; i += perPage) {
      const slice = galleryUrls.slice(i, i + perPage);
      pages.push(`
      <div class="page">
        <header class="ph"><div class="ph-l">${esc(d.title)}</div><div class="ph-r">Galerie</div></header>
        <h2 class="section-title">Bilder</h2>
        <div class="gallery" style="grid-template-columns: repeat(${galleryCols}, 1fr);">
          ${slice.map((u) => `<div class="g-cell"><img src="${esc(u)}" alt=""/></div>`).join("")}
        </div>
        ${footer(d, t, pages.length + 1, 0)}
      </div>`);
    }
  }

  // Location + contact
  const locHtml = locationBlockHtml(d, t);
  if (locHtml || d.contact_name || d.contact_email || d.contact_phone) {
    pages.push(`
    <div class="page">
      <header class="ph"><div class="ph-l">${esc(d.title)}</div><div class="ph-r">Lage & Kontakt</div></header>
      ${locHtml ? `<h2 class="section-title">Lage</h2>${locHtml}` : ""}
      ${(d.contact_name || d.contact_email || d.contact_phone)
        ? `<h2 class="section-title mt">Kontakt</h2>
           <div class="contact-card">
             ${d.agency_name ? `<div class="c-agency">${esc(d.agency_name)}</div>` : ""}
             ${d.contact_name ? `<div class="c-name">${esc(d.contact_name)}</div>` : ""}
             <div class="c-meta">
               ${d.contact_email ? `<span>✉ ${esc(d.contact_email)}</span>` : ""}
               ${d.contact_phone ? `<span>☎ ${esc(d.contact_phone)}</span>` : ""}
             </div>
           </div>`
        : ""}
      ${footer(d, t, pages.length + 1, 0)}
    </div>`);
  }

  // Attachments
  const attachPages = attachmentsPages(
    d, t,
    (label: string) => `<header class="ph"><div class="ph-l">${esc(d.title)}</div><div class="ph-r">${esc(label)}</div></header><h2 class="section-title">${esc(label)}</h2>`,
    pages.length + 1,
  );
  pages.push(...attachPages);

  if (attach.html) pages.push(attach.html);


  const total = pages.length;
  const filled = pages.map((p, i) => p.replace(`${i + 1} / 0`, `${i + 1} / ${total}`));

  const css = `
    ${pageWrapStart(t)}
    .cover { padding: 0; }
    .cover-hero { position: relative; width: 100%; height: ${orient === "landscape" ? "55%" : "58%"}; overflow: hidden; background: ${t.primary}; }
    .cover-hero img { width: 100%; height: 100%; object-fit: cover; }
    .hero-fallback { width: 100%; height: 100%; background: linear-gradient(135deg, ${t.primary}, ${t.accent}); }
    .hero-tint { position: absolute; inset: 0; background: linear-gradient(180deg, rgba(0,0,0,0) 50%, rgba(0,0,0,0.55) 100%); }
    .hero-meta { position: absolute; left: 16mm; top: 12mm; right: 16mm; color: #fff; display: flex; align-items: center; justify-content: space-between; }
    .brand-mark { font-family: ${t.titleFont}; font-weight: 700; font-size: 14pt; letter-spacing: 0.04em; }
    .kicker { font-size: 9pt; letter-spacing: 0.28em; text-transform: uppercase; color: ${t.accent}; font-weight: 700; }
    .cover-body { padding: 14mm 16mm; position: relative; }
    .cover-body::before { content: ""; position: absolute; left: 16mm; top: 6mm; width: 32mm; height: 3px; background: ${t.accent}; }
    .cover-badges { display: flex; gap: 8px; margin-bottom: 8mm; }
    .badge { font-size: 9pt; padding: 4px 12px; border-radius: 999px; background: ${t.primary}; color: ${t.pageBg}; font-weight: 600; letter-spacing: 0.04em; }
    .badge.ghost { background: transparent; color: ${t.primary}; border: 1px solid ${t.primary}; }
    .cover-title { font-size: 32pt; line-height: 1.05; letter-spacing: -0.01em; }
    .cover-address { margin-top: 6mm; font-size: 12pt; opacity: 0.7; }
    .cover-price { margin-top: 10mm; display: flex; flex-direction: column; gap: 4px; }
    .price-value { font-family: ${t.titleFont}; font-size: 26pt; font-weight: 700; }
    .ph { display: flex; justify-content: space-between; padding-bottom: 6mm; border-bottom: 2px solid ${t.accent}; margin-bottom: 8mm;
          font-size: 9pt; text-transform: uppercase; letter-spacing: 0.18em; }
    .ph-l { font-weight: 700; color: ${t.primary}; }
    .ph-r { opacity: 0.6; }
    .section-title { font-size: 16pt; margin-bottom: 4mm; padding-bottom: 2mm; border-bottom: 1px solid ${t.accent}; }
    .section-title.mt { margin-top: 10mm; }
    .facts-table { width: 100%; border-collapse: collapse; font-size: 11pt; }
    .facts-table tr.alt { background: ${t.accent}10; }
    .facts-table td { padding: 8px 12px; border-bottom: 1px solid rgba(0,0,0,0.08); }
    .facts-table td.lbl { width: 38%; color: ${t.primary}; opacity: 0.7; text-transform: uppercase; letter-spacing: 0.1em; font-size: 9pt; }
    .facts-table td.val { font-weight: 600; }
    .prose { font-size: 11pt; line-height: 1.7; white-space: pre-wrap; opacity: 0.9; }
    .bullets { columns: 2; column-gap: 24px; list-style: none; font-size: 11pt; }
    .bullets li { padding: 4px 0 4px 16px; position: relative; break-inside: avoid; }
    .bullets li::before { content: ""; position: absolute; left: 0; top: 10px; width: 6px; height: 6px; background: ${t.accent}; border-radius: 999px; }
    .gallery { display: grid; gap: 4mm; }
    .g-cell { aspect-ratio: 4 / 3; overflow: hidden; border-radius: 2px; background: rgba(0,0,0,0.05); }
    .g-cell img { width: 100%; height: 100%; object-fit: cover; }
    .contact-card { background: ${t.primary}; color: ${t.pageBg}; padding: 10mm; border-radius: 3px; border-top: 4px solid ${t.accent}; }
    .c-agency { font-size: 9pt; letter-spacing: 0.22em; text-transform: uppercase; color: ${t.accent}; margin-bottom: 4mm; }
    .c-name { font-family: ${t.titleFont}; font-size: 18pt; margin-bottom: 4mm; }
    .c-meta { display: flex; gap: 20mm; font-size: 11pt; flex-wrap: wrap; }
  `;
  return wrapHtml(d, css, filled.join("\n"));
}

/* ============================================================
   MODERN family
   Full-bleed hero, KPI tiles, minimal rules, generous spacing.
   ============================================================ */
function renderModern(d: ExposeData, t: ExposeTheme): string {
  const pb = priceBlock(d);
  const addr = addressLine(d);
  const facts = d.facts.filter((f) => f.value && f.value !== "—");
  const orient = t.orientation ?? "portrait";
  const kpiCols = orient === "landscape" ? 6 : 3;
  const galleryCols = orient === "landscape" ? 4 : 2;
  const galleryUrls = d.gallery_urls.slice(0, orient === "landscape" ? 8 : 6);

  const pages: string[] = [];

  // Page 1: full-bleed cover with overlay
  pages.push(`
  <div class="page cover-modern">
    ${d.cover_url ? `<img class="bleed-img" src="${esc(d.cover_url)}" alt=""/>` : `<div class="bleed-fallback"></div>`}
    <div class="bleed-shade"></div>
    <div class="cover-top">
      <div class="brand-pill">${esc(d.agency_name ?? "ASIMO")}</div>
      <div class="cover-meta">${esc(d.generated_on ?? "")} · ${esc(t.templateLabel ?? "")}</div>
    </div>
    <div class="cover-bottom">
      ${d.property_type_label ? `<div class="cover-eyebrow">${esc(d.property_type_label)}${d.listing_type_label ? ` · ${esc(d.listing_type_label)}` : ""}</div>` : ""}
      <h1 class="cover-h1">${esc(d.title)}</h1>
      ${addr ? `<div class="cover-addr">${esc(addr)}</div>` : ""}
      ${pb ? `<div class="cover-price-row"><span class="p-kicker">${esc(pb.kicker)}</span><span class="p-val">${esc(pb.value)}</span></div>` : ""}
    </div>
  </div>`);

  // Page 2: KPI + description
  pages.push(`
  <div class="page">
    <header class="ph"><div>${esc(d.title)}</div><div class="muted">Übersicht</div></header>
    ${facts.length ? `<div class="kpis" style="grid-template-columns: repeat(${kpiCols}, 1fr);">
      ${facts.slice(0, kpiCols * 2).map((f) => `<div class="kpi"><div class="kpi-v">${esc(f.value)}</div><div class="kpi-l">${esc(f.label)}</div></div>`).join("")}
    </div>` : ""}
    ${d.description ? `<h2 class="sec">Über das Objekt</h2><p class="lead">${esc(d.description)}</p>` : ""}
    ${(d.features ?? []).length ? `<h2 class="sec">Ausstattung</h2><div class="chips">${(d.features ?? []).map((f) => `<span class="chip">${esc(f)}</span>`).join("")}</div>` : ""}
    ${footer(d, t, 2, 0)}
  </div>`);

  if (galleryUrls.length) {
    pages.push(`
    <div class="page">
      <header class="ph"><div>${esc(d.title)}</div><div class="muted">Galerie</div></header>
      <div class="m-gallery" style="grid-template-columns: repeat(${galleryCols}, 1fr);">
        ${galleryUrls.map((u) => `<div class="m-cell"><img src="${esc(u)}" alt=""/></div>`).join("")}
      </div>
      ${footer(d, t, 3, 0)}
    </div>`);
  }

  if (addr || d.contact_name || d.contact_email || d.contact_phone) {
    pages.push(`
    <div class="page">
      <header class="ph"><div>${esc(d.title)}</div><div class="muted">Lage & Kontakt</div></header>
      ${addr ? `<h2 class="sec">Lage</h2><p class="lead">${esc(addr)}</p>` : ""}
      ${(d.contact_name || d.contact_email || d.contact_phone)
        ? `<h2 class="sec">Ihr Ansprechpartner</h2>
           <div class="m-contact">
             <div class="m-contact-l">
               ${d.contact_name ? `<div class="m-contact-name">${esc(d.contact_name)}</div>` : ""}
               ${d.agency_name ? `<div class="m-contact-ag">${esc(d.agency_name)}</div>` : ""}
             </div>
             <div class="m-contact-r">
               ${d.contact_email ? `<div>${esc(d.contact_email)}</div>` : ""}
               ${d.contact_phone ? `<div>${esc(d.contact_phone)}</div>` : ""}
             </div>
           </div>`
        : ""}
      ${footer(d, t, 4, 0)}
    </div>`);
  }

  const total = pages.length;
  const filled = pages.map((p, i) => p.replace(`${i + 1} / 0`, `${i + 1} / ${total}`));

  const css = `
    ${pageWrapStart(t)}
    .cover-modern { padding: 0; color: #fff; }
    .bleed-img, .bleed-fallback { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
    .bleed-fallback { background: linear-gradient(135deg, ${t.primary}, ${t.accent}); }
    .bleed-shade { position: absolute; inset: 0; background: linear-gradient(180deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.1) 35%, rgba(0,0,0,0.85) 100%); }
    .cover-top { position: absolute; top: 12mm; left: 14mm; right: 14mm; display: flex; justify-content: space-between; align-items: center; }
    .brand-pill { background: rgba(255,255,255,0.18); backdrop-filter: blur(6px); padding: 6px 14px; border-radius: 999px;
                   font-family: ${t.titleFont}; font-weight: 700; font-size: 10pt; letter-spacing: 0.06em; }
    .cover-meta { font-size: 9pt; letter-spacing: 0.22em; text-transform: uppercase; opacity: 0.9; }
    .cover-bottom { position: absolute; left: 14mm; right: 14mm; bottom: 16mm; }
    .cover-eyebrow { color: ${t.accent}; font-size: 10pt; font-weight: 700; letter-spacing: 0.3em; text-transform: uppercase; margin-bottom: 6mm; }
    .cover-h1 { color: #fff; font-family: ${t.titleFont}; font-size: 44pt; line-height: 0.98; letter-spacing: -0.02em; }
    .cover-addr { margin-top: 6mm; font-size: 13pt; opacity: 0.85; }
    .cover-price-row { margin-top: 10mm; display: flex; align-items: baseline; gap: 8mm; border-top: 1px solid rgba(255,255,255,0.4); padding-top: 6mm; }
    .p-kicker { font-size: 9pt; letter-spacing: 0.3em; text-transform: uppercase; color: ${t.accent}; }
    .p-val { font-family: ${t.titleFont}; font-size: 28pt; font-weight: 700; }
    .ph { display: flex; justify-content: space-between; font-size: 9pt; letter-spacing: 0.22em; text-transform: uppercase;
          padding-bottom: 6mm; margin-bottom: 8mm; border-bottom: 1px solid ${t.primary}; }
    .ph div:first-child { font-weight: 700; }
    .sec { font-size: 18pt; margin: 10mm 0 4mm; }
    .lead { font-size: 12pt; line-height: 1.7; white-space: pre-wrap; opacity: 0.9; }
    .kpis { display: grid; gap: 4mm; }
    .kpi { padding: 6mm; background: ${t.accent}10; border-left: 3px solid ${t.accent}; border-radius: 2px; }
    .kpi-v { font-family: ${t.titleFont}; font-size: 18pt; font-weight: 700; color: ${t.primary}; }
    .kpi-l { font-size: 9pt; letter-spacing: 0.18em; text-transform: uppercase; opacity: 0.65; margin-top: 2mm; }
    .chips { display: flex; flex-wrap: wrap; gap: 6px; }
    .chip { padding: 4px 12px; border: 1px solid ${t.primary}30; border-radius: 999px; font-size: 10pt; }
    .m-gallery { display: grid; gap: 3mm; }
    .m-cell { aspect-ratio: 1 / 1; overflow: hidden; }
    .m-cell img { width: 100%; height: 100%; object-fit: cover; }
    .m-contact { display: grid; grid-template-columns: 1fr 1fr; gap: 8mm; padding: 10mm; background: ${t.primary}; color: ${t.pageBg}; border-radius: 4px; }
    .m-contact-name { font-family: ${t.titleFont}; font-size: 20pt; font-weight: 700; }
    .m-contact-ag { font-size: 10pt; letter-spacing: 0.2em; text-transform: uppercase; color: ${t.accent}; margin-top: 3mm; }
    .m-contact-r { font-size: 12pt; align-self: end; display: flex; flex-direction: column; gap: 3mm; }
  `;
  return wrapHtml(d, css, filled.join("\n"));
}

/* ============================================================
   LUXURY family
   Editorial magazine: serif typography, gold double rules,
   asymmetric two-column layouts, cream paper.
   ============================================================ */
function renderLuxury(d: ExposeData, t: ExposeTheme): string {
  const pb = priceBlock(d);
  const addr = addressLine(d);
  const facts = d.facts.filter((f) => f.value && f.value !== "—");
  const orient = t.orientation ?? "portrait";
  const galleryCols = orient === "landscape" ? 3 : 2;
  const galleryUrls = d.gallery_urls.slice(0, orient === "landscape" ? 6 : 4);

  const pages: string[] = [];

  // Page 1: editorial cover
  pages.push(`
  <div class="page lx-cover">
    <div class="lx-top">
      <div class="lx-brand">${esc(d.agency_name ?? "ASIMO")}</div>
      <div class="lx-edition">EDITION · ${esc(d.generated_on ?? "")}</div>
    </div>
    <div class="lx-rule double"></div>
    <div class="lx-cover-grid">
      <div class="lx-cover-img">
        ${d.cover_url ? `<img src="${esc(d.cover_url)}" alt=""/>` : `<div class="lx-fallback"></div>`}
      </div>
      <div class="lx-cover-text">
        ${d.property_type_label ? `<div class="lx-kicker">${esc(d.property_type_label)}</div>` : ""}
        <h1 class="lx-title">${esc(d.title)}</h1>
        ${addr ? `<div class="lx-addr">${esc(addr)}</div>` : ""}
        ${pb ? `<div class="lx-price"><span class="lx-pk">${esc(pb.kicker)}</span><span class="lx-pv">${esc(pb.value)}</span></div>` : ""}
      </div>
    </div>
    <div class="lx-rule double bottom"></div>
    <div class="lx-foot-mark">№ ${esc(t.templateLabel ?? "Exposé")}</div>
  </div>`);

  // Page 2: description + facts (asymmetric)
  pages.push(`
  <div class="page">
    <div class="lx-folio"><span>${esc(d.title)}</span><span>02</span></div>
    <div class="lx-rule double"></div>
    <div class="lx-split">
      <div class="lx-split-l">
        <h2 class="lx-h2">Das Objekt</h2>
        ${d.description ? `<p class="lx-prose"><span class="lx-drop">${esc(d.description.charAt(0))}</span>${esc(d.description.slice(1))}</p>` : ""}
      </div>
      <aside class="lx-split-r">
        <h3 class="lx-h3">Eckdaten</h3>
        <dl class="lx-defs">
          ${facts.map((f) => `<div class="lx-def"><dt>${esc(f.label)}</dt><dd>${esc(f.value)}</dd></div>`).join("")}
        </dl>
      </aside>
    </div>
    ${(d.features ?? []).length ? `<h2 class="lx-h2 mt">Ausstattung</h2>
      <ul class="lx-features">${(d.features ?? []).map((f) => `<li>${esc(f)}</li>`).join("")}</ul>` : ""}
    ${footer(d, t, 2, 0)}
  </div>`);

  if (galleryUrls.length) {
    pages.push(`
    <div class="page">
      <div class="lx-folio"><span>${esc(d.title)}</span><span>03</span></div>
      <div class="lx-rule double"></div>
      <h2 class="lx-h2">Impressionen</h2>
      <div class="lx-gal" style="grid-template-columns: repeat(${galleryCols}, 1fr);">
        ${galleryUrls.map((u, i) => `<figure class="lx-gc ${i === 0 ? "feat" : ""}"><img src="${esc(u)}" alt=""/></figure>`).join("")}
      </div>
      ${footer(d, t, 3, 0)}
    </div>`);
  }

  if (addr || d.contact_name || d.contact_email || d.contact_phone) {
    pages.push(`
    <div class="page">
      <div class="lx-folio"><span>${esc(d.title)}</span><span>04</span></div>
      <div class="lx-rule double"></div>
      ${addr ? `<h2 class="lx-h2">Lage</h2><p class="lx-prose">${esc(addr)}</p>` : ""}
      ${(d.contact_name || d.contact_email || d.contact_phone)
        ? `<h2 class="lx-h2 mt">Kontakt</h2>
           <div class="lx-contact">
             ${d.agency_name ? `<div class="lx-c-ag">${esc(d.agency_name)}</div>` : ""}
             ${d.contact_name ? `<div class="lx-c-name">${esc(d.contact_name)}</div>` : ""}
             <div class="lx-c-meta">
               ${d.contact_email ? `<div>${esc(d.contact_email)}</div>` : ""}
               ${d.contact_phone ? `<div>${esc(d.contact_phone)}</div>` : ""}
             </div>
           </div>` : ""}
      ${footer(d, t, 4, 0)}
    </div>`);
  }

  const total = pages.length;
  const filled = pages.map((p, i) => p.replace(`${i + 1} / 0`, `${i + 1} / ${total}`));

  const css = `
    ${pageWrapStart(t)}
    .lx-cover { padding: 16mm 18mm; }
    .lx-top { display: flex; justify-content: space-between; align-items: baseline; font-size: 10pt;
              letter-spacing: 0.3em; text-transform: uppercase; }
    .lx-brand { font-family: ${t.titleFont}; font-weight: 700; font-size: 14pt; letter-spacing: 0.18em; }
    .lx-edition { color: ${t.accent}; font-weight: 700; }
    .lx-rule { height: 4px; border-top: 1px solid ${t.accent}; border-bottom: 1px solid ${t.accent}; margin: 6mm 0; }
    .lx-rule.bottom { margin-top: 10mm; }
    .lx-cover-grid { display: grid; grid-template-columns: ${orient === "landscape" ? "1fr 1.2fr" : "1fr"}; gap: 10mm; margin-top: 8mm; }
    .lx-cover-img { aspect-ratio: ${orient === "landscape" ? "3 / 4" : "16 / 10"}; overflow: hidden; }
    .lx-cover-img img { width: 100%; height: 100%; object-fit: cover; filter: saturate(0.9) contrast(1.05); }
    .lx-fallback { width: 100%; height: 100%; background: linear-gradient(135deg, ${t.primary}, ${t.accent}); }
    .lx-cover-text { padding-top: 4mm; }
    .lx-kicker { font-size: 9pt; letter-spacing: 0.32em; text-transform: uppercase; color: ${t.accent}; font-weight: 700; margin-bottom: 6mm; }
    .lx-title { font-family: ${t.titleFont}; font-size: 40pt; line-height: 1.04; font-style: italic; font-weight: 600; }
    .lx-addr { margin-top: 6mm; font-family: ${t.titleFont}; font-size: 13pt; font-style: italic; opacity: 0.75; }
    .lx-price { margin-top: 10mm; padding-top: 6mm; border-top: 1px solid ${t.primary}30; display: flex; justify-content: space-between; align-items: baseline; }
    .lx-pk { font-size: 9pt; letter-spacing: 0.28em; text-transform: uppercase; color: ${t.accent}; }
    .lx-pv { font-family: ${t.titleFont}; font-size: 24pt; font-weight: 700; }
    .lx-foot-mark { position: absolute; bottom: 10mm; left: 18mm; right: 18mm; text-align: center;
                    font-family: ${t.titleFont}; font-style: italic; color: ${t.accent}; letter-spacing: 0.2em; font-size: 10pt; }
    .lx-folio { display: flex; justify-content: space-between; font-family: ${t.titleFont}; font-style: italic; font-size: 10pt; opacity: 0.7; }
    .lx-h2 { font-family: ${t.titleFont}; font-size: 22pt; font-weight: 700; font-style: italic; margin: 6mm 0 4mm; }
    .lx-h2.mt { margin-top: 10mm; }
    .lx-h3 { font-size: 10pt; letter-spacing: 0.28em; text-transform: uppercase; color: ${t.accent}; margin-bottom: 4mm; font-family: ${t.bodyFont}; }
    .lx-split { display: grid; grid-template-columns: ${orient === "landscape" ? "1.4fr 1fr" : "1.4fr 1fr"}; gap: 10mm; }
    .lx-prose { font-size: 12pt; line-height: 1.75; white-space: pre-wrap; column-fill: balance; }
    .lx-drop { font-family: ${t.titleFont}; font-size: 38pt; line-height: 0.9; float: left; padding: 4px 8px 0 0; color: ${t.accent}; font-weight: 700; }
    .lx-defs { display: flex; flex-direction: column; }
    .lx-def { display: flex; justify-content: space-between; padding: 5px 0; border-bottom: 1px dotted ${t.primary}40; font-size: 11pt; }
    .lx-def dt { opacity: 0.7; font-family: ${t.bodyFont}; }
    .lx-def dd { font-weight: 700; font-family: ${t.titleFont}; }
    .lx-features { columns: 2; column-gap: 24px; list-style: none; font-size: 11pt; font-family: ${t.titleFont}; font-style: italic; }
    .lx-features li { padding: 4px 0 4px 14px; position: relative; break-inside: avoid; }
    .lx-features li::before { content: "—"; position: absolute; left: 0; color: ${t.accent}; }
    .lx-gal { display: grid; gap: 4mm; }
    .lx-gc { aspect-ratio: 4 / 5; overflow: hidden; }
    .lx-gc.feat { grid-column: span ${galleryCols > 1 ? 2 : 1}; aspect-ratio: ${orient === "landscape" ? "16 / 9" : "4 / 3"}; }
    .lx-gc img { width: 100%; height: 100%; object-fit: cover; filter: saturate(0.92); }
    .lx-contact { padding: 10mm; border: 1px solid ${t.accent}; border-top-width: 3px; }
    .lx-c-ag { font-size: 9pt; letter-spacing: 0.3em; text-transform: uppercase; color: ${t.accent}; margin-bottom: 4mm; }
    .lx-c-name { font-family: ${t.titleFont}; font-size: 22pt; font-style: italic; font-weight: 700; margin-bottom: 4mm; }
    .lx-c-meta { display: flex; gap: 12mm; font-size: 11pt; flex-wrap: wrap; }
  `;
  return wrapHtml(d, css, filled.join("\n"));
}

function wrapHtml(d: ExposeData, css: string, body: string): string {
  return `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8" />
<title>${esc(d.title)} – Exposé</title>
<style>${css}</style>
</head>
<body>
${body}
</body>
</html>`;
}

/** Family detection from template id (when caller does not pass theme.family). */
function familyFromTemplate(label?: string): ExposeFamily {
  const l = (label ?? "").toLowerCase();
  if (l.includes("luxury") || l.includes("pastell") || l.includes("editorial")) return "luxury";
  if (l.includes("modern") || l.includes("studio") || l.includes("panorama")) return "modern";
  return "classic";
}

export function renderExposeHTML(d: ExposeData, theme?: ExposeTheme): string {
  const t: ExposeTheme = theme ?? {
    primary: "#14110f",
    accent: "#2563EB",
    pageBg: "#FFFFFF",
    titleFont: "Georgia, 'Times New Roman', serif",
    bodyFont: "'Helvetica Neue', Arial, sans-serif",
    orientation: "portrait",
  };
  const family = t.family ?? familyFromTemplate(t.templateLabel);
  switch (family) {
    case "luxury":
      return renderLuxury(d, t);
    case "modern":
      return renderModern(d, t);
    case "classic":
    default:
      return renderClassic(d, t);
  }
}
