import { useCallback, useEffect, useRef, useState } from "react";
import {
  captureNow,
  getSeed,
  reseed,
  setMintActive,
  whenSkySettled,
} from "../lib/skyStore";
import { supportsWebpCapture, type AuroraSnapshot } from "../lib/capture";
import {
  CONTRACT_DEPLOYED,
  GALLERY_PAGE_SIZE,
  MAX_IMAGE_BYTES,
  openseaCollectionUrl,
} from "../lib/contractAddress";
import { invalidateMintedTotal, setMintedTotal } from "../lib/mintedTotal";
import { truncateAddress } from "../lib/format";
import {
  allowAutoConnect,
  isAutoConnectSuppressed,
  sameAccount,
  subscribeAccountsChanged,
  suppressAutoConnect,
} from "../lib/walletEvents";
import type { AuroraSeed } from "../lib/seed";

// What the panel is showing. `blocked` carries its own copy because the two
// ways to get there (no WebP encoder / snapshot over the on-chain cap) need
// different explanations.
type Subject =
  // The seed is captured once, when the mint segment activates, and carried
  // through the rest of the flow (mint uses subject.seed, never a fresh
  // getSeed() call). getSeed() is mutable module state — if "new aurora"
  // were to reseed while a mint is in flight, a second read here would mint
  // image A (from the frozen snapshot) against seed B, corrupting on-chain
  // provenance permanently. See C1. ("new aurora" is also disabled for the
  // duration via setMintActive, belt-and-braces.)
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

const WEBP_BLOCKED_MESSAGE =
  "Minting needs a browser that can encode WebP (Safari can't yet). The aurora itself is yours to enjoy anywhere.";
const WARMING_MESSAGE =
  "The aurora is still warming up — give it a second and try again.";
const SIZE_BLOCKED_MESSAGE =
  "This aurora encodes to more than 16 kB, which is too large to live on-chain. Try a new aurora — most of them fit.";

const buttonClass =
  "rounded-full border border-glass-border bg-glass px-4 py-2 font-mono text-xs text-muted backdrop-blur-xl transition-colors hover:border-ember/60 hover:text-text disabled:cursor-default disabled:opacity-45 disabled:hover:border-glass-border disabled:hover:text-muted";

const primaryButtonClass =
  "rounded-full border border-ember/60 bg-ember/10 px-4 py-2 font-mono text-xs text-ember backdrop-blur-xl transition-colors hover:bg-ember/20 disabled:cursor-default disabled:opacity-45 disabled:hover:bg-ember/10";

type MintPanelProps = {
  active: boolean; // the mint segment is showing
  onSealedChange: (sealed: boolean) => void; // true while a tx is in flight
  onMinted: () => void; // fired once after a successful mint
  onLoadSky: (seed: number) => void; // applySeed + close, same as the gallery
};

