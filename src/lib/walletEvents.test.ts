import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  allowAutoConnect,
  isAutoConnectSuppressed,
  sameAccount,
  subscribeAccountsChanged,
  suppressAutoConnect,
} from "./walletEvents";

// Minimal EIP-1193 stand-in. `provider` is an injectable parameter purely so
// these tests can drive events without a browser or a real wallet.
function fakeProvider(opts: { detach?: "removeListener" | "off" } = {}) {
  const detachName = opts.detach ?? "removeListener";
  let listeners: ((accounts: string[]) => void)[] = [];
  const provider: Record<string, unknown> = {
    on(event: string, listener: (accounts: string[]) => void) {
      if (event === "accountsChanged") listeners.push(listener);
    },
    emit(accounts: string[]) {
      for (const l of [...listeners]) l(accounts);
    },
  };
  provider[detachName] = (
    event: string,
    listener: (accounts: string[]) => void,
  ) => {
    if (event === "accountsChanged")
      listeners = listeners.filter((l) => l !== listener);
  };
  return provider as {
    emit: (accounts: string[]) => void;
  } & Record<string, unknown>;
}

describe("subscribeAccountsChanged", () => {
  it("returns a callable no-op when there is no provider", () => {
    const handler = vi.fn();
    const unsubscribe = subscribeAccountsChanged(handler, undefined);
    expect(() => unsubscribe()).not.toThrow();
    expect(handler).not.toHaveBeenCalled();
  });

  it("returns a callable no-op for a provider without .on", () => {
    const handler = vi.fn();
    const unsubscribe = subscribeAccountsChanged(handler, {});
    expect(() => unsubscribe()).not.toThrow();
    expect(handler).not.toHaveBeenCalled();
  });

  it("reports the first account of the payload", () => {
    const handler = vi.fn();
    const provider = fakeProvider();
    subscribeAccountsChanged(handler, provider);
    provider.emit(["0xAbC0000000000000000000000000000000000123"]);
    expect(handler).toHaveBeenCalledWith(
      "0xAbC0000000000000000000000000000000000123",
    );
  });

  it("reports null for an empty payload, so callers see one 'gone' shape", () => {
    const handler = vi.fn();
    const provider = fakeProvider();
    subscribeAccountsChanged(handler, provider);
    provider.emit([]);
    expect(handler).toHaveBeenCalledWith(null);
  });

  it("stops calling the handler after unsubscribe", () => {
    const handler = vi.fn();
    const provider = fakeProvider();
    const unsubscribe = subscribeAccountsChanged(handler, provider);
    unsubscribe();
    provider.emit(["0xAbC0000000000000000000000000000000000123"]);
    expect(handler).not.toHaveBeenCalled();
  });

  it("detaches via off() on providers that ship only off", () => {
    const handler = vi.fn();
    const provider = fakeProvider({ detach: "off" });
    const unsubscribe = subscribeAccountsChanged(handler, provider);
    unsubscribe();
    provider.emit(["0xAbC0000000000000000000000000000000000123"]);
    expect(handler).not.toHaveBeenCalled();
  });

  it("reports null for an empty-string account rather than a blank address", () => {
    const handler = vi.fn();
    const provider = fakeProvider();
    subscribeAccountsChanged(handler, provider);
    provider.emit([""]);
    expect(handler).toHaveBeenCalledWith(null);
  });

  it("reports null for a payload that isn't a valid hex address", () => {
    const handler = vi.fn();
    const provider = fakeProvider();
    subscribeAccountsChanged(handler, provider);
    provider.emit(["not-an-address"]);
    expect(handler).toHaveBeenCalledWith(null);
  });

  it("reports null for a non-array payload", () => {
    const handler = vi.fn();
    const provider = fakeProvider();
    subscribeAccountsChanged(handler, provider);
    // Some wallets are not spec-compliant; exercise the Array.isArray false
    // branch directly rather than assuming every provider sends an array.
    provider.emit(null as unknown as string[]);
    expect(handler).toHaveBeenCalledWith(null);
  });

  it("still returns a callable, non-throwing unsubscribe when the provider has neither removeListener nor off", () => {
    // This genuinely leaks the listener — there is no way to detach it — which
    // is exactly why subscribeAccountsChanged falls back through
    // removeListener, then off, rather than assuming either exists.
    const handler = vi.fn();
    const provider: Record<string, unknown> = {
      on(_event: string, _listener: (accounts: string[]) => void) {},
    };
    const unsubscribe = subscribeAccountsChanged(handler, provider);
    expect(() => unsubscribe()).not.toThrow();
  });
});

describe("sameAccount", () => {
  it("ignores checksum casing differences", () => {
    expect(
      sameAccount(
        "0xAbC0000000000000000000000000000000000123",
        "0xabc0000000000000000000000000000000000123",
      ),
    ).toBe(true);
  });

  it("reports different addresses as different", () => {
    expect(
      sameAccount(
        "0xAbC0000000000000000000000000000000000123",
        "0xdEf0000000000000000000000000000000000456",
      ),
    ).toBe(false);
  });

  it("treats two nulls as the same and one null as different", () => {
    expect(sameAccount(null, null)).toBe(true);
    expect(sameAccount("0xAbC0000000000000000000000000000000000123", null)).toBe(
      false,
    );
    expect(sameAccount(null, "0xAbC0000000000000000000000000000000000123")).toBe(
      false,
    );
  });
});

describe("auto-connect suppression", () => {
  // Module state outlives any single test — reset it here so an earlier test
  // calling suppressAutoConnect() cannot leak into a later one that assumes
  // the default.
  beforeEach(() => {
    allowAutoConnect();
  });

  it("defaults to not suppressed", () => {
    expect(isAutoConnectSuppressed()).toBe(false);
  });

  it("suppressAutoConnect() sets it", () => {
    suppressAutoConnect();
    expect(isAutoConnectSuppressed()).toBe(true);
  });

  it("allowAutoConnect() clears it", () => {
    suppressAutoConnect();
    allowAutoConnect();
    expect(isAutoConnectSuppressed()).toBe(false);
  });
});
