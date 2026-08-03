// Deliberately dependency-free (no viem/chains import): the entry-chunk
// components — SkyControls, AuroraGallery, MintPanel — read CONTRACT_DEPLOYED,
// MAX_IMAGE_BYTES, GALLERY_PAGE_SIZE and basescanTokenUrl statically, at
// render time, without pulling viem in. mintConfig.ts (which does need
// viem/chains for MINT_CHAIN) imports/re-exports CONTRACT_ADDRESS from here
// so there is exactly one source of truth for the address.
export const CONTRACT_ADDRESS =
  "0xc1aC1ac1Ac54691F6a22e2272ABA6f8989bd119a" as const; // CRKAurora (CREATE2 vanity — same address on Base Sepolia & mainnet)

// Task 7's placeholder is the zero address. Until it's replaced, the mint
// flow is not live — SkyControls uses this to hide the gallery pill and
// MintPanel to render nothing, rather than shipping UI that always fails.
export const CONTRACT_DEPLOYED =
  (CONTRACT_ADDRESS as string) !==
  "0x0000000000000000000000000000000000000000";

// Decision-gate value: an aurora NFT snapshot must fit on-chain cheaply.
// Enforced client-side before capture is offered for mint, and again in
// mintSky() right before writeContract so the mint library is safe to use
// standalone (i.e. without going through the UI's pre-check).
export const MAX_IMAGE_BYTES = 16_000;

// One gallery page. 15, not 12: the modal grid is five columns at ≥lg, so 15
// fills three complete rows with no ragged tail. At ~9 kB of on-chain image
// per token that is ~135 kB per page, which the page cache then keeps.
// Here rather than in mintConfig.ts because AuroraGallery imports it and
// mintConfig pulls viem/chains into whatever imports it.
export const GALLERY_PAGE_SIZE = 15;

export const EXPLORER_BASE = "https://basescan.org";

// A token's page on Basescan. Pure string building — no RPC, no ABI, so the
// gallery detail panel can link out without a chain read.
export function basescanTokenUrl(tokenId: bigint): string {
  return `${EXPLORER_BASE}/token/${CONTRACT_ADDRESS}?a=${tokenId}`;
}
