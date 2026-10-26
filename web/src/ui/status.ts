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

export function showLoading(root: HTMLElement): void {
  root.replaceChildren(h("div", { class: "status", "aria-busy": "true" }, h("p", {}, "載入披風中…")));
}
