import { z } from 'zod'
import {
	POLITICS_ECONOMICS_CATEGORY,
	type Agency,
	type Article,
	type ArticleCategory,
	type ArticleComment,
	type ArticleCommentStatus,
	type ArticleAuthor,
	type ArticleListItem,
	type AuthorEntity,
	type LanguageLevel,
	type Leaning,
} from './articles.types.ts'
import { cache, cachified } from './cache.server.ts'
import { getSanityWriteClient, sanityClient } from './sanity.server.ts'
import { type Timings } from './timing.server.ts'

const ARTICLE_CATEGORIES: ArticleCategory[] = [
	POLITICS_ECONOMICS_CATEGORY,
	'culture',
	'health',
	'history',
	'philosophy',
	'science',
	'society',
	'sports',
	'technology',
	'environment',
]

const AGENCY_VALUES: Agency[] = [
	'paralyzing',
	'concerning',
	'neutral',
	'hopeful',
	'empowering',
]

const LEANING_VALUES: Leaning[] = [
	'left',
	'center-left',
	'neutral',
	'center-right',
	'right',
]

/**
 * Agency and leaning are only editorially meaningful on Politik & Wirtschaft.
 * Projecting them conditionally means the rest of the magazine never carries a
 * framing label it did not earn.
 */
const POLITICAL_FRAMING_PROJECTION = `
  category == "${POLITICS_ECONOMICS_CATEGORY}" => {
    agencyLevel,
    leaning
  },
`

const LIST_PROJECTION = `
  _id,
  "slug": slug.current,
  date,
  featured,
  seriesOrder,
  region,
  title,
  subtitle,
  summary,
  series-> { _id, title, "slug": slug.current, description, coverImage { asset, hotspot, crop } },
  leadingImage {
    image { asset, hotspot, crop },
    externalUrl,
    alternativeText,
    caption,
    credit
  },
  sources[] { _key, name, href, initials },
  category,
  ${POLITICAL_FRAMING_PROJECTION}
  "agents": agents[]-> {
    _id, name, entity, role, email, avatar { asset, hotspot, crop, alt }
  },
  "tags": tags[]-> { _id, name, "slug": slug.current },
  language
`

const LEVEL_PROJECTION = `
  content,
  questions[] { _key, prompt, multi, options[] { _key, label, isCorrect } },
  vocabulary[] {
    _key, term, type, question, hint,
    options[] { _key, label, isCorrect, rationale },
    definition, example
  },
  audio { asset }
`

const DETAIL_PROJECTION = `
  _id,
  "slug": slug.current,
  date,
  featured,
  seriesOrder,
  region,
  title,
  subtitle,
  summary,
  series-> { _id, title, "slug": slug.current, description, coverImage { asset, hotspot, crop } },
  commentary {
    easy { humanConcern, opposingView, prompt },
    medium { humanConcern, opposingView, prompt },
    advanced { humanConcern, opposingView, prompt }
  },
  leadingImage {
    image { asset, hotspot, crop },
    externalUrl,
    alternativeText,
    caption,
    credit
  },
  category,
  ${POLITICAL_FRAMING_PROJECTION}
  "tags": tags[]-> { _id, name, "slug": slug.current },
  language,
  aiAuthor[] { _key, name, role, version },
  "agents": agents[]-> {
    _id, name, entity, role, email, avatar { asset, hotspot, crop, alt }, about
  },
  sources[] { _key, name, href, initials },
  relatedLinks[] { _key, name, href },
  levels {
    easy { ${LEVEL_PROJECTION} },
    medium { ${LEVEL_PROJECTION} },
    advanced { ${LEVEL_PROJECTION} }
  }
`

const AUTHOR_PROJECTION = `
  _id,
  name,
  entity,
  email,
  role,
  avatar { asset, hotspot, crop, alt },
  about,
  "articleCount": count(*[_type == "article" && ^._id in agents[]._ref])
`

const COMMENT_PROJECTION = `
  _id, level, body, userId, upvotes, status, trollingScore, aiConfidenceScore, createdAt
`

// ─── Normalisation ───────────────────────────────────────────────────────────

function oneOf<T extends string>(values: T[], value: unknown): T | undefined {
	return typeof value === 'string' && values.includes(value as T)
		? (value as T)
		: undefined
}

function normalizeAuthorEntity(value: unknown): AuthorEntity | undefined {
	return value === 'human' || value === 'ai' ? value : undefined
}

