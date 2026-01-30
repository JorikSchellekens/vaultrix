import { useState } from "react";
import {
  createMatrixClient,
  loginWithPassword,
  startSync,
  getVaultMeta,
  setVaultMeta,
  createVaultRoom,
  createInitialVaultMeta,
  storeVaultMasterKey,
  unlockVault,
} from "@vaultrix/core";
import type { MatrixClient, VaultModel } from "@vaultrix/core";
import type { VaultMeta } from "@vaultrix/core";

interface UnlockScreenProps {
  onUnlock: (model: VaultModel, K_vault: Uint8Array, client: MatrixClient, meta: VaultMeta) => void;
  onError: (msg: string) => void;
}

export function UnlockScreen({ onUnlock, onError }: UnlockScreenProps) {
  const [baseUrl, setBaseUrl] = useState("https://matrix.org");
  const [userId, setUserId] = useState("");
  const [password, setPassword] = useState("");
  const [recoveryKey, setRecoveryKey] = useState("");
  const [useRecoveryKey, setUseRecoveryKey] = useState<true | false | null>(null);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<"login" | "unlock">("login");

  const handleContinue = () => {
    onError("");
    setStep("unlock");
  };

  const handleUnlock = async () => {
    setLoading(true);
    onError("");
    try {
      const client = createMatrixClient({
        baseUrl,
        // If user chose recovery key, provide a secretStorageKeyProvider.
        // If they chose \"use another device\", let matrix-js-sdk obtain
        // SSSS keys via device verification / key backup.
        secretStorageKeyProvider:
          useRecoveryKey && recoveryKey.trim()
            ? async (keyId: string) => {
                const key = recoveryKey.trim();
                // NOTE: In a real app, decode the Matrix recovery key
                // format properly. This stub derives a 32-byte key as a placeholder.
                const bytes = new TextEncoder().encode(key);
                const buf = new Uint8Array(32);
                for (let i = 0; i < buf.length; i++) {
                  buf[i] = bytes[i % bytes.length];
                }
                return [keyId, buf];
              }
            : undefined,
      });
      await loginWithPassword(client, { baseUrl, userId, password });
      startSync(client);
      await waitForSync(client);
      const meta = await getVaultMeta(client);
      let vaultRoomId = meta?.vault_room_id;
      if (!vaultRoomId) {
        const { roomId } = await createVaultRoom(client);
        vaultRoomId = roomId;
        const K_vault = new Uint8Array(32);
        crypto.getRandomValues(K_vault);
        await storeVaultMasterKey(client, K_vault);
        await setVaultMeta(client, createInitialVaultMeta(roomId));
      }
      const result = await unlockVault(client);
      if (!result.success || !result.model) {
        onError(result.error ?? "Unlock failed");
        return;
      }
      onUnlock(result.model, result.K_vault, client, result.meta);
    } catch (e) {
      onError(e instanceof Error ? e.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  const cardStyle: React.CSSProperties = {
    padding: 12,
    marginBottom: 12,
    border: "1px solid #bbb",
    borderRadius: 8,
    cursor: useRecoveryKey === null ? "pointer" : "default",
    backgroundColor: useRecoveryKey === null ? undefined : "#eee",
    color: "#1a1a1a",
  };
  const primaryButtonStyle: React.CSSProperties = {
    marginTop: 12,
    padding: "8px 16px",
    fontWeight: 600,
  };

  return (
    <div>
      {step === "login" && (
        <>
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: "block", marginBottom: 4 }}>Homeserver</label>
            <input
              type="url"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="https://matrix.org"
            />
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: "block", marginBottom: 4 }}>User ID</label>
            <input
              type="text"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              placeholder="@user:matrix.org"
            />
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: "block", marginBottom: 4 }}>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <button
            type="button"
            onClick={handleContinue}
            disabled={!userId || !password}
            style={{ marginBottom: 12 }}
          >
            Continue
          </button>
        </>
      )}
      {step === "unlock" && (
        <>
          <p style={{ marginBottom: 12, color: "#333" }}>
            Logged in as <strong>{userId || "…"}</strong>. Choose how to unlock your vault:
          </p>

          {useRecoveryKey === null ? (
            <>
              <div
                role="button"
                tabIndex={0}
                style={cardStyle}
                onClick={() => setUseRecoveryKey(true)}
                onKeyDown={(e) => e.key === "Enter" && setUseRecoveryKey(true)}
              >
                <strong style={{ color: "#1a1a1a" }}>Recovery key</strong>
                <p style={{ margin: "4px 0 0", fontSize: 13, color: "#333" }}>
                  Paste the recovery key you saved when setting up Matrix secret storage.
                </p>
              </div>
              <div
                role="button"
                tabIndex={0}
                style={cardStyle}
                onClick={() => setUseRecoveryKey(false)}
                onKeyDown={(e) => e.key === "Enter" && setUseRecoveryKey(false)}
              >
                <strong style={{ color: "#1a1a1a" }}>Use another device</strong>
                <p style={{ margin: "4px 0 0", fontSize: 13, color: "#333" }}>
                  Verify this device in Element (or another client) and share secret storage, then unlock here.
                </p>
              </div>
            </>
          ) : useRecoveryKey === true ? (
            <div style={cardStyle}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <strong style={{ color: "#1a1a1a" }}>Recovery key</strong>
                <button
                  type="button"
                  style={{ fontSize: 12, color: "#333" }}
                  onClick={() => setUseRecoveryKey(null)}
                  disabled={loading}
                >
                  Change
                </button>
              </div>
              <label style={{ display: "block", marginBottom: 4, fontSize: 13, color: "#1a1a1a" }}>
                Paste your Matrix recovery key
              </label>
              <input
                type="password"
                value={recoveryKey}
                onChange={(e) => setRecoveryKey(e.target.value)}
                placeholder="Recovery key"
                style={{ width: "100%", boxSizing: "border-box" }}
                autoFocus
              />
              <button
                type="button"
                style={primaryButtonStyle}
                onClick={handleUnlock}
                disabled={loading || !recoveryKey.trim()}
              >
                {loading ? "Unlocking…" : "Unlock with recovery key"}
              </button>
            </div>
          ) : (
            <div style={cardStyle}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <strong style={{ color: "#1a1a1a" }}>Use another device</strong>
                <button
                  type="button"
                  style={{ fontSize: 12, color: "#333" }}
                  onClick={() => setUseRecoveryKey(null)}
                  disabled={loading}
                >
                  Change
                </button>
              </div>
              <p style={{ margin: "0 0 8px", fontSize: 13, color: "#333" }}>
                In Element (or another Matrix client), verify this device and share your secret storage keys. When that’s done, click below.
              </p>
              <button
                type="button"
                style={primaryButtonStyle}
                onClick={handleUnlock}
                disabled={loading}
              >
                {loading ? "Unlocking…" : "Unlock vault"}
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={() => setStep("login")}
            style={{ marginTop: 8 }}
            disabled={loading}
          >
            Back to login
          </button>
        </>
      )}
    </div>
  );
}

function waitForSync(client: MatrixClient, timeoutMs = 10000): Promise<void> {
  return new Promise((resolve) => {
    const t = setTimeout(() => resolve(), Math.min(timeoutMs, 3000));
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
