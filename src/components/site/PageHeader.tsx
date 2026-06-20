import type { ReactNode } from "react";

export function PageHeader({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow?: string;
  title: ReactNode;
  description?: string;
  children?: ReactNode;
}) {
  return (
    <section className="relative overflow-hidden border-b border-border/50">
      <div className="absolute inset-0 grid-pattern opacity-30" />
      <div className="absolute -top-32 left-1/2 h-72 w-[42rem] -translate-x-1/2 rounded-full bg-primary/20 blur-3xl" />
      <div className="relative mx-auto max-w-7xl px-4 py-20 sm:px-6 md:py-28">
        {eyebrow && (
          <p className="text-sm font-semibold uppercase tracking-wider text-accent">
            {eyebrow}
          </p>
        )}
        <h1 className="mt-3 max-w-3xl text-balance font-display text-4xl font-black uppercase tracking-tight sm:text-5xl md:text-6xl">
          {title}
        </h1>
        {description && (
          <p className="mt-5 max-w-2xl text-balance text-muted-foreground sm:text-lg">
            {description}
          </p>
        )}
        {children && <div className="mt-8">{children}</div>}
      </div>
    </section>
  );
}
