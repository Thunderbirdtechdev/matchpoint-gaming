## Homepage Redesign — Midnight Indigo / Bold Sport / Split Hero

The waitlist overlay stays exactly as-is (still covers the homepage for non-admins). All work is presentation-only — no changes to auth, payouts, wallet, or admin logic.

### 1. Design tokens (`src/styles.css`)
Retune the existing dark esports system to the Midnight Indigo palette:
- `--background` → deep near-black navy (`#0a0a1a`), `--surface` → `#141432`, `--surface-elevated` → `#1e1e5a`
- `--primary` → electric indigo `#4f46e5`; keep a lighter indigo `--primary-glow` for gradients
- `--secondary` → a cooler violet-blue that sits between surface and primary
- `--accent` → keep a restrained gold/amber only for rank + prize highlights (small doses)
- Update `--gradient-brand`, `--gradient-hero`, `--gradient-card`, and glow shadows to the new indigo values

Typography: load **Bebas Neue** + **Barlow** via `<link>` tags in `src/routes/__root.tsx` head (never `@import` a URL in styles.css). Set `--font-display: "Bebas Neue"` and `--font-sans: "Barlow"` in `@theme`. Bebas is all-caps by nature, so drop redundant `uppercase font-black` and use wide tracking instead.

### 2. Hero → split-screen (`src/components/site/Hero.tsx`)
Full rewrite as a two-column layout (stacked on mobile, `lg:grid-cols-2`):
- **Left:** live status pill, oversized Bebas headline ("Play. Compete. Win."), one-line subhead, two CTAs (Enter the Arena / Browse Games), and a thin trust row (verified matches · fast payouts · anti-cheat)
- **Right:** a "live arena" panel — a glass card showing a mock live 1v1 match card (two players, stakes, timer) stacked with a compact top-3 leaderboard strip and a prize-pool counter. Static presentation data, no backend calls.
- Background: subtle grid pattern + two soft indigo glows; keep the hero image at low opacity behind the right panel only.

### 3. Section refresh (presentation only)
- **Stats** — pared to 4 numbers, mono-styled figures with Bebas labels, thin divider rules instead of card chrome
- **HowItWorks** — 5 steps become a horizontal numbered rail with connecting line; big Bebas step numerals
- **Features** — 8 cards keep the grid but adopt tighter borders, indigo icon wells, and hover lift consistent with the new tokens
- **LeaderboardPreview** — restyled to match the hero's panel treatment (shared visual language)
- **Testimonials** — 3 quote cards with larger pull-quote type and less card weight
- **CTA** — full-width indigo gradient band with oversized Bebas headline
- **Footer / Navbar** — token-driven updates only, so they inherit the new palette and fonts

### 4. Page flow (`src/routes/index.tsx`)
Keep section order and fade-in stagger; remove the smooth `scrollTo` on mount (it fights the overlay and causes a visible jump) in favor of an instant top position.

### 5. SEO
Keep the existing head metadata on `/` intact; no title/description changes.

### Technical notes
- Every color stays a semantic token — no hardcoded hex in components
- Header/stat rows use the `grid-cols-[minmax(0,1fr)_auto]` + `min-w-0` + `shrink-0` responsive pattern
- Verify with a Playwright screenshot at desktop and mobile widths before finishing
