import { type SEOHandle } from '@nasa-gcn/remix-seo'
import { useEffect, useRef, useState } from 'react'
import { data } from 'react-router'
import { ArticleQuiz } from '#app/components/article/quiz.tsx'
import { VocabularyQuiz } from '#app/components/article/vocabulary.tsx'
import { FaultLine } from '#app/components/fault-line.tsx'
import { Wordmark } from '#app/components/wordmark.tsx'
import {
	analyzePoliticalCompass,
	type AnalysisModel,
	type AnalysisQuestion,
} from '#app/routes/research/+analysis.ts'
import { getArticleBySlug } from '#app/utils/articles.server.ts'
import {
	agencyScale,
	getAuthorInitials,
	leaningScale,
} from '#app/utils/articles.ts'
import {
	type ArticleQuestion,
	type Leaning,
	type VocabularyItem,
} from '#app/utils/articles.types.ts'
import { cn } from '#app/utils/misc.tsx'
import { sanityClient } from '#app/utils/sanity.server.ts'
import { urlFor } from '#app/utils/sanity.ts'
import { type Route } from './+types/presentation-referat.ts'

export const meta: Route.MetaFunction = () => [
	{ title: 'KI & Journalismus — Referat' },
	{ name: 'robots', content: 'noindex, nofollow' },
]

/**
 * The deck is an unlisted talk, not part of the magazine: returning no entries
 * keeps `generateSitemap` from advertising it alongside the articles.
 */
export const handle: SEOHandle = {
	getSitemapEntries: () => null,
}

const TOTAL_SLIDES = 13

/** The article the live demo slides pull from. */
const DEMO_ARTICLE_SLUG = 'germany-sugar-tax-public-health-lobby-power'

/**
 * The agents, keyed by the English author document that `article.agents`
 * references; the German sibling carrying the portrait is looked up by email.
 */
const AGENTS = [
	{
		authorId: '66e48be4-e8ca-4639-a529-2ee6d57cba83',
		email: 'george-bourdieu@libraryuniverse.com',
		name: 'George Bourdieu',
		focus: 'Macht, Institutionen, Ungleichheit',
	},
	{
		authorId: '29f5a470-9167-41ed-b267-5e616d2f1b5f',
		email: 'william-brooks@libraryuniverse.com',
		name: 'William F. Brooks',
		focus: 'Konservatismus, Institutionen, Regierungsführung',
	},
	{
		authorId: 'be42e143-977a-48ce-85b0-cc25ef466b56',
		email: 'hannah-benjamin@libraryuniverse.com',
		name: 'Hannah Benjamin',
		focus: 'Kultur, Gedächtnis, Kritik',
	},
	{
		authorId: '750a2558-8463-483f-aedc-f00e0f60c82f',
		email: 'carl-frankl@libraryuniverse.com',
		name: 'Carl Frankl',
		focus: 'Gesundheit, Unsicherheit, Wohlbefinden',
	},
	{
		authorId: 'd7dc6c3f-5051-41d1-860b-6aa61356dbf8',
		email: 'isaac-sagan@libraryuniverse.com',
		name: 'Isaac Sagan',
		focus: 'Wissenschaft, Technologie, Aufmerksamkeit',
	},
] as const

const leaningLabelByValue = Object.fromEntries(
	leaningScale.map((step) => [step.value, step.label]),
) as Record<Leaning, string>

// ─── Loader ──────────────────────────────────────────────────────────────────

const COMPASS_QUERY = `{
  "models": *[_type == "aiModel" && active == true] | order(name asc) {
    _id, name, "slug": slug.current
  },
  "questions": *[_type == "politicalQuestion" && active == true] {
    canonicalText, theme, "slug": slug.current
  },
  "runs": *[_type == "politicalSurveyRun" && language->code == "de"] | order(date desc) {
    "modelSlug": model->slug.current,
    answers[] { answer, "questionSlug": question->slug.current }
  }
}`

const AGENT_QUERY = `{
  "authors": *[_type == "author" && language == "de" && email in $emails] {
    email, avatar { asset, hotspot, crop, alt }
  },
  "framings": *[_type == "article" && defined(leaning)] {
    leaning, "authorIds": agents[]._ref
  }
}`

