/**
 * Operation log: build op events, parse op events, apply to model.
 */
import type { VaultEntry, VaultOpPayload, VaultOpType, VaultOpEventContent } from "./types.js";
import type { VaultModel } from "./model.js";
import { applyOp } from "./model.js";
import { SCHEMA_VERSION, EVENT_TYPE_VAULT_OP } from "../constants.js";
import {
  encryptWithVaultKey,
  decryptWithVaultKey,
  serializeCiphertextBundle,
  parseCiphertextBundle,
  type CiphertextBundle,
} from "./crypto.js";

export type { VaultOpEventContent };

/**
 * Build encrypted op content for sending to the room.
 */
export async function buildVaultOpContent(
  op: VaultOpType,
  entryId: string,
  entry: VaultEntry | null,
  prevOpId: string | undefined,
  epoch: number,
  deviceId: string,
  K_vault: Uint8Array
): Promise<VaultOpEventContent> {
  const opId = crypto.randomUUID();
  const ts = Date.now();
  const payload: VaultOpPayload = {
    schema_version: SCHEMA_VERSION,
    entry: entry ?? ({ id: entryId, type: "login", title: "", custom_fields: [], created_at: 0, updated_at: ts } as VaultEntry),
  };
  const plaintext = new TextEncoder().encode(JSON.stringify(payload));
  const bundle = await encryptWithVaultKey(plaintext, K_vault);
  const ciphertext = serializeCiphertextBundle(bundle);
  return {
    op_id: opId,
    device_id: deviceId,
    ts,
    op,
    entry_id: entryId,
    prev: prevOpId,
    epoch,
    ciphertext,
  };
}

/**
 * Parse and decrypt op content; apply to model.
 */
export async function parseAndApplyVaultOp(
  content: unknown,
  K_vault: Uint8Array,
  model: VaultModel
): Promise<void> {
  const c = content as VaultOpEventContent;
  if (!c?.op_id || !c.entry_id || !c.ciphertext || c.epoch === undefined) return;
  let bundle: CiphertextBundle;
  try {
    bundle = parseCiphertextBundle(c.ciphertext);
  } catch {
    return;
  }
  let plaintext: Uint8Array;
  try {
    plaintext = await decryptWithVaultKey(bundle, K_vault);
  } catch {
    return;
  }
  let payload: VaultOpPayload;
  try {
    payload = JSON.parse(new TextDecoder().decode(plaintext)) as VaultOpPayload;
  } catch {
    return;
  }
  if (!payload?.entry && c.op !== "delete") return;
  applyOp(
    model,
    c.entry_id,
    c.op,
    c.op === "delete" ? null : payload.entry,
    c.op_id,
    c.ts,
    c.epoch
  );
}

export { EVENT_TYPE_VAULT_OP };
