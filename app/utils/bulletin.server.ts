import { BulletinSchema, type Bulletin } from './bulletin.ts'
import { cache, cachified } from './cache.server.ts'
import { sanityClient } from './sanity.server.ts'
import { type Timings } from './timing.server.ts'

/**
 * The newest video bulletin the news desk has published. Like the filter
 * facets, it is the same for every reader and only changes once a day, so it
 * sits behind the memory cache rather than costing a Sanity round trip per
 * request.
 */
export async function getLatestBulletin({
	timings,
}: { timings?: Timings } = {}): Promise<Bulletin | null> {
	return cachified({
		key: 'bulletin:latest',
		cache,
		timings,
		ttl: 1000 * 60 * 5,
		staleWhileRevalidate: 1000 * 60 * 60,
		checkValue: BulletinSchema.nullable(),
		getFreshValue: async () => {
			const result = await sanityClient.fetch<unknown>(
				`*[_type == "bulletin" && defined(video.asset)] | order(date desc) [0] {
          _id,
          date,
          dateLabel,
          durationSec,
          "videoUrl": video.asset->url,
          "posterUrl": poster.asset->url,
          transcript,
          "stories": stories[defined(@->slug)]->{ "slug": slug.current, title }
        }`,
			)
			const parsed = BulletinSchema.nullable().safeParse(result)
			return parsed.success ? parsed.data : null
		},
	})
}
