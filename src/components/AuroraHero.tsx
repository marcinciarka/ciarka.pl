import { useEffect, useRef, useState } from "react";
import { initAurora, type AuroraHandle } from "../lib/aurora";
import { useReducedMotion } from "../hooks/useReducedMotion";

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

    const idleId = schedule(() => {
      if (cancelled) return;
      const created = initAurora(canvas);
      if (cancelled) {
        // Cleanup ran while init was in flight - tear down immediately
        // instead of leaking the WebGL context/animation loop.
        created?.destroy();
        return;
      }
      handle = created;
      if (!created) setWebglOk(false);
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
      className="pointer-events-none fixed inset-0 -z-10"
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
