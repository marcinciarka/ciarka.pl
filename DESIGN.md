# ciarka.pl - Design Brief

Subject: Marcin Ciarka, Senior Web3 Full-Stack Engineer. Audience: recruiters and
engineering leads at Web3/DeFi companies. The page has one job: establish
credibility in 30 seconds and route the reader to a live demo or the contact link.
The site itself is the frontend-skill demo - it must feel hand-built, not templated.

## Direction

**Luminous dark aurora** - chosen by Marcin. Deep-space navy base with a living
aurora gradient, glass panels, ONE warm accent. Explicitly NOT: terminal/monospace
aesthetic (that's halaprix.com's lane), NOT near-black + acid-green default,
NOT cream + terracotta serif.

## Tokens

Colors (CSS custom properties, used via Tailwind theme):

- `--ink` #070B14 - page base, deep space navy
- `--ink-raise` #0D1322 - raised surfaces
- `--glass` rgba(233,238,247,0.05) - panel fill, 1px rgba(233,238,247,0.09) border
- `--aurora-1` #35E0C2 - teal (aurora hue A)
- `--aurora-2` #7C6CF6 - violet (aurora hue B)
- `--ember` #FFB454 - warm amber. The ONLY accent for CTAs, links, highlights
- `--text` #E9EEF7 / muted #96A0B5

Rule: aurora hues live in the shader, motifs, and data-viz only. Interactive
accent is always ember. Never use teal/violet for links or buttons.

Type:

- Display: **Clash Display** (Fontshare; try `@fontsource/clash-display`, else
  Fontshare CDN css) - semibold, tight tracking, for name + section headings.
- Body: **Instrument Sans** (`@fontsource/instrument-sans`) - 16–18px, 1.6 line-height.
- Data: **JetBrains Mono** (`@fontsource/jetbrains-mono`) - ONLY for numbers,
  tech chips, and the stats. Small doses.
- Scale: hero name clamp(3rem, 8vw, 6.5rem); section headings clamp(1.75rem, 3.5vw, 2.75rem).

## Signature element (the one memorable thing)

The **aurora shader hero**: a full-viewport raw-WebGL fragment shader - slow
drifting aurora curtains (teal→violet with a faint ember horizon glow) over the
deep navy. Subtle pointer parallax (aurora leans a few degrees toward the cursor,
heavily damped). Everything else on the page stays quiet and disciplined.

- Raw WebGL (no three.js). ~150 lines. Lazy-init after first paint.
- `prefers-reduced-motion` or no WebGL → static CSS gradient fallback.
- Aurora dims to ~15% intensity past the hero (scroll-linked opacity) so content sections sit on near-solid ink.

## Layout (single page, max-w ~72rem center column)

1. **Hero** (100svh): top-left small wordmark `ciarka.pl`; center-left name +
   role + 3-line pitch; bottom: three stat counters (commits / PRs / yrs
   production DeFi) in JetBrains Mono with count-up animation on load.
2. **Showcases** - heading "Proof, running live". Three full-width alternating
   feature panels (NOT a 3-card grid): left = copy (name, tagline, description,
   highlight bullets, tech chips, Live demo → ember link + GitHub link),
   right = animated motif in a glass panel. Motifs (Canvas/SVG, ~60 lines each):
   - waveform (summer-resonance): gentle animated sine stack
   - ticker (chainvibe): scrolling feed of small event rows
   - spark (summer-roast): typing/spark pulse
     Motifs pause when off-viewport (IntersectionObserver) and respect reduced motion.
3. **Work** - heading "Where the commits went" (from `workHeading` in
   content.ts; avoids the ubiquitous "N years of shipping"). Vertical timeline, each entry
   expandable (details list). Period in JetBrains Mono, company in display face.
4. **Contact** - big display-face line "Let's build something." + email
   (mailto), GitHub, availability line. Footer: "numbers from commit history,
   2022–<current year> · built with Vite + React + a hand-rolled shader".

Sticky minimal nav (wordmark + section anchors + GitHub icon) appearing after
scrolling past hero. Mobile: anchors collapse to a simple row or disappear;
no hamburger complexity.

## Quality floor

- Responsive to 360px. Test 360 / 768 / 1280 / 1920.
- Visible keyboard focus (ember outline), semantic landmarks, alt/aria on motifs
  (aria-hidden decorative), contrast ≥ 4.5:1 for body text.
- Lighthouse-minded: fonts self-hosted where possible with `font-display: swap`,
  shader lazy-init, no layout shift from stats swap (tabular-nums, fixed width).
- All copy in `src/content.ts`. Components read from it; no copy in JSX.

## File plan

- `src/main.tsx`, `src/App.tsx`, `src/index.css` (Tailwind v4 `@import "tailwindcss"` + `@theme` tokens)
- `src/components/AuroraHero.tsx` + `src/lib/aurora.ts` (shader setup)
- `src/components/{Nav,Stats,Showcases,Motif,Work,Contact}.tsx`
- `src/hooks/{useStats,useInView,useReducedMotion}.ts`
- `public/favicon.svg` - simple aurora-gradient "C" mark
