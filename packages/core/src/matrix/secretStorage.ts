/**
 * Secret storage helpers for K_vault and SSSS bootstrap.
 * K_vault is stored in SSSS under com.vaultrix.vault.v1.master_key.
 */
import type { MatrixClient } from "matrix-js-sdk";
import { getVaultMasterKeyFromSSSS, setVaultMasterKeyInSSSS } from "./client.js";

export { getVaultMasterKeyFromSSSS, setVaultMasterKeyInSSSS };

/**
 * Check if SSSS has a default key and we can read/write.
 * Returns true if secret storage appears to be set up.
 */
export async function isSecretStorageReady(client: MatrixClient): Promise<boolean> {
  try {
    const keyId = await client.secretStorage.getDefaultKeyId();
    return !!keyId;
  } catch {
    return false;
  }
}

/**
 * Store K_vault in SSSS. Call after bootstrap or when adding vault on first device.
 */
export async function storeVaultMasterKey(
  client: MatrixClient,
  key: Uint8Array
): Promise<void> {
  await setVaultMasterKeyInSSSS(client, key);
}

/**
 * Retrieve K_vault from SSSS. Requires getSecretStorageKey callback to have been
 * provided (user enters recovery key or passphrase).
 */
export async function loadVaultMasterKey(
  client: MatrixClient
): Promise<Uint8Array | null> {
  return getVaultMasterKeyFromSSSS(client);
}
