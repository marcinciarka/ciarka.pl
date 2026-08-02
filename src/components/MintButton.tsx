import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { captureNow, getSeed, setMintActive } from "../lib/skyStore";
import { supportsWebpCapture, type AuroraSnapshot } from "../lib/capture";
import { CONTRACT_DEPLOYED, MAX_IMAGE_BYTES } from "../lib/contractAddress";
import type { AuroraSeed } from "../lib/seed";

// What the modal is showing. `blocked` carries its own copy because the two
// ways to get there (no WebP encoder / snapshot over the on-chain cap) need
// different explanations.
type Subject =
  // The seed is captured once, when the modal opens, and carried through the
  // rest of the flow (mint uses subject.seed, never a fresh getSeed() call).
  // getSeed() is mutable module state — if "new aurora" were to reseed while
  // a mint is in flight, a second read here would mint image A (from the
  // frozen snapshot) against seed B, corrupting on-chain provenance
  // permanently. See C1. ("new aurora" is also disabled for the duration via
  // setMintActive, belt-and-braces.)
  | { kind: "ready"; seed: AuroraSeed; snapshot: AuroraSnapshot }
  | { kind: "blocked"; message: string }
  // I2: the browser *can* encode WebP, there just isn't a live canvas
  // registered yet (AuroraHero registers captureFrame from a
  // requestIdleCallback, so a click in the first moments after load races
  // it). Recoverable — telling this visitor their browser can't encode WebP
  // would be flatly untrue, so it gets its own retryable state.
  | { kind: "warming" };

type Phase =
  | { step: "ready" }
  | { step: "minting" }
  | { step: "done"; openSeaUrl: string; txUrl: string }
  | { step: "error"; message: string };

// Result of the read-only pre-flight (checkMintable). null while in flight.
type Mintable = "ok" | "seed-taken" | "wallet-minted" | null;

// est. gas line: null = not started, "loading", "error", or the ETH string.
type Estimate = null | "loading" | "error" | string;

const WEBP_BLOCKED_MESSAGE =
  "Minting needs a browser that can encode WebP (Safari can't yet). The aurora itself is yours to enjoy anywhere.";
const WARMING_MESSAGE =
  "The sky is still warming up — give it a second and try again.";
const SIZE_BLOCKED_MESSAGE =
  "This aurora encodes to more than 16 kB, which is too large to live on-chain. Try a new aurora — most of them fit.";

const buttonClass =
  "rounded-full border border-glass-border bg-glass px-4 py-2 font-mono text-xs text-muted backdrop-blur-xl transition-colors hover:border-ember/60 hover:text-text disabled:cursor-default disabled:opacity-45 disabled:hover:border-glass-border disabled:hover:text-muted cursor-pointer";

const primaryButtonClass =
  "rounded-full border border-ember/60 bg-ember/10 px-4 py-2 font-mono text-xs text-ember backdrop-blur-xl transition-colors hover:bg-ember/20 disabled:cursor-default disabled:opacity-45 disabled:hover:bg-ember/10";

