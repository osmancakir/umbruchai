# Image Optimization

Umbruch AI uses [openimg](https://github.com/andrelandgraf/openimg) on the
client to request optimized images on demand, introduced via
[this decision doc](./decisions/041-image-optimization.md). The server half of
that story changed when we moved to Cloudflare Workers — see
[Deployment](./deployment.md).

## Server Part

The [/resources/images](../app/routes/resources/images.tsx) endpoint accepts the
search parameters `src`, `w` (width), `h` (height), `format`, and `fit` to
perform image transformations and serve optimized variants.

Transformations are performed by **Cloudflare Images** at the edge, via the
`cf.image` options on a `fetch()` call, rather than by `sharp` in process —
`sharp` is a native binary and cannot run on Workers. Results are cached by
Cloudflare's CDN and via HTTP caching; there is no filesystem cache.

This has one operational consequence worth knowing: **resizing only takes effect
when Cloudflare Images is enabled on the zone and the site is served from a
custom domain.** On `*.workers.dev` the `cf.image` options are ignored and the
original image is returned unchanged. That's a graceful degradation rather than
an error, so there's deliberately no fallback path in the route.

## Client Part

On the client side, the `Img` React component from openimg/react is used to
query the [/resources/images](../app/routes/resources/images.tsx) endpoint with
the appropriate query parameters, including the source image string. The
component renders a picture element that requests modern formats and sets
attributes such as `fetchpriority`, `loading`, and `decoding` to optimize image
loading. It also computes `srcset` and `sizes` based on the provided `width` and
`height` props. Use the `isAboveFold` prop on the `Img` component to priotize
images that should load immediately.

## Image Sources

If you want to add a new image storage location, add its origin to
`EXTRA_ALLOWED_ORIGINS` in the
[/resources/images](../app/routes/resources/images.tsx) endpoint. Anything not
on the allowlist is rejected with a 403, which keeps the endpoint from being
used as an open image proxy.

Relative sources (the `public` folder and Vite-managed `/assets`) resolve
against our own origin and are fetched back through the edge, so they need no
special handling.
