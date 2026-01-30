/**
 * Ensure btoa/atob exist on globalThis so matrix-js-sdk base64 helpers work
 * in environments where they're missing (e.g. some extension service workers).
 * Must be imported before any code that uses matrix-js-sdk.
 */
const log = (msg: string, ...args: unknown[]) => {
  try {
    console.log("[Vaultrix base64]", msg, ...args);
  } catch {
    // no-op if console unavailable
  }
};

const g = typeof globalThis !== "undefined" ? globalThis : typeof self !== "undefined" ? self : (typeof window !== "undefined" ? window : ({} as Window & typeof globalThis));
const globalName =
  typeof globalThis !== "undefined" && g === globalThis
    ? "globalThis"
    : typeof self !== "undefined" && g === self
      ? "self"
      : "window";
log("load: global=", globalName, "typeof btoa=", typeof g.btoa, "typeof atob=", typeof g.atob);

if (typeof g.btoa !== "function") {
  log("installing btoa polyfill on", globalName);
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  g.btoa = function btoaPolyfill(input: string): string {
    let str = input;
    const len = str.length;
    let out = "";
    for (let i = 0; i < len; i += 3) {
      const a = str.charCodeAt(i);
      const b = i + 1 < len ? str.charCodeAt(i + 1) : 0;
      const c = i + 2 < len ? str.charCodeAt(i + 2) : 0;
      out += chars[a >>> 2];
      out += chars[((a & 3) << 4) | (b >>> 4)];
      out += i + 1 < len ? chars[((b & 15) << 2) | (c >>> 6)] : "=";
      out += i + 2 < len ? chars[c & 63] : "=";
    }
    return out;
  };
} else {
  log("btoa already present");
}

if (typeof g.atob !== "function") {
  log("installing atob polyfill on", globalName);
  g.atob = function atobPolyfill(input: string): string {
    const str = input.replace(/=+$/, "");
    const len = str.length;
    let out = "";
    const key = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    for (let i = 0; i < len; i += 4) {
      const a = key.indexOf(str[i]);
      const b = key.indexOf(str[i + 1]);
      const c = key.indexOf(str[i + 2]);
      const d = key.indexOf(str[i + 3]);
      const n = (a << 18) | (b << 12) | (c << 6) | d;
      out += String.fromCharCode((n >>> 16) & 255);
      if (c !== -1) out += String.fromCharCode((n >>> 8) & 255);
      if (d !== -1) out += String.fromCharCode(n & 255);
    }
    return out;
  };
} else {
  log("atob already present");
}

log("done: typeof btoa=", typeof g.btoa, "typeof atob=", typeof g.atob);

export {};
