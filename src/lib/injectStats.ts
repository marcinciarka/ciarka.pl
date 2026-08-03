// index.html carries __COMMITS__ / __PRS__ placeholders instead of literal
// numbers, so the meta description can never drift out of sync with the
// counters the page renders from public/stats.json. Substituted at build time
// by the injectStats Vite plugin in vite.config.ts.
export type MetaStats = { commits: number; pullRequests: number };

const TOKENS = {
  __COMMITS__: (s: MetaStats) => s.commits,
  __PRS__: (s: MetaStats) => s.pullRequests,
} as const;

export function injectStatsMeta(html: string, stats: MetaStats): string {
  let out = html;
  for (const [token, pick] of Object.entries(TOKENS)) {
    if (!out.includes(token)) {
      throw new Error(
        `injectStatsMeta: ${token} not found in index.html - the meta description would ship without live stats`,
      );
    }
    out = out.replaceAll(token, pick(stats).toLocaleString("en-US"));
  }
  return out;
}