function normalizeAuthor(raw: Record<string, unknown>): ArticleAuthor {
	return {
		_id: String(raw._id ?? ''),
		name: String(raw.name ?? ''),
		entity: normalizeAuthorEntity(raw.entity),
		email: typeof raw.email === 'string' ? raw.email : undefined,
		role: raw.role as ArticleAuthor['role'],
		avatar: raw.avatar as ArticleAuthor['avatar'],
		about: Array.isArray(raw.about) ? raw.about : undefined,
		articleCount:
			typeof raw.articleCount === 'number'
				? Math.max(0, Math.floor(raw.articleCount))
				: undefined,
	}
}

function normalizeListItem(raw: Record<string, unknown>): ArticleListItem {
	const category = oneOf(ARTICLE_CATEGORIES, raw.category)
	const isPolitical = category === POLITICS_ECONOMICS_CATEGORY

	return {
		_id: String(raw._id ?? ''),
		slug: String(raw.slug ?? ''),
		date: String(raw.date ?? ''),
		featured: Boolean(raw.featured),
		series: raw.series as ArticleListItem['series'],
		seriesOrder:
			typeof raw.seriesOrder === 'number' ? raw.seriesOrder : undefined,
		agencyLevel: isPolitical
			? oneOf(AGENCY_VALUES, raw.agencyLevel)
			: undefined,
		leaning: isPolitical ? oneOf(LEANING_VALUES, raw.leaning) : undefined,
		region: raw.region as ArticleListItem['region'],
		title: (raw.title as ArticleListItem['title']) ?? {
			easy: '',
			medium: '',
			advanced: '',
		},
		subtitle: typeof raw.subtitle === 'string' ? raw.subtitle : undefined,
		summary: (raw.summary as ArticleListItem['summary']) ?? {
			easy: '',
			medium: '',
			advanced: '',
		},
		leadingImage: raw.leadingImage as ArticleListItem['leadingImage'],
		sources: Array.isArray(raw.sources)
			? (raw.sources as ArticleListItem['sources'])
			: [],
		agents: Array.isArray(raw.agents)
			? (raw.agents as ArticleListItem['agents'])
			: undefined,
		category,
		tags: Array.isArray(raw.tags)
			? (raw.tags as ArticleListItem['tags'])
			: undefined,
		language: raw.language as ArticleListItem['language'],
	}
}

function normalizeComment(raw: Record<string, unknown>): ArticleComment {
	const level = oneOf(['easy', 'medium', 'advanced'], raw.level) ?? 'easy'
	const status =
		oneOf(['pending', 'approved', 'rejected'], raw.status) ?? 'pending'
	return {
		_id: String(raw._id ?? ''),
		level: level as LanguageLevel,
		body: String(raw.body ?? ''),
		userId: typeof raw.userId === 'string' ? raw.userId : undefined,
		upvotes: typeof raw.upvotes === 'number' ? raw.upvotes : 0,
		status: status as ArticleCommentStatus,
		trollingScore:
			typeof raw.trollingScore === 'number' ? raw.trollingScore : undefined,
		aiConfidenceScore:
			typeof raw.aiConfidenceScore === 'number'
				? raw.aiConfidenceScore
				: undefined,
		createdAt: String(raw.createdAt ?? ''),
	}
}

// ─── Articles ────────────────────────────────────────────────────────────────

export type ArticleListFilters = {
	category?: ArticleCategory
	agency?: Agency
	leaning?: Leaning
}

function buildListConditions(filters?: ArticleListFilters) {
	const conditions = ['_type == "article"']
	const params: Record<string, unknown> = {}
	// A framing filter implies the political category even when none was named.
	const category =
		filters?.category ??
		(filters?.agency || filters?.leaning
			? POLITICS_ECONOMICS_CATEGORY
			: undefined)
	if (category) {
		conditions.push('category == $category')
		params.category = category
	}
	if (filters?.agency) {
		conditions.push('agencyLevel == $agency')
		params.agency = filters.agency
	}
	if (filters?.leaning) {
		conditions.push('leaning == $leaning')
		params.leaning = filters.leaning
	}
	return { filter: conditions.join(' && '), params }
}

