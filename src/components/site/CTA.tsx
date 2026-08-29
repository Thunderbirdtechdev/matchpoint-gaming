import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, useEffect, useCallback } from "react";
import useEmblaCarousel from "embla-carousel-react";

import cardFortnite from "@/assets/card-fortnite.jpg";
import cardNba2k from "@/assets/card-nba2k.jpg";
import cardMadden from "@/assets/card-madden.jpg";
import cardNcaa from "@/assets/card-ncaa.jpg";

const slides = [
  { img: cardFortnite, label: "Fortnite", tagline: "Drop in. Dominate. Cash out." },
  { img: cardNba2k, label: "NBA 2K", tagline: "Ball is life. Prizes are real." },
  { img: cardMadden, label: "Madden NFL", tagline: "Your playbook. Your payday." },
  { img: cardNcaa, label: "College Football", tagline: "Gameday glory awaits." },
];

const AUTOPLAY_MS = 3500;

function CTASlideshow() {
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true, duration: 28 });
  const [activeIndex, setActiveIndex] = useState(0);
  const [transitioning, setTransitioning] = useState(false);

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setActiveIndex(emblaApi.selectedScrollSnap());
    setTransitioning(true);
    setTimeout(() => setTransitioning(false), 400);
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    emblaApi.on("select", onSelect);
    onSelect();
    return () => { emblaApi.off("select", onSelect); };
  }, [emblaApi, onSelect]);

  useEffect(() => {
    if (!emblaApi) return;
    const id = setInterval(() => emblaApi.scrollNext(), AUTOPLAY_MS);
    return () => clearInterval(id);
  }, [emblaApi]);

  return (
    <div className="relative w-full overflow-hidden rounded-2xl shadow-[0_0_60px_oklch(0.51_0.23_277_/_0.15)]">
      {/* Glowing border */}
      <div className="absolute -inset-px rounded-2xl bg-gradient-to-b from-white/20 via-white/5 to-white/20 z-10 pointer-events-none" />

      {/* Carousel */}
      <div ref={emblaRef} className="overflow-hidden rounded-2xl">
        <div className="flex">
          {slides.map((s) => (
            <div key={s.label} className="relative min-w-0 flex-[0_0_100%]">
              <div className="relative aspect-[4/3] overflow-hidden">
                <img
                  src={s.img}
                  alt={s.label}
                  className="h-full w-full object-cover transition-transform duration-[4000ms] ease-out"
                  style={{
                    transform: !transitioning ? "scale(1.08)" : "scale(1)",
                  }}
                  loading="lazy"
                  width={640}
                  height={480}
                />
                {/* Overlays */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
                <div className="absolute inset-0 bg-gradient-to-r from-black/20 to-transparent" />
              </div>

              {/* Slide content */}
              <div className="absolute inset-x-0 bottom-0 p-5 sm:p-6">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-white backdrop-blur-sm">
                  <span className="h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" />
                  Now Live
                </div>
                <h3 className="mt-2.5 font-display text-2xl tracking-wide text-white sm:text-3xl">
                  {s.label}
                </h3>
                <p className="mt-1 text-sm text-white/60">{s.tagline}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Progress dots */}
      <div className="absolute bottom-4 right-4 z-20 flex items-center gap-2">
        {slides.map((s, i) => (
          <button
            key={s.label}
            type="button"
            onClick={() => emblaApi?.scrollTo(i)}
            aria-label={`Go to ${s.label}`}
            className="group relative h-1.5 rounded-full transition-all duration-400 overflow-hidden"
            style={{ width: i === activeIndex ? 28 : 8 }}
          >
            <span
              className={`absolute inset-0 rounded-full transition-colors duration-300 ${
                i === activeIndex
                  ? "bg-white"
                  : "bg-white/30 group-hover:bg-white/50"
              }`}
            />
            {/* Auto-progress fill */}
            {i === activeIndex && (
              <span
                className="absolute inset-y-0 left-0 rounded-full bg-white"
                style={{
                  animation: `cta-progress ${AUTOPLAY_MS}ms linear`,
                }}
              />
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

export function CTA() {
  return (
    <section className="relative overflow-hidden bg-gradient-brand">
      <div className="absolute inset-0 grid-pattern opacity-15" />
      <div className="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-primary-glow/30 blur-3xl" />
      <div className="absolute -bottom-24 -right-24 h-72 w-72 rounded-full bg-background/20 blur-3xl" />

      <div className="relative mx-auto max-w-7xl px-4 py-16 sm:px-6 md:py-24">
        <div className="grid items-center gap-12 lg:grid-cols-[1.2fr_1fr] lg:gap-16">
          {/* Left — text */}
          <div>
            <h2 className="font-display text-4xl leading-[0.95] tracking-wide text-primary-foreground sm:text-5xl md:text-6xl lg:text-7xl">
              Ready to prove you&rsquo;re the best?
            </h2>
            <p className="mt-5 max-w-lg text-base text-primary-foreground/75 leading-relaxed">
              Create your free account, fund your wallet, and start competing in
              Fortnite, NBA 2K, Madden, and College Football today.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Button
                size="lg"
                asChild
                className="group h-13 bg-background px-8 font-display text-base tracking-[0.12em] text-foreground transition-all duration-300 hover:bg-background/90 hover:shadow-[0_0_24px_oklch(1_0_0_/_0.2)]"
              >
                <Link to="/register">
                  Create Account
                  <ArrowRight className="ml-1.5 h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
                </Link>
              </Button>
              <Button
                size="lg"
                variant="outline"
                asChild
                className="h-13 border-primary-foreground/30 bg-transparent px-8 font-display text-base tracking-[0.12em] text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
              >
                <Link to="/games">Browse Games</Link>
              </Button>
            </div>
            <div className="mt-7 font-display text-[11px] tracking-[0.22em] uppercase text-primary-foreground/50">
              No download required · $10 minimum entry · Free standard withdrawals
            </div>
          </div>

          {/* Right — slideshow */}
          <div className="relative">
            {/* Ambient glow behind slideshow */}
            <div className="absolute -inset-8 rounded-3xl bg-primary-glow/10 blur-3xl" />
            <div className="relative">
              <CTASlideshow />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
