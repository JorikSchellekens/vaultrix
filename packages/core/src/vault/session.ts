/**
 * Vault session: unlock (SSSS -> K_vault), load snapshot, replay ops, expose model.
 * Caller provides Matrix client (already logged in) and optional recovery key for SSSS.
 */
import type { MatrixClient } from "matrix-js-sdk";
import { getVaultMeta } from "../matrix/client.js";
import { loadVaultMasterKey } from "../matrix/secretStorage.js";
import type { VaultModel } from "./model.js";
import { createEmptyModel } from "./model.js";
import { parseAndApplyVaultOp } from "./syncLog.js";
import {
  parseSnapshotContent,
  applySnapshotToModel,
  EVENT_TYPE_VAULT_SNAPSHOT,
} from "./snapshots.js";
import { EVENT_TYPE_VAULT_OP } from "./syncLog.js";
import type { VaultEntry } from "./types.js";
import type { VaultMeta } from "../matrix/vaultRoom.js";

export interface UnlockResult {
  success: boolean;
  model: VaultModel;
  K_vault: Uint8Array;
  meta: VaultMeta;
  error?: string;
}

/**
 * Unlock vault: load K_vault from SSSS, fetch snapshot, replay ops.
 * Client must have getSecretStorageKey callback set (e.g. user entered recovery key).
 */
export async function unlockVault(client: MatrixClient): Promise<UnlockResult> {
  const K_vault = await loadVaultMasterKey(client);
  if (!K_vault) {
    return {
      success: false,
      model: createEmptyModel(1),
      K_vault: new Uint8Array(0),
      meta: { version: 0, vault_room_id: "", vault_epoch: 1 },
      error: "Could not load vault key from secret storage",
    };
  }

  const meta = await getVaultMeta(client);
  if (!meta?.vault_room_id) {
    return {
      success: false,
      model: createEmptyModel(meta?.vault_epoch ?? 1),
      K_vault,
      meta: meta ?? { version: 0, vault_room_id: "", vault_epoch: 1 },
      error: "No vault metadata found",
    };
  }

  const epoch = meta.vault_epoch ?? 1;
  const model = createEmptyModel(epoch);

  const roomId = meta.vault_room_id;
  const room = client.getRoom(roomId);
  if (!room) {
    return {
      success: true,
      model,
      K_vault,
      meta,
      error: "Vault room not yet synced",
    };
  }

  const timeline = room.getLiveTimeline().getEvents();

  for (const event of timeline) {
    const type = event.getType();
    const content = event.getContent();
    if (type === EVENT_TYPE_VAULT_SNAPSHOT) {
      const entries = await parseSnapshotContent(content, K_vault);
      if (entries?.length !== undefined) {
        applySnapshotToModel(model, entries, epoch);
      }
    }
  }

  for (const event of timeline) {
    const type = event.getType();
    const content = event.getContent();
    if (type === EVENT_TYPE_VAULT_OP) {
      await parseAndApplyVaultOp(content, K_vault, model);
    }
  }

  return {
    success: true,
    model,
    K_vault,
    meta,
  };
}

/**
 * List entries from model (for UI).
 */
export function listEntries(model: VaultModel): VaultEntry[] {
  return Array.from(model.entries.values());
}

/**
 * Get one entry (for UI / fill).
 */
export function getEntry(
  model: VaultModel,
  entryId: string
): VaultEntry | undefined {
  return model.entries.get(entryId);
}
