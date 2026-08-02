// Deliberately dependency-free (no viem/chains import): MintButton needs to
// read CONTRACT_DEPLOYED and MAX_IMAGE_BYTES statically, at render time,
// without pulling viem into the entry chunk. mintConfig.ts (which does need
// viem/chains for MINT_CHAIN) imports/re-exports CONTRACT_ADDRESS from here
// so there is exactly one source of truth for the address.
export const CONTRACT_ADDRESS =
  "0x57cDa5023791ce0BeF73c06C9e8030cDA2C83e88" as const; // ← Task 7: paste the deployed address here

// Task 7's placeholder is the zero address. Until it's replaced, the mint
// flow is not live — MintButton uses this to hide the mint button entirely
// rather than shipping a button that always fails.
export const CONTRACT_DEPLOYED =
  (CONTRACT_ADDRESS as string) !==
  "0x0000000000000000000000000000000000000000";

// Decision-gate value: an aurora NFT snapshot must fit on-chain cheaply.
// Enforced client-side before capture is offered for mint, and again in
// mintSky() right before writeContract so the mint library is safe to use
// standalone (i.e. without going through the UI's pre-check).
export const MAX_IMAGE_BYTES = 16_000;
