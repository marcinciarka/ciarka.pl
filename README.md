# ciarka.pl

Personal site of Marcin Ciarka - Senior Web3 Full-Stack Engineer.
Vite + React + TypeScript + Tailwind CSS v4, with a hand-rolled WebGL aurora shader.

## Develop

```bash
npm install
npm run dev        # dev server
npm run build      # tsc + vite build → dist/
npm test           # vitest (lib + scripts)
npm run preview    # serve the production build
npm run og         # re-render public/og.png from scripts/og-card.html
npm run aurora:still  # re-render public/aurora-still.webp from the shader
```

## Live stats

`public/stats.json` is the single source of truth for the hero counters -
baked into the bundle at build time and re-fetched client-side.
`.github/workflows/stats.yml` refreshes it from the GitHub API every 15 minutes,
commits only when values change, and triggers a Pages redeploy.

## Share card

`public/og.png` is rendered from `scripts/og-card.html` by `npm run og`
(headless Chrome, exactly 1200×630). It carries no commit counts and no
client names - only copy that changes when `identity` in `src/content.ts`
changes. Live numbers reach the link preview through `og:description`,
which vite injects from `stats.json` on every build.

After editing `identity`, run `npm run og`. `scripts/og-card.test.mjs`
asserts the card still matches `content.ts` verbatim and carries nothing
that can go stale, and CI runs the tests before every deploy.

## Aurora still

The first Live Demos card previews the on-chain aurora with a still frame
rather than a screen recording. `scripts/aurora-still.html` imports the real
shader from `src/lib/aurora.ts` - no second copy of the GLSL - and draws one
frame at a fixed seed and a fixed `uTime`, so `npm run aurora:still` is
deterministic: same seed, byte-identical WebP. It spawns the dev server
(needed to resolve the TS imports), renders headlessly, and writes
`public/aurora-still.webp`.

Pass a seed to try another sky, and an output path to compare candidates
without overwriting the asset:

```bash
npm run aurora:still -- 3141592 /tmp/candidate.webp
```

## Crawlers and LLM readers

The app renders entirely on the client, so the shipped HTML would otherwise be
an empty `<div id="root">` - invisible to anything that does not execute
JavaScript, which includes most LLM fetchers doing a plain HTTP GET. Google
runs JS and sees the real app; those fetchers do not.

`src/lib/crawlerContent.ts` derives all of it from `src/content.ts`, so there is
no second copy of the copy to keep in sync:

- **`<div id="root">` fallback** - real, visible content (bio, work, projects,
  contact), styled by an inline `<style>` in `index.html` because `index.css`
  only arrives with the JS bundle. React replaces it on mount. Deliberately not
  hidden and not in `<noscript>`: cloaked blocks are a ranking risk, and
  HTML-to-text pipelines routinely strip `noscript` - which is the exact
  audience this exists for.
- **`schema.org/Person` JSON-LD** - the one part of the page LLM-backed search
  parses rather than guesses at.
- **`/llms.txt`** - the whole portfolio as Markdown, per the Answer.AI
  convention. One page, so the copy is inline rather than linking out to
  per-page Markdown that does not exist.
- **`/robots.txt`** - allow-all, plus an explicit `Allow` per named AI crawler.
  `User-agent: *` already covers them; the explicit entries remove any question
  of intent, since silence gets read conservatively.
- **`/sitemap.xml`** - `lastmod` comes from `stats.json`'s `updatedAt` rather
  than the clock, so a rebuild with no content change is byte-identical.

The three text files are emitted by the `crawlerFiles` Vite plugin (build and
dev alike) instead of being committed to `public/`, for the same reason the meta
description carries `__COMMITS__` placeholders: a checked-in copy is a second
place to forget. `index.html` carries `__STATIC_CONTENT__` and
`__PERSON_JSONLD__` tokens, and `injectCrawlerContent` throws when either is
missing - the empty-root page cannot come back unnoticed.

## Deploy

Pushes to `main` build and deploy to GitHub Pages (`.github/workflows/deploy.yml`).
Custom domain via `public/CNAME` → ciarka.pl.
