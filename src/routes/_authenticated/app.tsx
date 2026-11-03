import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, Outlet, useNavigate } from "@tanstack/react-router";
import {
  Activity, BookOpen, Bot, CheckSquare, CreditCard, FolderKanban, GitBranch, History, LayoutDashboard, LogOut, Menu, Settings, ShieldCheck, X,
} from "lucide-react";
import { useState } from "react";

import { Logo, ThemeToggle } from "@/components/site/brand";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/app")({
  head: () => ({ meta: [{ title: "Workspace — NEXORA AI" }, { name: "robots", content: "noindex" }] }),
  component: AppShell,
});

const items = [
  { to: "/app", label: "Overview", icon: LayoutDashboard, exact: true },
  { to: "/app/agent", label: "Agent", icon: Bot },
  { to: "/app/tasks", label: "Tasks", icon: CheckSquare },
  { to: "/app/projects", label: "Projects", icon: FolderKanban },
  { to: "/app/knowledge", label: "Knowledge", icon: BookOpen },
  { to: "/app/workflows", label: "Workflows", icon: GitBranch },
  { to: "/app/approvals", label: "Approvals", icon: ShieldCheck },
  { to: "/app/history", label: "History", icon: History },
  { to: "/app/usage", label: "Usage", icon: Activity },
  { to: "/app/billing", label: "Billing", icon: CreditCard },
  { to: "/app/settings", label: "Settings", icon: Settings },
] as const;

function AppShell() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user } = Route.useRouteContext();

  const signOut = async () => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  const nav = (
    <nav className="flex flex-1 flex-col gap-1" aria-label="App">
      {items.map((it) => (
        <Link
          key={it.to}
          to={it.to}
          activeOptions={{ exact: "exact" in it }}
          onClick={() => setOpen(false)}
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-sidebar-foreground/75 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
          activeProps={{ className: "bg-sidebar-accent text-sidebar-foreground font-medium" }}
        >
          <it.icon className="size-4" />
          <span className="flex-1">{it.label}</span>
          {"soon" in it && <span className="rounded bg-warning/15 px-1.5 text-[10px] text-warning">soon</span>}
        </Link>
      ))}
    </nav>
  );

  return (
    <div className="flex h-screen bg-background text-foreground">
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col gap-6 border-r border-sidebar-border bg-sidebar p-4 transition-transform md:static md:translate-x-0 ${open ? "translate-x-0" : "-translate-x-full"}`}
      >
        <div className="flex items-center justify-between">
          <Logo />
          <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setOpen(false)} aria-label="Close menu">
            <X className="size-4" />
          </Button>
        </div>
        {nav}
        <div className="space-y-2 border-t border-sidebar-border pt-4">
          <p className="truncate px-1 text-xs text-muted-foreground">{user.email}</p>
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <Button variant="ghost" size="sm" onClick={signOut} className="flex-1 justify-start">
              <LogOut className="size-4" /> Sign out
            </Button>
          </div>
        </div>
      </aside>
      {open && <div className="fixed inset-0 z-30 bg-background/70 md:hidden" onClick={() => setOpen(false)} aria-hidden />}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center gap-2 border-b border-border px-4 md:hidden">
          <Button variant="ghost" size="icon" onClick={() => setOpen(true)} aria-label="Open menu">
            <Menu className="size-4" />
          </Button>
          <Logo />
        </header>
        <main className="min-h-0 flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
