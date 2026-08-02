# ciarka.pl

Personal site of Marcin Ciarka - Senior Web3 Full-Stack Engineer.
Vite + React + TypeScript + Tailwind CSS v4, with a hand-rolled WebGL aurora shader.

## Develop

```bash
npm install
npm run dev        # dev server
npm run build      # tsc + vite build → dist/
npm test           # vitest (stats script)
npm run preview    # serve the production build
```

## Live stats

`public/stats.json` is the single source of truth for the hero counters -
baked into the bundle at build time and re-fetched client-side.
`.github/workflows/stats.yml` refreshes it from the GitHub API every 10 minutes,
commits only when values change, and triggers a Pages redeploy.

## Deploy

Pushes to `main` build and deploy to GitHub Pages (`.github/workflows/deploy.yml`).
Custom domain via `public/CNAME` → ciarka.pl.

## Before going live - open TODOs

Search `TODO(marcin)` in `src/content.ts`:

- Flip showcase `status` from `'in-progress'` to `'live'` / `'source-only'`
  as the repos/demos go public (and set the real demo URLs).
- Add `linkedin` and `cvUrl` (put the CV PDF in `public/`).
- Confirm the pre-2022 Maker/Oasis timeline if you want to claim it.
- Enable GitHub Pages (Settings → Pages → GitHub Actions) and point
  ciarka.pl DNS at Pages.
