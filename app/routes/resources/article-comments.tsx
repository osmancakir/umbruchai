import { data } from 'react-router'
import { z } from 'zod'
import {
	articleExists,
	createArticleComment,
	getArticleCommentCountByLevel,
	getArticleComments,
	upvoteArticleComment,
} from '#app/utils/articles.server.ts'
import {
	type ArticleCommentWithAuthor,
	type LanguageLevel,
} from '#app/utils/articles.types.ts'
import {
	createReaderId,
	getReaderId,
	serializeReaderId,
} from '#app/utils/reader.server.ts'
import { type Route } from './+types/article-comments.ts'

const CREATE_COMMENT_INTENT = 'create-comment'
const UPVOTE_COMMENT_INTENT = 'upvote-comment'
const COMMENT_MAX_LENGTH = 500
/** Cheap abuse ceilings; the real gate is that nothing publishes unreviewed. */
const MAX_COMMENTS_PER_LEVEL = 50

const NO_STORE_HEADERS = { 'Cache-Control': 'no-store' }

const LevelSchema = z.enum(['easy', 'medium', 'advanced'])

const CreateCommentSchema = z.object({
	intent: z.literal(CREATE_COMMENT_INTENT),
	articleId: z.string().trim().min(1, 'Ungültiger Artikel.'),
	level: LevelSchema,
	body: z
		.string()
		.trim()
		.min(1, 'Bitte schreibe einen Beitrag.')
		.max(COMMENT_MAX_LENGTH, `Maximal ${COMMENT_MAX_LENGTH} Zeichen.`),
})

const UpvoteCommentSchema = z.object({
	intent: z.literal(UPVOTE_COMMENT_INTENT),
	articleId: z.string().trim().min(1, 'Ungültiger Artikel.'),
	level: LevelSchema,
	commentId: z.string().trim().min(1, 'Ungültiger Beitrag.'),
})

function resolveLevel(value: string | null): LanguageLevel {
	const parsed = LevelSchema.safeParse(value)
	return parsed.success ? parsed.data : 'easy'
}

/**
 * With no accounts there is no display name to show. A reader sees "Du" on
 * their own contributions and "Leser:in" on everyone else's — accurate, and it
 * promises nothing the system cannot keep.
 */
function resolveAuthorLabel(
	commentUserId: string | undefined,
	readerId: string | null,
) {
	if (commentUserId && readerId && commentUserId === readerId) return 'Du'
	return commentUserId ? 'Leser:in' : 'Anonym'
}

export async function loader({ request }: Route.LoaderArgs) {
	const url = new URL(request.url)
	const articleId = url.searchParams.get('articleId')
	const level = resolveLevel(url.searchParams.get('level'))

	if (!articleId) {
		return data(
			{ level, comments: [] as ArticleCommentWithAuthor[] },
			{ status: 400, headers: NO_STORE_HEADERS },
		)
	}

	const readerId = getReaderId(request)
	const comments = await getArticleComments(articleId, readerId, level)

	return data(
		{
			level,
			comments: comments.map((comment) => ({
				...comment,
				isOwnComment: Boolean(readerId && comment.userId === readerId),
				authorLabel: resolveAuthorLabel(comment.userId, readerId),
			})),
		},
		{ headers: NO_STORE_HEADERS },
	)
}

export async function action({ request }: Route.ActionArgs) {
	const formData = await request.formData()
	const intent = formData.get('intent')

	if (intent === UPVOTE_COMMENT_INTENT) {
		const parsed = UpvoteCommentSchema.safeParse(Object.fromEntries(formData))
		if (!parsed.success) {
			return data(
				{
					ok: false as const,
					intent: UPVOTE_COMMENT_INTENT,
					error: 'Diese Zustimmung konnte nicht gespeichert werden.',
				},
				{ status: 400, headers: NO_STORE_HEADERS },
			)
		}

		try {
			const result = await upvoteArticleComment({
				commentId: parsed.data.commentId,
				articleId: parsed.data.articleId,
			})
			if (!result) {
				return data(
					{
						ok: false as const,
						intent: UPVOTE_COMMENT_INTENT,
						error: 'Dieser Beitrag existiert nicht mehr.',
					},
					{ status: 404, headers: NO_STORE_HEADERS },
				)
			}
			return data(
				{
					ok: true as const,
					intent: UPVOTE_COMMENT_INTENT,
					level: parsed.data.level,
					upvotedCommentId: parsed.data.commentId,
				},
				{ headers: NO_STORE_HEADERS },
			)
		} catch (error) {
			console.error('[comments] upvote failed', error)
			return data(
				{
					ok: false as const,
					intent: UPVOTE_COMMENT_INTENT,
					error: 'Zustimmen ist gerade nicht möglich.',
				},
				{ status: 500, headers: NO_STORE_HEADERS },
			)
		}
	}

	const parsed = CreateCommentSchema.safeParse(Object.fromEntries(formData))
	if (!parsed.success) {
		return data(
			{
				ok: false as const,
				intent: CREATE_COMMENT_INTENT,
				error:
					parsed.error.issues[0]?.message ??
					'Der Beitrag konnte nicht gespeichert werden.',
			},
			{ status: 400, headers: NO_STORE_HEADERS },
		)
	}

	const { articleId, level, body } = parsed.data

	if (!(await articleExists(articleId))) {
		return data(
			{
				ok: false as const,
				intent: CREATE_COMMENT_INTENT,
				level,
				error: 'Dieser Artikel existiert nicht.',
			},
			{ status: 404, headers: NO_STORE_HEADERS },
		)
	}

	if (
		(await getArticleCommentCountByLevel(articleId, level)) >=
		MAX_COMMENTS_PER_LEVEL
	) {
		return data(
			{
				ok: false as const,
				intent: CREATE_COMMENT_INTENT,
				level,
				error: 'Zu diesem Niveau sind genug Beiträge eingegangen.',
			},
			{ status: 429, headers: NO_STORE_HEADERS },
		)
	}

	// First-time commenters get their reader id here, and it goes back with the
	// same response that confirms the comment.
	const existingReaderId = getReaderId(request)
	const readerId = existingReaderId ?? createReaderId()
	const headers: Record<string, string> = { ...NO_STORE_HEADERS }
	if (!existingReaderId) headers['Set-Cookie'] = serializeReaderId(readerId)

	try {
		const created = await createArticleComment({
			articleId,
			level,
			body,
			userId: readerId,
		})
		return data(
			{
				ok: true as const,
				intent: CREATE_COMMENT_INTENT,
				level,
				commentId: created._id,
				message: 'Dein Beitrag ist eingegangen und wartet auf Freigabe.',
			},
			{ headers },
		)
	} catch (error) {
		console.error('[comments] create failed', error)
		return data(
			{
				ok: false as const,
				intent: CREATE_COMMENT_INTENT,
				level,
				error: 'Beiträge können gerade nicht entgegengenommen werden.',
			},
			{ status: 500, headers: NO_STORE_HEADERS },
		)
	}
}
