import { useEffect, useState } from "react";
import { bakedStats } from "../content";

export type Stats = typeof bakedStats;

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
      setStats((prev) => ({
        commits: Math.max(prev.commits, live.commits),
        pullRequests: Math.max(prev.pullRequests, live.pullRequests),
        // defiYears is a curated fact, not a GitHub-derived count - it never
        // comes from stats.json, only from the baked fallback.
        defiYears: prev.defiYears,
        updatedAt: live.updatedAt,
      }));
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return stats;
}
