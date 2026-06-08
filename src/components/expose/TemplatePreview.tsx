import { useState } from "react";
import {
  ZoomIn, ZoomOut, Maximize2,
  MapPin, TrainFront, ShoppingBag, GraduationCap, TreePine, Utensils,
  Bed, Bath, Maximize as MaxIcon, Home, Building2,
} from "lucide-react";
import type { ExposeSections, ExposeTemplate, GalerieLayout } from "@/hooks/use-pdf-download";


export type TemplateMeta = {
  id: ExposeTemplate;
  label: string;
  description: string;
  family: "classic" | "modern" | "luxury";
  orientation: "portrait" | "landscape";
  primary: string;
  accent: string;
  titleFont: string;
  bodyFont: string;
  pageBg: string;
};

const HELV = "'Helvetica Neue', Arial, sans-serif";
const SERIF = "'Cormorant Garamond', 'Times New Roman', serif";

export const TEMPLATES: TemplateMeta[] = [
  // --- Original 3 (Hochformat) ---
  {
    id: "classic", label: "Classic", family: "classic", orientation: "portrait",
    description: "Dunkles Navy, halbseitiger Hero, gestreifte Tabellen.",
    primary: "#1a1a2e", accent: "#2563EB",
    titleFont: HELV, bodyFont: HELV, pageBg: "#FFFFFF",
  },
  {
    id: "modern", label: "Modern", family: "modern", orientation: "portrait",
    description: "Full-bleed Hero, KPI-Blöcke, plain Tabellen, große Typo.",
    primary: "#0F172A", accent: "#0EA5E9",
    titleFont: HELV, bodyFont: HELV, pageBg: "#FFFFFF",
  },
  {
    id: "luxury", label: "Luxury", family: "luxury", orientation: "portrait",
    description: "Editorial-Magazin, Serif, Gold-Doppellinie, Cream-Hintergrund.",
    primary: "#1F1B16", accent: "#B08D57",
    titleFont: SERIF, bodyFont: SERIF, pageBg: "#FAF7F2",
  },
  // --- 3 neue Hochformat ---
  {
    id: "noir", label: "Noir", family: "classic", orientation: "portrait",
    description: "Dunkler Look, Kupfer-Akzent, Icon-Stats & Mini-Map.",
    primary: "#0a0a0a", accent: "#D97706",
    titleFont: HELV, bodyFont: HELV, pageBg: "#FFFFFF",
  },
  {
    id: "studio", label: "Studio", family: "modern", orientation: "portrait",
    description: "Helle Architektur-Optik, Mint-Akzent, viele Icons.",
    primary: "#0f3d2e", accent: "#10B981",
    titleFont: HELV, bodyFont: HELV, pageBg: "#FFFFFF",
  },
  {
    id: "pastell", label: "Pastell Editorial", family: "luxury", orientation: "portrait",
    description: "Warmes Beige, Bordeaux-Akzent, Serif Magazin-Stil.",
    primary: "#3C1F2B", accent: "#B23A48",
    titleFont: SERIF, bodyFont: SERIF, pageBg: "#FBF4EC",
  },
  // --- 3 neue Querformat (Landscape) ---
  {
    id: "panorama", label: "Panorama (Quer)", family: "modern", orientation: "landscape",
    description: "Querformat, Cinemascope-Hero, 3-Spalten-Eckdaten mit Icons.",
    primary: "#0B132B", accent: "#3A86FF",
    titleFont: HELV, bodyFont: HELV, pageBg: "#FFFFFF",
  },
  {
    id: "editorial-land", label: "Editorial (Quer)", family: "luxury", orientation: "landscape",
    description: "Querformat, Serif-Magazin, 2-spaltig mit Goldlinien & Map.",
    primary: "#1F1B16", accent: "#9C7C38",
    titleFont: SERIF, bodyFont: SERIF, pageBg: "#FAF7F2",
  },
  {
    id: "urban-land", label: "Urban (Quer)", family: "classic", orientation: "landscape",
    description: "Querformat, Schwarz-Rot, Stadt-Map auf der Titelseite.",
    primary: "#111111", accent: "#E63946",
    titleFont: HELV, bodyFont: HELV, pageBg: "#FFFFFF",
  },
];

export type ExposePreviewData = {
  name: string;
  bildUrl?: string | null;
  adresse?: string | null;
  ort?: string | null;
  plz?: string | null;
  kategorie?: string | null;
  einheitenCount?: number;
  anzahlEtagen?: number | null;
  fertigstellung?: string | null;
};

/* Per-template demo overrides – jedes Template zeigt ein anderes Projekt/Bild */
const DEMO_BY_TEMPLATE: Partial<Record<ExposeTemplate, ExposePreviewData>> = {
  classic: {
    name: "Residenz Seeblick", adresse: "Bahnhofstrasse 12", plz: "8001", ort: "Zürich",
    kategorie: "kauf", einheitenCount: 12, anzahlEtagen: 4, fertigstellung: "Q3 2026",
    bildUrl: "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=1600&q=80",
  },
  modern: {
    name: "Lakeview Lofts", adresse: "Limmatquai 4", plz: "8024", ort: "Zürich",
    kategorie: "miete", einheitenCount: 18, anzahlEtagen: 6, fertigstellung: "Q1 2027",
    bildUrl: "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=1600&q=80",
  },
  luxury: {
    name: "Villa Belvedere", adresse: "Rämistrasse 88", plz: "8001", ort: "Zürich",
    kategorie: "kauf", einheitenCount: 6, anzahlEtagen: 3, fertigstellung: "Q4 2026",
    bildUrl: "https://images.unsplash.com/photo-1613490493576-7fde63acd811?auto=format&fit=crop&w=1600&q=80",
  },
  noir: {
    name: "Kupferhaus", adresse: "Langstrasse 145", plz: "8004", ort: "Zürich",
    kategorie: "miete", einheitenCount: 24, anzahlEtagen: 7, fertigstellung: "Q2 2027",
    bildUrl: "https://images.unsplash.com/photo-1493663284031-b7e3aefcae8e?auto=format&fit=crop&w=1600&q=80",
  },
  studio: {
    name: "Atelier Mint", adresse: "Hardturmstrasse 11", plz: "8005", ort: "Zürich",
    kategorie: "kauf", einheitenCount: 14, anzahlEtagen: 5, fertigstellung: "Q3 2026",
    bildUrl: "https://images.unsplash.com/photo-1487958449943-2429e8be8625?auto=format&fit=crop&w=1600&q=80",
  },
  pastell: {
    name: "Maison Aurora", adresse: "Rue du Rhône 32", plz: "1204", ort: "Genève",
    kategorie: "kauf", einheitenCount: 9, anzahlEtagen: 4, fertigstellung: "Q1 2027",
    bildUrl: "https://images.unsplash.com/photo-1600585154526-990dced4db0d?auto=format&fit=crop&w=1600&q=80",
  },
  panorama: {
    name: "Skyline Panorama", adresse: "Pfingstweidstrasse 60", plz: "8005", ort: "Zürich",
    kategorie: "miete", einheitenCount: 32, anzahlEtagen: 9, fertigstellung: "Q4 2027",
    bildUrl: "https://images.unsplash.com/photo-1502672023488-70e25813eb80?auto=format&fit=crop&w=1600&q=80",
  },
  "editorial-land": {
    name: "Palazzo Editoriale", adresse: "Via Nassa 21", plz: "6900", ort: "Lugano",
    kategorie: "kauf", einheitenCount: 8, anzahlEtagen: 4, fertigstellung: "Q2 2027",
    bildUrl: "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=1600&q=80",
  },
  "urban-land": {
    name: "Urban Block 7", adresse: "Europaallee 21", plz: "8004", ort: "Zürich",
    kategorie: "miete", einheitenCount: 28, anzahlEtagen: 8, fertigstellung: "Q1 2027",
    bildUrl: "https://images.unsplash.com/photo-1486325212027-8081e485255e?auto=format&fit=crop&w=1600&q=80",
  },
};

/* ============================================================
   Public renderer
   ============================================================ */

export function TemplatePreview({
  template,
  sections,
  preview,
  scale = "compact",
}: {
  template: TemplateMeta;
  sections: Required<ExposeSections>;
  preview?: ExposePreviewData;
  scale?: "compact" | "full" | "stack" | "thumbnail";
}) {
  // Always overlay per-template demo so each template shows a distinct project & cover image
  const demo = DEMO_BY_TEMPLATE[template.id];
  const merged: ExposePreviewData | undefined = demo ? { ...preview, ...demo } : preview;

  const pages: Array<{ key: string; node: React.ReactNode }> = [
    { key: "cover", node: <CoverPage template={template} preview={merged} /> },
  ];
  if (sections.beschreibung || sections.mikrolage) {
    pages.push({
      key: "content",
      node: <ContentPage template={template} showBeschreibung={sections.beschreibung} showMikrolage={sections.mikrolage} preview={merged} />,
    });
  }
  if (sections.einheiten) {
    pages.push({ key: "einheiten", node: <TablePage template={template} eyebrow="03 — EINHEITEN" title="Wohnungsspiegel" rows={6} cols={6} /> });
  }
  if (sections.galerie) {
    const layout = sections.galerieLayout ?? "grid4";
    const perPage = PER_PAGE[layout] ?? 4;
    const total = GALLERY_IMGS.length;
    const numPages = Math.max(1, Math.ceil(total / perPage));
    for (let p = 0; p < numPages; p++) {
      pages.push({
        key: `galerie-${p}`,
        node: <GalleryPage template={template} layout={layout} startIdx={p * perPage} pageIdx={p} totalPages={numPages} />,
      });
    }
  }
  if (sections.grundriss) {
    pages.push({ key: "grundriss", node: <PlanPage template={template} /> });
  }
  if (sections.energieausweis) {
    pages.push({ key: "energy", node: <EnergyPage template={template} /> });
  }
  if (sections.kontakt) {
    pages.push({ key: "kontakt", node: <ContactPage template={template} /> });
  }

  if (scale === "thumbnail") {
    return <PageFrame bg={template.pageBg} orientation={template.orientation}>{pages[0].node}</PageFrame>;
  }
  if (scale === "stack") {
    return <StackPreview pages={pages} template={template} />;
  }

  const wrapperCls = scale === "full"
    ? "grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
    : "max-h-[60vh] space-y-3 overflow-y-auto rounded-lg border bg-muted/30 p-3";

  return (
    <div className={wrapperCls}>
      {pages.map((p, i) => (
        <div key={p.key} className="space-y-1">
          <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Seite {i + 1}
          </div>
          <PageFrame bg={template.pageBg} orientation={template.orientation}>{p.node}</PageFrame>
        </div>
      ))}
    </div>
  );
}


