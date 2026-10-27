import type { ChatEvent, ChatSocket, ConnState } from "../data/chat-socket";
import { fixtureIndex } from "../data/fixture";
import type { GuestMessage, GuestbookApi } from "../data/guestbook-api";
import { mountChatPanel } from "./chat-panel";
import type { ChatPanelDeps } from "./chat-panel";

const NOW = 1_800_000_000_000;
const msg = (id: number, over: Partial<GuestMessage> = {}): GuestMessage => ({
  id,
  nickname: `玩家${id}`,
  body: `訊息${id}`,
  createdAt: NOW - 60_000,
  ...over,
});
const flush = async () => {
  for (let i = 0; i < 6; i++) await new Promise((r) => setTimeout(r, 0));
};

function memoryStorage(seed: Record<string, string> = {}): Storage {
  const data = new Map(Object.entries(seed));
  return {
    get length() { return data.size; },
    clear: () => data.clear(),
    getItem: (k) => data.get(k) ?? null,
    key: (i) => [...data.keys()][i] ?? null,
    removeItem: (k) => void data.delete(k),
    setItem: (k, v) => void data.set(k, v),
  };
}

class FakeChat implements ChatSocket {
  handlers!: { url: () => string; onEvent: (e: ChatEvent) => void; onState: (s: ConnState) => void };
  sent: unknown[] = [];
  isOpen = false;
  reconnects = 0;
  urls: string[] = [];
  send(e: unknown) {
    if (!this.isOpen) return false;
    this.sent.push(e);
    return true;
  }
  reconnect() {
    this.reconnects++;
    this.urls.push(this.handlers.url());
  }
  close() {}
  /** Server side: the socket opened and said hello. */
  hello(canSpeak: boolean, online = 3) {
    this.isOpen = true;
    this.handlers.onState("open");
    this.handlers.onEvent({ type: "hello", online, canSpeak });
  }
  emit(e: ChatEvent) {
    this.handlers.onEvent(e);
  }
}

const PASS = JSON.stringify({ session: "pass.sig", expiresAt: NOW + 3_600_000 });

function setup(over: Partial<ChatPanelDeps> = {}, api: Partial<GuestbookApi> = {}) {
  const chat = new FakeChat();
  let onToken: ((t: string) => void) | null = null;
  const captcha = { token: vi.fn(() => null), reset: vi.fn() };
  const deps: ChatPanelDeps = {
    api: {
      list: vi.fn().mockResolvedValue({ messages: [msg(2), msg(1)], more: true }),
      session: vi.fn().mockResolvedValue({ session: "new.pass", expiresAt: NOW + 6 * 3_600_000 }),
      report: vi.fn().mockResolvedValue(undefined),
      ...api,
    },
    connect: (handlers) => {
      chat.handlers = handlers;
      chat.urls.push(handlers.url());
      return chat;
    },
    captcha: vi.fn(async (_box, cb) => {
      onToken = cb;
      return captcha;
    }),
    storage: memoryStorage(),
    now: () => NOW,
    wsUrl: (session) => `wss://t/api/chat${session ? `?session=${session}` : ""}`,
    openCape: vi.fn(),
    onOnline: vi.fn(),
    onClose: vi.fn(),
    nonce: () => "n1",
    ...over,
  };
  const root = document.createElement("section");
  document.body.append(root);
  const panel = mountChatPanel(root, deps);
  const $ = <T extends Element = HTMLElement>(sel: string) => root.querySelector<T>(sel)!;
  const ids = () => [...root.querySelectorAll<HTMLElement>(".chat-item")].map((i) => Number(i.dataset.id));
  const type = (body: string, nickname = "阿明") => {
    $<HTMLInputElement>("input[name=nickname]").value = nickname;
    const area = $<HTMLTextAreaElement>("textarea");
    area.value = body;
    area.dispatchEvent(new Event("input"));
  };
  const submit = () => $<HTMLFormElement>("form").dispatchEvent(new Event("submit", { cancelable: true }));
  const pass = (t: string) => onToken!(t);
  return { root, panel, deps, chat, captcha, $, ids, type, submit, pass };
}

afterEach(() => document.body.replaceChildren());

