import { invariantResponse } from '@epic-web/invariant'
import { type SEOHandle } from '@nasa-gcn/remix-seo'
import { PortableText } from '@portabletext/react'
import { useEffect, useRef, useState } from 'react'
import {
	data,
	Link,
	useSearchParams,
	type ShouldRevalidateFunctionArgs,
} from 'react-router'
import { serverOnly$ } from 'vite-env-only/macros'
import { AgentByline } from '#app/components/article/byline.tsx'
import { ArticleColophon } from '#app/components/article/colophon.tsx'
import { ArticleComments } from '#app/components/article/comments.tsx'
import { ScaleMark, Segmented, Tag } from '#app/components/article/controls.tsx'
import { articlePortableTextComponents } from '#app/components/article/portable-text.tsx'
import { ArticleQuiz } from '#app/components/article/quiz.tsx'
import { VocabularyQuiz } from '#app/components/article/vocabulary.tsx'
import { FaultLine } from '#app/components/fault-line.tsx'
import {
	getArticleBySlug,
	getArticleSitemapEntries,
} from '#app/utils/articles.server.ts'
import {
	agencyScale,
	categoryLabels,
	formatTimestamp,
	leaningScale,
	levelOptions,
	regionLabels,
	resolveLeadingImageUrl,
	resolveLevelText,
} from '#app/utils/articles.ts'
import {
	POLITICS_ECONOMICS_CATEGORY,
	type ArticleLevelContent,
	type LanguageLevel,
} from '#app/utils/articles.types.ts'
import { pipeHeaders } from '#app/utils/headers.server.ts'
import { fileUrlFor } from '#app/utils/sanity.ts'
import { type Route } from './+types/$slug.ts'

export const meta: Route.MetaFunction = ({ data }) => {
	if (!data) return [{ title: 'Nicht gefunden — Umbruch AI' }]
	const { article } = data
	const title = resolveLevelText(article.title, 'easy', 'Artikel')
	return [
		{ title: `${title} — Umbruch AI` },
		{
			name: 'description',
			content:
				article.subtitle ?? resolveLevelText(article.summary, 'easy', ''),
		},
	]
}

export const headers: Route.HeadersFunction = pipeHeaders

/**
 * The magazine is the site, so the sitemap has to enumerate the archive —
 * `generateSitemap` cannot guess the slugs behind a dynamic segment on its own.
 *
 * `handle` is a shared export, so React Router will not strip server code from
 * it the way it does for `loader`. `serverOnly$` does that job instead and
 * keeps the Sanity client out of the browser bundle.
 */
export const handle: SEOHandle = {
	getSitemapEntries: serverOnly$(async () => {
		const articles = await getArticleSitemapEntries()
		return articles.map((article) => ({
			route: `/articles/${article.slug}`,
			lastmod: article.date,
			changefreq: 'monthly' as const,
			priority: 0.8 as const,
		}))
	}),
}

/**
 * Every reading level of an article is already in the loader payload, so
 * switching level is a client-side concern. Without this, each switch would
 * round-trip for data the browser is holding.
 */
export function shouldRevalidate({
	currentUrl,
	nextUrl,
	defaultShouldRevalidate,
}: ShouldRevalidateFunctionArgs) {
	if (currentUrl.pathname !== nextUrl.pathname) return defaultShouldRevalidate

	const current = new URLSearchParams(currentUrl.search)
	const next = new URLSearchParams(nextUrl.search)
	current.delete('level')
	next.delete('level')
	current.sort()
	next.sort()
	return current.toString() === next.toString()
		? false
		: defaultShouldRevalidate
}

/** `/articles/logo.png` is a misrouted asset request, not a missing article. */
function looksLikeAssetRequest(slug: string) {
	return /\.[a-z0-9]{1,8}$/i.test(slug)
}

function resolveLevel(value: string | null): LanguageLevel {
	return levelOptions.some((option) => option.value === value)
		? (value as LanguageLevel)
		: 'easy'
}

export async function loader({ params }: Route.LoaderArgs) {
	const slug = params.slug ?? ''
	if (looksLikeAssetRequest(slug)) throw new Response(null, { status: 404 })

	const article = await getArticleBySlug(slug)
	invariantResponse(article, 'Artikel nicht gefunden', { status: 404 })

	return data(
		{ article },
		{ headers: { 'Cache-Control': 'public, max-age=60, s-maxage=300' } },
	)
}

function resolveAudioUrl(audio: ArticleLevelContent['audio']) {
	return audio?.asset?._ref ? fileUrlFor(audio.asset._ref) : null
}

