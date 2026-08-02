import type { AuroraSeed } from "./seed";
import { isWebpDataUrl, type AuroraSnapshot } from "./capture";
import {
  AURORA_SKY_ABI,
  CHAINLINK_AGGREGATOR_ABI,
  CHAINLINK_ETH_USD,
  CHAINLINK_ETH_USD_DECIMALS,
  CONTRACT_ADDRESS,
  EXPLORER_BASE,
  MAX_IMAGE_BYTES,
  MINT_CHAIN,
  computeTotalUsd,
  dataUrlToBytes,
  hexBytesToDataUrl,
  openSeaUrl as buildOpenSeaUrl,
  pageTokenIds,
} from "./mintConfig";
// mint.ts is only ever reached via a dynamic `import("../lib/mint")`
// (see MintButton), so a static import of viem here is safe — it never
// touches the entry chunk, it just makes viem load as soon as mint.ts
// does instead of only inside each function's own `await import("viem")`.
import { BaseError } from "viem";
import type { PublicClient } from "viem";

// Public Base RPCs used as fallbacks behind the chain's default
// (mainnet.base.org), which has been returning 429s under load. viem's
// fallback transport moves to the next URL on failure — including rate
// limits — so a single throttled provider no longer breaks reads.
const FALLBACK_RPC_URLS = [
  "https://base-rpc.publicnode.com",
  "https://base.drpc.org",
  "https://base.llamarpc.com",
  "https://base.meowrpc.com",
  "https://gateway.tenderly.co/public/base",
  "https://base.lava.build",
];

// One shared read client for the whole module: every read path used to
// build its own client on the bare default transport, multiplying requests
// against the one rate-limited endpoint.
let publicClientPromise: Promise<PublicClient> | null = null;

function getPublicClient(): Promise<PublicClient> {
  publicClientPromise ??= (async () => {
    const { createPublicClient, fallback, http } = await import("viem");
    return createPublicClient({
      chain: MINT_CHAIN,
      transport: fallback([
        http(), // chain default first: mainnet.base.org
        ...FALLBACK_RPC_URLS.map((url) => http(url)),
      ]),
    }) as PublicClient;
  })();
  return publicClientPromise;
}

// Re-exported so callers (MintButton) can reach `openSeaUrl` through the
// same dynamic `import("../lib/mint")` used for minting, instead of
// statically importing mintConfig.ts — which pulls in `viem/chains` and
// would otherwise land that weight in the entry chunk.
export { openSeaUrl, explorerContractUrl } from "./mintConfig";

export class NoWalletError extends Error {
  constructor() {
    super("No browser wallet found");
  }
}
export class SeedTakenError extends Error {
  constructor() {
    super("This sky has already been minted");
  }
}
export class WebpRequiredError extends Error {
  constructor() {
    super("Only WebP snapshots can be minted");
  }
}
export class ImageTooLargeError extends Error {
  constructor() {
    super("Snapshot too large to mint");
  }
}

// EIP-1193's "user rejected" code. viem wraps the raw provider error in a
// BaseError chain (writeContract/switchChain failures land several `.cause`
// levels deep), so a naive `err.code === 4001` check on the top-level error
// misses it. requestAddresses, on the other hand, can throw the raw
// EIP-1193 error directly — hence the manual fallback walk below for
// non-viem errors.
export function isUserRejection(err: unknown): boolean {
  if (err instanceof BaseError) {
    return err.walk((e) => (e as { code?: number }).code === 4001) !== null;
  }
  let cause: unknown = err;
  while (cause && typeof cause === "object") {
    if ((cause as { code?: number }).code === 4001) return true;
    cause = (cause as { cause?: unknown }).cause;
  }
  return false;
}

// Shared guard, run first thing by both estimateMint and mintSky: a
// WebP-or-nothing payload must still be WebP-and-under-the-cap right before
// it's used, not just at capture time. Deliberately ordered before any
// wallet/network access below so both callers are testable in Node without
// window.ethereum.
function validateSnapshot(snapshot: AuroraSnapshot): void {
  if (snapshot.mime !== "image/webp" || !isWebpDataUrl(snapshot.dataUrl)) {
    throw new WebpRequiredError();
  }
  if (snapshot.bytes > MAX_IMAGE_BYTES) {
    throw new ImageTooLargeError();
  }
}

function getEthereum(): unknown {
  return (window as { ethereum?: unknown }).ethereum;
}

// eth_accounts: returns already-authorized accounts without prompting the
// user. Used by the mint modal to silently pre-fill a connected account on
// open, instead of firing a connect prompt just for rendering.
export async function getConnectedAccount(): Promise<`0x${string}` | null> {
  const ethereum = getEthereum();
  if (!ethereum) return null;
  const { createWalletClient, custom } = await import("viem");
  const walletClient = createWalletClient({
    chain: MINT_CHAIN,
    transport: custom(ethereum as Parameters<typeof custom>[0]),
  });
  const [account] = await walletClient.getAddresses();
  return account ?? null;
}