const ANSWER_ABBREVIATIONS = {
	strongly_disagree: 'SD',
	disagree: 'D',
	agree: 'A',
	strongly_agree: 'SA',
} as const

type CompassPoint = {
	modelId: string
	modelName: string
	x: number
	y: number
	quadrantLabel: string
}

async function loadCompass(): Promise<{
	mappedQuestionCount: number
	points: CompassPoint[]
}> {
	const result = await sanityClient.fetch<{
		models: Array<Record<string, unknown>>
		questions: Array<Record<string, unknown>>
		runs: Array<Record<string, unknown>>
	}>(COMPASS_QUERY)

	const models: AnalysisModel[] = (result.models ?? []).flatMap((model) =>
		typeof model.slug === 'string' && model.slug
			? [
					{
						id: String(model._id ?? model.slug),
						name:
							typeof model.name === 'string' ? model.name : String(model.slug),
						slug: model.slug,
					},
				]
			: [],
	)

	const questions: AnalysisQuestion[] = (result.questions ?? []).flatMap((q) =>
		typeof q.slug === 'string' && q.slug && typeof q.canonicalText === 'string'
			? [
					{
						id: q.slug,
						canonicalText: q.canonicalText,
						theme:
							typeof q.theme === 'string' && q.theme ? q.theme : 'Allgemein',
					},
				]
			: [],
	)

	const answers: Record<
		string,
		Record<string, { abbreviation: 'SD' | 'D' | 'A' | 'SA' }>
	> = {}
	const seen = new Set<string>()

	for (const run of result.runs ?? []) {
		const modelSlug = typeof run.modelSlug === 'string' ? run.modelSlug : ''
		if (!modelSlug) continue
		for (const answer of Array.isArray(run.answers) ? run.answers : []) {
			if (typeof answer !== 'object' || answer === null) continue
			const record = answer as Record<string, unknown>
			const questionSlug =
				typeof record.questionSlug === 'string' ? record.questionSlug : ''
			const abbreviation =
				ANSWER_ABBREVIATIONS[record.answer as keyof typeof ANSWER_ABBREVIATIONS]
			if (!questionSlug || !abbreviation) continue

			const key = `${modelSlug}:${questionSlug}`
			if (seen.has(key)) continue
			seen.add(key)

			answers[questionSlug] ??= {}
			answers[questionSlug][modelSlug] = { abbreviation }
		}
	}

	const analysis = analyzePoliticalCompass({
		models,
		questions,
		answersByLanguage: { DE: answers },
		language: 'DE',
	})

	return {
		mappedQuestionCount: analysis.mappedQuestionCount,
		points: analysis.modelPoints
			.filter((point) => point.hasCompleteCompass)
			.map((point) => ({
				modelId: point.modelId,
				modelName: point.modelName,
				x: point.x,
				y: point.y,
				quadrantLabel: point.quadrantLabel,
			})),
	}
}

type DeckAgent = {
	authorId: string
	name: string
	focus: string
	avatarUrl: string | null
	avatarAlt: string
	leanings: Leaning[]
}

async function loadAgents(): Promise<DeckAgent[]> {
	const emails = AGENTS.map((agent) => agent.email)
	const result = await sanityClient.fetch<{
		authors: Array<{
			email?: string
			avatar?: { asset?: unknown; alt?: string }
		}>
		framings: Array<{ leaning?: Leaning; authorIds?: string[] }>
	}>(AGENT_QUERY, { emails })

	const avatarByEmail = new Map(
		(result.authors ?? []).map((author) => [author.email, author.avatar]),
	)

	const leaningsByAuthorId = new Map<string, Set<Leaning>>()
	for (const framing of result.framings ?? []) {
		if (!framing.leaning) continue
		for (const authorId of framing.authorIds ?? []) {
			const set = leaningsByAuthorId.get(authorId) ?? new Set<Leaning>()
			set.add(framing.leaning)
			leaningsByAuthorId.set(authorId, set)
		}
	}

	return AGENTS.map((agent) => {
		const avatar = avatarByEmail.get(agent.email)
		const leanings =
			leaningsByAuthorId.get(agent.authorId) ?? new Set<Leaning>()
		return {
			authorId: agent.authorId,
			name: agent.name,
			focus: agent.focus,
			avatarUrl: avatar?.asset
				? urlFor(avatar as never)
						.width(128)
						.height(128)
						.auto('format')
						.url()
				: null,
			avatarAlt: avatar?.alt ?? '',
			// Ordered along the political axis rather than by discovery order.
			leanings: leaningScale
				.map((step) => step.value)
				.filter((value) => leanings.has(value)),
		}
	})
}

