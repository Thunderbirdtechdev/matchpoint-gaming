# MatchPoint — Product Requirements Document

## Overview
MatchPoint is a mobile-first (Expo/React Native + FastAPI + MongoDB) skill-based competitive gaming platform. Users can compete in head-to-head (H2H) challenges and tournaments, manage funds through a secure integrated wallet with real Stripe deposits, and receive automatic payouts.

## Tech Stack
- **Frontend**: Expo Router (React Native), Reanimated, Gesture Handler, Safe Area Context, Keyboard Controller, Blur, Linear Gradient, Ionicons
- **Backend**: FastAPI, Motor (async MongoDB), PyJWT, bcrypt, Stripe SDK, httpx (Resend integration)
- **Payments**: Stripe Checkout Sessions for deposits (test key)
- **Email**: Emergent-managed Resend for OTP delivery (with dev_code fallback)
- **Auth**: JWT + email 2FA + email verification + forgot/reset password

## Design
- Dark-First Utility esports theme (`#111210` surfaces, `#CCFF00` brand)
- Bottom-tab navigation (Home, Tournaments, Play, Wallet, Profile)
- Sticky primary CTAs, glass tab bar (iOS), gradient scrims on hero cards

## Implemented Features (MVP v1)
1. **Auth**: Register → email OTP → login → 2FA OTP → JWT session. Forgot password + reset. Session/device management with revoke.
2. **Profile**: Username, bio, avatar, favorite games, badges, stats (rank/wins/losses/earnings/matches), match history.
3. **Wallet**: Balance/pending/available/earnings, Stripe Checkout deposit (real), withdrawal with 2% fee (auto-completing), transaction history.
4. **Revenue Engine**: 10% platform fee on H2H settlements and tournaments, 2% on withdrawals, all logged in `revenue` collection.
5. **H2H Challenges**: Create → accept → both report → auto-payout (or dispute → admin review).
6. **Tournaments**: Public/private/invite/sponsored, register with entry fee, single-elimination bracket generation, sponsor field + banner.
7. **Sponsor Portal**: Any user (or admin) can create sponsored tournaments with sponsor name and banner URL.
8. **Leaderboards**: Global ranking, filterable by game.
9. **Notifications**: In-app notification list for deposits, withdrawals, prize payouts, match starting, tournament registration.
10. **Support**: Tickets (create/list), FAQ, Rules pages.
11. **Fair Play**: Result reporting with dispute flow; admin can resolve disputes and finalize winner.
12. **Advertising**: Ads endpoints + placement targeting (home/discover/tournaments); admin can create.
13. **Admin Dashboard**: Analytics, user management (suspend/unsuspend), disputes, revenue log.
14. **Meta**: Rules, FAQ, games/platforms/regions catalog.

## Seed Data
- Admin: `admin@matchpoint.gg` / `Admin@123`
- Demo user: `demo@matchpoint.gg` / `Demo@123` (pre-verified, $500 balance, 24W/11L)
- 4 sample tournaments across sponsored/public types.

## Non-MVP (Backlog)
- Live chat / websockets
- Full sponsor analytics dashboard
- Bracket progression UI (bracket is generated but no in-tournament match reporting yet)
- Withdrawal identity verification (KYC) workflow
- Advanced fraud detection
