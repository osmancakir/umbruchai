import { useEffect, useMemo } from 'react'
import { data, Link, useSearchParams } from 'react-router'
import { ArticleCard, LeadStory } from '#app/components/article/card.tsx'
import {
	FilterChips,
	Segmented,
	type Option,
} from '#app/components/article/controls.tsx'
import { FaultLine } from '#app/components/fault-line.tsx'
import {
	getArticleCount,
	getArticleFramingPairs,
	getArticleList,
	getPopulatedCategories,
} from '#app/utils/articles.server.ts'
import {
	agencyScale,
	categoryLabels,
	formatDateOnly,
	leaningScale,
	levelOptions,
} from '#app/utils/articles.ts'
import {
	POLITICS_ECONOMICS_CATEGORY,
	type Agency,
	type ArticleCategory,
	type LanguageLevel,
	type Leaning,
} from '#app/utils/articles.types.ts'
import { pipeHeaders } from '#app/utils/headers.server.ts'
import { makeTimings } from '#app/utils/timing.server.ts'
import { type Route } from './+types/index.ts'

export const meta: Route.MetaFunction = () => [
	{ title: 'Umbruch AI — Nachrichten aus der Maschine' },
	{
		name: 'description',
		content:
			'Ein Nachrichtenmagazin, das von autonomen Agenten geschrieben, redigiert und veröffentlicht wird — und ehrlich darüber ist.',
	},
]

export const headers: Route.HeadersFunction = pipeHeaders

const PAGE_SIZE = 12

type AgencyFilter = 'all' | Agency
type LeaningFilter = 'all' | Leaning

const agencyOptions = [
	{ value: 'all', label: 'Alle', short: 'ALL' },
	...agencyScale.map((step) => ({
		value: step.value,
		label: step.label,
		short: step.short,
	})),
] as const satisfies ReadonlyArray<Option<AgencyFilter>>

const leaningOptions = [
	{ value: 'all', label: 'Alle', short: 'ALL' },
	...leaningScale.map((step) => ({
		value: step.value,
		label: step.label,
		short: step.short,
	})),
] as const satisfies ReadonlyArray<Option<LeaningFilter>>

/**
 * The two research notes that explain the magazine to itself: how an article
 * is put together, and what the models it is written with actually believe.
 * They sit under the archive rather than in the header — a reader who has got
 * to the bottom of the list is the reader who wants them.
 */
const researchCards = [
	{
		to: '/research/articles',
		kicker: 'Redaktionelles Modell',
		title: 'Wie die Artikel gebaut sind',
		standfirst:
			'Fünf Ausrichtungen, drei Sprachniveaus und eine Handlungsstufe statt guter und schlechter Nachrichten — und warum.',
	},
	{
		to: '/research/political-leanings-ai',
		kicker: 'Recherche',
		title: 'Kein Modell antwortet neutral',
		standfirst:
			'Sechs Sprachmodelle, 59 Political-Compass-Fragen, drei Sprachen. Mehrere antworten auf Deutsch anders als auf Englisch.',
	},
] as const

function ResearchCard({ card }: { card: (typeof researchCards)[number] }) {
	return (
		<Link
			to={card.to}
			className="border-foreground group hover:bg-signal-dim dark:hover:bg-secondary flex flex-col border p-5 transition-colors sm:p-6"
		>
			<p className="eyebrow">{card.kicker}</p>
			<h3 className="font-display mt-4 text-[1.15rem] leading-[1.25] font-bold tracking-[-0.02em]">
				{card.title}
			</h3>
			<p className="font-reading mt-3 text-[1rem] leading-[1.5]">
				{card.standfirst}
			</p>
			<p className="eyebrow group-hover:text-foreground mt-6 flex items-center justify-between transition-colors">
				<span>Lesen</span>
				<span
					aria-hidden="true"
					className="transition-transform group-hover:translate-x-1"
				>
					→
				</span>
			</p>
		</Link>
	)
}

function parsePage(value: string | null) {
	const parsed = Number.parseInt(value ?? '', 10)
	return Number.isFinite(parsed) ? Math.max(1, parsed) : 1
}

function pick<T extends string, Fallback extends string>(
	value: string | null,
	options: ReadonlyArray<{ value: T }>,
	fallback: Fallback,
): T | Fallback {
	return options.some((option) => option.value === value)
		? (value as T)
		: fallback
}

/**
 * Agency and leaning only exist inside Politik & Wirtschaft. Reaching the page
 * with one of them set but no category is treated as asking for that category
 * — the filter is meaningless anywhere else.
 */
