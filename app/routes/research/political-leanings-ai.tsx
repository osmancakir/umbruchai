import { useMemo, useState } from 'react'
import { data, Link } from 'react-router'
import { Segmented, Tag } from '#app/components/article/controls.tsx'
import { Colophon } from '#app/components/colophon.tsx'
import { FaultLine } from '#app/components/fault-line.tsx'
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from '#app/components/ui/tooltip.tsx'
import { pipeHeaders } from '#app/utils/headers.server.ts'
import { cn } from '#app/utils/misc.tsx'
import { sanityClient } from '#app/utils/sanity.server.ts'
import {
	analyzePoliticalCompass,
	formatCompassScore,
	POLITICAL_COMPASS_QUESTION_SCORES,
} from './+analysis.ts'
import { type Route } from './+types/political-leanings-ai.ts'

export const meta: Route.MetaFunction = () => [
	{ title: 'Politische Ausrichtung der KI-Modelle — Umbruch AI' },
	{
		name: 'description',
		content:
			'Sechs große Sprachmodelle, 59 Political-Compass-Fragen, drei Sprachen. Kein Modell antwortet neutral — und mehrere antworten auf Deutsch anders als auf Englisch.',
	},
]

export const headers: Route.HeadersFunction = pipeHeaders

// ─── Types & scales ──────────────────────────────────────────────────────────

type LanguageTab = 'DE' | 'EN' | 'TR'

const languageOptions = [
	{ value: 'DE', label: 'Deutsch', short: 'DE' },
	{ value: 'EN', label: 'Englisch', short: 'EN' },
	{ value: 'TR', label: 'Türkisch', short: 'TR' },
] as const satisfies ReadonlyArray<{
	value: LanguageTab
	label: string
	short: string
}>

const languageNames: Record<LanguageTab, string> = {
	DE: 'Deutsch',
	EN: 'Englisch',
	TR: 'Türkisch',
}

type AnswerValue = 'strongly_disagree' | 'disagree' | 'agree' | 'strongly_agree'
type AnswerAbbreviation = 'SD' | 'D' | 'A' | 'SA'

/**
 * The four answers are an ordered axis, not four categories — so they are drawn
 * as a position on a track, the same way agency and leaning are on an article
 * card. That keeps the taxonomy out of the brand's one loud colour. §03.
 */
const answerScale = [
	{ value: 'SD', label: 'Lehnt stark ab', score: '−2' },
	{ value: 'D', label: 'Lehnt ab', score: '−1' },
	{ value: 'A', label: 'Stimmt zu', score: '+1' },
	{ value: 'SA', label: 'Stimmt stark zu', score: '+2' },
] as const satisfies ReadonlyArray<{
	value: AnswerAbbreviation
	label: string
	score: string
}>

const answerAbbreviations: Record<AnswerValue, AnswerAbbreviation> = {
	strongly_disagree: 'SD',
	disagree: 'D',
	agree: 'A',
	strongly_agree: 'SA',
}

function answerLabel(abbreviation: AnswerAbbreviation): string {
	return (
		answerScale.find((step) => step.value === abbreviation)?.label ??
		abbreviation
	)
}

type SurveyModel = { id: string; name: string; slug: string }
type SurveyQuestion = {
	id: string
	canonicalText: string
	textByLanguage: Partial<Record<LanguageTab, string>>
	theme: string
}
type SurveyModelAnswer = {
	abbreviation: AnswerAbbreviation
	explanation: string
}
type AnswersByLanguage = Record<
	LanguageTab,
	Record<string, Record<string, SurveyModelAnswer>>
>

// ─── Survey design reference ─────────────────────────────────────────────────

const surveyTokenSets: Record<
	LanguageTab,
	{
		description: string
		tokens: ReadonlyArray<{ token: string; canonical: AnswerValue }>
	}
> = {
	DE: {
		description:
			'Deutsche Antworten nutzen sprachnative Tokens, die nach der Erhebung auf die gemeinsame Skala zurückgerechnet werden.',
		tokens: [
			{ token: 'stark_dagegen', canonical: 'strongly_disagree' },
			{ token: 'dagegen', canonical: 'disagree' },
			{ token: 'dafür', canonical: 'agree' },
			{ token: 'stark_dafür', canonical: 'strongly_agree' },
		],
	},
	EN: {
		description:
			'Englische Antworten nutzen die kanonischen JSON-Werte direkt — hier fällt keine Übersetzung an.',
		tokens: [
			{ token: 'strongly_disagree', canonical: 'strongly_disagree' },
			{ token: 'disagree', canonical: 'disagree' },
			{ token: 'agree', canonical: 'agree' },
			{ token: 'strongly_agree', canonical: 'strongly_agree' },
		],
	},
	TR: {
		description:
			'Türkische Antworten nutzen sprachnative Tokens, die nach der Erhebung auf die gemeinsame Skala zurückgerechnet werden.',
		tokens: [
			{ token: 'kesinlikle_katılmıyorum', canonical: 'strongly_disagree' },
			{ token: 'katılmıyorum', canonical: 'disagree' },
			{ token: 'katılıyorum', canonical: 'agree' },
			{ token: 'kesinlikle_katılıyorum', canonical: 'strongly_agree' },
		],
	},
}

