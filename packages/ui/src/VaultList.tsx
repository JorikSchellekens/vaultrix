import type { VaultModel } from "@vaultrix/core";
import { listEntries } from "@vaultrix/core";

interface VaultListProps {
  model: VaultModel;
}

export function VaultList({ model }: VaultListProps) {
  const entries = listEntries(model);

  return (
    <div>
      <h2 style={{ marginBottom: 12, fontSize: 16 }}>Entries</h2>
      {entries.length === 0 ? (
        <p style={{ color: "#888" }}>No entries yet. Add one below.</p>
      ) : (
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {entries.map((entry) => (
            <li
              key={entry.id}
              style={{
                padding: 12,
                marginBottom: 8,
                background: "#252525",
                borderRadius: 8,
                border: "1px solid #333",
              }}
            >
              <strong>{entry.title || "(Untitled)"}</strong>
              <span style={{ marginLeft: 8, color: "#888", fontSize: 12 }}>
                {entry.type}
              </span>
              {entry.type === "login" && entry.username && (
                <div style={{ fontSize: 12, color: "#aaa", marginTop: 4 }}>
                  {entry.username}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
