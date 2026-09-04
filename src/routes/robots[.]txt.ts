import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";

/*
 * Module 11.
 *
 * Everything was previously Allow: / with no exclusions, which sent crawlers
 * through the signed-in app and the mail plumbing. None of it is a security
 * boundary — those routes redirect or require a token — but two of them matter:
 *
 *   /email/  — the unsubscribe link. A GET there is read-only (the actual
 *              unsubscribe is a POST), so a crawler cannot unsubscribe anyone,
 *              but the URLs carry per-recipient tokens and have no business in
 *              a search index.
 *   /lovable/ — internal email queue and preview endpoints.
 *
 * The rest are authenticated routes that would only ever be indexed as a login
 * redirect, which is wasted crawl budget pointed at a page that says nothing.
 */
const BODY = `User-agent: *
Allow: /

Disallow: /email/
Disallow: /lovable/
Disallow: /admin
Disallow: /finance
Disallow: /security
Disallow: /payouts
Disallow: /analytics
Disallow: /moderator
Disallow: /wallet
Disallow: /dispute-center
Disallow: /reset-password
Disallow: /forgot-password

Sitemap: https://matchpointgaming.org/sitemap.xml
`;

export const Route = createFileRoute("/robots.txt")({
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
