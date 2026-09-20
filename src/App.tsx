import { useEffect } from "react";
import { identity } from "./content";
import { track } from "./lib/track";
import { AuroraHero } from "./components/AuroraHero";
import { Stats } from "./components/Stats";
import { Showcases } from "./components/Showcases";
import { Work } from "./components/Work";
import { Contact, Footer } from "./components/Contact";
import { SkyControls } from "./components/SkyControls";

// Umami has no scroll-depth metric, so how far down a reader gets is measured
// by which sections they actually reach - once each per visit.
//
// rootMargin rather than a threshold: these sections are taller than the
// viewport, so a ratio-based threshold would never fire on them. The band runs
// from a quarter down the screen to just short of its bottom edge, and both
// insets are load-bearing:
//
// - without the top inset, a section counts as read the moment one pixel of it
//   appears at the bottom of the screen;
// - without the bottom inset, #work counts as read on every page load - the
//   hero is exactly one viewport tall, so at scroll 0 #work's top edge touches
//   the viewport's bottom edge, and Chrome reports that zero-height contact as
//   intersecting (measured);
// - the bottom inset stays small (5%, not a symmetric 25%) because #contact is
//   short and sits against the end of the document: a deep inset can leave it
//   below the line no matter how far the reader scrolls.
const TRACKED_SECTIONS = ["work", "showcases", "contact"];

function useSectionViews() {
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          observer.unobserve(entry.target);
          track("section-view", { section: entry.target.id });
        }
      },
      { rootMargin: "-25% 0px -5% 0px", threshold: 0 },
    );

    for (const id of TRACKED_SECTIONS) {
      const section = document.getElementById(id);
      if (section) observer.observe(section);
    }
    return () => observer.disconnect();
  }, []);
}

export default function App() {
  useSectionViews();

  return (
    <>
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <AuroraHero />
      <SkyControls />
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
          <p className="mt-2 font-mono text-sm text-ember [text-shadow:0_1px_12px_rgba(3,6,12,0.85)]">
            {identity.availability}
          </p>
          {/* Single hero action: every contact route, the CV included, lives in
              one place at the bottom of the page rather than crowding the pitch. */}
          <div className="mt-6">
            <a
              href="#contact"
              data-umami-event="hero-cta"
              className="group inline-flex items-center gap-2 rounded-full bg-ember px-5 py-2.5 text-sm font-medium text-ink transition-opacity hover:opacity-90"
            >
              Get in touch
              <span
                aria-hidden="true"
                className="transition-transform group-hover:translate-y-0.5"
              >
                ↓
              </span>
            </a>
          </div>
        </div>
        <div className="pb-4">
          <Stats />
        </div>
      </header>
      <main id="main" className="relative">
        <Work />
        <Showcases />
        <Contact />
      </main>
      <Footer />
    </>
  );
}
