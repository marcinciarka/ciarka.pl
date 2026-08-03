import { work, workHeading, type WorkEntry } from "../content";
import { useStats } from "../hooks/useStats";

function WorkItem({ entry }: { entry: WorkEntry }) {
  const detailsId = `work-details-${entry.company.replace(/\s+/g, "-").toLowerCase()}`;

  return (
    <li className="relative pl-8">
      <span
        aria-hidden="true"
        className="absolute -left-1.25 top-2 h-2.5 w-2.5 rounded-full bg-ember"
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
        <ul
          id={detailsId}
          className="mt-4 space-y-2 border-t border-glass-border pt-4"
        >
          {entry.details.map((d) => (
            <li
              key={d.lead}
              className="flex gap-2 items-center text-sm text-text/90"
            >
              <span aria-hidden="true" className="my-1 text-ember">
                ▸
              </span>
              <span>
                <strong className="font-medium text-text">{d.lead}</strong>{" "}
                {d.text}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </li>
  );
}

export function Work() {
  const stats = useStats();

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
        {workHeading}
      </h2>
      <p className="mt-3 font-mono text-sm text-muted">
        {stats.commits.toLocaleString("en-US")} commits ·{" "}
        {stats.pullRequests.toLocaleString("en-US")} pull requests
      </p>
      <ol className="mt-10 space-y-6 border-l border-glass-border">
        {work.map((entry) => (
          <WorkItem key={entry.company} entry={entry} />
        ))}
      </ol>
    </section>
  );
}