function PageFrame({
  children, bg, orientation = "portrait",
}: { children: React.ReactNode; bg: string; orientation?: "portrait" | "landscape" }) {
  return (
    <div
      className="relative w-full overflow-hidden rounded-md border shadow-sm"
      style={{ aspectRatio: orientation === "landscape" ? "1.414 / 1" : "1 / 1.414", backgroundColor: bg }}
    >
      {children}
    </div>
  );
}

/* ============================================================
   Page chrome — three distinct treatments
   ============================================================ */

function PageHeader({ template, label }: { template: TemplateMeta; label?: string }) {
  if (template.family === "modern") {
    return (
      <div className="relative">
        <div className="h-[2px] w-full" style={{ backgroundColor: template.accent }} />
        <div className="flex items-center justify-between px-3 pt-1.5">
          <div className="flex items-center gap-1.5">
            <span className="text-[8px] font-bold" style={{ color: template.primary }}>EXPOSIO</span>
            <span className="h-[1px] w-3" style={{ backgroundColor: template.accent }} />
          </div>
          {label && <span className="text-[7px] text-neutral-400">{label}</span>}
        </div>
      </div>
    );
  }
  if (template.family === "luxury") {
    return (
      <div className="px-3 pt-3 text-center" style={{ backgroundColor: template.pageBg }}>
        <div className="text-[9px] font-bold tracking-[0.3em]" style={{ color: template.primary, fontFamily: template.titleFont }}>
          EXPOSIO
        </div>
        {label && <div className="text-[7px] italic" style={{ color: "#7a6f5c", fontFamily: template.bodyFont }}>{label}</div>}
        <div className="mx-auto mt-1 h-[1.2px] w-[88%]" style={{ backgroundColor: template.accent }} />
        <div className="mx-auto mt-[1px] h-[0.5px] w-[88%]" style={{ backgroundColor: template.accent, opacity: 0.5 }} />
      </div>
    );
  }
  // Classic
  return (
    <div>
      <div className="flex items-center justify-between px-3 py-1.5" style={{ backgroundColor: template.primary }}>
        <span className="text-[8px] font-bold tracking-wider text-white">EXPOSIO</span>
        {label && <span className="text-[8px] text-white/80">{label}</span>}
      </div>
      <div className="h-[2px] w-full" style={{ backgroundColor: template.accent }} />
    </div>
  );
}

function SectionTitle({ template, eyebrow, title }: { template: TemplateMeta; eyebrow: string; title: string }) {
  if (template.family === "modern") {
    return (
      <div>
        <div className="text-[7px] font-bold" style={{ color: template.accent }}>{eyebrow}</div>
        <div className="mt-0.5 text-[14px] font-bold leading-none" style={{ color: template.primary }}>
          {title}
        </div>
        <div className="mt-1 h-[1.5px] w-4" style={{ backgroundColor: template.accent }} />
      </div>
    );
  }
  if (template.family === "luxury") {
    return (
      <div className="text-center">
        <div className="text-[7px] italic" style={{ color: "#8a7a5e", fontFamily: template.bodyFont }}>{eyebrow}</div>
        <div className="mt-0.5 text-[13px] font-bold italic" style={{ color: template.primary, fontFamily: template.titleFont }}>
          {title}
        </div>
        <div className="mx-auto mt-1 h-[0.5px] w-8" style={{ backgroundColor: template.accent }} />
        <div className="mt-0.5 text-[7px]" style={{ color: template.accent }}>❖</div>
      </div>
    );
  }
  return (
    <div>
      <div className="text-[11px] font-bold" style={{ color: template.primary }}>{title}</div>
      <div className="mt-0.5 h-[1px] w-6" style={{ backgroundColor: template.accent }} />
    </div>
  );
}

function Footer({ template }: { template: TemplateMeta }) {
  if (template.family === "modern") {
    return (
      <div className="absolute inset-x-0 bottom-1.5 flex items-end justify-between px-3">
        <div className="flex items-center gap-1.5">
          <div className="h-3 w-3 bg-neutral-300" />
          <div className="text-[6px] font-bold" style={{ color: template.primary }}>ONLINE →</div>
        </div>
        <div className="text-[6px] text-neutral-400">EXPOSIO</div>
      </div>
    );
  }
  if (template.family === "luxury") {
    return (
      <div className="absolute inset-x-0 bottom-1.5 text-center">
        <div className="mx-auto h-[0.5px] w-1/3" style={{ backgroundColor: template.accent }} />
        <div className="mt-0.5 text-[7px]" style={{ color: template.accent }}>❖</div>
        <div className="text-[6px] italic" style={{ color: "#7a6f5c", fontFamily: template.bodyFont }}>EXPOSIO · exposio.ch</div>
      </div>
    );
  }
  return (
    <div className="absolute inset-x-0 bottom-1.5 flex items-end gap-2 px-3">
      <div className="h-3.5 w-3.5 bg-neutral-300" />
      <div className="flex-1">
        <div className="text-[6px] font-bold" style={{ color: template.primary }}>Online-Exposé</div>
        <div className="text-[5.5px] text-neutral-400">/projekte/…</div>
      </div>
      <div className="text-[5.5px] text-neutral-400">EXPOSIO</div>
    </div>
  );
}

/* ============================================================
   Landscape Cover — one shared cover, color-tinted per template
   ============================================================ */

