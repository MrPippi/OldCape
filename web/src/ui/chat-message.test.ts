import { fixtureIndex } from "../data/fixture";
import type { GuestMessage } from "../data/guestbook-api";
import { chatItem } from "./chat-message";
import type { ItemContext } from "./chat-message";

const NOW = 1_800_000_000_000;
const msg = (over: Partial<GuestMessage> = {}): GuestMessage => ({ id: 7, nickname: "阿明", body: "嗨", createdAt: NOW - 120_000, ...over });
const ctx = (over: Partial<ItemContext> = {}): ItemContext => ({
  index: null,
  now: NOW,
  reported: new Set(),
  report: vi.fn().mockResolvedValue(undefined),
  ...over,
});
const flush = () => new Promise((r) => setTimeout(r, 0));

describe("chatItem", () => {
  it("shows name, relative time and the body as plain text", () => {
    const li = chatItem(msg({ body: "<b>粗體</b>\n第二行" }), ctx());
    expect(li.dataset.id).toBe("7");
    expect(li.querySelector(".chat-name")?.textContent).toBe("阿明");
    expect(li.querySelector("time")?.textContent).toBe("2 分鐘前");
    expect(li.querySelector("time")?.getAttribute("datetime")).toBe(new Date(NOW - 120_000).toISOString());
    expect(li.querySelector(".chat-body b")).toBeNull();
    expect(li.querySelector(".chat-body")?.textContent).toBe("<b>粗體</b>\n第二行");
  });

  it("links #ids with a mini cape when the index is known", () => {
    const li = chatItem(msg({ body: "#12 是我的" }), ctx({ index: fixtureIndex() }));
    expect(li.querySelector("a.cape-ref")?.getAttribute("href")).toBe("/?cape=12");
  });

  it("reports after an inline confirm", async () => {
    const report = vi.fn().mockResolvedValue(undefined);
    const button = chatItem(msg(), ctx({ report })).querySelector<HTMLButtonElement>(".chat-report")!;
    expect(button.getAttribute("aria-label")).toBe("檢舉這則訊息");
    button.click();
    expect(button.textContent).toBe("確定檢舉？");
    expect(report).not.toHaveBeenCalled();
    button.click();
    await flush();
    expect(report).toHaveBeenCalledWith(7);
    expect(button.textContent).toBe("已檢舉");
    expect(button.disabled).toBe(true);
  });

  it("lets a failed report be tried again", async () => {
    const report = vi.fn().mockRejectedValueOnce(new Error("down")).mockResolvedValueOnce(undefined);
    const button = chatItem(msg(), ctx({ report })).querySelector<HTMLButtonElement>(".chat-report")!;
    button.click();
    button.click();
    await flush();
    expect(button.textContent).toBe("檢舉失敗，再試一次");
    expect(button.disabled).toBe(false);
    button.click();
    button.click();
    await flush();
    expect(button.textContent).toBe("已檢舉");
  });

  it("shows an already reported message as reported", () => {
    const button = chatItem(msg(), ctx({ reported: new Set([7]) })).querySelector<HTMLButtonElement>(".chat-report")!;
    expect(button.disabled).toBe(true);
    expect(button.textContent).toBe("已檢舉");
  });
});
