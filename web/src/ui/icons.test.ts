import { ICONS, icon } from "./icons";

describe("icon", () => {
  it.each(ICONS)("points %s at its symbol in the page sprite and hides it from screen readers", (name) => {
    const svg = icon(name);
    expect(svg.namespaceURI).toBe("http://www.w3.org/2000/svg");
    expect(svg.getAttribute("class")).toBe("ic");
    expect(svg.getAttribute("aria-hidden")).toBe("true");
    expect(svg.querySelector("use")?.getAttribute("href")).toBe(`#i-${name}`);
  });
});
