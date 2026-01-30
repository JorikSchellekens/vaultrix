import { defineConfig } from "vite";
import { copyFileSync, mkdirSync, readdirSync, existsSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import wasm from "vite-plugin-wasm";
import topLevelAwait from "vite-plugin-top-level-await";

export default defineConfig({
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        background: "background.ts",
        content: "content.ts",
      },
      output: {
        entryFileNames: "[name].js",
        format: "es",
      },
    },
  },
  plugins: [
    wasm(),
    topLevelAwait(),
    {
      name: "copy-ui-and-manifest",
      closeBundle() {
        const out = join(process.cwd(), "dist");
        const uiDist = join(process.cwd(), "../packages/ui/dist");
        if (existsSync(uiDist)) {
          const assets = join(uiDist, "assets");
          if (existsSync(assets)) {
            mkdirSync(join(out, "assets"), { recursive: true });
            for (const f of readdirSync(assets)) {
              copyFileSync(join(assets, f), join(out, "assets", f));
            }
          }
          const indexHtml = join(uiDist, "index.html");
          if (existsSync(indexHtml)) {
            let html = readFileSync(indexHtml, "utf-8");
            html = html.replace(/\/assets\//g, "assets/");
            writeFileSync(join(out, "options.html"), html);
          }
        }
        for (const name of ["manifest.json", "popup.html"]) {
          const src = join(process.cwd(), name);
          if (existsSync(src)) copyFileSync(src, join(out, name));
        }
        // Olm (used by matrix-js-sdk for SAS etc.) fetches olm.wasm relative to the script URL.
        // Copy it to dist so chrome-extension://id/olm.wasm returns the real WASM, not HTML.
        const olmWasmPaths = [
          join(process.cwd(), "..", "packages", "core", "node_modules", "@matrix-org", "olm", "olm.wasm"),
          join(process.cwd(), "node_modules", "@matrix-org", "olm", "olm.wasm"),
        ];
        for (const src of olmWasmPaths) {
          if (existsSync(src)) {
            copyFileSync(src, join(out, "olm.wasm"));
            break;
          }
        }
      },
    },
  ],
});
