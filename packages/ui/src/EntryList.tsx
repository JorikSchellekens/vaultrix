import { useState, useMemo, useRef, useEffect } from "react";
import { listEntries } from "@vaultrix/core";
import type { VaultModel, VaultEntry } from "@vaultrix/core";

interface EntryListProps {
  model: VaultModel;
  selectedEntryId: string | null;
  onSelectEntry: (entry: VaultEntry) => void;
  onAddEntry: () => void;
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim();
}

function urlHost(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}

function entryMatchesQuery(entry: VaultEntry, query: string): boolean {
  if (!query.trim()) return true;
  const q = normalize(query);
  const fields = [
    entry.title,
    entry.username,
    entry.url,
    entry.notes,
    ...(entry.custom_fields?.map((f) => `${f.name} ${f.value}`) ?? []),
  ].filter(Boolean) as string[];
  return fields.some((f) => normalize(f).includes(q));
}

export function EntryList({
  model,
  selectedEntryId,
  onSelectEntry,
  onAddEntry,
}: EntryListProps) {
  const [query, setQuery] = useState("");
  const listRef = useRef<HTMLUListElement>(null);

  const entries = useMemo(() => listEntries(model), [model]);
  const filtered = useMemo(
    () => entries.filter((e) => entryMatchesQuery(e, query)),
    [entries, query]
  );
  const selectedIndex = useMemo(() => {
    if (!selectedEntryId) return -1;
    const i = filtered.findIndex((e) => e.id === selectedEntryId);
    return i >= 0 ? i : -1;
  }, [filtered, selectedEntryId]);

  // Keyboard: j/k or ArrowDown/Up to move, Enter to open, / to focus search, n for new
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        if (e.key === "Escape") {
          (e.target as HTMLInputElement).blur();
          return;
        }
        if (e.key !== "/") return;
      }
      if (e.key === "/") {
        e.preventDefault();
        const input = document.querySelector<HTMLInputElement>("[data-entry-search]");
        input?.focus();
        return;
      }
      if (e.key === "n" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        onAddEntry();
        return;
      }
      if (e.key === "j" || e.key === "ArrowDown") {
        e.preventDefault();
        const next = selectedIndex < filtered.length - 1 ? selectedIndex + 1 : selectedIndex;
        if (next >= 0 && filtered[next]) onSelectEntry(filtered[next]);
        return;
      }
      if (e.key === "k" || e.key === "ArrowUp") {
        e.preventDefault();
        const prev = selectedIndex > 0 ? selectedIndex - 1 : 0;
        if (prev >= 0 && filtered[prev]) onSelectEntry(filtered[prev]);
        return;
      }
      if (e.key === "Enter" && selectedIndex >= 0 && filtered[selectedIndex]) {
        e.preventDefault();
        onSelectEntry(filtered[selectedIndex]);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedIndex, filtered, onSelectEntry, onAddEntry]);

  // Scroll selected into view
  useEffect(() => {
    if (selectedIndex < 0 || !listRef.current) return;
    const el = listRef.current.querySelector(`[data-entry-id="${filtered[selectedIndex]?.id}"]`);
    el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [selectedIndex, filtered]);

  return (
    <div className="entry-list">
      <div className="entry-list-header">
        <input
          type="search"
          placeholder="Search entries (/)"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="entry-list-search"
          data-entry-search
          aria-label="Search entries"
        />
        <button type="button" className="entry-list-add" onClick={onAddEntry}>
          + Add entry
        </button>
      </div>
      {filtered.length === 0 ? (
        <div className="entry-list-empty">
          {entries.length === 0 ? (
            <>
              <p>No entries yet.</p>
              <button type="button" className="primary" onClick={onAddEntry}>
                Add your first entry
              </button>
            </>
          ) : (
            <p>No entries match &quot;{query}&quot;</p>
          )}
        </div>
      ) : (
        <ul ref={listRef} className="entry-list-items" role="listbox" aria-label="Entries">
          {filtered.map((entry) => (
            <li
              key={entry.id}
              data-entry-id={entry.id}
              role="option"
              aria-selected={entry.id === selectedEntryId}
              className={`entry-list-item ${entry.id === selectedEntryId ? "selected" : ""}`}
              onClick={() => onSelectEntry(entry)}
            >
              <span className="entry-list-item-title">{entry.title || "(Untitled)"}</span>
              <span className="entry-list-item-meta">
                {entry.type}
                {entry.type === "login" && entry.username && ` · ${entry.username}`}
                {entry.url && urlHost(entry.url) ? ` · ${urlHost(entry.url)}` : ""}
              </span>
            </li>
          ))}
        </ul>
      )}
      <p className="entry-list-shortcuts">
        <kbd>/</kbd> search · <kbd>j</kbd>/<kbd>k</kbd> move · <kbd>Enter</kbd> open · <kbd>n</kbd> new
      </p>
    </div>
  );
}
