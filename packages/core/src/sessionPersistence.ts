/**
 * Secure session persistence for instant reopen (no re-login on refresh).
 * Stores Matrix credentials (accessToken, deviceId, userId, baseUrl) in platform storage.
 *
 * Storage choice:
 * - Web / Tauri webview: localStorage via PlatformStorage (same-origin; use IndexedDB for Matrix sync/crypto).
 * - Extension: chrome.storage.local (injected as PlatformStorage).
 *
 * We do NOT store password or K_vault here. User still unlocks with recovery key or other device.
 */

import type { PlatformStorage } from "./platform.js";

export const SESSION_STORAGE_KEY = "vaultrix_matrix_session";

export interface StoredSession {
  baseUrl: string;
  userId: string;
  deviceId: string;
  accessToken: string;
}

export async function saveSession(
  storage: PlatformStorage,
  session: StoredSession
): Promise<void> {
  await storage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
}

export async function loadSession(
  storage: PlatformStorage
): Promise<StoredSession | null> {
  const raw = await storage.getItem(SESSION_STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (
      parsed &&
      typeof parsed === "object" &&
      typeof (parsed as StoredSession).baseUrl === "string" &&
      typeof (parsed as StoredSession).userId === "string" &&
      typeof (parsed as StoredSession).deviceId === "string" &&
      typeof (parsed as StoredSession).accessToken === "string"
    ) {
      return parsed as StoredSession;
    }
  } catch {
    // ignore
  }
  return null;
}

export async function clearSession(storage: PlatformStorage): Promise<void> {
  await storage.removeItem(SESSION_STORAGE_KEY);
}
