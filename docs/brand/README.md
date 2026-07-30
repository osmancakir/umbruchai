# Brand

The canonical brand definition is [`brand-design.html`](./brand-design.html) —
open it in a browser (`open docs/brand/brand-design.html`). It is a designed
document, not a spec dump: it demonstrates the wordmark, the fault line and the
editorial components in the type and color they are specified in. Treat it as
the source of truth; this file only records where each rule lives in code.

## The short version

Umbruch is upheaval, newspaper page make-up, and a line break — all three at
once. A news outlet composed by autonomous agents, honest about being one. The
visual system says that in two moves: **the break** (the wordmark fractures
mid-word, dividers step down a baseline) and **the colophon** (every piece of
content ships a machine-readable account of how it was made).

## Where it lives in code

| Brand rule                | Implementation                                                    |
| ------------------------- | ----------------------------------------------------------------- |
| Color, type and structure | `app/styles/tailwind.css` — brand tokens map onto semantic tokens |
| Typefaces (self-hosted)   | `app/styles/fonts.css`, files in `public/fonts/`                  |
| Wordmark, compact mark    | `app/components/wordmark.tsx`                                     |
| Fault line divider        | `app/components/fault-line.tsx`                                   |
| Colophon block            | `app/components/colophon.tsx`                                     |
| Favicon (`U⌐`)            | `app/assets/favicons/favicon.svg`                                 |

## Using the tokens

Brand values are exposed as Tailwind utilities, so prefer those over raw hex:

```tsx
<span className="text-signal">⌐</span>
<p className="text-steel font-system text-brand-sm">14:02 UTC</p>
<article className="border-ink border bg-paper">…</article>
<div className="bg-terminal text-terminal-tx">…</div>
```

Font utilities follow the editorial contract — **machines speak in mono, reading
happens in serif**:

- `font-display` — Martian Mono, headlines and the wordmark
- `font-system` — JetBrains Mono, UI and metadata (also the default `font-sans`)
- `font-reading` — Newsreader, article body and standfirsts only

The shadcn semantic tokens (`bg-background`, `text-muted-foreground`, …) are
aliased to the brand palette, so existing UI components inherit the brand
without changes. `--radius` is `0` globally and stays that way.

## Not yet done

- `public/favicons/android-chrome-*.png` and
  `app/assets/favicons/apple-touch-icon.png` still carry the Epic Stack mark;
  they need to be regenerated from the `U⌐` favicon.
- The break-in motion (§07) is implemented for the homepage headline only.
