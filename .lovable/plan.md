## Waitlist overlay

A full-screen "launching soon" overlay shown over every page. Visitors learn what MatchPoint is and can drop their email to be notified when we go live. Admins are automatically bypassed so the rest of the app stays usable for the team.

### What the user sees

- A fixed, full-viewport overlay that sits on top of the whole app (covers every route, including the home page and dashboards).
- Brand header: MatchPoint logo/wordmark, "Launching soon" badge.
- Headline + short pitch: skill-based competitive gaming platform — tournaments, 1v1 challenges, instant payouts.
- A "What you'll get at launch" section with 4 short bullets (Tournaments, 1v1 Challenges, Real cash prizes, Fair-play escrow).
- A trust strip (e.g., "Secure escrow · Stripe & crypto payouts · 18+").
- Email capture form: single email input + "Join the waitlist" button.
- Success state replaces the form with a confirmation message once submitted; remembers the user via localStorage so they don't see the form again on return.
- Subtle footer line: contact email + links to Terms / Privacy.

### Behavior

- Overlay renders from the root layout so it appears on every route on first paint.
- Hidden automatically when:
  - The signed-in user has the `admin` role (so the team can keep building/testing).
  - The visitor has already joined (flag stored in `localStorage`).
- After successful signup the overlay switches to a "You're on the list" confirmation but stays mounted so the underlying app remains hidden until launch.
- Duplicate emails are treated as success (idempotent).

### Backend

New `waitlist_signups` table (email unique, source, created_at, optional referrer). Row-level security:
- `anon` and `authenticated` can INSERT only.
- Only admins can SELECT (so the team can export the list later).
A public server function `joinWaitlist({ email })` validates with Zod, normalizes the email, inserts, and returns `{ ok: true }` on success or duplicate.

### Technical notes

- New file `src/components/WaitlistOverlay.tsx` (client component with form state).
- Mounted inside `RootComponent` in `src/routes/__root.tsx`, above `<Toaster />`, after `<Outlet />`.
- New server function in `src/lib/waitlist.functions.ts` (no auth middleware — public).
- Migration creates `public.waitlist_signups` with proper GRANTs, RLS enabled, and policies described above. Index on `lower(email)`.
- LocalStorage key: `mp_waitlist_joined`.
- Admin detection uses the existing `useAuth` hook + a lightweight role check (reuse the same pattern as the admin area).
