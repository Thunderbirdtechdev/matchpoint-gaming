import type { SupportedGame } from "@/lib/fees";

import cardFortnite from "@/assets/card-fortnite.jpg";
import cardNba2k from "@/assets/card-nba2k.jpg";
import cardMadden from "@/assets/card-madden.jpg";
// ⚠️ NCAA has no artwork of its own — this IS the Madden image, byte for byte.
// `card-ncaa.jpg` was a duplicate of it and caused a 404 on first paint (see
// the note in HeroSlideshow.tsx). Point this at real NCAA art when it exists.
import cardNcaa from "@/assets/game-madden.jpg";
// Official 'MLB The Show 26' cover (client-supplied), composited to 16:9 over a
// blurred blow-up of itself — see scripts/build-mlb-art.py.
import cardMlbShow from "@/assets/card-mlbshow.jpg";

/** Cover art per supported game, shared by the marketplace and homepage cards. */
export const GAME_ART: Record<SupportedGame, string> = {
  fortnite: cardFortnite,
  nba2k: cardNba2k,
  madden: cardMadden,
  ncaa: cardNcaa,
  mlbshow: cardMlbShow,
};

export function gameArt(slug: string): string {
  return GAME_ART[slug as SupportedGame] ?? cardFortnite;
}
