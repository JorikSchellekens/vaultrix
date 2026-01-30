import { useState, useCallback } from "react";
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
} from "@vaultrix/core";
import type { VaultModel, VaultEntry, MatrixClient, VaultMeta } from "@vaultrix/core";

type View = "list" | "entry" | "create" | "edit" | "settings";

export default function App() {
  const [unlocked, setUnlocked] = useState<{
    model: VaultModel;
    K_vault: Uint8Array;
    client: MatrixClient;
    meta: VaultMeta;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<View>("list");
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);

  const handleUnlock = (
    model: VaultModel,
    K_vault: Uint8Array,
    client: MatrixClient,
    meta: VaultMeta
  ) => {
    setUnlocked({ model, K_vault, client, meta });
    setError(null);
    setView("list");
    setSelectedEntryId(null);
  };

  const handleLock = () => {
    setUnlocked(null);
    setView("list");
    setSelectedEntryId(null);
  };

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
      setView("list");
      setSelectedEntryId(entry.id);
    },
    [unlocked, sendOp]
  );

  const handleDeleteEntry = useCallback(
    async (entry: VaultEntry) => {
      await sendOp("delete", entry.id, null);
      setView("list");
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
          {error && <p className="app-error">{error}</p>}
          <UnlockScreen onUnlock={handleUnlock} onError={setError} />
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
            className={view === "list" ? "active" : ""}
            onClick={() => setView("list")}
          >
            Entries
          </button>
          <button
            type="button"
            className={view === "settings" ? "active" : ""}
            onClick={() => setView("settings")}
          >
            Vault
          </button>
          <button type="button" onClick={handleLock}>
            Lock
          </button>
        </nav>
        {copyFeedback && <span className="app-copy-feedback">{copyFeedback}</span>}
      </header>

      <main className="app-main">
        {view === "list" && (
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
        )}

        {view === "entry" && selectedEntryId && (
          <EntryDetail
            model={model}
            entryId={selectedEntryId}
            onBack={() => setView("list")}
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
            onCancel={() => setView("list")}
          />
        )}

        {view === "edit" && selectedEntry && (
          <EntryForm
            entry={selectedEntry}
            onSave={handleSaveEntry}
            onCancel={() => setView("entry")}
          />
        )}

        {view === "settings" && (
          <VaultSettings client={client} meta={meta} onBack={() => setView("list")} />
        )}
      </main>
    </div>
  );
}
