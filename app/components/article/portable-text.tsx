import { type PortableTextComponents } from '@portabletext/react'
import { type ReactNode } from 'react'
import { type SanityImageAsset } from '#app/utils/articles.types.ts'
import { urlFor } from '#app/utils/sanity.ts'

/**
 * §04: the body is the one place the machine hands the text to a human eye, so
 * it is the one place that is not monospaced. Newsreader, 1.65 leading, and a
 * measure the container caps at 68ch. Headings stay in the machine voice.
 */
export const articlePortableTextComponents: PortableTextComponents = {
	block: {
		normal: ({ children }: { children?: ReactNode }) => (
			<p className="font-reading text-[1.1rem] leading-[1.65]">{children}</p>
		),
		h1: ({ children }: { children?: ReactNode }) => (
			<h2 className="font-display mt-6 text-[1.35rem] leading-[1.2] font-bold tracking-[-0.02em]">
				{children}
			</h2>
		),
		h2: ({ children }: { children?: ReactNode }) => (
			<h2 className="font-display mt-6 text-[1.35rem] leading-[1.2] font-bold tracking-[-0.02em]">
				{children}
			</h2>
		),
		h3: ({ children }: { children?: ReactNode }) => (
			<h3 className="font-display mt-5 text-[1.1rem] leading-[1.25] font-bold tracking-[-0.02em]">
				{children}
			</h3>
		),
		h4: ({ children }: { children?: ReactNode }) => (
			<h4 className="font-display mt-4 text-[1rem] leading-[1.3] font-bold tracking-[-0.02em]">
				{children}
			</h4>
		),
		blockquote: ({ children }: { children?: ReactNode }) => (
			<blockquote className="border-signal font-reading my-2 border-l-2 pl-5 text-[1.2rem] leading-[1.5] italic">
				{children}
			</blockquote>
		),
	},
	list: {
		bullet: ({ children }: { children?: ReactNode }) => (
			<ul className="font-reading marker:text-signal list-disc space-y-2 pl-5 text-[1.1rem] leading-[1.6]">
				{children}
			</ul>
		),
		number: ({ children }: { children?: ReactNode }) => (
			<ol className="font-reading marker:text-steel list-decimal space-y-2 pl-5 text-[1.1rem] leading-[1.6]">
				{children}
			</ol>
		),
	},
	marks: {
		code: ({ children }: { children?: ReactNode }) => (
			<code className="bg-muted font-system px-1.5 py-0.5 text-[0.85em]">
				{children}
			</code>
		),
		link: ({
			children,
			value,
		}: {
			children?: ReactNode
			value?: { href?: string }
		}) => (
			<a
				href={value?.href}
				target="_blank"
				rel="noreferrer"
				className="decoration-signal underline decoration-1 underline-offset-4"
			>
				{children}
			</a>
		),
	},
	types: {
		image: ({
			value,
		}: {
			value: {
				asset: SanityImageAsset['asset']
				alt?: string
				caption?: string
			}
		}) => {
			const src = urlFor({ _type: 'image', asset: value.asset })
				.width(1000)
				.auto('format')
				.url()
			return (
				<figure className="border-steel-lt border">
					<img
						src={src}
						alt={value.alt ?? ''}
						className="h-auto w-full object-cover"
						loading="lazy"
						decoding="async"
					/>
					{value.caption ? (
						<figcaption className="border-steel-lt eyebrow border-t px-4 py-2 normal-case">
							{value.caption}
						</figcaption>
					) : null}
				</figure>
			)
		},
	},
}

/** The author biography sits in the same reading voice, one size down. */
export const authorPortableTextComponents: PortableTextComponents = {
	block: {
		normal: ({ children }: { children?: ReactNode }) => (
			<p className="font-reading text-[1.05rem] leading-[1.6]">{children}</p>
		),
	},
}
