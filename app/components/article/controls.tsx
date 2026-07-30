import { type ReactNode } from 'react'
import { cn } from '#app/utils/misc.tsx'

/**
 * The editorial control set. Everything here obeys §03 and §08 of the brand
 * document: radius 0, hairline borders, mono type, and Signal reserved for
 * fracture / live / agent states — never for "this button is selected".
 * Selection is Ink fill, which is louder than orange and costs nothing.
 */

export type Option<T extends string> = {
	value: T
	label: string
	/** Shown instead of `label` on narrow screens. */
	short?: string
}

/**
 * A segmented switch — reading level, agency, leaning. Borders collapse into
 * each other so the group reads as one ruled object rather than five buttons.
 */
export function Segmented<T extends string>({
	label,
	hideLabel,
	options,
	value,
	disabledValues,
	onChange,
	className,
}: {
	label: string
	/** Drops the printed label; the group keeps it as its accessible name. */
	hideLabel?: boolean
	options: ReadonlyArray<Option<T>>
	value: T
	disabledValues?: ReadonlySet<T>
	onChange: (value: T) => void
	className?: string
}) {
	return (
		<div
			className={cn('flex flex-wrap items-center gap-x-4 gap-y-2', className)}
		>
			{hideLabel ? null : <span className="eyebrow shrink-0">{label}</span>}
			<div
				role="radiogroup"
				aria-label={label}
				className="border-steel-lt flex flex-wrap border"
			>
				{options.map((option) => {
					const isActive = option.value === value
					const isDisabled =
						!isActive && (disabledValues?.has(option.value) ?? false)
					return (
						<button
							key={option.value}
							type="button"
							role="radio"
							aria-checked={isActive}
							aria-label={option.label}
							disabled={isDisabled}
							onClick={() => onChange(option.value)}
							className={cn(
								// min-h-11 keeps the tap target at 44px without softening the
								// control — the type stays small, only the hit area grows.
								'border-steel-lt font-system -ml-px flex min-h-11 items-center border-l px-3 text-[0.62rem] tracking-[0.16em] uppercase transition-colors first:ml-0 first:border-l-0',
								isActive
									? 'bg-foreground text-background'
									: 'text-steel hover:text-foreground hover:bg-signal-dim/60 dark:hover:bg-secondary',
								isDisabled &&
									'text-steel/40 hover:text-steel/40 cursor-not-allowed line-through hover:bg-transparent dark:hover:bg-transparent',
							)}
						>
							<span className="sm:hidden">{option.short ?? option.label}</span>
							<span className="hidden sm:inline">{option.label}</span>
						</button>
					)
				})}
			</div>
		</div>
	)
}

/**
 * A wrapping chip row, for the one axis with too many values to segment:
 * the category filter. Each chip is a toggle rather than a radio — pressing
 * the active one clears the filter, so the row needs no "Alle" escape hatch.
 */
export function FilterChips<T extends string>({
	label,
	hideLabel,
	options,
	value,
	onChange,
	className,
}: {
	label: string
	/** Drops the printed label; the group keeps it as its accessible name. */
	hideLabel?: boolean
	options: ReadonlyArray<Option<T>>
	/** A value outside `options` — "all" — leaves every chip unpressed. */
	value: string
	onChange: (value: T) => void
	className?: string
}) {
	return (
		<div
			className={cn('flex flex-wrap items-center gap-x-4 gap-y-2', className)}
		>
			{hideLabel ? null : <span className="eyebrow shrink-0">{label}</span>}
			<div
				role="group"
				aria-label={label}
				className="flex flex-wrap gap-x-1.5 gap-y-1.5"
			>
				{options.map((option) => {
					const isActive = option.value === value
					return (
						<button
							key={option.value}
							type="button"
							aria-pressed={isActive}
							onClick={() => onChange(option.value)}
							className={cn(
								'font-system flex min-h-11 items-center border px-3 text-[0.62rem] tracking-[0.14em] uppercase transition-colors',
								isActive
									? 'border-foreground bg-foreground text-background'
									: 'border-steel-lt text-steel hover:border-foreground hover:text-foreground',
							)}
						>
							{option.label}
						</button>
					)
				})}
			</div>
		</div>
	)
}

/**
 * Agency and leaning are ordered axes, so they are drawn as a position on a
 * track rather than coloured in — five cells, one of them filled. It carries
 * the same information the old colour-coded pills did without spending the
 * brand's single loud colour on taxonomy.
 */
export function ScaleMark<T extends string>({
	label,
	scale,
	value,
	className,
}: {
	label: string
	scale: ReadonlyArray<{ value: T; label: string }>
	value: T
	className?: string
}) {
	const index = scale.findIndex((step) => step.value === value)
	if (index < 0) return null
	const active = scale[index]

	return (
		<span
			className={cn('inline-flex items-center gap-2', className)}
			title={`${label}: ${active?.label}`}
		>
			<span className="eyebrow">{label}</span>
			<span aria-hidden="true" className="flex items-center gap-[3px]">
				{scale.map((step, stepIndex) => (
					<span
						key={step.value}
						className={cn(
							'block size-[6px]',
							stepIndex === index ? 'bg-foreground' : 'bg-steel-lt',
						)}
					/>
				))}
			</span>
			<span className="font-system text-steel text-[0.62rem] tracking-[0.12em] uppercase">
				{active?.label}
			</span>
		</span>
	)
}

/**
 * The card tag from §06 — ink plate by default, Signal only where something is
 * genuinely live or leading.
 */
export function Tag({
	tone = 'ink',
	children,
	className,
}: {
	tone?: 'ink' | 'signal' | 'quiet'
	children: ReactNode
	className?: string
}) {
	return (
		<span
			className={cn(
				'font-system inline-block px-2 py-1 text-[0.6rem] leading-none font-semibold tracking-[0.16em] uppercase',
				tone === 'signal' && 'bg-signal text-paper',
				tone === 'ink' && 'bg-foreground text-background',
				tone === 'quiet' && 'border-steel-lt text-steel border',
				className,
			)}
		>
			{children}
		</span>
	)
}
