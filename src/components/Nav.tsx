import { useEffect, useRef, useState } from "react";
import { identity } from "../content";

const SECTIONS = [
  { id: "showcases", label: "Live demos" },
  { id: "work", label: "Experience" },
  { id: "protocols", label: "Protocols" },
  { id: "skills", label: "Toolbox" },
  { id: "contact", label: "Contact" },
];

export function Nav() {
  const [visible, setVisible] = useState(false);
  const navRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const onScroll = () =>
      setVisible(window.scrollY > window.innerHeight * 0.8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Hidden nav must not be reachable by keyboard/AT — `inert` isn't in the
  // React 18 HTML attribute types, so set it imperatively on the DOM node.
  useEffect(() => {
    navRef.current?.toggleAttribute("inert", !visible);
  }, [visible]);

  return (
    <nav
      ref={navRef}
      aria-label="Section navigation"
      className={`fixed inset-x-0 top-0 z-50 border-b border-glass-border bg-ink-raise/95 backdrop-blur-xl transition-all duration-300 ${
        visible ? "translate-y-0 opacity-100" : "-translate-y-full opacity-0"
      }`}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
        <a
          href="#top"
          className="font-display text-sm font-semibold tracking-tight text-text"
        >
          ciarka.pl
        </a>
        <ul className="hidden gap-6 text-sm text-muted md:flex">
          {SECTIONS.map((s) => (
            <li key={s.id}>
              <a
                href={`#${s.id}`}
                className="transition-colors hover:text-ember"
              >
                {s.label}
              </a>
            </li>
          ))}
        </ul>
        <div className="flex items-center gap-5">
          <a
            href="#contact"
            className="text-sm font-medium text-ember transition-opacity hover:opacity-80 md:hidden"
          >
            Contact
          </a>
          <a
            href={identity.github}
            target="_blank"
            rel="noreferrer"
            aria-label="GitHub profile"
            className="text-muted transition-colors hover:text-ember"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="currentColor"
              aria-hidden="true"
            >
              <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.1 3.29 9.42 7.86 10.96.57.1.78-.25.78-.55v-2.15c-3.2.7-3.87-1.37-3.87-1.37-.53-1.34-1.29-1.7-1.29-1.7-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.2 1.77 1.2 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.7 0-1.26.45-2.29 1.19-3.1-.12-.29-.52-1.46.11-3.04 0 0 .97-.31 3.18 1.18a11 11 0 0 1 5.79 0c2.2-1.49 3.17-1.18 3.17-1.18.64 1.58.24 2.75.12 3.04.74.81 1.18 1.84 1.18 3.1 0 4.43-2.69 5.4-5.26 5.69.42.36.78 1.08.78 2.18v3.23c0 .3.2.66.79.55A10.51 10.51 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5z" />
            </svg>
          </a>
        </div>
      </div>
    </nav>
  );
}
