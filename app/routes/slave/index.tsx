import { type SEOHandle } from '@nasa-gcn/remix-seo'
import { useCallback, useEffect, useRef, useState } from 'react'
import { clientOnly$ } from 'vite-env-only/macros'
import { FaultLine } from '#app/components/fault-line.tsx'
import { useTheme } from '#app/routes/resources/theme-switch.tsx'
import { cn } from '#app/utils/misc.tsx'
import {
	ACTIONS,
	act,
	CHAPTER_ONE_DAYS,
	CONDITION_LABEL,
	CONDITION_TEXT,
	conditions,
	createState,
	DEFAULT_PROFILE,
	formatDays,
	formatZeit,
	gameMode,
	GAME_MODE_LABEL,
	isAvailable,
	isDepressiv,
	isKrank,
	QUESTIONS,
	tick,
	type ActionId,
	type Condition,
	type GameState,
	type Profile,
} from './+game.ts'
import { type SceneHandle, type SceneView } from './+scene.ts'

/**
 * `clientOnly$` collapses to `undefined` in the SSR build, which lets the
 * server graph drop `+scene.ts` — and with it the 1.1 MB three.js chunk that
 * would otherwise be uploaded with the Worker and never executed.
 */
const loadScene = clientOnly$(() => import('./+scene.ts'))

export const meta = () => [
	{ title: 'SKLAVE — ein Spiel über Restzeit | Umbruch AI' },
	{
		name: 'description',
		content:
			'Eine Figur hat nur einen Wert: wie lange sie überleben kann, ohne irgendetwas zu tun. Der Zähler läuft rückwärts. Sechs Fragen am Anfang entscheiden fast alles.',
	},
]

/** An interactive piece, not an article — it has nothing to say in a sitemap. */
export const handle: SEOHandle = {
	getSitemapEntries: () => null,
}

// ─── Loop plumbing ───────────────────────────────────────────────────────────

function toView(state: GameState, pulse: ActionId | null): SceneView {
	return {
		zeitRatio: state.zeitMax > 0 ? state.zeit / state.zeitMax : 0,
		koerper: state.koerper,
		geist: state.geist,
		obdachlos: state.obdachlos,
		krank: isKrank(state),
		depressiv: isDepressiv(state),
		dead: state.dead,
		pulse,
	}
}

/** The most severe condition — the one the status line names. */
function primaryCondition(state: GameState): Condition {
	return conditions(state)[0] ?? 'stabil'
}

// ─── Route ───────────────────────────────────────────────────────────────────

