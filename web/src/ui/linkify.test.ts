import { fixtureIndex } from "../data/fixture";
import { MAX_CAPE_REFS, renderMessageBody } from "./linkify";

const idx = fixtureIndex(); // capes 3, 7 (blank), 12; alias 20 -> 3

const html = (frag: DocumentFragment): HTMLElement => {
  const div = document.createElement("div");
  div.append(frag);
  return div;
};

describe("renderMessageBody", () => {
  it("turns a known #id into a cape link with a 1x front-face sprite", () => {
    const div = html(renderMessageBody("#12 是我的披風", idx));
    const link = div.querySelector<HTMLAnchorElement>("a.cape-ref")!;
    expect(link.getAttribute("href")).toBe("/?cape=12");
    expect(link.dataset.id).toBe("12");
    expect(link.textContent).toBe("#12");
    const mini = link.querySelector<HTMLElement>(".cape")!;
    expect([mini.style.width, mini.style.height]).toEqual(["10px", "16px"]);
    expect(mini.getAttribute("aria-hidden")).toBe("true");
    expect(div.textContent).toBe("#12 是我的披風");
  });

  it("links an alias to the cape it was merged into", () => {
    const link = html(renderMessageBody("我的是 #20", idx)).querySelector<HTMLAnchorElement>("a.cape-ref")!;
    expect(link.getAttribute("href")).toBe("/?cape=3");
    expect(link.textContent).toBe("#20");
  });

  it("leaves unknown ids and plain numbers as text", () => {
    const div = html(renderMessageBody("#99999 和 12 和 #", idx));
    expect(div.querySelector("a")).toBeNull();
    expect(div.textContent).toBe("#99999 和 12 和 #");
  });

  it(`links at most ${MAX_CAPE_REFS} capes per message`, () => {
    const text = Array.from({ length: MAX_CAPE_REFS + 2 }, () => "#12").join(" ");
    const div = html(renderMessageBody(text, idx));
    expect(div.querySelectorAll("a.cape-ref")).toHaveLength(MAX_CAPE_REFS);
    expect(div.textContent).toBe(text);
  });

  it("renders text only (no markup injection) and keeps it plain without an index", () => {
    const evil = '<img src=x onerror="alert(1)"> #12';
    const withIndex = html(renderMessageBody(evil, idx));
    expect(withIndex.querySelector("img")).toBeNull();
    expect(withIndex.textContent).toBe(evil);
    const noIndex = html(renderMessageBody(evil, null));
    expect(noIndex.querySelector("a")).toBeNull();
    expect(noIndex.textContent).toBe(evil);
  });

  it("does not link #ids glued to other digits or letters", () => {
    expect(html(renderMessageBody("abc#12 #12a #123456789", idx)).querySelector("a")).toBeNull();
  });
});
