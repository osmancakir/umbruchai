# Monitoring

Errors, performance and session replay go to [Sentry](https://sentry.io/). It is
optional — without `SENTRY_DSN` the app runs normally and simply reports nothing.

## Where it is wired

| Layer  | File                             | What it does                                          |
| ------ | -------------------------------- | ----------------------------------------------------- |
| Worker | `workers/app.ts`                 | `Sentry.withSentry` wraps the handler                 |
| Client | `app/utils/monitoring.client.tsx` | `Sentry.init` with browser tracing and replay         |
| Build  | `vite.config.ts`                 | `sentryReactRouter` uploads source maps and releases  |

Traces are sampled at 1.0 in production and 0 elsewhere, set from `MODE` in
`workers/app.ts`. On the client, replays run at 0.1 for ordinary sessions and 1.0
for sessions that hit an error.

Noisy or uninteresting events are dropped before they are sent — see
`app/utils/sentry-event-filters.ts`.

## Runtime setup

Create a project in Sentry, take the DSN, and set it as a Worker secret:

```sh
wrangler secret put SENTRY_DSN
```

For local development put it in `.env` instead. `SENTRY_DSN` is declared optional
in `app/utils/env.server.ts`; make it required there if you want a missing DSN to
be a startup failure.

## Build-time setup, for source maps

Uploading source maps needs three more values at **build** time only —
`SENTRY_AUTH_TOKEN`, `SENTRY_ORG` and `SENTRY_PROJECT`. They are read by the
Vite plugin, never at runtime, so they do not belong in `env.server.ts` or in
Worker secrets.

Generate the token as an internal integration in Sentry with the `Releases:Admin`
and `Organization:Read` scopes. Then either export the three variables in the
shell you run `npm run deploy` from, or set them wherever the build runs.

Without them the app still reports errors; the stack traces just point at bundled
output instead of source. See [decision 034](./decisions/034-source-maps.md).
