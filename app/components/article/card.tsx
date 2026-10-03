import { Link } from 'react-router'
import {
	agencyScale,
	categoryLabels,
	formatReadableTimestamp,
	formatTimestamp,
	leaningScale,
	levelOptions,
	regionLabels,
	resolveLevelText,
	resolveLeadingImageUrl,
} from '#app/utils/articles.ts'
import {
	POLITICS_ECONOMICS_CATEGORY,
	type ArticleListItem,
	type LanguageLevel,
} from '#app/utils/articles.types.ts'
import { cn } from '#app/utils/misc.tsx'
import { AgentByline } from './byline.tsx'
import { ScaleMark, Tag } from './controls.tsx'

function articleHref(item: ArticleListItem, level: LanguageLevel) {
	const path = `/articles/${encodeURIComponent(item.slug)}`
	return level === 'easy' ? path : `${path}?level=${level}`
}

/**
 * The three reading levels of one article, shown as a set with the reader's
 * current level filled. §06: "same article, three reading levels, one card".
 */
function LevelStrip({
	level,
	className,
}: {
	level: LanguageLevel
	className?: string
}) {
	return (
		<span
			className={cn('font-system flex items-center gap-1', className)}
			title={`Niveau: ${levelOptions.find((o) => o.value === level)?.label}`}
		>
			{levelOptions.map((option) => (
				<span
					key={option.value}
					className={cn(
						'px-1 py-0.5 text-[0.55rem] tracking-[0.12em] uppercase',
						option.value === level
							? 'bg-foreground text-background'
							: 'text-steel',
					)}
				>
					{option.short}
				</span>
			))}
		</span>
	)
}

function CardTimestamp({
	date,
	className,
}: {
	date: string
	className?: string
}) {
	return (
		<time
			dateTime={date}
			className={cn(
				'font-system text-steel text-[0.62rem] leading-none tracking-[0.08em] uppercase',
				className,
			)}
		>
			{formatReadableTimestamp(date)}
		</time>
	)
}

function Framing({
	item,
	className,
}: {
	item: ArticleListItem
	className?: string
}) {
	if (item.category !== POLITICS_ECONOMICS_CATEGORY) return null
	if (!item.agencyLevel && !item.leaning) return null
	return (
		<div
			className={cn('flex flex-wrap items-center gap-x-5 gap-y-2', className)}
		>
			{item.agencyLevel ? (
				<ScaleMark
					label="Agency"
					scale={agencyScale}
					value={item.agencyLevel}
				/>
			) : null}
			{item.leaning ? (
				<ScaleMark label="Richtung" scale={leaningScale} value={item.leaning} />
			) : null}
		</div>
	)
}

/**
 * The article card of §06: Ink border, radius 0, no shadow. The card surface
 * is one link; the byline chips inside it sit above that link so an agent name
 * still takes you to the agent.
 */
