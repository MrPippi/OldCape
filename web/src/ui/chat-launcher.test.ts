import { fixtureIndex } from "../data/fixture";
import { ONLINE_CHECK_DELAY_MS, mountChatLauncher } from "./chat-launcher";
import type { LauncherDeps } from "./chat-launcher";

const flush = async () => {
  for (let i = 0; i < 5; i++) await Promise.resolve();
};

function setup(over: Partial<LauncherDeps> = {}) {
  const panel = { start: vi.fn(), setIndex: vi.fn(), focus: vi.fn() };
  let hooks: Parameters<LauncherDeps["createPanel"]>[1] | null = null;
  const deps: LauncherDeps = {
    createPanel: vi.fn(async (_root, h) => {
      hooks = h;
      return panel;
    }),
    fetchOnline: vi.fn().mockResolvedValue(0),
    ...over,
  };
  const launcher = mountChatLauncher(document, deps);
  const fab = document.querySelector<HTMLButtonElement>(".chat-fab")!;
  const section = document.querySelector<HTMLElement>("section.chat")!;
  const badge = document.querySelector<HTMLElement>(".chat-badge")!;
  return { launcher, deps, panel, fab, section, badge, hooks: () => hooks! };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.useRealTimers();
  document.body.replaceChildren();
  document.body.className = "";
  history.replaceState(null, "", "/");
});

describe("mountChatLauncher", () => {
  it("adds a floating button; the panel loads only on first open", async () => {
    const { deps, panel, fab, section } = setup();
    expect(fab.getAttribute("aria-label")).toBe("打開聊天室");
    expect(fab.querySelector("svg.ic use")?.getAttribute("href")).toBe("#i-comments");
    expect(section.hidden).toBe(true);
    expect(deps.createPanel).not.toHaveBeenCalled();
    fab.click();
    await flush();
    expect(section.hidden).toBe(false);
    expect(fab.getAttribute("aria-expanded")).toBe("true");
    expect(document.body.classList.contains("chat-open")).toBe(true);
    expect(panel.start).toHaveBeenCalledTimes(1);
    expect(panel.focus).toHaveBeenCalled();
    fab.click();
    expect(section.hidden).toBe(true);
    fab.click();
    await flush();
    expect(deps.createPanel).toHaveBeenCalledTimes(1);
  });

  it("closes from the panel, on Escape, and gives focus back to the button", async () => {
    const { fab, section, hooks } = setup();
    fab.click();
    await flush();
    hooks().onClose();
    expect(section.hidden).toBe(true);
    expect(document.activeElement).toBe(fab);
    fab.click();
    await flush();
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(section.hidden).toBe(true);
  });

  it.each(["#chat", "#guestbook"])("opens for %s links and drops the hash on close", async (hash) => {
    history.replaceState(null, "", `/${hash}`);
    const { section, hooks } = setup();
    await flush();
    expect(section.hidden).toBe(false);
    hooks().onClose();
    expect(location.hash).toBe("");
  });

  it("opens when the hash changes on a loaded page", async () => {
    const { section } = setup();
    history.replaceState(null, "", "/#chat");
    window.dispatchEvent(new HashChangeEvent("hashchange"));
    await flush();
    expect(section.hidden).toBe(false);
  });

  it("shows how many are online, checked once after load, then live from the panel", async () => {
    const { badge, fab, hooks } = setup({ fetchOnline: vi.fn().mockResolvedValue(3) });
    expect(badge.hidden).toBe(true);
    await vi.advanceTimersByTimeAsync(ONLINE_CHECK_DELAY_MS);
    expect(badge.hidden).toBe(false);
    expect(badge.textContent).toBe("3");
    expect(fab.getAttribute("aria-label")).toBe("打開聊天室（3 人在線）");
    fab.click();
    await flush();
    hooks().onOnline(0);
    expect(badge.hidden).toBe(true);
    hooks().onOnline(150);
    expect(badge.textContent).toBe("99+");
  });

  it("stays quiet when the online check fails", async () => {
    const { badge } = setup({ fetchOnline: vi.fn().mockRejectedValue(new Error("down")) });
    await vi.advanceTimersByTimeAsync(ONLINE_CHECK_DELAY_MS);
    expect(badge.hidden).toBe(true);
  });

  it("hands the cape index to the panel, whenever each arrives", async () => {
    const { launcher, panel, fab } = setup();
    const index = fixtureIndex();
    launcher.setIndex(index);
    fab.click();
    await flush();
    expect(panel.setIndex).toHaveBeenCalledWith(index);
  });
});
