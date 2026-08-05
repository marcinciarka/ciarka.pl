import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export function RecordingPreview({
  src,
  poster,
  title,
}: {
  src: string;
  poster: string;
  title: string;
}) {
  const [open, setOpen] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    void videoRef.current?.play();
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Play ${title} recording`}
        className="glass group relative aspect-4/3 w-full overflow-hidden rounded-2xl text-left"
      >
        {/* A still, not the <video> itself. WebKit decodes no frame at
            preload="metadata", so a video here renders as an empty card in
            Safari; it also spares every browser the megabytes of clip nobody
            asked to watch yet. The button carries the accessible name. */}
        <img
          src={poster}
          alt=""
          width={800}
          height={600}
          loading="lazy"
          decoding="async"
          className="pointer-events-none h-full w-full object-cover"
        />
        <span
          aria-hidden="true"
          className="absolute inset-0 flex items-center justify-center bg-ink/25 transition-colors group-hover:bg-ink/35"
        >
          <span className="flex h-14 w-14 items-center justify-center rounded-full border border-glass-border bg-ink-raise/80 text-ember backdrop-blur-sm transition-transform group-hover:scale-105">
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="ml-0.5"
            >
              <path d="M8 5.14v13.72L19 12 8 5.14z" />
            </svg>
          </span>
        </span>
      </button>

      {open &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`${title} recording`}
            className="fixed inset-0 z-60 flex items-center justify-center bg-ink/80 p-5 sm:p-8"
            onClick={() => setOpen(false)}
          >
            <div
              className="overflow-hidden rounded-2xl border border-glass-border bg-ink-raise shadow-2xl"
              style={{
                width:
                  "min(1470px, calc(100vw - 2.5rem), calc((100vh - 4rem) * 1470 / 884))",
                aspectRatio: "1470 / 884",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <video
                ref={videoRef}
                src={src}
                poster={poster}
                controls
                autoPlay
                playsInline
                className="h-full w-full bg-ink"
              />
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