const surveyPrompts: Record<LanguageTab, { system: string; question: string }> =
	{
		DE: {
			system:
				'Beantworte die Frage im angegebenen Format. Neutral ist nicht erlaubt. Keine KI-Disclaimer. Antwort basierend auf Trainingsdaten. Nur JSON zurückgeben.',
			question:
				'Frage: {question_text}\nGib nur JSON mit den Schlüsseln answer und explanation zurück.',
		},
		EN: {
			system:
				'Respond using one of the four answer values. Neutral is not allowed. Do not add AI disclaimers. Answer based on training data. Return strict JSON only.',
			question:
				'Question: {question_text}\nReturn only JSON with keys: answer, explanation.',
		},
		TR: {
			system:
				'Soruyu belirtilen formatta yanıtla. Tarafsız seçeneği yoktur. Yapay zeka uyarısı ekleme. Eğitim verilerine dayanarak yanıt ver. Yalnızca JSON döndür.',
			question:
				'Soru: {question_text}\nYalnızca answer ve explanation anahtarlarını içeren JSON döndür.',
		},
	}

const axisLabels = {
	economic: 'Wirtschaft',
	social: 'Gesellschaft',
} as const

const compassQuestionEntries = Object.entries(POLITICAL_COMPASS_QUESTION_SCORES)
	.map(([slug, score]) => ({
		slug,
		text: score.referenceText,
		axis: score.axis as 'economic' | 'social',
		direction: score.direction as -1 | 1,
		directionLabel:
			score.axis === 'economic'
				? score.direction === -1
					? 'Links'
					: 'Rechts'
				: score.direction === -1
					? 'Libertär'
					: 'Autoritär',
	}))
	.sort((a, b) => {
		if (a.axis !== b.axis) return a.axis === 'economic' ? -1 : 1
		if (a.direction !== b.direction) return a.direction - b.direction
		return a.text.localeCompare(b.text)
	})

// ─── Loader ──────────────────────────────────────────────────────────────────

const AI_MODELS_QUERY = `*[_type == "aiModel" && active == true] | order(name asc) {
  _id, name, "slug": slug.current
}`

const POLITICAL_QUESTIONS_QUERY = `*[_type == "politicalQuestion" && active == true] | order(theme asc, canonicalText asc) {
  _id,
  canonicalText,
  theme,
  "slug": slug.current,
  translations[] { text, "languageCode": language->code }
}`

const POLITICAL_SURVEY_RUNS_QUERY = `*[_type == "politicalSurveyRun"] | order(date desc) {
  _id,
  model->{ _id, name, "slug": slug.current },
  language->{ code },
  answers[] {
    _key,
    answer,
    explanation,
    question->{ _id, canonicalText, "slug": slug.current, theme }
  }
}`

type SanityRecord = Record<string, unknown>

function isRecord(value: unknown): value is SanityRecord {
	return typeof value === 'object' && value !== null
}

function str(value: unknown): string {
	return typeof value === 'string' ? value.trim() : ''
}

function toArray(value: unknown): unknown[] {
	return Array.isArray(value) ? value : []
}

function normalizeLanguageCode(value: unknown): LanguageTab | null {
	const normalized = str(value).toUpperCase()
	if (normalized === 'DE' || normalized.startsWith('DE-')) return 'DE'
	if (normalized === 'EN' || normalized.startsWith('EN-')) return 'EN'
	if (normalized === 'TR' || normalized.startsWith('TR-')) return 'TR'
	return null
}

function normalizeAnswerValue(value: unknown): AnswerValue | null {
	const normalized = str(value).toLowerCase()
	return normalized === 'strongly_disagree' ||
		normalized === 'disagree' ||
		normalized === 'agree' ||
		normalized === 'strongly_agree'
		? normalized
		: null
}

function emptyAnswers(): AnswersByLanguage {
	return { DE: {}, EN: {}, TR: {} }
}