export async function loader() {
	const [agents, article, compass] = await Promise.all([
		loadAgents().catch((error) => {
			console.error('[referat] agents unavailable', error)
			return [] as DeckAgent[]
		}),
		getArticleBySlug(DEMO_ARTICLE_SLUG).catch((error) => {
			console.error('[referat] demo article unavailable', error)
			return null
		}),
		loadCompass().catch((error) => {
			console.error('[referat] compass unavailable', error)
			return { mappedQuestionCount: 0, points: [] as CompassPoint[] }
		}),
	])

	return data({
		agents,
		articleTitle: article?.title.easy ?? null,
		questions: (article?.levels?.easy?.questions ?? []) as ArticleQuestion[],
		vocabulary: (article?.levels?.easy?.vocabulary ?? []) as VocabularyItem[],
		commentary: article?.commentary?.easy ?? null,
		compassMappedQuestionCount: compass.mappedQuestionCount,
		compassPoints: compass.points,
	})
}

// ─── Slide furniture ─────────────────────────────────────────────────────────

const kicker = 'eyebrow mb-6 block'
const heading =
	'font-display text-[clamp(1.6rem,4.2vw,3rem)] leading-[1.08] font-bold tracking-[-0.025em]'
const lede =
	'font-reading text-[clamp(1rem,1.8vw,1.35rem)] leading-[1.5] max-w-[52ch]'
const list = 'mt-8 space-y-3.5 max-w-[56ch]'
const listItem =
	"font-reading text-[clamp(0.95rem,1.5vw,1.15rem)] leading-[1.5] flex gap-3 before:content-['—'] before:text-signal before:shrink-0"
const inner = 'w-full max-w-[900px]'
const innerWide = 'w-full max-w-[1120px]'

function Panel({
	title,
	children,
	className,
}: {
	title: string
	children: React.ReactNode
	className?: string
}) {
	return (
		<div className={cn('border border-current/20 p-5', className)}>
			<p className="eyebrow">{title}</p>
			<p className="font-reading mt-2.5 text-[0.95rem] leading-[1.55]">
				{children}
			</p>
		</div>
	)
}

/** The compass, reduced to what carries from the back of a room. */
function DeckCompass({
	points,
	mappedQuestionCount,
}: {
	points: CompassPoint[]
	mappedQuestionCount: number
}) {
	return (
		<div>
			<div className="relative aspect-square border border-current/25">
				<div className="pointer-events-none absolute inset-y-0 left-1/2 w-px bg-current/25" />
				<div className="pointer-events-none absolute inset-x-0 top-1/2 h-px bg-current/25" />

				<p className="eyebrow pointer-events-none absolute top-2 left-1/2 -translate-x-1/2">
					Autoritär
				</p>
				<p className="eyebrow pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2">
					Libertär
				</p>
				<p className="eyebrow pointer-events-none absolute top-1/2 left-2 -translate-y-1/2 bg-inherit px-1">
					Links
				</p>
				<p className="eyebrow pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 bg-inherit px-1">
					Rechts
				</p>

				{points.map((point, index) => (
					<span
						key={point.modelId}
						title={`${point.modelName} — ${point.quadrantLabel}`}
						className="bg-signal text-ink font-system absolute flex size-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center text-[0.6rem] font-bold"
						style={{
							left: `${((point.x + 1) / 2) * 100}%`,
							top: `${((1 - point.y) / 2) * 100}%`,
						}}
					>
						{index + 1}
					</span>
				))}

				{points.length === 0 ? (
					<p className="eyebrow pointer-events-none absolute inset-x-4 top-1/2 -translate-y-1/2 text-center">
						Noch keine vollständigen Umfragedaten
					</p>
				) : null}
			</div>

			{/* Below the plot, not inside it — in the box it lands on "Libertär". */}
			<p className="eyebrow mt-2.5 text-right">
				{mappedQuestionCount} Fragen · echte Daten
			</p>
		</div>
	)
}

// ─── Route ───────────────────────────────────────────────────────────────────

