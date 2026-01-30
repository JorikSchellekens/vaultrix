/**
 * Snapshot events: create snapshot payload, parse and apply snapshot.
 */
import type { VaultEntry } from "./types.js";
import type { VaultModel } from "./model.js";
import { SCHEMA_VERSION } from "../constants.js";
import { EVENT_TYPE_VAULT_SNAPSHOT } from "../constants.js";
import {
  encryptWithVaultKey,
  decryptWithVaultKey,
  serializeCiphertextBundle,
  parseCiphertextBundle,
  type CiphertextBundle,
} from "./crypto.js";

export interface SnapshotBlob {
  mxc_url: string;
  size: number;
  hash: string;
}

export interface VaultSnapshotEventContent {
  snapshot_id: string;
  base_op_id?: string;
  epoch: number;
  blob: SnapshotBlob;
  ciphertext: string;
}

export interface SnapshotPayload {
  schema_version: number;
  entries: VaultEntry[];
  created_at: number;
  snapshot_notes?: string;
}

/**
 * Build snapshot payload (to be encrypted and optionally uploaded as media).
 * Caller uploads the encrypted blob and gets mxc_url, then builds the event.
 */
export async function buildSnapshotPayload(
  entries: VaultEntry[],
  K_vault: Uint8Array
): Promise<{ ciphertext: string; payload: SnapshotPayload }> {
  const payload: SnapshotPayload = {
    schema_version: SCHEMA_VERSION,
    entries,
    created_at: Date.now(),
  };
  const plaintext = new TextEncoder().encode(JSON.stringify(payload));
  const bundle = await encryptWithVaultKey(plaintext, K_vault);
  return {
    ciphertext: serializeCiphertextBundle(bundle),
    payload,
  };
}

/**
 * Parse snapshot event content and decrypt; return entries.
 */
export async function parseSnapshotContent(
  content: unknown,
  K_vault: Uint8Array
): Promise<VaultEntry[] | null> {
  const c = content as VaultSnapshotEventContent;
  if (!c?.ciphertext || !c.epoch) return null;
  let bundle: CiphertextBundle;
  try {
    bundle = parseCiphertextBundle(c.ciphertext);
  } catch {
    return null;
  }
  let plaintext: Uint8Array;
  try {
    plaintext = await decryptWithVaultKey(bundle, K_vault);
  } catch {
    return null;
  }
  let payload: SnapshotPayload;
  try {
    payload = JSON.parse(new TextDecoder().decode(plaintext)) as SnapshotPayload;
  } catch {
    return null;
  }
  return payload?.entries ?? null;
}

/**
 * Apply snapshot entries to a fresh model (replace state).
 */
export function applySnapshotToModel(
  model: VaultModel,
  entries: VaultEntry[],
  epoch: number
): void {
  model.entries.clear();
  model.latestOpIdByEntry.clear();
  model.epoch = epoch;
  for (const e of entries) {
    model.entries.set(e.id, { ...e });
    model.latestOpIdByEntry.set(e.id, `snapshot-${e.id}`);
  }
}

export { EVENT_TYPE_VAULT_SNAPSHOT };
