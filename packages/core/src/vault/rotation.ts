/**
 * Vault key rotation: on device compromise, rotate K_vault and re-encrypt.
 */
import type { VaultModel } from "./model.js";
import { listEntries } from "./model.js";
import type { VaultEntry } from "./types.js";

/**
 * Prepare for rotation: return current entries and new epoch.
 * Caller will generate new K_vault, re-encrypt entries, write new snapshot, update SSSS and account data.
 */
export function prepareRotation(model: VaultModel): {
  entries: VaultEntry[];
  newEpoch: number;
} {
  const entries = listEntries(model);
  return {
    entries: entries.map((e) => ({ ...e })),
    newEpoch: model.epoch + 1,
  };
}
