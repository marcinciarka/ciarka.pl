import { baseSepolia } from "viem/chains";
import { CONTRACT_ADDRESS, CONTRACT_DEPLOYED, MAX_IMAGE_BYTES } from "./contractAddress";

// Task 10 flips this to `base` + the mainnet address.
export const MINT_CHAIN = baseSepolia;
// Re-exported from the dependency-free contractAddress.ts, which is the one
// place MintButton is allowed to statically import (no viem/chains there).
export { CONTRACT_ADDRESS, CONTRACT_DEPLOYED, MAX_IMAGE_BYTES };
export const OPENSEA_BASE = "https://testnets.opensea.io/assets/base_sepolia";
// Task 10 flips this to the mainnet explorer.
export const EXPLORER_BASE = "https://sepolia.basescan.org";

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
