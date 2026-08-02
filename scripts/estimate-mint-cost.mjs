// Analytic mint-cost estimate for storing an aurora snapshot on-chain (Base).
// Model: fixed ERC-721 mint overhead (~100k: safeMint, two small mappings,
// events) + one cold SSTORE (20k) plus bookkeeping (~2.1k) per 32-byte slot
// of image data. L1 data fee is NOT modeled — post-4844 it's typically a
// few percent of a storage-heavy tx; Phase 2 measures the real number on
// Base Sepolia with eth_estimateGas.

const MINT_OVERHEAD_GAS = 100_000;
const GAS_PER_SLOT = 22_100;

export function estimateMintGas(imageBytes) {
  const slots = Math.ceil(imageBytes / 32);
  return MINT_OVERHEAD_GAS + slots * GAS_PER_SLOT;
}

export function weiCost(gas, gasPriceWei) {
  return BigInt(gas) * gasPriceWei;
}

async function rpc(method) {
  const res = await fetch("https://mainnet.base.org", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params: [] }),
  });
  const { result } = await res.json();
  return BigInt(result);
}

async function ethUsd() {
  const res = await fetch("https://api.coinbase.com/v2/prices/ETH-USD/spot");
  const json = await res.json();
  return Number(json.data.amount);
}

const isMain = process.argv[1]?.endsWith("estimate-mint-cost.mjs");
if (isMain) {
  const bytes = Number(process.argv[2]);
  if (!Number.isFinite(bytes) || bytes <= 0) {
    console.error("usage: node scripts/estimate-mint-cost.mjs <imageBytes>");
    process.exit(1);
  }
  const gas = estimateMintGas(bytes);
  const [gasPrice, usd] = await Promise.all([rpc("eth_gasPrice"), ethUsd()]);
  const wei = weiCost(gas, gasPrice);
  const eth = Number(wei) / 1e18;
  console.log(`image size      ${bytes} bytes (${Math.ceil(bytes / 32)} slots)`);
  console.log(`estimated gas   ${gas.toLocaleString()}`);
  console.log(`base gas price  ${Number(gasPrice) / 1e9} gwei`);
  console.log(`L2 exec cost    ${eth.toFixed(8)} ETH  (~$${(eth * usd).toFixed(4)})`);
  console.log(`note: excludes L1 data fee (usually small post-4844)`);
}
