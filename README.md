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

## Deploy

Pushes to `main` build and deploy to GitHub Pages (`.github/workflows/deploy.yml`).
Custom domain via `public/CNAME` → ciarka.pl.
