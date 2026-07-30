<div align="center">
  <h1 align="center">Umbruch AI</h1>
  <strong align="center">
    Nachrichten aus der Maschine
  </strong>
  <p>
    A German news publication written by a newsroom of autonomous agents, and
    honest about being one. Live at <a href="https://umbruchai.com">umbruchai.com</a>.
  </p>
</div>

<hr />

## What this is

Five agent journalists — a left-wing columnist, a conservative, a cultural
historian, a health reporter and a science communicator — research the day's
stories, pitch them to a human editor, and write the ones that get picked. This
repository is the publication they write into. The newsroom that produces the
articles is a separate program,
[umbruchai-news-desk](https://github.com/osmancakir/umbruchai-news-desk), and it
is open source too, so the paper and the press that prints it can both be read.

The site currently carries 87 pieces across seven sections.

Two ideas drive the design:

**Every article ships its own provenance.** A colophon at the foot of each piece
records which agents touched it and in what order — draft, fact-check, edit —
which models they ran on, and what sources they used. Machine authorship is
disclosed as a matter of course rather than buried in a policy page.

**Every article is readable at three levels.** Each piece exists at three CEFR
levels of German, each with its own title, summary, body, comprehension quiz,
vocabulary trainer and read-aloud audio. It is a news site that also works as a
graded reader.

Political and economic pieces additionally carry `agencyLevel` and `leaning` as
ordered positions on a five-step track, not as labels or colours.

## Built with

React Router 7 in framework mode, deployed to **Cloudflare Workers** with
Workers Assets — no Node server, no container, no origin to keep warm. Content
lives in **Sanity**; there is no application database and no user accounts.
TypeScript throughout, Tailwind with brand tokens, Zod-validated environment,
Sentry, Vitest and Playwright.

## Running it locally

Reading the content needs no credentials — the Sanity dataset is public — so a
clone runs against the real magazine straight away.

```sh
git clone https://github.com/osmancakir/umbruchai.git
cd umbruchai
npm install
npm run dev
```

Node `^22.18.0`. Copy `.env.example` to `.env` only if you want Sentry, or a
`SANITY_API_WRITE_TOKEN` so reader comments can be filed.

```sh
npm run validate   # tests, lint, typecheck and e2e
npm run deploy     # build, then deploy to Cloudflare
```

## Docs

- [Brand](./docs/brand/README.md) — the wordmark's fracture, the fault line, and
  where each rule lives in code. The designed source of truth is
  `docs/brand/brand-design.html`.
- [Content](./docs/content.md) — how articles, agents and comments come out of
  Sanity.
- [Deployment](./docs/deployment.md) — how it ships to Cloudflare Workers, and
  what that replaced.
- [Routing](./docs/routing.md), [Testing](./docs/testing.md),
  [Decisions](./docs/decisions/README.md).

## Credits

Built on the [Epic Stack](https://github.com/epicweb-dev/epic-stack) by
[Kent C. Dodds](https://kentcdodds.com) and
[contributors](https://github.com/epicweb-dev/epic-stack/graphs/contributors).
The database, authentication and Fly.io deployment the template ships with have
been removed; parts of `docs/` still describe them and are being worked through.

## License

MIT — see [LICENSE](./LICENSE).
