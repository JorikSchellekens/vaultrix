/**
 * Polyfill so WASM loads work when the server sends wrong MIME type (e.g. chrome-extension://).
 * Replaces instantiateStreaming with fetch → arrayBuffer → instantiate.
 * Must be imported before any code that loads WASM (e.g. @vaultrix/core → matrix-js-sdk).
 */
(function () {
  if (typeof WebAssembly === "undefined" || !WebAssembly.instantiateStreaming) return;
  const W = WebAssembly as typeof WebAssembly & {
    instantiateStreaming(
      response: Response | Promise<Response>,
      importObject?: WebAssembly.Imports
    ): Promise<WebAssembly.WebAssemblyInstantiatedSource>;
  };
  W.instantiateStreaming = function (
    responseOrPromise: Response | Promise<Response>,
    importObject?: WebAssembly.Imports
  ): Promise<WebAssembly.WebAssemblyInstantiatedSource> {
    return Promise.resolve(responseOrPromise)
      .then((response) => response.arrayBuffer())
      .then((bytes) => WebAssembly.instantiate(bytes, importObject ?? {}));
  };
})();
