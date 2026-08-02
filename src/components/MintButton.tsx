import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { applySeed, captureNow, getSeed, setMintActive } from "../lib/skyStore";
import { supportsWebpCapture, type AuroraSnapshot } from "../lib/capture";
import {
  CONTRACT_ADDRESS,
  CONTRACT_DEPLOYED,
  MAX_IMAGE_BYTES,
} from "../lib/contractAddress";

// Static-safe fallback (no viem import): the collection view on OpenSea,
// for when the wallet's own tokenId isn't known (lookup pending/failed).
const OPENSEA_COLLECTION_URL = `https://opensea.io/assets/base/${CONTRACT_ADDRESS}`;
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

// est. gas small print: null = not started, "loading", "error", or the pair
// of formatted totals (usd is null when the Chainlink read failed — the ETH
// row still stands on its own).
type Estimate =
  | null
  | "loading"
  | "error"
  | { eth: string; usd: string | null };

// The aurora this (already-minted) wallet owns. null = not looked up,
// "loading" = in flight, "none" = nothing found / lookup failed.
type Owned =
  | null
  | "loading"
  | "none"
  | { tokenId: bigint; seed: number; openSeaUrl: string };

type GalleryItem = {
  tokenId: bigint;
  seed: number;
  dataUrl: string;
  openSeaUrl: string;
};

type Gallery =
  | { status: "loading" }
  | { status: "error" }
  | { status: "loaded"; items: GalleryItem[]; total: number };

