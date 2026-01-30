import { defineConfig } from "vite";
import { copyFileSync, mkdirSync, readdirSync, existsSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";

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
      },
    },
  ],
});
