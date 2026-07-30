import { Fragment, useEffect, useMemo, useState } from 'react'
import { type VocabularyItem } from '#app/utils/articles.types.ts'
import { cn } from '#app/utils/misc.tsx'
import { FaultProgress } from '../fault-line.tsx'
import { QuizButton } from './quiz.tsx'

/** Fill-in-the-blank questions mark their gap with five underscores. */
function splitQuestion(question: string) {
	return question.split('_____')
}

/**
 * The vocabulary trainer. Two passes over the same set: first read each term
 * with its meaning and example, then answer for it — and unlike the
 * comprehension quiz, an answer here is final, because the rationale that
 * follows is the actual lesson.
 */
export function VocabularyQuiz({
	vocabulary,
	className,
}: {
	vocabulary: VocabularyItem[]
	className?: string
}) {
	const [learningIndex, setLearningIndex] = useState(0)
	const [isLearningDone, setIsLearningDone] = useState(false)
	const [isResultVisible, setIsResultVisible] = useState(false)
	const [quizIndex, setQuizIndex] = useState(0)
	const [answers, setAnswers] = useState<Record<string, string>>({})
	const [expandedHints, setExpandedHints] = useState<Record<string, boolean>>(
		{},
	)

	const identity = useMemo(
		() => vocabulary.map((item) => item._key).join('|'),
		[vocabulary],
	)

	const statuses = useMemo(
		() =>
			vocabulary.map((item) => {
				const selected = answers[item._key]
				if (!selected) return 'unanswered' as const
				const correctKey = item.options.find((o) => o.isCorrect)?._key
				return selected === correctKey
					? ('correct' as const)
					: ('incorrect' as const)
			}),
		[answers, vocabulary],
	)

	const answeredCount = statuses.filter((s) => s !== 'unanswered').length
	const correctCount = statuses.filter((s) => s === 'correct').length
	const incorrectCount = statuses.filter((s) => s === 'incorrect').length
	const isQuizCompleted =
		vocabulary.length > 0 && answeredCount === vocabulary.length

	const learningItem = vocabulary[learningIndex] ?? null
	const isOnLastLearningItem =
		vocabulary.length > 0 && learningIndex === vocabulary.length - 1
	const current = vocabulary[quizIndex] ?? null
	const currentAnswerKey = current ? answers[current._key] : undefined
	const isCurrentAnswered = Boolean(currentAnswerKey)
	const questionParts = useMemo(
		() => (current ? splitQuestion(current.question) : []),
		[current],
	)
	const isHintExpanded = current ? Boolean(expandedHints[current._key]) : false

	useEffect(() => {
		setLearningIndex(0)
		setIsLearningDone(false)
		setIsResultVisible(false)
		setQuizIndex(0)
		setAnswers({})
		setExpandedHints({})
	}, [identity])

	function answer(itemKey: string, optionKey: string) {
		setAnswers((previous) =>
			previous[itemKey] ? previous : { ...previous, [itemKey]: optionKey },
		)
	}

	function restartAll() {
		setLearningIndex(0)
		setIsLearningDone(false)
		setIsResultVisible(false)
		setQuizIndex(0)
		setAnswers({})
		setExpandedHints({})
	}

	if (vocabulary.length === 0) return null

	const phaseLabel = !isLearningDone
		? `Wort ${learningIndex + 1} von ${vocabulary.length}`
		: isResultVisible
			? 'Ergebnis'
			: `Frage ${quizIndex + 1} von ${vocabulary.length}`

	return (
		<section className={cn('', className)} aria-labelledby="vocabulary-heading">
			<div className="mb-6 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
				<h2
					id="vocabulary-heading"
					className="font-display text-brand-xl tracking-[-0.02em]"
				>
					Wortschatz
				</h2>
				<p className="eyebrow">{phaseLabel}</p>
			</div>

			<div className="border-foreground border">
				{!isLearningDone ? (
					<div className="flex flex-col">
						<div className="border-steel-lt flex items-center gap-4 border-b px-5 py-3 sm:px-8">
							<FaultProgress
								value={(learningIndex + 1) / vocabulary.length}
								label={`Wort ${learningIndex + 1} von ${vocabulary.length}`}
								className="max-w-48 flex-1"
							/>
							<p className="eyebrow ml-auto">Lernen</p>
						</div>

						{learningItem ? (
							<div className="grid gap-6 px-5 py-6 sm:px-8 sm:py-8">
								<div>
									<p className="eyebrow">Wort</p>
									<div className="mt-2 flex flex-wrap items-baseline gap-3">
										<span className="font-display text-[clamp(1.5rem,4vw,2.1rem)] leading-[1.1] font-extrabold tracking-[-0.03em]">
											{learningItem.term}
										</span>
										{learningItem.type ? (
											<span className="border-steel-lt font-system text-steel border px-2 py-0.5 text-[0.6rem] tracking-[0.16em] uppercase">
												{learningItem.type}
											</span>
										) : null}
									</div>
								</div>
								<div className="border-steel-lt border-t pt-5">
									<p className="eyebrow">Bedeutung</p>
									<p className="font-reading mt-2 text-[1.05rem] leading-[1.6]">
										{learningItem.definition || 'Keine Bedeutung hinterlegt.'}
									</p>
								</div>
								<div className="border-steel-lt border-t pt-5">
									<p className="eyebrow">Beispiel</p>
									<p className="font-reading text-steel mt-2 text-[1.05rem] leading-[1.6] italic">
										{learningItem.example || 'Kein Beispielsatz hinterlegt.'}
									</p>
								</div>
							</div>
						) : null}

						<div className="border-steel-lt flex items-center justify-between gap-3 border-t px-5 py-4 sm:px-8">
							{learningIndex > 0 ? (
								<QuizButton
									variant="quiet"
									onClick={() => setLearningIndex((i) => Math.max(0, i - 1))}
								>
									Zurück
								</QuizButton>
							) : (
								<span aria-hidden />
							)}
							<QuizButton
								onClick={() => {
									if (isOnLastLearningItem) {
										setIsLearningDone(true)
										setQuizIndex(0)
										return
									}
									setLearningIndex((i) =>
										Math.min(vocabulary.length - 1, i + 1),
									)
								}}
							>
								{isOnLastLearningItem ? 'Quiz starten' : 'Weiter'}
							</QuizButton>
						</div>
					</div>
				) : isResultVisible ? (
					<div className="p-6 sm:p-8">
						<p className="eyebrow">Auswertung</p>
						<p className="font-display mt-4 text-[clamp(1.6rem,4vw,2.4rem)] leading-[1.1] font-extrabold tracking-[-0.03em] tabular-nums">
							{correctCount} von {vocabulary.length} richtig
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
						<div className="mt-6 flex flex-wrap items-center justify-end gap-3">
							<QuizButton variant="quiet" onClick={restartAll}>
								Noch einmal lernen
							</QuizButton>
							<QuizButton
								onClick={() => {
									setIsResultVisible(false)
									setQuizIndex(0)
									setAnswers({})
									setExpandedHints({})
								}}
							>
								Quiz wiederholen
							</QuizButton>
						</div>
					</div>
				) : (
					<div className="flex flex-col">
						<div className="border-steel-lt flex items-center gap-4 border-b px-5 py-3 sm:px-8">
							<FaultProgress
								value={answeredCount / vocabulary.length}
								label={`${answeredCount} von ${vocabulary.length} Fragen beantwortet`}
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

						{current ? (
							<div className="px-5 py-6 sm:px-8 sm:py-8">
								<div className="flex items-start gap-4">
									<span className="font-display text-signal pt-0.5 text-lg font-extrabold tabular-nums">
										{String(quizIndex + 1).padStart(2, '0')}
									</span>
									<p className="font-reading min-w-0 flex-1 text-[1.2rem] leading-[1.5]">
										{questionParts.length > 1
											? questionParts.map((part, partIndex) => (
													<Fragment key={`${current._key}-part-${partIndex}`}>
														{part}
														{partIndex < questionParts.length - 1 ? (
															<span
																aria-hidden
																className="border-signal mx-1 inline-block w-16 border-b-2 align-baseline"
															/>
														) : null}
													</Fragment>
												))
											: current.question}
									</p>
								</div>

								{current.hint ? (
									<div className="mt-5 grid gap-2">
										<button
											type="button"
											aria-expanded={isHintExpanded}
											onClick={() =>
												setExpandedHints((previous) => ({
													...previous,
													[current._key]: !previous[current._key],
												}))
											}
											className="eyebrow hover:text-foreground w-fit transition-colors"
										>
											{isHintExpanded ? '− Hinweis' : '+ Hinweis'}
										</button>
										{isHintExpanded ? (
											<p className="border-steel-lt font-reading text-steel border-l-2 pl-4 text-[0.98rem] leading-[1.55]">
												{current.hint}
											</p>
										) : null}
									</div>
								) : null}

								<div className="mt-6 grid gap-2">
									{current.options.map((option, optionIndex) => {
										const isSelected = currentAnswerKey === option._key
										const isCorrect = Boolean(option.isCorrect)
										// Once answered, the correct option reveals itself even if
										// the reader picked something else — that is the lesson.
										const isRevealedCorrect = isCurrentAnswered && isCorrect
										return (
											<div key={option._key} className="grid gap-1.5">
												<button
													type="button"
													disabled={isCurrentAnswered}
													onClick={() => answer(current._key, option._key)}
													className={cn(
														'flex items-center gap-3 border px-4 py-3 text-left transition-colors',
														!isCurrentAnswered
															? 'border-steel-lt hover:border-foreground'
															: isRevealedCorrect
																? 'border-foreground bg-foreground text-background'
																: isSelected
																	? 'border-signal bg-signal-dim text-ink'
																	: 'border-steel-lt text-steel',
													)}
												>
													<span className="font-system w-4 shrink-0 text-[0.7rem] font-semibold">
														{String.fromCharCode(65 + optionIndex)}
													</span>
													<span className="font-reading min-w-0 flex-1 text-[1.02rem] leading-[1.45]">
														{option.label}
													</span>
													{isCurrentAnswered && (isSelected || isCorrect) ? (
														<span
															className="font-system shrink-0 text-sm"
															aria-label={isCorrect ? 'Richtig' : 'Gewählt'}
														>
															{isCorrect ? '✓' : '✕'}
														</span>
													) : null}
												</button>
												{isCurrentAnswered && (isSelected || isCorrect) ? (
													<p className="font-reading text-steel pl-7 text-[0.95rem] leading-[1.5]">
														{option.rationale}
													</p>
												) : null}
											</div>
										)
									})}
								</div>
							</div>
						) : null}

						<div className="border-steel-lt flex items-center justify-between gap-3 border-t px-5 py-4 sm:px-8">
							{quizIndex > 0 ? (
								<QuizButton
									variant="quiet"
									onClick={() => setQuizIndex((i) => Math.max(0, i - 1))}
								>
									Zurück
								</QuizButton>
							) : (
								<span aria-hidden />
							)}
							{quizIndex < vocabulary.length - 1 ? (
								<QuizButton
									onClick={() =>
										setQuizIndex((i) => Math.min(vocabulary.length - 1, i + 1))
									}
								>
									Weiter
								</QuizButton>
							) : (
								<QuizButton
									disabled={!isQuizCompleted}
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
