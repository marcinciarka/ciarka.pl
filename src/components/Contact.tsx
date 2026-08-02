import { identity } from "../content";

export function Contact() {
  return (
    <section
      id="contact"
      aria-labelledby="contact-heading"
      className="mx-auto max-w-6xl px-6 py-16 sm:py-20"
    >
      <div className="lg:grid lg:grid-cols-2 lg:items-center lg:gap-14">
        <div>
          <h2
            id="contact-heading"
            className="font-display text-[clamp(1.75rem,3.5vw,2.75rem)] font-medium tracking-tight text-text"
          >
            Let&rsquo;s build something.
          </h2>
          <p className="mt-4 max-w-md text-muted">{identity.contactNote}</p>
          <p className="mt-6 font-mono text-sm text-muted">
            {identity.availability}
          </p>
          <p className="mt-2 font-mono text-sm text-muted">
            {identity.location}
          </p>
        </div>
        <div className="mt-8 flex flex-col flex-wrap gap-4 sm:flex-row sm:items-center sm:gap-6 lg:mt-0 lg:justify-end">
          <a
            href={`mailto:${identity.email}`}
            className="rounded-full bg-ember px-5 py-2.5 text-sm font-medium text-ink transition-opacity hover:opacity-90"
          >
            {identity.email}
          </a>
          <a
            href={identity.github}
            target="_blank"
            rel="noreferrer"
            className="text-lg text-text transition-colors hover:text-ember"
          >
            github.com/{identity.githubHandle}
          </a>
          {identity.linkedin && (
            <a
              href={identity.linkedin}
              target="_blank"
              rel="noreferrer"
              className="text-lg text-text transition-colors hover:text-ember"
            >
              LinkedIn
            </a>
          )}
          {identity.cvUrl && (
            <a
              href={identity.cvUrl}
              target="_blank"
              rel="noreferrer"
              className="text-lg text-text transition-colors hover:text-ember"
            >
              Download CV
            </a>
          )}
        </div>
      </div>
    </section>
  );
}

export function Footer() {
  return (
    <footer className="mx-auto max-w-6xl px-6 pb-12 pt-6">
      <p className="text-xs text-muted">
        hand-built with Vite, React and one hand-rolled WebGL shader — no
        template, no UI kit · numbers straight from commit history, 2016–2026
      </p>
    </footer>
  );
}
