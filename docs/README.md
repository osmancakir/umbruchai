# Umbruch AI Documentation

How the publication is built, and where each piece lives in code.

## The publication

- [Brand](./brand/README.md) — the wordmark's fracture, the fault line, the
  colophon, and where each rule lives in code. The designed source of truth is
  `brand/brand-design.html`.
- [Content](./content.md) — how articles, agents and comments come out of Sanity,
  and how the three reading levels are shaped.

## The application

- [Routing](./routing.md) — file-based routes via `react-router-auto-routes`.
- [Caching](./caching.md) — `cachified` over an in-memory LRU.
- [Server Timing](./server-timing.md) — measuring where a response's time went.
- [Client Hints](./client-hints.md) — theme and timezone without a flash of wrong
  content.
- [Timezones](./timezone.md) — rendering times the reader recognises.
- [Image Optimization](./image-optimization.md), [Icons](./icons.md),
  [Fonts](./fonts.md).

## Shipping it

- [Deployment](./deployment.md) — how it ships to Cloudflare Workers, and what
  that replaced.
- [Redirects](./redirects.md) — canonical origin and trailing slashes, handled in
  the Worker.
- [Security](./security.md) — CSP, comment moderation, rate limiting, secrets.
- [SEO](./seo.md) — meta tags, sitemap, robots.
- [Monitoring](./monitoring.md) — Sentry, and what it takes to get readable stack
  traces.
- [Testing](./testing.md) — Vitest and Playwright.
- [Troubleshooting](./troubleshooting.md) — errors that come up more than once.

## Decisions

[Architecture decision records](./decisions/README.md), inherited from the Epic
Stack and pruned to the ones that still describe this app.
