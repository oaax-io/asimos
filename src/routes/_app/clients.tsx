import { Outlet, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/clients")({
  component: ClientsLayout,
});

function ClientsLayout() {
  return <Outlet />;
}