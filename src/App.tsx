import { identity } from "./content";
import { AuroraHero } from "./components/AuroraHero";
import { Nav } from "./components/Nav";
import { Stats } from "./components/Stats";
import { Showcases } from "./components/Showcases";
import { Work } from "./components/Work";
import { ProtocolMatrix } from "./components/ProtocolMatrix";
import { Skills } from "./components/Skills";
import { Contact, Footer } from "./components/Contact";
import { SkyControls } from "./components/SkyControls";

export default function App() {
  return (
    <>
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <AuroraHero />
      <SkyControls />
      <Nav />
      <header
        id="top"
        className="relative flex min-h-svh flex-col justify-between px-6 py-8 sm:px-10"
      >
        <span />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 left-0 z-[-1] w-full max-w-3xl bg-[radial-gradient(ellipse_95%_100%_at_0%_50%,rgba(3,6,12,0.75),rgba(3,6,12,0.5)_60%,transparent_85%)] mask-[linear-gradient(to_bottom,black_55%,transparent_96%)] sm:max-w-4xl"
        />
        <div className="relative max-w-3xl">
          <p className="mb-3 font-mono text-sm text-muted [text-shadow:0_1px_12px_rgba(3,6,12,0.85)]">
            {identity.greeting}
          </p>
          <h1 className="font-display text-[clamp(3rem,8vw,6.5rem)] font-semibold leading-[0.95] tracking-tight text-text">
            {identity.name}
          </h1>
          <p className="mt-4 inline-block text-xl font-medium text-text sm:text-2xl">
            {identity.role}
            <svg
              aria-hidden="true"
              viewBox="0 0 240 8"
              preserveAspectRatio="none"
              className="mt-1 block h-2 w-full text-ember"
            >
              <path
                d="M2 5.5 C 30 2.5, 55 7, 85 4.5 S 140 2, 170 5 S 220 3.5, 238 4.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                opacity="0.85"
              />
            </svg>
          </p>
          <p className="mt-6 max-w-xl text-base text-text/90 [text-shadow:0_1px_12px_rgba(3,6,12,0.85)] sm:text-lg">
            {identity.pitch}
          </p>
          <p className="mt-4 font-mono text-sm text-text/80 [text-shadow:0_1px_12px_rgba(3,6,12,0.85)]">
            {identity.location}
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <a
              href={`mailto:${identity.email}`}
              className="rounded-full bg-ember px-5 py-2.5 text-sm font-medium text-ink transition-opacity hover:opacity-90"
            >
              Email me
            </a>
            <a
              href={identity.github}
              target="_blank"
              rel="noreferrer"
              className="rounded-full border border-glass-border bg-glass px-5 py-2.5 text-sm font-medium text-text transition-colors hover:border-ember/60"
            >
              GitHub
            </a>
            {identity.linkedin && (
              <a
                href={identity.linkedin}
                target="_blank"
                rel="noreferrer"
                className="rounded-full border border-glass-border bg-glass px-5 py-2.5 text-sm font-medium text-text transition-colors hover:border-ember/60"
              >
                LinkedIn
              </a>
            )}
            {identity.cvUrl && (
              <a
                href={identity.cvUrl}
                target="_blank"
                rel="noreferrer"
                className="rounded-full border border-glass-border bg-glass px-5 py-2.5 text-sm font-medium text-text transition-colors hover:border-ember/60"
              >
                Download CV
              </a>
            )}
          </div>
        </div>
        <div className="pb-4">
          <Stats />
        </div>
      </header>
      <main id="main" className="relative">
        <Work />
        <Showcases />
        <ProtocolMatrix />
        <Skills />
        <Contact />
      </main>
      <Footer />
    </>
  );
}
