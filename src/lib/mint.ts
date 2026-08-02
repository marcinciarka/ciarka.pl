import type { AuroraSeed } from "./seed";
import { isWebpDataUrl, type AuroraSnapshot } from "./capture";
import {
  AURORA_SKY_ABI,
  CONTRACT_ADDRESS,
  EXPLORER_BASE,
  MAX_IMAGE_BYTES,
  MINT_CHAIN,
  dataUrlToBytes,
  openSeaUrl as buildOpenSeaUrl,
} from "./mintConfig";
// mint.ts is only ever reached via a dynamic `import("../lib/mint")`
// (see MintButton), so a static import of viem here is safe — it never
// touches the entry chunk, it just makes viem load as soon as mint.ts
// does instead of only inside each function's own `await import("viem")`.
import { BaseError } from "viem";

// Re-exported so callers (MintButton) can reach `openSeaUrl` through the
// same dynamic `import("../lib/mint")` used for minting, instead of
// statically importing mintConfig.ts — which pulls in `viem/chains` and
// would otherwise land that weight in the entry chunk.
export { openSeaUrl } from "./mintConfig";

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
  const { createPublicClient, http } = await import("viem");
  const publicClient = createPublicClient({ chain: MINT_CHAIN, transport: http() });

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

// Gas estimate for the mint the modal is about to offer, so the user sees a
// cost before signing. Runs the same snapshot guard as mintSky, before any
// network access, so a rejected snapshot never reaches estimateContractGas.
export async function estimateMint(
  account: `0x${string}`,
  seed: AuroraSeed,
  snapshot: AuroraSnapshot,
): Promise<{ gas: bigint; gasPriceWei: bigint; totalEth: string }> {
  validateSnapshot(snapshot);

  const { createPublicClient, http, formatEther } = await import("viem");
  const publicClient = createPublicClient({ chain: MINT_CHAIN, transport: http() });
  const { hex } = dataUrlToBytes(snapshot.dataUrl);

  const [gas, gasPriceWei] = await Promise.all([
    publicClient.estimateContractGas({
      account,
      address: CONTRACT_ADDRESS,
      abi: AURORA_SKY_ABI,
      functionName: "mint",
      args: [hex, seed],
    }),
    publicClient.getGasPrice(),
  ]);

  return { gas, gasPriceWei, totalEth: formatCostEth(formatEther(gas * gasPriceWei)) };
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

  const { createWalletClient, createPublicClient, custom, http, parseEventLogs } =
    await import("viem");

  const publicClient = createPublicClient({
    chain: MINT_CHAIN,
    transport: http(),
  });

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
