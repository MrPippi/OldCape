import { showLoadError } from "./status";

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