export default function PresentationReferat({
	loaderData,
}: Route.ComponentProps) {
	const {
		agents,
		articleTitle,
		questions,
		vocabulary,
		commentary,
		compassMappedQuestionCount,
		compassPoints,
	} = loaderData

	const [current, setCurrent] = useState(0)
	const touchStartX = useRef<number | null>(null)

	function go(n: number) {
		setCurrent(((n % TOTAL_SLIDES) + TOTAL_SLIDES) % TOTAL_SLIDES)
	}

	useEffect(() => {
		function onKeyDown(event: KeyboardEvent) {
			if (
				event.key === 'ArrowRight' ||
				event.key === 'ArrowDown' ||
				event.key === ' '
			) {
				event.preventDefault()
				setCurrent((value) => (value + 1) % TOTAL_SLIDES)
			}
			if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
				setCurrent((value) => (value - 1 + TOTAL_SLIDES) % TOTAL_SLIDES)
			}
		}
		document.addEventListener('keydown', onKeyDown)
		return () => document.removeEventListener('keydown', onKeyDown)
	}, [])

	// The deck covers the site chrome, so nothing behind it should scroll.
	useEffect(() => {
		const previous = document.body.style.overflow
		document.body.style.overflow = 'hidden'
		return () => {
			document.body.style.overflow = previous
		}
	}, [])

	function handleDeckClick(event: React.MouseEvent<HTMLDivElement>) {
		if (event.clientX > window.innerWidth / 2) go(current + 1)
		else go(current - 1)
	}

	function handleTouchStart(event: React.TouchEvent) {
		touchStartX.current = event.touches[0]?.clientX ?? null
	}

	function handleTouchEnd(event: React.TouchEvent) {
		if (touchStartX.current === null) return
		const dx = (event.changedTouches[0]?.clientX ?? 0) - touchStartX.current
		if (Math.abs(dx) > 40) go(current + (dx < 0 ? 1 : -1))
		touchStartX.current = null
	}

	/**
	 * Slides alternate the two brand surfaces — Paper for the reader's side,
	 * Terminal for the machine's. Nothing else gets a background colour.
	 *
	 * The deck pins its own surface regardless of the site theme, so it also has
	 * to pin the two tokens that are theme-dependent: Steel only clears contrast
	 * on Terminal in its lightened form, and only on Paper in its base form.
	 * Without this a dark-mode visitor gets 2.2:1 eyebrows on the Paper slides.
	 */
	function slide(index: number, surface: 'paper' | 'terminal') {
		return cn(
			// Safe alignment, not plain centring: a slide taller than the viewport
			// (the live-demo ones) would otherwise overflow past the top edge and
			// slide its kicker under the fixed header.
			'absolute inset-0 flex items-center-safe justify-center-safe overflow-y-auto px-[8vw] pt-[max(6vw,4.5rem)] pb-[6vw] transition-opacity duration-300 ease-out',
			surface === 'paper'
				? 'bg-paper text-ink [--steel-lt:#d6d8d3] [--steel:#6b7280]'
				: 'bg-terminal text-terminal-tx [--steel-lt:#2a2d30] [--steel:#9ba0a5]',
			current === index
				? 'pointer-events-auto opacity-100'
				: 'pointer-events-none opacity-0',
		)
	}

	return (
		// The deck owns the whole viewport: it is fixed over the site chrome
		// rather than laid out between the masthead and the footer.
		<div
			className="bg-terminal text-terminal-tx fixed inset-0 z-50 overflow-hidden [--steel:#9ba0a5]"
			onTouchStart={handleTouchStart}
			onTouchEnd={handleTouchEnd}
		>
			<div className="eyebrow fixed top-6 left-8 z-100">
				KI &amp; Journalismus — Referat
			</div>

			<nav
				aria-label="Folien"
				className="fixed top-1/2 right-4 z-100 flex -translate-y-1/2 flex-col"
			>
				{Array.from({ length: TOTAL_SLIDES }).map((_, index) => (
					<button
						key={index}
						type="button"
						aria-label={`Zu Folie ${index + 1}`}
						aria-current={current === index ? 'true' : undefined}
						// The dot stays 6px; the tap target around it does not.
						className="focus-visible:ring-signal group flex size-8 items-center justify-center focus-visible:ring-2 focus-visible:outline-none"
						onClick={() => go(index)}
					>
						<span
							aria-hidden="true"
							className={cn(
								'block size-1.5 transition-colors',
								current === index
									? 'bg-signal'
									: 'bg-steel/60 group-hover:bg-steel',
							)}
						/>
					</button>
				))}
			</nav>

			<div className="eyebrow fixed right-8 bottom-6 z-100 tabular-nums">
				{String(current + 1).padStart(2, '0')} / {TOTAL_SLIDES}
			</div>

			<div
				className="relative h-full w-full overflow-hidden"
				onClick={handleDeckClick}
			>
				{/* 01 · TITEL */}
				<section className={slide(0, 'terminal')}>
					<div className={inner}>
						<Wordmark className="text-[clamp(1.6rem,4vw,2.6rem)]" />
						<h1 className="font-display mt-12 text-[clamp(2rem,6vw,4.4rem)] leading-[1.03] font-extrabold tracking-[-0.03em]">
							Künstliche Intelligenz
							<br />
							und Journalismus
						</h1>
						<div className="mt-10 max-w-[520px]">
							<FaultLine at={0.42} tone="signal" />
						</div>
						<p className="font-reading mt-8 max-w-[46ch] text-[clamp(1rem,1.8vw,1.35rem)] leading-[1.5]">
							Verzerrung erkennen. Vielfalt bewahren. Verständlich für alle — am
							Beispiel von Umbruch AI.
						</p>
						<p className="eyebrow mt-12">Referat · Deutschunterricht · 2026</p>
					</div>
				</section>

				{/* 02 · ÜBERBLICK */}
				<section className={slide(1, 'paper')}>
					<div className={inner}>
						<span className={kicker}>Überblick</span>
						<h2 className={heading}>Worum es heute geht.</h2>
						<ul className={list}>
							<li className={listItem}>Kurz über mich</li>
							<li className={listItem}>
								Warum jede Nachrichtenquelle eine politische Ausrichtung hat
							</li>
							<li className={listItem}>
								Warum das bei künstlicher Intelligenz nicht anders ist
							</li>
							<li className={listItem}>
								Meine Recherche bei Umbruch AI: KI-Verzerrung,
								Handlungsfähigkeit, Zugänglichkeit, gesunde Diskussion
							</li>
							<li className={listItem}>
								Journalismus als Werkzeug zum Sprachenlernen
							</li>
						</ul>
					</div>
				</section>

				{/* 03 · ÜBER MICH */}
				<section className={slide(2, 'terminal')}>
					<div className={inner}>
						<span className={kicker}>Über mich</span>
						<h2 className={heading}>
							Ökonomie, Kunstgeschichte,
							<br />
							Software — und jetzt Bücher.
						</h2>
						<ul className={list}>
							<li className={listItem}>
								Geboren und aufgewachsen in der Türkei
							</li>
							<li className={listItem}>
								Bachelor in Istanbul: Volkswirtschaftslehre
							</li>
							<li className={listItem}>
								Master an der LMU München: Volkswirtschaftslehre
							</li>
							<li className={listItem}>
								Forschung zu Kunstgeschichte und Digitalisierung
							</li>
							<li className={listItem}>Fünf Jahre als Softwareentwickler</li>
							<li className={listItem}>
								Heute: Freelancer, Deutschlerner — und bald Bibliotheksbesitzer
							</li>
						</ul>
					</div>
				</section>

				{/* 04 · AUSRICHTUNG DER MEDIEN */}
				<section className={slide(3, 'paper')}>
					<div className={inner}>
						<span className={kicker}>Die Ausgangslage</span>
						<h2 className={heading}>
							Jede Nachrichtenquelle hat
							<br />
							eine politische Ausrichtung.
						</h2>
						<div className="mt-8 flex flex-wrap gap-1.5">
							{[
								'Süddeutsche Zeitung',
								'FAZ',
								'Spiegel',
								'Bild',
								'DW',
								'Reuters',
								'CNN',
								'New York Times',
							].map((outlet) => (
								<span
									key={outlet}
									className="font-system border border-current/25 px-2.5 py-1 text-[0.6rem] tracking-[0.16em] uppercase"
								>
									{outlet}
								</span>
							))}
						</div>
						<p className={cn(lede, 'mt-8')}>
							Wenn wir nur Quellen lesen, die unser Weltbild bestätigen, leben
							wir in einer Blase und verlieren die Perspektive. Deshalb müssen
							wir aktiv offen bleiben.
						</p>
					</div>
				</section>

				{/* 05 · KI UND NACHRICHTEN (1) */}
				<section className={slide(4, 'terminal')}>
					<div className={innerWide}>
						<span className={kicker}>KI und Nachrichten (1)</span>
						<h2 className={heading}>
							Auch KI hat eine
							<br />
							politische Ausrichtung.
						</h2>
						<div className="mt-8 grid items-start gap-10 sm:grid-cols-2 sm:gap-14">
							<div>
								<p className="font-reading text-[0.95rem] leading-[1.6]">
									Sprachmodelle tragen eine politische Ausrichtung, die aus
									ihren Trainingsdaten stammt — und viele Antworten sind
									einseitig gefärbt oder zensiert.
								</p>
								<p className="eyebrow mt-7">Political-Compass-Test</p>
								<p className="font-reading mt-2 text-[0.92rem] leading-[1.55]">
									Standardisierte Fragen zu Wirtschaft und Gesellschaft,
									gestellt an mehrere KI-Modelle. Ergebnis: kein Modell ist
									wirklich neutral.
								</p>

								{compassPoints.length > 0 ? (
									<ul className="mt-6 grid grid-cols-2 gap-x-4 gap-y-2">
										{compassPoints.map((point, index) => (
											<li
												key={point.modelId}
												className="font-system flex items-center gap-2 text-[0.68rem]"
											>
												<span className="bg-signal text-ink flex size-4 shrink-0 items-center justify-center text-[0.5rem] font-bold">
													{index + 1}
												</span>
												<span className="truncate">{point.modelName}</span>
											</li>
										))}
									</ul>
								) : null}

								<p className="eyebrow mt-8">
									Vollständige Analyse:
									umbruch.ai/research/political-leanings-ai
								</p>
							</div>

							<DeckCompass
								points={compassPoints}
								mappedQuestionCount={compassMappedQuestionCount}
							/>
						</div>
					</div>
				</section>

				{/* 06 · KI UND NACHRICHTEN (2) */}
				<section className={slide(5, 'paper')}>
					<div className={inner}>
						<span className={kicker}>KI und Nachrichten (2)</span>
						<h2 className={heading}>
							Das zweite Risiko:
							<br />
							KI als Blackbox.
						</h2>
						<ul className={list}>
							<li className={listItem}>
								Trainingsdaten und Antwortverhalten liegen in der Hand weniger
								mächtiger Länder und Konzerne — allen voran China und die USA
							</li>
							<li className={listItem}>
								Als Nutzer:in weiß man nie genau, ob und wie man beeinflusst
								wird
							</li>
							<li className={listItem}>
								Deshalb braucht es Transparenz und unabhängige Forschung
							</li>
						</ul>
					</div>
				</section>

				{/* 07 · UMBRUCH: DAS EXPERIMENT */}
				<section className={slide(6, 'terminal')}>
					<div className={inner}>
						<span className={kicker}>Umbruch AI — Recherche</span>
						<h2 className={heading}>
							Ein Experiment gegen
							<br />
							versteckte KI-Verzerrung.
						</h2>
						<p className={cn(lede, 'mt-8')}>
							Die KI wird gezwungen, ihre eigene Verzerrung anzuerkennen — und
							schreibt anschließend Artikel aus deutlich gekennzeichneten
							Perspektiven, statt eine einzige versteckt gefärbte Version der
							Wahrheit zu liefern.
						</p>
						<div className="mt-9 flex flex-wrap gap-1.5">
							{leaningScale.map((step) => (
								<span
									key={step.value}
									className="font-system border border-current/25 px-2.5 py-1 text-[0.6rem] tracking-[0.16em] uppercase"
								>
									{step.label}
								</span>
							))}
						</div>
					</div>
				</section>

				{/* 08 · AGENTEN */}
				<section className={slide(7, 'paper')}>
					<div className={innerWide}>
						<span className={kicker}>Umbruch AI — Recherche</span>
						<h2 className={heading}>Autonome Redaktions-Agenten.</h2>
						<div className="mt-8 grid gap-2.5">
							{agents.map((agent) => (
								<div
									key={agent.authorId}
									className="flex items-center gap-4 border border-current/20 p-4"
								>
									<span className="font-display flex size-14 shrink-0 items-center justify-center overflow-hidden border border-current/20 text-sm font-bold">
										{agent.avatarUrl ? (
											<img
												src={agent.avatarUrl}
												alt={agent.avatarAlt}
												className="size-full object-cover"
												loading="lazy"
												decoding="async"
											/>
										) : (
											getAuthorInitials(agent.name)
										)}
									</span>
									<div className="min-w-0 flex-1">
										<div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1.5">
											<p className="font-display text-[0.95rem] font-bold">
												{agent.name}
											</p>
											<div className="flex flex-wrap gap-1">
												{agent.leanings.map((leaning) => (
													<span
														key={leaning}
														className="font-system border border-current/25 px-2 py-0.5 text-[0.55rem] tracking-[0.16em] uppercase"
													>
														{leaningLabelByValue[leaning]}
													</span>
												))}
											</div>
										</div>
										<p className="eyebrow mt-1.5">{agent.focus}</p>
									</div>
								</div>
							))}
						</div>
					</div>
				</section>

				{/* 09 · HANDLUNGSFÄHIGKEIT */}
				<section className={slide(8, 'terminal')}>
					<div className={inner}>
						<span className={kicker}>Umbruch AI — Recherche</span>
						<h2 className={heading}>
							Handlungsfähigkeit
							<br />
							statt Angstmache.
						</h2>
						<p className={cn(lede, 'mt-8')}>
							Fast alle Medien leben von Engagement-Metriken, die Angst und
							Empörung begünstigen. Umbruch stuft jeden politischen Artikel nach
							Handlungsstufe ein — wie handlungsfähig er Leser:innen
							zurücklässt.
						</p>
						<div className="mt-9 flex flex-wrap items-center gap-1">
							{agencyScale.map((step, index) => (
								<span
									key={step.value}
									className="font-system flex items-center gap-2 border border-current/25 px-3 py-1.5 text-[0.62rem] tracking-[0.12em] uppercase"
								>
									<span
										aria-hidden="true"
										className={cn(
											'block size-1.5',
											index === 2 ? 'bg-signal' : 'bg-current/40',
										)}
									/>
									{step.label}
								</span>
							))}
						</div>
					</div>
				</section>

				{/* 10 · ZUGÄNGLICHKEIT */}
				<section className={slide(9, 'paper')}>
					<div className={innerWide}>
						<span className={kicker}>Umbruch AI — Recherche</span>
						<h2 className={heading}>
							Nachrichten für alle
							<br />
							verständlich machen.
						</h2>
						<div className="mt-8 grid items-start gap-10 sm:grid-cols-2 sm:gap-14">
							<div className="space-y-4">
								<p className="font-reading text-[0.98rem] leading-[1.6]">
									Selbst in Deutschland ist das Leseverständnis vieler
									Erwachsener niedriger als angenommen. Laut der{' '}
									<em>leo. – Level-One Studie</em> sind rund 6,2 Millionen
									Erwachsene gering literalisiert. Das zu ändern braucht Jahre
									an Bildungspolitik.
								</p>
								<p className="font-reading text-[0.98rem] leading-[1.6]">
									Besonders betroffen: Migrant:innen, die durch Sprachbarrieren
									oft von Nachrichten abgeschnitten sind. Für eine besser
									integrierte, weniger segregierte Gesellschaft müssen Medien
									zugänglich und reichlich verfügbar sein.
								</p>
							</div>
							<Panel title="Drei Sprachniveaus, ein Artikel">
								Derselbe Text als Einfach, Mittel und Fortgeschritten — mit
								Quiz, Vokabelteil und Audio auf jeder Stufe.
							</Panel>
						</div>
					</div>
				</section>

				{/* 11 · DISKUSSIONSKULTUR */}
				<section className={slide(10, 'terminal')}>
					<div className={innerWide}>
						<span className={kicker}>Umbruch AI — Recherche</span>
						<h2 className={heading}>
							Eine gesunde
							<br />
							Diskussionskultur.
						</h2>
						<ul className={list}>
							<li className={listItem}>
								Hasserfüllte und diskriminierende Sprache im Netz ist ein
								riesiges Problem
							</li>
							<li className={listItem}>
								Wir müssen lernen, respektvoll zu widersprechen
							</li>
							<li className={listItem}>
								Ein gutes Gespräch beginnt mit den richtigen Fragen
							</li>
							<li className={listItem}>
								Stark moderierter Kommentarbereich mit Denkanstößen, die den
								Menschen in den Mittelpunkt stellen
							</li>
						</ul>

						{commentary ? (
							<div className="mt-9 max-w-[900px]">
								<p className="eyebrow mb-3">
									Live aus der App — redaktioneller Kontext
								</p>
								<div className="grid gap-2.5 sm:grid-cols-2">
									{commentary.humanConcern ? (
										<Panel title="Menschliches Anliegen">
											{commentary.humanConcern}
										</Panel>
									) : null}
									{commentary.opposingView ? (
										<Panel title="Gegenposition (Steelman)">
											{commentary.opposingView}
										</Panel>
									) : null}
								</div>
								{commentary.prompt ? (
									<Panel title="Kritische Denkfrage" className="mt-2.5">
										{commentary.prompt}
									</Panel>
								) : null}
							</div>
						) : null}
					</div>
				</section>

				{/* 12 · SPRACHENLERNEN */}
				<section className={slide(11, 'paper')}>
					<div className={innerWide}>
						<span className={kicker}>Journalismus &amp; Sprachenlernen</span>
						<h2 className={heading}>
							Aus einer Nachricht wird
							<br />
							eine Deutschlektion.
						</h2>

						{questions.length > 0 || vocabulary.length > 0 ? (
							<div className="mt-8">
								<p className="eyebrow mb-4">
									Live-Demo — {articleTitle ?? 'Beispielartikel'}
								</p>
								{/* The quizzes are interactive; clicks inside must not page the
								    deck forward. */}
								<div
									className="grid gap-6 lg:grid-cols-2"
									onClick={(event) => event.stopPropagation()}
								>
									{vocabulary.length > 0 ? (
										<VocabularyQuiz vocabulary={vocabulary} />
									) : null}
									{questions.length > 0 ? (
										<ArticleQuiz questions={questions} />
									) : null}
								</div>
							</div>
						) : (
							<div className="mt-8 grid gap-10 sm:grid-cols-2 sm:gap-14">
								<Panel title="Vokabelbereich">
									Die wichtigsten Wörter jedes Artikels, direkt zum Lernen
									aufbereitet.
								</Panel>
								<Panel title="Quizbereich">
									Verständnisfragen zu jedem Artikel, mit direktem Feedback.
								</Panel>
							</div>
						)}
					</div>
				</section>

				{/* 13 · SCHLUSS */}
				<section className={slide(12, 'terminal')}>
					<div
						className={cn(
							inner,
							'flex h-[min(75vh,640px)] flex-col justify-between',
						)}
					>
						<div>
							<span className={kicker}>Zum Schluss</span>
							<h2 className={cn(heading, 'max-w-[20ch]')}>
								Und eine kleine Bitte
								<br />
								zum Schluss. :)
							</h2>
							<ul className={list}>
								<li className={listItem}>
									Lest ein paar Artikel — auf dem Niveau, das euch passt
								</li>
								<li className={listItem}>
									Widersprecht im Kommentarbereich, so ehrlich ihr könnt
								</li>
								<li className={listItem}>
									Und teilt das Projekt, wenn ihr es brauchbar findet
								</li>
							</ul>
						</div>

						<div className="border-steel-lt border-t pt-8">
							<p className="eyebrow mb-4">Kontakt</p>
							<p className="font-display text-[clamp(1.3rem,3vw,2rem)] font-bold tracking-[-0.02em]">
								Osman Cakir
							</p>
							<div className="mt-3 flex flex-wrap items-center gap-6">
								<a
									href="mailto:osmancakir11@gmail.com"
									className="font-system text-signal text-[0.85rem] no-underline"
									onClick={(event) => event.stopPropagation()}
								>
									osmancakir11@gmail.com
								</a>
								<span className="font-system text-steel text-[0.85rem]">
									umbruch.ai
								</span>
							</div>
							<p className="eyebrow mt-10">
								Vielen Dank für eure Aufmerksamkeit.
							</p>
						</div>
					</div>
				</section>
			</div>
		</div>
	)
}
