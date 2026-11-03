import type { ReactNode } from "react";

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 border-b border-border px-6 py-6">
      <div>
        <h1 className="text-2xl font-semibold">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions}
    </div>
  );
}

export function NotBuilt({ title, what }: { title: string; what: string[] }) {
  return (
    <div>
      <PageHeader title={title} />
      <div className="p-6">
        <div className="max-w-xl rounded-2xl border border-dashed border-warning/50 p-6">
          <span className="rounded bg-warning/15 px-2 py-0.5 text-xs font-medium text-warning">Not available yet</span>
          <p className="mt-3 text-sm text-muted-foreground">This area is planned for a later build stage. Nothing here is functional yet. It will include:</p>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm">
            {what.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
