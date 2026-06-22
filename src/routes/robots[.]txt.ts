import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";

const BODY = `User-agent: *
Allow: /

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
