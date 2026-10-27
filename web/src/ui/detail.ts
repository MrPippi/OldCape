import { findById } from "../data/query";
import { removalRequestUrl } from "../data/removal";
import type { CapeEntry, CapeIndex } from "../data/types";
import { downloadCape } from "../render/download";
import { capeHref, pushCape, readCapeParam } from "../router";
import { h } from "./dom";
import { icon } from "./icons";
import { detailScale, isDesktop } from "./scale";
import { mountSlab } from "./slab";

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

function centreOnWholePixels(panel: HTMLElement): void {
  const { width, height } = panel.getBoundingClientRect();
  panel.style.left = `${Math.max(0, Math.round((window.innerWidth - width) / 2))}px`;
  panel.style.top = `${Math.max(0, Math.round((window.innerHeight - height) / 2))}px`;
}

/** Page regions hidden from focus and assistive tech while the dialog is open. */
function setBackgroundInert(inert: boolean): void {
  for (const el of [document.querySelector<HTMLElement>("header.nav"), document.getElementById("app")]) {
    if (el) el.inert = inert;
  }
}

export function mountDetail(
  root: HTMLElement,
  index: CapeIndex,
  deps: DetailDeps = { download: downloadCape, clipboard: navigator.clipboard },
): DetailApi {
  let current: CapeEntry | null = null;
  let returnFocus: HTMLElement | null = null;

  const render = (entry: CapeEntry): void => {
    const width = window.innerWidth;
    const scale = detailScale(width);
    const status = h("p", { class: "detail-status", role: "status" });

    const dl = h("button", { type: "button", class: "b1" }, icon("download"), "下載遊戲貼圖");
    dl.addEventListener("click", () => {
      status.textContent = "";
      deps.download(entry, index).catch((error: unknown) => {
        console.error("OldCape: download failed", error);
        status.textContent = "下載失敗，請再試一次。";
      });
    });

    const share = h("button", { type: "button", class: "b2" }, icon("link"), "複製分享連結");
    share.addEventListener("click", () => {
      deps.clipboard
        .writeText(`${location.origin}${capeHref(entry.id)}`)
        .then(() => {
          share.replaceChildren(icon("check"), "已複製");
          setTimeout(() => share.replaceChildren(icon("link"), "複製分享連結"), COPIED_RESET_MS);
        })
        .catch(() => (status.textContent = `複製失敗，連結是 ${location.origin}${capeHref(entry.id)}`));
    });

    const how = h("a", { class: "how-link", href: "#how" }, "怎麼穿上？");
    how.addEventListener("click", () => close());
    const removal = h("a", { class: "removal-link", href: removalRequestUrl(entry.id), target: "_blank", rel: "noopener" }, "申請移除這件披風");

    const closeBtn = h("button", { type: "button", class: "x", "data-action": "close", "aria-label": "關閉" }, icon("xmark"));
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
      mountSlab(entry, index, scale).el,
      h("div", { class: "detail-body" },
        h("h2", { id: "detail-title", class: "pixel" }, `#${entry.id}`),
        h("p", { class: "meta" }, "台灣麥塊玩家作品 · 遊戲貼圖 64×32 PNG"),
        h("div", { class: "btns" }, dl, share),
        status,
        h("p", { class: "detail-links" }, how, removal)));

    root.replaceChildren(backdrop, panel);
    document.body.classList.add("detail-open");
    setBackgroundInert(true);
    if (isDesktop(width)) centreOnWholePixels(panel);
    closeBtn.focus();
  };

  const hide = (): void => {
    current = null;
    root.replaceChildren();
    document.body.classList.remove("detail-open");
    setBackgroundInert(false);
    returnFocus?.focus();
    returnFocus = null;
  };

  const show = (entry: CapeEntry): void => {
    if (!current && document.activeElement instanceof HTMLElement) returnFocus = document.activeElement;
    current = entry;
    render(entry);
  };

  /**
   * If we pushed this cape's history entry, step back over it so the Back button
   * never reopens a closed cape; a deep-linked landing just drops the param.
   */
  function close(): void {
    if (!current) return;
    const pushedByUs = (history.state as { cape?: number } | null)?.cape === current.id;
    hide();
    if (pushedByUs) history.back();
    else if (readCapeParam(location.search) !== null) history.replaceState(null, "", location.pathname);
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
