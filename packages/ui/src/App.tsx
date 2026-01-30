import { useState, useCallback, useEffect } from "react";
import { UnlockScreen } from "./UnlockScreen";
import { EntryList } from "./EntryList";
import { EntryDetail } from "./EntryDetail";
import { EntryForm } from "./EntryForm";
import { VaultSettings } from "./VaultSettings";
import {
  getEntry,
  applyOp,
  buildVaultOpContent,
  sendVaultOpEvent,
  createWebPlatform,
  loadSession,
  clearSession,
  saveSession,
  createMatrixClient,
  ensureEncryption,
  startSync,
} from "@vaultrix/core";
import type { VaultModel, VaultEntry, MatrixClient, VaultMeta } from "@vaultrix/core";
import type { StoredSession } from "@vaultrix/core";

type View = "entry" | "create" | "edit" | "settings";

const MATRIX_STORE_DB_NAME = "vaultrix-matrix";

function waitForPrepared(client: MatrixClient, timeoutMs = 10000): Promise<void> {
  return new Promise((resolve) => {
    const t = setTimeout(() => resolve(), Math.min(timeoutMs, 5000));
    const onSync = (state: string) => {
      if (state === "PREPARED") {
        clearTimeout(t);
        client.removeListener("sync" as never, onSync as never);
        resolve();
      }
    };
    client.on("sync" as never, onSync as never);
  });
}