function LandscapeCover({
  template, preview, name, adr, kat, facts,
}: {
  template: TemplateMeta;
  preview?: ExposePreviewData;
  name: string;
  adr: string;
  kat: string;
  facts: string[];
}) {
  const variant = template.id; // panorama | editorial-land | urban-land

  // PANORAMA: Cinemascope-Hero links 65%, schmale Info-Spalte rechts
  if (variant === "panorama") {
    return (
      <>
        <div className="absolute inset-0 flex">
          <div className="relative h-full w-[65%] overflow-hidden">
            {preview?.bildUrl ? (
              <img src={preview.bildUrl} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
            ) : (
              <div className="h-full w-full" style={{ background: `linear-gradient(135deg, ${template.primary}, ${template.accent})` }} />
            )}
            <div className="absolute inset-0" style={{ background: "linear-gradient(135deg, rgba(0,0,0,0.35) 0%, transparent 50%, rgba(0,0,0,0.25) 100%)" }} />
            <div className="absolute left-3 top-2 flex items-center gap-1.5">
              <span className="text-[8px] font-bold tracking-[0.3em] text-white">EXPOSIO</span>
              <span className="h-[1px] w-4 bg-white/70" />
            </div>
            <div className="absolute bottom-2 left-3 text-white">
              <div className="text-[6px] tracking-widest text-white/80">{facts.slice(0, 2).join("   ·   ")}</div>
            </div>
          </div>
          <div className="relative flex h-full w-[35%] flex-col justify-between p-3" style={{ backgroundColor: "#fff" }}>
            <div>
              <div className="h-[2px] w-6" style={{ backgroundColor: template.accent }} />
              <div className="mt-2 text-[6px] font-bold tracking-widest" style={{ color: template.accent }}>{kat}</div>
              <h2 className="mt-1 line-clamp-3 text-[13px] font-bold leading-[1.1]" style={{ color: template.primary, fontFamily: template.titleFont }}>
                {name}
              </h2>
              {adr && (
                <p className="mt-1 line-clamp-2 text-[6.5px] text-neutral-600">
                  <MapPin className="-mt-0.5 mr-0.5 inline" size={6} color={template.accent} />{adr}
                </p>
              )}
            </div>
            <div className="grid grid-cols-3 gap-1">
              {[
                { Icon: Home, l: "EINH.", v: `${preview?.einheitenCount ?? 32}` },
                { Icon: Building2, l: "ETG.", v: `${preview?.anzahlEtagen ?? 9}` },
                { Icon: MaxIcon, l: "M²", v: "3.2k" },
              ].map(({ Icon, l, v }) => (
                <div key={l} className="border p-0.5 text-center" style={{ borderColor: template.accent + "55" }}>
                  <Icon size={9} color={template.accent} className="mx-auto" />
                  <div className="text-[4.5px] uppercase tracking-wide text-neutral-500">{l}</div>
                  <div className="text-[7px] font-bold leading-none" style={{ color: template.primary }}>{v}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </>
    );
  }

  // URBAN-LAND: Top-Banner Schwarz mit Titel + großes Bild rechts + Map links unten
  if (variant === "urban-land") {
    return (
      <>
        <div className="absolute inset-0 bg-white" />
        <div className="absolute inset-x-0 top-0 flex h-[18%] items-center justify-between px-4" style={{ backgroundColor: template.primary }}>
          <div className="min-w-0 flex-1">
            <div className="text-[6px] font-bold tracking-[0.4em] text-white/70">EXPOSIO · URBAN</div>
            <h2 className="mt-0.5 line-clamp-1 text-[15px] font-black uppercase tracking-tight text-white">{name}</h2>
          </div>
          <span className="ml-2 shrink-0 px-2 py-1 text-[7px] font-bold tracking-widest text-white" style={{ backgroundColor: template.accent }}>
            {kat}
          </span>
        </div>
        <div className="absolute bottom-0 left-0 top-[18%] flex w-[42%] flex-col gap-1.5 p-3">
          {adr && (
            <div className="text-[7px] font-semibold" style={{ color: template.primary }}>
              <MapPin className="-mt-0.5 mr-0.5 inline" size={8} color={template.accent} /> {adr}
            </div>
          )}
          <div className="min-h-0"><MiniMap template={template} /></div>
          <div className="grid grid-cols-3 gap-1">
            {[
              { Icon: Home, t: `${preview?.einheitenCount ?? 28}` },
              { Icon: Building2, t: `${preview?.anzahlEtagen ?? 8}` },
              { Icon: TrainFront, t: "350m" },
            ].map(({ Icon, t }, i) => (
              <div key={i} className="flex items-center justify-center gap-1 border p-1" style={{ borderColor: template.accent }}>
                <Icon size={9} color={template.accent} />
                <span className="text-[7px] font-bold" style={{ color: template.primary }}>{t}</span>
              </div>
            ))}
          </div>
          <div className="truncate text-[5px] uppercase tracking-widest text-neutral-400">{facts.join("   ·   ")}</div>
        </div>
        <div className="absolute bottom-0 right-0 top-[18%] w-[58%] overflow-hidden">
          {preview?.bildUrl ? (
            <img src={preview.bildUrl} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
          ) : (
            <div className="h-full w-full" style={{ background: `linear-gradient(135deg, ${template.primary}, ${template.accent})` }} />
          )}
          <div className="absolute left-0 top-0 h-full w-[3px]" style={{ backgroundColor: template.accent }} />
        </div>
      </>
    );
  }

  // EDITORIAL-LAND: Magazin-Doppelseite – links Bild im Goldrahmen, rechts Serif-Spalte
  return (
    <>
      <div className="absolute inset-0" style={{ backgroundColor: template.pageBg }} />
      <div className="absolute bottom-3 left-3 top-3 w-[52%] border-[3px] p-[2px]" style={{ borderColor: template.accent }}>
        {preview?.bildUrl ? (
          <img src={preview.bildUrl} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
        ) : (
          <div className="h-full w-full" style={{ backgroundColor: "#E8DFCF" }} />
        )}
      </div>
      <div className="absolute bottom-3 right-3 top-3 flex w-[42%] flex-col" style={{ fontFamily: template.titleFont, color: template.primary }}>
        <div className="text-[7px] font-bold tracking-[0.4em]" style={{ color: template.accent }}>EXPOSIO</div>
        <div className="mt-1 h-[1.2px] w-full" style={{ backgroundColor: template.accent }} />
        <div className="mt-[1px] h-[0.5px] w-full" style={{ backgroundColor: template.accent, opacity: 0.5 }} />

        <div className="mt-3 text-[6px] italic" style={{ color: template.accent }}>• • •  {kat}  • • •</div>
        <h2 className="mt-1 line-clamp-3 text-[18px] font-bold italic leading-[1.05]">{name}</h2>
        <div className="mt-1 text-[9px]" style={{ color: template.accent }}>❖</div>
        {adr && (
          <p className="mt-1 text-[7px] italic" style={{ color: "#5a4f3a", fontFamily: template.bodyFont }}>{adr}</p>
        )}

        <div className="mt-2 grid grid-cols-3 gap-1">
          {[
            { Icon: Home, l: "Einheiten", v: `${preview?.einheitenCount ?? 8}` },
            { Icon: Building2, l: "Etagen", v: `${preview?.anzahlEtagen ?? 4}` },
            { Icon: MaxIcon, l: "Fläche", v: "1'180 m²" },
          ].map(({ Icon, l, v }) => (
            <div key={l} className="border p-1 text-center" style={{ borderColor: template.accent + "55" }}>
              <Icon size={9} color={template.accent} className="mx-auto" strokeWidth={1.5} />
              <div className="mt-0.5 text-[4.5px] italic" style={{ color: "#7a6f5c", fontFamily: template.bodyFont }}>{l}</div>
              <div className="text-[7px] font-bold italic" style={{ color: template.primary }}>{v}</div>
            </div>
          ))}
        </div>

        <div className="mt-auto">
          <div className="h-[0.5px] w-full" style={{ backgroundColor: template.accent, opacity: 0.5 }} />
          <div className="mt-1 flex items-center justify-between text-[6px] italic" style={{ color: "#7a6f5c", fontFamily: template.bodyFont }}>
            <span className="truncate">{facts.join(" · ")}</span>
            <span style={{ color: template.accent }}>❖</span>
          </div>
        </div>
      </div>
    </>
  );
}

/* ============================================================
   Cover — three completely different layouts
   ============================================================ */



function CoverPage({ template, preview }: { template: TemplateMeta; preview?: ExposePreviewData }) {
  const name = preview?.name || "Projektname";
  const adr = [preview?.adresse, [preview?.plz, preview?.ort].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  const kat = preview?.kategorie === "miete" ? "ZUR MIETE" : "ZUM KAUF";
  const facts = [
    preview?.einheitenCount ? `${preview.einheitenCount} Einheiten` : null,
    preview?.anzahlEtagen ? `${preview.anzahlEtagen} Etagen` : null,
    preview?.fertigstellung ? `Fertigstellung ${preview.fertigstellung}` : null,
  ].filter(Boolean) as string[];

  // === Landscape Covers ===
  if (template.orientation === "landscape") {
    return <LandscapeCover template={template} preview={preview} name={name} adr={adr} kat={kat} facts={facts} />;
  }

  // === NOIR — dunkles Cover, Bild als kleines „Polaroid", Kupfer-Akzent unten ===
  if (template.id === "noir") {
    return (
      <>
        <div className="absolute inset-0" style={{ backgroundColor: template.primary }} />
        <div className="absolute left-3 right-3 top-2 flex items-center justify-between">
          <span className="text-[8px] font-bold tracking-[0.3em] text-white">EXPOSIO</span>
          <span className="text-[6px] tracking-widest" style={{ color: template.accent }}>NOIR ED.</span>
        </div>
        {/* großes Bild oben, asymmetrisch */}
        <div className="absolute left-3 right-3 top-[8%] h-[44%] overflow-hidden border-[3px]" style={{ borderColor: template.accent }}>
          {preview?.bildUrl ? (
            <img src={preview.bildUrl} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
          ) : (
            <div className="h-full w-full" style={{ background: `linear-gradient(135deg, #222, ${template.accent})` }} />
          )}
        </div>
        {/* großer Titel auf Schwarz */}
        <div className="absolute inset-x-3 top-[56%] text-white">
          <div className="text-[7px] font-bold tracking-[0.3em]" style={{ color: template.accent }}>— {kat}</div>
          <div className="mt-1 h-[2px] w-10" style={{ backgroundColor: template.accent }} />
          <h2 className="mt-2 line-clamp-3 text-[20px] font-black uppercase leading-[1.05]" style={{ letterSpacing: "-0.01em" }}>
            {name}
          </h2>
          {adr && <p className="mt-2 text-[8px] text-white/60">{adr}</p>}
          <div className="mt-3 grid grid-cols-3 gap-1.5">
            {[
              { Icon: Home, l: "EINHEITEN", v: `${preview?.einheitenCount ?? 24}` },
              { Icon: Building2, l: "ETAGEN", v: `${preview?.anzahlEtagen ?? 7}` },
              { Icon: MaxIcon, l: "FLÄCHE", v: "2'150 m²" },
            ].map(({ Icon, l, v }) => (
              <div key={l} className="border px-1 py-1" style={{ borderColor: template.accent + "55" }}>
                <Icon size={10} color={template.accent} />
                <div className="mt-0.5 text-[5px] tracking-widest text-white/50">{l}</div>
                <div className="text-[9px] font-bold text-white">{v}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="absolute inset-x-3 bottom-2 flex items-center justify-between text-[6px] text-white/40">
          <span>{facts.join("   ·   ")}</span>
          <span style={{ color: template.accent }}>EXPOSIO ◆ noir</span>
        </div>
      </>
    );
  }

  // === STUDIO — heller Architektur-Look, runder Bild-Crop, Icon-Sticker ===
  if (template.id === "studio") {
    return (
      <>
        <div className="absolute inset-0 bg-white" />
        {/* Diagonale Mint-Akzentform */}
        <div className="absolute right-0 top-0 h-1/3 w-1/2" style={{ backgroundColor: template.accent + "18", clipPath: "polygon(20% 0, 100% 0, 100% 100%)" }} />
        <div className="absolute inset-x-3 top-2 flex items-center justify-between">
          <span className="flex items-center gap-1 text-[8px] font-bold" style={{ color: template.primary }}>
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: template.accent }} /> STUDIO
          </span>
          <span className="text-[6px] tracking-widest text-neutral-400">EXPOSIO</span>
        </div>
        {/* Großer kreisrunder Bild-Crop */}
        <div className="absolute left-1/2 top-[10%] h-[160px] w-[160px] -translate-x-1/2 overflow-hidden rounded-full ring-[4px] ring-white shadow-xl"
             style={{ outline: `2px solid ${template.accent}` }}>
          {preview?.bildUrl ? (
            <img src={preview.bildUrl} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
          ) : (
            <div className="h-full w-full" style={{ background: `linear-gradient(135deg, ${template.primary}, ${template.accent})` }} />
          )}
        </div>
        <div className="absolute inset-x-4 top-[52%] text-center">
          <span className="inline-block rounded-full px-2 py-0.5 text-[7px] font-bold text-white" style={{ backgroundColor: template.primary }}>
            {kat}
          </span>
          <h2 className="mt-2 line-clamp-2 text-[17px] font-bold leading-tight" style={{ color: template.primary }}>{name}</h2>
          {adr && <p className="mt-1 text-[8px] text-neutral-500">📍 {adr}</p>}
        </div>
        {/* Bullet-Icons unten */}
        <div className="absolute inset-x-3 bottom-7 grid grid-cols-3 gap-1.5">
          {[
            { Icon: Home, l: "Einheiten", v: `${preview?.einheitenCount ?? 14}` },
            { Icon: Bed, l: "Zimmer", v: "2.5–5.5" },
            { Icon: MaxIcon, l: "Fläche", v: "1'680 m²" },
          ].map(({ Icon, l, v }) => (
            <div key={l} className="rounded-md bg-white p-1.5 text-center shadow-sm ring-1 ring-neutral-100">
              <span className="mx-auto flex h-5 w-5 items-center justify-center rounded-full" style={{ backgroundColor: template.accent + "22" }}>
                <Icon size={10} color={template.accent} />
              </span>
              <div className="mt-0.5 text-[5px] uppercase tracking-wide text-neutral-500">{l}</div>
              <div className="text-[8px] font-bold" style={{ color: template.primary }}>{v}</div>
            </div>
          ))}
        </div>
        <div className="absolute inset-x-0 bottom-1.5 text-center text-[6px] text-neutral-400">
          {facts.join("   ·   ")}
        </div>
      </>
    );
  }

  // === PASTELL — warmes Magazin-Cover, große Serif-Typo, Bordeaux-Akzent, Bild unten ===
  if (template.id === "pastell") {
    return (
      <>
        <div className="absolute inset-0" style={{ backgroundColor: template.pageBg }} />
        <div className="absolute inset-x-4 top-3 flex items-center justify-between"
             style={{ fontFamily: template.bodyFont }}>
          <span className="text-[7px] italic" style={{ color: template.accent }}>— Édition Aurora —</span>
          <span className="text-[6px] tracking-[0.3em] uppercase" style={{ color: template.primary }}>EXPOSIO</span>
        </div>
        {/* Riesige Serif-Headline oben */}
        <div className="absolute inset-x-4 top-[10%]" style={{ fontFamily: template.titleFont }}>
          <div className="text-[6px] uppercase tracking-[0.35em]" style={{ color: template.accent }}>{kat}</div>
          <h2 className="mt-1 text-[26px] font-bold italic leading-[0.95]" style={{ color: template.primary }}>
            {name}
          </h2>
          <div className="mt-1 h-[1px] w-16" style={{ backgroundColor: template.accent }} />
          {adr && <p className="mt-1 text-[8px] italic" style={{ color: "#5a4f3a", fontFamily: template.bodyFont }}>{adr}</p>}
        </div>
        {/* Großes Bild unten, Magazin-Stil mit Rahmen */}
        <div className="absolute inset-x-4 top-[42%] h-[42%] border-[3px]" style={{ borderColor: template.accent + "33" }}>
          {preview?.bildUrl ? (
            <img src={preview.bildUrl} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
          ) : (
            <div className="h-full w-full" style={{ backgroundColor: "#E8DFCF" }} />
          )}
          {/* Bordeaux-Etikett auf Bild */}
          <div className="absolute -bottom-2 left-3 px-2 py-1 text-[6px] font-bold uppercase tracking-widest text-white"
               style={{ backgroundColor: template.accent, fontFamily: template.bodyFont }}>
            N° {(preview?.einheitenCount ?? 9).toString().padStart(2, "0")} · {preview?.ort ?? "Genève"}
          </div>
        </div>
        <div className="absolute inset-x-4 bottom-2 flex items-end justify-between"
             style={{ fontFamily: template.bodyFont, color: "#7a6f5c" }}>
          <span className="text-[6px] italic">{facts.join(" · ")}</span>
          <span className="text-[10px]" style={{ color: template.accent }}>❖</span>
        </div>
      </>
    );
  }


  if (template.family === "modern") {
    // FULL-BLEED hero + bottom gradient + title in white
    return (
      <>
        <div className="absolute inset-0 overflow-hidden">
          {preview?.bildUrl ? (
            <img src={preview.bildUrl} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
          ) : (
            <div className="h-full w-full" style={{ background: `linear-gradient(135deg, ${template.primary}, ${template.accent})` }} />
          )}
          <div className="absolute inset-x-0 bottom-0 top-[45%]" style={{ background: "linear-gradient(to bottom, transparent, rgba(0,0,0,0.85))" }} />
        </div>
        <div className="absolute left-0 top-0 h-full w-[3px]" style={{ backgroundColor: template.accent }} />
        <div className="absolute left-3 top-2 flex items-center gap-1.5">
          <span className="text-[8px] font-bold text-white">EXPOSIO</span>
          <span className="h-[1px] w-3" style={{ backgroundColor: template.accent }} />
        </div>
        <div className="absolute inset-x-3 bottom-3 text-white">
          <div className="text-[7px] font-bold" style={{ color: template.accent }}>— {kat}</div>
          <h2 className="mt-1 line-clamp-2 text-[18px] font-bold leading-none" style={{ fontFamily: template.titleFont }}>
            {name}
          </h2>
          {adr && <p className="mt-1 line-clamp-1 text-[8px] text-white/80">{adr}</p>}
          {facts.length > 0 && <p className="mt-0.5 text-[7px] text-white/60">{facts.join("   ·   ")}</p>}
        </div>
        <div className="absolute bottom-3 right-3 h-7 w-7 bg-white" />
      </>
    );
  }

  if (template.family === "luxury") {
    // Cream bg, centered serif EXPOSIO + double rule, hero in gold frame, centered serif italic title
    return (
      <>
        <div className="absolute inset-0" style={{ backgroundColor: template.pageBg }} />
        <div className="absolute inset-x-0 top-3 text-center">
          <div className="text-[9px] font-bold tracking-[0.3em]" style={{ color: template.primary, fontFamily: template.titleFont }}>
            EXPOSIO
          </div>
          <div className="mx-auto mt-1 h-[1.2px] w-[40%]" style={{ backgroundColor: template.accent }} />
          <div className="mx-auto mt-[1px] h-[0.5px] w-[40%]" style={{ backgroundColor: template.accent, opacity: 0.5 }} />
        </div>
        {/* Hero in gold frame */}
        <div className="absolute inset-x-3 top-[12%] h-[42%] border" style={{ borderColor: template.accent }}>
          {preview?.bildUrl ? (
            <img src={preview.bildUrl} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
          ) : (
            <div className="h-full w-full" style={{ background: "#E8DFCF" }} />
          )}
        </div>
        {/* Centered title block */}
        <div className="absolute inset-x-4 top-[58%] text-center" style={{ fontFamily: template.titleFont, color: template.primary }}>
          <div className="text-[8px] italic" style={{ color: template.accent }}>
            • • •   {kat}   • • •
          </div>
          <h2 className="mt-1.5 line-clamp-2 text-[15px] font-bold italic leading-tight">{name}</h2>
          <div className="mt-1 text-[10px]" style={{ color: template.accent }}>❖</div>
          {adr && <p className="mt-0.5 text-[8px] italic" style={{ color: "#5a4f3a", fontFamily: template.bodyFont }}>{adr}</p>}
          {facts.length > 0 && (
            <p className="mt-0.5 text-[7px]" style={{ color: "#7a6f5c", fontFamily: template.bodyFont }}>
              {facts.join("   ·   ")}
            </p>
          )}
        </div>
        <Footer template={template} />
      </>
    );
  }

  // CLASSIC
  return (
    <>
      <div className="absolute inset-x-0 top-0 h-1/2 overflow-hidden">
        {preview?.bildUrl ? (
          <img src={preview.bildUrl} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
        ) : (
          <div className="h-full w-full" style={{ background: `linear-gradient(135deg, ${template.primary}, ${template.accent})` }} />
        )}
      </div>
      <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-between bg-black/40 px-3 py-1.5">
        <span className="text-[8px] font-bold tracking-wider text-white">EXPOSIO</span>
        <span className="h-1 w-1 rounded-full" style={{ backgroundColor: template.accent }} />
      </div>
      <div className="absolute inset-x-0 z-10 h-[2px]" style={{ top: "50%", backgroundColor: template.accent }} />
      <div className="absolute inset-x-0 bottom-0 top-1/2 bg-white px-4 pt-4">
        <span
          className="inline-block px-2 py-0.5 text-[8px] font-bold text-white"
          style={{ backgroundColor: template.accent, borderRadius: 9999 }}
        >
          {kat}
        </span>
        <div className="mt-2 h-[2px] w-8" style={{ backgroundColor: template.accent }} />
        <h2 className="mt-2 line-clamp-2 text-[14px] font-bold leading-tight" style={{ color: template.primary }}>
          {name}
        </h2>
        {adr && <p className="mt-1 line-clamp-1 text-[9px] text-neutral-600">{adr}</p>}
        {facts.length > 0 && <p className="mt-0.5 text-[8px] text-neutral-500">{facts.join(" · ")}</p>}
      </div>
      <Footer template={template} />
    </>
  );
}

/* ============================================================
   Content page: Beschreibung + Mikrolage
   ============================================================ */

function ContentPage({
  template, showBeschreibung, showMikrolage, preview,
}: {
  template: TemplateMeta;
  showBeschreibung: boolean;
  showMikrolage: boolean;
  preview?: ExposePreviewData;
}) {
  const beschreibungText = `Die ${preview?.name ?? "Residenz Seeblick"} vereint zeitlose Architektur mit modernem Wohnkomfort an erstklassiger Lage in ${preview?.ort ?? "Zürich"}. Auf ${preview?.anzahlEtagen ?? 4} Etagen entstehen ${preview?.einheitenCount ?? 12} hochwertige Wohnungen mit grosszügigen Grundrissen, bodentiefen Fenstern und sonnigen Balkonen. Hochwertige Materialien, eine effiziente Wärmepumpe und smarte Haustechnik garantieren langfristigen Wohngenuss.`;

  const eckdaten: Array<[string, string]> = [
    ["Wohnungen", `${preview?.einheitenCount ?? 12}`],
    ["Etagen", `${preview?.anzahlEtagen ?? 4}`],
    ["Wohnfläche gesamt", "1'420 m²"],
    ["Fertigstellung", preview?.fertigstellung ?? "Q3 2026"],
    ["Heizung", "Erdsonden-Wärmepumpe"],
  ];

  const mikrolage: Array<{ label: string; dist: string; Icon: typeof MapPin }> = [
    { label: "Bahnhof Stadelhofen",     dist: "350 m", Icon: TrainFront },
    { label: "Tram-Haltestelle Bellevue", dist: "200 m", Icon: TrainFront },
    { label: "Migros Seefeld",          dist: "180 m", Icon: ShoppingBag },
    { label: "Primarschule Mühlebach",  dist: "450 m", Icon: GraduationCap },
    { label: "Zürichsee Promenade",     dist: "120 m", Icon: TreePine },
    { label: "Restaurant Kronenhalle",  dist: "600 m", Icon: Utensils },
  ];

  return (
    <div className={`flex h-full flex-col ${template.orientation === "landscape" ? "" : ""}`}>
      <PageHeader template={template} label={preview?.name} />
      <div className={`flex-1 p-3 ${template.orientation === "landscape" ? "grid grid-cols-2 gap-3" : "space-y-2.5"}`}>
        {showBeschreibung && (
          <div className="space-y-2">
            <SectionTitle template={template} eyebrow="01 — ÜBERBLICK" title="Über das Projekt" />
            <p
              className="text-[5.5px] leading-[1.5] text-neutral-700"
              style={{ fontFamily: template.bodyFont }}
            >
              {beschreibungText}
            </p>
            <IconKpiRow template={template} preview={preview} />
            {template.family === "modern" ? (
              <KpiRow template={template} preview={preview} />
            ) : (
              <DataTable template={template} rows={eckdaten} />
            )}
          </div>
        )}
        {showMikrolage && (
          <div className="space-y-1.5">
            <SectionTitle template={template} eyebrow="02 — UMGEBUNG" title="Mikrolage" />
            <MiniMap template={template} />
            <IconList template={template} items={mikrolage} />
          </div>
        )}
      </div>
      <Footer template={template} />
    </div>
  );
}

/* Icon-row mit Wohnfläche / Zimmer / Bäder / Etagen — funktioniert in allen Templates */
function IconKpiRow({ template, preview }: { template: TemplateMeta; preview?: ExposePreviewData }) {
  const items = [
    { Icon: Home, label: "Einheiten", value: `${preview?.einheitenCount ?? 12}` },
    { Icon: Building2, label: "Etagen", value: `${preview?.anzahlEtagen ?? 4}` },
    { Icon: Bed, label: "Zimmer", value: "2.5 – 5.5" },
    { Icon: Bath, label: "Bäder", value: "1 – 2" },
    { Icon: MaxIcon, label: "Fläche", value: "62–152 m²" },
  ];
  const isLuxury = template.family === "luxury";
  return (
    <div className="grid grid-cols-5 gap-1 pt-1">
      {items.map(({ Icon, label, value }) => (
        <div
          key={label}
          className="flex flex-col items-center gap-0.5 rounded-sm border px-1 py-1 text-center"
          style={{
            borderColor: isLuxury ? `${template.accent}55` : "#e5e7eb",
            backgroundColor: isLuxury ? "#FBF6EC" : "#FAFAFA",
          }}
        >
          <Icon size={9} color={template.accent} strokeWidth={1.8} />
          <div className="text-[5px] uppercase tracking-wide text-neutral-500" style={{ fontFamily: template.bodyFont }}>
            {label}
          </div>
          <div
            className={`text-[6.5px] font-bold leading-none ${isLuxury ? "italic" : ""}`}
            style={{ color: template.primary, fontFamily: template.titleFont }}
          >
            {value}
          </div>
        </div>
      ))}
    </div>
  );
}

/* Icon-Liste statt platter DataTable für Mikrolage */
function IconList({
  template,
  items,
}: {
  template: TemplateMeta;
  items: Array<{ label: string; dist: string; Icon: typeof MapPin }>;
}) {
  const isLuxury = template.family === "luxury";
  return (
    <div className="grid grid-cols-2 gap-1">
      {items.map(({ label, dist, Icon }, i) => (
        <div
          key={i}
          className="flex items-center gap-1.5 rounded-sm px-1.5 py-1"
          style={{
            backgroundColor: isLuxury ? (i % 2 === 0 ? "transparent" : "#F5EFE2") : (i % 2 === 0 ? "#FAFAFA" : "#FFFFFF"),
            border: `0.5px solid ${isLuxury ? template.accent + "55" : "#e5e7eb"}`,
            fontFamily: template.bodyFont,
          }}
        >
          <span
            className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full"
            style={{ backgroundColor: template.accent + "22" }}
          >
            <Icon size={8} color={template.accent} strokeWidth={2} />
          </span>
          <div className="flex-1 truncate">
            <div className="text-[5.5px] font-semibold truncate" style={{ color: template.primary }}>{label}</div>
          </div>
          <div className="text-[5.5px] font-bold tabular-nums" style={{ color: template.accent }}>{dist}</div>
        </div>
      ))}
    </div>
  );
}

/* Stilisiertes Mini-Map mit Straßen + Pins */
function MiniMap({ template }: { template: TemplateMeta }) {
  const isLuxury = template.family === "luxury";
  const bg = isLuxury ? "#F1E8D6" : "#E8EEF5";
  const street = isLuxury ? "#E0D2B4" : "#FFFFFF";
  const water = isLuxury ? "#C9D6CF" : "#BFD8E8";
  return (
    <div className="relative w-full overflow-hidden rounded-sm border" style={{ aspectRatio: "2.5 / 1", borderColor: isLuxury ? template.accent + "55" : "#cbd5e1" }}>
      <svg viewBox="0 0 200 80" className="h-full w-full" preserveAspectRatio="xMidYMid meet">
        <rect x="0" y="0" width="200" height="80" fill={bg} />
        {/* Wasser unten */}
        <path d="M0 60 Q 50 50 100 58 T 200 55 L 200 80 L 0 80 Z" fill={water} opacity="0.85" />
        {/* Strassenraster */}
        <line x1="0" y1="30" x2="200" y2="30" stroke={street} strokeWidth="3" />
        <line x1="0" y1="48" x2="200" y2="48" stroke={street} strokeWidth="2" />
        <line x1="60" y1="0" x2="60" y2="60" stroke={street} strokeWidth="3" />
        <line x1="130" y1="0" x2="130" y2="60" stroke={street} strokeWidth="2" />
        {/* Block-Schatten (Häuser) */}
        <rect x="10" y="6" width="14" height="10" fill="#cbd5e1" opacity="0.7" />
        <rect x="28" y="36" width="20" height="8" fill="#cbd5e1" opacity="0.7" />
        <rect x="80" y="10" width="22" height="14" fill="#cbd5e1" opacity="0.7" />
        <rect x="148" y="34" width="18" height="10" fill="#cbd5e1" opacity="0.7" />
        {/* POIs */}
        <circle cx="40" cy="30" r="2" fill={template.accent} opacity="0.6" />
        <circle cx="100" cy="48" r="2" fill={template.accent} opacity="0.6" />
        <circle cx="170" cy="30" r="2" fill={template.accent} opacity="0.6" />
        {/* Projekt-Pin */}
        <g transform="translate(95,28)">
          <circle r="6" fill={template.primary} />
          <circle r="2" fill="#fff" />
        </g>
      </svg>
      <div
        className="absolute bottom-0.5 right-1 rounded-sm px-1 text-[4.5px] font-bold uppercase tracking-wide"
        style={{ backgroundColor: template.primary, color: "#fff" }}
      >
        Lage
      </div>
    </div>
  );
}

function KpiRow({ template, preview }: { template: TemplateMeta; preview?: ExposePreviewData }) {
  const items: Array<[string, string]> = [
    ["EINHEITEN", `${preview?.einheitenCount ?? 12}`],
    ["ETAGEN", `${preview?.anzahlEtagen ?? 4}`],
    ["FERTIG.", preview?.fertigstellung ?? "Q3 26"],
  ];
  return (
    <div className="grid grid-cols-3 gap-2 pt-1">
      {items.map(([l, v]) => (
        <div key={l}>
          <div className="h-[1.5px] w-3" style={{ backgroundColor: template.accent }} />
          <div className="mt-0.5 text-[6px] text-neutral-500">{l}</div>
          <div className="text-[12px] font-bold leading-none" style={{ color: template.primary }}>{v}</div>
        </div>
      ))}
    </div>
  );
}

/* Two-column key/value table with real text */
function DataTable({ template, rows }: { template: TemplateMeta; rows: Array<[string, string]> }) {
  const isLuxury = template.family === "luxury";
  const isModern = template.family === "modern";
  return (
    <div
      className={`overflow-hidden ${isLuxury ? "" : isModern ? "" : "rounded-sm border border-neutral-200"}`}
      style={{ fontFamily: template.bodyFont }}
    >
      {rows.map(([k, v], i) => {
        const bg = isModern
          ? "transparent"
          : isLuxury
            ? (i % 2 === 0 ? "transparent" : "#F5EFE2")
            : (i % 2 === 0 ? "#fff" : "#f5f5f7");
        const borderBottom = isModern
          ? "0.5px solid #e5e7eb"
          : isLuxury
            ? `0.5px solid ${template.accent}55`
            : "0.5px solid #e5e7eb";
        return (
          <div
            key={i}
            className="grid grid-cols-[1fr_auto] items-center gap-2 px-1.5"
            style={{ backgroundColor: bg, borderBottom, minHeight: 11 }}
          >
            <span
              className={`text-[5.5px] ${isLuxury ? "italic" : ""}`}
              style={{ color: isLuxury ? "#5a4f3a" : "#525252" }}
            >
              {k}
            </span>
            <span
              className="text-[5.5px] font-semibold"
              style={{ color: template.primary }}
            >
              {v}
            </span>
          </div>
        );
      })}
    </div>
  );
}

/* Wohnungsspiegel — proper multi-column unit list */
function UnitsTable({ template }: { template: TemplateMeta }) {
  const cols = ["Nr.", "Etage", "Zimmer", "m²", "Preis CHF", "Status"];
  const rows: string[][] = [
    ["1.01", "EG",  "2.5", "62",  "780'000",   "verfügbar"],
    ["1.02", "EG",  "3.5", "84",  "1'120'000", "reserviert"],
    ["2.01", "1.OG","2.5", "64",  "810'000",   "verfügbar"],
    ["2.02", "1.OG","4.5", "112", "1'480'000", "verkauft"],
    ["3.01", "2.OG","3.5", "86",  "1'180'000", "verfügbar"],
    ["3.02", "2.OG","4.5", "115", "1'560'000", "verfügbar"],
    ["4.01", "DG",  "4.5", "128", "1'890'000", "verfügbar"],
    ["4.02", "DG",  "5.5", "152", "2'340'000", "reserviert"],
  ];
  const isLuxury = template.family === "luxury";
  const isModern = template.family === "modern";
  const grid = `42px 36px 38px 30px 1fr 56px`;

  return (
    <div className="overflow-hidden" style={{ fontFamily: template.bodyFont }}>
      {/* Header */}
      <div
        className="grid items-center gap-1 px-1.5"
        style={{
          gridTemplateColumns: grid,
          backgroundColor: isModern || isLuxury ? "transparent" : template.primary,
          color: isModern ? template.primary : isLuxury ? template.primary : "#fff",
          borderBottom: isModern
            ? `1.5px solid ${template.accent}`
            : isLuxury
              ? `1px solid ${template.accent}`
              : "none",
          minHeight: 12,
        }}
      >
        {cols.map((c) => (
          <span
            key={c}
            className={`text-[5px] font-bold uppercase tracking-wide ${isLuxury ? "italic" : ""}`}
          >
            {c}
          </span>
        ))}
      </div>
      {/* Rows */}
      {rows.map((r, i) => {
        const status = r[5];
        const statusColor =
          status === "verfügbar" ? "#1f8a3e"
          : status === "reserviert" ? "#c97a14"
          : "#b81d24";
        const bg = isModern
          ? "transparent"
          : isLuxury
            ? (i % 2 === 0 ? "transparent" : "#F5EFE2")
            : (i % 2 === 0 ? "#fff" : "#f5f5f7");
        return (
          <div
            key={i}
            className="grid items-center gap-1 px-1.5"
            style={{
              gridTemplateColumns: grid,
              backgroundColor: bg,
              borderBottom: isModern ? "0.5px solid #f1f5f9" : `0.5px solid ${isLuxury ? template.accent + "33" : "#e5e7eb"}`,
              minHeight: 11,
            }}
          >
            {r.map((cell, ci) => (
              <span
                key={ci}
                className="text-[5.5px]"
                style={{
                  color: ci === 5 ? statusColor : ci === 0 ? template.primary : "#374151",
                  fontWeight: ci === 0 || ci === 5 ? 700 : 400,
                  fontStyle: isLuxury && ci !== 5 ? "italic" : "normal",
                }}
              >
                {cell}
              </span>
            ))}
          </div>
        );
      })}
    </div>
  );
}

function TablePage({ template, eyebrow, title }: { template: TemplateMeta; eyebrow: string; title: string; rows?: number; cols?: number }) {
  return (
    <div className="flex h-full flex-col">
      <PageHeader template={template} />
      <div className="flex-1 space-y-2 p-3">
        <SectionTitle template={template} eyebrow={eyebrow} title={title} />
        <UnitsTable template={template} />
        <div className="flex items-center gap-2 pt-1 text-[5px] text-neutral-500">
          <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: "#1f8a3e" }} /> verfügbar
          <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: "#c97a14" }} /> reserviert
          <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: "#b81d24" }} /> verkauft
        </div>
      </div>
      <Footer template={template} />
    </div>
  );
}

