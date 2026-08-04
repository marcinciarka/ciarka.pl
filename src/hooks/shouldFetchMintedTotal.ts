// Gate for the one-shot totalMinted RPC. Kept pure so the "only when the
// aurora modal is open" rule is unit-tested without mounting React.
export function shouldFetchMintedTotal({
  enabled,
  deployed,
  total,
}: {
  enabled: boolean;
  deployed: boolean;
  total: number | null;
}): boolean {
  return enabled && deployed && total === null;
}
