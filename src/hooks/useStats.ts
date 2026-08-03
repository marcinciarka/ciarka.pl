import { useEffect, useState } from "react";
import { bakedStats } from "../content";

// sinceYear records which year range the counts were computed under. It is
// intentionally absent from the committed stats.json — the first scheduled run
// after a range change stamps it — so it cannot be inferred from the baked
// import and is declared optional here instead.
export type Stats = typeof bakedStats & { sinceYear?: number };

async function fetchStats(): Promise<Stats | null> {
  try {
    const res = await fetch("/stats.json?url", { cache: "no-store" });
    if (!res.ok) return null;
    const data = (await res.json()) as Partial<Stats>;
    if (
      typeof data.commits !== "number" ||
      typeof data.pullRequests !== "number" ||
      typeof data.updatedAt !== "string"
    ) {
      return null;
    }
    return data as Stats;
  } catch {
    return null;
  }
}

export function useStats(): Stats {
  const [stats, setStats] = useState<Stats>(bakedStats);

  useEffect(() => {
    let cancelled = false;

    fetchStats().then((live) => {
      if (cancelled || !live) return;
      setStats((prev) => {
        // The mirror of applyFloor in scripts/update-stats.mjs. `prev` here is
        // bakedStats — the build-time copy of stats.json — so without this
        // escape the old wide-range number compiled into the deployed bundle
        // would outvote the corrected live one until the next redeploy.
        //
        // The rule is symmetric: any genuine difference between live.sinceYear
        // and prev.sinceYear — including one side having it and the other not
        // — counts as a range change and skips the floor. When both sides
        // lack sinceYear, there is no difference to detect, so the floor still
        // applies, which is correct: nothing has changed yet.
        const rangeChanged = live.sinceYear !== prev.sinceYear;
        return {
          // Spread carries defiYears through: a curated fact, not a
          // GitHub-derived count, so it never comes from stats.json.
          ...prev,
          commits: rangeChanged
            ? live.commits
            : Math.max(prev.commits, live.commits),
          pullRequests: rangeChanged
            ? live.pullRequests
            : Math.max(prev.pullRequests, live.pullRequests),
          sinceYear: live.sinceYear,
          updatedAt: live.updatedAt,
        };
      });
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return stats;
}
