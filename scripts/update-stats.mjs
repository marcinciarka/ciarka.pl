// Refreshes public/stats.json from the GitHub API.
// Run by .github/workflows/stats.yml on a schedule; commits only when values change.
// Usage: GITHUB_TOKEN=... node scripts/update-stats.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const AUTHOR = "marcinciarka";
const STATS_PATH = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "public",
  "stats.json",
);

// Years-in-DeFi moves rarely and needs deep history analysis, so it stays a
// curated baseline; commits/PRs are fetched live.
const BASELINE = { defiYears: 4 };

// Commits before 2022 are a handful of throwaway repos; counting them inflates
// the number without representing real work. Recorded into stats.json as
// `sinceYear` so the never-regress floor below can tell a deliberate narrowing
// apart from an API outage.
const SINCE_YEAR = 2022;
const SINCE = `${SINCE_YEAR}-01-01`;

// The Actions-issued GITHUB_TOKEN is scoped to this repo only, so search
// results exclude every other repo the author contributes to and undercount
// badly. STATS_TOKEN (a user PAT with repo + read:user) sees the real history.
const TOKEN = process.env.STATS_TOKEN || process.env.GITHUB_TOKEN;

async function ghSearchCount(url) {
  const res = await fetch(url, {
    headers: {
      Accept: "application/vnd.github+json",
      ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}),
    },
  });
  if (!res.ok) throw new Error(`GitHub API ${res.status} for ${url}`);
  const json = await res.json();
  if (typeof json.total_count !== "number")
    throw new Error(`No total_count in response for ${url}`);
  return json.total_count;
}

// encodeURIComponent, not a raw template: the date qualifiers contain `>` and
// `=`, which have no business going unencoded in a query string. Terms are
// separated by spaces here rather than `+` — encodeURIComponent renders them as
// %20, which the search API accepts.
function searchUrl(path, q) {
  return `https://api.github.com/search/${path}?q=${encodeURIComponent(q)}&per_page=1`;
}

export async function fetchStats() {
  const [commits, pullRequests] = await Promise.all([
    // author-date, not committer-date: a rebase or cherry-pick rewrites the
    // committer date and would drag pre-2022 work back into range.
    ghSearchCount(
      searchUrl("commits", `author:${AUTHOR} author-date:>=${SINCE}`),
    ),
    // The PR query is bounded too, not just commits: the caption sits under
    // both numbers, so a range claim has to be true of both or it is a lie
    // about the PR count.
    ghSearchCount(
      searchUrl("issues", `author:${AUTHOR} type:pr created:>=${SINCE}`),
    ),
  ]);
  return { commits, pullRequests, sinceYear: SINCE_YEAR, ...BASELINE };
}

export function statsChanged(prev, next) {
  return ["commits", "pullRequests", "defiYears", "sinceYear"].some(
    (k) => prev[k] !== next[k],
  );
}

// The API can undercount during outages/reindexing, so fetched values are
// floored by what is already published - never regress the numbers.
//
// Unless the range itself moved. A narrower window legitimately returns *fewer*
// commits, and flooring that would pin the counters to the old wide-window
// number forever, while statsChanged reported nothing to write. prev.sinceYear
// is absent on the first run after a range change, which is precisely the
// signal to let the drop through.
export function applyFloor(prev, fetched) {
  const rangeChanged = prev.sinceYear !== fetched.sinceYear;
  return {
    commits: rangeChanged
      ? fetched.commits
      : Math.max(fetched.commits, prev.commits),
    pullRequests: rangeChanged
      ? fetched.pullRequests
      : Math.max(fetched.pullRequests, prev.pullRequests),
    sinceYear: fetched.sinceYear,
    defiYears: fetched.defiYears,
  };
}

async function main() {
  const prev = JSON.parse(readFileSync(STATS_PATH, "utf8"));
  const fetched = await fetchStats();

  const next = applyFloor(prev, fetched);
  console.log("fetched:", fetched, "-> after floor:", next);

  if (!statsChanged(prev, next)) {
    console.log("stats unchanged, skipping write");
    return;
  }
  writeFileSync(
    STATS_PATH,
    JSON.stringify({ ...next, updatedAt: new Date().toISOString() }, null, 2) +
      "\n",
  );
  console.log("stats updated:", next);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
