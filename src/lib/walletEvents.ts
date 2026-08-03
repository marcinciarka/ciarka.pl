// EIP-1193 provider event plumbing for the mint panel. Dependency-free on
// purpose, so MintPanel can import it *statically*: a dynamic
// `await import(...)` inside the subscribe effect races its own teardown — an
// unmount before the import resolves leaves the listener attached with nothing
// able to detach it. mint.ts cannot host this, because it pulls in viem and is
// reachable only via a dynamic import.

export type AccountsChangedHandler = (account: `0x${string}` | null) => void;

type Listener = (accounts: string[]) => void;

type ProviderLike = {
  on?: (event: string, listener: Listener) => void;
  removeListener?: (event: string, listener: Listener) => void;
  off?: (event: string, listener: Listener) => void;
};

const NOOP = () => {};

function defaultProvider(): unknown {
  if (typeof window === "undefined") return undefined;
  return (window as { ethereum?: unknown }).ethereum;
}

// Subscribes to accountsChanged and returns an unsubscribe. Callers never have
// to branch on wallet presence: with no provider (or a provider that predates
// the event API) this returns a no-op unsubscribe and the handler is simply
// never called.
export function subscribeAccountsChanged(
  handler: AccountsChangedHandler,
  provider: unknown = defaultProvider(),
): () => void {
  const p = provider as ProviderLike | undefined | null;
  if (!p || typeof p.on !== "function") return NOOP;

  // Normalized to "an address, or gone", so the consumer handles one shape
  // instead of an array whose emptiness carries the meaning.
  const listener: Listener = (accounts) => {
    const next = Array.isArray(accounts) ? accounts[0] : undefined;
    // Anything that is not a 20-byte hex address is "no account", not an
    // account with a strange name: an empty string would otherwise render a
    // wallet row with a blank address.
    const valid =
      typeof next === "string" && /^0x[0-9a-fA-F]{40}$/.test(next);
    handler(valid ? (next as `0x${string}`) : null);
  };
  p.on("accountsChanged", listener);

  return () => {
    // Injected providers are inconsistent here: some ship removeListener, some
    // only off. Detaching with the wrong one silently leaks the listener.
    const detach = p.removeListener ?? p.off;
    if (typeof detach === "function") detach.call(p, "accountsChanged", listener);
  };
}

// Wallets are inconsistent about checksum casing between the eth_accounts
// result and the accountsChanged payload, so a naive !== reports a switch on a
// purely cosmetic difference — and each false positive costs a full round of
// RPC reads.
export function sameAccount(a: string | null, b: string | null): boolean {
  if (a === null || b === null) return a === b;
  return a.toLowerCase() === b.toLowerCase();
}

// Disconnect is a local forget: EIP-1193 has no portable disconnect, so
// "disconnected" is a fact about this page session, not about the wallet. That
// makes the flag's lifetime the point — it lives here at module scope rather
// than in a MintPanel ref because SkyControls unmounts the modal on close, and
// a ref would take the visitor's decision down with it. Module state dies on
// reload, which is deliberate: a fresh page legitimately re-reads eth_accounts.
let autoConnectSuppressed = false;

export function suppressAutoConnect(): void {
  autoConnectSuppressed = true;
}

// Called on an explicit connect, and on an in-wallet account switch — both are
// reconnect intents that override an earlier disconnect.
export function allowAutoConnect(): void {
  autoConnectSuppressed = false;
}

export function isAutoConnectSuppressed(): boolean {
  return autoConnectSuppressed;
}
