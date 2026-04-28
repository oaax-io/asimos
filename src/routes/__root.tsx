import { Outlet, createRootRoute, HeadContent, Scripts, Link } from "@tanstack/react-router";
import { useState } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import appCss from "../styles.css?url";
import { AuthProvider } from "@/lib/auth";
import { makeQueryClient } from "@/lib/queryClient";
import { Toaster } from "@/components/ui/sonner";

function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-soft px-4">
      <div className="max-w-md text-center">
        <div className="text-7xl font-bold text-gradient-brand">404</div>
        <h2 className="mt-4 text-xl font-semibold">Seite nicht gefunden</h2>
        <p className="mt-2 text-sm text-muted-foreground">Die gesuchte Seite existiert nicht.</p>
        <Link to="/" className="mt-6 inline-flex rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-soft hover:opacity-90">
          Zur Startseite
        </Link>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "ASIMO Property Hub" },
      { name: "description", content: "Leads, Kunden, Immobilien, Finanzierung, Matching, Termine und Exposés in einem modernen, benutzerfreundlichen CRM." },
      { property: "og:title", content: "ASIMO Property Hub" },
      { name: "twitter:title", content: "ASIMO Property Hub" },
      { property: "og:description", content: "Leads, Kunden, Immobilien, Finanzierung, Matching, Termine und Exposés in einem modernen, benutzerfreundlichen CRM." },
      { name: "twitter:description", content: "Leads, Kunden, Immobilien, Finanzierung, Matching, Termine und Exposés in einem modernen, benutzerfreundlichen CRM." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/73a4c230-8589-4ad4-af23-38cce2cf105b/id-preview-ca4066a3--4e795f2c-5909-4255-a6b0-36cc8098ec55.lovable.app-1777392627602.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/73a4c230-8589-4ad4-af23-38cce2cf105b/id-preview-ca4066a3--4e795f2c-5909-4255-a6b0-36cc8098ec55.lovable.app-1777392627602.png" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:type", content: "website" },
    ],
    links: [{ rel: "stylesheet", href: appCss }, { rel: "preconnect", href: "https://fonts.googleapis.com" }, { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@600;700;800&display=swap" }],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFound,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <head><HeadContent /></head>
      <body>{children}<Scripts /></body>
    </html>
  );
}

function RootComponent() {
  const [qc] = useState(() => makeQueryClient());
  return (
    <QueryClientProvider client={qc}>
      <AuthProvider>
        <Outlet />
        <Toaster richColors position="top-right" />
      </AuthProvider>
    </QueryClientProvider>
  );
}
