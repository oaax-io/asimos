# ASIMOS PDF Microservice

Self-hosted Puppeteer service. ASIMOS' server function `renderDocumentPdf`
posts HTML here and gets back a PDF.

**This service is NOT deployed by Lovable.** Host it on Render, Fly.io,
Railway, your own VPS, or any Docker-compatible host.

## Contract

```
POST /
Headers:
  x-api-key: <PDF_SERVICE_TOKEN>
  Content-Type: application/json
Body:
  { "html": "<!doctype html>...", "filename": "mandate-abcd1234.pdf" }
Response:
  200 application/pdf  (binary PDF)
  401 invalid api key
  400 missing html
  500 render error
```

## Run locally

```bash
cd pdf-service
npm install
PDF_SERVICE_TOKEN=dev-secret npm start
# -> http://localhost:8080
```

## Deploy with Docker

```bash
docker build -t asimos-pdf .
docker run -e PDF_SERVICE_TOKEN=<your-secret> -p 8080:8080 asimos-pdf
```

## Configure in ASIMOS

Set these secrets in Lovable Cloud (Settings → Backend → Secrets):

- `PDF_SERVICE_URL` → e.g. `https://pdf.yourdomain.com/`
- `PDF_SERVICE_TOKEN` → the same value as `PDF_SERVICE_TOKEN` on the service

## Render settings

A4, 20mm margins, `printBackground: true`, `waitUntil: "networkidle0"`.
A single Chromium instance is reused across requests; concurrent requests
each get their own page.
