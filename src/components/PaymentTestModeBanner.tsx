const clientToken = import.meta.env.VITE_PAYMENTS_CLIENT_TOKEN as string | undefined;

export function PaymentTestModeBanner() {
  if (!clientToken?.startsWith("pk_test_")) return null;
  return (
    <div className="w-full bg-orange-100 border border-orange-300 rounded-md px-4 py-2 text-center text-sm text-orange-800">
      Testmodus aktiv – alle Zahlungen sind Testzahlungen (keine echten Beträge).{" "}
      <a
        href="https://docs.lovable.dev/features/payments#test-and-live-environments"
        target="_blank"
        rel="noopener noreferrer"
        className="underline font-medium"
      >
        Mehr erfahren
      </a>
    </div>
  );
}
