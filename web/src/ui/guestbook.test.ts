import { fixtureIndex } from "../data/fixture";
import { ApiError } from "../data/guestbook-api";
import type { GuestMessage, GuestbookApi } from "../data/guestbook-api";
import { mountGuestbook } from "./guestbook";
import type { Captcha, GuestbookDeps } from "./guestbook";

const NOW = 1_800_000_000_000;
const msg = (id: number, over: Partial<GuestMessage> = {}): GuestMessage => ({
  id,
  nickname: `玩家${id}`,
  body: `留言${id}`,
  createdAt: NOW - 120_000,
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

function setup(over: Partial<GuestbookDeps> = {}, api: Partial<GuestbookApi> = {}) {
  const captcha: Captcha = { token: vi.fn(() => "tok"), reset: vi.fn() };
  const deps: GuestbookDeps = {
    api: {
      list: vi.fn().mockResolvedValue({ messages: [msg(2), msg(1)], more: false }),
      post: vi.fn(async (input) => msg(3, { nickname: input.nickname, body: input.body, createdAt: NOW })),
      report: vi.fn().mockResolvedValue(undefined),
      ...api,
    },
    captcha: vi.fn().mockResolvedValue(captcha),
    storage: memoryStorage(),
    now: () => NOW,
    openCape: vi.fn(),
    ...over,
  };
  const root = document.createElement("div");
  document.body.append(root);
  const gb = mountGuestbook(root, deps);
  const $ = <T extends Element = HTMLElement>(sel: string) => root.querySelector<T>(sel)!;
  const items = () => [...root.querySelectorAll<HTMLElement>(".gb-item")];
  const fill = (nickname: string, body: string) => {
    $<HTMLInputElement>("input[name=nickname]").value = nickname;
    const area = $<HTMLTextAreaElement>("textarea[name=body]");
    area.value = body;
    area.dispatchEvent(new Event("input"));
  };
  const submit = () => $<HTMLFormElement>("form").dispatchEvent(new Event("submit", { cancelable: true }));
  return { root, gb, deps, captcha, $, items, fill, submit };
}

afterEach(() => document.body.replaceChildren());

describe("mountGuestbook", () => {
  it("loads once, newest first, as plain text with a relative time", async () => {
    const { gb, deps, items } = setup({}, { list: vi.fn().mockResolvedValue({ messages: [msg(2, { body: "<b>粗體</b>" }), msg(1)], more: false }) });
    gb.load();
    gb.load();
    await flush();
    expect(deps.api.list).toHaveBeenCalledTimes(1);
    expect(items().map((i) => i.dataset.id)).toEqual(["2", "1"]);
    expect(items()[0].querySelector(".gb-name")?.textContent).toBe("玩家2");
    expect(items()[0].querySelector("time")?.textContent).toBe("2 分鐘前");
    expect(items()[0].querySelector(".gb-body b")).toBeNull();
    expect(items()[0].querySelector(".gb-body")?.textContent).toBe("<b>粗體</b>");
  });

  it("pages with 載入更多 until there is no more", async () => {
    const list = vi.fn()
      .mockResolvedValueOnce({ messages: [msg(5), msg(4)], more: true })
      .mockResolvedValueOnce({ messages: [msg(3)], more: false });
    const { gb, $, items } = setup({}, { list });
    gb.load();
    await flush();
    const more = $<HTMLButtonElement>(".gb-more");
    expect(more.hidden).toBe(false);
    more.click();
    await flush();
    expect(list).toHaveBeenLastCalledWith(4);
    expect(items().map((i) => i.dataset.id)).toEqual(["5", "4", "3"]);
    expect(more.hidden).toBe(true);
  });

  it("shows a retry when the list fails to load", async () => {
    const list = vi.fn().mockRejectedValueOnce(new ApiError("network")).mockResolvedValueOnce({ messages: [msg(1)], more: false });
    const { gb, root, items } = setup({}, { list });
    gb.load();
    await flush();
    expect(root.textContent).toContain("留言載入失敗");
    [...root.querySelectorAll("button")].find((b) => b.textContent === "重試")!.click();
    await flush();
    expect(items()).toHaveLength(1);
  });

  it("checks the form before posting", async () => {
    const { gb, deps, captcha, $, fill, submit } = setup();
    gb.load();
    await flush();
    fill(" ", "內容");
    submit();
    expect($(".gb-status").textContent).toBe("請輸入暱稱");
    fill("阿明", "  ");
    submit();
    expect($(".gb-status").textContent).toBe("請輸入留言");
    vi.mocked(captcha.token).mockReturnValue(null);
    fill("阿明", "內容");
    submit();
    expect($(".gb-status").textContent).toBe("請先完成驗證");
    expect(deps.api.post).not.toHaveBeenCalled();
  });

  it("posts, shows the new message on top, remembers the nickname and resets the check", async () => {
    const { gb, deps, captcha, $, items, fill, submit } = setup();
    gb.load();
    await flush();
    fill(" 阿明 ", "  #12 是我的 ");
    submit();
    await flush();
    expect(deps.api.post).toHaveBeenCalledWith({ nickname: "阿明", body: "#12 是我的", token: "tok" });
    expect(items()[0].dataset.id).toBe("3");
    expect($<HTMLTextAreaElement>("textarea").value).toBe("");
    expect($(".gb-count").textContent).toBe("0/300");
    expect(deps.storage!.getItem("oldcape:nickname")).toBe("阿明");
    expect(captcha.reset).toHaveBeenCalled();
    expect($(".gb-status").textContent).toBe("已送出，謝謝你的留言！");
    expect($<HTMLButtonElement>("form button[type=submit]").disabled).toBe(false);
  });

  it.each([
    [new ApiError("too_fast", 12), "留言太頻繁，請 12 秒後再試"],
    [new ApiError("has_link"), "留言不能包含網址"],
    [new ApiError("captcha"), "驗證失敗，請重新驗證"],
    [new ApiError("network"), "送出失敗，請稍後再試"],
  ])("explains a failed post (%s)", async (error, text) => {
    const { gb, captcha, $, fill, submit } = setup({}, { post: vi.fn().mockRejectedValue(error) });
    gb.load();
    await flush();
    fill("阿明", "內容");
    submit();
    await flush();
    expect($(".gb-status").textContent).toBe(text);
    expect(captcha.reset).toHaveBeenCalled();
    expect($<HTMLTextAreaElement>("textarea").value).toBe("內容");
  });

  it("prefills the remembered nickname and counts characters", async () => {
    const storage = memoryStorage();
    storage.setItem("oldcape:nickname", "老玩家");
    const { $, fill } = setup({ storage });
    expect($<HTMLInputElement>("input[name=nickname]").value).toBe("老玩家");
    fill("老玩家", "😀好");
    expect($(".gb-count").textContent).toBe("2/300");
  });

  it("works without storage (private mode)", async () => {
    const { gb, fill, submit, items } = setup({ storage: null });
    gb.load();
    await flush();
    fill("阿明", "內容");
    submit();
    await flush();
    expect(items()[0].dataset.id).toBe("3");
  });

  it("reports after an inline confirm, once, and remembers it", async () => {
    const storage = memoryStorage();
    const { gb, deps, items } = setup({ storage });
    gb.load();
    await flush();
    const button = items()[1].querySelector<HTMLButtonElement>(".gb-report")!;
    button.click();
    expect(button.textContent).toBe("確定檢舉？");
    expect(deps.api.report).not.toHaveBeenCalled();
    button.click();
    await flush();
    expect(deps.api.report).toHaveBeenCalledWith(1);
    expect(button.textContent).toBe("已檢舉");
    expect(button.disabled).toBe(true);

    const again = setup({ storage });
    again.gb.load();
    await flush();
    expect(again.items()[1].querySelector<HTMLButtonElement>(".gb-report")!.disabled).toBe(true);
  });

  it("links #ids once the cape index arrives, and opens the cape on click", async () => {
    const { gb, deps, items } = setup({}, { list: vi.fn().mockResolvedValue({ messages: [msg(1, { body: "#12 是我的" })], more: false }) });
    gb.load();
    await flush();
    expect(items()[0].querySelector("a.cape-ref")).toBeNull();
    const index = fixtureIndex();
    gb.setIndex(index);
    const link = items()[0].querySelector<HTMLAnchorElement>("a.cape-ref")!;
    const click = new MouseEvent("click", { bubbles: true, cancelable: true });
    link.dispatchEvent(click);
    expect(click.defaultPrevented).toBe(true);
    expect(deps.openCape).toHaveBeenCalledWith(index.byId.get(12));
  });

  it("says so when the human check cannot load", async () => {
    const { gb, $ } = setup({ captcha: vi.fn().mockRejectedValue(new Error("blocked")) });
    gb.load();
    await flush();
    expect($(".gb-status").textContent).toBe("驗證元件載入失敗，請重新整理頁面。");
  });
});
