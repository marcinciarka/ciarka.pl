import { useState } from "react";
import { protocolMatrix, protocolMatrixFootnote } from "../content";

const maxActivity = Math.max(...protocolMatrix.map((p) => p.activity));
const scale = (n: number) => Math.sqrt(n) / Math.sqrt(maxActivity);

export function ProtocolMatrix() {
  const [active, setActive] = useState<string | null>(null);

  return (
    <section
      id="protocols"
      aria-labelledby="protocols-heading"
      className="mx-auto max-w-6xl px-6 py-16 sm:py-20"
    >
      <h2
        id="protocols-heading"
        className="font-display text-[clamp(1.75rem,3.5vw,2.75rem)] font-medium tracking-tight text-text"
      >
        Protocol footprint
      </h2>
      <p className="mt-3 text-sm text-muted">
        activity = commits + pull requests · bar length √-scaled to keep small
        footprints legible
      </p>
      <div className="mt-16 space-y-4">
        {protocolMatrix.map((p) => {
          const isActive = active === p.name;
          const noteId = `protocol-note-${p.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}`;
          return (
            <div
              key={p.name}
              className="group relative"
              onMouseEnter={() => setActive(p.name)}
              onMouseLeave={() =>
                setActive((cur) => (cur === p.name ? null : cur))
              }
            >
              <button
                type="button"
                aria-expanded={isActive}
                aria-controls={noteId}
                aria-label={`${p.name} — ${p.activity.toLocaleString("en-US")} commits and PRs since ${p.since}`}
                onClick={() =>
                  setActive((cur) => (cur === p.name ? null : p.name))
                }
                className="w-full text-left"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-display text-sm font-medium text-text sm:text-base">
                    {p.name}
                  </span>
                  <span className="font-mono text-xs text-muted">
                    since {p.since} · {p.activity.toLocaleString("en-US")}{" "}
                    commits + PRs
                  </span>
                </div>
                <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-glass">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.max(4, scale(p.activity) * 100)}%`,
                      background:
                        "linear-gradient(90deg, var(--color-aurora-1), var(--color-aurora-2))",
                    }}
                  />
                </div>
              </button>
              {isActive ? (
                <p
                  id={noteId}
                  className="mt-2 text-sm text-muted transition-all duration-200"
                >
                  {p.note}
                </p>
              ) : (
                <p
                  id={noteId}
                  aria-hidden="true"
                  className="mt-2 hidden text-sm text-muted"
                >
                  {p.note}
                </p>
              )}
            </div>
          );
        })}
      </div>
      <p className="mt-8 text-sm text-muted">{protocolMatrixFootnote}</p>
    </section>
  );
}
