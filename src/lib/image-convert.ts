import { toast } from "sonner";

/**
 * Konvertiert TIFF/HEIC-Dateien clientseitig in JPEG, damit sie im Browser
 * angezeigt werden können. Andere Dateien werden unverändert zurückgegeben.
 */
export async function convertUnsupportedImages(files: File[]): Promise<File[]> {
  const result: File[] = [];
  let convertedTiff = 0;
  let convertedHeic = 0;
  let failed = 0;

  for (const file of files) {
    const name = file.name.toLowerCase();
    const isTiff =
      file.type === "image/tiff" ||
      file.type === "image/tif" ||
      name.endsWith(".tif") ||
      name.endsWith(".tiff");
    const isHeic =
      file.type === "image/heic" ||
      file.type === "image/heif" ||
      name.endsWith(".heic") ||
      name.endsWith(".heif");

    try {
      if (isTiff) {
        result.push(await tiffToJpeg(file));
        convertedTiff++;
        continue;
      }
      if (isHeic) {
        result.push(await heicToJpeg(file));
        convertedHeic++;
        continue;
      }
    } catch (e) {
      console.error("Konvertierung fehlgeschlagen für", file.name, e);
      failed++;
      continue;
    }

    result.push(file);
  }

  if (convertedTiff > 0) toast.success(`${convertedTiff} TIFF-Datei(en) zu JPG konvertiert`);
  if (convertedHeic > 0) toast.success(`${convertedHeic} HEIC-Datei(en) zu JPG konvertiert`);
  if (failed > 0) toast.error(`${failed} Datei(en) konnten nicht konvertiert werden und wurden übersprungen`);

  return result;
}

async function tiffToJpeg(file: File): Promise<File> {
  const UTIF: any = await import("utif");
  const buf = await file.arrayBuffer();
  const ifds = UTIF.decode(buf);
  if (!ifds || ifds.length === 0) throw new Error("TIFF leer");
  UTIF.decodeImage(buf, ifds[0]);
  const rgba = UTIF.toRGBA8(ifds[0]);
  const w = ifds[0].width;
  const h = ifds[0].height;

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas nicht verfügbar");
  const imageData = new ImageData(new Uint8ClampedArray(rgba), w, h);
  ctx.putImageData(imageData, 0, 0);

  const blob: Blob = await new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Canvas-Export fehlgeschlagen"))), "image/jpeg", 0.92),
  );
  return new File([blob], replaceExt(file.name, "jpg"), { type: "image/jpeg" });
}

async function heicToJpeg(file: File): Promise<File> {
  const mod: any = await import("heic2any");
  const heic2any = mod.default ?? mod;
  const out = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.92 });
  const blob = Array.isArray(out) ? out[0] : out;
  return new File([blob], replaceExt(file.name, "jpg"), { type: "image/jpeg" });
}

function replaceExt(name: string, newExt: string): string {
  const dot = name.lastIndexOf(".");
  return (dot > 0 ? name.slice(0, dot) : name) + "." + newExt;
}
