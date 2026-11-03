import { Outlet, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/app/workflows")({
  head: () => ({ meta: [{ title: "Workflows — NEXORA AI" }] }),
  component: () => <Outlet />,
});
