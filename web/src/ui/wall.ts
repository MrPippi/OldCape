import { randomPick } from "../data/query";
import type { CapeEntry, CapeIndex } from "../data/types";
import { applySprite } from "../render/sprite";
import { h } from "./dom";
import { wallScale } from "./scale";

export const PAGE_SIZE = 64;
/** Start loading the next page this far before the sentinel scrolls into view. */
const PRELOAD_MARGIN = "800px";

export interface WallApi {
  setResults(entries: readonly CapeEntry[]): void;
}

export function mountWall(root: HTMLElement, index: CapeIndex, onOpen: (e: CapeEntry) => void): WallApi {
  const grid = h("div", { class: "wall" });
  let results: readonly CapeEntry[] = [];
  let rendered = 0;
  let scale = wallScale(window.innerWidth);
  let observer: IntersectionObserver | null = null;

  const card = (entry: CapeEntry): HTMLButtonElement => {
    const cape = h("span", { class: "cape", "aria-hidden": "true" });
    applySprite(cape, entry, index, "front", scale);
    const button = h("button", { type: "button", class: "card", "data-id": entry.id, "aria-label": `披風 #${entry.id}` },
      cape,
      h("small", { class: "num pixel" }, `#${entry.id}`));
    button.addEventListener("click", () => onOpen(entry));
    return button;
  };

  const sentinel = h("div", { class: "sentinel", "aria-hidden": "true" });

  const renderNextPage = (): void => {
    const page = results.slice(rendered, rendered + PAGE_SIZE);
    grid.append(...page.map(card));
    rendered += page.length;
    if (rendered >= results.length) {
      observer?.disconnect();
      observer = null;
      sentinel.remove();
    } else if (observer) {
      // Re-observe so a sentinel that is still on screen fires again.
      observer.unobserve(sentinel);
      observer.observe(sentinel);
    }
  };

  const emptyState = (): HTMLElement => {
    const button = h("button", { type: "button", class: "b2" }, "🎲 隨機看一件");
    button.addEventListener("click", () => onOpen(randomPick(index)));
    return h("div", { class: "empty" }, h("p", {}, "沒有符合的披風，試試少選一種顏色。"), button);
  };

  window.addEventListener("resize", () => {
    const next = wallScale(window.innerWidth);
    if (next === scale) return;
    scale = next;
    for (const el of grid.querySelectorAll<HTMLElement>(".card")) {
      const entry = index.byId.get(Number(el.dataset.id));
      const cape = el.querySelector<HTMLElement>(".cape");
      if (entry && cape) applySprite(cape, entry, index, "front", scale);
    }
  });

  return {
    setResults(entries) {
      observer?.disconnect();
      observer = null;
      results = entries;
      rendered = 0;
      grid.replaceChildren();
      if (entries.length === 0) {
        root.replaceChildren(emptyState());
        return;
      }
      root.replaceChildren(grid, sentinel);
      renderNextPage();
      if (rendered < results.length) {
        observer = new IntersectionObserver(
          (records) => {
            if (records.some((r) => r.isIntersecting)) renderNextPage();
          },
          { rootMargin: PRELOAD_MARGIN },
        );
        observer.observe(sentinel);
      }
    },
  };
}