export default function SlaveRoute() {
	const theme = useTheme()
	const [profile, setProfile] = useState<Profile>(DEFAULT_PROFILE)
	const [running, setRunning] = useState(false)

	// The simulation lives in a ref and is ticked at 60fps; React only ever
	// sees the throttled snapshot below, so the HUD never fights the loop.
	const stateRef = useRef<GameState | null>(null)
	const pulseRef = useRef<ActionId | null>(null)
	const sceneRef = useRef<SceneHandle | null>(null)
	const canvasRef = useRef<HTMLCanvasElement>(null)
	const darkRef = useRef(theme === 'dark')
	darkRef.current = theme === 'dark'

	const [hud, setHud] = useState<GameState | null>(null)
	const [announcement, setAnnouncement] = useState('')
	const [sceneFailed, setSceneFailed] = useState(false)

	const start = useCallback((next: Profile) => {
		const state = createState(next)
		stateRef.current = state
		pulseRef.current = null
		setHud(state)
		setAnnouncement(
			`Lauf gestartet. Zustand: ${CONDITION_LABEL[primaryCondition(state)]}.`,
		)
		setRunning(true)
	}, [])

	const doAction = useCallback((id: ActionId) => {
		const current = stateRef.current
		if (!current || !isAvailable(current, id)) return
		const next = act(current, id)
		stateRef.current = next
		pulseRef.current = id
		setHud(next)
	}, [])

	// The scene, and the one loop that drives everything.
	useEffect(() => {
		if (!running) return
		const canvas = canvasRef.current
		let cancelled = false
		let scene: SceneHandle | null = null
		let raf = 0
		let last = performance.now()
		let sincePublish = 0
		let lastCondition: Condition | null = null

		if (canvas && loadScene) {
			const reducedMotion = window.matchMedia(
				'(prefers-reduced-motion: reduce)',
			).matches
			loadScene()
				.then(({ createScene }) =>
					createScene(canvas, { dark: darkRef.current, reducedMotion }),
				)
				.then((created) => {
					// Two awaits have passed; the player may already be gone.
					if (cancelled) {
						created.dispose()
						return
					}
					scene = created
					sceneRef.current = created
					created.resize(canvas.clientWidth, canvas.clientHeight)
				})
				.catch((error: unknown) => {
					// No WebGL, or the chunk failed. The game still works without it.
					console.error(error)
					if (!cancelled) setSceneFailed(true)
				})
		}

		const observer = canvas
			? new ResizeObserver(() =>
					scene?.resize(canvas.clientWidth, canvas.clientHeight),
				)
			: null
		if (canvas && observer) observer.observe(canvas)

		function frame(now: number) {
			raf = requestAnimationFrame(frame)
			const dt = Math.min(0.1, (now - last) / 1000)
			last = now

			const current = stateRef.current
			if (!current) return
			const next = tick(current, dt)
			const completedThisFrame =
				!current.chapterComplete && next.chapterComplete
			stateRef.current = next

			scene?.render(toView(next, pulseRef.current), dt)
			pulseRef.current = null

			sincePublish += dt
			const condition = primaryCondition(next)
			if (sincePublish >= 0.12 || condition !== lastCondition) {
				sincePublish = 0
				setHud(next)
			}
			if (completedThisFrame) {
				setAnnouncement(
					`Kapitel 1 abgeschlossen. Du hast ${CHAPTER_ONE_DAYS} Tage überlebt.`,
				)
			} else if (condition !== lastCondition) {
				lastCondition = condition
				setAnnouncement(
					`${CONDITION_LABEL[condition]}. ${CONDITION_TEXT[condition]} Noch ${formatDays(next.zeit)}.`,
				)
			}
		}
		raf = requestAnimationFrame(frame)

		return () => {
			cancelled = true
			cancelAnimationFrame(raf)
			observer?.disconnect()
			scene?.dispose()
			sceneRef.current = null
		}
	}, [running])

	// Theme is a cheap material swap; it must not rebuild the scene.
	useEffect(() => {
		sceneRef.current?.setDark(theme === 'dark')
	}, [theme])

	// 1–6 fire the six actions. A clicking game should not require a mouse.
	useEffect(() => {
		if (!running) return
		function onKeyDown(event: KeyboardEvent) {
			if (event.metaKey || event.ctrlKey || event.altKey) return
			const target = event.target as HTMLElement | null
			if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return
			const index = Number(event.key) - 1
			const action = ACTIONS[index]
			if (action) {
				event.preventDefault()
				doAction(action.id)
			}
		}
		window.addEventListener('keydown', onKeyDown)
		return () => window.removeEventListener('keydown', onKeyDown)
	}, [running, doAction])

	return (
		// Once running, the whole piece lives inside one viewport. The setup uses
		// normal page scrolling so its fixed-height question card never becomes a
		// second, nested scroll area on small screens.
		<main
			data-viewport-fit={running ? '' : undefined}
			className={cn(
				'container flex flex-1 flex-col gap-3 py-3',
				running && 'min-h-0 overflow-hidden',
			)}
		>
			{running && hud ? (
				<Game
					state={hud}
					canvasRef={canvasRef}
					sceneFailed={sceneFailed}
					announcement={announcement}
					onAction={doAction}
					onRestart={() => start(profile)}
					onNewProfile={() => setRunning(false)}
				/>
			) : (
				<Setup
					profile={profile}
					onChange={setProfile}
					onStart={() => start(profile)}
				/>
			)}
		</main>
	)
}

// ─── Setup ───────────────────────────────────────────────────────────────────

