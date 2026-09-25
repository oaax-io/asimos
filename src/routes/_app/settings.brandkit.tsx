import { createFileRoute, redirect } from "@tanstack/react-router";

// Brandkit ist in «White Label» aufgegangen – alte Links weiterleiten.
export const Route = createFileRoute("/_app/settings/brandkit")({
  beforeLoad: () => { throw redirect({ to: "/settings/white-label", replace: true }); },
});
