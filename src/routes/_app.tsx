import { createFileRoute, Outlet } from "@tanstack/react-router";
import AppLayout from "@/components/AppLayout";
import { DomainAccessGate } from "@/components/DomainAccessGate";

export const Route = createFileRoute("/_app")({
  component: () => (
    <DomainAccessGate>
      <AppLayout>
        <Outlet />
      </AppLayout>
    </DomainAccessGate>
  ),
});
