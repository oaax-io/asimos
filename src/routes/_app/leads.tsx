import { Outlet, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/leads")({
  component: LeadsLayout,
});

function LeadsLayout() {
  return <Outlet />;
}
