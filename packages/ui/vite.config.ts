import { defineConfig } from "vite";
import { createRequire } from "module";
import { copyFileSync, existsSync, mkdirSync, readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import react from "@vitejs/plugin-react";
import wasm from "vite-plugin-wasm";
import topLevelAwait from "vite-plugin-top-level-await";

// Use config file dir so copy works regardless of process.cwd() (e.g. pnpm run dev:tauri from root).
const configDir = dirname(fileURLToPath(import.meta.url));
const publicDir = join(configDir, "public");
const olmWasmPaths = [
  join(configDir, "node_modules", "@matrix-org", "olm", "olm.wasm"),
  join(configDir, "..", "core", "node_modules", "@matrix-org", "olm", "olm.wasm"),
];

const cryptoWasmJsPaths = [
  join(configDir, "node_modules", "@matrix-org", "matrix-sdk-crypto-wasm", "pkg", "matrix_sdk_crypto_wasm_bg.wasm.js"),
  join(configDir, "..", "core", "node_modules", "@matrix-org", "matrix-sdk-crypto-wasm", "pkg", "matrix_sdk_crypto_wasm_bg.wasm.js"),
];

function doCopyOlmWasm(): boolean {
  for (const src of olmWasmPaths) {
    if (existsSync(src)) {
      mkdirSync(publicDir, { recursive: true });
      copyFileSync(src, join(publicDir, "olm.wasm"));
      return true;
    }
  }
  return false;
}

/** Load rust crypto WASM bytes from the package's base64 .wasm.js file. */
function getCryptoWasmBytes(): Buffer | null {
  for (const p of cryptoWasmJsPaths) {
    if (!existsSync(p)) continue;
    try {
      const require = createRequire(import.meta.url);
      const b64 = require(p) as string;
      if (typeof b64 === "string") return Buffer.from(b64.replace(/[^A-Za-z0-9+/]/g, ""), "base64");
    } catch {
      try {
        const raw = readFileSync(p, "utf-8");
        const match = raw.match(/module\.exports\s*=\s*`([^`]+)`/) ?? raw.match(/=\s*["']([A-Za-z0-9+/=]+)["']/);
        if (match?.[1]) return Buffer.from(match[1].replace(/[^A-Za-z0-9+/]/g, ""), "base64");
      } catch {}
    }
  }
  return null;
}

/** Copy olm.wasm to public so Olm (matrix-js-sdk) can fetch it at /olm.wasm. */
function copyOlmWasm() {
  return {
    name: "copy-olm-wasm",
    config() {
      doCopyOlmWasm();
    },
    configureServer() {
      doCopyOlmWasm();
    },
    buildStart() {
      doCopyOlmWasm();
    },
  };
}

/** Serve matrix_sdk_crypto_wasm_bg.wasm with real WASM when Vite/deps request it (otherwise root/HTML is returned). */
function serveRustCryptoWasm() {
  let cached: Buffer | null = null;
  const handler = (req: { url?: string }, res: { setHeader: (k: string, v: string) => void; end: (b: Buffer) => void }, next: () => void) => {
    if (req.url?.includes("matrix_sdk_crypto_wasm_bg.wasm")) {
      const bytes = cached ?? getCryptoWasmBytes();
      if (bytes) {
        cached = bytes;
        res.setHeader("Content-Type", "application/wasm");
        res.setHeader("Cache-Control", "public, max-age=3600");
        res.end(bytes);
        return;
      }
    }
    next();
  };
  return {
    name: "serve-rust-crypto-wasm",
    configureServer(server: { middlewares: { use: (fn: (req: unknown, res: unknown, next: () => void) => void) => void; stack?: unknown[] } }) {
      // Prepend so we run before Vite's SPA fallback (which would serve index.html for this URL).
      const mw = server.middlewares as { stack?: Array<{ route: string; handle: (req: unknown, res: unknown, next: () => void) => void }> };
      if (Array.isArray(mw.stack)) {
        mw.stack.unshift({ route: "", handle: handler });
      } else {
        server.middlewares.use(handler);
      }
    },
  };
}

export default defineConfig({
  plugins: [copyOlmWasm(), serveRustCryptoWasm(), wasm(), topLevelAwait(), react()],
  build: {
    outDir: "dist",
  },
});
