import { useEffect, useRef, useState } from "react";
import { initAurora, type AuroraHandle } from "../lib/aurora";
import { useReducedMotion } from "../hooks/useReducedMotion";
import {
  getSeed,
  registerCapture,
  registerSettle,
  setWebglFailed,
  subscribe,
} from "../lib/skyStore";

export function AuroraHero() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const reducedMotion = useReducedMotion();
  const [webglOk, setWebglOk] = useState(true);

  useEffect(() => {
    if (reducedMotion) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    let handle: AuroraHandle | null = null;
    let cancelled = false;

    const hasIdle = "requestIdleCallback" in window;
    const schedule = hasIdle
      ? window.requestIdleCallback.bind(window)
      : (cb: () => void) => setTimeout(cb, 0);
    const cancelSchedule = hasIdle
      ? window.cancelIdleCallback.bind(window)
      : (id: number) => clearTimeout(id);

    let unsubscribeSeed = () => {};

    const idleId = schedule(() => {
      if (cancelled) return;
      const created = initAurora(canvas, getSeed());
      if (cancelled) {
        // Cleanup ran while init was in flight - tear down immediately
        // instead of leaking the WebGL context/animation loop.
        created?.destroy();
        return;
      }
      handle = created;
      if (!created) {
        setWebglOk(false);
        setWebglFailed();
      } else {
        // Mint snapshots come from this canvas, so capture only exists
        // while it does (cleared in the cleanup below). Fade-completion has
        // the same lifetime — only a live renderer can report it.
        registerCapture(created.captureFrame);
        registerSettle(created.onceSettled);
      }
      unsubscribeSeed = subscribe((next) => handle?.setSeed(next));
    });

    const onVisibility = () => handle?.setPaused(document.hidden);
    document.addEventListener("visibilitychange", onVisibility);

    let observer: IntersectionObserver | undefined;
    if (containerRef.current) {
      observer = new IntersectionObserver(
        ([entry]) =>
          handle?.setPaused(!entry.isIntersecting || document.hidden),
        { threshold: 0.01 },
      );
      observer.observe(containerRef.current);
    }

    return () => {
      cancelled = true;
      cancelSchedule(idleId as never);
      registerCapture(null);
      registerSettle(null);
      unsubscribeSeed();
      document.removeEventListener("visibilitychange", onVisibility);
      observer?.disconnect();
      handle?.destroy();
    };
  }, [reducedMotion]);

  useEffect(() => {
    let rafId = 0;
    const onScroll = () => {
      if (rafId) return;
      rafId = requestAnimationFrame(() => {
        rafId = 0;
        const vh = window.innerHeight;
        const progress = Math.min(1, window.scrollY / vh);
        if (containerRef.current) {
          containerRef.current.style.opacity = String(1 - progress * 0.85);
        }
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      className={
        // h-lvh on top of inset-0, so the box is the *large* viewport height
        // and stops changing as a phone's URL bar slides in and out - that
        // movement resized the canvas continuously while scrolling, and every
        // resize wipes the WebGL buffer and re-samples the sky (see
        // nextRenderSize). The overflow just sits behind the toolbar, which
        // costs nothing for a background. inset-0 stays as the fallback:
        // where lvh is unsupported the height declaration is dropped and
        // top/bottom still stretch the box, rather than collapsing it to zero
        // and leaving no sky at all.
        "pointer-events-none fixed inset-0 -z-10 h-lvh"
      }
    >
      {reducedMotion || !webglOk ? (
        <div
          className="h-full w-full"
          style={{
            background:
              "radial-gradient(ellipse 80% 60% at 30% 20%, rgba(124,108,246,0.35), transparent 60%)," +
              "radial-gradient(ellipse 70% 50% at 70% 10%, rgba(53,224,194,0.28), transparent 60%)," +
              "radial-gradient(ellipse 60% 40% at 50% 100%, rgba(255,180,84,0.12), transparent 70%)," +
              "var(--color-ink)",
          }}
        />
      ) : (
        <canvas ref={canvasRef} className="h-full w-full" />
      )}
    </div>
  );
}