export default function App() {
  const platform = createWebPlatform();
  const [unlocked, setUnlocked] = useState<{
    model: VaultModel;
    K_vault: Uint8Array;
    client: MatrixClient;
    meta: VaultMeta;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<View>("entry");
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);
  /** Restored Matrix client and session (user still needs to unlock with recovery key). */
  const [restoredClient, setRestoredClient] = useState<{
    client: MatrixClient;
    userId: string;
    session: StoredSession;
  } | null>(null);
  const [restoring, setRestoring] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const session = await loadSession(platform.storage);
      if (!session || typeof globalThis.indexedDB === "undefined") {
        setRestoring(false);
        return;
      }
      try {
        const { IndexedDBStore } = await import("matrix-js-sdk");
        const store = new IndexedDBStore({
          indexedDB: globalThis.indexedDB,
          dbName: MATRIX_STORE_DB_NAME,
          localStorage: globalThis.localStorage,
        });
        const client = createMatrixClient({
          baseUrl: session.baseUrl,
          userId: session.userId,
          deviceId: session.deviceId,
          accessToken: session.accessToken,
          store,
        });
        await store.startup();
        await ensureEncryption(client);
        startSync(client);
        await waitForPrepared(client);
        if (cancelled) return;
        setRestoredClient({ client, userId: session.userId, session });
      } catch {
        await clearSession(platform.storage);
      } finally {
        if (!cancelled) setRestoring(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [platform.storage]);

  const handleUnlock = (
    model: VaultModel,
    K_vault: Uint8Array,
    client: MatrixClient,
    meta: VaultMeta
  ) => {
    setRestoredClient(null);
    setUnlocked({ model, K_vault, client, meta });
    setError(null);
    setView("entry");
    setSelectedEntryId(null);
  };

  const handleLock = () => {
    setUnlocked(null);
    setRestoredClient(null);
    setView("entry");
    setSelectedEntryId(null);
  };

  const handleSessionReady = useCallback((session: StoredSession) => {
    saveSession(platform.storage, session).catch(() => {});
  }, [platform.storage]);

  const refreshModel = useCallback(() => {
    setUnlocked((prev) => {
      if (!prev) return null;
      return {
        ...prev,
        model: {
          ...prev.model,
          entries: new Map(prev.model.entries),
          latestOpIdByEntry: new Map(prev.model.latestOpIdByEntry),
        },
      };
    });
  }, []);

  const sendOp = useCallback(
    async (
      op: "create" | "update" | "delete",
      entryId: string,
      entry: VaultEntry | null
    ) => {
      if (!unlocked) return;
      const { model, K_vault, client, meta } = unlocked;
      const deviceId = client.getDeviceId() ?? "";
      const prevOpId = model.latestOpIdByEntry.get(entryId);
      const content = await buildVaultOpContent(
        op,
        entryId,
        entry,
        prevOpId,
        meta.vault_epoch,
        deviceId,
        K_vault
      );
      await sendVaultOpEvent(client, meta.vault_room_id, content);
      const ts = content.ts;
      applyOp(model, entryId, op, entry, content.op_id, ts, meta.vault_epoch);
      refreshModel();
    },
    [unlocked, refreshModel]
  );

  const handleSaveEntry = useCallback(
    async (entry: VaultEntry) => {
      const isNew = !unlocked?.model.entries.has(entry.id);
      await sendOp(isNew ? "create" : "update", entry.id, entry);
      setView("entry");
      setSelectedEntryId(entry.id);
    },
    [unlocked, sendOp]
  );

  const handleDeleteEntry = useCallback(
    async (entry: VaultEntry) => {
      await sendOp("delete", entry.id, null);
      setView("entry");
      setSelectedEntryId(null);
    },
    [sendOp]
  );

  const handleCopy = useCallback((label: string, _value: string) => {
    setCopyFeedback(`Copied ${label}`);
    setTimeout(() => setCopyFeedback(null), 2000);
  }, []);

  if (!unlocked) {
    return (
      <div className="app app-unlocked">
        <div className="app-container">
          <h1 className="app-title">Vaultrix</h1>
          {restoring && (
            <p style={{ color: "#666", marginBottom: 12 }}>Restoring session…</p>
          )}
          {error && <p className="app-error">{error}</p>}
          {!restoring && (
            <UnlockScreen
              onUnlock={handleUnlock}
              onError={setError}
              onSessionReady={handleSessionReady}
              restoredClient={restoredClient?.client}
              restoredUserId={restoredClient?.userId}
              restoredSession={restoredClient?.session}
              matrixStoreDbName={MATRIX_STORE_DB_NAME}
              onClearSession={async () => {
                await clearSession(platform.storage);
                setRestoredClient(null);
              }}
            />
          )}
        </div>
      </div>
    );
  }

  const { model, client, meta } = unlocked;
  const selectedEntry = selectedEntryId ? getEntry(model, selectedEntryId) : null;

  return (
    <div className="app app-unlocked">
      <header className="app-header">
        <h1 className="app-logo">Vaultrix Vault</h1>
        <nav className="app-nav">
          <button
            type="button"
            className={view === "settings" ? "active" : ""}
            onClick={() => setView(view === "settings" ? "entry" : "settings")}
          >
            Vault
          </button>
          <button type="button" onClick={handleLock}>
            Lock
          </button>
        </nav>
        {copyFeedback && <span className="app-copy-feedback">{copyFeedback}</span>}
      </header>

      <main className="app-main app-main-master-detail">
        <aside className="master-detail-master" aria-label="Entries list">
          <EntryList
            model={model}
            selectedEntryId={selectedEntryId}
            onSelectEntry={(e) => {
              setSelectedEntryId(e.id);
              setView("entry");
            }}
            onAddEntry={() => {
              setSelectedEntryId(null);
              setView("create");
            }}
          />
        </aside>
        <div className="master-detail-detail" aria-label="Entry detail">
          {view === "settings" && (
            <VaultSettings
              client={client}
              meta={meta}
              onBack={() => setView("entry")}
            />
          )}

          {view === "entry" && selectedEntryId && (
            <EntryDetail
              model={model}
              entryId={selectedEntryId}
              onBack={() => setSelectedEntryId(null)}
              onEdit={(e) => {
                setSelectedEntryId(e.id);
                setView("edit");
              }}
              onSaveEntry={handleSaveEntry}
              onDeleteEntry={handleDeleteEntry}
              onCopy={handleCopy}
            />
          )}

          {view === "create" && (
            <EntryForm
              entry={null}
              onSave={handleSaveEntry}
              onCancel={() => setView("entry")}
            />
          )}

          {view === "edit" && selectedEntry && (
            <EntryForm
              entry={selectedEntry}
              onSave={handleSaveEntry}
              onCancel={() => setView("entry")}
            />
          )}

          {view === "entry" && !selectedEntryId && (
            <div className="detail-empty" aria-live="polite">
              <p>Select an entry from the list or add a new one.</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
