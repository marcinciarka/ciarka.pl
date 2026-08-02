#!/usr/bin/env node
// Recreates contracts/lib (Foundry dependencies) if missing.
//
// contracts/lib is gitignored — it is vendored library code (OpenZeppelin,
// forge-std) that we don't want checked into this repo's git history.
// Instead it is reconstructed here via `forge install`, pinned to exact
// tags, whenever it's not already present.
//
// This script MUST NOT fail the parent `npm install`/CI run: environments
// that only build the Vite/React site (e.g. GitHub Pages CI) don't have
// Foundry installed and don't need contracts/lib at all.

import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const contractsDir = path.join(repoRoot, "contracts");
const libDir = path.join(contractsDir, "lib");

const DEPS = [
  "OpenZeppelin/openzeppelin-contracts@v5.7.0",
  "foundry-rs/forge-std@v1.16.2",
];

function hasDep(name) {
  return existsSync(path.join(libDir, name));
}

if (hasDep("openzeppelin-contracts") && hasDep("forge-std")) {
  process.exit(0);
}

function commandExists(cmd) {
  const result = spawnSync(cmd, ["--version"], { stdio: "ignore" });
  return !result.error;
}

if (!commandExists("forge")) {
  console.warn(
    "forge not found — skipping contracts deps (only needed for contract dev)",
  );
  process.exit(0);
}

const result = spawnSync(
  "forge",
  ["install", "--no-git", ...DEPS],
  {
    cwd: contractsDir,
    stdio: "inherit",
  },
);

if (result.status !== 0) {
  console.warn(
    "forge install failed — skipping contracts deps (only needed for contract dev)",
  );
  process.exit(0);
}
