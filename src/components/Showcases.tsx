import { showcases, type Showcase } from "../content";
import { RecordingPreview } from "./RecordingPreview";

function ShowcaseLinks({ showcase }: { showcase: Showcase }) {
  if (showcase.status === "in-progress") {
    return (
      <span className="rounded-full border border-glass-border bg-glass px-3 py-1 font-mono text-xs text-muted">
        shipping soon - repos going public
      </span>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-5">
      {showcase.status === "live" && (
        <a
          href={showcase.liveUrl}
          target="_blank"
          rel="noreferrer"
          className="font-medium text-ember transition-opacity hover:opacity-80"
        >
          Live demo →
        </a>
      )}
      {showcase.repoUrl && (
        <a
          href={showcase.repoUrl}
          target="_blank"
          rel="noreferrer"
          className={
            showcase.status === "source-only"
              ? "font-medium text-ember transition-opacity hover:opacity-80"
              : "text-muted transition-colors hover:text-text"
          }
        >
          GitHub
        </a>
      )}
      {showcase.status === "live" && showcase.npm && (
        <a
          href={showcase.npm.url}
          target="_blank"
          rel="noreferrer"
          className="rounded-full border border-glass-border bg-glass px-3 py-1 font-mono text-xs text-muted transition-colors hover:text-text"
        >
          {showcase.npm.pkg}
        </a>
      )}
    </div>
  );
}

function ShowcaseCard({
  showcase,
  reversed,
}: {
  showcase: Showcase;
  reversed: boolean;
}) {
  return (
    <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:gap-14">
      <div className={`order-2 flex-1 ${reversed ? "" : "lg:order-1"}`}>
        <h3 className="font-display text-2xl font-medium tracking-tight text-text sm:text-3xl">
          {showcase.name}
        </h3>
        <p className="mt-1 text-text/80">{showcase.tagline}</p>
        <p className="mt-4 text-muted">{showcase.description}</p>
        <ul className="mt-5 space-y-2">
          {showcase.highlights.map((h) => (
            <li key={h} className="flex gap-2 text-sm text-text/90">
              <span aria-hidden="true" className="mt-1 text-ember">
                ▸
              </span>
              <span>{h}</span>
            </li>
          ))}
        </ul>
        <div className="mt-5 flex flex-wrap gap-2">
          {showcase.tech.map((tech) => (
            <span
              key={tech}
              className="rounded-full border border-glass-border bg-glass px-3 py-1 font-mono text-xs text-muted"
            >
              {tech}
            </span>
          ))}
        </div>
        <div className="mt-6">
          <ShowcaseLinks showcase={showcase} />
        </div>
      </div>
      <div
        className={`relative order-1 flex-1 ${reversed ? "" : "lg:order-2"}`}
      >
        {showcase.recording ? (
          <RecordingPreview src={showcase.recording} title={showcase.name} />
        ) : null}
      </div>
    </div>
  );
}

export function Showcases() {
  return (
    <section
      id="showcases"
      aria-labelledby="showcases-heading"
      className="mx-auto max-w-6xl px-6 py-16 sm:py-20"
    >
      <h2
        id="showcases-heading"
        className="font-display text-[clamp(1.75rem,3.5vw,2.75rem)] font-medium tracking-tight text-text"
      >
        Side Projects
      </h2>
      <div className="mt-16 space-y-24">
        {showcases.map((showcase, i) => (
          <ShowcaseCard
            key={showcase.id}
            showcase={showcase}
            reversed={i % 2 === 1}
          />
        ))}
      </div>
    </section>
  );
}
