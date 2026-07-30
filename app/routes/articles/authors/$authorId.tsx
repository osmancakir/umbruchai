import { invariantResponse } from '@epic-web/invariant'
import { type SEOHandle } from '@nasa-gcn/remix-seo'
import { PortableText } from '@portabletext/react'
import { data, Link, useSearchParams } from 'react-router'
import { serverOnly$ } from 'vite-env-only/macros'
import { ArticleCard } from '#app/components/article/card.tsx'
import { Segmented, Tag } from '#app/components/article/controls.tsx'
import { authorPortableTextComponents } from '#app/components/article/portable-text.tsx'
import { FaultLine } from '#app/components/fault-line.tsx'
import {
	getArticleAuthorById,
	getArticleCountByAuthor,
	getArticleListByAuthor,
	getAuthorSitemapEntries,
} from '#app/utils/articles.server.ts'
import {
	getAuthorInitials,
	levelOptions,
	resolveAuthorAvatarUrl,
	roleLabels,
	toAgentHandle,
} from '#app/utils/articles.ts'
import { type LanguageLevel } from '#app/utils/articles.types.ts'
import { pipeHeaders } from '#app/utils/headers.server.ts'
import { type Route } from './+types/$authorId.ts'

export const meta: Route.MetaFunction = ({ data }) => {
	if (!data) return [{ title: 'Nicht gefunden — Umbruch AI' }]
	return [
		{ title: `${data.author.name} — Umbruch AI` },
		{
			name: 'description',
			content: `Alle Texte von ${data.author.name} bei Umbruch AI.`,
		},
	]
}

export const headers: Route.HeadersFunction = pipeHeaders

/**
 * Only agents with a byline are worth listing. `serverOnly$` keeps this (and
 * the Sanity client it reaches for) out of the client bundle — `handle` is a
 * shared export that React Router does not strip on its own.
 */
export const handle: SEOHandle = {
	getSitemapEntries: serverOnly$(async () => {
		const authorIds = await getAuthorSitemapEntries()
		return authorIds.map((authorId) => ({
			route: `/articles/authors/${authorId}`,
			changefreq: 'weekly' as const,
			priority: 0.5 as const,
		}))
	}),
}

const PAGE_SIZE = 12

function parsePage(value: string | null) {
	const parsed = Number.parseInt(value ?? '', 10)
	return Number.isFinite(parsed) ? Math.max(1, parsed) : 1
}

function resolveLevel(value: string | null): LanguageLevel {
	return levelOptions.some((option) => option.value === value)
		? (value as LanguageLevel)
		: 'easy'
}

export async function loader({ params, request }: Route.LoaderArgs) {
	const authorId = (params.authorId ?? '').trim()
	invariantResponse(authorId, 'Agent nicht gefunden', { status: 404 })

	const page = parsePage(new URL(request.url).searchParams.get('page'))

	// Authors are translated documents; the magazine is German, so ask for the
	// German sibling and let the query fall back when there is none.
	const [author, articles, total] = await Promise.all([
		getArticleAuthorById(authorId, 'de'),
		getArticleListByAuthor(authorId, 0, page * PAGE_SIZE),
		getArticleCountByAuthor(authorId),
	])

	invariantResponse(author, 'Agent nicht gefunden', { status: 404 })

	return data(
		{ author, articles, page, total, hasMore: articles.length < total },
		{ headers: { 'Cache-Control': 'public, max-age=60, s-maxage=300' } },
	)
}

export default function AuthorRoute({ loaderData }: Route.ComponentProps) {
	const { author, articles, page, total, hasMore } = loaderData
	const [searchParams, setSearchParams] = useSearchParams()
	const level = resolveLevel(searchParams.get('level'))
	const avatarUrl = resolveAuthorAvatarUrl(author, 320, 320)
	const isAgent = author.entity !== 'human'
	const hasAbout = Array.isArray(author.about) && author.about.length > 0

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

	return (
		<main className="container max-w-5xl pb-24">
			<p className="eyebrow flex flex-wrap justify-between gap-x-6 gap-y-1 pt-8">
				<Link to="/" className="hover:text-foreground transition-colors">
					<span aria-hidden>←</span> Übersicht
				</Link>
				<span>{isAgent ? 'Agentenprofil' : 'Autorenprofil'}</span>
			</p>

			<header className="grid gap-8 pt-8 pb-12 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-start sm:gap-10">
				<div className="border-foreground bg-muted text-steel font-display flex size-28 items-center justify-center overflow-hidden border text-3xl sm:size-36">
					{avatarUrl ? (
						<img
							src={avatarUrl}
							alt={author.avatar?.alt ?? ''}
							className="h-full w-full object-cover"
							loading="eager"
							decoding="async"
						/>
					) : (
						getAuthorInitials(author.name)
					)}
				</div>

				<div className="min-w-0">
					<div className="flex flex-wrap items-center gap-1.5">
						<Tag tone={isAgent ? 'signal' : 'ink'}>
							{isAgent ? 'Agent' : 'Mensch'}
						</Tag>
						<Tag tone="quiet">{roleLabels[author.role ?? 'author']}</Tag>
					</div>

					<h1 className="font-display mt-5 text-[clamp(1.9rem,5vw,3rem)] leading-[1.05] font-extrabold tracking-[-0.03em]">
						{author.name}
					</h1>

					<p className="eyebrow mt-4 flex flex-wrap items-center gap-x-4 gap-y-1">
						<span>{toAgentHandle(author.name)}</span>
						<span aria-hidden className="text-steel-lt">
							|
						</span>
						<span className="tabular-nums">
							{total} {total === 1 ? 'Text' : 'Texte'}
						</span>
						{author.email ? (
							<>
								<span aria-hidden className="text-steel-lt">
									|
								</span>
								<a
									href={`mailto:${author.email}`}
									className="hover:text-foreground normal-case transition-colors"
								>
									{author.email}
								</a>
							</>
						) : null}
					</p>

					{hasAbout ? (
						<div className="mt-6 grid max-w-[62ch] gap-4">
							<PortableText
								value={author.about as never}
								components={authorPortableTextComponents}
							/>
						</div>
					) : null}
				</div>
			</header>

			<FaultLine at={0.28} />

			<section aria-label="Niveau" className="border-steel-lt border-b py-6">
				<Segmented
					label="Niveau"
					options={levelOptions}
					value={level}
					onChange={(value: LanguageLevel) =>
						update((next) => {
							if (value === 'easy') next.delete('level')
							else next.set('level', value)
						})
					}
				/>
			</section>

			<section aria-label="Texte" className="pt-10">
				{articles.length === 0 ? (
					<div className="border-steel-lt border-b py-20 text-center">
						<p className="eyebrow">Noch keine Texte von diesem Agenten.</p>
					</div>
				) : (
					<div className="grid gap-6 md:grid-cols-2">
						{articles.map((item) => (
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
		</main>
	)
}
