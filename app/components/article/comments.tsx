import { useEffect, useMemo, useState } from 'react'
import { useFetcher } from 'react-router'
import { formatTimestamp } from '#app/utils/articles.ts'
import {
	type Article,
	type ArticleCommentStatus,
	type ArticleCommentWithAuthor,
	type LanguageLevel,
} from '#app/utils/articles.types.ts'
import { cn } from '#app/utils/misc.tsx'
import { QuizButton } from './quiz.tsx'

const CREATE_COMMENT_INTENT = 'create-comment'
const UPVOTE_COMMENT_INTENT = 'upvote-comment'
const COMMENT_MAX_LENGTH = 500
const RESOURCE_PATH = '/resources/article-comments'

type CommentsData = {
	level: LanguageLevel
	comments: ArticleCommentWithAuthor[]
}

type ActionData =
	| {
			ok: true
			intent: string
			level?: LanguageLevel
			commentId?: string
			message?: string
	  }
	| { ok: false; intent: string; level?: LanguageLevel; error: string }

function commentsPath(articleId: string, level: LanguageLevel) {
	return `${RESOURCE_PATH}?${new URLSearchParams({ articleId, level })}`
}

function resolveCommentary(
	commentary: Article['commentary'],
	level: LanguageLevel,
) {
	return (
		commentary?.[level] ??
		commentary?.easy ??
		commentary?.medium ??
		commentary?.advanced ??
		null
	)
}

/**
 * The discussion block: the editorial context an agent recorded for this piece
 * — what a person might worry about, what the other side says — and the
 * question it leaves open, with the readers' answers under it.
 *
 * Comments are loaded on the client rather than in the route loader so the
 * article itself stays cacheable and never waits on a no-store read.
 */
