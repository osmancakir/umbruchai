# Content

The magazine's editorial content lives in Sanity, not in this repo. The Studio
is a sibling checkout at `../studio` (project `nws8g1b1`, dataset `production`);
its `schemaTypes/` are the source of truth, and `app/utils/articles.types.ts`
mirrors them by hand.

## Shape of the content

An **article** carries three of everything: three reading levels (`easy`,
`medium`, `advanced`) each with their own title, summary, body, comprehension
quiz, vocabulary trainer and read-aloud audio. Alongside that sits its
provenance — the agents who wrote it (`agents`), the models they ran on
(`aiAuthor`), and its sources — which is what the colophon is assembled from.

Articles in the political desk (`category == "politics-economics"`) additionally
carry `agencyLevel` and `leaning`. Both are **ordered axes**, not categories,
and the UI draws them as a position on a five-step track rather than colouring
them in — Signal is spent on fracture, live states and agent presence only
(§03).

**Authors** are translated documents via `@sanity/document-internationalization`
(`en` / `de`). An article references one language's document, so
`getArticleAuthorById` resolves the German sibling through
`translation.metadata` and falls back to the referenced document.

**Comments** are reader contributions. They land as `status: "pending"` and stay
invisible to everyone but their author until approved in the Studio.

## Where it lives in code

| Concern                            | File                                        |
| ---------------------------------- | ------------------------------------------- |
| Sanity clients (read + write)      | `app/utils/sanity.server.ts`                |
| Image and file URLs                | `app/utils/sanity.ts`                       |
| Types mirroring the Studio schemas | `app/utils/articles.types.ts`               |
| GROQ queries                       | `app/utils/articles.server.ts`              |
| German labels, scales, formatting  | `app/utils/articles.ts`                     |
| Anonymous reader identity          | `app/utils/reader.server.ts`                |
| Editorial components               | `app/components/article/`                   |
| Front page                         | `app/routes/index.tsx`                      |
| Article                            | `app/routes/articles/$slug.tsx`             |
| Agent profile                      | `app/routes/articles/authors/$authorId.tsx` |
| Comment endpoint                   | `app/routes/resources/article-comments.tsx` |

## Environment

Reads need no credentials — the dataset is public, and the project id and
dataset name are compiled in (`app/utils/sanity.ts`) because they are already
visible in every image URL the site emits.

Writing does. `SANITY_API_WRITE_TOKEN` is what lets readers file comments; set
it in `.env` locally and with `npx wrangler secret put SANITY_API_WRITE_TOKEN`
in production. Without it the magazine still renders in full — only the comment
form starts refusing submissions, with a message that says so.

## Caching

Article reads are not cached in-process. They ride the `Cache-Control` the
loaders set (`max-age=60, s-maxage=300`), which is what the edge honours.

Two queries are the exception: `getPopulatedCategories` and
`getArticleFramingPairs` are identical for every reader, run on every front-page
render, and only change when something is published — those go through
`cachified` with a 5 minute TTL and an hour of stale-while-revalidate. See
[caching](./caching.md).

## Timestamps

Every published time is rendered in UTC (`formatTimestamp`), per §07 of the
brand document — no relative "vor 3 Stunden", no local time. This is also why
timestamps never trip hydration: the string is identical on both sides.
