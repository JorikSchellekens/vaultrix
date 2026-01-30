/**
 * Extension background (MV3 service worker). Owns Matrix client and vault core.
 * Message API: getStatus, unlock, lock, listEntries, getEntry, createOp, getRecoveryKeyForQR.
 */
import "./wasm-mime-polyfill";
import "./base64-polyfill";
// Olm (matrix-js-sdk) fetches olm.wasm by URL; point it at the extension asset so we get WASM, not HTML.
(globalThis as typeof globalThis & { OLM_OPTIONS?: { locateFile?: () => string } }).OLM_OPTIONS = {
  locateFile: () => (typeof chrome !== "undefined" && chrome.runtime?.getURL ? chrome.runtime.getURL("olm.wasm") : "/olm.wasm"),
};
import {
  createMatrixClient,
  loginWithPassword,
  ensureEncryption,
  startSync,
  getVaultMeta,
  setVaultMeta,
  createVaultRoom,
  createInitialVaultMeta,
  storeVaultMasterKey,
  unlockVault,
  listEntries,
  getEntriesForUrl,
  getEntry,
} from "@vaultrix/core";
import type { VaultModel, VaultEntry, VaultOpType } from "@vaultrix/core";

let client: ReturnType<typeof createMatrixClient> | null = null;
let model: VaultModel | null = null;
let K_vault: Uint8Array | null = null;
let vaultRoomId: string | null = null;

type Message =
  | { type: "getStatus" }
  | { type: "unlock"; payload: { baseUrl: string; userId: string; password: string; recoveryKey?: string } }
  | { type: "lock" }
  | { type: "listEntries" }
  | { type: "getEntry"; payload: { entryId: string } }
  | { type: "getSuggestionsForUrl"; payload: { url: string } }
  | { type: "getEntryForFill"; payload: { entryId: string } }
  | { type: "createOp"; payload: { op: VaultOpType; entryId: string; entry: VaultEntry | null; prevOpId?: string } }
  | { type: "getRecoveryKeyForQR" };

function getStatus(): { locked: boolean; hasVault?: boolean } {
  const locked = model === null || K_vault === null;
  return { locked, hasVault: vaultRoomId !== null };
}

async function unlock(
  baseUrl: string,
  userId: string,
  password: string,
  recoveryKey?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const matrixClient = createMatrixClient({
      baseUrl,
      secretStorageKeyProvider: recoveryKey
        ? async (keyId) => {
            const key = recoveryKey.trim();
            return [keyId, new Uint8Array(32).fill(0).map((_, i) => key.charCodeAt(i % key.length))];
          }
        : undefined,
    });
    await loginWithPassword(matrixClient, { baseUrl, userId, password });
    await ensureEncryption(matrixClient);
    startSync(matrixClient);
    await new Promise<void>((r) => setTimeout(r, 3000));
    let meta = await getVaultMeta(matrixClient);
    if (!meta?.vault_room_id) {
      const { roomId } = await createVaultRoom(matrixClient);
      vaultRoomId = roomId;
      const key = new Uint8Array(32);
      crypto.getRandomValues(key);
      await storeVaultMasterKey(matrixClient, key);
      await setVaultMeta(matrixClient, createInitialVaultMeta(roomId));
      meta = await getVaultMeta(matrixClient);
    } else {
      vaultRoomId = meta.vault_room_id;
    }
    const result = await unlockVault(matrixClient);
    if (!result.success) {
      return { success: false, error: result.error };
    }
    client = matrixClient;
    model = result.model;
    K_vault = result.K_vault;
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Unlock failed" };
  }
}

function lock(): void {
  if (client) {
    try {
      (client as { stopClient?: () => void }).stopClient?.();
    } catch {}
  }
  client = null;
  model = null;
  K_vault = null;
}

chrome.runtime.onMessage.addListener(
  (
    message: Message,
    _sender: chrome.runtime.MessageSender,
    sendResponse: (response: unknown) => void
  ) => {
    const handle = async () => {
      switch (message.type) {
        case "getStatus":
          return getStatus();
        case "unlock":
          return unlock(
            message.payload.baseUrl,
            message.payload.userId,
            message.payload.password,
            message.payload.recoveryKey
          );
        case "lock":
          lock();
          return {};
        case "listEntries":
          if (!model) return { entries: [] };
          return { entries: listEntries(model) };
        case "getEntry": {
          if (!model) return { entry: null };
          const entry = model.entries.get(message.payload.entryId);
          return { entry: entry ?? null };
        }
        case "getSuggestionsForUrl": {
          if (!model) return { entries: [] };
          const entries = getEntriesForUrl(model, message.payload.url);
          return {
            entries: entries.map((e) => ({ id: e.id, title: e.title || "(Untitled)" })),
          };
        }
        case "getEntryForFill": {
          if (!model) return { username: undefined, password: undefined };
          const entry = getEntry(model, message.payload.entryId);
          if (!entry) return { username: undefined, password: undefined };
          return {
            username: entry.username,
            password: entry.password,
          };
        }
        case "createOp":
        case "getRecoveryKeyForQR":
          return { error: "Not implemented" };
        default:
          return { error: "Unknown message" };
      }
    };
    handle().then(sendResponse);
    return true;
  }
);
