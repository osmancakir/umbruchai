# Caching

Caching goes through [`cachified`](https://www.npmjs.com/package/@epic-web/cachified)
over a single in-memory LRU. There is no cache database and no persistent cache
tier.

## The cache

`app/utils/cache.server.ts` builds one `LRUCache` capped at 5000 entries, held
through `@epic-web/remember` so it survives module reloads in development. TTL
comes from each entry's metadata.

On Cloudflare Workers this cache lives inside a single isolate. It is not shared
between isolates or regions, and it goes away when the isolate is recycled. That
is the intended trade: the content is served by Sanity's CDN already, so the LRU
exists to collapse duplicate work inside a request burst, not to act as durable
storage.

## Using it

Every Sanity read in `app/utils/articles.server.ts` goes through `cachified`:

```ts
import { cachified, cache } from '#app/utils/cache.server.ts'

return cachified({
	key: 'articles:populated-categories',
	cache,
	timings,
	ttl: 1000 * 60 * 5,
	staleWhileRevalidate: 1000 * 60 * 60,
	checkValue: SomeSchema.array(),
	getFreshValue: async () => sanityClient.fetch(query),
})
```

`ttl` is how long a value is served without revalidating. `staleWhileRevalidate`
is how much longer a stale value may still be served while a fresh one is
fetched in the background — so readers wait for Sanity only when a value is
older than `ttl + staleWhileRevalidate`.

`checkValue` validates what comes back before it is cached, which matters here
because the shape is coming from a CMS rather than from typed application code.

Passing `timings` records the lookup as a Server-Timing entry — see
[Server Timing](./server-timing.md).

## Inspecting it

`getAllCacheKeys` and `searchCacheKeys` are exported for debugging. There is no
admin dashboard for the cache; the isolate-local lifetime makes one of limited
use.

## In tests

Tests run against a mocked cache server rather than the live LRU, so one test's
cache state cannot leak into another's. See
[decision 047](./decisions/047-mock-cache-server-in-tests.md).
