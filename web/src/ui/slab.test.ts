import { fixtureIndex } from "../data/fixture";
import type { CapeEntry } from "../data/types";
import { DRAG_DEG_PER_PX, MAX_TILT_DEG, mountSlab } from "./slab";

const entry: CapeEntry = { id: 7, colors: 0, blank: false, pos: 0 };

function pointer(el: Element, type: string, x: number, y: number): void {
  el.dispatchEvent(Object.assign(new Event(type, { bubbles: true }), { clientX: x, clientY: y, pointerId: 1 }));
}

describe("mountSlab", () => {
  it("builds the six faces of the 10x16x1 cape at the given scale", () => {
    const slab = mountSlab(entry, fixtureIndex(), 12);
    const face = (name: string) => slab.el.querySelector<HTMLElement>(`.slab .${name}`)!;
    expect([face("front").style.width, face("front").style.height]).toEqual(["120px", "192px"]);
    expect(face("back").style.width).toBe("120px");
    expect([face("left").style.width, face("left").style.height]).toEqual(["12px", "192px"]);
    expect([face("top").style.width, face("top").style.height]).toEqual(["120px", "12px"]);
    expect(slab.el.querySelector<HTMLElement>(".slab")!.style.getPropertyValue("--d")).toBe("12px");
    expect(slab.el.getAttribute("aria-label")).toBe("披風 #7 3D 預覽");
  });

  it("spins until a face button turns it square to the viewer", () => {
    const slab = mountSlab(entry, fixtureIndex(), 6);
    const box = slab.el.querySelector<HTMLElement>(".slab")!;
    expect(box.classList.contains("spinning")).toBe(true);
    const [outer, inner] = slab.el.querySelectorAll<HTMLButtonElement>(".slab-views button");
    expect([outer.textContent, inner.textContent]).toEqual(["外側", "內側"]);

    inner.click();
    expect(box.classList.contains("spinning")).toBe(false);
    expect(box.style.getPropertyValue("--ry")).toBe("180deg");
    expect(box.style.getPropertyValue("--rx")).toBe("0deg");
    expect(inner.getAttribute("aria-pressed")).toBe("true");
    expect(outer.getAttribute("aria-pressed")).toBe("false");

    outer.click();
    expect(box.style.getPropertyValue("--ry")).toBe("0deg");
  });

  it("drags to rotate, with the tilt clamped", () => {
    const slab = mountSlab(entry, fixtureIndex(), 6);
    const box = slab.el.querySelector<HTMLElement>(".slab")!;
    const surface = slab.el.querySelector(".slab-drag")!;
    pointer(surface, "pointerdown", 100, 100);
    expect(box.classList.contains("dragging")).toBe(true);
    pointer(surface, "pointermove", 150, 1000);
    expect(box.classList.contains("spinning")).toBe(false);
    expect(box.style.getPropertyValue("--ry")).toBe(`${50 * DRAG_DEG_PER_PX}deg`);
    expect(box.style.getPropertyValue("--rx")).toBe(`${-MAX_TILT_DEG}deg`);
    pointer(surface, "pointerup", 150, 1000);
    expect(box.classList.contains("dragging")).toBe(false);
    pointer(surface, "pointermove", 400, 100);
    expect(box.style.getPropertyValue("--ry")).toBe(`${50 * DRAG_DEG_PER_PX}deg`);
  });

  it("clears the face buttons once the cape is dragged off square", () => {
    const slab = mountSlab(entry, fixtureIndex(), 6);
    const [outer] = slab.el.querySelectorAll<HTMLButtonElement>(".slab-views button");
    outer.click();
    const surface = slab.el.querySelector(".slab-drag")!;
    pointer(surface, "pointerdown", 0, 0);
    pointer(surface, "pointermove", 30, 0);
    expect(outer.getAttribute("aria-pressed")).toBe("false");
  });
});