// Matches fetchMintedAuroras' own default; kept here so the pagination math
// and the fetch agree without a second source of truth.
const GALLERY_PAGE_SIZE = 12;

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
  // The dialog hosts two views; the gallery swaps in over the mint panel
  // rather than opening a second dialog, so one focus trap covers both.
  const [view, setView] = useState<"mint" | "gallery">("mint");
  const [gallery, setGallery] = useState<Gallery>({ status: "loading" });
  const [page, setPage] = useState(0);
  // Remembered across a back/forward trip so the footer button can carry the
  // count once anything has loaded it. Deliberately not fetched on open:
  // there is no cheap standalone totalMinted read exposed to the UI, and the
  // gallery fetch pulls ~9KB of image per token.
  const [mintedTotal, setMintedTotal] = useState<number | null>(null);
  const [owned, setOwned] = useState<Owned>(null);
  // Kept separate from `owned` so the recall panel (seed + load button +
  // OpenSea link) renders the moment findMintedToken resolves, and the
  // thumbnail fills in after — a failed image fetch must not take the panel
  // down with it. null = not started, "loading", "failed", or the data URL.
  const [ownedImage, setOwnedImage] = useState<
    null | "loading" | "failed" | string
  >(null);
  const [explorerUrl, setExplorerUrl] = useState<string | null>(null);

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
    setView("mint");
    setGallery({ status: "loading" });
    setPage(0);
    setOwned(null);
    setOwnedImage(null);
    // Reset rather than keep: a successful mint bumps totalMinted, so a
    // remembered count would render a stale "(N-1)" badge on the next open.
    // Cheap to lose — it repopulates the first time the gallery loads.
    setMintedTotal(null);
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

  // The Basescan link. Lives behind the same dynamic import as everything
  // else in mint.ts — mintConfig pulls viem/chains, so a static import here
  // would drag viem into the entry chunk. Loaded once, then cached.
  useEffect(() => {
    if (!open || explorerUrl !== null) return;
    void (async () => {
      try {
        const { explorerContractUrl } = await import("../lib/mint");
        if (!mountedRef.current) return;
        setExplorerUrl(explorerContractUrl());
      } catch {
        // Leave the button out rather than render a dead link.
      }
    })();
  }, [open, explorerUrl]);

  // Gallery page loader. Refetches on page change; the cancelled flag stops a
  // slow page-0 response from overwriting a page-1 one (or a closed modal).
  useEffect(() => {
    if (!open || view !== "gallery") return;
    let cancelled = false;
    setGallery({ status: "loading" });
    void (async () => {
      try {
        const { fetchMintedAuroras } = await import("../lib/mint");
        const { items, total } = await fetchMintedAuroras(
          page,
          GALLERY_PAGE_SIZE,
        );
        if (cancelled || !mountedRef.current) return;
        setGallery({ status: "loaded", items, total });
        setMintedTotal(total);
      } catch (err) {
        console.error(err);
        if (cancelled || !mountedRef.current) return;
        setGallery({ status: "error" });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, view, page]);

  // A wallet that has already minted gets its own aurora back: which token,
  // which seed, and (via applySeed) the ability to put it back on the page.
  useEffect(() => {
    if (!open || mintable !== "wallet-minted" || account === null) return;
    let cancelled = false;
    setOwned("loading");
    setOwnedImage(null);
    void (async () => {
      try {
        const { findMintedToken, fetchMintedAuroras, openSeaUrl } =
          await import("../lib/mint");
        const found = await findMintedToken(account);
        if (cancelled || !mountedRef.current) return;
        if (!found) {
          // checkMintable said this wallet minted, so a miss here means the
          // token moved on (sold/transferred) — nothing to show.
          setOwned("none");
          return;
        }
        setOwned({ ...found, openSeaUrl: openSeaUrl(found.tokenId) });

        // Then the picture. The gallery pager is the only exposed way to
        // reach imageOf, so: fetch page 0 (which also tells us `total`), and
        // if the token isn't on it, jump straight to its page — the gallery
        // is strictly newest-first with no gaps, so the page index is
        // arithmetic, not a search.
        setOwnedImage("loading");
        try {
          const first = await fetchMintedAuroras(0, GALLERY_PAGE_SIZE);
          if (cancelled || !mountedRef.current) return;
          setMintedTotal(first.total);
          let item = first.items.find((i) => i.tokenId === found.tokenId);
          if (!item) {
            const target = Math.floor(
              (first.total - Number(found.tokenId)) / GALLERY_PAGE_SIZE,
            );
            const rest = await fetchMintedAuroras(target, GALLERY_PAGE_SIZE);
            if (cancelled || !mountedRef.current) return;
            item = rest.items.find((i) => i.tokenId === found.tokenId);
          }
          setOwnedImage(item ? item.dataUrl : "failed");
        } catch {
          // The recall panel (seed, load button, OpenSea link) stands on its
          // own without the picture.
          if (cancelled || !mountedRef.current) return;
          setOwnedImage("failed");
        }
      } catch {
        if (cancelled || !mountedRef.current) return;
        setOwned("none");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, mintable, account]);

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
            ? {
                eth: estimateResult.value.totalEth,
                usd: estimateResult.value.totalUsd,
              }
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
            estimate.eth.startsWith("<")
            ? `${estimate.eth} ETH`
            : `~${estimate.eth} ETH`;

  // Same states as the ETH row, but the oracle can fail on its own (totalUsd
  // null) while the ETH number is perfectly good — that degrades to "—".
  const usdText =
    estimate === null
      ? account === null
        ? "connect to estimate"
        : "…"
      : estimate === "loading"
        ? "…"
        : estimate === "error" || estimate.usd === null
          ? "—"
          : `≈ $${estimate.usd}`;

  const galleryLabel =
    mintedTotal === null
      ? "all minted auroras"
      : `all minted auroras (${mintedTotal})`;

  const pageCount =
    gallery.status === "loaded"
      ? Math.max(1, Math.ceil(gallery.total / GALLERY_PAGE_SIZE))
      : 1;

  // Footer of the mint view: two small, muted, always-available links out —
  // the gallery (in-modal) and the contract on Basescan. Hidden only while
  // minting, where every dismissal/navigation path is sealed (I3).
  const footer = (
    <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-glass-border pt-3 font-mono text-[10px] text-muted">
      <button
        type="button"
        onClick={() => {
          setPage(0);
          setView("gallery");
        }}
        className="rounded-full border border-glass-border px-2.5 py-1 transition-colors hover:border-ember/60 hover:text-text"
      >
        {galleryLabel}
      </button>
      {explorerUrl && (
        <a
          href={explorerUrl}
          target="_blank"
          rel="noreferrer"
          className="rounded-full border border-glass-border px-2.5 py-1 transition-colors hover:border-ember/60 hover:text-text"
        >
          contract ↗
        </a>
      )}
    </div>
  );

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
              className={`w-full rounded-2xl border border-glass-border bg-ink-raise p-4 shadow-2xl ${
                view === "gallery" ? "max-w-md" : "max-w-xs"
              }`}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mb-3 flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  {view === "gallery" && (
                    <button
                      type="button"
                      onClick={() => setView("mint")}
                      className="rounded-full border border-glass-border px-2 py-0.5 font-mono text-xs text-muted transition-colors hover:border-ember/60 hover:text-text"
                    >
                      ← back
                    </button>
                  )}
                  <h2 className="font-display text-sm font-semibold text-text">
                    {view === "gallery"
                      ? "minted auroras"
                      : phase.step === "done"
                        ? "minted ✦"
                        : "mint this aurora"}
                  </h2>
                </div>
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

              {view === "mint" && subject?.kind === "blocked" && (
                <p className="font-mono text-xs leading-relaxed text-muted">
                  {subject.message}
                </p>
              )}

              {view === "mint" && subject?.kind === "warming" && (
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

              {view === "mint" && subject?.kind === "ready" && (
                <>
                  {/* One image per state: a wallet that already minted sees
                      its own aurora (in the recall panel below), not the
                      capture preview it can never mint. */}
                  {mintable !== "wallet-minted" && (
                    <img
                      src={subject.snapshot.dataUrl}
                      alt="Your aurora snapshot"
                      className="mb-3 aspect-square w-full rounded-xl border border-glass-border object-cover"
                    />
                  )}

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
                        // One mint per wallet — so instead of a dead end,
                        // hand them their own aurora back: its seed, a way to
                        // put it on the page (applySeed → the hero
                        // crossfades), and its OpenSea page.
                        <div className="flex flex-col gap-2">
                          <p className="font-mono text-xs leading-relaxed text-muted">
                            {owned === "loading"
                              ? "each wallet gets one aurora — finding yours…"
                              : typeof owned === "object" && owned !== null
                                ? "each wallet gets one aurora. this is yours:"
                                : "each wallet gets one aurora, and this one already claimed its sky"}
                          </p>
                          {(owned === "loading" || owned === "none") && (
                            <a
                              href={OPENSEA_COLLECTION_URL}
                              target="_blank"
                              rel="noreferrer"
                              className={`${buttonClass} text-center`}
                            >
                              view collection on OpenSea
                            </a>
                          )}
                          {typeof owned === "object" && owned !== null && (
                            <>
                              {ownedImage === "loading" ? (
                                <div className="aspect-square w-full animate-pulse rounded-xl border border-glass-border bg-glass" />
                              ) : (
                                ownedImage !== null &&
                                ownedImage !== "failed" && (
                                  <img
                                    src={ownedImage}
                                    alt={`Your minted aurora #${owned.tokenId}`}
                                    className="aspect-square w-full rounded-xl border border-glass-border object-cover"
                                  />
                                )
                              )}
                              <p className="font-mono text-xs text-muted">
                                #{String(owned.tokenId)} · seed {owned.seed}
                              </p>
                              <button
                                type="button"
                                onClick={() => {
                                  applySeed(owned.seed);
                                  close();
                                }}
                                className={primaryButtonClass}
                              >
                                load this aurora
                              </button>
                              <a
                                href={owned.openSeaUrl}
                                target="_blank"
                                rel="noreferrer"
                                className={`${buttonClass} text-center`}
                              >
                                view on OpenSea
                              </a>
                            </>
                          )}
                        </div>
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

                  {/* Gas/seed small print describes the mint candidate — for
                      an already-minted wallet there is no candidate, and the
                      recall panel shows its own token's seed instead. */}
                  {mintable !== "wallet-minted" && (
                    <dl className="mt-3 space-y-0.5 font-mono text-xs text-muted">
                      <div className="flex justify-between gap-2">
                        <dt>est. gas</dt>
                        <dd>{estimateText}</dd>
                      </div>
                      {/* Priced off the Chainlink ETH/USD feed on Base; "—"
                          when that read failed, so a flaky oracle never takes
                          the ETH number down with it. */}
                      <div className="flex justify-between gap-2">
                        <dt>in USD</dt>
                        <dd>{usdText}</dd>
                      </div>
                      <div className="flex justify-between gap-2">
                        <dt>seed</dt>
                        <dd>{String(subject.seed)}</dd>
                      </div>
                    </dl>
                  )}
                </>
              )}

              {view === "mint" && phase.step !== "minting" && footer}

              {view === "gallery" && (
                <>
                  {gallery.status === "loading" && (
                    <p className="font-mono text-xs text-muted">loading…</p>
                  )}
                  {gallery.status === "error" && (
                    <p className="font-mono text-xs text-ember">
                      could not load the gallery — try again later
                    </p>
                  )}
                  {gallery.status === "loaded" &&
                    (gallery.items.length === 0 ? (
                      <p className="font-mono text-xs text-muted">
                        no skies minted yet
                      </p>
                    ) : (
                      <>
                        <ul className="grid grid-cols-3 gap-2">
                          {gallery.items.map((item) => (
                            <li
                              key={String(item.tokenId)}
                              className="flex flex-col gap-1"
                            >
                              <img
                                src={item.dataUrl}
                                alt={`Aurora #${item.tokenId}`}
                                className="aspect-square w-full rounded-lg border border-glass-border object-cover"
                              />
                              <a
                                href={item.openSeaUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="font-mono text-[10px] text-muted transition-colors hover:text-ember"
                              >
                                #{String(item.tokenId)} ↗
                              </a>
                              <span className="font-mono text-[10px] text-muted/70">
                                {item.seed}
                              </span>
                            </li>
                          ))}
                        </ul>
                        {gallery.total > GALLERY_PAGE_SIZE && (
                          <div className="mt-3 flex items-center justify-between gap-2 font-mono text-[10px] text-muted">
                            <button
                              type="button"
                              disabled={page === 0}
                              onClick={() => setPage((p) => Math.max(0, p - 1))}
                              className="rounded-full border border-glass-border px-2.5 py-1 transition-colors hover:border-ember/60 hover:text-text disabled:cursor-default disabled:opacity-40 disabled:hover:border-glass-border disabled:hover:text-muted"
                            >
                              ← prev
                            </button>
                            <span>
                              page {page + 1} / {pageCount}
                            </span>
                            <button
                              type="button"
                              disabled={page + 1 >= pageCount}
                              onClick={() => setPage((p) => p + 1)}
                              className="rounded-full border border-glass-border px-2.5 py-1 transition-colors hover:border-ember/60 hover:text-text disabled:cursor-default disabled:opacity-40 disabled:hover:border-glass-border disabled:hover:text-muted"
                            >
                              next →
                            </button>
                          </div>
                        )}
                      </>
                    ))}
                </>
              )}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
