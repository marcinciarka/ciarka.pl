# AuroraSky

Fully on-chain ERC-721 contract for ciarka.pl's CRKAurora drop (`name()` = "CRKAurora", `symbol()`
= "CRKA"), capped at `MAX_SUPPLY = 100` tokens, one mint per wallet (`hasMinted(address)`,
`WalletAlreadyMinted` if a second mint is attempted — enforced before `_safeMint`, so a reentrant
mint via `onERC721Received` cannot bypass the limit): `mint()` stores a caller-supplied
WebP snapshot (the rightmost square of the live hero canvas — side is viewport-dependent, capped
at 800px) and its generating seed directly in contract storage; `tokenURI()` assembles
OpenSea-standard metadata (with an embedded `data:image/webp;base64,...` image) on the fly — no
IPFS, no off-chain server. `contractURI()` provides EIP-7572 collection-level metadata (name,
symbol, description, external link) as a fully on-chain data URI so marketplaces/explorers can
render a proper collection page.

Run tests: `forge test -vv` (add `--gas-report` for per-function gas).

Deployment: see the plan's Task 7 (`.superpowers/sdd/2026-08-02-aurora-seed-nft/`) for the
deploy script and network/config steps.
