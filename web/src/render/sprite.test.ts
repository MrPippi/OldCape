import { fixtureIndex } from "../data/fixture";
import type { CapeEntry } from "../data/types";
import { applySprite, atlasUrl, spriteStyle } from "./sprite";

const idx = fixtureIndex();
const at = (pos: number): CapeEntry => ({ id: 1000 + pos, colors: 0, blank: false, pos });

describe("atlasUrl", () => {
  it("zero-pads the sheet number", () => {
    expect(atlasUrl(7)).toBe("/data/atlas/atlas-007.png");
    expect(atlasUrl(480)).toBe("/data/atlas/atlas-480.png");
  });
});

describe("spriteStyle", () => {
  it("positions the front face of cell 9 at 6x", () => {
    expect(spriteStyle(at(9), idx, "front", 6)).toEqual({
      width: "60px",
      height: "96px",
      backgroundImage: 'url("/data/atlas/atlas-000.png")',
      backgroundPosition: "-138px -108px",
      backgroundSize: "1056px 816px",
    });
  });

  it("positions the back face of cell 0 at 4x", () => {
    const s = spriteStyle(at(0), idx, "back", 4);
    expect(s.backgroundPosition).toBe("-48px -4px");
    expect(s.width).toBe("40px");
  });

  it("uses the next sheet after 64 capes", () => {
    const s = spriteStyle(at(64), idx, "front", 1);
    expect(s.backgroundImage).toBe('url("/data/atlas/atlas-001.png")');
    expect(s.backgroundPosition).toBe("-1px -1px");
  });

  it.each([
    ["left", "0px -4px", "4px", "64px"],
    ["right", "-44px -4px", "4px", "64px"],
    ["top", "-4px 0px", "40px", "4px"],
    ["bottom", "-44px 0px", "40px", "4px"],
  ] as const)("crops the 1px %s edge of the cape for the 3D slab", (face, pos, w, h) => {
    const s = spriteStyle(at(0), idx, face, 4);
    expect([s.backgroundPosition, s.width, s.height]).toEqual([pos, w, h]);
  });

  it.each([1.5, 0, -2, NaN])("rejects non-integer or non-positive scale %s", (scale) => {
    expect(() => spriteStyle(at(0), idx, "front", scale)).toThrow(RangeError);
  });
});

describe("applySprite", () => {
  it("writes the style and pixelated class onto the element", () => {
    const el = document.createElement("span");
    applySprite(el, at(9), idx, "front", 6);
    expect(el.classList.contains("px")).toBe(true);
    expect(el.style.width).toBe("60px");
    expect(el.style.backgroundPosition).toBe("-138px -108px");
  });
});