// eth_requestAccounts (prompts the user) + chain switch/add. Split out of
// mintSky so the modal can connect ahead of estimateMint/checkMintable,
// which both need an account but shouldn't each carry their own connect
// flow.
export async function connectWallet(): Promise<`0x${string}`> {
  const ethereum = getEthereum();
  if (!ethereum) throw new NoWalletError();

  const { createWalletClient, custom } = await import("viem");
  const walletClient = createWalletClient({
    chain: MINT_CHAIN,
    transport: custom(ethereum as Parameters<typeof custom>[0]),
  });
  const [account] = await walletClient.requestAddresses();
  await walletClient.switchChain({ id: MINT_CHAIN.id }).catch(async () => {
    await walletClient.addChain({ chain: MINT_CHAIN });
    await walletClient.switchChain({ id: MINT_CHAIN.id });
  });
  return account;
}

// Reads both on-chain guards the modal needs before offering a mint action:
// has this seed already been minted (by anyone), and has this wallet
// already minted (one-per-wallet). Read-only — no wallet prompt.
export async function checkMintable(
  account: `0x${string}`,
  seed: AuroraSeed,
): Promise<"ok" | "seed-taken" | "wallet-minted"> {
  const publicClient = await getPublicClient();

  // allSettled, not all: these are two independent guards, and one RPC
  // failing must not throw away the other's answer. Promise.all would reject
  // the whole call the moment either read failed, and the caller degrades a
  // rejection to "ok" — so a flaky hasMinted read would hide a *known*
  // seed-taken verdict and offer a mint that can only revert. Report the
  // strictest verdict we actually managed to read; only a double failure
  // degrades to "ok".
  const [takenResult, mintedResult] = await Promise.allSettled([
    publicClient.readContract({
      address: CONTRACT_ADDRESS,
      abi: AURORA_SKY_ABI,
      functionName: "seedMinted",
      args: [seed],
    }),
    publicClient.readContract({
      address: CONTRACT_ADDRESS,
      abi: AURORA_SKY_ABI,
      functionName: "hasMinted",
      args: [account],
    }),
  ]);
  if (takenResult.status === "fulfilled" && takenResult.value)
    return "seed-taken";
  if (mintedResult.status === "fulfilled" && mintedResult.value)
    return "wallet-minted";
  return "ok";
}

// Multicall3 (which Base has, and viem's `multicall` uses automatically)
// caps calldata/return size well before 100 `ownerOf`/`seedOf`/`imageOf`
// reads would hit it, but batching defensively here also bounds how much
// work a single round trip does as the collection grows.
const MULTICALL_BATCH = 100n;

// Wallet-token recall for the mint modal: does this account already own a
// minted aurora? totalMinted → ownerOf batched newest-first (most likely to
// be the wallet's own recent mint, and matches the gallery's ordering) →
// seedOf for whichever token matches. Read-only, no wallet prompt.
export async function findMintedToken(
  account: `0x${string}`,
): Promise<{ tokenId: bigint; seed: number } | null> {
  const publicClient = await getPublicClient();

  const total = await publicClient.readContract({
    address: CONTRACT_ADDRESS,
    abi: AURORA_SKY_ABI,
    functionName: "totalMinted",
  });
  if (total === 0n) return null;

  const wanted = account.toLowerCase();
  for (let end = total; end >= 1n; end -= MULTICALL_BATCH) {
    const start = end - MULTICALL_BATCH + 1n > 1n ? end - MULTICALL_BATCH + 1n : 1n;
    const ids: bigint[] = [];
    for (let id = end; id >= start; id--) ids.push(id);

    const owners = await publicClient.multicall({
      contracts: ids.map((tokenId) => ({
        address: CONTRACT_ADDRESS,
        abi: AURORA_SKY_ABI,
        functionName: "ownerOf",
        args: [tokenId],
      })),
      allowFailure: true,
    });

    const matchIndex = owners.findIndex(
      (r) => r.status === "success" && (r.result as unknown as string).toLowerCase() === wanted,
    );
    if (matchIndex !== -1) {
      const tokenId = ids[matchIndex];
      const seed = await publicClient.readContract({
        address: CONTRACT_ADDRESS,
        abi: AURORA_SKY_ABI,
        functionName: "seedOf",
        args: [tokenId],
      });
      return { tokenId, seed: Number(seed) };
    }
    if (start === 1n) break;
  }
  return null;
}

