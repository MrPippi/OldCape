import type { CapeIndex } from "../data/types";
import { h } from "./dom";
import { icon } from "./icons";

/** The online badge waits until the page has settled, so it never competes with the capes. */
export const ONLINE_CHECK_DELAY_MS = 2000;
const HASHES = ["#chat", "#guestbook"]; // #guestbook: links from before the chat replaced it

export interface PanelHandle {
  start(): void;
  setIndex(index: CapeIndex): void;
  focus(): void;
}

export interface LauncherDeps {
  /** Builds the chat panel (its code loads on demand) inside `root`. */
  createPanel: (root: HTMLElement, hooks: { onClose: () => void; onOnline: (count: number) => void }) => Promise<PanelHandle>;
  fetchOnline: () => Promise<number>;
}

export interface ChatLauncher {
  open(): void;
  close(): void;
  setIndex(index: CapeIndex): void;
}

/** Floating chat button (bottom right) with an online badge; opens the chat panel. */
export function mountChatLauncher(doc: Document, deps: LauncherDeps): ChatLauncher {
  const badge = h("span", { class: "chat-badge", hidden: true });
  const fab = h("button", { type: "button", class: "chat-fab", "aria-label": "打開聊天室", "aria-expanded": "false", "aria-controls": "chat" },
    icon("comments"), badge);
  const section = h("section", { class: "chat", id: "chat", role: "dialog", "aria-labelledby": "chat-title", hidden: true });
  doc.body.append(section, fab);

  let panel: Promise<PanelHandle> | null = null;
  let index: CapeIndex | null = null;

  const setBadge = (count: number): void => {
    badge.hidden = count <= 0;
    badge.textContent = count > 99 ? "99+" : String(count);
    fab.setAttribute("aria-label", count > 0 ? `打開聊天室（${count} 人在線）` : "打開聊天室");
  };

  const close = (): void => {
    if (section.hidden) return;
    section.hidden = true;
    fab.setAttribute("aria-expanded", "false");
    doc.body.classList.remove("chat-open");
    if (HASHES.includes(location.hash)) history.replaceState(history.state, "", location.pathname + location.search);
    fab.focus();
  };

  const open = (): void => {
    section.hidden = false;
    fab.setAttribute("aria-expanded", "true");
    doc.body.classList.add("chat-open");
    if (!panel) {
      panel = deps.createPanel(section, { onClose: close, onOnline: setBadge }).then((p) => {
        if (index) p.setIndex(index);
        p.start();
        return p;
      });
      panel.catch((error: unknown) => {
        console.error("OldCape: chat failed to load", error);
        section.replaceChildren(h("p", { class: "chat-failed" }, "聊天室載入失敗，請重新整理頁面。"));
        panel = null;
      });
    }
    void panel.then((p) => p.focus()).catch(() => undefined);
  };

  fab.addEventListener("click", () => (section.hidden ? open() : close()));
  doc.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !section.hidden && !doc.querySelector("dialog[open]")) close();
  });
  const openFromHash = (): void => {
    if (HASHES.includes(location.hash)) open();
  };
  doc.defaultView?.addEventListener("hashchange", openFromHash);
  openFromHash();

  setTimeout(() => {
    deps.fetchOnline().then(setBadge).catch(() => undefined);
  }, ONLINE_CHECK_DELAY_MS);

  return {
    open,
    close,
    setIndex(next) {
      index = next;
      void panel?.then((p) => p.setIndex(next)).catch(() => undefined);
    },
  };
}
