# SEO

React Router sets `meta` tags per route through the
[`meta` export](https://reactrouter.com/start/framework/route-module#meta).

`/robots.txt` and `/sitemap.xml` are resource routes in `app/routes/_seo/`, built
with [`@nasa-gcn/remix-seo`](https://github.com/nasa-gcn/remix-seo). The sitemap
route walks the route manifest, which is why `workers/app.ts` passes
`serverBuild` through the load context.

## Dynamic routes

Every route is in the sitemap by default, but `generateSitemap` cannot guess the
slugs behind a dynamic segment. Routes with dynamic children enumerate them
through a `getSitemapEntries` handle — the archive is the site here, so this is
what makes the articles discoverable at all:

```tsx
// app/routes/articles/$slug.tsx
export const handle: SEOHandle = {
	getSitemapEntries: serverOnly$(async () => {
		const articles = await getArticleSitemapEntries()
		return articles.map((article) => ({
			route: `/articles/${article.slug}`,
			lastmod: article.date,
			changefreq: 'monthly' as const,
			priority: 0.8 as const,
		}))
	}),
}
```

`handle` is a shared export, so React Router does not strip server code from it
the way it does for `loader`.
[`serverOnly$`](https://github.com/pcattori/vite-env-only) does that job instead,
keeping the Sanity client out of the browser bundle. It is preconfigured in
`vite.config.ts`.

`app/routes/articles/authors/$authorId.tsx` does the same for author pages.

## Excluding a route

Return `null` to keep a page out of the sitemap:

```tsx
export const handle: SEOHandle = {
	getSitemapEntries: () => null,
}
```

`app/routes/presentation-referat.tsx` uses this.

## Indexing

`workers/app.ts` sets `X-Robots-Tag: noindex, nofollow` when `ALLOW_INDEXING` is
`false`, and always for hosts ending in `.workers.dev`, so versioned preview
deploys never compete with the canonical domain.
