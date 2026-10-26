import { randomPick } from "../data/query";
import type { CapeEntry, CapeIndex } from "../data/types";
import { applySprite } from "../render/sprite";
import { h } from "./dom";
import { wallScale } from "./scale";

export const PAGE_SIZE = 64;
/** Entrance delay steps per page: later cards share the last step so a page never trickles in. */
export const STAGGER_CAP = 24;
/** Touch: holding a card this long flips it to the back instead of opening it. */
export const HOLD_TO_FLIP_MS = 250;
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

  const paint = (button: HTMLElement, entry: CapeEntry): void => {
    for (const face of button.querySelectorAll<HTMLElement>(".cape")) {
      applySprite(face, entry, index, face.classList.contains("back") ? "back" : "front", scale);
    }
  };

  const card = (entry: CapeEntry, order: number): HTMLButtonElement => {
    const button = h("button", { type: "button", class: "card", "data-id": entry.id, "aria-label": `披風 #${entry.id}` },
      h("span", { class: "flip", "aria-hidden": "true" }, h("span", { class: "cape" }), h("span", { class: "cape back" })),
      h("small", { class: "num pixel" }, `#${entry.id}`));
    button.style.setProperty("--i", String(Math.min(order, STAGGER_CAP)));
    paint(button, entry);
    const swallowClick = holdToFlip(button);
    button.addEventListener("click", () => {
      if (!swallowClick()) onOpen(entry);
    });
    return button;
  };

  const sentinel = h("div", { class: "sentinel", "aria-hidden": "true" });

  const renderNextPage = (): void => {
    const page = results.slice(rendered, rendered + PAGE_SIZE);
    grid.append(...page.map((entry, i) => card(entry, i)));
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
      if (entry) paint(el, entry);
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

/**
 * Touch press-and-hold shows the card's back while held. Returns a check the click
 * handler calls: true means the click ended a hold and must not open the cape.
 */
function holdToFlip(button: HTMLElement): () => boolean {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let held = false;
  button.addEventListener("pointerdown", (event) => {
    if (event.pointerType === "mouse") return;
    held = false;
    timer = setTimeout(() => {
      held = true;
      button.classList.add("is-flipped");
    }, HOLD_TO_FLIP_MS);
  });
  const release = (): void => {
    clearTimeout(timer);
    button.classList.remove("is-flipped");
  };
  for (const type of ["pointerup", "pointercancel", "pointerleave"]) button.addEventListener(type, release);
  button.addEventListener("contextmenu", (event) => {
    if (held || timer !== undefined) event.preventDefault();
  });
  return () => {
    const swallow = held;
    held = false;
    return swallow;
  };
}
