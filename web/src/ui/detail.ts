import { findById } from "../data/query";
import type { CapeEntry, CapeIndex } from "../data/types";
import { downloadCape } from "../render/download";
import { applySprite } from "../render/sprite";
import type { Face } from "../render/sprite";
import { capeHref, pushCape, readCapeParam } from "../router";
import { h } from "./dom";
import { detailScale, isDesktop } from "./scale";

export interface DetailDeps {
  download: (entry: CapeEntry, index: CapeIndex) => Promise<void>;
  clipboard: Pick<Clipboard, "writeText">;
}

export interface DetailApi {
  open(entry: CapeEntry): void;
  close(): void;
  /** Match the view to the current URL (initial load, back/forward). Never pushes history. */
  syncFromLocation(): void;
}

const COPIED_RESET_MS = 2000;

export function mountDetail(
  root: HTMLElement,
  index: CapeIndex,
  deps: DetailDeps = { download: downloadCape, clipboard: navigator.clipboard },
): DetailApi {
  let current: CapeEntry | null = null;
  let returnFocus: HTMLElement | null = null;

  const face = (entry: CapeEntry, which: Face, label: string, scale: number): HTMLElement => {
    const cape = h("span", { class: "cape", role: "img", "aria-label": `${label} #${entry.id}` });
    applySprite(cape, entry, index, which, scale);
    return h("figure", { class: "face" }, cape, h("figcaption", {}, label));
  };

  const render = (entry: CapeEntry): void => {
    const width = window.innerWidth;
    const scale = detailScale(width);
    const status = h("p", { class: "detail-status", role: "status" });

    const dl = h("button", { type: "button", class: "b1" }, "⬇ 下載遊戲貼圖");
    dl.addEventListener("click", () => {
      status.textContent = "";
      deps.download(entry, index).catch((error: unknown) => {
        console.error("OldCape: download failed", error);
        status.textContent = "下載失敗，請再試一次。";
      });
    });

    const share = h("button", { type: "button", class: "b2" }, "🔗 複製分享連結");
    share.addEventListener("click", () => {
      deps.clipboard
        .writeText(`${location.origin}${capeHref(entry.id)}`)
        .then(() => {
          share.textContent = "✓ 已複製";
          setTimeout(() => (share.textContent = "🔗 複製分享連結"), COPIED_RESET_MS);
        })
        .catch(() => (status.textContent = `複製失敗，連結是 ${location.origin}${capeHref(entry.id)}`));
    });

    const how = h("a", { class: "how-link", href: "#how" }, "怎麼穿上？");
    how.addEventListener("click", () => close());

    const closeBtn = h("button", { type: "button", class: "x", "data-action": "close", "aria-label": "關閉" }, "✕");
    closeBtn.addEventListener("click", () => close());

    const backdrop = h("div", { class: "backdrop" });
    backdrop.addEventListener("click", () => close());

    const panel = h("div", {
      class: `detail ${isDesktop(width) ? "panel" : "sheet"}`,
      role: "dialog",
      "aria-modal": "true",
      "aria-labelledby": "detail-title",
    },
      closeBtn,
      h("div", { class: "faces" }, face(entry, "front", "外側", scale), face(entry, "back", "內側", scale)),
      h("div", { class: "detail-body" },
        h("h2", { id: "detail-title", class: "pixel" }, `#${entry.id}`),
        h("p", { class: "meta" }, "台灣麥塊玩家作品 · 遊戲貼圖 64×32 PNG"),
        h("div", { class: "btns" }, dl, share),
        status,
        how));

    root.replaceChildren(backdrop, panel);
    document.body.classList.add("detail-open");
    closeBtn.focus();
  };

  const hide = (): void => {
    current = null;
    root.replaceChildren();
    document.body.classList.remove("detail-open");
    returnFocus?.focus();
    returnFocus = null;
  };

  const show = (entry: CapeEntry): void => {
    if (!current && document.activeElement instanceof HTMLElement) returnFocus = document.activeElement;
    current = entry;
    render(entry);
  };

  function close(): void {
    if (!current) return;
    hide();
    pushCape(null);
  }

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") close();
  });

  return {
    open(entry) {
      show(entry);
      pushCape(entry.id);
    },
    close,
    syncFromLocation() {
      const id = readCapeParam(location.search);
      const entry = id === null ? null : findById(index, id);
      if (entry) show(entry);
      else if (current) hide();
    },
  };
}