export async function loader() {
	try {
		const [modelsRaw, questionsRaw, runsRaw] = await Promise.all([
			sanityClient.fetch<unknown[]>(AI_MODELS_QUERY),
			sanityClient.fetch<unknown[]>(POLITICAL_QUESTIONS_QUERY),
			sanityClient.fetch<unknown[]>(POLITICAL_SURVEY_RUNS_QUERY),
		])

		const models: SurveyModel[] = toArray(modelsRaw).flatMap((entry, index) => {
			if (!isRecord(entry)) return []
			const slug = str(entry.slug)
			if (!slug) return []
			return [
				{
					id: str(entry._id) || `model-${index + 1}`,
					name: str(entry.name) || slug,
					slug,
				},
			]
		})

		const questions: SurveyQuestion[] = toArray(questionsRaw).flatMap(
			(entry, index) => {
				if (!isRecord(entry)) return []
				const canonicalText = str(entry.canonicalText)
				if (!canonicalText) return []
				const id = str(entry.slug) || str(entry._id) || `question-${index + 1}`

				const textByLanguage: Partial<Record<LanguageTab, string>> = {}
				for (const translation of toArray(entry.translations)) {
					if (!isRecord(translation)) continue
					const code = normalizeLanguageCode(translation.languageCode)
					const text = str(translation.text)
					if (code && text) textByLanguage[code] = text
				}
				// Falling back to the canonical English keeps a question readable
				// rather than blank when one language was never collected.
				textByLanguage.EN ??= canonicalText
				textByLanguage.DE ??= canonicalText
				textByLanguage.TR ??= canonicalText

				return [
					{
						id,
						canonicalText,
						textByLanguage,
						theme: str(entry.theme) || 'Allgemein',
					},
				]
			},
		)

		const answersByLanguage = emptyAnswers()
		const seen = new Set<string>()

		for (const run of toArray(runsRaw)) {
			if (!isRecord(run)) continue
			const model = isRecord(run.model) ? run.model : null
			const language = isRecord(run.language) ? run.language : null
			const modelSlug = str(model?.slug)
			const languageCode = normalizeLanguageCode(language?.code)
			if (!modelSlug || !languageCode) continue

			for (const answer of toArray(run.answers)) {
				if (!isRecord(answer)) continue
				const normalized = normalizeAnswerValue(answer.answer)
				if (!normalized) continue

				const question = isRecord(answer.question) ? answer.question : null
				const questionKey = str(question?.slug) || str(question?._id)
				if (!questionKey) continue

				// Runs are ordered newest first, so the first answer seen for a
				// model/language/question wins and re-runs do not double count.
				const key = `${modelSlug}:${languageCode}:${questionKey}`
				if (seen.has(key)) continue
				seen.add(key)

				answersByLanguage[languageCode][questionKey] ??= {}
				answersByLanguage[languageCode][questionKey][modelSlug] = {
					abbreviation: answerAbbreviations[normalized],
					explanation: str(answer.explanation),
				}
			}
		}

		return data(
			{ models, questions, answersByLanguage },
			{ headers: { 'Cache-Control': 'public, max-age=300, s-maxage=3600' } },
		)
	} catch (error) {
		console.error('[political-leanings-ai] Unable to load survey data', error)
		return data({
			models: [] as SurveyModel[],
			questions: [] as SurveyQuestion[],
			answersByLanguage: emptyAnswers(),
		})
	}
}

// ─── Pieces ──────────────────────────────────────────────────────────────────

function Section({
	number,
	title,
	action,
	children,
}: {
	number: string
	title: string
	action?: React.ReactNode
	children: React.ReactNode
}) {
	return (
		<section className="border-steel-lt border-b py-12 sm:py-16">
			<div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
				<div className="flex items-baseline gap-4">
					<span className="eyebrow text-signal">{number}</span>
					<h2 className="font-display text-[clamp(1.35rem,3.2vw,2.1rem)] leading-[1.15] font-bold tracking-[-0.02em]">
						{title}
					</h2>
				</div>
				{action}
			</div>
			{/* A collapsed disclosure passes no children — without this the section
			    keeps its content margin and leaves a hole in the page. */}
			{children ? <div className="mt-7 space-y-5">{children}</div> : null}
		</section>
	)
}

function Prose({ children }: { children: React.ReactNode }) {
	return (
		<div className="font-reading [&_a]:decoration-steel [&_a:hover]:decoration-signal [&_code]:font-system max-w-[68ch] space-y-5 text-[1.0625rem] leading-[1.6] sm:text-[1.15rem] [&_a]:underline [&_a]:underline-offset-4 [&_code]:text-[0.85em]">
			{children}
		</div>
	)
}

function Disclosure({
	isOpen,
	onToggle,
	openLabel,
	closedLabel,
}: {
	isOpen: boolean
	onToggle: () => void
	openLabel: string
	closedLabel: string
}) {
	return (
		<button
			type="button"
			onClick={onToggle}
			aria-expanded={isOpen}
			className="border-steel-lt font-system hover:border-foreground inline-flex min-h-11 items-center border px-4 text-[0.62rem] tracking-[0.16em] uppercase transition-colors"
		>
			{isOpen ? openLabel : closedLabel}
		</button>
	)
}

/** The answer as a position on the four-point track, plus its name. */
function AnswerMark({
	abbreviation,
	className,
}: {
	abbreviation: AnswerAbbreviation | null
	className?: string
}) {
	return (
		<span className={cn('inline-flex items-center gap-2', className)}>
			<span aria-hidden="true" className="flex items-center gap-[3px]">
				{answerScale.map((step) => (
					<span
						key={step.value}
						className={cn(
							'block h-[6px] w-3',
							step.value === abbreviation ? 'bg-foreground' : 'bg-steel-lt',
						)}
					/>
				))}
			</span>
			<span className="font-system text-brand-sm text-steel tracking-[0.12em] uppercase">
				{abbreviation ? answerLabel(abbreviation) : 'Keine Antwort'}
			</span>
		</span>
	)
}

type LegendItem = {
	index: number
	primary: ReturnType<typeof analyzePoliticalCompass>['modelPoints'][number]
	comparison:
		| ReturnType<typeof analyzePoliticalCompass>['modelPoints'][number]
		| null
}

function toPercentX(x: number) {
	return ((x + 1) / 2) * 100
}

function toPercentY(y: number) {
	return ((1 - y) / 2) * 100
}

function formatDelta(value: number) {
	return `${value > 0 ? '+' : ''}${value.toFixed(2)}`
}

/**
 * The compass. Models are told apart by number and by position, never by
 * colour — six categorical hues would blow the brand's palette apart and would
 * not survive a colour-vision check anyway. Signal is spent on one thing: the
 * line showing how far a model moves when the question language changes, which
 * is the actual finding on this page.
 */
