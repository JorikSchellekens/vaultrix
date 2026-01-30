/**
 * Content script: inject on pages, send getSuggestionsForUrl / getEntryForFill to background.
 * Renders a minimal picker when user focuses a login field or uses a shortcut.
 */
const SCRIPT_TAG = "vaultrix-content-script";

function getBackground(): typeof chrome.runtime {
  return chrome?.runtime;
}

function init() {
  const runtime = getBackground();
  if (!runtime?.sendMessage) return;

  const port = runtime.connect({ name: "vaultrix-content" });

  function onFocus(e: FocusEvent) {
    const target = e.target as HTMLInputElement;
    if (!target || target.type !== "text" && target.type !== "password") return;
    const form = target.form;
    if (!form) return;
    const url = window.location.href;
    runtime.sendMessage({ type: "getSuggestionsForUrl", payload: { url } }, (response: unknown) => {
      if (response && Array.isArray((response as { entries?: unknown[] }).entries)) {
        showPicker((response as { entries: { id: string; title: string }[] }).entries, target);
      }
    });
  }

  document.addEventListener("focusin", onFocus, true);
}

function showPicker(
  entries: { id: string; title: string }[],
  target: HTMLInputElement
) {
  if (entries.length === 0) return;
  let el = document.getElementById(SCRIPT_TAG);
  if (el) el.remove();
  el = document.createElement("div");
  el.id = SCRIPT_TAG;
  el.style.cssText = `
    position: fixed; z-index: 2147483647;
    background: #252525; color: #e0e0e0; border: 1px solid #444;
    border-radius: 8px; padding: 8px; max-height: 200px; overflow-y: auto;
    font-family: system-ui; font-size: 14px; box-shadow: 0 4px 12px rgba(0,0,0,0.3);
  `;
  const rect = target.getBoundingClientRect();
  el.style.top = `${rect.bottom + 4}px`;
  el.style.left = `${rect.left}px`;
  el.style.minWidth = `${Math.max(rect.width, 200)}px`;

  for (const entry of entries) {
    const item = document.createElement("div");
    item.textContent = entry.title || "(Untitled)";
    item.style.cssText = "padding: 8px; cursor: pointer; border-radius: 4px;";
    item.addEventListener("mouseenter", () => { item.style.background = "#333"; });
    item.addEventListener("mouseleave", () => { item.style.background = ""; });
    item.addEventListener("click", () => {
      getBackground().sendMessage(
        { type: "getEntryForFill", payload: { entryId: entry.id } },
        (resp: unknown) => {
          const r = resp as { username?: string; password?: string };
          if (r?.username || r?.password) {
            const form = target.form;
            if (form) {
              const inputs = form.querySelectorAll<HTMLInputElement>("input[type=text], input[type=email], input[type=password]");
              if (r.username && inputs[0]) inputs[0].value = r.username;
              if (r.password && inputs[1]) inputs[1].value = r.password;
            }
          }
          el?.remove();
        }
      );
    });
    el.appendChild(item);
  }
  document.body.appendChild(el);
  const close = () => { el?.remove(); };
  setTimeout(() => document.addEventListener("click", close, { once: true }), 0);
}

init();