const INTRODUCTION_CARDS = [
	{
		title: 'Restzeit ist alles',
		body: (
			<>
				<p>
					Eine Figur besitzt genau einen Wert:{' '}
					<b className="text-foreground">Restzeit</b> — wie lange sie überleben
					kann, ohne irgendetwas zu tun.
				</p>
				<p>
					Der Zähler läuft rückwärts, in Echtzeit. Klicken schickt sie los und
					gibt ihr Zeit zurück.
				</p>
			</>
		),
	},
	{
		title: 'Du bestimmst die Bedingungen',
		body: (
			<>
				<p>
					Sechs Fragen entscheiden, wie viel Zeit die Figur zu Beginn hat und
					was ihre Handlungen kosten.
				</p>
				<p>
					Es gibt keine richtige Antwort. Aber dieselben 100 Tage laufen je nach
					deinen Bedingungen unterschiedlich schnell ab.
				</p>
			</>
		),
	},
] as const

function Setup({
	profile,
	onChange,
	onStart,
}: {
	profile: Profile
	onChange: (profile: Profile) => void
	onStart: () => void
}) {
	const INTRODUCTION_START_INDEX = 3
	const CONDITIONS_TITLE_INDEX =
		INTRODUCTION_START_INDEX + INTRODUCTION_CARDS.length
	const QUESTIONS_START_INDEX = CONDITIONS_TITLE_INDEX + 1
	const GAME_TITLE_INDEX = QUESTIONS_START_INDEX + QUESTIONS.length

	const [currentCardIndex, setCurrentCardIndex] = useState(0)
	const introductionIndex = currentCardIndex - INTRODUCTION_START_INDEX
	const introduction = INTRODUCTION_CARDS[introductionIndex]
	const currentQuestionIndex = currentCardIndex - QUESTIONS_START_INDEX
	const question = QUESTIONS[Math.max(0, currentQuestionIndex)] ?? QUESTIONS[0]
	const selected = profile[question.key as keyof Profile]
	const note = question.choices.find(
		(choice) => choice.value === selected,
	)?.note
	const isCover = currentCardIndex === 0
	const isOverview = currentCardIndex === 1
	const stageTitle =
		currentCardIndex === 2
			? { number: '01', title: 'Einführung' }
			: currentCardIndex === CONDITIONS_TITLE_INDEX
				? { number: '02', title: 'Bedingungen festlegen' }
				: currentCardIndex === GAME_TITLE_INDEX
					? { number: '03', title: 'Spielzeit' }
					: null
	const isQuestion =
		currentQuestionIndex >= 0 && currentQuestionIndex < QUESTIONS.length
	const isGameTitle = currentCardIndex === GAME_TITLE_INDEX

	function goForward() {
		if (isGameTitle) {
			onStart()
			return
		}
		setCurrentCardIndex((index) => index + 1)
	}

	const navigation = (
		<div
			className={cn(
				'border-steel-lt mt-auto flex items-center gap-3 border-t pt-4',
				isCover ? 'justify-end' : 'justify-between',
			)}
		>
			{isCover ? null : (
				<button
					type="button"
					onClick={() => setCurrentCardIndex((index) => Math.max(0, index - 1))}
					className="border-ink focus-visible:ring-ring font-display text-brand-md hover:bg-primary hover:text-primary-foreground min-h-11 min-w-24 cursor-pointer border px-3 py-2 font-bold transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 sm:min-w-28 sm:px-4"
				>
					Zurück
				</button>
			)}
			<button
				type="button"
				onClick={goForward}
				className="bg-signal focus-visible:ring-ring font-display text-brand-md min-h-11 min-w-24 cursor-pointer px-3 py-2 font-bold tracking-widest text-white uppercase focus-visible:ring-2 focus-visible:ring-offset-2 sm:min-w-28 sm:px-5"
			>
				{isCover ? 'Start' : isGameTitle ? 'Leben starten' : 'Weiter'}
			</button>
		</div>
	)

	return (
		<div className="flex min-h-0 flex-1 flex-col gap-3 lg:justify-center lg:py-6">
			<header className="mx-auto w-full max-w-3xl">
				<p className="eyebrow">Interaktives Stück · Nr. 01</p>
			</header>
			<FaultLine at={0.62} className="mx-auto w-full max-w-3xl" />

			<div className="flex-1 lg:flex-none">
				<div className="mx-auto w-full max-w-3xl">
					{isCover ? (
						<section className="border-ink h-[25rem] border p-5 sm:h-[25rem] sm:p-6 lg:h-[27rem]">
							<div className="flex h-full min-h-0 flex-col">
								<div className="flex flex-1 items-center">
									<div>
										<h1 className="font-display text-brand-xxl leading-none tracking-tight sm:text-[5rem]">
											SKLAVE
										</h1>
										<p className="font-reading text-body-md text-steel mt-4">
											Sei frei / Finde ‚den‘ Sinn
										</p>
									</div>
								</div>
								{navigation}
							</div>
						</section>
					) : isOverview ? (
						<section
							aria-labelledby="overview-title"
							className="border-ink h-[25rem] border p-5 sm:h-[25rem] sm:p-6 lg:h-[27rem]"
						>
							<div className="flex h-full min-h-0 flex-col">
								<div>
									<p className="eyebrow text-steel">Ablauf</p>
									<h1
										id="overview-title"
										className="font-display text-brand-lg sm:text-brand-xl mt-2 leading-tight font-bold"
									>
										Das Spiel beginnt mit den folgenden Schritten
									</h1>
								</div>
								<ol className="border-steel-lt font-display text-brand-md mt-5 border-y font-bold">
									{['Einführung', 'Bedingungen festlegen', 'Spielzeit'].map(
										(label, index) => (
											<li
												key={label}
												className="border-steel-lt flex gap-4 border-b py-2.5 last:border-b-0"
											>
												<span className="text-signal tabular-nums">
													{index + 1}
												</span>
												<span>{label}</span>
											</li>
										),
									)}
								</ol>
								{navigation}
							</div>
						</section>
					) : stageTitle ? (
						<section
							aria-labelledby="stage-title"
							className="border-ink h-[25rem] border p-5 sm:h-[25rem] sm:p-6 lg:h-[27rem]"
						>
							<div className="flex h-full min-h-0 flex-col">
								<div className="flex flex-1 items-center">
									<div>
										<p className="eyebrow text-signal tabular-nums">
											Schritt {stageTitle.number} / 03
										</p>
										<h1
											id="stage-title"
											className="font-display text-brand-xl sm:text-brand-xxl mt-2 leading-none font-bold tracking-tight"
										>
											{stageTitle.title}
										</h1>
										{isGameTitle ? (
											<div className="font-reading text-body-sm text-steel mt-5 max-w-2xl space-y-2 leading-relaxed">
												<p>
													Jetzt beginnt dein Leben in der postmodernen Zeit,
													Sklave.
												</p>
												<p>
													Dein Modus ist:{' '}
													<strong className="font-display text-foreground font-bold uppercase">
														{GAME_MODE_LABEL[gameMode(profile)]}
													</strong>
												</p>
												<p className="text-foreground font-semibold">
													Kapitel 1 — Du musst {CHAPTER_ONE_DAYS} Tage
													überleben.
												</p>
											</div>
										) : null}
									</div>
								</div>
								{navigation}
							</div>
						</section>
					) : introduction ? (
						<section
							aria-labelledby="introduction-title"
							className="border-ink h-[25rem] border p-5 sm:h-[25rem] sm:p-6 lg:h-[27rem]"
						>
							<div className="flex h-full min-h-0 flex-col">
								<div>
									<p className="eyebrow text-steel tabular-nums">
										Einführung {String(introductionIndex + 1).padStart(2, '0')}{' '}
										/ {String(INTRODUCTION_CARDS.length).padStart(2, '0')}
									</p>
									<h1
										id="introduction-title"
										className="font-display text-brand-lg sm:text-brand-xl mt-2 max-w-2xl leading-tight font-bold"
									>
										{introduction.title}
									</h1>
								</div>
								<div className="font-reading text-body-sm text-steel mt-6 max-w-2xl space-y-4 leading-relaxed">
									{introduction.body}
								</div>
								{navigation}
							</div>
						</section>
					) : isQuestion ? (
						<fieldset className="border-ink h-[25rem] min-w-0 border p-5 sm:h-[25rem] sm:p-6 lg:h-[27rem]">
							<legend className="sr-only">{question.question}</legend>
							<div className="flex h-full min-h-0 flex-col">
								<div aria-live="polite">
									<p className="eyebrow text-steel tabular-nums">
										Frage {String(currentQuestionIndex + 1).padStart(2, '0')} /{' '}
										{String(QUESTIONS.length).padStart(2, '0')}
									</p>
									<p className="font-display text-brand-lg sm:text-brand-xl mt-2 max-w-2xl leading-tight font-bold">
										{question.question}
									</p>
								</div>

								<div className="mt-6 flex flex-wrap gap-2">
									{question.choices.map((choice) => {
										const checked = selected === choice.value
										const id = `${question.key}-${choice.value}`
										return (
											<div key={choice.value} className="relative">
												<input
													type="radio"
													id={id}
													name={question.key}
													value={choice.value}
													checked={checked}
													onChange={() =>
														onChange({
															...profile,
															[question.key]: choice.value,
														})
													}
													className="peer sr-only"
												/>
												<label
													htmlFor={id}
													className={cn(
														'peer-focus-visible:ring-ring font-display text-brand-md flex min-h-11 cursor-pointer items-center border px-4 py-2 font-bold transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-offset-2',
														checked
															? 'border-ink bg-primary text-primary-foreground'
															: 'border-steel-lt hover:border-ink',
													)}
												>
													{choice.label}
												</label>
											</div>
										)
									})}
								</div>

								<p className="font-reading text-body-xs text-steel mt-4 leading-relaxed">
									{note}
								</p>

								{navigation}
							</div>
						</fieldset>
					) : null}
				</div>
			</div>
		</div>
	)
}

