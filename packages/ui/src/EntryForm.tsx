import { useState, useEffect } from "react";
import type { VaultEntry, EntryType } from "@vaultrix/core";

interface EntryFormProps {
  entry: VaultEntry | null;
  onSave: (entry: VaultEntry) => void;
  onCancel: () => void;
}

const ENTRY_TYPES: { value: EntryType; label: string }[] = [
  { value: "login", label: "Login" },
  { value: "secure_note", label: "Secure note" },
  { value: "api_credential", label: "API credential" },
  { value: "credit_card", label: "Credit card" },
  { value: "identity", label: "Identity" },
  { value: "custom", label: "Custom" },
];

function defaultEntry(id: string): VaultEntry {
  const now = Date.now();
  return {
    id,
    type: "login",
    title: "",
    custom_fields: [],
    created_at: now,
    updated_at: now,
  };
}

export function EntryForm({ entry, onSave, onCancel }: EntryFormProps) {
  const isNew = !entry;
  const [title, setTitle] = useState(entry?.title ?? "");
  const [type, setType] = useState<EntryType>(entry?.type ?? "login");
  const [username, setUsername] = useState(entry?.username ?? "");
  const [password, setPassword] = useState(entry?.password ?? "");
  const [url, setUrl] = useState(entry?.url ?? "");
  const [notes, setNotes] = useState(entry?.notes ?? "");
  const [totpSecret, setTotpSecret] = useState(entry?.totp_secret ?? "");
  const [totpIssuer, setTotpIssuer] = useState(entry?.totp_issuer ?? "");
  const [totpAccount, setTotpAccount] = useState(entry?.totp_account ?? "");

  useEffect(() => {
    if (entry) {
      setTitle(entry.title ?? "");
      setType(entry.type);
      setUsername(entry.username ?? "");
      setPassword(entry.password ?? "");
      setUrl(entry.url ?? "");
      setNotes(entry.notes ?? "");
      setTotpSecret(entry.totp_secret ?? "");
      setTotpIssuer(entry.totp_issuer ?? "");
      setTotpAccount(entry.totp_account ?? "");
    }
  }, [entry]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const now = Date.now();
    const base = entry ?? defaultEntry(crypto.randomUUID());
    const updated: VaultEntry = {
      ...base,
      type,
      title: title.trim() || "(Untitled)",
      username: username.trim() || undefined,
      password: password || undefined,
      url: url.trim() || undefined,
      notes: notes.trim() || undefined,
      totp_secret: totpSecret.trim() || undefined,
      totp_issuer: totpIssuer.trim() || undefined,
      totp_account: totpAccount.trim() || undefined,
      created_at: base.created_at ?? now,
      updated_at: now,
    };
    onSave(updated);
  };

  const showLoginFields = type === "login" || type === "api_credential";

  return (
    <form className="entry-form" onSubmit={handleSubmit}>
      <header className="entry-form-header">
        <h2>{isNew ? "New entry" : "Edit entry"}</h2>
        <div className="entry-form-actions">
          <button type="button" onClick={onCancel}>Cancel</button>
          <button type="submit" className="primary">Save</button>
        </div>
      </header>

      <div className="entry-form-body">
        <div className="form-group">
          <label htmlFor="entry-title">Title</label>
          <input
            id="entry-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. GitHub"
            autoFocus
          />
        </div>
        <div className="form-group">
          <label htmlFor="entry-type">Type</label>
          <select
            id="entry-type"
            value={type}
            onChange={(e) => setType(e.target.value as EntryType)}
          >
            {ENTRY_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>

        {showLoginFields && (
          <>
            <div className="form-group">
              <label htmlFor="entry-username">Username</label>
              <input
                id="entry-username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Username or email"
                autoComplete="username"
              />
            </div>
            <div className="form-group">
              <label htmlFor="entry-password">Password</label>
              <input
                id="entry-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                autoComplete="current-password"
              />
            </div>
            <div className="form-group">
              <label htmlFor="entry-url">URL</label>
              <input
                id="entry-url"
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://..."
              />
            </div>
            <div className="form-group">
              <label>One-time password (TOTP)</label>
              <div className="form-row">
                <input
                  type="text"
                  value={totpSecret}
                  onChange={(e) => setTotpSecret(e.target.value)}
                  placeholder="Secret (base32)"
                />
                <input
                  type="text"
                  value={totpIssuer}
                  onChange={(e) => setTotpIssuer(e.target.value)}
                  placeholder="Issuer (e.g. GitHub)"
                />
                <input
                  type="text"
                  value={totpAccount}
                  onChange={(e) => setTotpAccount(e.target.value)}
                  placeholder="Account name"
                />
              </div>
            </div>
          </>
        )}

        <div className="form-group">
          <label htmlFor="entry-notes">Notes</label>
          <textarea
            id="entry-notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Private notes"
            rows={3}
          />
        </div>
      </div>
    </form>
  );
}