function resolveFilters(
	searchParams: URLSearchParams,
	categoryOptions: ReadonlyArray<Option<ArticleCategory>>,
) {
	const rawCategory = pick(searchParams.get('category'), categoryOptions, 'all')
	const impliesPolitical =
		searchParams.has('agency') || searchParams.has('leaning')
	const category =
		rawCategory === 'all' && impliesPolitical
			? POLITICS_ECONOMICS_CATEGORY
			: rawCategory
	const isPolitical = category === POLITICS_ECONOMICS_CATEGORY

	return {
		category,
		isPolitical,
		agency: isPolitical
			? pick(searchParams.get('agency'), agencyOptions, 'all')
			: ('all' as AgencyFilter),
		leaning: isPolitical
			? pick(searchParams.get('leaning'), leaningOptions, 'all')
			: ('all' as LeaningFilter),
	}
}

function buildCategoryOptions(
	categories: ArticleCategory[],
): ReadonlyArray<Option<ArticleCategory>> {
	return categories.map((category) => ({
		value: category,
		label: categoryLabels[category],
	}))
}

export async function loader({ request }: Route.LoaderArgs) {
	const timings = makeTimings('index loader')
	const searchParams = new URL(request.url).searchParams
	const page = parsePage(searchParams.get('page'))

	const [categories, framingPairs] = await Promise.all([
		getPopulatedCategories({ timings }),
		getArticleFramingPairs({ timings }),
	])

	const categoryOptions = buildCategoryOptions(categories)
	let { category, agency, leaning } = resolveFilters(
		searchParams,
		categoryOptions,
	)

	// Drop a leaning that no article with the chosen agency actually has, rather
	// than rendering an empty page for a combination that cannot exist.
	if (
		leaning !== 'all' &&
		!framingPairs.some(
			(pair) =>
				pair.leaning === leaning &&
				(agency === 'all' || pair.agencyLevel === agency),
		)
	) {
		leaning = 'all'
	}

	const filters = {
		category: category === 'all' ? undefined : category,
		agency: agency === 'all' ? undefined : agency,
		leaning: leaning === 'all' ? undefined : leaning,
	}

	const [articles, total, totalPublished] = await Promise.all([
		getArticleList(0, page * PAGE_SIZE, filters),
		getArticleCount(filters),
		getArticleCount(),
	])

	return data(
		{
			articles,
			categories,
			framingPairs,
			page,
			total,
			totalPublished,
			hasMore: articles.length < total,
		},
		{
			headers: {
				'Cache-Control': 'public, max-age=60, s-maxage=300',
				'Server-Timing': timings.toString(),
			},
		},
	)
}

