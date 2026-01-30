import { defineConfig } from "vite";
import { createRequire } from "module";
import { copyFileSync, existsSync, mkdirSync, readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import react from "@vitejs/plugin-react";
import wasm from "vite-plugin-wasm";
import topLevelAwait from "vite-plugin-top-level-await";
// Use config file dir so copy works regardless of process.cwd() (e.g. pnpm run dev:tauri from root).
var configDir = dirname(fileURLToPath(import.meta.url));
var publicDir = join(configDir, "public");
var olmWasmPaths = [
    join(configDir, "node_modules", "@matrix-org", "olm", "olm.wasm"),
    join(configDir, "..", "core", "node_modules", "@matrix-org", "olm", "olm.wasm"),
];
var cryptoWasmJsPaths = [
    join(configDir, "node_modules", "@matrix-org", "matrix-sdk-crypto-wasm", "pkg", "matrix_sdk_crypto_wasm_bg.wasm.js"),
    join(configDir, "..", "core", "node_modules", "@matrix-org", "matrix-sdk-crypto-wasm", "pkg", "matrix_sdk_crypto_wasm_bg.wasm.js"),
];
function doCopyOlmWasm() {
    for (var _i = 0, olmWasmPaths_1 = olmWasmPaths; _i < olmWasmPaths_1.length; _i++) {
        var src = olmWasmPaths_1[_i];
        if (existsSync(src)) {
            mkdirSync(publicDir, { recursive: true });
            copyFileSync(src, join(publicDir, "olm.wasm"));
            return true;
        }
    }
    return false;
}
/** Load rust crypto WASM bytes from the package's base64 .wasm.js file. */
function getCryptoWasmBytes() {
    var _a;
    for (var _i = 0, cryptoWasmJsPaths_1 = cryptoWasmJsPaths; _i < cryptoWasmJsPaths_1.length; _i++) {
        var p = cryptoWasmJsPaths_1[_i];
        if (!existsSync(p))
            continue;
        try {
            var require_1 = createRequire(import.meta.url);
            var b64 = require_1(p);
            if (typeof b64 === "string")
                return Buffer.from(b64.replace(/[^A-Za-z0-9+/]/g, ""), "base64");
        }
        catch (_b) {
            try {
                var raw = readFileSync(p, "utf-8");
                var match = (_a = raw.match(/module\.exports\s*=\s*`([^`]+)`/)) !== null && _a !== void 0 ? _a : raw.match(/=\s*["']([A-Za-z0-9+/=]+)["']/);
                if (match === null || match === void 0 ? void 0 : match[1])
                    return Buffer.from(match[1].replace(/[^A-Za-z0-9+/]/g, ""), "base64");
            }
            catch (_c) { }
        }
    }
    return null;
}
/** Copy olm.wasm to public so Olm (matrix-js-sdk) can fetch it at /olm.wasm. */
function copyOlmWasm() {
    return {
        name: "copy-olm-wasm",
        config: function () {
            doCopyOlmWasm();
        },
        configureServer: function () {
            doCopyOlmWasm();
        },
        buildStart: function () {
            doCopyOlmWasm();
        },
    };
}
/** Serve matrix_sdk_crypto_wasm_bg.wasm with real WASM when Vite/deps request it (otherwise root/HTML is returned). */
function serveRustCryptoWasm() {
    var cached = null;
    var handler = function (req, res, next) {
        var _a;
        if ((_a = req.url) === null || _a === void 0 ? void 0 : _a.includes("matrix_sdk_crypto_wasm_bg.wasm")) {
            var bytes = cached !== null && cached !== void 0 ? cached : getCryptoWasmBytes();
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
        configureServer: function (server) {
            // Prepend so we run before Vite's SPA fallback (which would serve index.html for this URL).
            var mw = server.middlewares;
            if (Array.isArray(mw.stack)) {
                mw.stack.unshift({ route: "", handle: handler });
            }
            else {
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
