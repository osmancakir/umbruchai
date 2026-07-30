import { cn } from '#app/utils/misc.tsx'

/**
 * The fault line — a rule that breaks and continues on a new baseline. It
 * replaces every generic divider in the system. See §05 of the brand document
 * (docs/brand/brand-design.html).
 *
 * Rules: one per viewport region, never stacked as texture, never diagonal,
 * never more than one step per line. The break position is meant to vary.
 */
export function FaultLine({
	/** Where the line steps down, as a fraction of its width. */
	at = 0.5,
	tone = 'ink',
	className,
	...props
}: {
	at?: number
	tone?: 'ink' | 'signal'
} & React.ComponentProps<'svg'>) {
	const x = Math.round(Math.min(Math.max(at, 0.02), 0.98) * 1000)
	return (
		<svg
			viewBox="0 0 1000 14"
			preserveAspectRatio="none"
			aria-hidden="true"
			className={cn('block h-3.5 w-full', className)}
			{...props}
		>
			<polyline
				points={`0,4 ${x},4 ${x},10 1000,10`}
				fill="none"
				strokeWidth="1.5"
				vectorEffect="non-scaling-stroke"
				className={tone === 'signal' ? 'stroke-signal' : 'stroke-current'}
			/>
		</svg>
	)
}

/**
 * The progress variant: the break travels left to right while agents work.
 * `value` is 0–1. Renders as a real progressbar for assistive tech.
 */
export function FaultProgress({
	value,
	label,
	className,
	...props
}: {
	value: number
	label: string
} & React.ComponentProps<'div'>) {
	const clamped = Math.min(Math.max(value, 0), 1)
	const step = Math.round(clamped * 1000)
	return (
		<div
			role="progressbar"
			aria-valuenow={Math.round(clamped * 100)}
			aria-valuemin={0}
			aria-valuemax={100}
			aria-label={label}
			className={cn('w-full', className)}
			{...props}
		>
			<svg
				viewBox="0 0 1000 14"
				preserveAspectRatio="none"
				aria-hidden="true"
				className="block h-3.5 w-full"
			>
				<polyline
					points={`0,4 ${step},4 ${step},10 1000,10`}
					fill="none"
					strokeWidth="1.5"
					vectorEffect="non-scaling-stroke"
					className="stroke-steel-lt"
				/>
				<polyline
					points={`0,4 ${step},4 ${step},10 ${Math.min(step + 120, 1000)},10`}
					fill="none"
					strokeWidth="1.5"
					vectorEffect="non-scaling-stroke"
					className="stroke-signal"
				/>
			</svg>
		</div>
	)
}