export async function getArticleList(
	offset = 0,
	limit = 20,
	filters?: ArticleListFilters,
): Promise<ArticleListItem[]> {
	const { filter, params } = buildListConditions(filters)
	const results = await sanityClient.fetch<Record<string, unknown>[]>(
		`*[${filter}] | order(date desc) [$offset...$offset + $limit] { ${LIST_PROJECTION} }`,
		{ ...params, offset, limit },
	)
	return results.map(normalizeListItem)
}

export async function getArticleCount(
	filters?: ArticleListFilters,
): Promise<number> {
	const { filter, params } = buildListConditions(filters)
	return sanityClient.fetch<number>(`count(*[${filter}])`, params)
}

export type ArticleFramingPair = { agencyLevel: Agency; leaning: Leaning }

const FramingPairSchema = z.object({
	agencyLevel: z.enum(AGENCY_VALUES as [Agency, ...Agency[]]),
	leaning: z.enum(LEANING_VALUES as [Leaning, ...Leaning[]]),
})

/**
 * Which agency/leaning combinations actually exist. The index uses this to
 * strike through filter steps that would return nothing.
 *
 * This and `getPopulatedCategories` are the two queries the front page pays for
 * on every request while being identical for every reader and changing only
 * when something is published — the one place here where a cache earns its
 * complexity. Article content itself stays uncached and leans on the edge
 * `s-maxage` instead.
 */
export async function getArticleFramingPairs({
	timings,
}: { timings?: Timings } = {}): Promise<ArticleFramingPair[]> {
	return cachified({
		key: 'articles:framing-pairs',
		cache,
		timings,
		ttl: 1000 * 60 * 5,
		staleWhileRevalidate: 1000 * 60 * 60,
		checkValue: FramingPairSchema.array(),
		getFreshValue: async () => {
			const results = await sanityClient.fetch<Record<string, unknown>[]>(
				`*[
          _type == "article" &&
          category == $category &&
          defined(agencyLevel) &&
          defined(leaning)
        ] { agencyLevel, leaning }`,
				{ category: POLITICS_ECONOMICS_CATEGORY },
			)
			return results.flatMap((raw) => {
				const agencyLevel = oneOf(AGENCY_VALUES, raw.agencyLevel)
				const leaning = oneOf(LEANING_VALUES, raw.leaning)
				return agencyLevel && leaning ? [{ agencyLevel, leaning }] : []
			})
		},
	})
}

/** Categories that have at least one article, so the filter never lies. */
export async function getPopulatedCategories({
	timings,
}: { timings?: Timings } = {}): Promise<ArticleCategory[]> {
	return cachified({
		key: 'articles:populated-categories',
		cache,
		timings,
		ttl: 1000 * 60 * 5,
		staleWhileRevalidate: 1000 * 60 * 60,
		checkValue: z
			.enum(ARTICLE_CATEGORIES as [ArticleCategory, ...ArticleCategory[]])
			.array(),
		getFreshValue: async () => {
			const results = await sanityClient.fetch<unknown[]>(
				`array::unique(*[_type == "article" && defined(category)].category)`,
			)
			const populated = results.flatMap((value) => {
				const category = oneOf(ARTICLE_CATEGORIES, value)
				return category ? [category] : []
			})
			// Keep the canonical order rather than whatever Sanity returns.
			return ARTICLE_CATEGORIES.filter((category) =>
				populated.includes(category),
			)
		},
	})
}

export async function getArticleBySlug(slug: string): Promise<Article | null> {
	const result = await sanityClient.fetch<Article | null>(
		`*[_type == "article" && slug.current == $slug][0] { ${DETAIL_PROJECTION} }`,
		{ slug },
	)
	return result ?? null
}

/** Slug and publication date of every article, for the sitemap. */
export async function getArticleSitemapEntries(): Promise<
	Array<{ slug: string; date: string }>
> {
	return sanityClient.fetch<Array<{ slug: string; date: string }>>(
		`*[_type == "article" && defined(slug.current)] | order(date desc) {
      "slug": slug.current, date
    }`,
	)
}

/** Author ids that actually have a byline, for the sitemap. */
export async function getAuthorSitemapEntries(): Promise<string[]> {
	return sanityClient.fetch<string[]>(
		`array::unique(*[_type == "article"].agents[]._ref)`,
	)
}

/** Used by the comment endpoint to verify an article id before writing. */
export async function articleExists(articleId: string): Promise<boolean> {
	const result = await sanityClient.fetch<string | null>(
		`*[_type == "article" && _id == $articleId][0]._id`,
		{ articleId },
	)
	return Boolean(result)
}