export function ArticleCard({
	item,
	level,
	className,
}: {
	item: ArticleListItem
	level: LanguageLevel
	className?: string
}) {
	const title = resolveLevelText(item.title, level)
	const imageUrl = item.leadingImage
		? resolveLeadingImageUrl(item.leadingImage, 800)
		: null

	return (
		<article
			className={cn(
				'border-foreground group relative flex flex-col border',
				className,
			)}
		>
			<Link
				to={articleHref(item, level)}
				className="focus-visible:ring-ring absolute inset-0 z-0 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
				aria-label={title}
			/>

			{imageUrl ? (
				<div className="border-foreground bg-muted relative overflow-hidden border-b">
					<img
						src={imageUrl}
						alt={item.leadingImage?.alternativeText ?? ''}
						className="h-60 w-full object-cover sm:h-64"
						loading="lazy"
						decoding="async"
					/>
					{/* The overlays let clicks through to the card link; only the
					    byline chips take them, so an agent name still links out.
					    Timestamp and level share the top edge so the byline keeps
					    the full bottom row even on a phone-width card. */}
					<div className="pointer-events-none absolute inset-x-3 top-3 flex items-start justify-between gap-2">
						<CardTimestamp
							date={item.date}
							className="bg-background min-w-0 px-2 py-1.5"
						/>
						<LevelStrip
							level={level}
							className="bg-background shrink-0 p-0.5"
						/>
					</div>
					<AgentByline
						authors={item.agents}
						className="*:bg-background pointer-events-auto absolute bottom-3 left-3 z-10 max-w-[calc(100%-1.5rem)]"
					/>
				</div>
			) : null}

			<div className="flex flex-1 flex-col gap-3 p-5">
				{imageUrl ? null : (
					<div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
						<AgentByline
							authors={item.agents}
							className="relative z-10 max-w-full"
						/>
						<LevelStrip level={level} />
					</div>
				)}

				<div className="flex items-start justify-between gap-3">
					<div className="flex flex-wrap items-center gap-1.5">
						{item.category ? <Tag>{categoryLabels[item.category]}</Tag> : null}
						{item.region ? (
							<Tag tone="quiet">{regionLabels[item.region]}</Tag>
						) : null}
					</div>
					<span className="eyebrow shrink-0 py-1 leading-none">
						{item.sources.length}{' '}
						{item.sources.length === 1 ? 'Quelle' : 'Quellen'}
					</span>
				</div>

				<h3 className="font-display text-[1.05rem] leading-tight font-bold tracking-[-0.02em] text-balance">
					{title}
				</h3>

				<p className="font-reading text-steel line-clamp-4 text-[0.95rem] leading-normal">
					{resolveLevelText(item.summary, level, '')}
				</p>

				<Framing item={item} className="mt-auto pt-1" />

				{imageUrl ? null : (
					<CardTimestamp date={item.date} className="mt-auto" />
				)}
			</div>
		</article>
	)
}

/**
 * The front-page lead. Same content as a card, given the room a front page
 * gives its top story — and the one place Signal is spent on the index.
 */
export function LeadStory({
	item,
	level,
	className,
}: {
	item: ArticleListItem
	level: LanguageLevel
	className?: string
}) {
	const title = resolveLevelText(item.title, level)
	const imageUrl = item.leadingImage
		? resolveLeadingImageUrl(item.leadingImage, 1400)
		: null

	return (
		<article className={cn('group relative', className)}>
			<Link
				to={articleHref(item, level)}
				className="focus-visible:ring-ring absolute inset-0 z-0 focus-visible:ring-2 focus-visible:ring-offset-4 focus-visible:outline-none"
				aria-label={title}
			/>

			<div className="flex flex-wrap items-center gap-1.5">
				<Tag tone="signal">Aufmacher</Tag>
				{item.category ? <Tag>{categoryLabels[item.category]}</Tag> : null}
				{item.region ? (
					<Tag tone="quiet">{regionLabels[item.region]}</Tag>
				) : null}
			</div>

			<div className="mt-6 grid gap-8 md:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] md:items-start md:gap-12">
				<div>
					<h2 className="font-display text-[clamp(1.7rem,4.2vw,2.6rem)] leading-[1.08] font-extrabold tracking-[-0.03em] text-balance">
						{title}
					</h2>
					{item.subtitle ? (
						<p className="font-reading mt-5 max-w-[52ch] text-[clamp(1.05rem,2vw,1.3rem)] leading-[1.45]">
							{item.subtitle}
						</p>
					) : null}
					<div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2">
						<AgentByline authors={item.agents} className="relative z-10" />
						<time className="eyebrow" dateTime={item.date}>
							{formatTimestamp(item.date)}
						</time>
					</div>
					<Framing item={item} className="mt-4" />
				</div>

				{imageUrl ? (
					<div className="border-foreground bg-muted border">
						<img
							src={imageUrl}
							alt={item.leadingImage?.alternativeText ?? ''}
							className="h-56 w-full object-cover sm:h-72 md:h-80"
							loading="eager"
							decoding="async"
						/>
					</div>
				) : null}
			</div>
		</article>
	)
}
