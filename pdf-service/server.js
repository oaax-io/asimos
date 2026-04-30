import express from "express";
import { existsSync } from "node:fs";
import puppeteer from "puppeteer";

const PORT = Number(process.env.PORT || 8080);
const TOKEN = process.env.PDF_SERVICE_TOKEN;
if (!TOKEN) {
  console.error("PDF_SERVICE_TOKEN is required");
  process.exit(1);
}

let resolvedExecutablePath = null;
try {
  resolvedExecutablePath = puppeteer.executablePath();
  console.log(`[pdf] using Chromium at ${resolvedExecutablePath}`);
} catch (err) {
  console.warn("[pdf] could not resolve puppeteer.executablePath():", err?.message);
}

const envExec = process.env.PUPPETEER_EXECUTABLE_PATH;
if (envExec) {
  if (existsSync(envExec)) {
    resolvedExecutablePath = envExec;
    console.log(`[pdf] using configured Chromium at ${envExec}`);
  } else {
    console.warn(
      `[pdf] PUPPETEER_EXECUTABLE_PATH=${envExec} does not exist — ignoring and using bundled Chromium`,
    );
    delete process.env.PUPPETEER_EXECUTABLE_PATH;
  }
}

// Single shared browser instance across requests (each request gets its own page)
let browserPromise = null;
async function getBrowser() {
  if (!browserPromise) {
    browserPromise = puppeteer
      .launch({
        headless: "new",
        executablePath: resolvedExecutablePath || undefined,
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-gpu",
        ],
      })
      .catch((err) => {
        browserPromise = null;
        throw err;
      });
  }
  return browserPromise;
}

const app = express();
app.use(express.json({ limit: "10mb" }));

app.get("/healthz", (_req, res) => res.json({ ok: true }));
app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

async function renderPdf(req, res) {
  const t0 = Date.now();
  if (req.header("x-pdf-token") !== TOKEN && req.header("x-api-key") !== TOKEN) {
    return res.status(401).json({ error: "invalid_api_key" });
  }
  const { html, filename, title } = req.body ?? {};
  if (typeof html !== "string" || !html.length) {
    return res.status(400).json({ error: "missing_html" });
  }

  let page;
  try {
    const browser = await getBrowser();
    page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle0", timeout: 30_000 });
    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "20mm", bottom: "20mm", left: "20mm", right: "20mm" },
    });
    res.setHeader("Content-Type", "application/pdf");
    if (filename) {
      res.setHeader("Content-Disposition", `inline; filename="${filename}"`);
    }
    res.end(pdf);
    console.log(`[pdf] ok ms=${Date.now() - t0} bytes=${pdf.length} file=${filename ?? "-"}`);
  } catch (err) {
    console.error(`[pdf] err ms=${Date.now() - t0}`, err);
    res.status(500).json({ error: "render_failed", message: err?.message });
  } finally {
    if (page) {
      try {
        await page.close();
      } catch {}
    }
  }
}

app.post("/", renderPdf);
app.post("/render-pdf", renderPdf);

const server = app.listen(PORT, () => {
  console.log(`PDF service listening on :${PORT}`);
});

async function shutdown(signal) {
  console.log(`Received ${signal}, shutting down...`);
  server.close();
  try {
    const b = await browserPromise;
    if (b) await b.close();
  } catch {}
  process.exit(0);
}
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
