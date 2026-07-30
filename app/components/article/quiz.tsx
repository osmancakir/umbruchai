import { useEffect, useMemo, useState } from 'react'
import { type ArticleQuestion } from '#app/utils/articles.types.ts'
import { cn } from '#app/utils/misc.tsx'
import { FaultProgress } from '../fault-line.tsx'

/**
 * The comprehension quiz. One question at a time, answers judged the moment
 * they are picked — the reader is checking understanding, not being graded, so
 * there is no submit-then-reveal ceremony.
 *
 * Correct and incorrect are told apart by mark and position, never by colour
 * alone: ✓/✕ glyphs and an Ink fill do the work, so the panel stays inside the
 * brand's two-and-a-half colours.
 */
export function ArticleQuiz({
	questions,
	className,
}: {
	questions: ArticleQuestion[]
	className?: string
}) {
	const [selectedAnswers, setSelectedAnswers] = useState<
		Record<string, string[]>
	>({})
	const [currentIndex, setCurrentIndex] = useState(0)
	const [isResultVisible, setIsResultVisible] = useState(false)

	// Switching reading level swaps the whole question set out under us.
	const quizIdentity = useMemo(
		() => questions.map((question) => question._key).join('|'),
		[questions],
	)

	const statuses = useMemo(
		() =>
			questions.map((question) => {
				const selected = new Set(selectedAnswers[question._key] ?? [])
				if (selected.size === 0) return 'unanswered' as const
				const correct = new Set(
					question.options
						.filter((option) => option.isCorrect)
						.map((option) => option._key),
				)
				const isCorrect =
					selected.size === correct.size &&
					[...selected].every((key) => correct.has(key))
				return isCorrect ? ('correct' as const) : ('incorrect' as const)
			}),
		[questions, selectedAnswers],
	)

	const correctCount = statuses.filter((s) => s === 'correct').length
	const incorrectCount = statuses.filter((s) => s === 'incorrect').length
	const answeredCount = statuses.filter((s) => s !== 'unanswered').length
	const isCompleted = questions.length > 0 && answeredCount === questions.length
	const current = questions[currentIndex] ?? null
	const currentSelected = useMemo(
		() => new Set(current ? (selectedAnswers[current._key] ?? []) : []),
		[current, selectedAnswers],
	)

	useEffect(() => {
		setSelectedAnswers({})
		setCurrentIndex(0)
		setIsResultVisible(false)
	}, [quizIdentity])

	function toggleAnswer(questionKey: string, optionKey: string, multi = false) {
		setSelectedAnswers((previous) => {
			const answers = new Set(previous[questionKey] ?? [])
			if (answers.has(optionKey)) {
				answers.delete(optionKey)
			} else {
				if (!multi) answers.clear()
				answers.add(optionKey)
			}
			return { ...previous, [questionKey]: Array.from(answers) }
		})
	}

	if (questions.length === 0) return null

	return (
		<section className={cn('', className)} aria-labelledby="quiz-heading">
			<div className="mb-6 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
				<h2
					id="quiz-heading"
					className="font-display text-brand-xl tracking-[-0.02em]"
				>
					Verstanden?
				</h2>
				<p className="eyebrow">
					{isResultVisible
						? 'Ergebnis'
						: `Frage ${currentIndex + 1} von ${questions.length}`}
				</p>
			</div>

			<div className="border-foreground border">
				{isResultVisible ? (
					<div className="p-6 sm:p-8">
						<p className="eyebrow">Auswertung</p>
						<p className="font-display mt-4 text-[clamp(1.6rem,4vw,2.4rem)] leading-[1.1] font-extrabold tracking-[-0.03em] tabular-nums">
							{correctCount} von {questions.length} richtig
						</p>
						<dl className="border-steel-lt mt-8 grid border-t sm:grid-cols-2">
							<div className="border-steel-lt border-b px-1 py-4 sm:border-r sm:pr-6">
								<dt className="eyebrow">Richtig</dt>
								<dd className="font-display mt-1 text-2xl font-bold tabular-nums">
									{correctCount}
								</dd>
							</div>
							<div className="border-steel-lt border-b px-1 py-4 sm:pl-6">
								<dt className="eyebrow">Falsch</dt>
								<dd className="font-display mt-1 text-2xl font-bold tabular-nums">
									{incorrectCount}
								</dd>
							</div>
						</dl>
						<div className="mt-6 flex justify-end">
							<QuizButton
								onClick={() => {
									setIsResultVisible(false)
									setCurrentIndex(0)
									setSelectedAnswers({})
								}}
							>
								Noch einmal
							</QuizButton>
						</div>
					</div>
				) : (
					<div className="flex flex-col">
						<div className="border-steel-lt flex items-center gap-4 border-b px-5 py-3 sm:px-8">
							<FaultProgress
								value={answeredCount / questions.length}
								label={`${answeredCount} von ${questions.length} Fragen beantwortet`}
								className="max-w-48 flex-1"
							/>
							<p className="eyebrow ml-auto tabular-nums">
								<span aria-label={`${correctCount} richtig`}>
									✓ {correctCount}
								</span>
								<span className="text-steel-lt mx-2" aria-hidden>
									|
								</span>
								<span aria-label={`${incorrectCount} falsch`}>
									✕ {incorrectCount}
								</span>
							</p>
						</div>

						<div className="px-5 py-6 sm:px-8 sm:py-8">
							<div className="flex items-start gap-4">
								<span className="font-display text-signal pt-0.5 text-lg font-extrabold tabular-nums">
									{String(currentIndex + 1).padStart(2, '0')}
								</span>
								<div className="min-w-0 flex-1">
									<p className="font-reading text-[1.2rem] leading-[1.4]">
										{current?.prompt}
									</p>
									{current?.multi ? (
										<p className="eyebrow mt-2">Mehrfachauswahl</p>
									) : null}
								</div>
							</div>

							<div className="mt-6 grid gap-2">
								{current?.options.map((option, optionIndex) => {
									const isActive = currentSelected.has(option._key)
									const isCorrect = Boolean(option.isCorrect)
									return (
										<button
											key={option._key}
											type="button"
											aria-pressed={isActive}
											onClick={() =>
												toggleAnswer(current._key, option._key, current.multi)
											}
											className={cn(
												'flex items-center gap-3 border px-4 py-3 text-left transition-colors',
												isActive
													? isCorrect
														? 'border-foreground bg-foreground text-background'
														: 'border-signal bg-signal-dim text-ink'
													: 'border-steel-lt hover:border-foreground',
											)}
										>
											<span className="font-system w-4 shrink-0 text-[0.7rem] font-semibold">
												{String.fromCharCode(65 + optionIndex)}
											</span>
											<span className="font-reading min-w-0 flex-1 text-[1.02rem] leading-[1.45]">
												{option.label}
											</span>
											{isActive ? (
												<span
													className="font-system shrink-0 text-sm"
													aria-label={isCorrect ? 'Richtig' : 'Falsch'}
												>
													{isCorrect ? '✓' : '✕'}
												</span>
											) : null}
										</button>
									)
								})}
							</div>
						</div>

						<div className="border-steel-lt flex items-center justify-between gap-3 border-t px-5 py-4 sm:px-8">
							{currentIndex > 0 ? (
								<QuizButton
									onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
									variant="quiet"
								>
									Zurück
								</QuizButton>
							) : (
								<span aria-hidden />
							)}
							{currentIndex < questions.length - 1 ? (
								<QuizButton
									onClick={() =>
										setCurrentIndex((i) =>
											Math.min(questions.length - 1, i + 1),
										)
									}
								>
									Weiter
								</QuizButton>
							) : (
								<QuizButton
									disabled={!isCompleted}
									onClick={() => setIsResultVisible(true)}
								>
									Auswerten
								</QuizButton>
							)}
						</div>
					</div>
				)}
			</div>
		</section>
	)
}

export function QuizButton({
	variant = 'solid',
	className,
	...props
}: { variant?: 'solid' | 'quiet' } & React.ComponentProps<'button'>) {
	return (
		<button
			type="button"
			className={cn(
				'font-system inline-flex min-h-11 items-center border px-4 text-[0.62rem] font-semibold tracking-[0.2em] uppercase transition-colors',
				variant === 'solid'
					? 'border-foreground bg-foreground text-background hover:bg-signal hover:border-signal hover:text-paper'
					: 'border-steel-lt text-steel hover:border-foreground hover:text-foreground',
				'disabled:border-steel-lt disabled:text-steel/40 disabled:cursor-not-allowed disabled:bg-transparent',
				className,
			)}
			{...props}
		/>
	)
}
