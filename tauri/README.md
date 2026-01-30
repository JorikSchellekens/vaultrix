# Vaultrix Vault – Tauri desktop app

Same UI as the browser extension; webview loads `packages/ui` build.

## Prerequisites

- Rust
- Tauri CLI: either install via Cargo (`cargo install tauri-cli --version "^2.0.0"`) or use the one in this repo via pnpm (run `pnpm install` from repo root, then `pnpm run dev` from this folder).

## Build

1. Build core and UI: `cd ../packages/core && npm run build && cd ../packages/ui && npm run build`
2. From this folder (`tauri/`): `cargo tauri build` (requires Cargo CLI above) or from repo root: `pnpm run build:tauri`.

## Dev

From this folder (`tauri/`): `pnpm run dev` (uses project’s Tauri CLI), or `cargo tauri dev` if you installed the Cargo CLI. From repo root: `pnpm run dev:tauri`.
