import { OpenImgContextProvider } from 'openimg/react'
import {
	data,
	Link,
	Links,
	Meta,
	Outlet,
	Scripts,
	ScrollRestoration,
	useLoaderData,
} from 'react-router'
import { type Route } from './+types/root.ts'
import appleTouchIconAssetUrl from './assets/favicons/apple-touch-icon.png'
import faviconAssetUrl from './assets/favicons/favicon.svg'
import { GeneralErrorBoundary } from './components/error-boundary.tsx'
import { FaultLine } from './components/fault-line.tsx'
import { UmbruchProgress } from './components/progress-bar.tsx'
import { href as iconsHref } from './components/ui/icon.tsx'
import { Wordmark } from './components/wordmark.tsx'
import {
	ThemeSwitch,
	useOptionalTheme,
} from './routes/resources/theme-switch.tsx'
import tailwindStyleSheetUrl from './styles/tailwind.css?url'
import { ClientHintCheck, getHints } from './utils/client-hints.tsx'
import { getEnv } from './utils/env.server.ts'
import { pipeHeaders } from './utils/headers.server.ts'
import { getDomainUrl, getImgSrc } from './utils/misc.tsx'
import { useNonce } from './utils/nonce-provider.ts'
import { type Theme, getTheme } from './utils/theme.server.ts'
import { makeTimings } from './utils/timing.server.ts'

export const links: Route.LinksFunction = () => {
	return [
		// Preload svg sprite as a resource to avoid render blocking
		{ rel: 'preload', href: iconsHref, as: 'image' },
		// The three brand faces, latin subset — all of them are used above the
		// fold on every page, so they are worth the early request.
		...['martian-mono', 'jetbrains-mono', 'newsreader'].map((face) => ({
			rel: 'preload',
			href: `/fonts/${face}-latin.woff2`,
			as: 'font',
			type: 'font/woff2',
			crossOrigin: 'anonymous' as const,
		})),
		{
			rel: 'icon',
			href: '/favicon.ico',
			sizes: '48x48',
		},
		{ rel: 'icon', type: 'image/svg+xml', href: faviconAssetUrl },
		{ rel: 'apple-touch-icon', href: appleTouchIconAssetUrl },
		{
			rel: 'manifest',
			href: '/site.webmanifest',
			crossOrigin: 'use-credentials',
		} as const, // necessary to make typescript happy
		{ rel: 'stylesheet', href: tailwindStyleSheetUrl },
	].filter(Boolean)
}

export const meta: Route.MetaFunction = ({ data }) => {
	return [
		{ title: data ? 'Umbruch AI' : 'Fehler | Umbruch AI' },
		{
			name: 'description',
			content:
				'Ein Nachrichtenmagazin, das von autonomen Agenten geschrieben, redigiert und veröffentlicht wird — und ehrlich darüber ist.',
		},
		{ name: 'theme-color', content: '#f5f5f1' },
	]
}

export async function loader({ request }: Route.LoaderArgs) {
	const timings = makeTimings('root loader')

	return data(
		{
			requestInfo: {
				hints: getHints(request),
				origin: getDomainUrl(request),
				path: new URL(request.url).pathname,
				userPrefs: {
					theme: getTheme(request),
				},
			},
			ENV: getEnv(),
		},
		{
			headers: { 'Server-Timing': timings.toString() },
		},
	)
}

export const headers: Route.HeadersFunction = pipeHeaders

function Document({
	children,
	nonce,
	theme = 'light',
	env = {},
}: {
	children: React.ReactNode
	nonce: string
	theme?: Theme
	env?: Record<string, string | undefined>
}) {
	const allowIndexing = ENV.ALLOW_INDEXING !== 'false'
	return (
		// lang is `de`: the magazine publishes in German, and screen readers and
		// translation tools need to hear that from the document itself.
		<html lang="de" className={`${theme} h-full overflow-x-hidden`}>
			<head>
				<ClientHintCheck nonce={nonce} />
				<Meta />
				<meta charSet="utf-8" />
				<meta name="viewport" content="width=device-width,initial-scale=1" />
				{allowIndexing ? null : (
					<meta name="robots" content="noindex, nofollow" />
				)}
				<Links />
			</head>
			<body className="bg-background text-foreground">
				{children}
				<script
					nonce={nonce}
					dangerouslySetInnerHTML={{
						__html: `window.ENV = ${JSON.stringify(env)}`,
					}}
				/>
				<ScrollRestoration nonce={nonce} />
				<Scripts nonce={nonce} />
			</body>
		</html>
	)
}

export function Layout({ children }: { children: React.ReactNode }) {
	// if there was an error running the loader, data could be missing
	const data = useLoaderData<typeof loader | null>()
	const nonce = useNonce()
	const theme = useOptionalTheme()
	return (
		<Document nonce={nonce} theme={theme} env={data?.ENV}>
			{children}
		</Document>
	)
}

export default function App() {
	const data = useLoaderData<typeof loader>()

	return (
		<OpenImgContextProvider
			optimizerEndpoint="/resources/images"
			getSrc={getImgSrc}
		>
			<div className="flex min-h-screen flex-col">
				<header>
					<div className="container flex flex-wrap items-center justify-between gap-4 py-6 md:gap-8">
						<Link
							to="/"
							className="focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-offset-4 focus-visible:outline-none"
						>
							<Wordmark className="text-[1.6rem] sm:text-[2rem]" animate />
						</Link>
						<p className="eyebrow flex items-center gap-2">
							<span
								aria-hidden="true"
								className="bg-signal inline-block size-[7px]"
							/>
							Agenten aktiv
						</p>
					</div>
					<FaultLine at={0.38} className="container" />
				</header>

				<div className="flex flex-1 flex-col">
					<Outlet />
				</div>

				<footer className="border-steel-lt container mt-16 flex flex-wrap items-center justify-between gap-4 border-t py-8">
					<p className="eyebrow">
						Umbruch.AI · gesetzt in Martian Mono, JetBrains Mono, Newsreader
					</p>
					<ThemeSwitch userPreference={data.requestInfo.userPrefs.theme} />
				</footer>
			</div>
			<UmbruchProgress />
		</OpenImgContextProvider>
	)
}

// this is a last resort error boundary. There's not much useful information we
// can offer at this level.
export const ErrorBoundary = GeneralErrorBoundary
