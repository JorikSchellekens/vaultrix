/**
 * Platform abstraction so core can run in extension and Tauri without
 * depending on browser or Tauri APIs. Caller injects implementations.
 */
export interface PlatformStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

export interface SecureRandom {
  getRandomValues<T extends ArrayBufferView>(array: T): T;
}

export interface Platform {
  storage: PlatformStorage;
  secureRandom: SecureRandom;
}

/**
 * Default web platform: localStorage + crypto.getRandomValues.
 * Extension/Tauri can override storage to use chrome.storage or Rust.
 */
export function createWebPlatform(): Platform {
  return {
    storage: {
      async getItem(key: string) {
        return localStorage.getItem(key);
      },
      async setItem(key: string, value: string) {
        localStorage.setItem(key, value);
      },
      async removeItem(key: string) {
        localStorage.removeItem(key);
      },
    },
    secureRandom: {
      getRandomValues<T extends ArrayBufferView>(array: T): T {
        return crypto.getRandomValues(array);
      },
    },
  };
}
