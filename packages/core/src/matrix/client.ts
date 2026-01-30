/**
 * Matrix client wrapper: login, E2EE bootstrap, sync.
 * Uses matrix-js-sdk; crypto callbacks are injected for SSSS (recovery key / passphrase).
 */
import {
  createClient,
  MatrixClient,
  ClientEvent,
  MatrixEvent,
  ICreateClientOpts,
} from "matrix-js-sdk";
import {
  VAULT_META_ACCOUNT_DATA_KEY,
  VAULT_MASTER_KEY_SECRET_NAME,
  EVENT_TYPE_VAULT_OP,
} from "../constants.js";
import type { VaultMeta } from "./vaultRoom.js";
import type { VaultOpEventContent } from "../vault/types.js";

export interface LoginCredentials {
  baseUrl: string;
  userId: string;
  password: string;
  deviceId?: string;
}

/** [keyId, privateKey]. Used by SSSS getSecretStorageKey callback. */
export type SecretStorageKeyTuple = [string, Uint8Array];

export type SecretStorageKeyProvider = (
  keyId: string
) => Promise<SecretStorageKeyTuple | null>;

/**
 * Create a Matrix client with optional crypto callbacks for SSSS.
 * For login with password we use m.login.password.
 */
export function createMatrixClient(
  opts: Partial<ICreateClientOpts> & {
    baseUrl: string;
    secretStorageKeyProvider?: SecretStorageKeyProvider;
  }
): MatrixClient {
  const { baseUrl, secretStorageKeyProvider, ...rest } = opts;
  const clientOpts: ICreateClientOpts = {
    baseUrl,
    ...rest,
  };

  if (secretStorageKeyProvider) {
    (clientOpts as ICreateClientOpts & { cryptoCallbacks?: unknown }).cryptoCallbacks = {
      getSecretStorageKey: async (
        opts: { keys: Record<string, unknown> },
        _name: string
      ): Promise<[string, Uint8Array<ArrayBuffer>] | null> => {
        const keyIds = Object.keys(opts.keys);
        for (const keyId of keyIds) {
          const tuple = await secretStorageKeyProvider(keyId);
          if (tuple) return tuple as [string, Uint8Array<ArrayBuffer>];
        }
        return null;
      },
    };
  }

  return createClient(clientOpts);
}

/**
 * Log in with password. Returns the same client with credentials set.
 * Also sets client.deviceId from the login response (the SDK does not do this
 * in login()), which is required for initRustCrypto / ensureEncryption.
 */
export async function loginWithPassword(
  client: MatrixClient,
  credentials: LoginCredentials
): Promise<{ accessToken: string; deviceId: string }> {
  const result = await client.loginWithPassword(
    credentials.userId,
    credentials.password
  );
  const deviceId = result.device_id ?? client.getDeviceId() ?? "";
  if (result.device_id) {
    (client as MatrixClient & { deviceId: string | null }).deviceId = result.device_id;
  }
  return {
    accessToken: result.access_token,
    deviceId,
  };
}

/**
 * Enable E2EE for the client (required for encrypted rooms). Call after login, before startSync.
 * Uses the SDK's Rust crypto implementation so the client can join/send in encrypted rooms.
 */
export async function ensureEncryption(client: MatrixClient): Promise<void> {
  if (client.getCrypto()) return;
  await client.initRustCrypto();
}

/**
 * Start the client sync loop. Call once after login (and after ensureEncryption for encrypted rooms).
 */
export function startSync(client: MatrixClient): void {
  client.startClient();
}

/**
 * Stop the client (e.g. on lock).
 */
export function stopSync(client: MatrixClient): void {
  client.stopClient();
}

/**
 * Get vault metadata from account data (non-secret). Returns null if not set.
 */
export async function getVaultMeta(client: MatrixClient): Promise<VaultMeta | null> {
  const data = client.getAccountData(VAULT_META_ACCOUNT_DATA_KEY as keyof import("matrix-js-sdk").AccountDataEvents);
  const content = data?.getContent();
  if (!content || typeof content !== "object") return null;
  return content as unknown as VaultMeta;
}

/**
 * Set vault metadata in account data.
 */
export async function setVaultMeta(
  client: MatrixClient,
  meta: VaultMeta
): Promise<void> {
  await client.setAccountData(VAULT_META_ACCOUNT_DATA_KEY as keyof import("matrix-js-sdk").AccountDataEvents, meta as unknown as Record<string, unknown>);
}

/**
 * Send a vault op event to the vault room. Caller must have built the op content
 * (e.g. via buildVaultOpContent). Returns the event id.
 */
export async function sendVaultOpEvent(
  client: MatrixClient,
  roomId: string,
  content: VaultOpEventContent
): Promise<string> {
  // Custom event type and content; SDK types only allow known TimelineEvents
  const result = await (client.sendEvent as (roomId: string, eventType: string, content: object) => Promise<{ event_id?: string }>)(
    roomId,
    EVENT_TYPE_VAULT_OP,
    content as object
  );
  return result.event_id ?? "";
}

/**
 * Get the vault master key from SSSS. Requires getSecretStorageKey callback
 * to have been provided (recovery key or passphrase).
 */
export async function getVaultMasterKeyFromSSSS(
  client: MatrixClient
): Promise<Uint8Array | null> {
  const secret = await client.secretStorage.get(VAULT_MASTER_KEY_SECRET_NAME);
  if (!secret) return null;
  const decoded = base64ToBytes(secret);
  return decoded.length === 32 ? decoded : null;
}

/**
 * Store the vault master key in SSSS. Typically called after bootstrapSecretStorage
 * or when the user has already set up SSSS. The key must be 32 bytes.
 */
export async function setVaultMasterKeyInSSSS(
  client: MatrixClient,
  key: Uint8Array
): Promise<void> {
  if (key.length !== 32) throw new Error("K_vault must be 32 bytes");
  await client.secretStorage.store(VAULT_MASTER_KEY_SECRET_NAME, bytesToBase64(key));
}

function bytesToBase64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes));
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export type { MatrixClient, MatrixEvent };
export { ClientEvent };