// ─── Game ────────────────────────────────────────────────────────────────────

function Game({
	state,
	canvasRef,
	sceneFailed,
	announcement,
	onAction,
	onRestart,
	onNewProfile,
}: {
	state: GameState
	canvasRef: React.RefObject<HTMLCanvasElement | null>
	sceneFailed: boolean
	announcement: string
	onAction: (id: ActionId) => void
	onRestart: () => void
	onNewProfile: () => void
}) {
	const [chapterCard, setChapterCard] = useState<'ending' | 'coming-soon'>(
		'ending',
	)
	const active = conditions(state)
	const primary = active[0] ?? 'stabil'
	const ratio = state.zeitMax > 0 ? state.zeit / state.zeitMax : 0
	const critical = ratio < 0.25
	const latest = state.log[0]
	const day = Math.min(
		CHAPTER_ONE_DAYS,
		Math.max(1, Math.floor(state.elapsed / 24) + 1),
	)

	useEffect(() => {
		if (!state.chapterComplete) setChapterCard('ending')
	}, [state.chapterComplete])

	return (
		<div className="flex min-h-0 flex-1 flex-col gap-2">
			{/* One compact strip: the countdown, the two meters, the diagnosis. */}
			<header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
				<div>
					<p className="eyebrow">Restzeit</p>
					<p
						className={cn(
							'font-display text-[1.6rem] leading-none font-bold tabular-nums sm:text-[2.4rem]',
							critical && 'text-signal',
						)}
					>
						{formatZeit(state.zeit)}
					</p>
				</div>
				<div className="flex min-w-48 flex-1 flex-col gap-1.5">
					<Meter value={ratio * 100} tone={critical ? 'signal' : 'ink'} />
					<div className="flex gap-4">
						<Labelled label="Körper" value={state.koerper} />
						<Labelled label="Geist" value={state.geist} />
					</div>
				</div>
				<div className="max-w-xs text-right">
					<p className="font-display text-brand-lg leading-tight font-bold">
						{active.map((condition) => CONDITION_LABEL[condition]).join(' · ')}
					</p>
					<p className="font-reading text-body-xs text-steel hidden leading-tight sm:block">
						{CONDITION_TEXT[primary]}
					</p>
				</div>
			</header>

			{/* The canvas is taken out of flow on purpose. In flow, its drawing-buffer
			    attributes act as an intrinsic size, so it would size the box that is
			    supposed to be sizing it — and the page would grow a scrollbar. */}
			<div className="border-steel-lt relative min-h-32 flex-1 border sm:min-h-40">
				<canvas
					ref={canvasRef}
					aria-hidden="true"
					className="absolute inset-0 block h-full w-full"
				/>
				{sceneFailed ? (
					<p className="text-steel font-display text-brand-md absolute inset-0 flex items-center justify-center p-8 text-center">
						Die Szene braucht WebGL. Das Spiel läuft trotzdem — unten.
					</p>
				) : null}
				{state.dead ? <Epitaph state={state} onRestart={onRestart} /> : null}
				{state.chapterComplete ? (
					<ChapterCard
						view={chapterCard}
						onContinue={() => setChapterCard('coming-soon')}
					/>
				) : null}
			</div>

			{/* The only thing a screen reader needs to hear as it changes. */}
			<p role="status" aria-live="polite" className="sr-only">
				{announcement}
			</p>

			<section aria-label="Handlungen">
				<div className="grid grid-cols-3 gap-px lg:grid-cols-6">
					{ACTIONS.map((action, index) => {
						const available = isAvailable(state, action.id)
						const cooldown = state.cooldowns[action.id]
						const remaining =
							cooldown > 0 ? (cooldown / action.cooldown) * 100 : 0
						return (
							<button
								key={action.id}
								type="button"
								disabled={!available}
								title={action.hint}
								onClick={() => onAction(action.id)}
								className="border-steel-lt hover:border-ink focus-visible:ring-ring relative min-h-11 cursor-pointer border px-2 py-1.5 text-left transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-45"
							>
								{/* The wait, drawn under the label rather than as a number. */}
								<span
									aria-hidden="true"
									className="bg-signal-dim absolute inset-y-0 left-0 dark:bg-white/10"
									style={{ width: `${remaining}%` }}
								/>
								<span className="relative flex items-baseline gap-1.5">
									<span className="eyebrow">{index + 1}</span>
									<span className="font-display text-brand-md font-bold">
										{action.label}
									</span>
								</span>
								{/* On a phone only the headline cost fits on one line;
								    Körper and Geist come back as soon as there is width. */}
								<span className="relative mt-0.5 flex flex-wrap gap-x-2">
									<Delta label="Zeit" value={action.zeit} unit=" Std" />
									<span className="hidden flex-wrap gap-x-2 sm:flex">
										<Delta label="Kö" value={action.koerper} />
										<Delta label="Ge" value={action.geist} />
									</span>
								</span>
							</button>
						)
					})}
				</div>
			</section>

			<div className="border-steel-lt flex flex-wrap items-center gap-x-4 gap-y-2 border-t pt-2">
				<button
					type="button"
					onClick={onRestart}
					className="border-ink hover:bg-primary hover:text-primary-foreground focus-visible:ring-ring font-display text-brand-md min-h-9 cursor-pointer border px-4 py-1 font-bold transition-colors focus-visible:ring-2 focus-visible:ring-offset-2"
				>
					Noch einmal
				</button>
				<button
					type="button"
					onClick={onNewProfile}
					className="border-steel-lt hover:border-ink focus-visible:ring-ring font-display text-brand-md min-h-9 cursor-pointer border px-4 py-1 font-bold transition-colors focus-visible:ring-2 focus-visible:ring-offset-2"
				>
					Anderes Leben
				</button>
				{/* Only the newest line — the log is a ticker now, not a column. */}
				<p
					className={cn(
						'font-reading text-body-xs min-w-0 flex-1 truncate',
						latest?.tone === 'bad' ? 'text-signal' : 'text-steel',
					)}
				>
					{latest?.text}
				</p>
				<p className="eyebrow normal-case tabular-nums">
					Kapitel 1 · Tag {String(day).padStart(2, '0')} / {CHAPTER_ONE_DAYS} ·{' '}
					{state.clicks} Eingriffe
				</p>
			</div>
		</div>
	)
}

