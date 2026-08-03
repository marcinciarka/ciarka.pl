import { useEffect, useState } from "react";
import { contactCopied, contactLinks, identity } from "../content";
import type { ContactLink } from "../content";

// 24x24 single-path glyphs, currentColor-filled so they inherit link hover.
const ICONS: Record<ContactLink["icon"], string> = {
  telegram:
    "M23.91 3.79 20.3 20.84c-.25 1.21-.98 1.5-2 .94l-5.5-4.07-2.66 2.57c-.3.3-.55.56-1.1.56-.72 0-.6-.27-.84-.95L6.3 13.7l-5.45-1.7c-1.18-.35-1.19-1.16.26-1.75l21.26-8.2c.97-.43 1.9.24 1.53 1.73z",
  discord:
    "M20.32 4.37A19.8 19.8 0 0 0 15.43 2.9a13.9 13.9 0 0 0-.62 1.28 18.3 18.3 0 0 0-5.62 0A13 13 0 0 0 8.56 2.9 19.7 19.7 0 0 0 3.67 4.37 20.3 20.3 0 0 0 .13 18.06a19.9 19.9 0 0 0 6 3.03c.49-.66.92-1.36 1.29-2.1a13 13 0 0 1-2.03-.97l.5-.39a14.2 14.2 0 0 0 12.22 0l.5.39c-.65.38-1.33.7-2.04.97.37.74.8 1.44 1.29 2.1a19.8 19.8 0 0 0 6.01-3.03 20.3 20.3 0 0 0-3.55-13.69ZM8.02 15.33c-1.18 0-2.16-1.08-2.16-2.42 0-1.33.95-2.42 2.16-2.42s2.18 1.09 2.16 2.42c0 1.34-.95 2.42-2.16 2.42Zm7.96 0c-1.18 0-2.15-1.08-2.15-2.42 0-1.33.94-2.42 2.15-2.42s2.18 1.09 2.16 2.42c0 1.34-.94 2.42-2.16 2.42Z",
  linkedin:
    "M4.98 3.5a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1 0-5ZM2.4 21.5h5.16V9.75H2.4V21.5Zm7.4-11.75h4.95v1.6h.07c.69-1.24 2.38-2.55 4.9-2.55 5.24 0 6.2 3.3 6.2 7.6v9.1h-5.15v-8.07c0-1.93-.03-4.4-2.75-4.4-2.76 0-3.18 2.09-3.18 4.26v8.21H9.8V9.75Z",
  email:
    "M2 5.5A2.5 2.5 0 0 1 4.5 3h15A2.5 2.5 0 0 1 22 5.5v13a2.5 2.5 0 0 1-2.5 2.5h-15A2.5 2.5 0 0 1 2 18.5v-13Zm2.6-.5 7.4 6.1L19.4 5H4.6ZM20 6.9l-7.36 6.06a1 1 0 0 1-1.28 0L4 6.9V19h16V6.9Z",
  github:
    "M12 .5C5.65.5.5 5.65.5 12c0 5.1 3.29 9.42 7.86 10.96.57.1.78-.25.78-.55v-2.15c-3.2.7-3.87-1.37-3.87-1.37-.53-1.34-1.29-1.7-1.29-1.7-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.2 1.77 1.2 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.7 0-1.26.45-2.29 1.19-3.1-.12-.29-.52-1.46.11-3.04 0 0 .97-.31 3.18 1.18a11 11 0 0 1 5.79 0c2.2-1.49 3.17-1.18 3.17-1.18.64 1.58.24 2.75.12 3.04.74.81 1.18 1.84 1.18 3.1 0 4.43-2.69 5.4-5.26 5.69.42.36.78 1.08.78 2.18v3.23c0 .3.2.66.79.55A10.51 10.51 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5z",
};

function Icon({ name }: { name: ContactLink["icon"] }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className="shrink-0"
    >
      <path d={ICONS[name]} />
    </svg>
  );
}

const ROW =
  "group flex items-center gap-3 rounded-full border border-glass-border bg-glass px-4 py-2.5 text-sm text-text transition-colors hover:border-ember/60 hover:text-ember";

function ContactRow({ link }: { link: ContactLink }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1600);
    return () => clearTimeout(t);
  }, [copied]);

  const body = (
    <>
      <Icon name={link.icon} />
      <span className="font-mono text-muted transition-colors group-hover:text-ember">
        {link.label}
      </span>
      <span className="ml-auto">{copied ? contactCopied : link.value}</span>
    </>
  );

  // Discord exposes no per-username profile URL, so that row copies the handle.
  if (!link.href) {
    return (
      <button
        type="button"
        aria-label={`Copy ${link.label} handle ${link.value}`}
        onClick={() => {
          navigator.clipboard?.writeText(link.copy ?? link.value);
          setCopied(true);
        }}
        className={`${ROW} w-full text-left`}
      >
        {body}
      </button>
    );
  }

  // mailto: hands off to the mail client - a _blank target there just leaves
  // an empty tab behind, so only real URLs open in a new page.
  const external = !link.href.startsWith("mailto:");

  return (
    <a
      href={link.href}
      target={external ? "_blank" : undefined}
      rel={external ? "noreferrer" : undefined}
      aria-label={`${link.label}: ${link.value}`}
      className={ROW}
    >
      {body}
    </a>
  );
}

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
        <div className="mt-8 flex w-full flex-col gap-2 lg:mt-0 lg:ml-auto lg:max-w-sm">
          {contactLinks.map((link) => (
            <ContactRow key={link.icon} link={link} />
          ))}
          {identity.cvUrl && (
            <a
              href={identity.cvUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-2 rounded-full bg-ember px-4 py-2.5 text-center text-sm font-medium text-ink transition-opacity hover:opacity-90"
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
        You've reached the end, thanks for stopping by!
      </p>
    </footer>
  );
}
