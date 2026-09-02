import type { SupportedGame } from "@/lib/fees";

import cardFortnite from "@/assets/card-fortnite.jpg";
import cardNba2k from "@/assets/card-nba2k.jpg";
import cardMadden from "@/assets/card-madden.jpg";
import cardNcaa from "@/assets/card-ncaa.jpg";

/** Cover art per supported game, shared by the marketplace and homepage cards. */
export const GAME_ART: Record<SupportedGame, string> = {
  fortnite: cardFortnite,
  nba2k: cardNba2k,
  madden: cardMadden,
  ncaa: cardNcaa,
};

export function gameArt(slug: string): string {
  return GAME_ART[slug as SupportedGame] ?? cardFortnite;
}