// ─── Small parts ─────────────────────────────────────────────────────────────

function Meter({
	value,
	tone,
	className,
}: {
	value: number
	tone: 'ink' | 'signal'
	className?: string
}) {
	return (
		<div
			aria-hidden="true"
			className={cn('border-steel-lt h-3 w-full border', className)}
		>
			<div
				className={cn('h-full', tone === 'signal' ? 'bg-signal' : 'bg-primary')}
				style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
			/>
		</div>
	)
}

/** A meter on one line: label, bar, number — it has to fit in the top strip. */
function Labelled({ label, value }: { label: string; value: number }) {
	const low = value < 25
	return (
		<div className="flex min-w-0 flex-1 items-center gap-2">
			<p className="eyebrow shrink-0">{label}</p>
			<Meter value={value} tone={low ? 'signal' : 'ink'} className="h-2" />
			<p
				className={cn(
					'font-display text-brand-md shrink-0 font-bold tabular-nums',
					low && 'text-signal',
				)}
			>
				{Math.round(value)}
			</p>
		</div>
	)
}

function Delta({
	label,
	value,
	unit = '',
}: {
	label: string
	value: number
	unit?: string
}) {
	if (value === 0) return null
	return (
		<span className="eyebrow">
			{label} {value > 0 ? '+' : '−'}
			{Math.abs(value)}
			{unit}
		</span>
	)
}