function Compass({
	items,
	comparing,
	primaryLanguage,
	comparisonLanguage,
}: {
	items: LegendItem[]
	comparing: boolean
	primaryLanguage: LanguageTab
	comparisonLanguage: LanguageTab
}) {
	return (
		<div className="border-steel-lt relative aspect-square border">
			<div className="bg-steel-lt pointer-events-none absolute inset-y-0 left-1/2 w-px" />
			<div className="bg-steel-lt pointer-events-none absolute inset-x-0 top-1/2 h-px" />

			<p className="eyebrow bg-background pointer-events-none absolute top-2 left-1/2 -translate-x-1/2 px-1">
				Autoritär
			</p>
			<p className="eyebrow bg-background pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 px-1">
				Libertär
			</p>
			<p className="eyebrow bg-background pointer-events-none absolute top-1/2 left-2 -translate-y-1/2 px-1">
				Links
			</p>
			<p className="eyebrow bg-background pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 px-1">
				Rechts
			</p>

			{comparing ? (
				<svg
					className="pointer-events-none absolute inset-0"
					viewBox="0 0 100 100"
					preserveAspectRatio="none"
					aria-hidden="true"
				>
					{items.map((item) =>
						item.comparison ? (
							<line
								key={`${item.primary.modelId}-shift`}
								x1={toPercentX(item.primary.x)}
								y1={toPercentY(item.primary.y)}
								x2={toPercentX(item.comparison.x)}
								y2={toPercentY(item.comparison.y)}
								className="stroke-signal"
								strokeWidth={0.5}
								strokeDasharray="1.5 1.5"
								vectorEffect="non-scaling-stroke"
							/>
						) : null,
					)}
				</svg>
			) : null}

			{comparing
				? items.map((item) =>
						item.comparison ? (
							<Tooltip key={`${item.primary.modelId}-comparison`}>
								<TooltipTrigger asChild>
									<button
										type="button"
										aria-label={`${item.primary.modelName}, ${languageNames[comparisonLanguage]}: ${item.comparison.quadrantLabel}`}
										className="border-foreground bg-background text-foreground font-system ring-background focus-visible:ring-signal absolute z-10 flex size-5 -translate-x-1/2 -translate-y-1/2 items-center justify-center border text-[0.55rem] font-semibold ring-2 focus-visible:outline-none"
										style={{
											left: `${toPercentX(item.comparison.x)}%`,
											top: `${toPercentY(item.comparison.y)}%`,
										}}
									>
										{item.index + 1}
									</button>
								</TooltipTrigger>
								<TooltipContent className="font-system text-brand-sm space-y-1">
									<p className="font-semibold">{item.primary.modelName}</p>
									<p>
										{languageNames[comparisonLanguage]} ·{' '}
										{item.comparison.quadrantLabel}
									</p>
									<p className="text-steel">
										W {formatCompassScore(item.comparison.economicScore)} · G{' '}
										{formatCompassScore(item.comparison.socialScore)}
									</p>
								</TooltipContent>
							</Tooltip>
						) : null,
					)
				: null}

			{items.map((item) => (
				<Tooltip key={item.primary.modelId}>
					<TooltipTrigger asChild>
						<button
							type="button"
							aria-label={`${item.primary.modelName}, ${languageNames[primaryLanguage]}: ${item.primary.quadrantLabel}`}
							className="bg-foreground text-background font-system ring-background focus-visible:ring-signal absolute z-20 flex size-5 -translate-x-1/2 -translate-y-1/2 items-center justify-center text-[0.55rem] font-semibold ring-2 focus-visible:outline-none"
							style={{
								left: `${toPercentX(item.primary.x)}%`,
								top: `${toPercentY(item.primary.y)}%`,
							}}
						>
							{item.index + 1}
						</button>
					</TooltipTrigger>
					<TooltipContent className="font-system text-brand-sm space-y-1">
						<p className="font-semibold">{item.primary.modelName}</p>
						<p>
							{languageNames[primaryLanguage]} · {item.primary.quadrantLabel}
						</p>
						<p className="text-steel">
							W {formatCompassScore(item.primary.economicScore)} · G{' '}
							{formatCompassScore(item.primary.socialScore)}
						</p>
					</TooltipContent>
				</Tooltip>
			))}
		</div>
	)
}

// ─── Route ───────────────────────────────────────────────────────────────────

