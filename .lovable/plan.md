## 1. Confirm email + grant admin for faizanjawad02@gmail.com

Run a single `supabase--insert` that:
- Marks `auth.users.email_confirmed_at = now()` for that email (so the account can sign in without waiting on the confirmation mail).
- Inserts an `admin` row into `public.user_roles` for that user (`ON CONFLICT DO NOTHING`), matching how your own account was set up. This lets the waitlist overlay bypass fire (admins are auto-bypassed).

No schema changes — this is a data-only update on existing tables.

## 2. Auth "Send Email" hook

Heads-up on how this actually works in Lovable Cloud: you don't get a Supabase dashboard, so the "Send Email hook" isn't something toggled in a Supabase UI here. In this project it's already wired end-to-end:

- Webhook route: `src/routes/lovable/email/auth/webhook.ts`
- Templates: `src/lib/email-templates/{signup,magic-link,recovery,invite,email-change,reauthentication}.tsx`
- Sender domain: `notify.matchpointgaming.org` (verified previously)

I'll verify the hook is actually firing by:
- Reading the webhook route to confirm it's the current handler.
- Pulling recent `auth_logs` via `supabase--analytics_query` for `path` containing `/lovable/email/auth/webhook` to confirm Supabase is calling it on signup/recovery.
- If no calls are landing, I'll flag it and we escalate — Lovable Cloud manages the hook binding; there is no self-serve config for me to flip.

Payout / deposit / waitlist emails do NOT go through the auth hook — those are enqueued directly by our server code via `enqueueAppEmail` → `transactional_emails` queue → `src/routes/lovable/email/queue/process.ts`. Nothing to change there; they already use our branded templates.

## 3. Site URL and Redirect URLs

Same caveat: on Lovable Cloud there's no exposed Supabase Auth "Site URL / Redirect URLs" screen, and the `configure_auth` tool available to me does not accept `site_url` or `additional_redirect_urls`. Lovable Cloud manages the canonical Site URL automatically based on your published domain (`matchpointgaming.org` / `matchpoint-gaming.lovable.app`), which is why OAuth and password-reset redirects have been working end-to-end.

I'll:
- Call `supabase--debug_oauth_server` (read-only) to print the current Site URL and trusted redirect allow-list, so you can see the actual values instead of assuming `localhost:3000`.
- If Site URL really is still `localhost:3000` or `matchpointgaming.org/**` is missing from the allow-list, I don't have a tool to write those directly — I'll tell you exactly what's set and we'll open a Lovable support request (this is the only path to change managed auth Site URL for a Cloud project).

## Order of operations

1. `supabase--insert` — confirm email + insert admin role.
2. `supabase--debug_oauth_server` — dump current Site URL + redirect allow-list.
3. `supabase--analytics_query` on `auth_logs` — verify the auth webhook is being called.
4. Report findings for #2 and #3; act only on what my tools can actually change.

## Not doing

- No code changes to templates, webhooks, or the waitlist overlay.
- No schema migrations.
- No changes to Stripe, payouts, or fees.
