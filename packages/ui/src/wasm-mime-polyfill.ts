/**
 * Polyfill so WASM loads work when the server sends wrong MIME type (e.g. chrome-extension://
 * or some dev servers). Replaces instantiateStreaming with fetch → arrayBuffer → instantiate.
 * Also sets OLM_OPTIONS.locateFile so Olm fetches /olm.wasm (real WASM) instead of a
 * script-relative URL that may return HTML (404/SPA fallback).
 * Must be imported before any code that loads WASM (e.g. matrix-js-sdk / Olm / rust-crypto).
 */
(function () {
  const g = typeof globalThis !== "undefined" ? globalThis : (typeof window !== "undefined" ? window : ({} as Window));
  const wasmBaseUrl =
    typeof window !== "undefined" && window.location?.origin
      ? window.location.origin + "/olm.wasm"
      : "/olm.wasm";
  (g as Window & { OLM_OPTIONS?: { locateFile?: (file: string, scriptDir: string) => string } }).OLM_OPTIONS = {
    locateFile: (file: string, scriptDir: string) => {
      const url = "/olm.wasm";
      console.log("[vaultrix] OLM_OPTIONS.locateFile called:", { file, scriptDir, resolvedUrl: url, fullUrl: wasmBaseUrl });
      return url;
    },
  };
  console.log("[vaultrix] OLM_OPTIONS.locateFile set; Olm will request:", wasmBaseUrl);

  // Log any fetch of .wasm so we can see which URL is actually used
  if (typeof globalThis.fetch !== "undefined") {
    const origFetch = globalThis.fetch;
    globalThis.fetch = function (input: RequestInfo | URL, init?: RequestInit) {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : (input as Request).url;
      if (url.includes(".wasm") || url.endsWith("/olm.wasm")) {
        console.log("[vaultrix] fetch(.wasm) request:", url);
      }
      return origFetch.call(this, input, init).then((res) => {
        if (url.includes(".wasm") || url.endsWith("/olm.wasm")) {
          console.log("[vaultrix] fetch(.wasm) response:", { url, status: res.status, contentType: res.headers.get("content-type") });
        }
        return res;
      });
    };
  }

  if (typeof WebAssembly === "undefined" || !WebAssembly.instantiateStreaming) return;
  const W = WebAssembly as typeof WebAssembly & {
    instantiateStreaming(
      source: Response | PromiseLike<Response>,
      importObject?: WebAssembly.Imports
    ): Promise<WebAssembly.WebAssemblyInstantiatedSource>;
  };
  W.instantiateStreaming = function (
    responseOrPromise: Response | PromiseLike<Response>,
    importObject?: WebAssembly.Imports
  ): Promise<WebAssembly.WebAssemblyInstantiatedSource> {
    return Promise.resolve(responseOrPromise).then((response) => {
      const url = (response as Response).url ?? "(unknown)";
      return (response as Response)
        .arrayBuffer()
        .then((bytes) => {
          const arr = new Uint8Array(bytes);
          const hex = Array.from(arr.slice(0, 4))
            .map((b) => b.toString(16).padStart(2, "0"))
            .join(" ");
          const isWasm = arr.length >= 4 && arr[0] === 0 && arr[1] === 0x61 && arr[2] === 0x73 && arr[3] === 0x6d;
          console.log("[vaultrix] WebAssembly.instantiate response:", {
            url,
            byteLength: bytes.byteLength,
            first4BytesHex: hex,
            isWasm,
          });
          if (!isWasm) {
            console.warn("[vaultrix] Response is not WASM (expected 00 61 73 6d). URL may be wrong or server returned HTML:", url);
          }
          return WebAssembly.instantiate(bytes, importObject ?? {});
        });
    });
  };
})();
