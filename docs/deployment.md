# Deployment

Umbruch AI runs on **Cloudflare Workers** with
[Workers Assets](https://developers.cloudflare.com/workers/static-assets/) for
static files. There is no Node server, no container, and no origin to keep warm.

## Layout

| File                                    | Role                                                                                   |
| --------------------------------------- | -------------------------------------------------------------------------------------- |
| [`wrangler.jsonc`](../wrangler.jsonc)   | Worker name, compat flags, asset directory, custom domains, vars                       |
| [`workers/app.ts`](../workers/app.ts)   | The Worker entry: redirects, security headers, React Router handler                    |
| [`public/_headers`](../public/_headers) | Caching and security headers for responses served straight from Workers Assets         |
| `worker-configuration.d.ts`             | Generated `Env` types — refresh with `npm run cf-typegen` after editing wrangler.jsonc |

Static assets are served from the edge without invoking the Worker. Only
requests that don't match a file reach `workers/app.ts`.

## Commands

```sh
npm run dev      # vite dev, SSR running inside workerd
npm start        # serve the production build locally in workerd
npm run deploy   # build, then deploy to Cloudflare
npm run cf-typegen  # regenerate worker-configuration.d.ts
```

`npm run deploy` passes `-c build/server/wrangler.json`. That generated config
is what the Vite plugin emits after the build, with `main` and
`assets.directory` rewritten to point at the build output — a bare
`wrangler deploy` would read the root config and try to bundle `workers/app.ts`
itself, bypassing the Vite build.

## First deploy

```sh
npx wrangler login
npm run deploy
```

Then set the Sentry DSN as a secret (it is not in `wrangler.jsonc` on purpose):

```sh
npx wrangler secret put SENTRY_DSN
```

Locally the same value comes from `.env`, which the Vite plugin turns into
`.dev.vars` for the local workerd runtime.

## Environment variables

`ALLOW_INDEXING` lives in `wrangler.jsonc` under `vars`. Set it to `"false"` on
a staging Worker and every response picks up `X-Robots-Tag: noindex, nofollow`.

Note that `process.env.NODE_ENV` is **not** populated on Workers. Anything that
needs the current mode should read `import.meta.env.MODE`, which Vite replaces
statically at build time —
[`app/utils/env.server.ts`](../app/utils/env.server.ts) does exactly this.

## Domains

`umbruchai.com` is registered with Cloudflare, so the zone already lives in the
same account as the Worker. Both hostnames are declared as custom domains in
`wrangler.jsonc`:

```jsonc
"routes": [
  { "pattern": "umbruchai.com", "custom_domain": true },
  { "pattern": "www.umbruchai.com", "custom_domain": true },
],
"workers_dev": false,
```

`wrangler deploy` creates and owns the DNS records for both — there is nothing
to add by hand in the dashboard. www is attached to the same Worker only so it
can `301` to the apex; that redirect lives in `workers/app.ts` alongside the
http→https one, which keys off the request's own scheme because Cloudflare never
sends `X-Forwarded-Proto`.

`workers_dev: false` retires the `umbruchai-webapp.<subdomain>.workers.dev`
hostname so there's exactly one indexable origin. Per-version preview URLs are a
separate setting and still work; anything served from a `*.workers.dev` host
gets `X-Robots-Tag: noindex, nofollow` regardless of `ALLOW_INDEXING`.

Worth turning on once in the dashboard, under SSL/TLS for the zone:

- **Always Use HTTPS** — redirects at the edge, so the Worker isn't invoked for
  it. The in-Worker redirect stays as a backstop.
- **SSL/TLS mode: Full (strict)**.

## Rate limiting

Rate limiting is a **WAF rate limiting rule on the zone**, not a Worker binding.
The rule runs before the Worker, so floods are rejected without costing an
invocation, and it needs no code or redeploy to tune.

Configure it in the dashboard under _Security → WAF → Rate limiting rules_:

| Setting           | Value                            |
| ----------------- | -------------------------------- |
| Expression        | `(http.host eq "umbruchai.com")` |
| Characteristic    | IP address                       |
| Requests / period | 1000 per 1 minute                |
| Action            | Block, 60s timeout               |

That's the same budget the old `express-rate-limit` config used. Add a second,
stricter rule ahead of it for any endpoint that turns out to be expensive.

The
[rate limiting binding](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/)
was tried and removed: it's still under `unsafe` in Wrangler, printed an
experimental warning on every build, and did the same job later in the request
lifecycle.

## What Cloudflare replaced

| Was                               | Now                                             |
| --------------------------------- | ----------------------------------------------- |
| Express + `@react-router/express` | `workers/app.ts` + `@cloudflare/vite-plugin`    |
| `express.static`                  | Workers Assets + `public/_headers`              |
| `compression`                     | Cloudflare compresses responses automatically   |
| `morgan`                          | Workers observability (`observability.enabled`) |
| `express-rate-limit`              | WAF rate limiting rule on the zone              |
| `sharp` / `openimg/node`          | Cloudflare Images (`cf.image`)                  |
| `@sentry/profiling-node`          | `@sentry/cloudflare`                            |
| `renderToPipeableStream`          | `renderToReadableStream` (web streams)          |
