import { fixtureIndex } from "../data/fixture";
import { mountDetail } from "./detail";

const idx = fixtureIndex();

function setup(width = 1280) {
  Object.defineProperty(window, "innerWidth", { configurable: true, value: width });
  const root = document.createElement("div");
  document.body.replaceChildren(root);
  const download = vi.fn(async () => undefined);
  const writeText = vi.fn(async () => undefined);
  const api = mountDetail(root, idx, { download, clipboard: { writeText } });
  return { root, api, download, writeText };
}

const button = (root: HTMLElement, text: string) =>
  [...root.querySelectorAll("button")].find((b) => b.textContent?.includes(text))!;

afterEach(() => history.replaceState(null, "", "/"));

describe("mountDetail", () => {
  it("shows both faces at 12x on desktop and updates the URL", () => {
    const { root, api } = setup(1280);
    api.open(idx.byId.get(12)!);
    expect(root.querySelector("h2")?.textContent).toBe("#12");
    const faces = root.querySelectorAll<HTMLElement>(".face .cape");
    expect(faces).toHaveLength(2);
    expect(faces[0].style.width).toBe("120px");
    expect(faces[1].style.width).toBe("120px");
    expect(root.querySelector(".detail")?.classList.contains("panel")).toBe(true);
    expect(location.search).toBe("?cape=12");
  });

  it("uses a 6x bottom sheet on mobile", () => {
    const { root, api } = setup(375);
    api.open(idx.byId.get(12)!);
    expect(root.querySelector(".detail")?.classList.contains("sheet")).toBe(true);
    expect(root.querySelector<HTMLElement>(".face .cape")?.style.width).toBe("60px");
  });

  it("downloads the texture", async () => {
    const { root, api, download } = setup();
    api.open(idx.byId.get(12)!);
    button(root, "下載遊戲貼圖").click();
    expect(download).toHaveBeenCalledWith(idx.byId.get(12), idx);
  });

  it("reports a failed download", async () => {
    const { root, api, download } = setup();
    download.mockRejectedValueOnce(new Error("boom"));
    const logged = vi.spyOn(console, "error").mockImplementation(() => undefined);
    api.open(idx.byId.get(12)!);
    button(root, "下載遊戲貼圖").click();
    await vi.waitFor(() => expect(root.textContent).toContain("下載失敗"));
    expect(logged).toHaveBeenCalled();
    logged.mockRestore();
  });

  it("copies the share link", async () => {
    const { root, api, writeText } = setup();
    api.open(idx.byId.get(12)!);
    button(root, "複製分享連結").click();
    expect(writeText).toHaveBeenCalledWith(`${location.origin}/?cape=12`);
    await vi.waitFor(() => expect(root.textContent).toContain("已複製"));
  });

  it("closes on Escape, backdrop and close button, restoring the URL", () => {
    const { root, api } = setup();
    api.open(idx.byId.get(12)!);
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(root.querySelector(".detail")).toBeNull();
    expect(location.pathname + location.search).toBe("/");

    api.open(idx.byId.get(3)!);
    root.querySelector<HTMLElement>(".backdrop")!.click();
    expect(root.querySelector(".detail")).toBeNull();

    api.open(idx.byId.get(3)!);
    root.querySelector<HTMLButtonElement>("[data-action=close]")!.click();
    expect(root.querySelector(".detail")).toBeNull();
  });

  it.each([
    ["?cape=20", "#3"],
    ["?cape=7", "#7"],
  ])("opens %s from the URL", (search, heading) => {
    const { root, api } = setup();
    history.replaceState(null, "", `/${search}`);
    api.syncFromLocation();
    expect(root.querySelector("h2")?.textContent).toBe(heading);
  });

  it.each(["?cape=abc", "?cape=99999", ""])("ignores %j in the URL", (search) => {
    const { root, api } = setup();
    history.replaceState(null, "", `/${search}`);
    api.syncFromLocation();
    expect(root.querySelector(".detail")).toBeNull();
  });

  it("closes when browser history leaves the cape URL", () => {
    const { root, api } = setup();
    api.open(idx.byId.get(12)!);
    history.replaceState(null, "", "/");
    api.syncFromLocation();
    expect(root.querySelector(".detail")).toBeNull();
  });
});
