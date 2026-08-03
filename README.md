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

## Deploy

Pushes to `main` build and deploy to GitHub Pages (`.github/workflows/deploy.yml`).
Custom domain via `public/CNAME` → ciarka.pl.
