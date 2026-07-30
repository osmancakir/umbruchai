import { Link } from 'react-router'
import {
	getAuthorInitials,
	resolveAuthorAvatarUrl,
	roleLabels,
} from '#app/utils/articles.ts'
import { type ArticleAuthor } from '#app/utils/articles.types.ts'
import { cn } from '#app/utils/misc.tsx'

/**
 * The agent byline (§06). Every text names the agent that wrote it — the
 * Signal square in front of the name is the "agent present" mark, and it is one
 * of the three sanctioned uses of the colour.
 */
export function AgentChip({
	author,
	linked = true,
	className,
}: {
	author: ArticleAuthor
	linked?: boolean
	className?: string
}) {
	const isAgent = author.entity !== 'human'
	const body = (
		<>
			<span
				aria-hidden="true"
				className={cn(
					'inline-block size-[7px] shrink-0',
					isAgent ? 'bg-signal' : 'bg-steel',
				)}
			/>
			<AuthorAvatar author={author} />
			<span className="truncate">{author.name}</span>
			<span className="text-steel">
				· {isAgent ? 'Agent' : (roleLabels[author.role ?? 'author'] ?? 'Autor')}
			</span>
		</>
	)

	const classes = cn(
		'border-steel-lt font-system inline-flex max-w-full items-center gap-2 border px-2 py-1 text-[0.62rem] tracking-[0.08em] uppercase',
		linked && 'hover:border-foreground hover:text-foreground transition-colors',
		className,
	)

	if (!linked) return <span className={classes}>{body}</span>

	return (
		<Link
			to={`/articles/authors/${encodeURIComponent(author._id)}`}
			className={classes}
		>
			{body}
		</Link>
	)
}

export function AuthorAvatar({
	author,
	className,
}: {
	author: Pick<ArticleAuthor, 'name' | 'avatar'>
	className?: string
}) {
	const avatarUrl = resolveAuthorAvatarUrl(author, 48, 48)
	return (
		<span
			aria-hidden="true"
			className={cn(
				'bg-muted text-steel font-display inline-flex size-4 shrink-0 items-center justify-center overflow-hidden text-[0.45rem] leading-none',
				className,
			)}
		>
			{avatarUrl ? (
				<img
					src={avatarUrl}
					alt=""
					className="h-full w-full object-cover"
					loading="lazy"
					decoding="async"
				/>
			) : (
				getAuthorInitials(author.name)
			)}
		</span>
	)
}

export function AgentByline({
	authors,
	linked = true,
	className,
}: {
	authors: ArticleAuthor[] | undefined
	linked?: boolean
	className?: string
}) {
	if (!authors?.length) return null
	return (
		<div className={cn('flex flex-wrap items-center gap-1.5', className)}>
			{authors.map((author) => (
				<AgentChip key={author._id} author={author} linked={linked} />
			))}
		</div>
	)
}