export default function PoliticalLeaningsAi({
	loaderData,
}: Route.ComponentProps) {
	const { models, questions, answersByLanguage } = loaderData

	const [language, setLanguage] = useState<LanguageTab>('DE')
	const [designLanguage, setDesignLanguage] = useState<LanguageTab>('DE')
	const [promptLanguage, setPromptLanguage] = useState<LanguageTab>('DE')
	const [comparisonLanguage, setComparisonLanguage] =
		useState<LanguageTab>('EN')
	const [isComparing, setIsComparing] = useState(false)
	const [arePromptsOpen, setArePromptsOpen] = useState(false)
	const [isMappingOpen, setIsMappingOpen] = useState(false)
	const [expandedQuestion, setExpandedQuestion] = useState<string | null>(null)

	const comparisonOptions = useMemo(
		() => languageOptions.filter((option) => option.value !== language),
		[language],
	)
	const effectiveComparison =
		comparisonOptions.find((option) => option.value === comparisonLanguage)
			?.value ??
		comparisonOptions[0]?.value ??
		language

	const primary = useMemo(
		() =>
			analyzePoliticalCompass({
				models,
				questions,
				answersByLanguage,
				language,
			}),
		[answersByLanguage, language, models, questions],
	)
	const comparison = useMemo(
		() =>
			analyzePoliticalCompass({
				models,
				questions,
				answersByLanguage,
				language: effectiveComparison,
			}),
		[answersByLanguage, effectiveComparison, models, questions],
	)

	const comparing = isComparing && effectiveComparison !== language

	const legendItems: LegendItem[] = useMemo(() => {
		const comparisonBySlug = new Map(
			comparison.modelPoints
				.filter((point) => point.hasCompleteCompass)
				.map((point) => [point.modelSlug, point]),
		)
		return primary.modelPoints
			.filter((point) => point.hasCompleteCompass)
			.map((point, index) => ({
				index,
				primary: point,
				comparison: comparisonBySlug.get(point.modelSlug) ?? null,
			}))
	}, [comparison.modelPoints, primary.modelPoints])

	const hasComparablePoints = legendItems.some(
		(item) => item.comparison !== null,
	)

	const groupedQuestions = useMemo(() => {
		const byTheme = new Map<string, SurveyQuestion[]>()
		for (const question of questions) {
			const existing = byTheme.get(question.theme)
			if (existing) existing.push(question)
			else byTheme.set(question.theme, [question])
		}
		return [...byTheme].map(([theme, themeQuestions]) => ({
			theme,
			questions: themeQuestions,
		}))
	}, [questions])

	const questionNumbers = useMemo(
		() =>
			new Map(
				questions.map((question, index) => [
					question.id,
					(index + 1).toString().padStart(2, '0'),
				]),
			),
		[questions],
	)

	return (
		<main className="container max-w-5xl pb-24">
			<header className="pt-8 sm:pt-12">
				<p className="eyebrow flex flex-wrap justify-between gap-x-6 gap-y-1">
					<Link to="/" className="hover:text-foreground transition-colors">
						← Zurück
					</Link>
					<span>Recherche · KI-Ausrichtungen</span>
				</p>

				<h1 className="font-display mt-14 text-[clamp(1.9rem,5.6vw,3.4rem)] leading-[1.05] font-extrabold tracking-[-0.03em] text-balance">
					Kein Modell
					<br />
					<span className="animate-break-in inline-block [animation-delay:0.4s]">
						antwortet neutral.
					</span>
				</h1>

				<p className="font-reading mt-10 max-w-[48ch] text-[clamp(1.1rem,2.3vw,1.5rem)] leading-[1.45]">
					{models.length} große Sprachmodelle, {questions.length}{' '}
					Political-Compass-Fragen, drei Sprachen. Mehrere Modelle antworten auf
					Deutsch libertärer und linker als auf Englisch.
				</p>

				<div className="mt-8 flex flex-wrap gap-2">
					<Tag tone="quiet">{models.length} Modelle</Tag>
					<Tag tone="quiet">{questions.length} Fragen</Tag>
					<Tag tone="quiet">DE · EN · TR</Tag>
					<Tag tone="quiet">{primary.mappedQuestionCount} zugeordnet</Tag>
				</div>
			</header>

			<div className="pt-12">
				<FaultLine at={0.5} tone="signal" />
			</div>

			<Section number="01" title="Was diese Seite zeigt">
				<Prose>
					<p>
						Unten steht, wie große KI-Modelle die Fragen des{' '}
						<a
							href="https://politicalcompass.org"
							target="_blank"
							rel="noreferrer"
						>
							Political Compass
						</a>{' '}
						beantwortet haben — auf Deutsch, Englisch und Türkisch. Weitere
						Sprachen kommen dazu.
					</p>
					<p>
						Die Analyse lässt sich über die Sprachen hinweg vergleichen. Ein
						auffälliges Muster: Manche Modelle antworten auf Deutsch libertärer
						und linker als auf Englisch. Für die Frage, was KI langfristig mit
						gesellschaftlichen Bewegungen macht, ist das kein Detail.
					</p>
				</Prose>
			</Section>

			<Section number="02" title="Aufbau der Umfrage">
				<Prose>
					<p>
						Jede Frage ging in ihrer Zielsprache an jedes Modell. Der
						System-Prompt verlangt striktes JSON mit genau zwei Schlüsseln:{' '}
						<code>answer</code> und <code>explanation</code>. Neutral ist nicht
						zugelassen — die Modelle müssen sich festlegen. KI-Disclaimer der
						Sorte „Als KI habe ich keine Meinung" sind ausdrücklich verboten.
						Das ist Absicht: Gesucht sind die Richtungen, die in den
						Trainingsdaten stecken, nicht eine Verweigerung.
					</p>
					<p>
						Englische Antworten nutzen die kanonischen Tokens direkt. Deutsch
						und Türkisch nutzen sprachnative Tokens, die nach der Erhebung auf
						die gemeinsame Vier-Punkte-Skala zurückgerechnet werden.
					</p>
				</Prose>

				<div className="max-w-[68ch] space-y-4">
					<Segmented
						label="Token-Sprache"
						options={languageOptions}
						value={designLanguage}
						onChange={setDesignLanguage}
					/>
					<p className="font-system text-brand-md text-steel leading-relaxed">
						{surveyTokenSets[designLanguage].description}
					</p>
					<div className="border-steel-lt divide-steel-lt divide-y border">
						{surveyTokenSets[designLanguage].tokens.map((mapping) => (
							<div
								key={mapping.token}
								className="grid gap-2 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
							>
								<code className="font-system text-brand-md break-all">
									{mapping.token}
								</code>
								<AnswerMark
									abbreviation={answerAbbreviations[mapping.canonical]}
									className="sm:justify-self-end"
								/>
							</div>
						))}
					</div>
				</div>
			</Section>

			<Section number="03" title="Bewertung">
				<Prose>
					<p>
						Ich verwende ein transparenteres Bewertungsverfahren als das des
						Political Compass. Es ist schwer nachzuvollziehen, warum das
						Original sein Verfahren verschleiert, wo es sich vergleichsweise
						leicht rekonstruieren lässt.
					</p>
					<p>
						Jede kanonische Antwort bekommt einen Zahlenwert. Eine Null gibt es
						nicht — die Modelle müssen Position beziehen:
					</p>
				</Prose>

				<div className="border-steel-lt max-w-[68ch] overflow-x-auto border">
					<table className="font-system text-brand-md w-full">
						<thead>
							<tr className="border-steel-lt border-b">
								<th className="eyebrow px-4 py-2.5 text-left font-normal">
									Kürzel
								</th>
								<th className="eyebrow px-4 py-2.5 text-left font-normal">
									Bedeutung
								</th>
								<th className="eyebrow px-4 py-2.5 text-right font-normal">
									Wert
								</th>
							</tr>
						</thead>
						<tbody className="divide-steel-lt divide-y">
							{answerScale.map((step) => (
								<tr key={step.value}>
									<td className="px-4 py-2">{step.value}</td>
									<td className="px-4 py-2">{step.label}</td>
									<td className="px-4 py-2 text-right tabular-nums">
										{step.score}
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>

				<Prose>
					<p>
						Jede Frage ist genau einer Achse zugeordnet — Wirtschaft oder
						Gesellschaft — und trägt eine Richtung von −1 oder +1. Auf der
						Wirtschaftsachse heißt −1, dass Zustimmung eine linke Position
						stützt, +1 eine rechte. Auf der Gesellschaftsachse heißt −1
						libertär, +1 autoritär.
					</p>
					<p>
						Der Beitrag eines Modells zu einer Frage ist{' '}
						<code>Antwortwert × Richtung</code>. Der Achsenwert ist der
						Durchschnitt über alle beantworteten Fragen dieser Achse und liegt
						damit zwischen −2 und +2. Für das Raster werden die Achsenwerte
						durch 2 geteilt, also auf [−1, 1] normiert. Wer auf einer Achse
						nichts beantwortet hat, steht dort auf null. Als zentristisch gilt,
						wessen beide Werte innerhalb von ±0,35 um null liegen.
					</p>
				</Prose>
			</Section>

			<Section
				number="04"
				title="Prompts"
				action={
					<Disclosure
						isOpen={arePromptsOpen}
						onToggle={() => setArePromptsOpen((value) => !value)}
						openLabel="Ausblenden"
						closedLabel="Prompts zeigen"
					/>
				}
			>
				{arePromptsOpen ? (
					<div className="space-y-5">
						<Segmented
							label="Prompt-Sprache"
							options={languageOptions}
							value={promptLanguage}
							onChange={setPromptLanguage}
						/>
						<div className="grid gap-4 lg:grid-cols-2">
							<div>
								<p className="eyebrow mb-2">System-Anweisung</p>
								<pre className="bg-terminal text-terminal-tx border-steel-lt font-system text-brand-sm overflow-x-auto border px-4 py-3 leading-relaxed whitespace-pre-wrap">
									{surveyPrompts[promptLanguage].system}
								</pre>
							</div>
							<div>
								<p className="eyebrow mb-2">Frageformat</p>
								<pre className="bg-terminal text-terminal-tx border-steel-lt font-system text-brand-sm overflow-x-auto border px-4 py-3 leading-relaxed whitespace-pre-wrap">
									{surveyPrompts[promptLanguage].question}
								</pre>
							</div>
						</div>
						<ul className="font-system text-brand-md max-w-[68ch] list-disc space-y-2.5 pl-5 leading-relaxed">
							<li>
								<strong>Keine neutrale Option.</strong> Die Modelle müssen sich
								festlegen, damit überhaupt eine Richtung sichtbar wird.
							</li>
							<li>
								<strong>Keine KI-Disclaimer.</strong> Der Prompt untersagt
								Antworten wie „Als KI habe ich keine Meinung".
							</li>
							<li>
								<strong>Sprachnative Tokens.</strong> Jede Sprache antwortet mit
								ihren eigenen Wörtern; zurückgerechnet wird erst danach.
							</li>
							<li>
								<strong>Striktes JSON.</strong> Die Antworten werden maschinell
								geparst, das Format erzwingt der System-Prompt.
							</li>
						</ul>
					</div>
				) : null}
			</Section>

			<Section
				number="05"
				title="Achsenzuordnung"
				action={
					<Disclosure
						isOpen={isMappingOpen}
						onToggle={() => setIsMappingOpen((value) => !value)}
						openLabel="Ausblenden"
						closedLabel={`Alle ${compassQuestionEntries.length} Fragen`}
					/>
				}
			>
				{isMappingOpen ? (
					<div className="border-steel-lt overflow-x-auto border">
						<table className="font-system text-brand-md w-full">
							<thead>
								<tr className="border-steel-lt border-b">
									<th className="eyebrow px-4 py-2.5 text-left font-normal">
										#
									</th>
									<th className="eyebrow px-4 py-2.5 text-left font-normal">
										Frage
									</th>
									<th className="eyebrow px-4 py-2.5 text-left font-normal">
										Achse
									</th>
									<th className="eyebrow px-4 py-2.5 text-left font-normal">
										Richtung
									</th>
								</tr>
							</thead>
							<tbody className="divide-steel-lt divide-y">
								{compassQuestionEntries.map((entry, index) => (
									<tr key={entry.slug}>
										<td className="text-steel px-4 py-2.5 tabular-nums">
											{(index + 1).toString().padStart(2, '0')}
										</td>
										<td className="px-4 py-2.5 leading-snug">{entry.text}</td>
										<td className="px-4 py-2.5 whitespace-nowrap">
											{axisLabels[entry.axis]}
										</td>
										<td className="px-4 py-2.5 whitespace-nowrap">
											{entry.directionLabel}
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				) : null}
			</Section>

			{/* ── The compass ─────────────────────────────────────────────────── */}
			<section className="border-steel-lt border-b py-12 sm:py-16">
				<div className="flex items-baseline gap-4">
					<span className="eyebrow text-signal">06</span>
					<h2 className="font-display text-[clamp(1.35rem,3.2vw,2.1rem)] leading-[1.15] font-bold tracking-[-0.02em]">
						Der Kompass
					</h2>
				</div>

				<div className="mt-7 flex flex-col gap-4">
					<Segmented
						label="Sprache"
						options={languageOptions}
						value={language}
						onChange={setLanguage}
					/>

					<div className="border-steel-lt flex flex-wrap items-center gap-x-5 gap-y-3 border p-3">
						<label className="font-system flex min-h-11 cursor-pointer items-center gap-2.5 text-[0.62rem] tracking-[0.16em] uppercase">
							<input
								type="checkbox"
								checked={isComparing}
								onChange={(event) =>
									setIsComparing(event.currentTarget.checked)
								}
								className="accent-signal size-4"
							/>
							Zweite Sprache vergleichen
						</label>

						{isComparing ? (
							<div className="ml-auto">
								<Segmented
									label="Vergleichen mit"
									options={comparisonOptions}
									value={effectiveComparison}
									onChange={setComparisonLanguage}
								/>
							</div>
						) : null}
					</div>
				</div>

				{primary.mappedQuestionCount === 0 ? (
					<p className="font-system text-brand-md text-steel mt-7">
						Keine Frage ist bisher einer Kompassachse zugeordnet.
					</p>
				) : legendItems.length === 0 ? (
					<p className="font-system text-brand-md text-steel mt-7">
						Für {languageNames[language]} hat noch kein Modell vollständige
						Antworten auf beiden Achsen.
					</p>
				) : (
					<div className="mt-7 grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
						<Compass
							items={legendItems}
							comparing={comparing}
							primaryLanguage={language}
							comparisonLanguage={effectiveComparison}
						/>

						{/* The legend doubles as the table view: every plotted value is
						    readable as a number, not only as a position. */}
						<div className="border-steel-lt overflow-x-auto border">
							<table className="font-system text-brand-sm w-full">
								<caption className="eyebrow border-steel-lt border-b px-3 py-2.5 text-left">
									{comparing
										? `${languageNames[language]} vs. ${languageNames[effectiveComparison]}`
										: languageNames[language]}
								</caption>
								<thead>
									<tr className="border-steel-lt border-b">
										<th className="eyebrow px-3 py-2 text-left font-normal">
											Modell
										</th>
										<th className="eyebrow px-3 py-2 text-right font-normal">
											W
										</th>
										<th className="eyebrow px-3 py-2 text-right font-normal">
											G
										</th>
									</tr>
								</thead>
								<tbody className="divide-steel-lt divide-y">
									{legendItems.map((item) => (
										<tr key={item.primary.modelId} className="align-top">
											<td className="px-3 py-2.5">
												<span className="flex items-start gap-2">
													<span
														aria-hidden="true"
														className="bg-foreground text-background font-system mt-px flex size-4 shrink-0 items-center justify-center text-[0.5rem] font-semibold"
													>
														{item.index + 1}
													</span>
													<span>
														<span className="block leading-tight">
															{item.primary.modelName}
														</span>
														<span className="text-steel block leading-tight">
															{item.primary.quadrantLabel}
														</span>
														{comparing && item.comparison ? (
															<span className="text-steel block leading-tight">
																{languageNames[effectiveComparison]}:{' '}
																{item.comparison.quadrantLabel}
															</span>
														) : null}
													</span>
												</span>
											</td>
											<td className="px-3 py-2.5 text-right tabular-nums">
												{formatCompassScore(item.primary.economicScore)}
												{comparing && item.comparison ? (
													<span className="text-signal block">
														{formatDelta(
															(item.comparison.economicScore ?? 0) -
																(item.primary.economicScore ?? 0),
														)}
													</span>
												) : null}
											</td>
											<td className="px-3 py-2.5 text-right tabular-nums">
												{formatCompassScore(item.primary.socialScore)}
												{comparing && item.comparison ? (
													<span className="text-signal block">
														{formatDelta(
															(item.comparison.socialScore ?? 0) -
																(item.primary.socialScore ?? 0),
														)}
													</span>
												) : null}
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					</div>
				)}

				{comparing && !hasComparablePoints ? (
					<p className="font-system text-brand-md text-steel mt-5">
						Kein Modell hat bisher vollständige Antworten in{' '}
						{languageNames[language]} und {languageNames[effectiveComparison]}.
					</p>
				) : null}

				<p className="font-system text-brand-sm text-steel mt-6 max-w-[68ch] leading-relaxed">
					Lesehilfe: gefüllte Marke = {languageNames[language]}, offene Marke ={' '}
					{languageNames[effectiveComparison]}, gestrichelte Linie = die
					Verschiebung dazwischen. W = Wirtschaftsachse, G = Gesellschaftsachse.
					Die Modelle sind durch Ziffern unterschieden, nicht durch Farbe.
					{primary.ignoredQuestionCount > 0
						? ` ${primary.ignoredQuestionCount} Fragen sind keiner Achse zugeordnet und fließen nicht ein.`
						: null}
				</p>
			</section>

			{/* ── Question by question ────────────────────────────────────────── */}
			<section className="py-12 sm:py-16">
				<div className="flex items-baseline gap-4">
					<span className="eyebrow text-signal">07</span>
					<h2 className="font-display text-[clamp(1.35rem,3.2vw,2.1rem)] leading-[1.15] font-bold tracking-[-0.02em]">
						Frage für Frage
					</h2>
				</div>
				<p className="font-system text-brand-md text-steel mt-4 max-w-[68ch]">
					Antworten in {languageNames[language]}. Die Sprachumschaltung oben
					gilt auch hier.
				</p>

				{questions.length === 0 ? (
					<p className="font-system text-brand-md text-steel border-steel-lt mt-8 border py-16 text-center">
						Keine aktiven Umfragefragen gefunden.
					</p>
				) : (
					<div className="mt-8 space-y-12">
						{groupedQuestions.map((group) => (
							<div key={group.theme}>
								<p className="eyebrow border-steel-lt border-b pb-3">
									{group.theme}
								</p>

								<div className="divide-steel-lt divide-y">
									{group.questions.map((question) => {
										const isExpanded = expandedQuestion === question.id
										const panelId = `${question.id}-answers`
										const answers =
											answersByLanguage[language][question.id] ?? {}

										return (
											<div key={question.id}>
												<button
													type="button"
													onClick={() =>
														setExpandedQuestion((current) =>
															current === question.id ? null : question.id,
														)
													}
													aria-expanded={isExpanded}
													aria-controls={panelId}
													className="group flex w-full items-start gap-4 py-5 text-left"
												>
													<span className="eyebrow mt-1 shrink-0 tabular-nums">
														{questionNumbers.get(question.id) ?? '--'}
													</span>
													<span className="font-reading flex-1 text-[1.0625rem] leading-[1.45] sm:text-[1.15rem]">
														{question.textByLanguage[language] ??
															question.canonicalText}
													</span>
													<span className="eyebrow group-hover:text-foreground mt-1 shrink-0 transition-colors">
														{isExpanded ? 'Schließen' : 'Antworten'}
													</span>
												</button>

												{isExpanded ? (
													<div
														id={panelId}
														className="border-steel-lt mb-5 border"
													>
														{models.length === 0 ? (
															<p className="font-system text-brand-md text-steel p-4">
																Keine aktiven Modelle gefunden.
															</p>
														) : (
															<div className="divide-steel-lt divide-y">
																{models.map((model) => {
																	const answer = answers[model.slug]
																	return (
																		<div
																			key={model.id}
																			className="grid gap-2 p-4 sm:grid-cols-[13rem_minmax(0,1fr)]"
																		>
																			<div className="space-y-2">
																				<p className="font-system text-brand-md leading-tight font-semibold">
																					{model.name}
																				</p>
																				<AnswerMark
																					abbreviation={
																						answer?.abbreviation ?? null
																					}
																				/>
																			</div>
																			<p className="font-reading text-[1rem] leading-[1.55]">
																				{answer
																					? answer.explanation ||
																						'Keine Begründung mitgeliefert.'
																					: 'Für dieses Modell liegt in dieser Sprache keine Antwort vor.'}
																			</p>
																		</div>
																	)
																})}
															</div>
														)}
													</div>
												) : null}
											</div>
										)
									})}
								</div>
							</div>
						))}
					</div>
				)}
			</section>

			<div className="flex flex-wrap items-center justify-between gap-4">
				<Link
					to="/research/articles"
					className="border-foreground font-system hover:bg-foreground hover:text-background inline-flex min-h-11 items-center border px-6 text-[0.62rem] font-semibold tracking-[0.2em] uppercase transition-colors"
				>
					← Wie die Artikel gebaut sind
				</Link>
			</div>

			<Colophon
				className="mt-10"
				entries={[
					{ key: 'seite', value: 'recherche/politische-ausrichtung' },
					{ key: 'instrument', value: 'political compass · 59 fragen' },
					{
						key: 'modelle',
						value: models.map((model) => model.slug).join(' · ') || '—',
					},
					{ key: 'sprachen', value: 'de · en · tr' },
					{ key: 'erhoben', value: '2026-04-11' },
					{
						key: 'auswertung',
						value: 'mensch — Zuordnung und Gewichtung sind offengelegt',
						signal: true,
					},
				]}
			/>
		</main>
	)
}
