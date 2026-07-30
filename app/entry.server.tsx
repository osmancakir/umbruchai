import { contentSecurity } from '@nichtsam/helmet/content'
import * as Sentry from '@sentry/cloudflare'
import { isbot } from 'isbot'
import { renderToReadableStream } from 'react-dom/server'
import {
	ServerRouter,
	type LoaderFunctionArgs,
	type ActionFunctionArgs,
	type HandleDocumentRequestFunction,
} from 'react-router'
import { getEnv, init } from './utils/env.server.ts'
import { NonceProvider } from './utils/nonce-provider.ts'
import { isExpectedReactRouterErrorMessage } from './utils/sentry-event-filters.ts'
import { makeTimings } from './utils/timing.server.ts'

export const streamTimeout = 5000

const MODE = import.meta.env.MODE

type DocRequestArgs = Parameters<HandleDocumentRequestFunction>

function createNonce() {
	const bytes = crypto.getRandomValues(new Uint8Array(16))
	return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join(
		'',
	)
}

export default async function handleRequest(...args: DocRequestArgs) {
	const [request, responseStatusCode, responseHeaders, reactRouterContext] =
		args

	// On Workers `process.env` is populated from bindings per invocation rather
	// than at module load, so we validate and publish ENV inside the handler.
	init()
	globalThis.ENV = getEnv()

	if (MODE === 'production' && process.env.SENTRY_DSN) {
		responseHeaders.append('Document-Policy', 'js-profiling')
	}

	const nonce = createNonce()

	// NOTE: this timing will only include things that are rendered in the shell
	// and will not include suspended components and deferred loaders
	const timings = makeTimings('render', 'renderToReadableStream')

	let didError = false

	const body = await renderToReadableStream(
		<NonceProvider value={nonce}>
			<ServerRouter
				nonce={nonce}
				context={reactRouterContext}
				url={request.url}
			/>
		</NonceProvider>,
		{
			nonce,
			signal: AbortSignal.timeout(streamTimeout + 5000),
			onError(error: unknown) {
				didError = true
				console.error(error)
			},
		},
	)

	// Bots get the fully rendered document; browsers get the streamed shell.
	if (isbot(request.headers.get('user-agent'))) {
		await body.allReady
	}

	responseHeaders.set('Content-Type', 'text/html')
	responseHeaders.append('Server-Timing', timings.toString())

	contentSecurity(responseHeaders, {
		crossOriginEmbedderPolicy: false,
		contentSecurityPolicy: {
			// NOTE: Remove reportOnly when you're ready to enforce this CSP
			reportOnly: true,
			directives: {
				fetch: {
					'connect-src': [
						MODE === 'development' ? 'ws:' : undefined,
						process.env.SENTRY_DSN ? '*.sentry.io' : undefined,
						"'self'",
					],
					'font-src': ["'self'"],
					'frame-src': ["'self'"],
					'img-src': ["'self'", 'data:'],
					'script-src': ["'strict-dynamic'", "'self'", `'nonce-${nonce}'`],
					'script-src-attr': [`'nonce-${nonce}'`],
				},
			},
		},
	})

	return new Response(body, {
		headers: responseHeaders,
		status: didError ? 500 : responseStatusCode,
	})
}

export function handleError(
	error: unknown,
	{ request }: LoaderFunctionArgs | ActionFunctionArgs,
): void {
	// Skip capturing if the request is aborted as Remix docs suggest
	// Ref: https://remix.run/docs/en/main/file-conventions/entry.server#handleerror
	if (request.signal.aborted) {
		return
	}

	// Expected React Router responses to unsupported methods / missing handlers
	// (common from bots and scanners on the public demo). Don't alert.
	if (
		error instanceof Error &&
		isExpectedReactRouterErrorMessage(error.message)
	) {
		return
	}

	if (error instanceof Error) {
		console.error(error.stack)
	} else {
		console.error(error)
	}

	Sentry.captureException(error)
}
