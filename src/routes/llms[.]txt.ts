import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";

const BODY = `# MatchPoint

> Skill-based competitive gaming platform for tournaments, challenges and rewards across Fortnite, Madden, NBA 2K, MLB The Show, Call of Duty and EA Sports FC.

MatchPoint lets players create challenges, enter tournaments, climb leaderboards and earn real cash payouts. Disputes are reviewed by human moderators and winnings are paid out from player wallets.

## Pages

- [Home](/): Overview of MatchPoint and featured competitions.
- [How it works](/how-it-works): From signup to payout in 5 steps.
- [Supported games](/games): All esports titles available on the platform.
- [About](/about): Company background and values.
- [FAQ](/faq): Common questions about payouts, disputes and supported games.
- [Contact](/contact): Support, partnerships and press inquiries.

## Optional

- [Privacy Policy](/privacy): Data collection and user rights.
- [Terms of Service](/terms): Account, fair play and payout terms.
`;

export const Route = createFileRoute("/llms.txt")({
  server: {
    handlers: {
      GET: async () =>
        new Response(BODY, {
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Cache-Control": "public, max-age=3600",
          },
        }),
    },
  },
});