export function ArticleComments({
	article,
	level,
	className,
}: {
	article: Article
	level: LanguageLevel
	className?: string
}) {
	const commentary = resolveCommentary(article.commentary, level)
	const hasContext = Boolean(
		commentary?.humanConcern || commentary?.opposingView,
	)
	const hasDiscussion = Boolean(commentary?.prompt)

	const commentsFetcher = useFetcher<CommentsData>()
	const createFetcher = useFetcher<ActionData>()
	const upvoteFetcher = useFetcher<ActionData>()
	const loadComments = commentsFetcher.load

	const [body, setBody] = useState('')
	const [feedback, setFeedback] = useState<{
		tone: 'ok' | 'error'
		message: string
	} | null>(null)

	const path = useMemo(
		() => commentsPath(article._id, level),
		[article._id, level],
	)
	const comments = useMemo(
		() =>
			commentsFetcher.data?.level === level
				? commentsFetcher.data.comments
				: [],
		[commentsFetcher.data, level],
	)
	const isLoading =
		hasDiscussion &&
		(commentsFetcher.state !== 'idle' || commentsFetcher.data?.level !== level)
	const isSubmitting = createFetcher.state === 'submitting'
	const upvotingId =
		upvoteFetcher.state === 'submitting'
			? String(upvoteFetcher.formData?.get('commentId') ?? '')
			: null

	useEffect(() => {
		if (!hasDiscussion) return
		void loadComments(path)
	}, [hasDiscussion, loadComments, path])

	useEffect(() => {
		const result = createFetcher.data
		if (!result || result.intent !== CREATE_COMMENT_INTENT) return
		if (result.ok) {
			setFeedback({ tone: 'ok', message: result.message ?? 'Gespeichert.' })
			setBody('')
			void loadComments(path)
			return
		}
		setFeedback({ tone: 'error', message: result.error })
	}, [createFetcher.data, loadComments, path])

	useEffect(() => {
		const result = upvoteFetcher.data
		if (!result || result.intent !== UPVOTE_COMMENT_INTENT) return
		if (result.ok) {
			void loadComments(path)
			return
		}
		setFeedback({ tone: 'error', message: result.error })
	}, [loadComments, path, upvoteFetcher.data])

	// A level switch is a different question with different answers.
	useEffect(() => {
		setFeedback(null)
	}, [level])

	if (!commentary || (!hasContext && !hasDiscussion)) return null

	const remaining = COMMENT_MAX_LENGTH - body.length

	return (
		<section className={cn('', className)} aria-labelledby="discussion-heading">
			<div className="mb-6 flex items-baseline gap-4">
				<span className="eyebrow text-signal">//</span>
				<h2
					id="discussion-heading"
					className="font-display text-brand-xl tracking-[-0.02em]"
				>
					{hasContext ? 'Einordnung' : 'Die offene Frage'}
				</h2>
			</div>

			{hasContext ? (
				<div className="border-steel-lt grid border-t md:grid-cols-2">
					{commentary.humanConcern ? (
						<div className="border-steel-lt border-b py-5 md:border-r md:pr-8">
							<p className="eyebrow">Was Menschen daran beschäftigt</p>
							<p className="font-reading mt-2 max-w-[52ch] text-[1.05rem] leading-[1.6]">
								{commentary.humanConcern}
							</p>
						</div>
					) : null}
					{commentary.opposingView ? (
						<div className="border-steel-lt border-b py-5 md:pl-8">
							<p className="eyebrow">Der Einwand</p>
							<p className="font-reading mt-2 max-w-[52ch] text-[1.05rem] leading-[1.6]">
								{commentary.opposingView}
							</p>
						</div>
					) : null}
				</div>
			) : null}

			{hasDiscussion ? (
				<div className="mt-8">
					<div className="border-foreground border p-6 sm:p-8">
						<p className="eyebrow">Zum Weiterdenken</p>
						<p className="font-reading mt-3 max-w-[54ch] text-[clamp(1.1rem,2.2vw,1.35rem)] leading-[1.45]">
							{commentary.prompt}
						</p>

						<div className="border-steel-lt mt-8 border-t pt-6">
							<createFetcher.Form method="post" action={RESOURCE_PATH}>
								<input
									type="hidden"
									name="intent"
									value={CREATE_COMMENT_INTENT}
								/>
								<input type="hidden" name="articleId" value={article._id} />
								<input type="hidden" name="level" value={level} />
								<label htmlFor="comment-body" className="eyebrow">
									Deine Antwort
								</label>
								<textarea
									id="comment-body"
									name="body"
									rows={4}
									required
									maxLength={COMMENT_MAX_LENGTH}
									value={body}
									onChange={(event) => {
										setBody(event.currentTarget.value)
										setFeedback(null)
									}}
									placeholder="Kurz, konkret, in eigenen Worten."
									className="border-steel-lt bg-background text-foreground focus-visible:border-foreground font-reading placeholder:text-steel/70 mt-3 block w-full resize-y border px-4 py-3 text-[1.02rem] leading-[1.55] focus-visible:outline-none"
								/>
								<div className="mt-3 flex flex-wrap items-center justify-between gap-3">
									<p
										className={cn(
											'eyebrow tabular-nums',
											remaining < 40 && 'text-signal',
										)}
									>
										{remaining} Zeichen übrig
									</p>
									<QuizButton
										type="submit"
										disabled={isSubmitting || body.trim().length === 0}
									>
										{isSubmitting ? 'Wird gesendet' : 'Absenden'}
									</QuizButton>
								</div>
							</createFetcher.Form>

							{feedback ? (
								<p
									className={cn(
										'font-system mt-4 text-[0.8rem]',
										feedback.tone === 'error'
											? 'text-destructive'
											: 'text-steel',
									)}
									role="status"
								>
									{feedback.message}
								</p>
							) : null}

							<p className="eyebrow mt-4">
								Beiträge erscheinen erst nach redaktioneller Freigabe.
							</p>
						</div>
					</div>

					<div className="mt-8">
						<div className="flex flex-wrap items-baseline justify-between gap-3">
							<p className="eyebrow">Beiträge</p>
							<p className="eyebrow tabular-nums">
								{isLoading ? 'lädt' : comments.length}
							</p>
						</div>

						{isLoading ? (
							<p className="font-system text-steel mt-4 text-sm">
								Beiträge werden geladen.
							</p>
						) : comments.length === 0 ? (
							<p className="font-system text-steel mt-4 text-sm">
								Noch keine Beiträge zu diesem Niveau.
							</p>
						) : (
							<ul className="border-steel-lt mt-4 border-t">
								{comments.map((comment) => (
									<li
										key={comment._id}
										className="border-steel-lt border-b py-5"
									>
										<div className="flex flex-wrap items-center gap-x-3 gap-y-1">
											<span className="font-system text-[0.72rem] font-semibold tracking-[0.08em] uppercase">
												{comment.authorLabel}
											</span>
											<time className="eyebrow" dateTime={comment.createdAt}>
												{formatTimestamp(comment.createdAt)}
											</time>
											<ModerationStatus status={comment.status} />
										</div>
										<p className="font-reading mt-2 max-w-[62ch] text-[1.05rem] leading-[1.6]">
											{comment.body}
										</p>
										<div className="mt-3 flex flex-wrap items-center gap-2">
											<upvoteFetcher.Form method="post" action={RESOURCE_PATH}>
												<input
													type="hidden"
													name="intent"
													value={UPVOTE_COMMENT_INTENT}
												/>
												<input
													type="hidden"
													name="articleId"
													value={article._id}
												/>
												<input
													type="hidden"
													name="commentId"
													value={comment._id}
												/>
												<input
													type="hidden"
													name="level"
													value={comment.level}
												/>
												<button
													type="submit"
													disabled={upvotingId === comment._id}
													className="border-steel-lt font-system text-steel hover:border-foreground hover:text-foreground inline-flex min-h-11 items-center gap-2 border px-3 text-[0.6rem] tracking-[0.16em] uppercase transition-colors disabled:cursor-not-allowed disabled:opacity-50"
												>
													<span aria-hidden>↑</span>
													<span className="tabular-nums">
														{comment.upvotes}
													</span>
													<span className="sr-only">
														Diesem Beitrag zustimmen
													</span>
												</button>
											</upvoteFetcher.Form>
											<Score label="Trolling" value={comment.trollingScore} />
											<Score label="Mensch" value={comment.aiConfidenceScore} />
										</div>
									</li>
								))}
							</ul>
						)}
					</div>
				</div>
			) : null}
		</section>
	)
}

