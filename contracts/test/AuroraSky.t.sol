// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Test, console2} from "forge-std/Test.sol";
import {AuroraSky} from "../src/AuroraSky.sol";

contract AuroraSkyTest is Test {
    AuroraSky sky;
    bytes image = hex"52494646"; // arbitrary small payload; policy is WebP-or-nothing

    function setUp() public {
        sky = new AuroraSky();
    }

    // AuroraSky.mint() uses _safeMint, which calls onERC721Received on
    // contract recipients (real EOA wallets are unaffected). This test
    // contract is itself the minter/recipient, so it must implement the
    // receiver hook or every mint() call below reverts with
    // ERC721InvalidReceiver.
    function onERC721Received(
        address,
        address,
        uint256,
        bytes calldata
    ) external pure returns (bytes4) {
        return this.onERC721Received.selector;
    }

    function test_NameAndSymbol() public view {
        assertEq(sky.name(), "CRKAurora");
        assertEq(sky.symbol(), "CRKA");
    }

    function test_MintAssignsTokenToSender() public {
        uint256 id = sky.mint(image, 12345);
        assertEq(id, 1);
        assertEq(sky.ownerOf(1), address(this));
        assertEq(sky.totalMinted(), 1);
    }

    function test_TokenURIContainsMetadata() public {
        uint256 id = sky.mint(image, 12345);
        string memory uri = sky.tokenURI(id);
        // data:application/json;base64,<payload>
        assertEq(_prefix(uri, 29), "data:application/json;base64,");
        // forge-std in this project only exposes base64 *encode* cheatcodes
        // (toBase64 / toBase64URL) — no decode cheatcode is available, so we
        // decode manually with a small local Base64 decoder (see below).
        string memory json = string(_base64Decode(_suffix(uri, 29)));
        assertTrue(vm.contains(json, '"name":"CRKAurora #1"'));
        assertTrue(vm.contains(json, "See this sky alive: https://ciarka.pl/?seed=12345"));
        assertTrue(vm.contains(json, '"external_url":"https://ciarka.pl/?seed=12345"'));
        assertTrue(vm.contains(json, '"image":"data:image/webp;base64,'));
        assertTrue(
            vm.contains(json, '{"trait_type":"Seed","value":"12345"}')
        );
    }

    function test_ContractURIContainsMetadata() public view {
        string memory uri = sky.contractURI();
        // data:application/json;base64,<payload>
        assertEq(_prefix(uri, 29), "data:application/json;base64,");
        string memory json = string(_base64Decode(_suffix(uri, 29)));
        assertTrue(vm.contains(json, '"name":"CRKAurora"'));
        assertTrue(vm.contains(json, '"external_link":"https://ciarka.pl"'));
        // The capture is the rightmost square of the live canvas, whose side
        // depends on the viewport — the description must make no pixel-size
        // claim it cannot keep once immutably deployed.
        assertTrue(vm.contains(json, "a WebP snapshot of the living WebGL aurora"));
        assertFalse(vm.contains(json, "512px"));
    }

    function test_MintRevertsWhenSoldOut() public {
        for (uint32 i = 0; i < 100; i++) {
            address minter = address(uint160(1000 + i));
            vm.prank(minter);
            sky.mint(image, i);
        }
        assertEq(sky.totalMinted(), 100);

        vm.expectRevert(AuroraSky.SoldOut.selector);
        sky.mint(image, 100);

        assertEq(sky.totalMinted(), 100);
    }

    function test_SecondMintFromSameWalletReverts() public {
        sky.mint(image, 1);
        vm.expectRevert(AuroraSky.WalletAlreadyMinted.selector);
        sky.mint(image, 2);
    }

    function test_ReentrantSecondMintReverts() public {
        MaliciousReceiver attacker = new MaliciousReceiver(sky);
        attacker.attack(image, 1);

        assertTrue(attacker.reentryReverted());
        assertEq(sky.totalMinted(), 1);
        assertEq(sky.balanceOf(address(attacker)), 1);
    }

    function test_RevertsOnDuplicateSeed() public {
        sky.mint(image, 7);
        // Different wallet so the duplicate-seed check (not the
        // one-per-wallet check) is what fires here.
        vm.prank(address(0xCAFE));
        vm.expectRevert(AuroraSky.SeedAlreadyMinted.selector);
        sky.mint(image, 7);
    }

    function test_RevertsOnEmptyImage() public {
        vm.expectRevert(AuroraSky.EmptyImage.selector);
        sky.mint("", 1);
    }

    function test_RevertsOnOversizedImage() public {
        bytes memory big = new bytes(sky.MAX_IMAGE_BYTES() + 1);
        vm.expectRevert(AuroraSky.ImageTooLarge.selector);
        sky.mint(big, 1);
    }

    function test_MintRealisticPayloadGas() public {
        bytes memory realistic = new bytes(9000);
        for (uint256 i = 0; i < realistic.length; i++) {
            realistic[i] = bytes1(uint8(i % 256));
        }
        uint256 gasBefore = gasleft();
        uint256 id = sky.mint(realistic, 999);
        uint256 gasUsed = gasBefore - gasleft();
        console2.log("mint() gas for 9000-byte payload:", gasUsed);
        assertEq(id, 1);
        // Cross-check ceiling vs. Task 5's analytic cost-report estimate.
        // Raised from 3.6M/4700 bytes: the capture is now the rightmost
        // square of the live canvas (up to 800px) *and* carries the capture
        // star boost, which adds detail WebP has to encode. Measured over six
        // captures at 1280x800, boost on: 7998, 8238, 8595, 9132, 9237, 9657
        // bytes — so 9000 is the realistic payload, not 4700 (nor the 8000 of
        // the pre-boost measurement). Measured, not guessed: 9000 bytes costs
        // 6,444,817 gas here, so 6.8M is the ceiling with a small margin.
        // Still ~23% of a 30M block, and MAX_IMAGE_BYTES (16_000) remains
        // ~2x above the observed worst case.
        assertLt(gasUsed, 6_800_000);
    }

    function test_MintExactMaxSizeSucceeds() public {
        bytes memory maxImage = new bytes(sky.MAX_IMAGE_BYTES());
        uint256 id = sky.mint(maxImage, 42);
        assertEq(id, 1);
        assertEq(sky.imageOf(1).length, sky.MAX_IMAGE_BYTES());
    }

    function test_TokenURIRevertsForNonexistentToken() public {
        vm.expectRevert();
        sky.tokenURI(999);
    }

    function test_TransferKeepsSeedMinted() public {
        sky.mint(image, 55);
        address recipient = address(0xBEEF);
        sky.transferFrom(address(this), recipient, 1);
        assertEq(sky.ownerOf(1), recipient);
        assertTrue(sky.seedMinted(55));
    }

    function test_GettersReturnCorrectValues() public {
        uint256 id = sky.mint(image, 777);
        assertEq(sky.seedOf(id), 777);
        assertEq(sky.imageOf(id), image);
    }

    function test_SkyMintedEventEmitted() public {
        vm.expectEmit(true, true, true, true);
        emit AuroraSky.SkyMinted(1, address(this), 321);
        sky.mint(image, 321);
    }

    function _base64Decode(string memory s) internal pure returns (bytes memory) {
        bytes memory data = bytes(s);
        if (data.length == 0) return "";

        // Strip trailing '=' padding.
        uint256 len = data.length;
        uint256 padding = 0;
        if (len >= 1 && data[len - 1] == "=") padding++;
        if (len >= 2 && data[len - 2] == "=") padding++;

        uint256 outLen = (len / 4) * 3 - padding;
        bytes memory out = new bytes(outLen);

        uint256 outIdx = 0;
        for (uint256 i = 0; i < len; i += 4) {
            uint256 b0 = _b64Val(data[i]);
            uint256 b1 = _b64Val(data[i + 1]);
            uint256 b2 = i + 2 < len && data[i + 2] != "=" ? _b64Val(data[i + 2]) : 0;
            uint256 b3 = i + 3 < len && data[i + 3] != "=" ? _b64Val(data[i + 3]) : 0;

            uint256 triple = (b0 << 18) | (b1 << 12) | (b2 << 6) | b3;

            if (outIdx < outLen) out[outIdx++] = bytes1(uint8(triple >> 16));
            if (outIdx < outLen) out[outIdx++] = bytes1(uint8(triple >> 8));
            if (outIdx < outLen) out[outIdx++] = bytes1(uint8(triple));
        }
        return out;
    }

    function _b64Val(bytes1 c) internal pure returns (uint256) {
        if (c >= "A" && c <= "Z") return uint256(uint8(c)) - uint256(uint8(bytes1("A")));
        if (c >= "a" && c <= "z") return uint256(uint8(c)) - uint256(uint8(bytes1("a"))) + 26;
        if (c >= "0" && c <= "9") return uint256(uint8(c)) - uint256(uint8(bytes1("0"))) + 52;
        if (c == "+") return 62;
        if (c == "/") return 63;
        return 0;
    }

    function _prefix(string memory s, uint256 n) internal pure returns (string memory) {
        bytes memory b = bytes(s);
        bytes memory out = new bytes(n);
        for (uint256 i = 0; i < n; i++) out[i] = b[i];
        return string(out);
    }

    function _suffix(string memory s, uint256 n) internal pure returns (string memory) {
        bytes memory b = bytes(s);
        bytes memory out = new bytes(b.length - n);
        for (uint256 i = n; i < b.length; i++) out[i - n] = b[i];
        return string(out);
    }
}

/// @notice Malicious receiver used by test_ReentrantSecondMintReverts to
/// prove CEI ordering: hasMinted[msg.sender] must be set BEFORE _safeMint so
/// a reentrant mint() call from onERC721Received cannot succeed. The
/// reentrant attempt is wrapped in try/catch so the *outer* mint() call
/// still completes normally (mirroring what a naive/careless attacker
/// contract would do); the point of the test is that the reentrant call
/// itself reverts and the attacker never ends up owning more than 1 token.
contract MaliciousReceiver {
    AuroraSky public immutable sky;
    bool public reentryReverted;

    constructor(AuroraSky _sky) {
        sky = _sky;
    }

    function attack(bytes calldata image, uint32 seed) external {
        sky.mint(image, seed);
    }

    function onERC721Received(
        address,
        address,
        uint256,
        bytes calldata
    ) external returns (bytes4) {
        try sky.mint(hex"52494646", 999999) {
            // Should never reach here — reentrant mint must revert.
        } catch {
            reentryReverted = true;
        }
        return this.onERC721Received.selector;
    }
}
