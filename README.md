# Vaultrix – Matrix-based password manager

A password manager that uses Matrix as an append-only E2EE sync layer. One vault = one private encrypted room; all vault semantics (entries, types, TOTP) are client-side.

## Build

1. **Core**
   ```bash
   cd packages/core && npm install && npm run build
   ```

2. **UI**
   ```bash
   cd packages/ui && npm install && npm run build
   ```

3. **Extension** (load the `extension/dist` folder in Chrome as an unpacked extension)
   ```bash
   cd extension && npm install && npm run build
   ```
   Then open `chrome://extensions`, enable "Developer mode", "Load unpacked", and select `extension/dist`.

4. **Options / full vault UI**
   In the extension, click "Open vault" in the popup to open the options page (full unlock + list UI).

## Project layout

- **packages/core** – Matrix client, vault room, SSSS, vault model, crypto, ops/snapshots, session (unlock flow), export/rotation, recovery QR, TOTP.
- **packages/ui** – React app: unlock screen, vault list (same bundle for extension options and Tauri).
- **extension** – MV3 browser extension: background (Matrix + vault), popup, content script (autofill), options (full UI).
- **tauri** – Tauri 2 desktop app: same UI bundle; Rust capabilities (clipboard, shell-open). From repo root: `pnpm run dev:tauri` or `pnpm run build:tauri`. The Tauri app icon (`tauri/icons/icon.png`) is generated when missing by `pnpm run ensure-tauri-icon` or by the dev/build scripts that call it (required by Tauri’s `generate_context!()`).

## Plan

See the plan in `.cursor/plans/` for full design: entry types (Login, Secure note, Credit card, Identity, API credential), custom fields, TOTP/HOTP, recovery QR, snapshots, key rotation, export, optional Tauri desktop and content script autofill.