// One page of the "all minted auroras" gallery: newest-first, `imageOf` +
// `seedOf` multicalled together for the page's token ids. Images run ~9KB
// each, hence the 12/page default — big enough to feel like a gallery,
// small enough that a page of multicalls stays a single reasonable RPC
// round trip.
export async function fetchMintedAuroras(
  page: number,
  pageSize = 12,
): Promise<{
  items: { tokenId: bigint; seed: number; dataUrl: string; openSeaUrl: string }[];
  total: number;
}> {
  const publicClient = await getPublicClient();

  const totalBig = await publicClient.readContract({
    address: CONTRACT_ADDRESS,
    abi: AURORA_SKY_ABI,
    functionName: "totalMinted",
  });
  const total = Number(totalBig);
  const ids = pageTokenIds(total, page, pageSize);
  if (ids.length === 0) return { items: [], total };

  const [seeds, images] = await Promise.all([
    publicClient.multicall({
      contracts: ids.map((tokenId) => ({
        address: CONTRACT_ADDRESS,
        abi: AURORA_SKY_ABI,
        functionName: "seedOf",
        args: [tokenId],
      })),
      allowFailure: false,
    }),
    publicClient.multicall({
      contracts: ids.map((tokenId) => ({
        address: CONTRACT_ADDRESS,
        abi: AURORA_SKY_ABI,
        functionName: "imageOf",
        args: [tokenId],
      })),
      allowFailure: false,
    }),
  ]);

  const items = ids.map((tokenId, i) => ({
    tokenId,
    seed: Number(seeds[i]),
    dataUrl: hexBytesToDataUrl(images[i] as unknown as string),
    openSeaUrl: buildOpenSeaUrl(tokenId),
  }));

  return { items, total };
}

// Gas estimate for the mint the modal is about to offer, so the user sees a
// cost before signing. Runs the same snapshot guard as mintSky, before any
// network access, so a rejected snapshot never reaches estimateContractGas.
export async function estimateMint(
  account: `0x${string}`,
  seed: AuroraSeed,
  snapshot: AuroraSnapshot,
): Promise<{ gas: bigint; gasPriceWei: bigint; totalEth: string; totalUsd: string | null }> {
  validateSnapshot(snapshot);

  const { formatEther } = await import("viem");
  const publicClient = await getPublicClient();
  const { hex } = dataUrlToBytes(snapshot.dataUrl);

  // The oracle read runs alongside the gas estimate/price, not after: it's
  // independent of both, and a slow or failing oracle must never delay (or
  // fail) the ETH estimate the modal's already showing. Failure degrades to
  // `null` via .catch rather than Promise.all's fail-everything behavior.
  const [gas, gasPriceWei, oracleResult] = await Promise.all([
    publicClient.estimateContractGas({
      account,
      address: CONTRACT_ADDRESS,
      abi: AURORA_SKY_ABI,
      functionName: "mint",
      args: [hex, seed],
    }),
    publicClient.getGasPrice(),
    publicClient
      .readContract({
        address: CHAINLINK_ETH_USD,
        abi: CHAINLINK_AGGREGATOR_ABI,
        functionName: "latestRoundData",
      })
      .catch(() => null),
  ]);

  const weiSpent = gas * gasPriceWei;
  const answer = oracleResult?.[1] ?? null;
  const totalUsd =
    answer !== null && answer > 0n
      ? computeTotalUsd(weiSpent, answer, CHAINLINK_ETH_USD_DECIMALS)
      : null;

  return { gas, gasPriceWei, totalEth: formatCostEth(formatEther(weiSpent)), totalUsd };
}

// Base's gas prices routinely put a mint well under 1e-6 ETH, where a plain
// toFixed(6) rounds the whole estimate to a meaningless "0.000000". Keep up
// to 8 decimals, trim the trailing zeros a fixed width would leave behind,
// and floor anything still smaller into an explicit "<0.00000001" rather
// than showing a free mint. Exported for tests; formats a decimal ether
// string (viem's formatEther output), never a float, so no precision is lost
// on the way in.
export function formatCostEth(ether: string): string {
  const trimmed = Number(ether).toFixed(8).replace(/0+$/, "").replace(/\.$/, "");
  if (Number(trimmed) === 0) return Number(ether) === 0 ? "0" : "<0.00000001";
  return trimmed;
}

export async function mintSky(
  account: `0x${string}`,
  seed: AuroraSeed,
  snapshot: AuroraSnapshot,
): Promise<{ hash: string; tokenId: bigint; txUrl: string; openSeaUrl: string }> {
  validateSnapshot(snapshot);

  const ethereum = getEthereum();
  if (!ethereum) throw new NoWalletError();

  const { createWalletClient, custom, parseEventLogs } = await import("viem");

  const publicClient = await getPublicClient();

  const taken = await publicClient.readContract({
    address: CONTRACT_ADDRESS,
    abi: AURORA_SKY_ABI,
    functionName: "seedMinted",
    args: [seed],
  });
  if (taken) throw new SeedTakenError();

  const walletClient = createWalletClient({
    chain: MINT_CHAIN,
    transport: custom(ethereum as Parameters<typeof custom>[0]),
  });

  const { hex } = dataUrlToBytes(snapshot.dataUrl);
  const hash = await walletClient.writeContract({
    account,
    address: CONTRACT_ADDRESS,
    abi: AURORA_SKY_ABI,
    functionName: "mint",
    args: [hex, seed],
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  const transfers = parseEventLogs({
    abi: AURORA_SKY_ABI,
    logs: receipt.logs,
    eventName: "Transfer",
  });
  const tokenId = transfers[0]?.args.tokenId;
  if (tokenId === undefined) throw new Error("Mint succeeded but no Transfer event found");
  return {
    hash,
    tokenId,
    txUrl: `${EXPLORER_BASE}/tx/${hash}`,
    openSeaUrl: buildOpenSeaUrl(tokenId),
  };
}
