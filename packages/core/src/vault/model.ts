/**
 * In-memory vault domain model: entries, apply ops, LWW conflict resolution.
 */
import type { VaultEntry, VaultOpType } from "./types.js";

export interface VaultModel {
  entries: Map<string, VaultEntry>;
  latestOpIdByEntry: Map<string, string>;
  epoch: number;
}

export function createEmptyModel(epoch: number): VaultModel {
  return {
    entries: new Map(),
    latestOpIdByEntry: new Map(),
    epoch,
  };
}

/**
 * Apply a single op to the model. LWW: later ts wins; tie-break by op_id.
 */
export function applyOp(
  model: VaultModel,
  entryId: string,
  op: VaultOpType,
  entry: VaultEntry | null,
  opId: string,
  ts: number,
  opEpoch: number
): void {
  if (opEpoch < model.epoch) return;
  const existing = model.entries.get(entryId);
  const existingOpId = model.latestOpIdByEntry.get(entryId);
  const existingTs = existing?.updated_at ?? 0;
  if (existingOpId && existingTs > ts) return;
  if (existingOpId && existingTs === ts && existingOpId > opId) return;

  if (op === "delete") {
    model.entries.delete(entryId);
    model.latestOpIdByEntry.set(entryId, opId);
    return;
  }
  if (op === "create" || op === "update") {
    if (!entry) return;
    if (entry.id !== entryId) return;
    model.entries.set(entryId, { ...entry });
    model.latestOpIdByEntry.set(entryId, opId);
  }
}

/**
 * Get all entries (for list view).
 */
export function listEntries(model: VaultModel): VaultEntry[] {
  return Array.from(model.entries.values());
}

/**
 * Get one entry by id.
 */
export function getEntry(model: VaultModel, entryId: string): VaultEntry | undefined {
  return model.entries.get(entryId);
}

/**
 * Entries that have a URL matching the given host (for autofill suggestions).
 */
export function getEntriesForUrl(model: VaultModel, url: string): VaultEntry[] {
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    return listEntries(model).filter((e) => {
      if (e.type !== "login" && e.type !== "api_credential") return false;
      const entryUrl = e.url;
      if (!entryUrl) return false;
      try {
        const eu = new URL(entryUrl);
        return eu.hostname.toLowerCase() === host || host.endsWith("." + eu.hostname.toLowerCase());
      } catch {
        return false;
      }
    });
  } catch {
    return [];
  }
}
