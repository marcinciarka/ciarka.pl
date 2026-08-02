import { describe, expect, it } from "vitest";
import { CONTRACT_ADDRESS, CONTRACT_DEPLOYED, MAX_IMAGE_BYTES, dataUrlToBytes, openSeaUrl } from "./mintConfig";

describe("dataUrlToBytes", () => {
  it("decodes mime and payload from a data URL", () => {
    // "hi!" base64 → aGkh
    const { hex, mime } = dataUrlToBytes("data:image/webp;base64,aGkh");
    expect(mime).toBe("image/webp");
    expect(hex).toBe("0x686921");
  });

  it("throws on non-base64 data urls", () => {
    expect(() => dataUrlToBytes("data:text/plain,hello")).toThrow();
  });
});

describe("openSeaUrl", () => {
  it("builds a token page url", () => {
    expect(openSeaUrl(7n)).toMatch(/opensea\.io\/.+\/7$/);
  });
});

describe("CONTRACT_DEPLOYED", () => {
  // I2: deploy-state-independent — this must hold whether CONTRACT_ADDRESS
  // is still the zero-address placeholder (pre-Task-7) or a real deployed
  // address (post-Task-7/10), so the test doesn't go stale the moment the
  // address is pasted in. It asserts the derivation logic itself: deployed
  // iff the address isn't the zero-address placeholder, and the address is
  // always a well-formed 20-byte hex address.
  it("is derived from whether CONTRACT_ADDRESS is the zero-address placeholder", () => {
    expect(CONTRACT_ADDRESS).toMatch(/^0x[0-9a-fA-F]{40}$/);
    expect(CONTRACT_DEPLOYED).toBe(
      (CONTRACT_ADDRESS as string) !==
        "0x0000000000000000000000000000000000000000"
    );
  });
});

describe("MAX_IMAGE_BYTES", () => {
  it("is a positive byte cap", () => {
    expect(MAX_IMAGE_BYTES).toBeGreaterThan(0);
    expect(MAX_IMAGE_BYTES).toBe(16_000);
  });
});
