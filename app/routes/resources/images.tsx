import { invariantResponse } from '@epic-web/invariant'
import { getDomainUrl } from '#app/utils/misc.tsx'
import { type Route } from './+types/images'

// NOTE: add your CMS asset host here (e.g. https://cdn.sanity.io) so remote
// images can be optimized through this endpoint.
const EXTRA_ALLOWED_ORIGINS: Array<string> = []

const ALLOWED_FITS = new Set(['scale-down', 'contain', 'cover', 'crop', 'pad'])
const ALLOWED_FORMATS = new Set(['avif', 'webp'])

function positiveInt(value: string | null) {
	const parsed = Number(value)
	return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined
}

/**
 * Image optimization, handled by Cloudflare at the edge rather than by sharp
 * in-process. The client-side contract is unchanged — `openimg/react` still
 * builds the `?src=&w=&h=&fit=&format=` URLs, we just service them differently.
 *
 * Resizing requires Cloudflare Images to be enabled on the zone, and it only
 * applies on a custom domain — on `*.workers.dev` the `cf.image` options are
 * ignored and the original image comes back unchanged. That degrades
 * gracefully, so there's deliberately no fallback path here.
 */
export async function loader({ request }: Route.LoaderArgs) {
	const searchParams = new URL(request.url).searchParams

	const src = searchParams.get('src')
	invariantResponse(src, 'src query parameter is required', { status: 400 })

	// Relative sources (public folder + Vite assets) resolve against ourselves.
	let imageUrl: URL
	try {
		imageUrl = new URL(src, getDomainUrl(request))
	} catch {
		return new Response('Invalid src', { status: 400 })
	}

	const allowedOrigins = [
		new URL(getDomainUrl(request)).origin,
		...EXTRA_ALLOWED_ORIGINS,
	]
	invariantResponse(
		allowedOrigins.includes(imageUrl.origin),
		'src origin is not allowlisted',
		{ status: 403 },
	)

	const fit = searchParams.get('fit')
	const format = searchParams.get('format')

	const response = await fetch(imageUrl, {
		headers: {
			// Let Cloudflare pick avif/webp when the caller didn't ask explicitly.
			accept: request.headers.get('accept') ?? 'image/*',
		},
		cf: {
			cacheEverything: true,
			cacheTtl: 31536000,
			image: {
				width: positiveInt(searchParams.get('w')),
				height: positiveInt(searchParams.get('h')),
				fit: fit && ALLOWED_FITS.has(fit) ? fit : undefined,
				format: format && ALLOWED_FORMATS.has(format) ? format : 'auto',
			},
		},
	} as RequestInit)

	if (!response.ok) {
		return new Response('Image not found', { status: 404 })
	}

	const headers = new Headers()
	const contentType = response.headers.get('content-type')
	if (contentType) headers.set('Content-Type', contentType)
	headers.set('Cache-Control', 'public, max-age=31536000, immutable')

	return new Response(response.body, { status: 200, headers })
}
