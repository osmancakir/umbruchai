import {
	type Agency,
	type ArticleAuthor,
	type ArticleCategory,
	type LanguageLevel,
	type Leaning,
	type LeadingImage,
	type Region,
	type Role,
} from './articles.types.ts'
import { urlFor } from './sanity.ts'

// ─── Labels ──────────────────────────────────────────────────────────────────
// The magazine publishes in German, so the German label is the only label.

export const categoryLabels: Record<ArticleCategory, string> = {
	'politics-economics': 'Politik & Wirtschaft',
	culture: 'Kultur',
	health: 'Gesundheit',
	history: 'Geschichte',
	philosophy: 'Philosophie',
	science: 'Wissenschaft',
	society: 'Gesellschaft',
	sports: 'Sport',
	technology: 'Technologie',
	environment: 'Umwelt',
}

export const regionLabels: Record<Region, string> = {
	global: 'Global',
	africa: 'Afrika',
	asia: 'Asien',
	europe: 'Europa',
	'latin-america': 'Lateinamerika',
	'middle-east': 'Naher Osten',
	'north-america': 'Nordamerika',
	oceania: 'Ozeanien',
}

export const roleLabels: Record<Role, string> = {
	author: 'Autor',
	factChecker: 'Faktencheck',
	editor: 'Redaktion',
}

export const levelOptions = [
	{ value: 'easy', label: 'Einfach', short: 'EIN' },
	{ value: 'medium', label: 'Mittel', short: 'MIT' },
	{ value: 'advanced', label: 'Fortgeschritten', short: 'FOR' },
] as const satisfies ReadonlyArray<{
	value: LanguageLevel
	label: string
	short: string
}>

export const DEFAULT_LANGUAGE_LEVEL: LanguageLevel = 'easy'

/**
 * Both editorial scales are ordered, not categorical — that ordering is what
 * the stepped track in the UI renders. Index 0 is one end of the axis.
 */
export const agencyScale = [
	{ value: 'paralyzing', label: 'Lähmend', short: 'LÄ' },
	{ value: 'concerning', label: 'Besorgniserregend', short: 'BE' },
	{ value: 'neutral', label: 'Neutral', short: 'NT' },
	{ value: 'hopeful', label: 'Hoffnungsvoll', short: 'HF' },
	{ value: 'empowering', label: 'Stärkend', short: 'ST' },
] as const satisfies ReadonlyArray<{
	value: Agency
	label: string
	short: string
}>

export const leaningScale = [
	{ value: 'left', label: 'Links', short: 'L' },
	{ value: 'center-left', label: 'Mitte-Links', short: 'ML' },
	{ value: 'neutral', label: 'Neutral', short: 'N' },
	{ value: 'center-right', label: 'Mitte-Rechts', short: 'MR' },
	{ value: 'right', label: 'Rechts', short: 'R' },
] as const satisfies ReadonlyArray<{
	value: Leaning
	label: string
	short: string
}>

export const agencyLabels = Object.fromEntries(
	agencyScale.map((step) => [step.value, step.label]),
) as Record<Agency, string>

export const leaningLabels = Object.fromEntries(
	leaningScale.map((step) => [step.value, step.label]),
) as Record<Leaning, string>

// ─── Time ────────────────────────────────────────────────────────────────────

/**
 * Timestamps are UTC, always, per §07 of the brand document — no relative
 * "vor 3 Stunden", no local time. That also makes the string identical on the
 * server and in the browser, so it never trips hydration.
 */
export function formatTimestamp(value: string): string {
	const date = new Date(value)
	if (Number.isNaN(date.getTime())) return value
	const iso = date.toISOString()
	return `${iso.slice(0, 10)} · ${iso.slice(11, 16)} UTC`
}

/** The compact form used inside colophons: a bare ISO stamp to the minute. */
export function formatIsoMinute(value: string): string {
	const date = new Date(value)
	if (Number.isNaN(date.getTime())) return value
	return `${date.toISOString().slice(0, 16)}Z`
}

export function formatDateOnly(value: string): string {
	const date = new Date(value)
	if (Number.isNaN(date.getTime())) return value
	return date.toISOString().slice(0, 10)
}

// ─── Content helpers ─────────────────────────────────────────────────────────

/**
 * Not every level is filled in on every article. Fall back down the ladder
 * rather than rendering an empty headline.
 */
export function resolveLevelText(
	value: Partial<Record<LanguageLevel, string>> | undefined,
	level: LanguageLevel,
	fallback = 'Ohne Titel',
): string {
	return (
		value?.[level] ||
		value?.easy ||
		value?.medium ||
		value?.advanced ||
		fallback
	)
}

export function getAuthorInitials(name: string): string {
	return name
		.split(/\s+/)
		.filter(Boolean)
		.slice(0, 2)
		.map((part) => part[0]?.toUpperCase() ?? '')
		.join('')
}

/** Agent handles are how the colophon names an agent: `hannah-benjamin`. */
export function toAgentHandle(name: string): string {
	return name
		.toLowerCase()
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-|-$/g, '')
}

// ─── Images ──────────────────────────────────────────────────────────────────

export function resolveLeadingImageUrl(
	leadingImage: LeadingImage,
	width = 1200,
): string | null {
	if (leadingImage.image?.asset) {
		return urlFor(leadingImage.image).width(width).auto('format').url()
	}
	return leadingImage.externalUrl ?? null
}

export function resolveAuthorAvatarUrl(
	author: Pick<ArticleAuthor, 'avatar'>,
	width = 160,
	height = 160,
): string | null {
	if (!author.avatar?.asset) return null
	return urlFor(author.avatar)
		.width(width)
		.height(height)
		.fit('crop')
		.auto('format')
		.url()
}
