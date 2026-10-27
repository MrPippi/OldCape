import { h } from "./dom";

export function showLoadError(root: HTMLElement, retry: () => void): void {
  const button = h("button", { type: "button", class: "b1" }, "重試");
  button.addEventListener("click", () => retry());
  root.replaceChildren(
    h("div", { class: "status", role: "alert" },
      h("p", {}, "載入失敗，請檢查網路連線後再試一次。"),
      button),
  );
}

/** Fills the first screen; 36 divides into full rows of 9 (desktop) and 4 (phones). */
export const SKELETON_CARDS = 36;

/** Placeholder cards in the real wall grid, so the page keeps its shape while the index loads. */
export function showLoading(root: HTMLElement): void {
  root.replaceChildren(
    h("p", { class: "visually-hidden", role: "status" }, "載入披風中…"),
    h("div", { class: "wall skeleton", "aria-busy": "true" },
      ...Array.from({ length: SKELETON_CARDS }, () =>
        h("div", { class: "card-ph", "aria-hidden": "true" }, h("span", { class: "ph-cape" }), h("span", { class: "ph-num" })))),
  );
}