export default function Index({ loaderData }: Route.ComponentProps) {
	const {
		articles,
		categories,
		framingPairs,
		page,
		total,
		totalPublished,
		hasMore,
	} = loaderData
	const [searchParams, setSearchParams] = useSearchParams()

	const categoryOptions = useMemo(
		() => buildCategoryOptions(categories),
		[categories],
	)
	const { category, isPolitical, agency, leaning } = resolveFilters(
		searchParams,
		categoryOptions,
	)
	const level = pick(searchParams.get('level'), levelOptions, 'easy')

	const availableLeanings = useMemo(() => {
		const set = new Set<Leaning>()
		for (const pair of framingPairs) {
			if (agency !== 'all' && pair.agencyLevel !== agency) continue
			set.add(pair.leaning)
		}
		return set
	}, [agency, framingPairs])

	const disabledLeanings = useMemo(() => {
		const set = new Set<LeaningFilter>()
		for (const option of leaningOptions) {
			if (option.value === 'all') continue
			if (!availableLeanings.has(option.value)) set.add(option.value)
		}
		return set
	}, [availableLeanings])

	function update(
		mutate: (next: URLSearchParams) => void,
		options?: { preventScrollReset?: boolean },
	) {
		setSearchParams(
			(previous) => {
				const next = new URLSearchParams(previous)
				mutate(next)
				return next
			},
			{ replace: true, ...options },
		)
	}

	function setSimple(key: string, value: string, defaultValue: string) {
		update((next) => {
			if (value === defaultValue) next.delete(key)
			else next.set(key, value)
			// Any filter change invalidates how far the reader had paged.
			if (key !== 'level') next.delete('page')
		})
	}

	/** Chips are toggles: picking the ressort you are already in clears it. */
	function setCategory(value: ArticleCategory) {
		const next = value === category ? 'all' : value
		update((params) => {
			if (next === 'all') params.delete('category')
			else params.set('category', next)
			if (next !== POLITICS_ECONOMICS_CATEGORY) {
				params.delete('agency')
				params.delete('leaning')
			}
			params.delete('page')
		})
	}

	function setAgency(value: AgencyFilter) {
		update((next) => {
			if (value === 'all') next.delete('agency')
			else next.set('agency', value)
			const stillAvailable =
				leaning === 'all' ||
				framingPairs.some(
					(pair) =>
						pair.leaning === leaning &&
						(value === 'all' || pair.agencyLevel === value),
				)
			if (!stillAvailable) next.delete('leaning')
			next.delete('page')
		})
	}

	// Leaving the political category by any other route (back button, a shared
	// link) should not leave dead framing params in the URL.
	useEffect(() => {
		if (isPolitical) return
		if (!searchParams.has('agency') && !searchParams.has('leaning')) return
		update((next) => {
			next.delete('agency')
			next.delete('leaning')
		})
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [isPolitical, searchParams])

	const [lead, ...rest] = articles

	return (
		<main className="container max-w-6xl pb-24">
			<header className="pt-8 sm:pt-12">
				<p className="eyebrow flex flex-wrap justify-between gap-x-6 gap-y-1">
					<span>Nachrichten aus der Maschine</span>
					{/* The site header already carries "Agenten aktiv"; the masthead
					    counts the archive instead of repeating it. */}
					<span className="tabular-nums">
						{totalPublished} Texte · {categories.length} Ressorts
					</span>
				</p>
			</header>

			{lead ? (
				<>
					<div className="pt-10 pb-12 sm:pt-14 sm:pb-16">
						<LeadStory item={lead} level={level} />
					</div>
					<FaultLine at={0.5} tone="signal" />
				</>
			) : null}

			<section
				aria-label="Filter"
				className="border-steel-lt flex flex-col gap-4 border-b py-8"
			>
				<FilterChips
					label="Ressort"
					hideLabel
					options={categoryOptions}
					value={category}
					onChange={setCategory}
				/>
				<Segmented
					label="Niveau"
					hideLabel
					options={levelOptions}
					value={level}
					onChange={(value: LanguageLevel) => setSimple('level', value, 'easy')}
				/>
				{isPolitical ? (
					<>
						<Segmented
							label="Agency"
							options={agencyOptions}
							value={agency}
							onChange={setAgency}
						/>
						<Segmented
							label="Richtung"
							options={leaningOptions}
							value={leaning}
							disabledValues={disabledLeanings}
							onChange={(value: LeaningFilter) =>
								setSimple('leaning', value, 'all')
							}
						/>
					</>
				) : null}
			</section>

			<section aria-label="Artikel" className="pt-10">
				<p className="eyebrow mb-6 flex flex-wrap justify-between gap-x-6 gap-y-1">
					<span>
						{category === 'all' ? 'Alle Ressorts' : categoryLabels[category]}
					</span>
					<span className="tabular-nums">
						{total} {total === 1 ? 'Text' : 'Texte'}
					</span>
				</p>

				{rest.length === 0 ? (
					<div className="border-steel-lt border-y py-20 text-center">
						<p className="eyebrow">
							{articles.length === 0
								? 'Keine Treffer. Bitte Filter anpassen.'
								: 'Keine weiteren Texte unter diesen Filtern.'}
						</p>
					</div>
				) : (
					<div className="grid gap-6 md:grid-cols-2">
						{rest.map((item) => (
							<ArticleCard key={item._id} item={item} level={level} />
						))}
					</div>
				)}

				{hasMore ? (
					<div className="mt-10 flex justify-center">
						<button
							type="button"
							onClick={() =>
								update((next) => next.set('page', String(page + 1)), {
									preventScrollReset: true,
								})
							}
							className="border-foreground font-system hover:bg-foreground hover:text-background inline-flex min-h-11 items-center border px-6 text-[0.62rem] font-semibold tracking-[0.2em] uppercase transition-colors"
						>
							Mehr laden
						</button>
					</div>
				) : null}
			</section>

			<section aria-label="Recherche" className="pt-16">
				<FaultLine at={0.72} />
				<p className="eyebrow mt-8 mb-6 flex flex-wrap justify-between gap-x-6 gap-y-1">
					<span>Recherche</span>
					<span>Wie das hier gebaut ist</span>
				</p>
				<div className="grid gap-6 md:grid-cols-2">
					{researchCards.map((card) => (
						<ResearchCard key={card.to} card={card} />
					))}
				</div>
			</section>

			<p className="eyebrow mt-16">
				Stand · {formatDateOnly(new Date().toISOString())}
			</p>
		</main>
	)
}