const GALLERY_IMGS = [
  "https://images.unsplash.com/photo-1505691938895-1758d7feb511?auto=format&fit=crop&w=600&q=70",
  "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=600&q=70",
  "https://images.unsplash.com/photo-1493809842364-78817add7ffb?auto=format&fit=crop&w=600&q=70",
  "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=600&q=70",
  "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=600&q=70",
  "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?auto=format&fit=crop&w=600&q=70",
];

const GALLERY_CAPTIONS = [
  "Wohnzimmer mit Seesicht",
  "Designer-Küche",
  "Master-Bad mit Wanne",
  "Schlafzimmer DG",
  "Terrasse Süd",
  "Eingangsbereich",
];

const PER_PAGE: Record<GalerieLayout, number> = {
  fullpage: 1,
  halfpage: 2,
  stack: 3,
  grid2: 4,
  grid4: 4,
  grid6: 6,
  magazine: 3,
};

function GalleryPage({
  template,
  layout,
  startIdx = 0,
  pageIdx = 0,
  totalPages = 1,
}: {
  template: TemplateMeta;
  layout: GalerieLayout;
  startIdx?: number;
  pageIdx?: number;
  totalPages?: number;
}) {
  const isLuxury = template.family === "luxury";
  const title = isLuxury ? "Impressionen" : "Bildergalerie";
  const pageLabel = totalPages > 1 ? ` · Seite ${pageIdx + 1}/${totalPages}` : "";

  const captionCls = isLuxury
    ? "text-[5px] italic text-center"
    : "absolute inset-x-0 bottom-0 bg-black/55 px-1 py-[1px] text-[4.5px] font-medium text-white";

  const pick = (i: number) => {
    const idx = (startIdx + i) % GALLERY_IMGS.length;
    return { src: GALLERY_IMGS[idx], caption: GALLERY_CAPTIONS[idx] };
  };

  const Frame = ({ src, caption, h }: { src: string; caption: string; h: number | string }) =>
    isLuxury ? (
      <div className="border p-[2px]" style={{ borderColor: template.accent }}>
        <div className="relative overflow-hidden" style={{ height: h }}>
          <img src={src} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
        </div>
        <div className={captionCls} style={{ color: "#5a4f3a", fontFamily: template.bodyFont }}>{caption}</div>
      </div>
    ) : (
      <div className="relative overflow-hidden rounded-sm" style={{ height: h }}>
        <img src={src} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
        <div className={captionCls}>{caption}</div>
      </div>
    );

  // FULLPAGE: edge-to-edge single image, no header/footer chrome
  if (layout === "fullpage") {
    const { src, caption } = pick(0);
    return (
      <div className="relative flex h-full flex-col">
        <img src={src} alt="" className="absolute inset-0 h-full w-full object-cover" referrerPolicy="no-referrer" />
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2">
          <div className="text-[5px] uppercase tracking-[0.18em] text-white/80" style={{ fontFamily: template.bodyFont }}>
            07 — Galerie{pageLabel}
          </div>
          <div className="text-[8px] font-semibold text-white" style={{ fontFamily: template.titleFont }}>
            {caption}
          </div>
        </div>
      </div>
    );
  }

  let body: React.ReactNode;
  if (layout === "halfpage") {
    body = (
      <div className="flex h-full flex-col gap-1.5">
        {[0, 1].map((i) => {
          const { src, caption } = pick(i);
          return <Frame key={i} src={src} caption={caption} h="50%" />;
        })}
      </div>
    );
  } else if (layout === "stack") {
    body = (
      <div className="flex h-full flex-col gap-1.5">
        {[0, 1, 2].map((i) => {
          const { src, caption } = pick(i);
          return <Frame key={i} src={src} caption={caption} h="33%" />;
        })}
      </div>
    );
  } else if (layout === "grid2") {
    body = (
      <div className="grid h-full grid-cols-2 gap-1.5">
        {[0, 1, 2, 3].map((i) => {
          const { src, caption } = pick(i);
          return <Frame key={i} src={src} caption={caption} h="100%" />;
        })}
      </div>
    );
  } else if (layout === "grid4") {
    body = (
      <div className="grid h-full grid-cols-2 grid-rows-2 gap-1.5">
        {[0, 1, 2, 3].map((i) => {
          const { src, caption } = pick(i);
          return <Frame key={i} src={src} caption={caption} h="100%" />;
        })}
      </div>
    );
  } else if (layout === "grid6") {
    body = (
      <div className="grid h-full grid-cols-2 grid-rows-3 gap-1">
        {[0, 1, 2, 3, 4, 5].map((i) => {
          const { src, caption } = pick(i);
          return <Frame key={i} src={src} caption={caption} h="100%" />;
        })}
      </div>
    );
  } else {
    // magazine
    const big = pick(0);
    body = (
      <div className="flex h-full flex-col gap-1.5">
        <div className="flex-[2]"><Frame src={big.src} caption={big.caption} h="100%" /></div>
        <div className="grid flex-1 grid-cols-2 gap-1.5">
          {[1, 2].map((i) => {
            const { src, caption } = pick(i);
            return <Frame key={i} src={src} caption={caption} h="100%" />;
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <PageHeader template={template} />
      <div className="flex flex-1 flex-col gap-1.5 p-3">
        <SectionTitle template={template} eyebrow={`07 — GALERIE${pageLabel}`} title={title} />
        <div className="flex-1 min-h-0">{body}</div>
      </div>
      <Footer template={template} />
    </div>
  );
}



/* ============================================================
   Stack preview (with zoom controls)
   ============================================================ */

function StackPreview({
  pages,
  template,
}: {
  pages: Array<{ key: string; node: React.ReactNode }>;
  template: TemplateMeta;
}) {
  const [zoom, setZoom] = useState(100); // percent, 50–200


  return (
    <div className="rounded-lg border bg-neutral-100 shadow-inner">
      {/* Toolbar */}
      <div className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b bg-white/95 px-3 py-2 backdrop-blur">
        <div className="text-xs text-muted-foreground">
          {pages.length} Seite{pages.length === 1 ? "" : "n"}
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setZoom((z) => Math.max(50, z - 25))}
            disabled={zoom <= 50}
            className="flex h-7 w-7 items-center justify-center rounded border bg-white text-foreground transition hover:bg-muted disabled:opacity-40"
            aria-label="Verkleinern"
          >
            <ZoomOut className="h-3.5 w-3.5" />
          </button>
          <span className="min-w-[44px] text-center text-xs font-semibold tabular-nums">{zoom}%</span>
          <button
            type="button"
            onClick={() => setZoom((z) => Math.min(200, z + 25))}
            disabled={zoom >= 200}
            className="flex h-7 w-7 items-center justify-center rounded border bg-white text-foreground transition hover:bg-muted disabled:opacity-40"
            aria-label="Vergrössern"
          >
            <ZoomIn className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setZoom(100)}
            className="ml-1 flex h-7 items-center gap-1 rounded border bg-white px-2 text-[11px] font-medium transition hover:bg-muted"
            aria-label="Zoom zurücksetzen"
          >
            <Maximize2 className="h-3 w-3" /> 100%
          </button>
        </div>
      </div>

      {/* Scrollable stage — pages use CSS transform to keep aspect ratio + content proportions */}
      <div className="max-h-[64vh] overflow-auto px-4 py-5">
        <div className="mx-auto flex flex-col items-center gap-6">
          {pages.map((p, i) => {
            const isLandscape = template.orientation === "landscape";
            const baseW = isLandscape ? 520 : 380;
            const ratio = isLandscape ? 1 / 1.414 : 1.414;
            const scale = zoom / 100;
            const scaledW = baseW * scale;
            const scaledH = scaledW * ratio;
            return (
              <div key={p.key} className="flex flex-col items-stretch" style={{ width: scaledW }}>
                <div className="mb-1.5 flex items-center justify-between text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  <span>Seite {i + 1} / {pages.length}</span>
                  <span>{template.label}</span>
                </div>
                {/* Outer box: occupies the scaled footprint in layout flow */}
                <div style={{ width: scaledW, height: scaledH }}>
                  {/* Inner: base-sized page, scaled visually via transform */}
                  <div
                    className="rounded-md shadow-lg ring-1 ring-black/5"
                    style={{
                      width: baseW,
                      transform: `scale(${scale})`,
                      transformOrigin: "top left",
                    }}
                  >
                    <PageFrame bg={template.pageBg} orientation={template.orientation}>{p.node}</PageFrame>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
}


function PlanPage({ template }: { template: TemplateMeta }) {
  if (template.orientation === "landscape") {
    return <LandscapePlanPage template={template} />;
  }

  return (
    <div className="flex h-full flex-col">
      <PageHeader template={template} />
      <div className="flex flex-1 flex-col gap-1.5 p-3">
        <SectionTitle template={template} eyebrow="04 — PLAN" title="Grundriss Whg. 3.5" />
        <div className="relative mt-1 flex-1 overflow-hidden rounded-sm border border-neutral-300 bg-neutral-50">
          {/* Schematic floor plan */}
          <svg viewBox="0 0 200 140" className="h-full w-full" preserveAspectRatio="xMidYMid meet">
            <rect x="4" y="4" width="192" height="132" fill="none" stroke={template.primary} strokeWidth="1.5" />
            {/* Inner walls */}
            <line x1="90" y1="4" x2="90" y2="80" stroke={template.primary} strokeWidth="0.8" />
            <line x1="4" y1="80" x2="200" y2="80" stroke={template.primary} strokeWidth="0.8" />
            <line x1="140" y1="80" x2="140" y2="136" stroke={template.primary} strokeWidth="0.8" />
            <line x1="140" y1="40" x2="200" y2="40" stroke={template.primary} strokeWidth="0.8" />
            {/* Doors (arcs) */}
            <path d="M 90 50 A 10 10 0 0 1 100 60" fill="none" stroke={template.accent} strokeWidth="0.5" />
            <path d="M 60 80 A 10 10 0 0 1 70 90" fill="none" stroke={template.accent} strokeWidth="0.5" />
            {/* Labels */}
            <text x="42" y="44" textAnchor="middle" fontSize="6" fill={template.primary} fontWeight="700">WOHNEN</text>
            <text x="42" y="52" textAnchor="middle" fontSize="4.5" fill="#666">28.5 m²</text>
            <text x="145" y="24" textAnchor="middle" fontSize="6" fill={template.primary} fontWeight="700">KÜCHE</text>
            <text x="145" y="32" textAnchor="middle" fontSize="4.5" fill="#666">11.2 m²</text>
            <text x="170" y="60" textAnchor="middle" fontSize="6" fill={template.primary} fontWeight="700">BAD</text>
            <text x="170" y="68" textAnchor="middle" fontSize="4.5" fill="#666">6.8 m²</text>
            <text x="42" y="108" textAnchor="middle" fontSize="6" fill={template.primary} fontWeight="700">SCHLAFEN</text>
            <text x="42" y="116" textAnchor="middle" fontSize="4.5" fill="#666">16.4 m²</text>
            <text x="115" y="108" textAnchor="middle" fontSize="6" fill={template.primary} fontWeight="700">BÜRO</text>
            <text x="115" y="116" textAnchor="middle" fontSize="4.5" fill="#666">9.2 m²</text>
            <text x="170" y="108" textAnchor="middle" fontSize="6" fill={template.primary} fontWeight="700">BALKON</text>
            <text x="170" y="116" textAnchor="middle" fontSize="4.5" fill="#666">12.0 m²</text>
            {/* Compass */}
            <g transform="translate(186,124)">
              <circle r="6" fill="none" stroke={template.accent} strokeWidth="0.5" />
              <text y="-7" textAnchor="middle" fontSize="4" fill={template.accent} fontWeight="700">N</text>
            </g>
          </svg>
        </div>
        <div className="flex justify-between text-[5px] text-neutral-500">
          <span>Massstab 1:100</span>
          <span>Gesamt 84.1 m²</span>
        </div>
      </div>
      <Footer template={template} />
    </div>
  );
}

function LandscapePlanPage({ template }: { template: TemplateMeta }) {
  return (
    <div className="flex h-full flex-col">
      <PageHeader template={template} />
      <div className="grid min-h-0 flex-1 grid-cols-[1.55fr_0.75fr] gap-3 p-3 pb-6">
        <div className="flex min-h-0 flex-col gap-1.5">
          <SectionTitle template={template} eyebrow="04 — PLAN" title="Grundriss Whg. 3.5" />
          <div className="relative min-h-0 flex-1 overflow-hidden rounded-sm border border-neutral-300 bg-neutral-50 p-2">
            <svg viewBox="0 0 240 150" className="h-full w-full" preserveAspectRatio="xMidYMid meet">
              <rect x="14" y="12" width="212" height="126" fill="none" stroke={template.primary} strokeWidth="1.6" />
              <line x1="104" y1="12" x2="104" y2="84" stroke={template.primary} strokeWidth="0.85" />
              <line x1="14" y1="84" x2="226" y2="84" stroke={template.primary} strokeWidth="0.85" />
              <line x1="162" y1="84" x2="162" y2="138" stroke={template.primary} strokeWidth="0.85" />
              <line x1="162" y1="45" x2="226" y2="45" stroke={template.primary} strokeWidth="0.85" />
              <path d="M 104 54 A 13 13 0 0 1 117 67" fill="none" stroke={template.accent} strokeWidth="0.65" />
              <path d="M 70 84 A 13 13 0 0 1 83 97" fill="none" stroke={template.accent} strokeWidth="0.65" />
              <text x="58" y="48" textAnchor="middle" fontSize="7" fill={template.primary} fontWeight="700">WOHNEN</text>
              <text x="58" y="57" textAnchor="middle" fontSize="5" fill="#666">28.5 m²</text>
              <text x="165" y="28" textAnchor="middle" fontSize="7" fill={template.primary} fontWeight="700">KÜCHE</text>
              <text x="165" y="37" textAnchor="middle" fontSize="5" fill="#666">11.2 m²</text>
              <text x="195" y="65" textAnchor="middle" fontSize="7" fill={template.primary} fontWeight="700">BAD</text>
              <text x="195" y="74" textAnchor="middle" fontSize="5" fill="#666">6.8 m²</text>
              <text x="58" y="113" textAnchor="middle" fontSize="7" fill={template.primary} fontWeight="700">SCHLAFEN</text>
              <text x="58" y="122" textAnchor="middle" fontSize="5" fill="#666">16.4 m²</text>
              <text x="132" y="113" textAnchor="middle" fontSize="7" fill={template.primary} fontWeight="700">BÜRO</text>
              <text x="132" y="122" textAnchor="middle" fontSize="5" fill="#666">9.2 m²</text>
              <text x="195" y="113" textAnchor="middle" fontSize="7" fill={template.primary} fontWeight="700">BALKON</text>
              <text x="195" y="122" textAnchor="middle" fontSize="5" fill="#666">12.0 m²</text>
              <g transform="translate(216,128)">
                <circle r="7" fill="none" stroke={template.accent} strokeWidth="0.6" />
                <text y="-8" textAnchor="middle" fontSize="4.5" fill={template.accent} fontWeight="700">N</text>
              </g>
            </svg>
          </div>
        </div>
        <aside className="flex min-h-0 flex-col gap-2 border-l pl-3" style={{ borderColor: template.accent + "55" }}>
          <div>
            <div className="text-[6px] font-bold uppercase tracking-widest" style={{ color: template.accent }}>Planangaben</div>
            <div className="mt-1 text-[13px] font-bold leading-none" style={{ color: template.primary, fontFamily: template.titleFont }}>84.1 m²</div>
            <div className="text-[6px] text-neutral-500">3.5 Zimmer · Massstab 1:100</div>
          </div>
          <div className="grid grid-cols-2 gap-1">
            {[
              ["Wohnen", "28.5"], ["Schlafen", "16.4"], ["Küche", "11.2"], ["Balkon", "12.0"],
            ].map(([label, value]) => (
              <div key={label} className="rounded-sm border p-1" style={{ borderColor: template.accent + "44" }}>
                <div className="text-[5px] text-neutral-500">{label}</div>
                <div className="text-[7px] font-bold" style={{ color: template.primary }}>{value} m²</div>
              </div>
            ))}
          </div>
          <MiniMap template={template} />
        </aside>
      </div>
      <Footer template={template} />
    </div>
  );
}

function EnergyPage({ template }: { template: TemplateMeta }) {
  const cls = [
    { l: "A", c: "#1f8a3e", v: "≤ 50" },
    { l: "B", c: "#4caf50", v: "51–75" },
    { l: "C", c: "#8bc34a", v: "76–100" },
    { l: "D", c: "#ffeb3b", v: "101–125" },
    { l: "E", c: "#ff9800", v: "126–150" },
    { l: "F", c: "#ff5722", v: "151–200" },
    { l: "G", c: "#d32f2f", v: "> 200" },
  ];
  const current = "B";
  const value = "68";

  return (
    <div className="flex h-full flex-col">
      <PageHeader template={template} />
      <div className="flex-1 space-y-1.5 p-3">
        <SectionTitle template={template} eyebrow="05 — EFFIZIENZ" title="Energieeffizienz" />
        <p
          className="text-[5.5px] leading-[1.5] text-neutral-600"
          style={{ fontFamily: template.bodyFont }}
        >
          Endenergiebedarf {value} kWh/(m²·a) · Klasse <strong style={{ color: template.primary }}>{current}</strong>. Erdsonden-Wärmepumpe mit kontrollierter Lüftung & PV-Anlage.
        </p>
        <div className="space-y-[2px] pt-1">
          {cls.map((c) => {
            const active = c.l === current;
            const width = `${40 + cls.indexOf(c) * 7}%`;
            return (
              <div key={c.l} className="flex items-center gap-1.5">
                <div
                  className="flex items-center px-1 text-[6px] font-bold text-white"
                  style={{ backgroundColor: c.c, width, minHeight: 9, outline: active ? `1.5px solid ${template.primary}` : "none" }}
                >
                  <span className="mr-1">{c.l}</span>
                  <span className="text-[5px] font-medium opacity-90">{c.v}</span>
                </div>
                {active && (
                  <span className="text-[5.5px] font-bold" style={{ color: template.primary }}>← {value}</span>
                )}
              </div>
            );
          })}
        </div>
      </div>
      <Footer template={template} />
    </div>
  );
}

const CONTACT = {
  name: "Maria Müller",
  role: "Vermarktung & Verkauf",
  firm: "Seeblick Immobilien AG",
  phone: "+41 44 555 12 34",
  mail: "m.mueller@seeblick.ch",
  img: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=300&q=70",
};

function ContactPage({ template }: { template: TemplateMeta }) {
  if (template.family === "luxury") {
    return (
      <div className="flex h-full flex-col">
        <PageHeader template={template} />
        <div className="flex-1 p-3 text-center" style={{ fontFamily: template.bodyFont }}>
          <SectionTitle template={template} eyebrow="06 — KONTAKT" title="Ihr Ansprechpartner" />
          <div
            className="mx-auto mt-3 h-14 w-14 overflow-hidden border"
            style={{ borderColor: template.accent }}
          >
            <img src={CONTACT.img} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
          </div>
          <div className="mt-2 text-[8px] font-bold italic" style={{ color: template.primary, fontFamily: template.titleFont }}>
            {CONTACT.name}
          </div>
          <div className="text-[5.5px] italic" style={{ color: "#5a4f3a" }}>{CONTACT.role}</div>
          <div className="mx-auto mt-2 h-[0.5px] w-1/2" style={{ backgroundColor: template.accent }} />
          <div className="mt-1.5 space-y-0.5 text-[5.5px]" style={{ color: template.primary }}>
            <div className="italic">{CONTACT.firm}</div>
            <div>{CONTACT.phone}</div>
            <div>{CONTACT.mail}</div>
          </div>
          <div className="mt-2 text-[7px]" style={{ color: template.accent }}>❖</div>
          <div className="text-[5px] italic" style={{ color: "#7a6f5c" }}>Anbieter</div>
        </div>
        <Footer template={template} />
      </div>
    );
  }
  return (
    <div className="flex h-full flex-col">
      <PageHeader template={template} />
      <div className="flex-1 p-3" style={{ fontFamily: template.bodyFont }}>
        <SectionTitle template={template} eyebrow="06 — KONTAKT" title="Ihr Ansprechpartner" />
        <div className="mt-2 flex gap-2">
          <div className="h-14 w-14 shrink-0 overflow-hidden rounded-sm">
            <img src={CONTACT.img} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
          </div>
          <div className="flex-1 space-y-0.5">
            <div className="text-[8px] font-bold leading-tight" style={{ color: template.primary }}>{CONTACT.name}</div>
            <div className="text-[5.5px] text-neutral-500">{CONTACT.role}</div>
            <div className="mt-1 h-[1px] w-6" style={{ backgroundColor: template.accent }} />
            <div className="pt-0.5 text-[5.5px] font-medium" style={{ color: template.primary }}>{CONTACT.firm}</div>
            <div className="text-[5.5px] text-neutral-700">{CONTACT.phone}</div>
            <div className="text-[5.5px] text-neutral-700">{CONTACT.mail}</div>
          </div>
        </div>
        <div className="mt-3 rounded-sm border border-neutral-200 bg-neutral-50 p-1.5">
          <div className="text-[5px] font-bold uppercase tracking-wide" style={{ color: template.accent }}>Besichtigung vereinbaren</div>
          <div className="mt-0.5 text-[5.5px] text-neutral-600">
            Telefonisch oder per Mail · Mo–Fr 09:00–18:00 · Sa nach Vereinbarung
          </div>
        </div>
      </div>
      <Footer template={template} />
    </div>
  );
}

