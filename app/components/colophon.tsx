import { cn } from '#app/utils/misc.tsx'

export type ColophonEntry = {
	key: string
	value: string
	/** Marks the honesty line — exactly one entry per colophon carries it. */
	signal?: boolean
}

/**
 * The colophon — a machine-readable account of how a piece was made, on a
 * Terminal surface. Transparency is not a disclaimer buried in the footer, it
 * is a designed object, and it ships with every piece of content without
 * exception. See §06 of the brand document (docs/brand/brand-design.html).
 */
export function Colophon({
	title = '// Herstellung',
	entries,
	className,
	...props
}: {
	title?: string
	entries: Array<ColophonEntry>
} & React.ComponentProps<'div'>) {
	return (
		<div
			className={cn(
				// the hairline is what keeps the block readable as an object when the
				// page itself is already a Terminal surface (dark mode)
				'bg-terminal text-terminal-tx border-steel-lt font-system text-brand-sm border px-6 py-5 leading-loose',
				className,
			)}
			{...props}
		>
			<p className="eyebrow mb-2.5 border-b border-[#2a2d30] pb-2.5 tracking-[0.2em]">
				{title}
			</p>
			<dl>
				{entries.map((entry) => (
					<div
						key={entry.key}
						className="grid grid-cols-[7rem_minmax(0,1fr)] gap-x-3"
					>
						<dt className="text-[#9ba0a5]">{entry.key}</dt>
						<dd className={entry.signal ? 'text-signal' : undefined}>
							{entry.value}
						</dd>
					</div>
				))}
			</dl>
		</div>
	)
}
