/**
 * Local persistence: IndexedDB via Dexie. Stores app-level ciphertext and indexes.
 */
import Dexie, { type Table } from "dexie";
import type { Platform } from "../platform.js";

export interface VaultEntryRow {
  entry_id: string;
  encrypted_entry_blob: string;
  last_op_id: string;
  folder_id?: string;
  title_index: string;
  url_index?: string;
  updated_at: number;
}

export interface VaultOpRow {
  op_id: string;
  entry_id: string;
  op_type: string;
  epoch: number;
  encrypted_op_blob: string;
  ts: number;
}

export interface VaultSnapshotRow {
  snapshot_id: string;
  epoch: number;
  mxc_url: string;
  hash: string;
  size: number;
  encrypted_snapshot_meta: string;
}

export interface VaultStateRow {
  id: "singleton";
  latest_applied_op_id?: string;
  latest_snapshot_id?: string;
  epoch: number;
  schema_version: number;
}

const DB_NAME = "vaultrix-vault";

export class VaultDatabase extends Dexie {
  vault_entries!: Table<VaultEntryRow, string>;
  vault_ops!: Table<VaultOpRow, string>;
  vault_snapshots!: Table<VaultSnapshotRow, string>;
  vault_state!: Table<VaultStateRow, string>;

  constructor(dbName: string = DB_NAME) {
    super(dbName);
    this.version(1).stores({
      vault_entries: "entry_id, folder_id, title_index, url_index, updated_at",
      vault_ops: "op_id, entry_id, ts",
      vault_snapshots: "snapshot_id, epoch",
      vault_state: "id",
    });
  }
}

export async function getVaultState(
  db: VaultDatabase
): Promise<VaultStateRow | undefined> {
  return db.vault_state.get("singleton");
}

export async function setVaultState(
  db: VaultDatabase,
  state: Partial<VaultStateRow> & { id: "singleton" }
): Promise<void> {
  await db.vault_state.put({ ...state, id: "singleton" } as VaultStateRow);
}

export async function initVaultState(
  db: VaultDatabase,
  epoch: number,
  schemaVersion: number
): Promise<void> {
  const existing = await getVaultState(db);
  if (!existing) {
    await setVaultState(db, {
      id: "singleton",
      epoch,
      schema_version: schemaVersion,
    });
  }
}

/**
 * Create a VaultDatabase. In browser/extension use default IndexedDB.
 * Platform is optional (for future Tauri/local key wrapping).
 */
export function createVaultDatabase(
  _platform?: Platform,
  dbName: string = DB_NAME
): VaultDatabase {
  return new VaultDatabase(dbName);
}