function ModerationStatus({ status }: { status: ArticleCommentStatus }) {
	if (status === 'approved') return null
	const isRejected = status === 'rejected'
	return (
		<span
			className={cn(
				'font-system inline-flex items-center gap-1.5 text-[0.6rem] tracking-[0.16em] uppercase',
				isRejected ? 'text-destructive' : 'text-steel',
			)}
		>
			<span
				aria-hidden
				className={cn(
					'inline-block size-[6px]',
					isRejected ? 'bg-destructive' : 'bg-signal',
				)}
			/>
			{isRejected ? 'Abgelehnt' : 'In Prüfung'}
		</span>
	)
}

/**
 * The migrated comments carry machine scores. Show them where they exist —
 * hiding a number the system already holds would be the wrong instinct for
 * this brand — and show nothing where they do not.
 */
function Score({ label, value }: { label: string; value: number | undefined }) {
	if (typeof value !== 'number' || Number.isNaN(value)) return null
	const percent = Math.round(Math.min(1, Math.max(0, value)) * 100)
	return (
		<span className="border-steel-lt font-system text-steel inline-flex items-center gap-1.5 border px-2.5 py-1 text-[0.6rem] tracking-[0.16em] uppercase">
			{label}
			<span className="text-foreground tabular-nums">{percent}%</span>
		</span>
	)
}
