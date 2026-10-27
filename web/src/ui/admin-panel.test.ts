import type { AdminApi, AdminMessage } from "../data/admin-api";
import { ApiError } from "../data/guestbook-api";
import { mountAdmin } from "./admin-panel";
import type { AdminDeps } from "./admin-panel";

const NOW = 1_800_000_000_000;
const row = (id: number, over: Partial<AdminMessage> = {}): AdminMessage => ({
  id,
  nickname: `玩家${id}`,
  body: `訊息${id}`,
  createdAt: NOW - 120_000,
  hidden: false,
  reportCount: 0,
  ...over,
});
const flush = async () => {
  for (let i = 0; i < 5; i++) await new Promise((r) => setTimeout(r, 0));
};

function memoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() { return data.size; },
    clear: () => data.clear(),
    getItem: (k) => data.get(k) ?? null,
    key: (i) => [...data.keys()][i] ?? null,
    removeItem: (k) => void data.delete(k),
    setItem: (k, v) => void data.set(k, v),
  };
}

function setup(api: Partial<AdminApi> = {}, over: Partial<AdminDeps> = {}) {
  const full: AdminApi = {
    list: vi.fn().mockResolvedValue({ messages: [row(3, { hidden: true, reportCount: 3 }), row(2, { reportCount: 1 }), row(1)], more: false }),
    hide: vi.fn().mockResolvedValue(undefined),
    show: vi.fn().mockResolvedValue(undefined),
    remove: vi.fn().mockResolvedValue(undefined),
    ...api,
  };
  const makeApi = vi.fn(() => full);
  const deps: AdminDeps = { makeApi, storage: memoryStorage(), now: () => NOW, ...over };
  const root = document.createElement("main");
  document.body.append(root);
  mountAdmin(root, deps);
  const $ = <T extends Element = HTMLElement>(sel: string) => root.querySelector<T>(sel)!;
  const rows = () => [...root.querySelectorAll<HTMLElement>("tr[data-id]")];
  const login = async (token = "t".repeat(40)) => {
    $<HTMLInputElement>("input[name=token]").value = token;
    $<HTMLFormElement>("form").dispatchEvent(new Event("submit", { cancelable: true }));
    await flush();
  };
  const button = (tr: HTMLElement, text: string) => [...tr.querySelectorAll("button")].find((b) => b.textContent === text)!;
  return { root, deps, api: full, makeApi, $, rows, login, button };
}

afterEach(() => document.body.replaceChildren());

describe("mountAdmin", () => {
  it("signs in with the token, remembers it for this tab, and lists every message", async () => {
    const { deps, makeApi, rows, login, $ } = setup();
    expect($("input[name=token]").getAttribute("type")).toBe("password");
    await login("secret-token-0123456789-0123456789");
    expect(makeApi).toHaveBeenCalledWith("secret-token-0123456789-0123456789");
    expect(deps.storage!.getItem("oldcape:admin-token")).toBe("secret-token-0123456789-0123456789");
    expect(rows().map((r) => r.dataset.id)).toEqual(["3", "2", "1"]);
    const first = rows()[0];
    expect(first.querySelector(".adm-state")?.textContent).toBe("已隱藏");
    expect(first.querySelector(".adm-reports")?.textContent).toBe("3");
    expect(first.querySelector(".adm-body")?.textContent).toBe("訊息3");
  });

  it("says what is wrong when sign-in fails", async () => {
    const { login, $ } = setup({ list: vi.fn().mockRejectedValue(new ApiError("unauthorized")) });
    await login();
    expect($(".adm-status").textContent).toBe("管理密碼不對。");
    const disabled = setup({ list: vi.fn().mockRejectedValue(new ApiError("admin_disabled")) });
    await disabled.login();
    expect(disabled.$(".adm-status").textContent).toContain("ADMIN_TOKEN");
  });

  it("hides and shows a message", async () => {
    const { api, rows, login, button } = setup();
    await login();
    button(rows()[1], "隱藏").click();
    await flush();
    expect(api.hide).toHaveBeenCalledWith(2);
    expect(rows()[1].querySelector(".adm-state")?.textContent).toBe("已隱藏");
    button(rows()[0], "恢復").click();
    await flush();
    expect(api.show).toHaveBeenCalledWith(3);
    expect(rows()[0].querySelector(".adm-state")?.textContent).toBe("顯示中");
    expect(rows()[0].querySelector(".adm-reports")?.textContent).toBe("0");
  });

  it("deletes only after a second click", async () => {
    const { api, rows, login, button } = setup();
    await login();
    const del = button(rows()[2], "刪除");
    del.click();
    expect(del.textContent).toBe("確定刪除？");
    expect(api.remove).not.toHaveBeenCalled();
    del.click();
    await flush();
    expect(api.remove).toHaveBeenCalledWith(1);
    expect(rows().map((r) => r.dataset.id)).toEqual(["3", "2"]);
  });

  it("can show only messages that need attention", async () => {
    const { rows, login, $ } = setup();
    await login();
    const toggle = $<HTMLInputElement>("input[name=attention]");
    toggle.checked = true;
    toggle.dispatchEvent(new Event("change"));
    expect(rows().map((r) => r.dataset.id)).toEqual(["3", "2"]);
  });

  it("loads older pages", async () => {
    const list = vi.fn()
      .mockResolvedValueOnce({ messages: [row(5), row(4)], more: true })
      .mockResolvedValueOnce({ messages: [row(3)], more: false });
    const { rows, login, $ } = setup({ list });
    await login();
    const more = $<HTMLButtonElement>(".adm-more");
    expect(more.hidden).toBe(false);
    more.click();
    await flush();
    expect(list).toHaveBeenLastCalledWith(4);
    expect(rows().map((r) => r.dataset.id)).toEqual(["5", "4", "3"]);
    expect(more.hidden).toBe(true);
  });

  it("signs out and forgets the token", async () => {
    const { deps, login, root } = setup();
    await login();
    [...root.querySelectorAll("button")].find((b) => b.textContent === "登出")!.click();
    expect(deps.storage!.getItem("oldcape:admin-token")).toBeNull();
    expect(root.querySelector("input[name=token]")).not.toBeNull();
  });

  it("signs straight in with a token remembered by this tab", async () => {
    const storage = memoryStorage();
    storage.setItem("oldcape:admin-token", "kept-token");
    const { makeApi, rows } = setup({}, { storage });
    await flush();
    expect(makeApi).toHaveBeenCalledWith("kept-token");
    expect(rows()).toHaveLength(3);
  });
});
