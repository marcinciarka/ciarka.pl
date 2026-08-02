// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ERC721} from "openzeppelin-contracts/contracts/token/ERC721/ERC721.sol";
import {Base64} from "openzeppelin-contracts/contracts/utils/Base64.sol";
import {Strings} from "openzeppelin-contracts/contracts/utils/Strings.sol";

/// @title AuroraSky — fully on-chain aurora snapshots from ciarka.pl
/// @notice Stores the raw image bytes and the uint32 seed that generated
/// the sky; tokenURI assembles OpenSea-standard metadata on the fly.
/// @dev Royalties: deliberately no ERC-2981 support. This is a free
/// personal art drop with no royalty stream; adding a royalty interface
/// was considered and rejected.
contract AuroraSky is ERC721 {
    error EmptyImage();
    error ImageTooLarge();
    error SeedAlreadyMinted();
    error SoldOut();
    error WalletAlreadyMinted();

    /// @notice Emitted on every successful mint so indexers can map
    /// tokenId -> seed (and minter) directly from logs without decoding
    /// tokenURI.
    event SkyMinted(uint256 indexed tokenId, address indexed minter, uint32 indexed seed);

    // WebP-or-nothing policy: the capture is the rightmost square of the
    // live canvas (side is viewport-dependent, capped at 800px), and
    // measured desktop snapshots run ~8-10KB (src/lib/aurora.ts
    // captureFrame, cost report). 16_000 gives ~1.6-2x headroom over that
    // band (~11.15M gas worst case, ~37% of a 30M block) without opening the
    // door to pathologically large uploads.
    uint256 public constant MAX_IMAGE_BYTES = 16_000;

    // Fixed-size collection: a free personal art drop, not an open edition.
    uint256 public constant MAX_SUPPLY = 100;

    uint256 public totalMinted;
    mapping(uint256 => bytes) private _images;
    mapping(uint256 => uint32) private _seeds;
    mapping(uint32 => bool) public seedMinted;
    mapping(address => bool) public hasMinted;

    constructor() ERC721("CRKAurora", "CRKA") {}

    /// @notice Mints a new CRKAurora token from a caller-supplied WebP
    /// snapshot and the seed that generated it.
    /// @dev The seed<->image binding is unverified on-chain by design: the
    /// contract does not (and cannot cheaply) re-render the aurora from
    /// `seed` to check it produces `image`. The client is the renderer;
    /// the on-chain image is the authoritative, permanent artifact, and the
    /// seed is stored as provenance/attribute metadata only.
    function mint(
        bytes calldata image,
        uint32 seed
    ) external returns (uint256 tokenId) {
        if (totalMinted >= MAX_SUPPLY) revert SoldOut();
        if (hasMinted[msg.sender]) revert WalletAlreadyMinted();
        if (image.length == 0) revert EmptyImage();
        if (image.length > MAX_IMAGE_BYTES) revert ImageTooLarge();
        if (seedMinted[seed]) revert SeedAlreadyMinted();

        hasMinted[msg.sender] = true;
        seedMinted[seed] = true;
        tokenId = ++totalMinted;
        _images[tokenId] = image;
        _seeds[tokenId] = seed;
        _safeMint(msg.sender, tokenId);

        emit SkyMinted(tokenId, msg.sender, seed);
    }

    /// @notice Returns the seed used to generate the sky for `tokenId`.
    function seedOf(uint256 tokenId) external view returns (uint32) {
        _requireOwned(tokenId);
        return _seeds[tokenId];
    }

    /// @notice Returns the raw on-chain WebP image bytes for `tokenId`.
    function imageOf(uint256 tokenId) external view returns (bytes memory) {
        _requireOwned(tokenId);
        return _images[tokenId];
    }

    /// @notice EIP-7572 contract-level metadata so marketplaces/explorers
    /// (OpenSea, etc.) can render a proper collection page.
    /// @dev Fully on-chain data URI, no hosted asset dependency. OpenSea's
    /// contractURI schema also accepts an optional "image" field; we
    /// deliberately omit it rather than hardcode a URL that could rot —
    /// there is no on-chain collection-level image to embed the way
    /// per-token images are embedded in tokenURI.
    function contractURI() external pure returns (string memory) {
        string memory json = string.concat(
            '{"name":"CRKAurora",',
            '"symbol":"CRKA",',
            '"description":"One-of-a-kind auroras captured live from ciarka.pl. Each sky is a WebP snapshot of the living WebGL aurora, stored fully on-chain with the uint32 seed that shaped it. Limited to 100 skies, one per wallet.",',
            '"external_link":"https://ciarka.pl"}'
        );
        return
            string.concat(
                "data:application/json;base64,",
                Base64.encode(bytes(json))
            );
    }

    function tokenURI(
        uint256 tokenId
    ) public view override returns (string memory) {
        _requireOwned(tokenId);
        string memory seedStr = Strings.toString(_seeds[tokenId]);
        string memory json = string.concat(
            '{"name":"CRKAurora #',
            Strings.toString(tokenId),
            '","description":"A one-of-a-kind aurora captured live from ciarka.pl - fully on-chain, one per wallet, 100 ever. See this sky alive: https://ciarka.pl/?seed=',
            seedStr,
            '",',
            '"external_url":"https://ciarka.pl/?seed=',
            seedStr,
            '","image":"data:image/webp;base64,',
            Base64.encode(_images[tokenId]),
            '","attributes":[{"trait_type":"Seed","value":"',
            seedStr,
            '"}]}'
        );
        return
            string.concat(
                "data:application/json;base64,",
                Base64.encode(bytes(json))
            );
    }
}
