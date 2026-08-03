import { useEffect, useRef, useState } from "react";
// From contractAddress, NOT mintConfig: mintConfig imports viem/chains, and
// this component is reached from the entry chunk.
import { GALLERY_PAGE_SIZE, basescanTokenUrl } from "../lib/contractAddress";
import { createPageCache } from "../lib/pageCache";
import { setMintedTotal } from "../lib/mintedTotal";
import { formatBytes, truncateAddress } from "../lib/format";
import { dataUrlBytes } from "../lib/capture";

type GalleryItem = {
  tokenId: bigint;
  seed: number;
  dataUrl: string;
  openSeaUrl: string;
};

type Page = { items: GalleryItem[]; total: number };

type State =
  | { status: "loading" }
  | { status: "error" }
  | { status: "loaded"; page: Page };

// null = not looked up, "loading", or the address / "failed".
type Owner = null | "loading" | "failed" | string;

type AuroraGalleryProps = {
  active: boolean;
  canLoadSky: boolean;
  onLoadSky: (seed: number) => void;
  cacheEpoch: number;
};

const buttonClass =
  "rounded-full border border-glass-border bg-glass px-4 py-2 font-mono text-xs text-muted backdrop-blur-xl transition-colors hover:border-ember/60 hover:text-text disabled:cursor-default disabled:opacity-45 disabled:hover:border-glass-border disabled:hover:text-muted";

const primaryButtonClass =
  "rounded-full border border-ember/60 bg-ember/10 px-4 py-2 font-mono text-xs text-ember backdrop-blur-xl transition-colors hover:bg-ember/20";

const pagerClass =
  "rounded-full border border-glass-border px-2.5 py-1 transition-colors hover:border-ember/60 hover:text-text disabled:cursor-default disabled:opacity-40 disabled:hover:border-glass-border disabled:hover:text-muted";

// One row of placeholders, sized to the grid below so nothing shifts when the
// real tiles arrive. Every aurora is square, so the skeleton can claim the
// exact final height. Column counts track the gallery grid: 2 / 3 / 5, and the
// surplus tiles hide at the narrower breakpoints to keep it to a single row.
const SKELETON_TILES = [
  "",
  "",
  "hidden min-[420px]:block",
  "hidden lg:block",
  "hidden lg:block",
];

const SHIMMER =
  "h-full w-full animate-shimmer bg-[length:200%_100%] bg-[linear-gradient(110deg,transparent_30%,rgba(124,108,246,0.22)_45%,rgba(53,224,194,0.18)_58%,transparent_72%)]";

