import { useState, useEffect, useCallback } from "react";
import { getEntry, generateTotp, totpCountdown } from "@vaultrix/core";
import type { VaultModel, VaultEntry } from "@vaultrix/core";

interface EntryDetailProps {
  model: VaultModel;
  entryId: string;
  onBack: () => void;
  onEdit: (entry: VaultEntry) => void;
  onSaveEntry: (entry: VaultEntry) => void;
  onDeleteEntry: (entry: VaultEntry) => void;
  onCopy: (label: string, value: string) => void;
}

function SecretRow({
  label,
  value,
  onCopy,
  onLargeType,
  onClear,
}: {
  label: string;
  value: string;
  onCopy: (l: string, v: string) => void;
  onLargeType?: () => void;
  onClear?: () => void;
}) {
  const [revealed, setRevealed] = useState(false);
  const display = value ? (revealed ? value : "••••••••••••") : "—";
  return (
    <div className="detail-row">
      <label>{label}</label>
      <div className="detail-row-value">
        <span className="detail-value" data-masked={!revealed}>
          {display}
        </span>
        <div className="detail-actions">
          {value && (
            <>
              <button type="button" onClick={() => onCopy(label, value)} title="Copy">
                Copy
              </button>
              <button type="button" onClick={() => setRevealed((r) => !r)} title={revealed ? "Hide" : "Show"}>
                {revealed ? "Hide" : "Show"}
              </button>
              {onLargeType && (
                <button type="button" onClick={onLargeType} title="Large type">
                  Large type
                </button>
              )}
              {onClear && (
                <button type="button" className="danger-outline" onClick={onClear} title="Clear this field">
                  Clear
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function LargeTypeOverlay({
  value,
  onClose,
}: {
  value: string;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div
      className="large-type-overlay"
      role="dialog"
      aria-label="Large type"
      onClick={onClose}
    >
      <div className="large-type-content" onClick={(e) => e.stopPropagation()}>
        <span className="large-type-text">{value}</span>
        <p className="large-type-hint">Click or press Escape to close</p>
      </div>
    </div>
  );
}

export function EntryDetail({
  model,
  entryId,
  onBack,
  onEdit,
  onSaveEntry,
  onDeleteEntry,
  onCopy,
}: EntryDetailProps) {
  const entry = getEntry(model, entryId);
  const [totpCode, setTotpCode] = useState<string | null>(null);
  const [totpSecs, setTotpSecs] = useState(0);
  const [largeTypeValue, setLargeTypeValue] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // TOTP tick
  useEffect(() => {
    if (!entry?.totp_secret) return;
    let cancelled = false;
    const tick = async () => {
      const code = await generateTotp(entry.totp_secret!);
      const secs = totpCountdown();
      if (!cancelled) {
        setTotpCode(code);
        setTotpSecs(secs);
      }
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [entry?.totp_secret]);

  const handleCopy = useCallback(
    (label: string, value: string) => {
      navigator.clipboard.writeText(value);
      onCopy(label, value);
    },
    [onCopy]
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (largeTypeValue) setLargeTypeValue(null);
        else if (confirmDelete) setConfirmDelete(false);
        else onBack();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onBack, largeTypeValue, confirmDelete]);

  if (!entry) {
    return (
      <div className="entry-detail">
        <p>Entry not found.</p>
        <button type="button" onClick={onBack}>Back</button>
      </div>
    );
  }

  const hasLoginFields = entry.type === "login" || entry.type === "api_credential";

  return (
    <div className="entry-detail">
      <header className="entry-detail-header">
        <button type="button" className="back" onClick={onBack} aria-label="Back to list">
          ← Back
        </button>
        <h2 className="entry-detail-title">{entry.title || "(Untitled)"}</h2>
        <div className="entry-detail-header-actions">
          <button type="button" onClick={() => onEdit(entry)}>
            Edit
          </button>
          {!confirmDelete ? (
            <button type="button" className="danger" onClick={() => setConfirmDelete(true)}>
              Delete entry
            </button>
          ) : (
            <>
              <span className="confirm-label">Delete this entry?</span>
              <button type="button" className="danger" onClick={() => onDeleteEntry(entry)}>
                Yes, delete
              </button>
              <button type="button" onClick={() => setConfirmDelete(false)}>Cancel</button>
            </>
          )}
        </div>
      </header>

      <div className="entry-detail-body">
        {hasLoginFields && (
          <>
            <SecretRow
              label="Username"
              value={entry.username ?? ""}
              onCopy={handleCopy}
              onLargeType={() => entry.username && setLargeTypeValue(entry.username)}
              onClear={
                entry.username
                  ? () => onSaveEntry({ ...entry, username: undefined, updated_at: Date.now() })
                  : undefined
              }
            />
            <SecretRow
              label="Password"
              value={entry.password ?? ""}
              onCopy={handleCopy}
              onLargeType={() => entry.password && setLargeTypeValue(entry.password)}
              onClear={
                entry.password
                  ? () => onSaveEntry({ ...entry, password: undefined, updated_at: Date.now() })
                  : undefined
              }
            />
          </>
        )}
        {entry.url && (
          <div className="detail-row">
            <label>URL</label>
            <div className="detail-row-value">
              <a href={entry.url} target="_blank" rel="noopener noreferrer" className="detail-link">
                {entry.url}
              </a>
              <div className="detail-actions">
                <button type="button" onClick={() => handleCopy("URL", entry.url!)}>Copy</button>
                <button type="button" className="danger-outline" onClick={() => onSaveEntry({ ...entry, url: undefined, updated_at: Date.now() })}>Clear</button>
              </div>
            </div>
          </div>
        )}
        {entry.totp_secret && (
          <div className="detail-row detail-row-otp">
            <label>One-time password</label>
            <div className="detail-row-value">
              <span className="otp-code">{totpCode ?? "…"}</span>
              <span className="otp-countdown">{totpSecs}s</span>
              <button type="button" onClick={() => totpCode && handleCopy("OTP", totpCode)}>
                Copy
              </button>
            </div>
          </div>
        )}
        {entry.notes && (
          <div className="detail-row">
            <label>Notes</label>
            <div className="detail-row-value">
              <pre className="detail-notes">{entry.notes}</pre>
              <div className="detail-actions">
                <button type="button" onClick={() => handleCopy("Notes", entry.notes!)}>Copy</button>
                <button type="button" className="danger-outline" onClick={() => onSaveEntry({ ...entry, notes: undefined, updated_at: Date.now() })}>Clear</button>
              </div>
            </div>
          </div>
        )}
        {entry.custom_fields && entry.custom_fields.length > 0 ? (
          <div className="detail-row">
            <label>Custom fields</label>
            <div className="detail-fields">
              {entry.custom_fields.map((f) => (
                <div key={f.id} className="detail-field">
                  <span className="detail-field-name">{f.name}</span>
                  <span className="detail-field-value">
                    {f.kind === "password" ? "••••••••" : f.value}
                  </span>
                  <button type="button" onClick={() => handleCopy(f.name, f.value)}>Copy</button>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      <p className="entry-detail-shortcuts">
        <kbd>Escape</kbd> back
      </p>

      {largeTypeValue && (
        <LargeTypeOverlay value={largeTypeValue} onClose={() => setLargeTypeValue(null)} />
      )}
    </div>
  );
}
