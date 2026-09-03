import { useState, useEffect, useCallback } from "react";
import useEmblaCarousel from "embla-carousel-react";
import { GAME_LABELS, type SupportedGame } from "@/lib/fees";
import { InductionBadge } from "@/components/ui/induction-badge";

import slideFortnite from "@/assets/slide-fortnite.jpg";
import slideNba2k from "@/assets/slide-nba2k.jpg";
import slideMadden from "@/assets/slide-madden.jpg";
import slideNcaa from "@/assets/slide-ncaa.png";
// TODO: 3:4 portrait standing in for a 16:10 slide — crops. Needs real MLB art.
import slideMlb from "@/assets/game-mlb.jpg";

const slides: { game: SupportedGame; img: string; tagline: string }[] = [
  { game: "fortnite", img: slideFortnite, tagline: "Build. Fight. Dominate." },
  { game: "nba2k", img: slideNba2k, tagline: "Hit the court. Take the crown." },
  { game: "madden", img: slideMadden, tagline: "Call the plays. Win the game." },
  { game: "ncaa", img: slideNcaa, tagline: "Friday nights. Real stakes." },
  { game: "mlbshow", img: slideMlb, tagline: "Step up. Go yard. Get paid." },
];

const AUTOPLAY_MS = 4500;

export function HeroSlideshow() {
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true, duration: 30 });
  const [activeIndex, setActiveIndex] = useState(0);

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setActiveIndex(emblaApi.selectedScrollSnap());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    emblaApi.on("select", onSelect);
    onSelect();
    return () => {
      emblaApi.off("select", onSelect);
    };
  }, [emblaApi, onSelect]);

  // Autoplay
  useEffect(() => {
    if (!emblaApi) return;
    const id = setInterval(() => emblaApi.scrollNext(), AUTOPLAY_MS);
    return () => clearInterval(id);
  }, [emblaApi]);

  return (
    <div className="relative w-full overflow-hidden rounded-2xl border border-border/60 shadow-elevated">
      {/* Carousel viewport */}
      <div ref={emblaRef} className="overflow-hidden">
        <div className="flex">
          {slides.map((s) => (
            <div key={s.game} className="relative min-w-0 flex-[0_0_100%]">
              <div className="relative aspect-[16/10] overflow-hidden sm:aspect-[4/3] lg:aspect-[16/10]">
                <img
                  src={s.img}
                  alt={GAME_LABELS[s.game]}
                  className="h-full w-full object-cover object-[center_30%]"
                  loading="eager"
                  width={1920}
                  height={1080}
                />
                {/* Gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-background via-background/50 to-transparent" />
                <div className="absolute inset-0 bg-gradient-to-r from-background/40 to-transparent" />
              </div>

              {/* Slide content */}
              <div className="absolute inset-x-0 bottom-0 p-5 sm:p-7">
                <InductionBadge className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/15 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-primary-glow backdrop-blur-sm">
                  Live on MatchPoint
                </InductionBadge>
                <h3 className="mt-3 font-display text-3xl tracking-wide sm:text-4xl">
                  {GAME_LABELS[s.game]}
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">{s.tagline}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Dot indicators */}
      <div className="absolute bottom-3 right-4 flex items-center gap-2 sm:bottom-5 sm:right-6">
        {slides.map((s, i) => (
          <button
            key={s.game}
            type="button"
            onClick={() => emblaApi?.scrollTo(i)}
            aria-label={`Go to ${GAME_LABELS[s.game]}`}
            aria-current={i === activeIndex}
            className="group relative flex h-4 w-4 items-center justify-center"
          >
            <span
              className={`h-2 w-2 rounded-full transition-all duration-300 ${
                i === activeIndex
                  ? "scale-125 bg-primary-glow shadow-[0_0_10px_var(--primary-glow)]"
                  : "bg-foreground/30 group-hover:bg-foreground/60"
              }`}
            />
          </button>
        ))}
      </div>
    </div>
  );
}