export function MintButton({ disabled = false }: { disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState<Subject | null>(null);
  const [account, setAccount] = useState<`0x${string}` | null>(null);
  const [mintable, setMintable] = useState<Mintable>(null);
  const [estimate, setEstimate] = useState<Estimate>(null);
  const [phase, setPhase] = useState<Phase>({ step: "ready" });
  const [connecting, setConnecting] = useState(false);

  // Async work (wallet reads, gas estimates, the mint itself) outlives a
  // close — and SkyControls unmounts this component outright if reduced
  // motion or a WebGL failure flips mid-flight. Guard every setState in an
  // async path.
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  // Focus can only go back to the trigger after the close has rendered — the
  // trigger is disabled while the dialog is open, and disabled buttons are
  // not focusable, so focusing it inside the close handler would silently
  // no-op and drop focus to <body>.
  const restoreFocusRef = useRef(false);

  // C1 belt-and-braces: while the modal is open it has frozen a snapshot to a
  // specific seed, so "new aurora" must stay disabled.
  useEffect(() => {
    setMintActive(open);
  }, [open]);
  useEffect(() => () => setMintActive(false), []);

  // I3: once the wallet has the transaction, closing is unrecoverable — the
  // success panel's OpenSea/tx links are the only place they appear, and
  // one-mint-per-wallet means reopening the modal cannot get them back. So
  // every dismissal path (backdrop, Escape, ✕) is sealed for the duration.
  // Deliberately a ref as well as state: the Escape listener is installed
  // once per open and would otherwise close over a stale phase.
  const mintingRef = useRef(false);
  mintingRef.current = phase.step === "minting";

  const close = useCallback(() => {
    if (mintingRef.current) return;
    setOpen(false);
    setSubject(null);
    setAccount(null);
    setMintable(null);
    setEstimate(null);
    setPhase({ step: "ready" });
    setConnecting(false);
  }, []);

  // Focus returns to the control that opened the dialog, after the re-enable.
  useEffect(() => {
    if (open || !restoreFocusRef.current) return;
    restoreFocusRef.current = false;
    triggerRef.current?.focus();
  }, [open]);

  // Escape to close + focus trap + body scroll lock, matching
  // RecordingPreview's idiom.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        close(); // no-ops while minting — see the mintingRef comment
        return;
      }
      // I4: aria-modal alone tells assistive tech the background is inert
      // but does nothing to the tab order — Tab would walk straight out into
      // the ~32 tabbable elements still behind the backdrop. Cycle within
      // the dialog instead. Queried on each keypress, not cached, because
      // the dialog's contents change with every phase (connect -> mint ->
      // the two result links).
      if (e.key !== "Tab") return;
      const dialog = dialogRef.current;
      if (!dialog) return;
      const focusable = Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])',
        ),
      );
      if (focusable.length === 0) {
        // Every control is gone or disabled (mid-mint). preventDefault alone
        // isn't enough: a blocked backdrop click blurs to <body>, and Tab
        // from there would land on the page behind the modal. Pull focus back
        // onto the dialog itself.
        e.preventDefault();
        if (!dialog.contains(document.activeElement)) dialog.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey && (active === first || !dialog.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (active === last || !dialog.contains(active))) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, close]);

  // Move focus into the dialog on open. Deliberately keyed on `open` alone —
  // re-running it on every phase change would yank focus back to ✕ mid-tab.
  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
  }, [open]);

  // Entering "minting" unmounts the ✕ and disables the mint button, so
  // whatever was focused disappears and focus falls to <body>, outside the
  // trap. Catch it on the dialog itself.
  useEffect(() => {
    if (!open || phase.step !== "minting") return;
    const dialog = dialogRef.current;
    if (dialog && !dialog.contains(document.activeElement)) dialog.focus();
  }, [open, phase.step]);

  // Once an account is known (either already-authorized on open, or freshly
  // connected), run the two read-only pre-flights: can this be minted at all,
  // and what will it cost. Both are best-effort — a failure degrades the
  // small print to "—" rather than blocking the mint button.
  const loadForAccount = useCallback(
    async (addr: `0x${string}`, seed: AuroraSeed, snapshot: AuroraSnapshot) => {
      setEstimate("loading");
      try {
        const { checkMintable, estimateMint } = await import("../lib/mint");
        const [mintableResult, estimateResult] = await Promise.allSettled([
          checkMintable(addr, seed),
          estimateMint(addr, seed, snapshot),
        ]);
        if (!mountedRef.current) return;
        setMintable(
          mintableResult.status === "fulfilled" ? mintableResult.value : "ok",
        );
        setEstimate(
          estimateResult.status === "fulfilled"
            ? estimateResult.value.totalEth
            : "error",
        );
      } catch {
        if (!mountedRef.current) return;
        // Could not even load the wallet code — leave the mint button
        // available (it will surface a real error if pressed) and show "—".
        setMintable("ok");
        setEstimate("error");
      }
    },
    [],
  );

  // Takes the snapshot and starts the read-only pre-flights. Split out of
  // openModal so the "still warming up" state can retry it in place without
  // closing and reopening the dialog.
  const prepare = useCallback(() => {
    // WebP-or-nothing: browsers that can't encode WebP (Safari, at time of
    // writing) never get a mint action — just the information panel.
    let next: Subject;
    if (!supportsWebpCapture()) {
      next = { kind: "blocked", message: WEBP_BLOCKED_MESSAGE };
    } else {
      const seed = getSeed();
      // WYSIWYG: the live hero canvas as it looks right now, not a re-render
      // of the seed. Seed and snapshot are read together, once.
      const snapshot = captureNow();
      if (!snapshot) {
        // I2: the WebP probe just said yes, so a null here is not an encoder
        // problem — it's a missing/not-yet-registered canvas (the common case
        // right after load) or a lost context. Say that, and let them retry,
        // instead of accusing their browser of something it can do.
        next = { kind: "warming" };
      } else if (snapshot.bytes > MAX_IMAGE_BYTES) {
        // I3: enforce the same cap client-side before offering a mint action
        // at all, in addition to mintSky's own guard right before the
        // on-chain write.
        next = { kind: "blocked", message: SIZE_BLOCKED_MESSAGE };
      } else {
        next = { kind: "ready", seed, snapshot };
      }
    }
    setSubject(next);

    if (next.kind !== "ready") return;
    const { seed, snapshot } = next;
    // eth_accounts — reads an already-authorized account without prompting.
    void (async () => {
      try {
        const { getConnectedAccount } = await import("../lib/mint");
        const addr = await getConnectedAccount();
        if (!mountedRef.current || !addr) return;
        setAccount(addr);
        await loadForAccount(addr, seed, snapshot);
      } catch {
        // No wallet / provider threw — the connect button is the next step.
      }
    })();
  }, [loadForAccount]);

  const openModal = () => {
    prepare();
    restoreFocusRef.current = true;
    setOpen(true);
  };

  const connect = async (seed: AuroraSeed, snapshot: AuroraSnapshot) => {
    setConnecting(true);
    setPhase({ step: "ready" });
    try {
      // Dynamic import so viem never lands in the entry chunk — mint.ts (and
      // everything it pulls in, including viem) only loads when the modal is
      // actually used.
      const { connectWallet, NoWalletError, isUserRejection } =
        await import("../lib/mint");
      try {
        const addr = await connectWallet();
        if (!mountedRef.current) return;
        setAccount(addr);
        await loadForAccount(addr, seed, snapshot);
      } catch (err) {
        if (!mountedRef.current) return;
        if (isUserRejection(err)) return; // silently back to the ready state
        if (err instanceof NoWalletError)
          setPhase({
            step: "error",
            message: "No wallet found — install one to mint.",
          });
        else {
          console.error(err);
          setPhase({
            step: "error",
            message: "Could not connect — try again.",
          });
        }
      }
    } catch (err) {
      console.error(err);
      if (!mountedRef.current) return;
      setPhase({ step: "error", message: "Could not load wallet code." });
    } finally {
      if (mountedRef.current) setConnecting(false);
    }
  };

  const mint = async (
    addr: `0x${string}`,
    seed: AuroraSeed,
    snapshot: AuroraSnapshot,
  ) => {
    setPhase({ step: "minting" });
    try {
      const {
        mintSky,
        isUserRejection,
        NoWalletError,
        SeedTakenError,
        WebpRequiredError,
        ImageTooLargeError,
      } = await import("../lib/mint");
      try {
        // seed comes from the subject frozen when the modal opened, NOT a
        // fresh getSeed() read — see the Subject comment (C1).
        const { txUrl, openSeaUrl } = await mintSky(addr, seed, snapshot);
        if (!mountedRef.current) return;
        setPhase({ step: "done", txUrl, openSeaUrl });
      } catch (err) {
        if (!mountedRef.current) return;
        if (isUserRejection(err)) {
          setPhase({ step: "ready" }); // rejected in wallet — no error line
        } else if (err instanceof SeedTakenError) {
          setMintable("seed-taken");
          setPhase({ step: "ready" });
        } else if (err instanceof NoWalletError) {
          setPhase({
            step: "error",
            message: "No wallet found — install one to mint.",
          });
        } else if (err instanceof WebpRequiredError) {
          // Defense in depth; the UI should already have blocked this.
          setSubject({ kind: "blocked", message: WEBP_BLOCKED_MESSAGE });
        } else if (err instanceof ImageTooLargeError) {
          setSubject({ kind: "blocked", message: SIZE_BLOCKED_MESSAGE });
        } else {
          console.error(err);
          setPhase({ step: "error", message: "Mint failed — see console." });
        }
      }
    } catch (err) {
      console.error(err);
      if (!mountedRef.current) return;
      setPhase({ step: "error", message: "Could not load wallet code." });
    }
  };

  // I2: the placeholder zero address means the contract isn't deployed yet.
  // Rather than render a mint button that always fails, render nothing.
  if (!CONTRACT_DEPLOYED) return null;

  // M1: before a wallet is connected there is nothing to estimate against
  // and nothing in flight, so an ellipsis reads as a spinner that never
  // resolves. Say why the number isn't there.
  const estimateText =
    estimate === null
      ? account === null
        ? "connect to estimate"
        : "…"
      : estimate === "loading"
        ? "…"
        : estimate === "error"
          ? "—"
          : // "<0.00000001" already carries its own comparator; prefixing the
            // usual "~" would read as "about less than".
            estimate.startsWith("<")
            ? `${estimate} ETH`
            : `~${estimate} ETH`;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled || open}
        onClick={openModal}
        className={buttonClass}
      >
        mint this aurora
      </button>

      {open &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Mint this aurora"
            // z-60 clears the nav (z-50), matching RecordingPreview.
            className="fixed inset-0 z-60 flex items-center justify-center bg-ink/80 p-5 backdrop-blur-sm sm:p-8"
            onClick={close}
          >
            <div
              ref={dialogRef}
              // Focus target of last resort: entering "minting" unmounts the
              // ✕ and disables the mint button, so without this the focused
              // element would vanish and drop focus to <body>, outside the
              // trap. -1 keeps it out of the tab cycle itself.
              tabIndex={-1}
              className="w-full max-w-xs rounded-2xl border border-glass-border bg-ink-raise p-4 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-3 flex items-start justify-between gap-3">
                <h2 className="font-display text-sm font-semibold text-text">
                  {phase.step === "done" ? "minted ✦" : "mint this aurora"}
                </h2>
                {/* I3: hidden entirely while minting — a disabled button
                    would still invite the click that must not land. */}
                {phase.step !== "minting" && (
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

              {subject?.kind === "blocked" && (
                <p className="font-mono text-xs leading-relaxed text-muted">
                  {subject.message}
                </p>
              )}

              {subject?.kind === "warming" && (
                <div className="flex flex-col gap-2">
                  <p className="font-mono text-xs leading-relaxed text-muted">
                    {WARMING_MESSAGE}
                  </p>
                  <button
                    type="button"
                    onClick={prepare}
                    className={primaryButtonClass}
                  >
                    try again
                  </button>
                </div>
              )}

              {subject?.kind === "ready" && (
                <>
                  <img
                    src={subject.snapshot.dataUrl}
                    alt="Your aurora snapshot"
                    className="mb-3 aspect-square w-full rounded-xl border border-glass-border object-cover"
                  />

                  {phase.step === "done" ? (
                    <div className="flex flex-col gap-2">
                      <a
                        href={phase.openSeaUrl}
                        target="_blank"
                        rel="noreferrer"
                        className={`${primaryButtonClass} text-center`}
                      >
                        view on OpenSea
                      </a>
                      <a
                        href={phase.txUrl}
                        target="_blank"
                        rel="noreferrer"
                        className={`${buttonClass} text-center`}
                      >
                        transaction
                      </a>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {account === null ? (
                        <button
                          type="button"
                          disabled={connecting}
                          onClick={() =>
                            void connect(subject.seed, subject.snapshot)
                          }
                          className={primaryButtonClass}
                        >
                          {connecting ? "connecting…" : "connect wallet"}
                        </button>
                      ) : mintable === "seed-taken" ? (
                        <p className="font-mono text-xs text-muted">
                          this aurora is already minted — try a new one
                        </p>
                      ) : mintable === "wallet-minted" ? (
                        <p className="font-mono text-xs text-muted">
                          this wallet already minted its aurora
                        </p>
                      ) : (
                        <button
                          type="button"
                          disabled={
                            phase.step === "minting" || mintable === null
                          }
                          onClick={() =>
                            void mint(account, subject.seed, subject.snapshot)
                          }
                          className={primaryButtonClass}
                        >
                          {phase.step === "minting"
                            ? "minting…"
                            : mintable === null
                              ? "checking…"
                              : "mint on Base"}
                        </button>
                      )}

                      {phase.step === "error" && (
                        <p className="font-mono text-xs text-ember">
                          {phase.message}
                        </p>
                      )}
                    </div>
                  )}

                  <dl className="mt-3 space-y-0.5 font-mono text-xs text-muted">
                    <div className="flex justify-between gap-2">
                      <dt>est. gas</dt>
                      <dd>{estimateText}</dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt>seed</dt>
                      <dd>{String(subject.seed)}</dd>
                    </div>
                  </dl>
                </>
              )}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
