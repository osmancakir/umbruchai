import { type Route } from './+types/healthcheck.ts'

export async function loader({ request }: Route.LoaderArgs) {
	const host =
		request.headers.get('X-Forwarded-Host') ?? request.headers.get('host')

	try {
		// if we can make a HEAD request to ourselves, then we're good.
		const response = await fetch(`${new URL(request.url).protocol}${host}`, {
			method: 'HEAD',
			headers: { 'X-Healthcheck': 'true' },
		})
		if (!response.ok) return new Response('ERROR', { status: 500 })
		return new Response('OK')
	} catch (error: unknown) {
		console.log('healthcheck ❌', { error })
		return new Response('ERROR', { status: 500 })
	}
}
