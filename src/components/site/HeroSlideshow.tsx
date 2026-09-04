import { useState, useEffect, useCallback } from "react";
import useEmblaCarousel from "embla-carousel-react";
import { GAME_LABELS, type SupportedGame } from "@/lib/fees";
import { InductionBadge } from "@/components/ui/induction-badge";

/*
 * ⚠️ DO NOT re-add a byte-identical copy of an image under a second filename.
 *
 * Vite content-hashes assets, so two files with identical bytes collapse to ONE
 * emitted file — but the SSR build can still resolve an import to the OTHER
 * filename, which was never written. The result is a 404 on first paint that
 * "fixes itself" when you navigate away and back, because the client bundle
 * uses the name that does exist. That is exactly what happened to the NCAA
 * card: `card-ncaa.jpg` was byte-identical to `game-madden.jpg`, Vite emitted
 * only `game-madden-Beo2pbJs.jpg`, and the server-rendered HTML asked for
 * `card-ncaa-Beo2pbJs.jpg` → 404.
 *
 * One image, one file, imported wherever it is needed.
 */
import slideFortnite from "@/assets/slide-fortnite.jpg";
import slideMadden from "@/assets/slide-madden.jpg";
// slide-nba2k.jpg was byte-identical to card-nba2k.jpg; slide-mlb.jpg to
// card-mlbshow.jpg. The duplicates are gone and these are the canonical files.
import slideNba2k from "@/assets/card-nba2k.jpg";
// Official 'MLB The Show 26' cover (client-supplied), composited to 16:9 — see scripts/build-mlb-art.py.
import slideMlb from "@/assets/card-mlbshow.jpg";
// ⚠️ NCAA has no artwork of its own — this is the Madden image, and always was.
// slide-ncaa.png was a byte-identical copy of it. Replace this import when the
// client supplies real NCAA 27 cover art.
import slideNcaa from "@/assets/game-madden.jpg";

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
