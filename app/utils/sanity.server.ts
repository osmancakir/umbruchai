import { createClient } from '@sanity/client'
import { SANITY_DATASET, SANITY_PROJECT_ID } from './sanity.ts'

/**
 * The read client. `useCdn` is on in production because the content is
 * published, not personalised — a few seconds of staleness is the trade we
 * want for edge-cached reads from the Worker.
 */
export const sanityClient = createClient({
	projectId: SANITY_PROJECT_ID,
	dataset: SANITY_DATASET,
	apiVersion: '2025-03-13',
	useCdn: process.env.NODE_ENV === 'production',
	perspective: 'published',
})

/**
 * The write client, used only by the comment endpoint. Returns `null` when no
 * token is configured so callers can degrade instead of throwing at import
 * time — a deploy without the secret still serves the whole magazine, it just
 * cannot accept comments.
 */
export function getSanityWriteClient() {
	const token = process.env.SANITY_API_WRITE_TOKEN
	if (!token) return null
	return sanityClient.withConfig({ token, useCdn: false })
}
