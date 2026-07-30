# Redirects

Redirects happen in the Worker, in `workers/app.ts`, before React Router is
asked to render anything. There is no Express layer.

## One canonical origin

`GET` requests are canonicalised to `https://umbruchai.com` with a `301`: http
becomes https, and `www.umbruchai.com` becomes the apex domain. Cloudflare does
not send `X-Forwarded-Proto`, so the scheme is read straight off the request URL
rather than from a header.

`localhost` and `127.0.0.1` are exempt, because `npm run dev` and `npm start`
both serve plain http locally.

## Trailing slashes

`/foo/` redirects to `/foo` with a `302`, and repeated slashes are collapsed.
Crawlers treat those as distinct URLs, so leaving both live splits a page's
ranking between duplicates.

The root path is left alone.

## Missing assets

Requests under `/img/` and `/favicons/` that reach the Worker return a bare
`404`. Workers Assets serves real files before the Worker runs, so anything
arriving here genuinely does not exist — rendering a full React Router 404 for it
would waste an invocation, and reporting it to Sentry would be noise.

## Custom domains

Domains and routes are attached to the Worker in `wrangler.jsonc`, and DNS and
certificates are managed in the Cloudflare dashboard. See
[Deployment](./deployment.md).
