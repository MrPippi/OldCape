import { findById, parseIdInput, randomPick } from "../data/query";
import { COLOR_BUCKETS } from "../data/types";
import type { CapeEntry, CapeIndex } from "../data/types";
import { formatCount, h } from "./dom";
import { icon } from "./icons";

export interface FinderEvents {
  onFilter(mask: number): void;
  onOpen(entry: CapeEntry): void;
  onNotFound(raw: string): void;
}

export interface FinderApi {
  setCount(n: number): void;
}

export function mountFinder(root: HTMLElement, index: CapeIndex, events: FinderEvents): FinderApi {
  let mask = 0;

  const input = h("input", {
    type: "search",
    class: "inp",
    inputmode: "numeric",
    autocomplete: "off",
    placeholder: "# 輸入編號",
    "aria-label": "披風編號",
  });
  const form = h("form", { class: "id-form", role: "search" },
    input,
    h("button", { type: "submit", class: "b2 go" }, "找"));
  const message = h("div", { class: "msg", role: "status" });
  const count = h("div", { class: "cnt", "aria-live": "polite" });

  const swatches = COLOR_BUCKETS.map((bucket, bit) => {
    const button = h("button", {
      type: "button",
      "aria-label": bucket.label,
      "aria-pressed": "false",
      title: bucket.label,
      style: `--swatch:${bucket.swatch}`,
    });
    button.addEventListener("click", () => {
      mask ^= 1 << bit;
      button.setAttribute("aria-pressed", String((mask & (1 << bit)) !== 0));
      events.onFilter(mask);
    });
    return button;
  });

  const randomButton = (): HTMLButtonElement => {
    const button = h("button", { type: "button", class: "b2", "data-action": "random" }, icon("dice"), "隨機看一件");
    button.addEventListener("click", () => events.onOpen(randomPick(index)));
    return button;
  };

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const raw = input.value;
    const id = parseIdInput(raw);
    const entry = id === null ? null : findById(index, id);
    if (entry) {
      message.replaceChildren();
      events.onOpen(entry);
      return;
    }
    message.replaceChildren(h("span", {}, "沒有這個編號"), randomButton());
    events.onNotFound(raw);
  });

  root.replaceChildren(
    h("div", { class: "finder-in" },
      form,
      h("div", { class: "sw", role: "group", "aria-label": "依顏色篩選（可複選）" }, ...swatches),
      randomButton(),
      count),
    message,
  );

  return {
    setCount(n: number) {
      count.textContent = `符合 ${formatCount(n)} 件`;
    },
  };
}
