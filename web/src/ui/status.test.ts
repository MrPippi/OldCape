import { SKELETON_CARDS, showLoadError, showLoading } from "./status";

describe("showLoadError", () => {
  it("shows a message and a retry button that fires once per click", () => {
    const root = document.createElement("div");
    root.innerHTML = "<p>old content</p>";
    const retry = vi.fn();
    showLoadError(root, retry);
    expect(root.textContent).toContain("載入失敗");
    expect(root.textContent).not.toContain("old content");
    const button = root.querySelector("button");
    expect(button?.textContent).toBe("重試");
    button?.click();
    expect(retry).toHaveBeenCalledTimes(1);
  });
});

describe("showLoading", () => {
  it("lays out placeholder cards in the real wall grid, announced as loading", () => {
    const root = document.createElement("div");
    showLoading(root);
    const wall = root.querySelector<HTMLElement>(".wall.skeleton")!;
    expect(wall.getAttribute("aria-busy")).toBe("true");
    expect(wall.querySelectorAll(".card-ph")).toHaveLength(SKELETON_CARDS);
    expect(wall.querySelectorAll(".card-ph .ph-cape")).toHaveLength(SKELETON_CARDS);
    expect(wall.querySelector(".card")).toBeNull(); // placeholders are never mistaken for cards
    expect(root.querySelector(".visually-hidden")?.textContent).toBe("載入披風中…");
  });
});
