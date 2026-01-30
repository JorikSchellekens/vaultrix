#!/usr/bin/env node
/**
 * Copy olm.wasm from node_modules to packages/ui/public so the UI and Tauri app
 * can serve it at /olm.wasm. Run before dev:ui or dev:tauri if needed.
 *
 * Usage: node scripts/copy-olm-wasm.cjs
 *    or: pnpm run copy-olm-wasm
 */
const { copyFileSync, existsSync, mkdirSync } = require("fs");
const { join } = require("path");

const repoRoot = join(__dirname, "..");
const uiDir = join(repoRoot, "packages", "ui");
const publicDir = join(uiDir, "public");
const dest = join(publicDir, "olm.wasm");

const candidates = [
  join(uiDir, "node_modules", "@matrix-org", "olm", "olm.wasm"),
  join(repoRoot, "packages", "core", "node_modules", "@matrix-org", "olm", "olm.wasm"),
  join(repoRoot, "node_modules", "@matrix-org", "olm", "olm.wasm"),
];

let copied = false;
for (const src of candidates) {
  if (existsSync(src)) {
    mkdirSync(publicDir, { recursive: true });
    copyFileSync(src, dest);
    console.log("copied olm.wasm to packages/ui/public/olm.wasm");
    copied = true;
    break;
  }
}

if (!copied) {
  console.error("olm.wasm not found. Tried:");
  candidates.forEach((p) => console.error("  -", p));
  process.exit(1);
}
