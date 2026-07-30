import * as cookie from 'cookie'

const cookieName = 'ub_reader'
const MAX_AGE = 60 * 60 * 24 * 365

/**
 * There are no accounts here. A comment still needs *some* identity so a reader
 * can see their own contribution while it waits for moderation, and so the
 * Studio can tell two anonymous voices apart — this cookie is that identity and
 * nothing more. It carries no personal data and is never used for tracking.
 */
export function getReaderId(request: Request): string | null {
	const header = request.headers.get('cookie')
	if (!header) return null
	const value = cookie.parse(header)[cookieName]
	return value && value.length > 0 ? value : null
}

export function createReaderId(): string {
	return `anon_${crypto.randomUUID()}`
}

export function serializeReaderId(readerId: string): string {
	return cookie.serialize(cookieName, readerId, {
		path: '/',
		maxAge: MAX_AGE,
		httpOnly: true,
		sameSite: 'lax',
		secure: process.env.NODE_ENV === 'production',
	})
}
