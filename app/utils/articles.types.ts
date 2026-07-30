/**
 * The shape of the editorial content as it comes out of Sanity. Mirrors
 * `studio/schemaTypes/*` — when a schema field moves, it moves here too.
 */

export type Role = 'author' | 'factChecker' | 'editor'
export type AuthorEntity = 'human' | 'ai'

/** Three reading levels of the same article. The brand calls this "Niveau". */
export type LanguageLevel = 'easy' | 'medium' | 'advanced'
export const LANGUAGE_LEVELS = ['easy', 'medium', 'advanced'] as const

export const POLITICS_ECONOMICS_CATEGORY = 'politics-economics' as const

export type Agency =
	| 'paralyzing'
	| 'concerning'
	| 'neutral'
	| 'hopeful'
	| 'empowering'

export type Leaning =
	| 'left'
	| 'center-left'
	| 'neutral'
	| 'center-right'
	| 'right'

export type Region =
	| 'global'
	| 'africa'
	| 'asia'
	| 'europe'
	| 'latin-america'
	| 'middle-east'
	| 'north-america'
	| 'oceania'

export type ArticleCategory =
	| 'politics-economics'
	| 'culture'
	| 'health'
	| 'history'
	| 'philosophy'
	| 'science'
	| 'society'
	| 'sports'
	| 'technology'
	| 'environment'

export type ArticleLanguage = 'english' | 'german' | 'irish' | 'turkish'

export type SanityImageAsset = {
	_type?: 'image'
	asset: { _ref: string; _type: 'reference' }
	hotspot?: { x: number; y: number; height: number; width: number }
	crop?: { top: number; bottom: number; left: number; right: number }
	alt?: string
}

export type LeadingImage = {
	image?: SanityImageAsset
	externalUrl?: string
	alternativeText?: string
	caption?: string
	credit?: string
}

export type Tag = { _id: string; name: string; slug: string }

export type ArticleSource = {
	_key: string
	name: string
	href: string
	initials?: string
}

export type ArticleLink = { _key: string; name: string; href: string }

export type ArticleAiModel = {
	_key: string
	name: string
	role?: Role
	version?: string
}

export type ArticleAuthor = {
	_id: string
	name: string
	entity?: AuthorEntity
	email?: string
	role?: Role
	avatar?: SanityImageAsset
	about?: unknown[]
	articleCount?: number
}

export type ArticleSeries = {
	_id: string
	title: string
	slug: string
	description?: string
	coverImage?: SanityImageAsset
}

export type QuestionOption = { _key: string; label: string; isCorrect: boolean }

export type ArticleQuestion = {
	_key: string
	prompt: string
	multi: boolean
	options: QuestionOption[]
}

export type VocabularyOption = {
	_key: string
	label: string
	isCorrect: boolean
	rationale: string
}

export type VocabularyItem = {
	_key: string
	term: string
	type?: string
	question: string
	hint?: string
	options: VocabularyOption[]
	definition?: string
	example?: string
}

export type ArticleLevelContent = {
	content?: unknown[]
	questions?: ArticleQuestion[]
	vocabulary?: VocabularyItem[]
	audio?: { asset: { _ref: string; _type: 'reference' } }
}

export type ArticleCommentaryLevel = {
	humanConcern?: string
	opposingView?: string
	prompt?: string
}

export type ArticleCommentary = Partial<
	Record<LanguageLevel, ArticleCommentaryLevel>
>

export type ArticleCommentStatus = 'pending' | 'approved' | 'rejected'

export type ArticleComment = {
	_id: string
	level: LanguageLevel
	body: string
	userId?: string
	upvotes: number
	status: ArticleCommentStatus
	trollingScore?: number
	aiConfidenceScore?: number
	createdAt: string
}

/** A comment as the browser sees it: attributed, and flagged if it is yours. */
export type ArticleCommentWithAuthor = ArticleComment & {
	isOwnComment: boolean
	authorLabel: string
}

export type Article = {
	_id: string
	slug: string
	date: string
	featured: boolean
	series?: ArticleSeries
	seriesOrder?: number

	category?: ArticleCategory
	tags?: Tag[]
	region?: Region
	language?: ArticleLanguage

	agencyLevel?: Agency
	leaning?: Leaning

	title: Record<LanguageLevel, string>
	subtitle?: string
	summary: Record<LanguageLevel, string>

	commentary?: ArticleCommentary

	aiAuthor?: ArticleAiModel[]
	agents?: ArticleAuthor[]

	sources: ArticleSource[]
	relatedLinks?: ArticleLink[]

	leadingImage?: LeadingImage

	levels?: Record<LanguageLevel, ArticleLevelContent>
}

export type ArticleListItem = Pick<
	Article,
	| '_id'
	| 'slug'
	| 'date'
	| 'featured'
	| 'series'
	| 'seriesOrder'
	| 'agencyLevel'
	| 'leaning'
	| 'region'
	| 'title'
	| 'subtitle'
	| 'summary'
	| 'leadingImage'
	| 'category'
	| 'tags'
	| 'language'
	| 'sources'
	| 'agents'
>