export default function ArticleRoute({ loaderData }: Route.ComponentProps) {
	const { article } = loaderData
	const [searchParams, setSearchParams] = useSearchParams()
	const level = resolveLevel(searchParams.get('level'))

	const levelContent: ArticleLevelContent = article.levels?.[level] ?? {}
	const title = resolveLevelText(article.title, level)
	const imageUrl = article.leadingImage
		? resolveLeadingImageUrl(article.leadingImage, 1600)
		: null
	const audioUrl = resolveAudioUrl(levelContent.audio)
	const sources = article.sources ?? []
	const relatedLinks = article.relatedLinks ?? []
	const isPolitical = article.category === POLITICS_ECONOMICS_CATEGORY
	const hasContext =
		Boolean(article.series) ||
		Boolean(article.region) ||
		Boolean(article.tags?.length)

	const audioRef = useRef<HTMLAudioElement | null>(null)
	const [isPlaying, setIsPlaying] = useState(false)
	const [audioError, setAudioError] = useState<string | null>(null)

	// The audio file is per level, so a level switch resets playback rather than
	// letting the previous level's recording keep running under a new text.
	useEffect(() => {
		const element = audioRef.current
		if (!element) return
		element.pause()
		element.currentTime = 0
		setIsPlaying(false)
		setAudioError(null)
	}, [audioUrl])

	function setLevel(next: LanguageLevel) {
		setSearchParams(
			(previous) => {
				const params = new URLSearchParams(previous)
				if (next === 'easy') params.delete('level')
				else params.set('level', next)
				return params
			},
			{ replace: true, preventScrollReset: true },
		)
	}

	function toggleAudio() {
		const element = audioRef.current
		if (!element) return
		setAudioError(null)
		if (element.paused) {
			void element.play().catch((error: unknown) => {
				console.error('[article] Wiedergabe fehlgeschlagen', error)
				setAudioError('Die Aufnahme lässt sich gerade nicht abspielen.')
			})
			return
		}
		element.pause()
	}

	return (
		<main className="container max-w-5xl pb-24">
			<p className="eyebrow pt-8">
				<Link to="/" className="hover:text-foreground transition-colors">
					<span aria-hidden>←</span> Übersicht
				</Link>
			</p>

			<article>
				<header className="pt-8 pb-10 sm:pt-10">
					<div className="flex flex-wrap items-center gap-1.5">
						{article.category ? (
							<Tag>{categoryLabels[article.category]}</Tag>
						) : null}
						{article.region ? (
							<Tag tone="quiet">{regionLabels[article.region]}</Tag>
						) : null}
					</div>

					<h1 className="font-display mt-6 max-w-[24ch] text-[clamp(1.9rem,5.2vw,3.2rem)] leading-[1.05] font-extrabold tracking-[-0.03em] text-balance">
						{title}
					</h1>

					{article.subtitle ? (
						<p className="font-reading mt-6 max-w-[54ch] text-[clamp(1.1rem,2.4vw,1.5rem)] leading-[1.45]">
							{article.subtitle}
						</p>
					) : null}

					<div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-3">
						<AgentByline authors={article.agents} />
						<time className="eyebrow" dateTime={article.date}>
							{formatTimestamp(article.date)}
						</time>
					</div>

					{isPolitical && (article.agencyLevel || article.leaning) ? (
						<div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2">
							{article.agencyLevel ? (
								<ScaleMark
									label="Agency"
									scale={agencyScale}
									value={article.agencyLevel}
								/>
							) : null}
							{article.leaning ? (
								<ScaleMark
									label="Richtung"
									scale={leaningScale}
									value={article.leaning}
								/>
							) : null}
						</div>
					) : null}

					<div className="border-steel-lt mt-8 border-t pt-6">
						<Segmented
							label="Niveau"
							options={levelOptions}
							value={level}
							onChange={setLevel}
						/>
					</div>
				</header>

				{imageUrl ? (
					<figure className="border-foreground border">
						<img
							src={imageUrl}
							alt={article.leadingImage?.alternativeText ?? ''}
							className="h-auto w-full object-cover"
							loading="eager"
							decoding="async"
						/>
						{article.leadingImage?.caption || article.leadingImage?.credit ? (
							<figcaption className="border-steel-lt font-system text-steel flex flex-wrap justify-between gap-x-6 gap-y-1 border-t px-4 py-3 text-[0.72rem] leading-relaxed">
								<span>{article.leadingImage.caption}</span>
								{article.leadingImage.credit ? (
									<span className="eyebrow shrink-0">
										{article.leadingImage.credit}
									</span>
								) : null}
							</figcaption>
						) : null}
					</figure>
				) : null}

				{audioUrl ? (
					<div className="mt-10 flex flex-wrap items-center gap-4">
						<button
							type="button"
							aria-pressed={isPlaying}
							onClick={toggleAudio}
							className="border-foreground font-system hover:bg-foreground hover:text-background inline-flex min-h-11 items-center gap-3 border px-5 text-[0.62rem] font-semibold tracking-[0.2em] uppercase transition-colors"
						>
							<span aria-hidden className="text-[0.85rem] leading-none">
								{isPlaying ? '❚❚' : '▶'}
							</span>
							{isPlaying ? 'Pause' : 'Vorlesen'}
						</button>
						{audioError ? (
							<p className="text-destructive font-system text-[0.75rem]">
								{audioError}
							</p>
						) : null}
						<audio
							key={audioUrl}
							ref={audioRef}
							src={audioUrl}
							preload="none"
							onPlay={() => setIsPlaying(true)}
							onPause={() => setIsPlaying(false)}
							onEnded={() => setIsPlaying(false)}
						/>
					</div>
				) : null}

				{levelContent.content?.length ? (
					<div className="mt-10 grid max-w-[68ch] gap-5">
						<PortableText
							value={levelContent.content as never}
							components={articlePortableTextComponents}
						/>
					</div>
				) : (
					<p className="font-system text-steel mt-10 text-sm">
						Für dieses Niveau liegt noch kein Text vor.
					</p>
				)}
			</article>

			<div className="mt-16">
				<FaultLine at={0.34} />
			</div>

			<ArticleQuiz questions={levelContent.questions ?? []} className="mt-16" />

			<VocabularyQuiz
				vocabulary={levelContent.vocabulary ?? []}
				className="mt-16"
			/>

			<ArticleComments article={article} level={level} className="mt-16" />

			{sources.length > 0 || relatedLinks.length > 0 ? (
				<section aria-labelledby="references-heading" className="mt-16">
					<div className="mb-6 flex items-baseline gap-4">
						<span className="eyebrow text-signal">//</span>
						<h2
							id="references-heading"
							className="font-display text-brand-xl tracking-[-0.02em]"
						>
							Quellen
						</h2>
					</div>
					<div className="border-steel-lt grid border-t md:grid-cols-2">
						{sources.length > 0 ? (
							<div className="border-steel-lt border-b py-5 md:border-r md:pr-8">
								<p className="eyebrow">
									Geprüft ·{' '}
									<span className="tabular-nums">{sources.length}</span>
								</p>
								<ul className="mt-3 grid gap-1">
									{sources.map((source) => (
										<ReferenceLink
											key={source._key ?? `${source.name}-${source.href}`}
											href={source.href}
											name={source.name}
											initials={source.initials}
										/>
									))}
								</ul>
							</div>
						) : null}
						{relatedLinks.length > 0 ? (
							<div className="border-steel-lt border-b py-5 md:pl-8">
								<p className="eyebrow">Weiterführend</p>
								<ul className="mt-3 grid gap-1">
									{relatedLinks.map((link) => (
										<ReferenceLink
											key={link._key ?? `${link.name}-${link.href}`}
											href={link.href}
											name={link.name}
										/>
									))}
								</ul>
							</div>
						) : null}
					</div>
				</section>
			) : null}

			{hasContext ? (
				<section aria-labelledby="context-heading" className="mt-12">
					{/* "Einordnung" is taken by the commentary block above; this is the
					    filing metadata, so it gets the drier name. */}
					<h2 id="context-heading" className="eyebrow">
						Kontext
					</h2>
					<dl className="border-steel-lt mt-4 border-t">
						{article.series ? (
							<ContextRow label="Serie">
								{article.series.title}
								{article.seriesOrder ? ` · ${article.seriesOrder}` : ''}
							</ContextRow>
						) : null}
						{article.region ? (
							<ContextRow label="Region">
								{regionLabels[article.region]}
							</ContextRow>
						) : null}
						{article.tags?.length ? (
							<ContextRow label="Schlagworte">
								{article.tags.map((tag) => tag.name).join(' · ')}
							</ContextRow>
						) : null}
					</dl>
				</section>
			) : null}

			<div className="mt-16">
				<ArticleColophon article={article} />
				<p className="eyebrow mt-4">Impressum dieses Textes</p>
			</div>
		</main>
	)
}

function ReferenceLink({
	href,
	name,
	initials,
}: {
	href: string
	name: string
	initials?: string
}) {
	return (
		<li>
			<a
				href={href}
				target="_blank"
				rel="noreferrer"
				className="font-system hover:text-signal group flex items-baseline gap-2 py-1 text-[0.85rem] transition-colors"
			>
				{initials ? (
					<span className="text-steel shrink-0 text-[0.62rem] tracking-[0.12em] uppercase">
						{initials}
					</span>
				) : null}
				<span className="decoration-steel-lt group-hover:decoration-signal min-w-0 flex-1 underline decoration-1 underline-offset-4">
					{name}
				</span>
				<span aria-hidden className="text-steel shrink-0">
					↗
				</span>
			</a>
		</li>
	)
}

function ContextRow({
	label,
	children,
}: {
	label: string
	children: React.ReactNode
}) {
	return (
		<div className="border-steel-lt grid gap-1 border-b py-3 sm:grid-cols-[minmax(0,10rem)_1fr] sm:gap-6">
			<dt className="eyebrow pt-0.5">{label}</dt>
			<dd className="font-system text-[0.85rem]">{children}</dd>
		</div>
	)
}
