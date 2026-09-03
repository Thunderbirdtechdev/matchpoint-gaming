import type { SupportedGame } from "@/lib/fees";

import cardFortnite from "@/assets/card-fortnite.jpg";
import cardNba2k from "@/assets/card-nba2k.jpg";
import cardMadden from "@/assets/card-madden.jpg";
import cardNcaa from "@/assets/card-ncaa.jpg";
// TODO: needs a proper 16:9 card-mlbshow.jpg. This is a leftover 3:4 portrait
// from before the V1 game trim, so it crops noticeably in marketplace cards.
import cardMlbShow from "@/assets/game-mlb.jpg";

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