describe("mountChatPanel", () => {
  it("loads history once, oldest at the top, and connects read-only without a pass", async () => {
    const { panel, deps, chat, ids, $ } = setup();
    panel.start();
    panel.start();
    await flush();
    expect(deps.api.list).toHaveBeenCalledTimes(1);
    expect(ids()).toEqual([1, 2]);
    expect(chat.urls).toEqual(["wss://t/api/chat"]);
    expect($(".chat-state").textContent).toBe("連線中…");
    chat.hello(false, 4);
    expect($(".chat-state").textContent).toBe("4 人在線");
    expect(deps.onOnline).toHaveBeenLastCalledWith(4);
    chat.emit({ type: "online", count: 5 });
    expect($(".chat-state").textContent).toBe("5 人在線");
  });

  it("adds live messages once and removes hidden ones", async () => {
    const { panel, chat, ids } = setup();
    panel.start();
    await flush();
    chat.hello(false);
    chat.emit({ type: "message", message: msg(3) });
    chat.emit({ type: "message", message: msg(3) });
    expect(ids()).toEqual([1, 2, 3]);
    chat.emit({ type: "hidden", id: 2 });
    expect(ids()).toEqual([1, 3]);
  });

  it("asks for the human check on first send, then sends the waiting message by itself", async () => {
    const { panel, deps, chat, $, type, submit, pass } = setup();
    panel.start();
    await flush();
    chat.hello(false);
    type("  #12 是我的  ", " 阿明 ");
    submit();
    await flush();
    expect($(".chat-captcha").hidden).toBe(false);
    expect($(".chat-status").textContent).toBe("完成下方驗證後就會送出");
    expect(chat.sent).toEqual([]);

    pass("tok");
    await flush();
    expect(deps.api.session).toHaveBeenCalledWith("tok");
    expect(JSON.parse(deps.storage!.getItem("oldcape:chat-pass")!)).toEqual({ session: "new.pass", expiresAt: NOW + 6 * 3_600_000 });
    expect(chat.reconnects).toBe(1);
    expect(chat.urls.at(-1)).toBe("wss://t/api/chat?session=new.pass");
    expect($(".chat-captcha").hidden).toBe(true);

    chat.hello(true);
    expect(chat.sent).toEqual([{ type: "say", nickname: "阿明", body: "#12 是我的", nonce: "n1" }]);
    expect($<HTMLButtonElement>(".chat-send").disabled).toBe(true);

    chat.emit({ type: "message", message: msg(9, { nickname: "阿明", body: "#12 是我的" }), nonce: "n1" });
    expect($<HTMLTextAreaElement>("textarea").value).toBe("");
    expect($<HTMLButtonElement>(".chat-send").disabled).toBe(false);
    expect(deps.storage!.getItem("oldcape:nickname")).toBe("阿明");
  });

  it("sends straight away with a stored pass", async () => {
    const { panel, chat, type, submit } = setup({ storage: memoryStorage({ "oldcape:chat-pass": PASS, "oldcape:nickname": "老玩家" }) });
    panel.start();
    await flush();
    expect(chat.urls[0]).toBe("wss://t/api/chat?session=pass.sig");
    chat.hello(true);
    type("嗨", "老玩家");
    submit();
    expect(chat.sent).toEqual([{ type: "say", nickname: "老玩家", body: "嗨", nonce: "n1" }]);
  });

  it("prefills the remembered nickname", () => {
    const { $ } = setup({ storage: memoryStorage({ "oldcape:nickname": "老玩家" }) });
    expect($<HTMLInputElement>("input[name=nickname]").value).toBe("老玩家");
  });

  it.each([
    [{ code: "too_fast", retryAfter: 2 }, "講太快了，請 2 秒後再試"],
    [{ code: "has_link" }, "訊息不能包含網址"],
    [{ code: "daily_limit" }, "今天的發言次數已達上限，明天再來吧"],
  ])("keeps the text and explains %j", async (error, text) => {
    const { panel, chat, $, type, submit } = setup({ storage: memoryStorage({ "oldcape:chat-pass": PASS }) });
    panel.start();
    await flush();
    chat.hello(true);
    type("嗨");
    submit();
    chat.emit({ type: "error", nonce: "n1", ...error });
    expect($(".chat-status").textContent).toBe(text);
    expect($<HTMLTextAreaElement>("textarea").value).toBe("嗨");
    expect($<HTMLButtonElement>(".chat-send").disabled).toBe(false);
  });

  it("asks for a new check when the pass has expired, keeping the message", async () => {
    const { panel, deps, chat, $, type, submit } = setup({ storage: memoryStorage({ "oldcape:chat-pass": PASS }) });
    panel.start();
    await flush();
    chat.hello(true);
    type("嗨");
    submit();
    chat.emit({ type: "error", code: "need_session", nonce: "n1" });
    await flush();
    expect(deps.storage!.getItem("oldcape:chat-pass")).toBeNull();
    expect($(".chat-captcha").hidden).toBe(false);
    expect($<HTMLTextAreaElement>("textarea").value).toBe("嗨");
  });

  it("checks the form before anything else", async () => {
    const { panel, chat, $, type, submit } = setup({ storage: memoryStorage({ "oldcape:chat-pass": PASS }) });
    panel.start();
    await flush();
    chat.hello(true);
    type("嗨", " ");
    submit();
    expect($(".chat-status").textContent).toBe("請先輸入暱稱");
    type("  ");
    submit();
    expect($(".chat-status").textContent).toBe("請輸入訊息");
    expect(chat.sent).toEqual([]);
  });

  it("sends on Enter, but not on Shift+Enter or while composing Chinese", async () => {
    const { panel, chat, $, type } = setup({ storage: memoryStorage({ "oldcape:chat-pass": PASS }) });
    panel.start();
    await flush();
    chat.hello(true);
    type("嗨");
    const area = $<HTMLTextAreaElement>("textarea");
    const key = (init: KeyboardEventInit) => area.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", cancelable: true, ...init }));
    key({ shiftKey: true });
    key({ isComposing: true });
    expect(chat.sent).toEqual([]);
    key({});
    expect(chat.sent).toHaveLength(1);
  });

  it("shows reconnecting and fills the gap once back", async () => {
    const list = vi.fn()
      .mockResolvedValueOnce({ messages: [msg(2), msg(1)], more: false })
      .mockResolvedValueOnce({ messages: [msg(3), msg(4)], more: false });
    const { panel, chat, $, ids } = setup({}, { list });
    panel.start();
    await flush();
    chat.hello(false);
    chat.handlers.onState("reconnecting");
    expect($(".chat-state").textContent).toBe("重新連線中…");
    chat.hello(false);
    await flush();
    expect(list).toHaveBeenLastCalledWith({ after: 2 });
    expect(ids()).toEqual([1, 2, 3, 4]);
  });

  it("does not pull a reader who scrolled up; offers a jump to new messages instead", async () => {
    const { panel, chat, $ } = setup();
    panel.start();
    await flush();
    chat.hello(false);
    const log = $(".chat-log");
    Object.defineProperties(log, {
      scrollHeight: { configurable: true, value: 2000 },
      clientHeight: { configurable: true, value: 400 },
    });
    log.scrollTop = 500;
    chat.emit({ type: "message", message: msg(3) });
    const pill = $<HTMLButtonElement>(".chat-new");
    expect(pill.hidden).toBe(false);
    expect(log.scrollTop).toBe(500);
    pill.click();
    expect(log.scrollTop).toBe(2000);
    expect(pill.hidden).toBe(true);
  });

  it("loads older messages when scrolled to the top", async () => {
    const list = vi.fn()
      .mockResolvedValueOnce({ messages: [msg(5), msg(4)], more: true })
      .mockResolvedValueOnce({ messages: [msg(3), msg(2)], more: false });
    const { panel, $, ids } = setup({}, { list });
    panel.start();
    await flush();
    const log = $(".chat-log");
    log.scrollTop = 0;
    log.dispatchEvent(new Event("scroll"));
    await flush();
    expect(list).toHaveBeenLastCalledWith({ before: 4 });
    expect(ids()).toEqual([2, 3, 4, 5]);
    log.dispatchEvent(new Event("scroll"));
    await flush();
    expect(list).toHaveBeenCalledTimes(2); // no more older pages
  });

  it("links #ids after the index arrives and opens the cape", async () => {
    const { panel, deps, root } = setup({}, { list: vi.fn().mockResolvedValue({ messages: [msg(1, { body: "#12" })], more: false }) });
    panel.start();
    await flush();
    const index = fixtureIndex();
    panel.setIndex(index);
    const link = root.querySelector<HTMLAnchorElement>("a.cape-ref")!;
    const click = new MouseEvent("click", { bubbles: true, cancelable: true });
    link.dispatchEvent(click);
    expect(click.defaultPrevented).toBe(true);
    expect(deps.openCape).toHaveBeenCalledWith(index.byId.get(12));
  });

  it("offers a retry when history fails to load", async () => {
    const list = vi.fn().mockRejectedValueOnce(new Error("down")).mockResolvedValueOnce({ messages: [msg(1)], more: false });
    const { panel, root, ids } = setup({}, { list });
    panel.start();
    await flush();
    expect(root.textContent).toContain("訊息載入失敗");
    [...root.querySelectorAll("button")].find((b) => b.textContent === "重試")!.click();
    await flush();
    expect(ids()).toEqual([1]);
  });

  it("focuses the text box with a mouse, but not on touch screens (no keyboard popping up)", () => {
    const { panel, root } = setup({ storage: memoryStorage({ "oldcape:nickname": "老玩家" }) });
    vi.stubGlobal("matchMedia", (q: string) => ({ matches: q === "(pointer: coarse)" }));
    panel.focus();
    expect(document.activeElement).toBe(root.querySelector(".chat-log"));
    vi.stubGlobal("matchMedia", () => ({ matches: false }));
    panel.focus();
    expect(document.activeElement).toBe(root.querySelector("textarea"));
    vi.unstubAllGlobals();
  });

  it("closes from its close button", () => {
    const { deps, $ } = setup();
    $<HTMLButtonElement>(".chat-close").click();
    expect(deps.onClose).toHaveBeenCalled();
  });
});
