import { useRef, useSyncExternalStore } from "react";
import { isWebglFailed, subscribeWebglFailed } from "../lib/skyStore";
import {
  isBusy,
  requestGallery,
  requestNewAurora,
  subscribeBusy,
} from "../lib/skyIntents";
import {
  explorerContractUrl,
  openseaCollectionUrl,
} from "../lib/contractAddress";
import { useReducedMotion } from "../hooks/useReducedMotion";
import { pillClass } from "./pillClass";

// Mirrors the hero's top-right pills so the aurora showcase card reads as
// the same feature rather than a second, slightly different control surface.
export function AuroraShowcaseActions() {
  const reducedMotion = useReducedMotion();
  const webglFailed = useSyncExternalStore(subscribeWebglFailed, isWebglFailed);
  const busy = useSyncExternalStore(subscribeBusy, isBusy);
  const galleryButtonRef = useRef<HTMLButtonElement>(null);

  // Same rationale as SkyControls' `liveSky`: the static fallback ignores the
  // seed, so "new aurora" would silently do nothing with no live canvas to
  // reseed.
  const liveSky = !reducedMotion && !webglFailed;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {liveSky && (
        <button
          type="button"
          disabled={busy}
          onClick={() => requestNewAurora()}
          className={pillClass}
        >
          <span aria-hidden="true" className="inline-block">
            ✦
          </span>
          new aurora
        </button>
      )}
      <button
        ref={galleryButtonRef}
        type="button"
        // Matches the top pill's `disabled={open || spinning}`: SkyControls
        // ignores a gallery intent fired mid-reseed, so without this the
        // button would look live and silently do nothing.
        disabled={busy}
        // Passes its own element so SkyControls returns focus here (not to
        // the top pill) once the modal closes.
        onClick={() => requestGallery(galleryButtonRef.current)}
        className={`${pillClass} text-ember`}
      >
        view gallery
      </button>
      <a
        href={explorerContractUrl()}
        target="_blank"
        rel="noreferrer"
        className={pillClass}
      >
        Basescan ↗
      </a>
      <a
        href={openseaCollectionUrl()}
        target="_blank"
        rel="noreferrer"
        className={pillClass}
      >
        OpenSea ↗
      </a>
    </div>
  );
}
