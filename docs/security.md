# Security

The attack surface here is small by construction: there are no user accounts, no
sessions, no passwords and no application database. The only writes a visitor can
cause are article comments, and those are moderated before anyone else sees them.

## Content Security Policy

CSP is set per-document in `app/entry.server.tsx` using
[`@nichtsam/helmet`](https://github.com/nichtsam/helmet). Scripts run under a
per-request nonce with `'strict-dynamic'`, generated in `createNonce()` and
threaded through `NonceProvider`.

The policy is currently **report-only** — violations are reported but nothing is
blocked. Remove `reportOnly: true` from the `contentSecurityPolicy` options to
enforce it. See [decision 008](./decisions/008-content-security-policy.md) and
[decision 022](./decisions/022-report-only-csp.md) for the background.

The remaining security headers are applied in `workers/app.ts`, where `helmet()`
runs over the response headers. `referrerPolicy` is disabled there deliberately,
because it breaks `redirectTo`.

## Comments

Comments are the only user-generated content. Every submission is parsed with a
Zod schema before it reaches Sanity, and lands as `status: "pending"` — invisible
to everyone but its author until it is approved in the Studio. See
[Content](./content.md).

Writing requires `SANITY_API_WRITE_TOKEN`. Without it the magazine still renders
in full; comments simply stop accepting new entries.

## Rate limiting

The app runs on Cloudflare Workers, where an in-process limiter doesn't work —
each request may hit a different isolate. Rate limiting is therefore a **WAF rate
limiting rule on the zone**, which runs ahead of the Worker and is keyed on the
real client IP. There is no rate limiting code in the app; see
[deployment.md](./deployment.md#rate-limiting) for the rule and its settings.

## Secrets

Local secrets go in `.env`, which is gitignored; `.env.example` lists the
variables. `app/utils/env.server.ts` validates them with Zod at startup and fails
loudly if something required is missing.

In production they are Cloudflare Worker secrets, set with
`wrangler secret put NAME` rather than committed to `wrangler.jsonc`. Only the
values returned by `getEnv()` are exposed to the client — everything else stays
server-side.

## Cross-site scripting

React escapes values by default. Article bodies arrive from Sanity as Portable
Text and are rendered through `app/components/article/portable-text.tsx`, which
maps blocks to components rather than injecting HTML. Avoid
`dangerouslySetInnerHTML`; never pass user-generated content to it.
