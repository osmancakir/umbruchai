import { Link } from 'react-router'
import { resolveLevelText } from '#app/utils/articles.ts'
import { type LanguageLevel } from '#app/utils/articles.types.ts'
import { type Bulletin } from '#app/utils/bulletin.ts'
import { cn } from '#app/utils/misc.tsx'
import { Tag } from './article/controls.tsx'

function formatDuration(seconds: number) {
	const total = Math.round(seconds)
	return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')} min`
}

function storyHref(slug: string, level: LanguageLevel) {
	const path = `/articles/${encodeURIComponent(slug)}`
	return level === 'easy' ? path : `${path}?level=${level}`
}

/**
 * The daily video bulletin: a presenter reads the day's stories in a 9:16
 * reel. It is ~20 MB, so nothing is fetched until the reader presses play —
 * the poster frame stands in until then. The native controls are kept on
 * purpose: they come with keyboard, captions and fullscreen handling for free.
 */
export function BulletinPlayer({
	bulletin,
	level,
	className,
}: {
	bulletin: Bulletin
	level: LanguageLevel
	className?: string
}) {
	const label = bulletin.dateLabel ?? bulletin.date

	return (
		<section
			aria-labelledby="bulletin-heading"
			className={cn(
				'grid gap-8 md:grid-cols-[minmax(0,1fr)_minmax(0,20rem)] md:items-start md:gap-12',
				className,
			)}
		>
			<div className="md:py-4">
				<div className="flex flex-wrap items-center gap-1.5">
					<Tag tone="signal">Video</Tag>
					{bulletin.durationSec ? (
						<Tag tone="quiet">{formatDuration(bulletin.durationSec)}</Tag>
					) : null}
				</div>
				<h2
					id="bulletin-heading"
					className="font-display mt-6 text-[clamp(1.5rem,3.4vw,2.1rem)] leading-[1.1] font-extrabold tracking-[-0.03em] text-balance"
				>
					Die Nachrichten des Tages, vorgelesen
				</h2>
				<p className="eyebrow mt-4">
					<time dateTime={bulletin.date}>{label}</time>
				</p>

				{bulletin.stories.length ? (
					<ol className="border-steel-lt mt-8 border-t">
						{bulletin.stories.map((story, index) => (
							<li key={story.slug} className="border-steel-lt border-b">
								<Link
									to={storyHref(story.slug, level)}
									className="group hover:bg-signal-dim dark:hover:bg-secondary flex min-h-11 items-baseline gap-4 py-3 transition-colors"
								>
									<span className="eyebrow w-5 shrink-0 tabular-nums">
										{String(index + 1).padStart(2, '0')}
									</span>
									<span className="font-reading text-[1rem] leading-[1.4]">
										{resolveLevelText(story.title, level)}
									</span>
								</Link>
							</li>
						))}
					</ol>
				) : null}

				{bulletin.transcript ? (
					<details className="mt-6">
						<summary className="eyebrow hover:text-foreground flex min-h-11 cursor-pointer items-center">
							Transkript
						</summary>
						<div className="font-reading mt-2 max-w-[60ch] space-y-4 text-[1rem] leading-[1.55]">
							{bulletin.transcript.split(/\n{2,}/).map((paragraph, index) => (
								<p key={index}>{paragraph}</p>
							))}
						</div>
					</details>
				) : null}
			</div>

			<div className="border-foreground bg-foreground order-first mx-auto aspect-[9/16] w-full max-w-[20rem] border md:order-none">
				<video
					key={bulletin.videoUrl}
					src={bulletin.videoUrl}
					poster={bulletin.posterUrl ?? undefined}
					controls
					playsInline
					preload="none"
					aria-label={`Video-Nachrichten vom ${label}`}
					className="h-full w-full object-cover"
				/>
			</div>
		</section>
	)
}
