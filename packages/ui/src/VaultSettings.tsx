import { useState } from "react";
import type { MatrixClient } from "matrix-js-sdk";
import type { VaultMeta } from "@vaultrix/core";

interface VaultSettingsProps {
  client: MatrixClient;
  meta: VaultMeta;
  onBack: () => void;
}

export function VaultSettings({ client, meta, onBack }: VaultSettingsProps) {
  const [inviteId, setInviteId] = useState("");
  const [inviteStatus, setInviteStatus] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const roomId = meta.vault_room_id;
  const room = roomId ? client.getRoom(roomId) : null;
  const roomName = room?.name ?? "Vault";

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    const id = inviteId.trim();
    if (!id || !roomId) return;
    setInviteStatus("loading");
    setErrorMessage("");
    try {
      await client.invite(roomId, id);
      setInviteStatus("ok");
      setInviteId("");
    } catch (err) {
      setInviteStatus("error");
      setErrorMessage(err instanceof Error ? err.message : "Invite failed");
    }
  };

  return (
    <div className="vault-settings">
      <header className="vault-settings-header">
        <button type="button" className="back" onClick={onBack}>← Back</button>
        <h2>Vault settings</h2>
      </header>

      <div className="vault-settings-body">
        <section className="vault-settings-section">
          <h3>Vault info</h3>
          <dl className="vault-settings-dl">
            <dt>Name</dt>
            <dd>{roomName}</dd>
            <dt>Room ID</dt>
            <dd>
              <code className="vault-room-id">{roomId || "—"}</code>
            </dd>
            <dt>Epoch</dt>
            <dd>{meta.vault_epoch}</dd>
          </dl>
        </section>

        <section className="vault-settings-section">
          <h3>Invite someone</h3>
          <p className="vault-settings-hint">
            Invite a Matrix user to this vault. They will need to accept and will then have access to vault contents (according to room permissions).
          </p>
          <form onSubmit={handleInvite} className="vault-invite-form">
            <input
              type="text"
              value={inviteId}
              onChange={(e) => setInviteId(e.target.value)}
              placeholder="@user:matrix.org"
              aria-label="User ID to invite"
            />
            <button type="submit" disabled={inviteStatus === "loading" || !inviteId.trim()}>
              {inviteStatus === "loading" ? "Inviting…" : "Invite"}
            </button>
          </form>
          {inviteStatus === "ok" && <p className="status ok">Invitation sent.</p>}
          {inviteStatus === "error" && <p className="status error">{errorMessage}</p>}
        </section>
      </div>
    </div>
  );
}