export function MintPanel({
  active,
  onSealedChange,
  onMinted,
  onLoadSky,
}: MintPanelProps) {
  const [subject, setSubject] = useState<Subject | null>(null);
  const [account, setAccount] = useState<`0x${string}` | null>(null);
  const [mintable, setMintable] = useState<Mintable>(null);
  const [estimate, setEstimate] = useState<Estimate>(null);
  const [phase, setPhase] = useState<Phase>({ step: "ready" });
  const [connecting, setConnecting] = useState(false);
  const [owned, setOwned] = useState<Owned>(null);
  // Kept separate from `owned` so the recall panel (seed + load button +
  // OpenSea link) renders the moment findMintedToken resolves, and the
  // thumbnail fills in after — a failed image fetch must not take the panel
  // down with it. null = not started, "loading", "failed", or the data URL.
  const [ownedImage, setOwnedImage] = useState<
    null | "loading" | "failed" | string
  >(null);
  const [explorerUrl, setExplorerUrl] = useState<string | null>(null);
  const [rerolling, setRerolling] = useState(false);

  // Async work (wallet reads, gas estimates, the mint itself) outlives a
  // segment switch — and SkyControls unmounts this component outright if
  // reduced motion or a WebGL failure flips mid-flight. Guard every setState
  // in an async path.
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // A switch that arrives mid-mint is parked here rather than applied.
  // `undefined` means nothing is parked; `null` means the wallet reported no
  // accounts. Both are meaningful, hence the three-state ref.
  const pendingAccountRef = useRef<`0x${string}` | null | undefined>(undefined);

  // Unsubscribe for an in-flight fade wait, so an abort or unmount doesn't
  // leave a callback pointing at a dead component.
  const rerollWaitRef = useRef<(() => void) | null>(null);
  useEffect(
    () => () => {
      rerollWaitRef.current?.();
      rerollWaitRef.current = null;
    },
    [],
  );

  // Bumped on every load and on every wallet-state reset, so a pre-flight that
  // resolves after the account changed (or after a disconnect) cannot write its
  // stale mintable/estimate over the current wallet's.
  const loadSeqRef = useRef(0);

  const activeRef = useRef(active);
  useEffect(() => {
    activeRef.current = active;
  }, [active]);

  // AuroraModal owns every dismissal path now; it seals them while a
  // transaction is in flight (I3 — the OpenSea/tx links in the done panel are
  // unrecoverable once lost).
  const sealed = phase.step === "minting";
  useEffect(() => {
    onSealedChange(sealed);
  }, [sealed, onSealedChange]);
  useEffect(() => () => onSealedChange(false), [onSealedChange]);

  // Once an account is known (either already-authorized on activate, or
  // freshly connected), run the two read-only pre-flights: can this be minted
  // at all, and what will it cost. Both are best-effort — a failure degrades
  // the small print to "—" rather than blocking the mint button.
  const loadForAccount = useCallback(
    async (addr: `0x${string}`, seed: AuroraSeed, snapshot: AuroraSnapshot) => {
      const seq = ++loadSeqRef.current;
      setEstimate("loading");
      try {
        const { checkMintable, estimateMint } = await import("../lib/mint");
        const [mintableResult, estimateResult] = await Promise.allSettled([
          checkMintable(addr, seed),
          estimateMint(addr, seed, snapshot),
        ]);
        if (!mountedRef.current || seq !== loadSeqRef.current) return;
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
        if (!mountedRef.current || seq !== loadSeqRef.current) return;
        // Could not even load the wallet code — leave the mint button
        // available (it will surface a real error if pressed) and show "—".
        setMintable("ok");
        setEstimate("error");
      }
    },
    [],
  );

  // Shared by clearWalletState and applyAccountChange's non-null branch: both
  // reset every read derived from *which* wallet is connected, bump
  // loadSeqRef so an in-flight loadForAccount from the account being left
  // cannot land after this point, and clear a stale connect/mint error (a
  // done phase holds the only copy of the OpenSea/tx links and is never
  // touched here). `subject` is deliberately left alone by both callers: the
  // aurora on screen is still the one you would mint, and re-capturing it is
  // the C1 provenance hazard.
  const resetWalletReads = useCallback(() => {
    loadSeqRef.current++;
    setMintable(null);
    setEstimate(null);
    setOwned(null);
    setOwnedImage(null);
    setPhase((p) => (p.step === "error" ? { step: "ready" } : p));
  }, []);

  const clearWalletState = useCallback(() => {
    setAccount(null);
    resetWalletReads();
  }, [resetWalletReads]);

  // EIP-1193 has no portable disconnect — wallet_revokePermissions is
  // MetaMask-only, and nothing lets a dApp make a wallet forget it in general.
  // So this is a local forget: drop the state, and stop the silent pre-fill
  // for the rest of the page session.
  const disconnect = useCallback(() => {
    suppressAutoConnect();
    clearWalletState();
  }, [clearWalletState]);

  // The switch itself. Resets every wallet-derived read and re-runs the
  // pre-flights against the SAME frozen seed and snapshot — a new account
  // changes who is minting, never what is being minted.
  const applyAccountChange = useCallback(
    (
      next: `0x${string}` | null,
      seed: AuroraSeed,
      snapshot: AuroraSnapshot,
    ) => {
      if (next === null) {
        // Locked, or the site's permission revoked from inside the wallet.
        // Same reset as an explicit disconnect, minus the suppression flag —
        // the visitor never asked this page to forget anything, so a later
        // unlock should pre-fill normally.
        clearWalletState();
        return;
      }
      // Switching accounts in the wallet is a reconnect intent, so it
      // overrides an earlier disconnect.
      allowAutoConnect();
      setAccount(next);
      resetWalletReads();
      void loadForAccount(next, seed, snapshot);
    },
    [clearWalletState, resetWalletReads, loadForAccount],
  );

  // Listens whenever a snapshot is frozen. Deliberately NOT gated on `active`:
  // that prop means "the mint segment is showing", not "the modal is open" —
  // the inactive segment stays mounted under `hidden`, and closing the modal
  // unmounts this component outright. Gating on it would miss a switch made
  // while the visitor is on the gallery tab.
  useEffect(() => {
    if (subject?.kind !== "ready") return;
    // A successful mint is a finished record: its OpenSea and transaction links
    // belong to the account that actually minted. Nothing about the wallet may
    // alter that panel, so we stop listening entirely rather than parking a
    // switch we would only discard.
    if (phase.step === "done") return;
    const { seed, snapshot } = subject;
    return subscribeAccountsChanged((next) => {
      if (!mountedRef.current) return;
      // Park BEFORE the sameAccount comparison. Switching away and back during
      // a mint must overwrite the park, not skip it — otherwise the drain later
      // applies an account the wallet has already left.
      if (phase.step === "minting") {
        pendingAccountRef.current = next;
        return;
      }
      if (sameAccount(next, account)) return;
      applyAccountChange(next, seed, snapshot);
    });
  }, [subject, account, phase.step, applyAccountChange]);

  // Deferred, not dropped: apply a parked switch once the mint is no longer in
  // flight. A *successful* mint is the exception — the done panel's OpenSea and
  // transaction links belong to the account that actually minted, and swapping
  // the account under them would misattribute the token. There the parked value
  // is discarded, not applied.
  useEffect(() => {
    if (phase.step === "minting") return;
    const pending = pendingAccountRef.current;
    if (pending === undefined) return;
    // Retain the park if it cannot be applied yet; only consume it once we
    // know this render can act on it.
    if (subject?.kind !== "ready") return;
    pendingAccountRef.current = undefined;
    if (phase.step === "done") return;
    if (sameAccount(pending, account)) return;
    applyAccountChange(pending, subject.seed, subject.snapshot);
  }, [phase.step, subject, account, applyAccountChange]);

  // Takes the snapshot and starts the read-only pre-flights. Split out so the
  // "still warming up" state can retry it in place without leaving the segment.
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
    // A disconnect earlier in this page session means the visitor asked us to
    // forget the wallet. eth_accounts would happily hand it straight back, so
    // reopening the modal must not silently re-fill it.
    if (isAutoConnectSuppressed()) return;
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

  // The snapshot freezes on entering the mint segment — not when the modal
  // opens. Browsing the gallery must leave "new aurora" usable, so
  // setMintActive rides the same edge. (C1: while a snapshot is frozen to a
  // specific seed, a reseed would let a mint go through against the wrong
  // one.)
  //
  // Guarded against double-firing during a reroll: reroll clears subject
  // (which would otherwise re-trigger prepare mid-crossfade).
  useEffect(() => {
    setMintActive(active);
    if (active && subject === null && !rerolling) prepare();
  }, [active, subject, rerolling, prepare]);

  // Mid-reroll segment switch: stop waiting on the fade and unstick the
  // panel. `subject` goes too — the hero has already reseeded, so the frozen
  // snapshot no longer shows the aurora on screen. Dropping it makes the next
  // activation re-prepare (WYSIWYG); keeping it would strand the panel on a
  // aurora the visitor can no longer see.
  useEffect(() => {
    if (!active && rerolling) {
      rerollWaitRef.current?.();
      rerollWaitRef.current = null;
      setRerolling(false);
      setSubject(null);
      setMintable(null);
      setEstimate(null);
      setPhase({ step: "ready" });
    }
  }, [active, rerolling]);

  useEffect(() => () => setMintActive(false), []);

  // "try another aurora", for the seed-taken dead end (very likely after
  // loading a minted aurora from the gallery). Cannot simply reseed() then
  // prepare(): capturing mid-crossfade blends two skies against one seed —
  // the hazard SkyControls' lockout guards against. So reseed, wait for the
  // fade to actually land, then re-capture.
  //
  // "Actually" is the whole point. This used to be setTimeout(FADE_MS), which
  // is wrong: the fade runs on the renderer's pause-adjusted clock, frozen
  // whenever the hero is scrolled out of view (the pills are fixed, so that
  // is the normal case here) or the tab is hidden. The timer would fire while
  // the aurora still showed the OLD seed's image, and the mint would pair that
  // image with the NEW seed — permanent on-chain corruption. whenSkySettled
  // is driven by the fade itself, so a stopped clock simply means we keep
  // waiting. captureFrame refuses mid-fade regardless.
  //
  // skyStore.reseed() has no internal mintActive guard (the lockout is
  // UI-side in SkyControls), so calling it from here is legal.
  //
  // Sky-bound state is cleared when the fade lands, not immediately:
  // clearing it in the same tick as setRerolling(true) would unmount the
  // snapshot and the "finding a new sky…" button before they can render
  // (React batches those updates).
  const reroll = useCallback(() => {
    rerollWaitRef.current?.();
    setRerolling(true);
    // reseed() first, then wait — not the other way round. whenSkySettled
    // fires immediately when no fade is in flight, so subscribing first
    // would resolve against the OLD aurora and re-capture mid-fade. After
    // reseed there are exactly two cases, both correct: running renderer →
    // a fade is in flight and the waiter is queued; paused renderer →
    // setSeed promoted synchronously, so the aurora is already settled on the
    // new seed and the callback runs right now.
    reseed();
    rerollWaitRef.current = whenSkySettled(() => {
      rerollWaitRef.current = null;
      if (!mountedRef.current) return;
      if (!activeRef.current) {
        setRerolling(false);
        return;
      }
      // `account` is deliberately left alone — the wallet stays connected
      // across a reroll, only the aurora-bound state resets. prepare() is left
      // to the active effect (subject === null && !rerolling) so it runs once.
      setSubject(null);
      setMintable(null);
      setEstimate(null);
      setPhase({ step: "ready" });
      setRerolling(false);
    });
  }, []);

  // The Basescan link. Lives behind the same dynamic import as everything
  // else in mint.ts — mintConfig pulls viem/chains, so a static import here
  // would drag viem into the entry chunk. Loaded once, then cached.
  useEffect(() => {
    if (!active || explorerUrl !== null) return;
    void (async () => {
      try {
        const { explorerContractUrl } = await import("../lib/mint");
        if (!mountedRef.current) return;
        setExplorerUrl(explorerContractUrl());
      } catch {
        // Leave the button out rather than render a dead link.
      }
    })();
  }, [active, explorerUrl]);

  // A wallet that has already minted gets its own aurora back: which token,
  // which seed, and (via onLoadSky) the ability to put it back on the page.
  useEffect(() => {
    if (!active || mintable !== "wallet-minted" || account === null) return;
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
  }, [active, mintable, account]);

  const connect = async (seed: AuroraSeed, snapshot: AuroraSnapshot) => {
    // Pressing connect revokes an earlier disconnect — without this, the
    // address would vanish again the next time the modal reopened.
    allowAutoConnect();
    setConnecting(true);
    setPhase({ step: "ready" });
    try {
      // Dynamic import so viem never lands in the entry chunk — mint.ts (and
      // everything it pulls in, including viem) only loads when the panel is
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
        // seed comes from the subject frozen when the segment activated, NOT a
        // fresh getSeed() read — see the Subject comment (C1).
        const { txUrl, openSeaUrl } = await mintSky(addr, seed, snapshot);
        if (!mountedRef.current) return;
        setPhase({ step: "done", txUrl, openSeaUrl });
        // The new token shifts every gallery page and changes the count.
        invalidateMintedTotal();
        onMinted();
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

  return (
    <div className="mx-auto w-full max-w-xs">
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
          {/* One image per state: a wallet that already minted sees
              its own aurora (in the recall panel below), not the
              capture preview it can never mint. */}
          {mintable !== "wallet-minted" && (
            <img
              src={subject.snapshot.dataUrl}
              alt="Your aurora snapshot"
              className={`mb-3 aspect-square w-full rounded-xl border border-glass-border object-cover${
                rerolling ? " opacity-40" : ""
              }`}
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
                  onClick={() => void connect(subject.seed, subject.snapshot)}
                  className={primaryButtonClass}
                >
                  {connecting ? "connecting…" : "connect wallet"}
                </button>
              ) : mintable === "seed-taken" ? (
                <div className="flex flex-col gap-2">
                  <p className="font-mono text-xs leading-relaxed text-muted">
                    this aurora is already minted — try another
                  </p>
                  <button
                    type="button"
                    disabled={rerolling}
                    onClick={reroll}
                    className={primaryButtonClass}
                  >
                    {rerolling ? "finding a new aurora…" : "try another aurora"}
                  </button>
                </div>
              ) : mintable === "wallet-minted" ? (
                // One mint per wallet — so instead of a dead end,
                // hand them their own aurora back: its seed, a way to
                // put it on the page (onLoadSky → applySeed + close), and
                // its OpenSea page.
                <div className="flex flex-col gap-2">
                  <p className="font-mono text-xs leading-relaxed text-muted">
                    {owned === "loading"
                      ? "each wallet gets one aurora — finding yours…"
                      : typeof owned === "object" && owned !== null
                        ? "each wallet gets one aurora. this is yours:"
                        : "each wallet gets one aurora, and this one already claimed its aurora"}
                  </p>
                  {(owned === "loading" || owned === "none") && (
                    <a
                      href={openseaCollectionUrl()}
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
                        onClick={() => onLoadSky(owned.seed)}
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
                <>
                  <button
                    type="button"
                    disabled={
                      rerolling || phase.step === "minting" || mintable === null
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
                  <button
                    type="button"
                    disabled={rerolling || phase.step === "minting"}
                    onClick={reroll}
                    className={buttonClass}
                  >
                    {rerolling ? "finding a new sky…" : "try another aurora"}
                  </button>
                </>
              )}

              {phase.step === "error" && (
                <p className="font-mono text-xs text-ember">{phase.message}</p>
              )}
            </div>
          )}

          {/* The gas/seed rows describe the mint candidate, which does not
              exist for a wallet that has already minted — but the wallet row
              does, and that is exactly the state where knowing *which* wallet
              claimed the aurora matters most. So the dl itself is no longer
              gated on wallet-minted; only the candidate rows are. */}
          {(mintable !== "wallet-minted" || account !== null) && (
            <dl className="mt-3 space-y-0.5 font-mono text-xs text-muted">
              {mintable !== "wallet-minted" && (
                <>
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
                </>
              )}
              {account !== null && (
                <div className="flex items-center justify-between gap-2">
                  <dt>wallet</dt>
                  <dd className="flex items-center gap-2" aria-label={account}>
                    {/* Truncated to fit the two-column list at 360px. `title`
                        surfaces the full address on mouse hover only — the
                        `aria-label` above is what makes it reachable without
                        one, so it can be checked against the wallet either
                        way. */}
                    <span title={account}>{truncateAddress(account)}</span>
                    <button
                      type="button"
                      onClick={disconnect}
                      // A completed mint's panel is immutable (see the
                      // subscription effect above) — disconnecting here would
                      // clear mintable and resurrect the candidate rows under
                      // a done panel describing a mint that already happened.
                      disabled={sealed || phase.step === "done"}
                      className="rounded-full border border-glass-border px-2 py-0.5 text-[10px] text-muted transition-colors hover:border-ember/60 hover:text-text disabled:cursor-default disabled:opacity-45 disabled:hover:border-glass-border disabled:hover:text-muted"
                    >
                      disconnect
                    </button>
                  </dd>
                </div>
              )}
            </dl>
          )}
        </>
      )}

      {!sealed && explorerUrl && (
        <div className="mt-3 border-t border-glass-border pt-3">
          <a
            href={explorerUrl}
            target="_blank"
            rel="noreferrer"
            className="rounded-full border border-glass-border px-2.5 py-1 font-mono text-[10px] text-muted transition-colors hover:border-ember/60 hover:text-text"
          >
            contract ↗
          </a>
        </div>
      )}
    </div>
  );
}