function GallerySkeleton() {
  return (
    <div role="status" aria-busy="true">
      <span className="sr-only">loading minted auroras</span>
      <ul
        aria-hidden="true"
        className="grid grid-cols-2 gap-2 min-[420px]:grid-cols-3 lg:grid-cols-5"
      >
        {SKELETON_TILES.map((visibility, i) => (
          <li key={i} className={visibility}>
            <div className="flex w-full flex-col gap-1">
              <div className="aspect-square w-full overflow-hidden rounded-lg border border-glass-border bg-glass">
                {/* Slight stagger so the row reads as one wave rather than five
                    tiles pulsing in lockstep. Kept well under the sweep's own
                    duration - a larger offset puts neighbouring tiles far
                    enough out of phase that the row looks choppy instead. */}
                <div
                  className={SHIMMER}
                  style={{ animationDelay: `${i * 45}ms` }}
                />
              </div>
              <div className="h-2.5 w-6 rounded bg-glass" />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function AuroraGallery({
  active,
  canLoadSky,
  onLoadSky,
  cacheEpoch,
}: AuroraGalleryProps) {
  const [page, setPage] = useState(0);
  const [state, setState] = useState<State>({ status: "loading" });
  const [selected, setSelected] = useState<GalleryItem | null>(null);
  // Entering and leaving the detail view unmounts whatever was focused (the
  // tile, or "← all auroras"), dropping focus to <body> — outside the
  // modal's trap until the next Tab recovers it. Hand focus over explicitly
  // instead, and remember which tile to return it to.
  const backRef = useRef<HTMLButtonElement>(null);
  const returnTileRef = useRef<string | null>(null);
  const tileRefs = useRef(new Map<string, HTMLButtonElement>());
  const [owner, setOwner] = useState<Owner>(null);
  // Reload token: bumping it refetches the current page after an error.
  const [attempt, setAttempt] = useState(0);

  const cacheRef = useRef(createPageCache<Page>());
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // A successful mint shifts every page by one token, so the whole cache goes.
  //
  // Skips its own mount run. This effect is declared before the page loader,
  // so on mount it would queue setAttempt(1) while the loader started fetching
  // page 0 against attempt 0 — the re-render then cancels that request and
  // issues a second one, throwing away ~135 kB of already-fetched on-chain
  // image bytes on every single open.
  const lastEpochRef = useRef(cacheEpoch);
  useEffect(() => {
    if (lastEpochRef.current === cacheEpoch) return;
    lastEpochRef.current = cacheEpoch;
    cacheRef.current.clear();
    setPage(0);
    setSelected(null);
    setAttempt((a) => a + 1);
  }, [cacheEpoch]);

  // Page loader. Serves from cache when it can; the cancelled flag stops a
  // slow page-0 response from overwriting a page-1 one.
  useEffect(() => {
    if (!active) return;
    const cached = cacheRef.current.get(page);
    if (cached) {
      setState({ status: "loaded", page: cached });
      return;
    }
    let cancelled = false;
    setState({ status: "loading" });
    void (async () => {
      try {
        const { fetchMintedAuroras } = await import("../lib/mint");
        const result = await fetchMintedAuroras(page, GALLERY_PAGE_SIZE);
        if (cancelled || !mountedRef.current) return;
        cacheRef.current.set(page, result);
        setMintedTotal(result.total);
        setState({ status: "loaded", page: result });
      } catch (err) {
        console.error(err);
        if (cancelled || !mountedRef.current) return;
        setState({ status: "error" });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [active, page, attempt]);

  // Owner of the selected token. Best-effort: fetchTokenOwner swallows its own
  // failure and returns null, and the panel renders "—" without it.
  useEffect(() => {
    if (!selected) {
      setOwner(null);
      return;
    }
    let cancelled = false;
    setOwner("loading");
    void (async () => {
      try {
        const { fetchTokenOwner } = await import("../lib/mint");
        const address = await fetchTokenOwner(selected.tokenId);
        if (cancelled || !mountedRef.current) return;
        setOwner(address ?? "failed");
      } catch {
        if (cancelled || !mountedRef.current) return;
        setOwner("failed");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selected]);

  // Hand focus to "← all auroras" on entering the detail view, and back to
  // the tile that opened it on leaving. Runs after the relevant render, so
  // the target exists by the time we reach for it.
  useEffect(() => {
    if (!active) return;
    if (selected) {
      backRef.current?.focus();
      return;
    }
    const tokenId = returnTileRef.current;
    if (tokenId === null) return;
    returnTileRef.current = null;
    tileRefs.current.get(tokenId)?.focus();
  }, [active, selected]);

  if (selected) {
    const bytes = dataUrlBytes(selected.dataUrl);
    const ownerText =
      owner === "loading"
        ? "…"
        : owner === null || owner === "failed"
          ? "—"
          : truncateAddress(owner);
    return (
      <div>
        <button
          ref={backRef}
          type="button"
          onClick={() => setSelected(null)}
          className="mb-3 rounded-full border border-glass-border px-2.5 py-1 font-mono text-[10px] text-muted transition-colors hover:border-ember/60 hover:text-text"
        >
          ← all auroras
        </button>
        <div className="flex flex-col gap-4 sm:flex-row">
          <img
            src={selected.dataUrl}
            alt={`Aurora #${selected.tokenId}`}
            className="aspect-square w-full rounded-xl border border-glass-border object-cover sm:max-w-xs"
          />
          <div className="flex min-w-0 flex-1 flex-col gap-3">
            <h3 className="font-display text-sm font-semibold text-text">
              aurora #{String(selected.tokenId)}
            </h3>
            <dl className="space-y-0.5 font-mono text-xs text-muted">
              <div className="flex justify-between gap-2">
                <dt>seed</dt>
                <dd className="tabular-nums">{selected.seed}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt>owner</dt>
                <dd>{ownerText}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt>image</dt>
                <dd>{formatBytes(bytes)}, on-chain</dd>
              </div>
            </dl>
            <div className="flex flex-col gap-2">
              {/* Hidden under reduced motion / WebGL failure: the static
                  fallback ignores the seed, so the button would do nothing. */}
              {canLoadSky && (
                <button
                  type="button"
                  onClick={() => onLoadSky(selected.seed)}
                  className={primaryButtonClass}
                >
                  load this aurora
                </button>
              )}
              <div className="flex flex-wrap gap-2">
                <a
                  href={selected.openSeaUrl}
                  target="_blank"
                  rel="noreferrer"
                  className={`${buttonClass} flex-1 text-center`}
                >
                  OpenSea ↗
                </a>
                <a
                  href={basescanTokenUrl(selected.tokenId)}
                  target="_blank"
                  rel="noreferrer"
                  className={`${buttonClass} flex-1 text-center`}
                >
                  Basescan ↗
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (state.status === "loading") return <GallerySkeleton />;

  if (state.status === "error")
    return (
      <div className="flex flex-col items-start gap-2">
        <p className="font-mono text-xs text-ember">
          could not load the gallery — try again
        </p>
        <button
          type="button"
          onClick={() => setAttempt((a) => a + 1)}
          className={buttonClass}
        >
          retry
        </button>
      </div>
    );

  if (state.page.items.length === 0)
    return <p className="font-mono text-xs text-muted">no skies minted yet</p>;

  const pageCount = Math.max(
    1,
    Math.ceil(state.page.total / GALLERY_PAGE_SIZE),
  );

  return (
    <>
      <ul className="grid grid-cols-2 gap-2 min-[420px]:grid-cols-3 lg:grid-cols-5">
        {state.page.items.map((item) => (
          <li key={String(item.tokenId)}>
            <button
              ref={(el) => {
                const key = String(item.tokenId);
                if (el) tileRefs.current.set(key, el);
                else tileRefs.current.delete(key);
              }}
              type="button"
              onClick={() => {
                returnTileRef.current = String(item.tokenId);
                setSelected(item);
              }}
              className="group flex w-full flex-col gap-1 rounded-lg text-left"
            >
              <img
                src={item.dataUrl}
                alt={`Aurora #${item.tokenId}`}
                className="aspect-square w-full rounded-lg border border-glass-border object-cover transition-colors group-hover:border-ember/60"
              />
              <span className="font-mono text-[10px] text-muted transition-colors group-hover:text-ember">
                #{String(item.tokenId)}
              </span>
            </button>
          </li>
        ))}
      </ul>
      {state.page.total > GALLERY_PAGE_SIZE && (
        <div className="mt-3 flex items-center justify-between gap-2 font-mono text-[10px] text-muted">
          <button
            type="button"
            disabled={page === 0}
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            className={pagerClass}
          >
            ← prev
          </button>
          <span className="tabular-nums">
            page {page + 1} / {pageCount}
          </span>
          <button
            type="button"
            disabled={page + 1 >= pageCount}
            onClick={() => setPage((p) => p + 1)}
            className={pagerClass}
          >
            next →
          </button>
        </div>
      )}
    </>
  );
}
