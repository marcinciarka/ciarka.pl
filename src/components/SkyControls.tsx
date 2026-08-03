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
import { CONTRACT_DEPLOYED } from "../lib/contractAddress";
import { useReducedMotion } from "../hooks/useReducedMotion";
import { useMintedTotal } from "../hooks/useMintedTotal";
import { AuroraModal, type Segment } from "./AuroraModal";
import { AuroraGallery } from "./AuroraGallery";
import { MintPanel } from "./MintPanel";

const pillClass =
  "flex items-center gap-2 rounded-full border border-glass-border bg-glass px-4 py-2 font-mono text-xs text-muted backdrop-blur-xl transition-colors hover:border-ember/60 hover:text-text disabled:cursor-default disabled:opacity-45 disabled:hover:border-glass-border disabled:hover:text-muted cursor-pointer";

export function SkyControls() {
  const reducedMotion = useReducedMotion();
  const webglFailed = useSyncExternalStore(subscribeWebglFailed, isWebglFailed);
  // C1 belt-and-braces: a frozen mint snapshot is bound to a specific seed,
  // so reseeding while the mint segment holds one would let a mint go through
  // against the wrong seed.
  const mintActive = useSyncExternalStore(subscribeMintActive, isMintActive);
  const total = useMintedTotal();

  const [spinning, setSpinning] = useState(false);
  const [open, setOpen] = useState(false);
  const [segment, setSegment] = useState<Segment>("gallery");
  const [sealed, setSealed] = useState(false);
  // Bumped after a successful mint so the gallery drops its page cache.
  const [cacheEpoch, setCacheEpoch] = useState(0);
  const spinWaitRef = useRef<(() => void) | null>(null);
  const galleryTriggerRef = useRef<HTMLButtonElement>(null);

  useEffect(
    () => () => {
      spinWaitRef.current?.();
      spinWaitRef.current = null;
    },
    [],
  );

  // Focus returns to the pill that opened the dialog, after it re-enables.
  const restoreFocusRef = useRef(false);
  useEffect(() => {
    if (open || !restoreFocusRef.current) return;
    restoreFocusRef.current = false;
    galleryTriggerRef.current?.focus();
  }, [open]);

  const close = useCallback(() => {
    setOpen(false);
    setSegment("gallery");
    setSealed(false);
  }, []);

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

  const galleryLabel =
    total === null ? "on-chain gallery" : `mint your own · ${total} minted`;

  return (
    <>
      <div className="fixed top-4 right-4 z-40 flex items-center gap-2">
        {liveSky && (
          <button
            type="button"
            // Locked out for the length of the crossfade (a second click
            // mid-fade would cut the transition short) and while a mint
            // snapshot is frozen (C1 above).
            disabled={spinning || mintActive}
            onClick={() => {
              // Was a setTimeout(FADE_MS). That measured wall clock while the
              // fade runs on the renderer's pause-adjusted clock, so once the
              // hero scrolled out of view the lockout lifted on a sky still
              // frozen mid-transition — and the mint path it guards would
              // then capture the old image against the new seed. Wait for the
              // fade itself instead. reseed() before subscribing: with no
              // fade in flight whenSkySettled resolves immediately.
              spinWaitRef.current?.();
              setSpinning(true);
              reseed();
              spinWaitRef.current = whenSkySettled(() => {
                spinWaitRef.current = null;
                setSpinning(false);
              });
            }}
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
            onClick={() => {
              setSegment("gallery");
              restoreFocusRef.current = true;
              setOpen(true);
            }}
            className={pillClass}
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
