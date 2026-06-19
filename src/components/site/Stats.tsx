const stats = [
  { label: "Active Players", value: "128,400+" },
  { label: "Competitions Completed", value: "892K" },
  { label: "Tournament Champions", value: "4,210" },
  { label: "Total Prize Pools", value: "$2.4M" },
  { label: "Active Tournaments", value: "317" },
];

export function Stats() {
  return (
    <section id="stats" className="relative border-y border-border/50 bg-surface/40">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 md:py-16">
        <div className="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-5">
          {stats.map((s) => (
            <div key={s.label} className="text-center">
              <div className="text-3xl font-bold tracking-tight text-gradient-brand sm:text-4xl">
                {s.value}
              </div>
              <div className="mt-1 text-xs uppercase tracking-wider text-muted-foreground sm:text-sm">
                {s.label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
