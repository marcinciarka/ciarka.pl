import { useStats } from "../hooks/useStats";
import { useCountUp } from "../hooks/useCountUp";
import { useReducedMotion } from "../hooks/useReducedMotion";
import { relativeTime } from "../lib/relativeTime";

const STALE_AFTER_MS = 14 * 24 * 60 * 60 * 1000;

const FIELDS: {
  key: "commits" | "pullRequests" | "defiYears" | "protocols";
  label: string;
  suffix?: string;
}[] = [
  { key: "commits", label: "commits" },
  { key: "pullRequests", label: "pull requests" },
  { key: "defiYears", label: "yrs production DeFi", suffix: "+" },
  { key: "protocols", label: "protocols" },
];

function StatCounter({
  value,
  label,
  suffix,
  skip,
}: {
  value: number;
  label: string;
  suffix?: string;
  skip: boolean;
}) {
  const animated = useCountUp(value, skip);
  return (
    <div className="min-w-[6rem]">
      <div className="tabular font-mono text-2xl font-medium text-text sm:text-3xl">
        {animated.toLocaleString("en-US")}
        {suffix}
      </div>
      <div className="mt-1 text-xs uppercase tracking-wide text-muted">
        {label}
      </div>
    </div>
  );
}

export function Stats() {
  const stats = useStats();
  const reducedMotion = useReducedMotion();

  const isStale =
    Date.now() - new Date(stats.updatedAt).getTime() > STALE_AFTER_MS;

  return (
    <div>
      <div className="grid grid-cols-2 gap-6 sm:flex sm:flex-wrap sm:gap-10">
        {FIELDS.map((f) => (
          <StatCounter
            key={f.key}
            value={stats[f.key]}
            label={f.label}
            suffix={f.suffix}
            skip={reducedMotion}
          />
        ))}
      </div>
      <p className="mt-4 font-mono text-xs text-muted">
        {isStale
          ? "from commit history, 2016–2026"
          : `live from commit history · updated ${relativeTime(stats.updatedAt)}`}
      </p>
    </div>
  );
}
