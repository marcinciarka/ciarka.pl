import { useCallback, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { FOCUSABLE_SELECTOR, nextFocusIndex } from "../lib/focusCycle";

export type Segment = "gallery" | "mint";

type AuroraModalProps = {
  title: string;
  subtitle?: string;
  segment: Segment;
  onSegment: (next: Segment) => void;
  showMintSegment: boolean;
  // Once the wallet has the transaction, closing is unrecoverable — the
  // success panel's OpenSea/tx links are the only place they appear, and
  // one-mint-per-wallet means reopening cannot get them back. While sealed,
  // every dismissal path (backdrop, Escape, ✕) and the segment control are
  // shut off. (Was MintButton's mintingRef; now raised by MintPanel.)
  sealed: boolean;
  onClose: () => void;
  children: React.ReactNode;
};

const segmentBase =
  "rounded-full px-3 py-1 font-mono text-xs transition-colors disabled:cursor-default";
const segmentOn = "border border-ember/60 bg-ember/10 text-ember";
const segmentOff =
  "border border-glass-border text-muted hover:border-ember/60 hover:text-text";

export function AuroraModal({
  title,
  subtitle,
  segment,
  onSegment,
  showMintSegment,
  sealed,
  onClose,
  children,
}: AuroraModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  // The Escape listener is installed once per open and would otherwise close
  // over a stale `sealed`.
  const sealedRef = useRef(sealed);
  sealedRef.current = sealed;

  const close = useCallback(() => {
    if (sealedRef.current) return;
    onClose();
  }, [onClose]);

  // Escape + focus trap + body scroll lock, one installation covering both
  // segments.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        close(); // no-ops while sealed
        return;
      }
      if (e.key !== "Tab") return;

      // aria-modal tells assistive tech the background is inert but does
      // nothing to the tab order — Tab would walk out into the page behind
      // the backdrop. Queried on each keypress, not cached: the contents
      // change with every phase.
      const dialog = dialogRef.current;
      if (!dialog) return;
      const focusable = Array.from(
        dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      ).filter((el) => {
        // The inactive segment stays mounted under `hidden` so a completed
        // mint's links survive a trip to the gallery — but
        // `button:not([disabled])` still matches inside a hidden subtree, so
        // filter on actual layout.
        const rect = el.getBoundingClientRect();
        return rect.width > 0 || rect.height > 0;
      });

      if (focusable.length === 0) {
        // Every control is gone or disabled (mid-mint). preventDefault alone
        // isn't enough: a blocked backdrop click blurs to <body>, and Tab
        // from there would land on the page behind the modal.
        e.preventDefault();
        if (!dialog.contains(document.activeElement)) dialog.focus();
        return;
      }

      const active = document.activeElement as HTMLElement | null;
      const activeIndex =
        active && dialog.contains(active) ? focusable.indexOf(active) : -1;
      const target = nextFocusIndex(focusable.length, activeIndex, e.shiftKey);
      if (target === null) return;
      e.preventDefault();
      focusable[target].focus();
    };

    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [close]);

  // Move focus into the dialog on mount only — re-running on segment change
  // would yank focus back to ✕ mid-tab.
  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  // Sealing unmounts the ✕, so whatever was focused disappears and focus
  // falls to <body>, outside the trap. Catch it on the dialog itself.
  useEffect(() => {
    if (!sealed) return;
    const dialog = dialogRef.current;
    if (dialog && !dialog.contains(document.activeElement)) dialog.focus();
  }, [sealed]);

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      // z-60 clears the nav (z-50), matching RecordingPreview.
      className="fixed inset-0 z-60 flex items-center justify-center bg-ink/80 p-4 backdrop-blur-sm sm:p-8"
      onClick={close}
    >
      <div
        ref={dialogRef}
        // Focus target of last resort while sealed; -1 keeps it out of the
        // tab cycle itself.
        tabIndex={-1}
        className="flex max-h-[85svh] w-full max-w-4xl flex-col rounded-2xl border border-glass-border bg-ink-raise p-4 shadow-2xl sm:p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex flex-wrap items-start justify-between gap-3 border-b border-glass-border pb-3">
          <div className="min-w-0">
            <h2 className="font-display text-sm font-semibold text-text">
              {title}
            </h2>
            {subtitle && (
              <p className="mt-0.5 font-mono text-[10px] text-muted">
                {subtitle}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {showMintSegment && (
              <div className="flex items-center gap-1">
                {/* aria-pressed, not colour alone: `segmentOn` differs from
                    `segmentOff` only by the ember border and fill, which
                    leaves the selected segment unannounced to a screen
                    reader and fails WCAG 1.4.1 for anyone who can't
                    distinguish it. */}
                <button
                  type="button"
                  aria-pressed={segment === "gallery"}
                  disabled={sealed}
                  onClick={() => onSegment("gallery")}
                  className={`${segmentBase} ${segment === "gallery" ? segmentOn : segmentOff} ${sealed ? "opacity-45" : ""}`}
                >
                  gallery
                </button>
                <button
                  type="button"
                  aria-pressed={segment === "mint"}
                  disabled={sealed}
                  onClick={() => onSegment("mint")}
                  className={`${segmentBase} ${segment === "mint" ? segmentOn : segmentOff} ${sealed ? "opacity-45" : ""}`}
                >
                  mint yours
                </button>
              </div>
            )}
            {/* Hidden entirely while sealed — a disabled button would still
                invite the click that must not land. */}
            {!sealed && (
              <button
                ref={closeRef}
                type="button"
                onClick={close}
                aria-label="Close"
                className="rounded-full border border-glass-border px-2 py-0.5 font-mono text-xs text-muted transition-colors hover:border-ember/60 hover:text-text"
              >
                ✕
              </button>
            )}
          </div>
        </div>
        <div className="min-h-0 flex-1">{children}</div>
      </div>
    </div>,
    document.body,
  );
}
