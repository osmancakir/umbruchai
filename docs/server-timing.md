# Server Timing

`app/utils/timing.server.ts` measures how long the parts of a response took.
Wrap a function in a `time` call, then turn the timings object into a
`Server-Timing` header, and the breakdown shows up per request in DevTools.

That matters here because a page's cost is almost entirely Sanity reads, and
`cachified` hides whether a given read was a cache hit — the timings are what
tell them apart.

You can
[learn more about the Server Timing header on MDN](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Server-Timing).
The metrics passed in this header will be visually displayed in
[the DevTools "Timing" tab](https://developer.chrome.com/docs/devtools/network/reference/#timing).

## Usage

Timings requires four parts:

1. Setup Timings
2. Time functions
3. Create headers
4. Send headers

All four parts, on an article route:

```tsx
import {
	combineServerTimings,
	makeTimings,
	time,
} from '#app/utils/timing.server.ts'
import { type Route } from './+types/$slug.ts'

export async function loader({ params }: Route.LoaderArgs) {
	const timings = makeTimings('article loader') // <-- 1. Setup Timings
	// 2. Time functions
	const article = await time(() => getArticleBySlug(params.slug, { timings }), {
		timings,
		type: 'get article',
	})
	if (!article) {
		throw new Response('Not found', { status: 404 })
	}
	// 2. Time functions
	const related = await time(
		() => getRelatedArticles(article.category, { timings }),
		{ timings, type: 'get related' },
	)
	return data(
		{ article, related },
		{ headers: { 'Server-Timing': timings.toString() } }, // <-- 3. Create headers
	)
}

// We have a general headers handler to save you from boilerplating.
export const headers: HeadersFunction = pipeHeaders
// this is basically what it does though
export const headers: Route.HeadersFunction = ({
	loaderHeaders,
	parentHeaders,
}) => {
	return {
		'Server-Timing': combineServerTimings(parentHeaders, loaderHeaders), // <-- 4. Send headers
	}
}
```

You can
[learn more about `headers` in the React Router docs](https://reactrouter.com/how-to/headers)
