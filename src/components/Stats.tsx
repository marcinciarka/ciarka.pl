import { useEffect, useRef } from "react";
import { identity } from "../content";
import { useStats } from "../hooks/useStats";
import { useCountUp } from "../hooks/useCountUp";
import { useReducedMotion } from "../hooks/useReducedMotion";
import { relativeTime } from "../lib/relativeTime";

const FIELDS: {
  key: "commits" | "pullRequests" | "defiYears";
  label: string;
  suffix?: string;
}[] = [
  { key: "commits", label: "commits" },
  { key: "pullRequests", label: "pull requests" },
  { key: "defiYears", label: "yrs production DeFi", suffix: "+" },
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
    <div className="min-w-24">
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
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let rafId = 0;
    const update = () => {
      rafId = 0;
      const y = window.scrollY;
      const opacity = y <= 100 ? 1 : y >= 400 ? 0 : 1 - (y - 100) / 300;
      const el = rootRef.current;
      if (!el) return;
      el.style.opacity = String(opacity);
      el.style.pointerEvents = opacity === 0 ? "none" : "";
      el.setAttribute("aria-hidden", opacity === 0 ? "true" : "false");
    };
    const onScroll = () => {
      if (rafId) return;
      rafId = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, []);

  return (
    <div ref={rootRef}>
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
      <p className="mt-3 font-mono text-xs text-muted">
        <a
          href={identity.github}
          target="_blank"
          rel="noreferrer"
          className="underline decoration-dotted underline-offset-2 transition-colors hover:text-ember"
        >
          GitHub history 2022–{new Date().getFullYear()}, every org
        </a>
        {" · updated "}
        {relativeTime(stats.updatedAt)}
      </p>
    </div>
  );
}
