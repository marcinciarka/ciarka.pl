import { useState } from "react";
import { work, type WorkEntry } from "../content";

function WorkItem({
  entry,
  defaultOpen,
}: {
  entry: WorkEntry;
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const detailsId = `work-details-${entry.company.replace(/\s+/g, "-").toLowerCase()}`;

  return (
    <li className="relative pl-8">
      <span
        aria-hidden="true"
        className="absolute left-0 top-2 h-2.5 w-2.5 rounded-full bg-ember"
      />
      <div className="glass rounded-2xl p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="font-display text-xl font-medium tracking-tight text-text">
            {entry.company}
          </h3>
          <span className="font-mono text-xs text-muted">{entry.period}</span>
        </div>
        <p className="mt-1 text-sm text-ember">{entry.role}</p>
        <p className="mt-3 text-muted">{entry.summary}</p>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={detailsId}
          onClick={() => setOpen((v) => !v)}
          className="mt-4 text-sm font-medium text-ember transition-opacity hover:opacity-80"
        >
          {open ? "Show less −" : "Show details +"}
        </button>
        {open && (
          <ul
            id={detailsId}
            className="mt-4 space-y-2 border-t border-glass-border pt-4"
          >
            {entry.details.map((d) => (
              <li key={d} className="flex gap-2 text-sm text-text/90">
                <span aria-hidden="true" className="mt-1 text-ember">
                  ▸
                </span>
                <span>{d}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </li>
  );
}

export function Work() {
  return (
    <section
      id="work"
      aria-labelledby="work-heading"
      className="mx-auto max-w-6xl px-6 py-16 sm:py-20"
    >
      <h2
        id="work-heading"
        className="font-display text-[clamp(1.75rem,3.5vw,2.75rem)] font-medium tracking-tight text-text"
      >
        Ten years of shipping
      </h2>
      <ol className="mt-16 space-y-6 border-l border-glass-border">
        {work.map((entry, i) => (
          <WorkItem key={entry.company} entry={entry} defaultOpen={i < 2} />
        ))}
      </ol>
    </section>
  );
}
