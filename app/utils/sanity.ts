import {
	createImageUrlBuilder,
	type SanityImageSource,
} from '@sanity/image-url'

/**
 * Public Sanity coordinates. These are not secrets — the dataset is public and
 * the same values are baked into every image URL we emit — so they live here
 * rather than behind `env.server.ts`, which keeps `urlFor` usable in components
 * that render on both sides of the wire.
 */
export const SANITY_PROJECT_ID = 'nws8g1b1'
export const SANITY_DATASET = 'production'

const builder = createImageUrlBuilder({
	projectId: SANITY_PROJECT_ID,
	dataset: SANITY_DATASET,
})

export function urlFor(source: SanityImageSource) {
	return builder.image(source)
}

/**
 * File assets (the read-aloud audio) have no URL builder of their own. Their
 * `_ref` is `file-{hash}-{ext}`, which maps straight onto the CDN path.
 */
export function fileUrlFor(ref: string): string | null {
	const [kind, id, ext] = ref.split('-')
	if (kind !== 'file' || !id || !ext) return null
	return `https://cdn.sanity.io/files/${SANITY_PROJECT_ID}/${SANITY_DATASET}/${id}.${ext}`
}
