import { PROD_SITEKEY, TEST_SITEKEY, TURNSTILE_SCRIPT, loadTurnstile, sitekeyFor } from "./turnstile";

interface Options {
  sitekey: string;
  callback: (token: string) => void;
  "expired-callback": () => void;
}

describe("sitekeyFor", () => {
  it("uses the real key only on oldcape.org", () => {
    expect(sitekeyFor("oldcape.org")).toBe(PROD_SITEKEY);
    expect(sitekeyFor("www.oldcape.org")).toBe(PROD_SITEKEY);
    expect(sitekeyFor("localhost")).toBe(TEST_SITEKEY);
    expect(sitekeyFor("oldcape.jack3555tw.workers.dev")).toBe(TEST_SITEKEY);
  });
});

describe("loadTurnstile", () => {
  afterEach(() => {
    document.head.querySelectorAll("script").forEach((s) => s.remove());
    delete (window as { turnstile?: unknown }).turnstile;
  });

  it("injects the script once, renders the widget and tracks its token", async () => {
    const api = { render: vi.fn((_el: HTMLElement, _o: Options) => "w1"), reset: vi.fn() };
    const box = document.createElement("div");
    const pending = loadTurnstile(box, "key");
    const again = loadTurnstile(document.createElement("div"), "key");
    const scripts = document.head.querySelectorAll<HTMLScriptElement>(`script[src="${TURNSTILE_SCRIPT}"]`);
    expect(scripts).toHaveLength(1);
    (window as { turnstile?: unknown }).turnstile = api;
    scripts[0].dispatchEvent(new Event("load"));
    const captcha = await pending;
    await again;
    expect(api.render).toHaveBeenCalledWith(box, expect.objectContaining({ sitekey: "key", theme: "dark", language: "zh-tw" }));
    const options = api.render.mock.calls[0][1]; // the first widget, which `captcha` belongs to
    expect(captcha.token()).toBeNull();
    options.callback("tok");
    expect(captcha.token()).toBe("tok");
    options["expired-callback"]();
    expect(captcha.token()).toBeNull();
    options.callback("tok2");
    captcha.reset();
    expect(api.reset).toHaveBeenCalledWith("w1");
    expect(captcha.token()).toBeNull();
  });

  it("rejects when the script cannot load", async () => {
    const pending = loadTurnstile(document.createElement("div"), "key");
    document.head.querySelector("script")!.dispatchEvent(new Event("error"));
    await expect(pending).rejects.toThrow(/turnstile/);
  });
});
