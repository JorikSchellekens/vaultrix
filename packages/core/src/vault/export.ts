/**
 * Backup and export: portable format independent of Matrix.
 */
import type { VaultEntry } from "./types.js";
import type { VaultModel } from "./model.js";
import { listEntries } from "./model.js";

export interface VaultExport {
  version: number;
  epoch: number;
  exported_at: number;
  entries: VaultEntry[];
}

/**
 * Export vault to a portable JSON structure (plaintext; caller may encrypt).
 */
export function exportVault(model: VaultModel): VaultExport {
  const entries = listEntries(model);
  return {
    version: 1,
    epoch: model.epoch,
    exported_at: Date.now(),
    entries: entries.map((e) => ({ ...e })),
  };
}

/**
 * Parse an export and return entries (for import).
 */
export function parseExport(data: string): VaultExport {
  const parsed = JSON.parse(data) as VaultExport;
  if (!parsed.entries || !Array.isArray(parsed.entries)) {
    throw new Error("Invalid export format");
  }
  return parsed;
}