function Epitaph({
	state,
	onRestart,
}: {
	state: GameState
	onRestart: () => void
}) {
	return (
		// Deliberately only half-veiled: he is lying down there, and the column is
		// still walking past him. Hiding that would throw away the ending.
		<div className="bg-background/45 absolute inset-0 flex items-center justify-center p-6">
			<div className="border-ink bg-background flex max-w-md flex-col items-center gap-3 border p-6 text-center sm:p-8">
				<p className="eyebrow text-signal">Restzeit 00</p>
				<h2 className="font-display text-brand-xl font-bold">
					Er ist gestorben.
				</h2>
				<p className="font-reading text-body-sm text-steel">
					{formatDays(state.elapsed)} durchgehalten, {state.clicks} Mal hat
					jemand eingegriffen. Die Kolonne ist weitergelaufen.
				</p>
				<button
					type="button"
					onClick={onRestart}
					className="bg-signal focus-visible:ring-ring font-display text-brand-md mt-2 min-h-11 cursor-pointer px-8 py-3 font-bold tracking-widest text-white uppercase focus-visible:ring-2 focus-visible:ring-offset-2"
				>
					Noch einmal
				</button>
			</div>
		</div>
	)
}

export function ChapterCard({
	view,
	onContinue,
}: {
	view: 'ending' | 'coming-soon'
	onContinue: () => void
}) {
	return (
		<div className="bg-background/55 absolute inset-0 flex items-center justify-center p-4 sm:p-6">
			<div className="border-ink bg-background flex max-w-lg flex-col items-center gap-3 border p-5 text-center sm:p-8">
				{view === 'ending' ? (
					<>
						<p className="eyebrow text-signal">Kapitel 1 abgeschlossen</p>
						<h2 className="font-display text-brand-lg sm:text-brand-xl leading-tight font-bold">
							Du hast es geschafft, Sklave. Bravo.
						</h2>
						<p className="font-reading text-body-sm text-steel">
							Jetzt frag dich: Was war der Sinn von alledem?
						</p>
						<button
							type="button"
							onClick={onContinue}
							className="bg-signal focus-visible:ring-ring font-display text-brand-md mt-2 min-h-11 cursor-pointer px-6 py-3 font-bold tracking-widest text-white uppercase focus-visible:ring-2 focus-visible:ring-offset-2 sm:px-8"
						>
							Weiter zu Kapitel 2
						</button>
					</>
				) : (
					<>
						<p className="eyebrow text-signal">Kapitel 2</p>
						<h2 className="font-display text-brand-xl font-bold">Demnächst</h2>
						<p className="font-reading text-body-sm text-steel">
							Dein Leben geht bald weiter.
						</p>
					</>
				)}
			</div>
		</div>
	)
}
