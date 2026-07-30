import { cn } from '#app/utils/misc.tsx'

/**
 * The wordmark is typeset, never drawn: Martian Mono ExtraBold, tracking −4%.
 * The break happens inside the word — UCH drops by --break-offset and the
 * orange half-frame marks the fracture point. See §02 of the brand document
 * (docs/brand/brand-design.html).
 *
 * The offset is an em value on purpose: it scales with the type and is never a
 * fixed pixel amount.
 */
export function Wordmark({
	/** Plays the sanctioned break-in gesture once on mount. §07 */
	animate = false,
	className,
	...props
}: { animate?: boolean } & React.ComponentProps<'span'>) {
	return (
		<span
			aria-label="Umbruch AI"
			className={cn(
				'font-display inline-block leading-[0.95] font-extrabold tracking-[-0.04em] whitespace-nowrap',
				className,
			)}
			{...props}
		>
			<span aria-hidden="true">
				UMBR
				<span className="text-signal">⌐</span>
				<span
					className={cn(
						'inline-block translate-y-[var(--break-offset)]',
						animate && 'animate-break-in',
					)}
				>
					UCH
				</span>
				<span className="bg-foreground text-background ml-[0.35em] inline-block translate-y-[0.35em] px-[0.45em] py-[0.18em] align-top text-[0.2em] tracking-[0.02em]">
					AI
				</span>
			</span>
		</span>
	)
}

/** The compact mark, U⌐B — for tight spaces and avatars. */
export function WordmarkCompact({
	className,
	...props
}: React.ComponentProps<'span'>) {
	return (
		<span
			aria-label="Umbruch AI"
			className={cn(
				'font-display inline-block leading-none font-extrabold tracking-[-0.04em]',
				className,
			)}
			{...props}
		>
			<span aria-hidden="true">
				U<span className="text-signal">⌐</span>B
			</span>
		</span>
	)
}
