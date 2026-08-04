import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
  applySeed,
  isMintActive,
  isWebglFailed,
  reseed,
  subscribeMintActive,
  subscribeWebglFailed,
  whenSkySettled,
} from "../lib/skyStore";
import { setBusy, subscribeIntent, type SkyIntent } from "../lib/skyIntents";
import { CONTRACT_DEPLOYED } from "../lib/contractAddress";
import { useReducedMotion } from "../hooks/useReducedMotion";
import { useMintedTotal } from "../hooks/useMintedTotal";
import { AuroraModal, type Segment } from "./AuroraModal";
import { AuroraGallery } from "./AuroraGallery";
import { MintPanel } from "./MintPanel";

import { pillClass } from "./pillClass";

export function SkyControls() {
  const reducedMotion = useReducedMotion();
  const webglFailed = useSyncExternalStore(subscribeWebglFailed, isWebglFailed);
  // C1 belt-and-braces: a frozen mint snapshot is bound to a specific seed,
  // so reseeding while the mint segment holds one would let a mint go through
  // against the wrong seed.
  const mintActive = useSyncExternalStore(subscribeMintActive, isMintActive);

  const [spinning, setSpinning] = useState(false);
  const [open, setOpen] = useState(false);
  // Pass `open` so the viem/mint chunk only loads when the modal is shown —
  // not on idle after first paint.
  const total = useMintedTotal(open);
  const [segment, setSegment] = useState<Segment>("gallery");
  const [sealed, setSealed] = useState(false);
  // Bumped after a successful mint so the gallery drops its page cache.
  const [cacheEpoch, setCacheEpoch] = useState(0);
  const spinWaitRef = useRef<(() => void) | null>(null);
  const galleryTriggerRef = useRef<HTMLButtonElement>(null);

  // `spinning` is this component's own lockout; `setBusy` mirrors it out so
  // the showcase card's "new aurora" action (which has no other way to know
  // a reseed is in flight) disables in step with the pill. Kept as a mirror
  // rather than the source of truth: skyIntents.ts is a plain module store,
  // and re-deriving `spinning` from it here would need its own subscription
  // for no benefit, since this component is the only writer.
  useEffect(() => setBusy(spinning), [spinning]);

  useEffect(
    () => () => {
      spinWaitRef.current?.();
      spinWaitRef.current = null;
      // Belt-and-braces for the case above: if unmount races a settle
      // callback that hasn't fired yet, the mirror above never runs again to
      // clear it, and the showcase button would stay disabled forever.
      setBusy(false);
    },
    [],
  );

  // Focus returns to whichever element opened the dialog, after it
  // re-enables — the top pill by default, or the showcase card's own button
  // when the gallery was opened via the intent bus (see the `gallery` intent
  // handler below).
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (open || !restoreFocusRef.current) return;
    const el = restoreFocusRef.current;
    restoreFocusRef.current = null;
    el.focus();
  }, [open]);

  const close = useCallback(() => {
    setOpen(false);
    setSegment("gallery");
    setSealed(false);
  }, []);

  // Shared by the pill's onClick and the `new-aurora` intent handler so the
  // reseed sequence — and the fade-aware lockout around it — exists in one
  // place. See the pill button below for why whenSkySettled, not a timer.
  const startReseed = useCallback(() => {
    spinWaitRef.current?.();
    setSpinning(true);
    reseed();
    spinWaitRef.current = whenSkySettled(() => {
      spinWaitRef.current = null;
      setSpinning(false);
    });
  }, []);

  const openGallery = useCallback((trigger: HTMLElement | null) => {
    setSegment("gallery");
    restoreFocusRef.current = trigger ?? galleryTriggerRef.current;
    setOpen(true);
  }, []);

  // Scrolls the hero back into view, then runs `run` once the scroll has
  // actually finished. Both halves of that are load-bearing:
  //
  // 1. The reseed must not start until the hero is on screen. The crossfade
  //    runs on the renderer's pause-adjusted clock, and AuroraHero pauses on
  //    an IntersectionObserver, so a reseed fired while the hero is still
  //    scrolled away leaves the fade frozen on its first frame and
  //    whenSkySettled never resolves. A requestAnimationFrame is NOT enough
  //    here - it lands one frame after the scroll *starts*, ~1.5s before a
  //    smooth scroll of this distance arrives.
  // 2. Nothing may steal focus while the scroll animates. Chrome cancels an
  //    in-flight programmatic smooth scroll when focus moves, and disabling
  //    the element that currently has focus moves it - so flipping the
  //    clicked button's `disabled` mid-scroll killed the scroll ~6px in
  //    (measured). Deferring the reseed until after arrival means `spinning`
  //    (and the `disabled` it drives) only flips once the scroll is over.
  const scrollWaitRef = useRef<(() => void) | null>(null);
  const scrollToHeroThen = useCallback(
    (run: () => void) => {
      if (window.scrollY === 0) {
        run();
        return;
      }
      // A second request while one is pending would queue a duplicate reseed:
      // `spinning` is still false until the first one arrives.
      if (scrollWaitRef.current) return;

      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        window.removeEventListener("scrollend", finish);
        clearTimeout(timer);
        scrollWaitRef.current = null;
        run();
      };
      // scrollend also fires when the scroll is interrupted (a wheel gesture
      // cancels it), which is what we want - reseed against wherever the
      // reader actually ended up. The timeout covers browsers without the
      // event and a scroll that never moves at all.
      const timer = setTimeout(finish, 1500);
      window.addEventListener("scrollend", finish);
      scrollWaitRef.current = () => {
        window.removeEventListener("scrollend", finish);
        clearTimeout(timer);
      };

      // Respect reduced motion rather than hardcoding "smooth": the media
      // query in index.css already forces `scroll-behavior: auto` back on, so
      // an explicit "smooth" here would fight it.
      window.scrollTo({ top: 0, behavior: reducedMotion ? "auto" : "smooth" });
    },
    [reducedMotion],
  );

  useEffect(
    () => () => {
      scrollWaitRef.current?.();
      scrollWaitRef.current = null;
    },
    [],
  );

  // Services both intents the showcase card's AuroraShowcaseActions can fire.
  // Re-subscribes whenever the guard conditions change so the closure inside
  // never checks stale `spinning`/`mintActive`/`open` values.
  useEffect(() => {
    return subscribeIntent((intent: SkyIntent) => {
      if (intent.type === "new-aurora") {
        // Same guard as the pill's `disabled` below — the intent is a plain
        // function call, not a DOM click, so a disabled-looking showcase
        // button doesn't stop it from firing on its own.
        if (spinning || mintActive) return;
        scrollToHeroThen(startReseed);
      } else if (intent.type === "gallery") {
        if (open || spinning) return;
        openGallery(intent.trigger);
      }
    });
  }, [spinning, mintActive, open, startReseed, openGallery, scrollToHeroThen]);

  const loadSky = useCallback(
    (seed: number) => {
      applySeed(seed);
      close(); // so the crossfade is actually visible
    },
    [close],
  );

  const onMinted = useCallback(() => setCacheEpoch((e) => e + 1), []);

  // The static reduced-motion / no-WebGL fallback ignores the seed, so
  // "new aurora" would do nothing and there is no live canvas to capture for
  // a mint. The gallery is on-chain data and stands on its own — keep it.
  const liveSky = !reducedMotion && !webglFailed;

  const galleryLabel = "mint your own · view gallery";

  return (
    <>
      {/* Absolute, not fixed: the pills belong to the top of the page next to
          the hero they act on, and scroll away with it instead of following the
          reader down over the content. No positioned ancestor, so this resolves
          against the initial containing block. */}
      <div className="absolute top-4 right-4 z-40 flex items-center gap-2">
        {liveSky && (
          <button
            type="button"
            // Locked out for the length of the crossfade (a second click
            // mid-fade would cut the transition short) and while a mint
            // snapshot is frozen (C1 above).
            disabled={spinning || mintActive}
            // Was a setTimeout(FADE_MS). That measured wall clock while the
            // fade runs on the renderer's pause-adjusted clock, so once the
            // hero scrolled out of view the lockout lifted on a sky still
            // frozen mid-transition — and the mint path it guards would then
            // capture the old image against the new seed. Wait for the fade
            // itself instead (see startReseed / whenSkySettled).
            onClick={startReseed}
            className={pillClass}
          >
            <span
              aria-hidden="true"
              className={
                spinning ? "inline-block animate-spin" : "inline-block"
              }
            >
              ✦
            </span>
            new aurora
          </button>
        )}
        {CONTRACT_DEPLOYED && (
          <button
            ref={galleryTriggerRef}
            type="button"
            // `spinning` too, not just `open`: this pill is the only route to
            // the mint segment, and entering it mid-crossfade would freeze a
            // snapshot of two blended skies against one seed. The original
            // MintButton carried the same `disabled={spinning}` guard.
            disabled={open || spinning}
            onClick={() => openGallery(galleryTriggerRef.current)}
            className={`${pillClass} text-ember`}
          >
            <span className="tabular-nums">{galleryLabel}</span>
          </button>
        )}
      </div>

      {open && (
        <AuroraModal
          title="aurora, on-chain"
          subtitle={total === null ? "" : `${total} minted`}
          segment={segment}
          onSegment={setSegment}
          showMintSegment={liveSky}
          sealed={sealed}
          onClose={close}
        >
          {/* Both segments stay mounted: after a successful mint the done
              panel holds the only copy of the OpenSea and transaction links
              (one mint per wallet), so a trip to the gallery must not unmount
              it. AuroraModal's focus trap filters unrendered elements. */}
          <div hidden={segment !== "gallery"}>
            <AuroraGallery
              active={segment === "gallery"}
              canLoadSky={liveSky}
              onLoadSky={loadSky}
              cacheEpoch={cacheEpoch}
            />
          </div>
          {liveSky && (
            <div hidden={segment !== "mint"}>
              <MintPanel
                active={segment === "mint"}
                onSealedChange={setSealed}
                onMinted={onMinted}
                onLoadSky={loadSky}
              />
            </div>
          )}
        </AuroraModal>
      )}
    </>
  );
}