// ─── Authors ─────────────────────────────────────────────────────────────────

/**
 * Authors are translated documents (`@sanity/document-internationalization`).
 * The reference on an article points at one language's document, so resolve
 * the German sibling through the translation metadata and fall back to the
 * referenced document when there is no translation.
 */
export async function getArticleAuthorById(
	authorId: string,
	language = 'de',
): Promise<ArticleAuthor | null> {
	const result = await sanityClient.fetch<{
		localized: Record<string, unknown> | null
		fallback: Record<string, unknown> | null
	}>(
		`{
      "localized": *[
        _type == "author" &&
        language == $language &&
        _id in *[_type == "translation.metadata" && references($authorId)][0].translations[].value._ref
      ][0] { ${AUTHOR_PROJECTION} },
      "fallback": *[_type == "author" && _id == $authorId][0] { ${AUTHOR_PROJECTION} }
    }`,
		{ authorId, language },
	)
	const raw = result.localized ?? result.fallback
	return raw ? normalizeAuthor(raw) : null
}

export async function getArticleListByAuthor(
	authorId: string,
	offset = 0,
	limit = 20,
): Promise<ArticleListItem[]> {
	const results = await sanityClient.fetch<Record<string, unknown>[]>(
		`*[
      _type == "article" &&
      $authorId in agents[]._ref
    ] | order(date desc) [$offset...$offset + $limit] { ${LIST_PROJECTION} }`,
		{ authorId, offset, limit },
	)
	return results.map(normalizeListItem)
}

export async function getArticleCountByAuthor(
	authorId: string,
): Promise<number> {
	return sanityClient.fetch<number>(
		`count(*[_type == "article" && $authorId in agents[]._ref])`,
		{ authorId },
	)
}

// ─── Comments ────────────────────────────────────────────────────────────────

/**
 * Readers see approved comments, plus their own while those await moderation —
 * otherwise filing a comment looks like it did nothing.
 */
export async function getArticleComments(
	articleId: string,
	viewerUserId?: string | null,
	level?: LanguageLevel,
): Promise<ArticleComment[]> {
	const viewerFilter = viewerUserId
		? `(status == "approved" || userId == $viewerUserId)`
		: `status == "approved"`
	const levelFilter = level ? `&& level == $level` : ''
	const results = await sanityClient.fetch<Record<string, unknown>[]>(
		`*[
      _type == "articleComment" &&
      article._ref == $articleId
      ${levelFilter}
      && ${viewerFilter}
    ] | order(createdAt desc) { ${COMMENT_PROJECTION} }`,
		{
			articleId,
			...(viewerUserId ? { viewerUserId } : {}),
			...(level ? { level } : {}),
		},
	)
	return results.map(normalizeComment)
}

export async function getArticleCommentCountByLevel(
	articleId: string,
	level: LanguageLevel,
): Promise<number> {
	return sanityClient.fetch<number>(
		`count(*[_type == "articleComment" && article._ref == $articleId && level == $level])`,
		{ articleId, level },
	)
}

export async function createArticleComment(input: {
	articleId: string
	level: LanguageLevel
	body: string
	userId: string
}): Promise<{ _id: string }> {
	const client = getSanityWriteClient()
	if (!client) throw new Error('SANITY_API_WRITE_TOKEN is not configured')

	// Everything arrives as `pending`: nothing a reader writes appears on the
	// site until it is approved in the Studio.
	return client.create({
		_type: 'articleComment',
		article: { _type: 'reference', _ref: input.articleId },
		level: input.level,
		body: input.body,
		userId: input.userId,
		upvotes: 0,
		status: 'pending',
		createdAt: new Date().toISOString(),
	})
}

export async function upvoteArticleComment(input: {
	commentId: string
	articleId: string
}) {
	const client = getSanityWriteClient()
	if (!client) throw new Error('SANITY_API_WRITE_TOKEN is not configured')

	const comment = await sanityClient.fetch<{ _id: string } | null>(
		`*[
      _type == "articleComment" &&
      _id == $commentId &&
      article._ref == $articleId
    ][0] { _id }`,
		{ commentId: input.commentId, articleId: input.articleId },
	)
	if (!comment?._id) return null

	return client
		.patch(comment._id)
		.setIfMissing({ upvotes: 0 })
		.inc({ upvotes: 1 })
		.commit()
}
