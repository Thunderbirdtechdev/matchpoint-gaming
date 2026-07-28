const stats = [
  { label: "Active Players", value: "128,400+" },
  { label: "Matches Settled", value: "892K" },
  { label: "Prize Pools Paid", value: "$2.4M" },
  { label: "Live Tournaments", value: "317" },
];

export function Stats() {
  return (
    <section id="stats" className="relative border-y border-border/50 bg-surface/30">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 md:py-14">
        <div className="grid grid-cols-2 gap-y-10 lg:grid-cols-4">
          {stats.map((s) => (
            <div
              key={s.label}
              className="px-2 text-center lg:border-r lg:border-border/40 lg:last:border-r-0"
            >
              <div className="font-display text-4xl tracking-wide text-gradient-brand sm:text-5xl">
                {s.value}
              </div>
              <div className="mt-1 font-display text-xs tracking-[0.24em] text-muted-foreground sm:text-sm">
                {s.label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
