import { type ReactNode, useId, useState } from 'react'
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuSeparator,
	DropdownMenuSub,
	DropdownMenuSubContent,
	DropdownMenuSubTrigger,
	DropdownMenuTrigger,
} from '#app/components/ui/dropdown-menu.tsx'
import { cn, useMediaQuery } from '#app/utils/misc.tsx'
import { type Option } from './controls.tsx'

/**
 * The whole control set folded into one menu, so the front page can open with a
 * story instead of a control panel. It is the same taxonomy the inline chips
 * and segmented switches carry — ressort, niveau, and, one level deeper, the
 * two axes that only exist inside Politik & Wirtschaft.
 *
 * Styling follows §03 and §08 like the rest of the control set: radius 0,
 * hairline borders, mono caps, selection as an Ink fill rather than colour.
 */

/**
 * One radio axis inside the menu. Like the chips, an axis has no "all" entry:
 * unfiltered is the default state, and `value` is then simply a value outside
 * `options`, which leaves every row unmarked. Selecting the marked row again
 * clears the axis — that is the only way back out of a filter in the menu.
 */
type Axis<T extends string> = {
	label: string
	options: ReadonlyArray<Option<T>>
	value: string
	disabledValues?: ReadonlySet<T>
	onChange: (value: T) => void
}

const itemClassName =
	'font-system min-h-11 rounded-none px-3 py-0 pl-8 text-[0.62rem] tracking-[0.16em] uppercase text-steel focus:bg-signal-dim focus:text-foreground dark:focus:bg-secondary'

const selectedClassName =
	'data-[state=checked]:bg-foreground data-[state=checked]:text-background'

// The eyebrow utility would be overridden by the menu label's own `text-sm`,
// so its four declarations are spelled out as utilities instead.
const labelClassName =
	'font-system text-steel px-3 pt-4 pb-2 text-[0.62rem] font-normal tracking-[0.18em] uppercase'

/** The radio indicator, for the two rows that are plain items rather than radios. */
function ActiveMark() {
	return (
		<span
			aria-hidden="true"
			className="absolute left-2 flex size-3.5 items-center justify-center"
		>
			<span className="block size-1.5 bg-current" />
		</span>
	)
}

function MenuAxis<T extends string>({ axis }: { axis: Axis<T> }) {
	return (
		<>
			<DropdownMenuLabel className={labelClassName}>
				{axis.label}
			</DropdownMenuLabel>
			<DropdownMenuRadioGroup
				// The printed label is a sibling, so the group carries its own name.
				aria-label={axis.label}
				value={axis.value}
				// Radix hands back a plain string; the options are the only values the
				// group can emit, so narrowing to T here is safe.
				onValueChange={(value) => axis.onChange(value as T)}
			>
				{axis.options.map((option) => {
					const isDisabled =
						option.value !== axis.value &&
						(axis.disabledValues?.has(option.value) ?? false)
					return (
						<DropdownMenuRadioItem
							key={option.value}
							value={option.value}
							disabled={isDisabled}
							className={cn(
								itemClassName,
								selectedClassName,
								isDisabled && 'line-through',
							)}
						>
							{option.label}
						</DropdownMenuRadioItem>
					)
				})}
			</DropdownMenuRadioGroup>
		</>
	)
}

/**
 * The political desk, if the archive has one. Agency and Richtung hang off it
 * rather than sitting in the top level, because they mean nothing in any other
 * ressort — picking one here moves the reader into the ressort.
 */
type Political<AgencyValue extends string, LeaningValue extends string> = {
	label: string
	isActive: boolean
	/** Selects the ressort without narrowing either framing axis. */
	onSelect: () => void
	allLabel: string
	/** True when the reader is in the ressort with neither axis narrowed. */
	allIsActive: boolean
	agency: Axis<AgencyValue>
	leaning: Axis<LeaningValue>
}

/** The rows of the political group, in the order they read in either layout. */
function PoliticalRows<
	AgencyValue extends string,
	LeaningValue extends string,
>({ political }: { political: Political<AgencyValue, LeaningValue> }) {
	return (
		<>
			<DropdownMenuItem
				onSelect={political.onSelect}
				className={cn(
					itemClassName,
					political.allIsActive && 'bg-foreground text-background',
				)}
			>
				{political.allIsActive ? <ActiveMark /> : null}
				{political.allLabel}
			</DropdownMenuItem>
			<DropdownMenuSeparator className="bg-steel-lt mx-0 my-0" />
			<MenuAxis axis={political.agency} />
			<DropdownMenuSeparator className="bg-steel-lt mx-0 my-0" />
			<MenuAxis axis={political.leaning} />
		</>
	)
}

/**
 * The desk as a flyout, on viewports wide enough to hold a second panel beside
 * the first.
 */
function PoliticalSubmenu<
	AgencyValue extends string,
	LeaningValue extends string,
