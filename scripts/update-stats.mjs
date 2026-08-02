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

// Protocol count and years-in-DeFi move rarely and need deep history analysis,
// so they stay as curated baselines; commits/PRs are fetched live.
const BASELINE = { defiYears: 4, protocols: 10 };

async function ghSearchCount(url) {
  const res = await fetch(url, {
    headers: {
      Accept: "application/vnd.github+json",
      ...(process.env.GITHUB_TOKEN
        ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` }
        : {}),
    },
  });
  if (!res.ok) throw new Error(`GitHub API ${res.status} for ${url}`);
  const json = await res.json();
  if (typeof json.total_count !== "number")
    throw new Error(`No total_count in response for ${url}`);
  return json.total_count;
}

export async function fetchStats() {
  const [commits, pullRequests] = await Promise.all([
    ghSearchCount(
      `https://api.github.com/search/commits?q=author:${AUTHOR}&per_page=1`,
    ),
    ghSearchCount(
      `https://api.github.com/search/issues?q=author:${AUTHOR}+type:pr&per_page=1`,
    ),
  ]);
  return { commits, pullRequests, ...BASELINE };
}

export function statsChanged(prev, next) {
  return ["commits", "pullRequests", "defiYears", "protocols"].some(
    (k) => prev[k] !== next[k],
  );
}

async function main() {
  const prev = JSON.parse(readFileSync(STATS_PATH, "utf8"));
  const fetched = await fetchStats();

  // The API can undercount during outages/reindexing - never regress the numbers.
  const next = {
    commits: Math.max(fetched.commits, prev.commits),
    pullRequests: Math.max(fetched.pullRequests, prev.pullRequests),
    defiYears: fetched.defiYears,
    protocols: fetched.protocols,
  };

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
