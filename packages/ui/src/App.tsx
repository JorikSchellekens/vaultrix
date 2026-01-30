import { useState } from "react";
import { UnlockScreen } from "./UnlockScreen";
import { VaultList } from "./VaultList";
import type { VaultModel } from "@vaultrix/core";

export default function App() {
  const [unlocked, setUnlocked] = useState<{
    model: VaultModel;
    K_vault: Uint8Array;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleUnlock = (model: VaultModel, K_vault: Uint8Array) => {
    setUnlocked({ model, K_vault });
    setError(null);
  };

  const handleLock = () => {
    setUnlocked(null);
  };

  if (unlocked) {
    return (
      <div style={{ padding: 16, maxWidth: 640, margin: "0 auto" }}>
        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <h1 style={{ margin: 0, fontSize: 18 }}>Vaultrix Vault</h1>
          <button type="button" onClick={handleLock}>
            Lock
          </button>
        </header>
        <VaultList model={unlocked.model} />
      </div>
    );
  }

  return (
    <div style={{ padding: 16, maxWidth: 400, margin: "0 auto" }}>
      <h1 style={{ marginBottom: 16, fontSize: 20 }}>Vaultrix</h1>
      {error && (
        <p style={{ color: "#e66", marginBottom: 12 }}>{error}</p>
      )}
      <UnlockScreen onUnlock={handleUnlock} onError={setError} />
    </div>
  );
}