>({ political }: { political: Political<AgencyValue, LeaningValue> }) {
	return (
		<DropdownMenuSub>
			<DropdownMenuSubTrigger
				className={cn(
					itemClassName,
					'data-[state=open]:bg-signal-dim data-[state=open]:text-foreground dark:data-[state=open]:bg-secondary relative',
					political.isActive && 'bg-foreground text-background',
				)}
			>
				{political.isActive ? <ActiveMark /> : null}
				{political.label}
			</DropdownMenuSubTrigger>
			<DropdownMenuSubContent className="border-steel-lt bg-background text-foreground w-[min(16rem,calc(100vw-2rem))] rounded-none border p-0 shadow-none">
				<PoliticalRows political={political} />
			</DropdownMenuSubContent>
		</DropdownMenuSub>
	)
}

/**
 * The desk as a disclosure, for narrow screens. A flyout there has nowhere to
 * fly to — it lands on top of the menu it came from, and hovering it open is
 * not a gesture a touch screen has — so the rows unfold underneath the trigger
 * instead, held together by a rule down their left edge. The section starts
 * open when the reader is already standing in the ressort.
 */
function PoliticalDisclosure<
	AgencyValue extends string,
	LeaningValue extends string,
>({ political }: { political: Political<AgencyValue, LeaningValue> }) {
	const [isOpen, setIsOpen] = useState(political.isActive)
	const contentId = useId()

	return (
		<>
			<DropdownMenuItem
				// This row unfolds a section rather than filtering anything, so it
				// must not close the menu the way a filtering row does.
				onSelect={(event) => {
					event.preventDefault()
					setIsOpen((wasOpen) => !wasOpen)
				}}
				aria-expanded={isOpen}
				aria-controls={contentId}
				className={cn(
					itemClassName,
					'relative',
					political.isActive && 'bg-foreground text-background',
					isOpen &&
						!political.isActive &&
						'bg-signal-dim text-foreground dark:bg-secondary',
				)}
			>
				{political.isActive ? <ActiveMark /> : null}
				{political.label}
				{/* Down rather than the flyout's right: the rows arrive underneath. */}
				<span aria-hidden="true" className="ml-auto pl-4">
					{isOpen ? '↑' : '↓'}
				</span>
			</DropdownMenuItem>
			{isOpen ? (
				<div id={contentId} className="border-steel-lt ml-3 border-l">
					<PoliticalRows political={political} />
				</div>
			) : null}
		</>
	)
}

export function FilterMenu<
	CategoryValue extends string,
	LevelValue extends string,
	AgencyValue extends string,
	LeaningValue extends string,
>({
	label = 'Filter',
	activeCount = 0,
	ressort,
	niveau,
	political,
	note,
	className,
}: {
	label?: string
	/** How many axes are off their default — printed on the trigger. */
	activeCount?: number
	ressort: Axis<CategoryValue>
	niveau: Axis<LevelValue>
	political?: Political<AgencyValue, LeaningValue>
	/** A quiet line at the foot of the menu — the size of the archive. */
	note?: ReactNode
	className?: string
}) {
	// Matches Tailwind's `sm`. False on the server and for the first client
	// render, which is harmless: the menu is closed then, and the political
	// group is only built once a reader opens it.
	const hasRoomForFlyout = useMediaQuery('(min-width: 40rem)')

	return (
		<DropdownMenu>
			<DropdownMenuTrigger
				className={cn(
					'border-steel-lt font-system text-steel hover:border-foreground hover:text-foreground data-[state=open]:bg-foreground data-[state=open]:text-background inline-flex min-h-11 items-center gap-3 border px-3 text-[0.62rem] tracking-[0.16em] uppercase transition-colors',
					className,
				)}
			>
				<span aria-hidden="true" className="flex flex-col gap-0.75">
					<span className="block h-px w-4 bg-current" />
					<span className="block h-px w-4 bg-current" />
					<span className="block h-px w-4 bg-current" />
				</span>
				{label}
				{activeCount > 0 ? (
					<span className="tabular-nums">
						{activeCount}
						<span className="sr-only"> aktiv</span>
					</span>
				) : null}
			</DropdownMenuTrigger>

			<DropdownMenuContent
				align="end"
				className="border-steel-lt bg-background text-foreground max-h-(--radix-dropdown-menu-content-available-height) w-[min(18rem,calc(100vw-2rem))] overflow-auto rounded-none border p-0 shadow-none"
			>
				<MenuAxis axis={ressort} />

				{political ? (
					hasRoomForFlyout ? (
						<PoliticalSubmenu political={political} />
					) : (
						<PoliticalDisclosure political={political} />
					)
				) : null}

				<DropdownMenuSeparator className="bg-steel-lt mx-0 my-0" />
				<MenuAxis axis={niveau} />

				{note ? (
					<>
						<DropdownMenuSeparator className="bg-steel-lt mx-0 my-0" />
						<p className="eyebrow px-3 py-3 tabular-nums">{note}</p>
					</>
				) : null}
			</DropdownMenuContent>
		</DropdownMenu>
	)
}
