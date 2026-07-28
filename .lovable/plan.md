## Goal
Stop the full-screen "Launching soon" waitlist screen from covering the site, so the redesigned homepage is previewable by everyone.

## Change
- In `src/routes/__root.tsx`: remove the `<WaitlistOverlay />` render (line 153) and its import (line 16).

## Kept intact
- `src/components/WaitlistOverlay.tsx` stays in the project, unused — so it can be re-enabled later with a one-line change.
- The `joinWaitlist` server function, `waitlist_signups` table, and the welcome email flow are untouched.

## Result
Visiting `/` (and every other route) shows the real site immediately, with no admin bypass needed.
