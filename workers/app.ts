import { helmet } from '@nichtsam/helmet'
import * as Sentry from '@sentry/cloudflare'
import { createRequestHandler, type ServerBuild } from 'react-router'

declare module 'react-router' {
	interface AppLoadContext {
		cloudflare: { env: Env; ctx: ExecutionContext }
		// The sitemap route walks the route manifest to enumerate URLs.
		serverBuild: ServerBuild
	}
}

const MODE = import.meta.env.MODE
const IS_PROD = MODE === 'production'

const requestHandler = createRequestHandler(
	() => import('virtual:react-router/server-build'),
	MODE,
)

const handler: ExportedHandler<Env> = {
	async fetch(request, env, ctx) {
		const url = new URL(request.url)

		// Local dev and `npm start` both run on plain http://localhost, so the
		// canonicalisation below has to leave them alone.
		const isLocal = url.hostname === 'localhost' || url.hostname === '127.0.0.1'

		// One canonical origin: https, no www. Cloudflare doesn't send
		// X-Forwarded-Proto, so the scheme is read off the URL itself.
		if (request.method === 'GET' && !isLocal) {
			const needsHttps = url.protocol === 'http:'
			const needsApex = url.hostname === 'www.umbruchai.com'
			if (needsHttps || needsApex) {
				url.protocol = 'https:'
				if (needsApex) url.hostname = 'umbruchai.com'
				return Response.redirect(url.toString(), 301)
			}
		}

		// no ending slashes for SEO reasons
		// https://github.com/epicweb-dev/epic-stack/discussions/108
		if (url.pathname.length > 1 && url.pathname.endsWith('/')) {
			url.pathname = url.pathname.slice(0, -1).replace(/\/+/g, '/')
			return Response.redirect(url.toString(), 302)
		}

		// Static assets are served by Workers Assets before the Worker runs, so
		// if we're here the file genuinely doesn't exist. Don't spend a render on
		// it — and don't let Sentry hear about it either.
		if (/^\/(img|favicons)\//.test(url.pathname)) {
			return new Response('Not found', { status: 404 })
		}

		// Rate limiting lives in a WAF rate limiting rule on the zone, not here —
		// it runs ahead of the Worker and costs no invocation. See
		// docs/deployment.md.

		const response = await requestHandler(request, {
			cloudflare: { env, ctx },
			serverBuild: await import('virtual:react-router/server-build'),
		})

		// Responses coming back from React Router are constructed in-process, but
		// copy anyway so we're never mutating an immutable Headers guard.
		const headers = new Headers(response.headers)

		// The referrerPolicy breaks our redirectTo logic.
		// Content headers (CSP etc.) are set per-document in app/entry.server.tsx.
		helmet(headers, { general: { referrerPolicy: false } })

		// Versioned preview deploys are served from *.workers.dev; keep them out
		// of the index so they never compete with the canonical domain.
		if (
			env.ALLOW_INDEXING === 'false' ||
			url.hostname.endsWith('.workers.dev')
		) {
			headers.set('X-Robots-Tag', 'noindex, nofollow')
		}

		return new Response(response.body, {
			status: response.status,
			statusText: response.statusText,
			headers,
		})
	},
}

export default Sentry.withSentry(
	(env: Env) => ({
		dsn: env.SENTRY_DSN,
		environment: MODE,
		tracesSampleRate: IS_PROD ? 1 : 0,
	}),
	handler,
) satisfies ExportedHandler<Env>
