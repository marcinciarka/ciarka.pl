import { base } from "viem/chains";
import { CONTRACT_ADDRESS, CONTRACT_DEPLOYED, MAX_IMAGE_BYTES } from "./contractAddress";

// Base mainnet. The CREATE2 vanity address is identical on Base Sepolia,
// so only the chain/URLs change between environments.
export const MINT_CHAIN = base;
// Re-exported from the dependency-free contractAddress.ts, which is the one
// place MintButton is allowed to statically import (no viem/chains there).
export { CONTRACT_ADDRESS, CONTRACT_DEPLOYED, MAX_IMAGE_BYTES };
export const OPENSEA_BASE = "https://opensea.io/assets/base";
export const EXPLORER_BASE = "https://basescan.org";

// Chainlink ETH/USD price feed on Base mainnet. Verified on-chain: address
// resolves to a feed with description "ETH / USD" and 8 decimals. Hardcoded
// rather than read via decimals() — one less RPC round trip for a constant
// that's part of the feed's identity, not something that changes at runtime.
export const CHAINLINK_ETH_USD =
  "0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70" as const;
export const CHAINLINK_ETH_USD_DECIMALS = 8;

export function explorerContractUrl(): string {
  return `${EXPLORER_BASE}/address/${CONTRACT_ADDRESS}`;
}

export const AURORA_SKY_ABI = [
  {
    type: "function",
    name: "mint",
    stateMutability: "nonpayable",
    inputs: [
      { name: "image", type: "bytes" },
      { name: "seed", type: "uint32" },
    ],
    outputs: [{ name: "tokenId", type: "uint256" }],
  },
  {
    type: "function",
    name: "seedMinted",
    stateMutability: "view",
    inputs: [{ name: "", type: "uint32" }],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "hasMinted",
    stateMutability: "view",
    inputs: [{ name: "", type: "address" }],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "seedOf",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "", type: "uint32" }],
  },
  {
    type: "function",
    name: "imageOf",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "", type: "bytes" }],
  },
  {
    type: "function",
    name: "totalMinted",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "ownerOf",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "event",
    name: "Transfer",
    inputs: [
      { name: "from", type: "address", indexed: true },
      { name: "to", type: "address", indexed: true },
      { name: "tokenId", type: "uint256", indexed: true },
    ],
  },
  {
    type: "event",
    name: "SkyMinted",
    inputs: [
      { name: "tokenId", type: "uint256", indexed: true },
      { name: "minter", type: "address", indexed: true },
      { name: "seed", type: "uint32", indexed: true },
    ],
  },
] as const;

// Minimal Chainlink AggregatorV3Interface fragment — only the one function
// estimateMint's USD row needs.
export const CHAINLINK_AGGREGATOR_ABI = [
  {
    type: "function",
    name: "latestRoundData",
    stateMutability: "view",
    inputs: [],
    outputs: [
      { name: "roundId", type: "uint80" },
      { name: "answer", type: "int256" },
      { name: "startedAt", type: "uint256" },
      { name: "updatedAt", type: "uint256" },
      { name: "answeredInRound", type: "uint80" },
    ],
  },
] as const;

export function dataUrlToBytes(dataUrl: string): {
  hex: `0x${string}`;
  mime: string;
} {
  const match = /^data:([^;]+);base64,(.+)$/.exec(dataUrl);
  if (!match) throw new Error("Expected a base64 data URL");
  const [, mime, b64] = match;
  const bin = atob(b64);
  let hex = "0x";
  for (let i = 0; i < bin.length; i++) {
    hex += bin.charCodeAt(i).toString(16).padStart(2, "0");
  }
  return { hex: hex as `0x${string}`, mime };
}

export function openSeaUrl(tokenId: bigint): string {
  return `${OPENSEA_BASE}/${CONTRACT_ADDRESS}/${tokenId}`;
}

// --- Pure helpers below: no viem import, safe to unit test without paying
// for a dynamic `import("../lib/mint")` or mocking the network. ---

// Formats an integer already scaled by 1e4 (i.e. "USD value * 10000") into
// an exact 4-decimal string. Kept separate from computeTotalUsd so the
// string-formatting half is independently testable from the bigint math.
export function formatScaledUsd(scaledBy1e4: bigint): string {
  const negative = scaledBy1e4 < 0n;
  const abs = negative ? -scaledBy1e4 : scaledBy1e4;
  const whole = abs / 10_000n;
  const frac = (abs % 10_000n).toString().padStart(4, "0");
  return `${negative ? "-" : ""}${whole}.${frac}`;
}

// weiSpent (18 decimals) * a Chainlink `answer` (USD per 1 ETH, at
// `oracleDecimals`) → an exact 4-decimal USD string. Pure bigint
// arithmetic throughout (no floats) so nothing is lost to precision
// between wei-scale and cent-scale. Floors like Chainlink/Solidity
// integer division, rather than rounding.
export function computeTotalUsd(
  weiSpent: bigint,
  answer: bigint,
  oracleDecimals: number,
): string {
  const numerator = weiSpent * answer * 10_000n; // scale result to 1e4 (4 dp)
  const denominator = 10n ** BigInt(18 + oracleDecimals);
  return formatScaledUsd(numerator / denominator);
}

// Newest-first page of sequential token ids (contract mints 1..total,
// ++totalMinted). Page 0 is the most recently minted `pageSize` tokens;
// out-of-range pages return an empty array rather than throwing.
export function pageTokenIds(
  total: number,
  page: number,
  pageSize = 12,
): bigint[] {
  if (total <= 0 || page < 0 || pageSize <= 0) return [];
  const start = total - page * pageSize; // newest id in this page
  if (start <= 0) return [];
  const end = Math.max(start - pageSize + 1, 1); // oldest id in this page
  const ids: bigint[] = [];
  for (let id = start; id >= end; id--) ids.push(BigInt(id));
  return ids;
}

// bytes (as returned by a viem `bytes`-typed read: a 0x-prefixed hex
// string) → base64, chunked so a single `String.fromCharCode(...)` call
// never receives more arguments than engines allow (~64k). Each chunk
// contributes to one binary string which is base64-encoded once at the
// end, so chunk boundaries never affect the output.
export function hexToBase64(hex: string, chunkSize = 24_576): string {
  const clean = hex.startsWith("0x") ? hex.slice(2) : hex;
  const byteLength = clean.length / 2;
  let binary = "";
  for (let offset = 0; offset < byteLength; offset += chunkSize) {
    const end = Math.min(offset + chunkSize, byteLength);
    const chars: number[] = [];
    for (let i = offset; i < end; i++) {
      chars.push(parseInt(clean.slice(i * 2, i * 2 + 2), 16));
    }
    binary += String.fromCharCode(...chars);
  }
  return btoa(binary);
}

export function hexBytesToDataUrl(hex: string, mime = "image/webp"): string {
  return `data:${mime};base64,${hexToBase64(hex)}`;
}
